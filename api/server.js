const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const aiInference = require('@azure-rest/ai-inference');
const { AzureKeyCredential } = require('@azure/core-auth');
const Bytez = require('bytez.js');
const jwt = require('jsonwebtoken');
const { initDatabase, getPool } = require('../database/db');
require('dotenv').config();

const ModelClient = aiInference.default;
const { isUnexpected } = aiInference;

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Add request logging for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Initialize database (lazy initialization for serverless)
initDatabase().catch(err => {
  console.error('Database initialization error:', err);
});

// Auth routes
const authRoutes = require('../routes/auth');
app.use('/api/auth', authRoutes);

const GITHUB_TOKEN = (process.env.GITHUB_TOKEN || '').trim();
const GITHUB_BASE_URL = 'https://models.github.ai/inference';
const DEFAULT_MODEL = process.env.GITHUB_MODEL || 'openai/gpt-4o';
const BYTEZ_API_KEY = (process.env.BYTEZ_API_KEY || '').trim();
const DEFAULT_IMAGE_MODEL =
  process.env.BYTEZ_IMAGE_MODEL || 'stabilityai/stable-diffusion-xl-base-1.0';
const BYTEZ_GPT4O_MODEL = process.env.BYTEZ_GPT4O_MODEL || 'openai/gpt-4o';
const BYTEZ_GPT4O_MINI_MODEL =
  process.env.BYTEZ_GPT4O_MINI_MODEL || 'openai/gpt-4o-mini';
const BYTEZ_GPT41_MODEL = process.env.BYTEZ_GPT41_MODEL || 'openai/gpt-4.1';

let MODEL_FALLBACK_CHAIN = [];
if (process.env.GITHUB_MODELS) {
  MODEL_FALLBACK_CHAIN = process.env.GITHUB_MODELS
    .split(',')
    .map(model => model.trim())
    .filter(model => model.length > 0);
} else {
  MODEL_FALLBACK_CHAIN = [
    'openai/gpt-4.1-bytez',
    'openai/gpt-4.1',
    'openai/gpt-4.1-mini',
    'openai/gpt-4o',
    'openai/gpt-4o-mini'
  ];
}

let githubClient = null;
if (GITHUB_TOKEN) {
  githubClient = new OpenAI({
    baseURL: GITHUB_BASE_URL,
    apiKey: GITHUB_TOKEN
  });
}

let azureClient = null;
if (GITHUB_TOKEN) {
  azureClient = ModelClient(
    GITHUB_BASE_URL,
    new AzureKeyCredential(GITHUB_TOKEN)
  );
}

let bytezClient = null;
if (BYTEZ_API_KEY) {
  try {
    bytezClient = new Bytez(BYTEZ_API_KEY);
    console.log('Bytez SDK client initialized (API server)');
  } catch (error) {
    console.error('Failed to initialize Bytez SDK (API server):', error.message);
  }
}

const conversations = new Map();
const MAX_ATTACHMENTS_PER_MESSAGE = 4;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

function flattenMessageContent(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part) return '';
        if (typeof part === 'string') return part;
        if (part.type === 'text' && typeof part.text === 'string') {
          return part.text;
        }
        if (part.type === 'image_url') {
          return '[Image attachment provided in chat]';
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') {
      return content.text;
    }
    if (Array.isArray(content.content)) {
      return flattenMessageContent(content.content);
    }
  }

  return '';
}

function extractImageUrlFromOutput(output) {
  if (!output) {
    return null;
  }

  if (typeof output === 'string') {
    if (output.startsWith('http') || output.startsWith('data:image')) {
      return output;
    }
    return null;
  }

  if (Array.isArray(output)) {
    for (const item of output) {
      const url = extractImageUrlFromOutput(item);
      if (url) {
        return url;
      }
    }
    return null;
  }

  if (typeof output === 'object') {
    const candidates = [
      output.imageUrl,
      output.image_url,
      output.url,
      output.data,
      output.output
    ];

    for (const candidate of candidates) {
      const url = extractImageUrlFromOutput(candidate);
      if (url) {
        return url;
      }
    }
  }

  return null;
}

function normalizeConversationEntries(entries = []) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.reduce((acc, entry) => {
    if (!entry) {
      return acc;
    }

    if (typeof entry === 'string') {
      if (entry.startsWith('User: ')) {
        acc.push({ role: 'user', content: entry.replace('User: ', '') });
      } else if (entry.startsWith('Assistant: ')) {
        acc.push({ role: 'assistant', content: entry.replace('Assistant: ', '') });
      }
      return acc;
    }

    if (entry.role && entry.content !== undefined) {
      acc.push(entry);
    }

    return acc;
  }, []);
}

function extractMimeType(dataUrl = '') {
  const match = /^data:(.*?);base64/.exec(dataUrl);
  return match ? match[1] : null;
}

function estimateBase64Size(dataUrl = '') {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) {
    return 0;
  }
  const base64 = dataUrl.substring(commaIndex + 1);
  return Math.ceil(base64.length * 0.75);
}

function sanitizeAttachments(rawAttachments = []) {
  if (!Array.isArray(rawAttachments) || rawAttachments.length === 0) {
    return [];
  }

  return rawAttachments
    .slice(0, MAX_ATTACHMENTS_PER_MESSAGE)
    .map((attachment) => {
      if (!attachment || typeof attachment !== 'object') {
        return null;
      }

      let dataUrl = typeof attachment.dataUrl === 'string' ? attachment.dataUrl : null;

      if (!dataUrl && typeof attachment.data === 'string' && attachment.mimeType) {
        dataUrl = `data:${attachment.mimeType};base64,${attachment.data}`;
      }

      if (!dataUrl || !dataUrl.startsWith('data:image')) {
        return null;
      }

      const estimatedSize = estimateBase64Size(dataUrl);
      if (estimatedSize > MAX_ATTACHMENT_BYTES) {
        const sizeError = new Error(
          `Attachment "${attachment.name || 'image'}" exceeds the ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB limit.`
        );
        sizeError.status = 413;
        throw sizeError;
      }

      return {
        id: attachment.id,
        name: attachment.name || 'Image',
        mimeType: attachment.mimeType || extractMimeType(dataUrl) || 'image/png',
        dataUrl
      };
    })
    .filter(Boolean);
}

function buildUserContent(text, attachments = []) {
  const trimmedText = (text || '').trim();

  if (!attachments || attachments.length === 0) {
    return trimmedText;
  }

  const contentParts = [];

  if (trimmedText) {
    contentParts.push({
      type: 'text',
      text: trimmedText
    });
  }

  attachments.forEach((attachment) => {
    if (attachment?.dataUrl) {
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: attachment.dataUrl,
          detail: 'auto'
        }
      });
    }
  });

  if (!contentParts.some((part) => part.type === 'text')) {
    contentParts.unshift({
      type: 'text',
      text: 'Please review the attached image.'
    });
  }

  return contentParts;
}

function extractImageUrlFromOutput(output) {
  if (!output) {
    return null;
  }

  if (typeof output === 'string') {
    if (output.startsWith('http') || output.startsWith('data:image')) {
      return output;
    }
    return null;
  }

  if (Array.isArray(output)) {
    for (const item of output) {
      const url = extractImageUrlFromOutput(item);
      if (url) {
        return url;
      }
    }
    return null;
  }

  if (typeof output === 'object') {
    const candidates = [
      output.imageUrl,
      output.image_url,
      output.url,
      output.data,
      output.output
    ];

    for (const candidate of candidates) {
      const url = extractImageUrlFromOutput(candidate);
      if (url) {
        return url;
      }
    }
  }

  return null;
}

async function runBytezChatModel(messages, modelId = BYTEZ_GPT4O_MODEL) {
  if (!bytezClient) {
    throw new Error('Bytez client not configured. Please set BYTEZ_API_KEY.');
  }

  const bytezModel = bytezClient.model(modelId);
  const normalizedMessages = messages.map((msg) => ({
    role: msg.role,
    content: flattenMessageContent(msg.content)
  }));

  const { error, output } = await bytezModel.run(normalizedMessages);

  if (error) {
    const errorMsg = error.message || error.toString() || 'Bytez model returned an error.';
    console.error(`Bytez API Error for model ${modelId}:`, error);
    throw new Error(`Bytez API Error: ${errorMsg}`);
  }

  let responseText = '';

  if (typeof output === 'string') {
    responseText = output.trim();
  } else if (Array.isArray(output)) {
    const assistantMessage = output.find(
      (entry) => entry && typeof entry === 'object' && entry.role === 'assistant' && entry.content
    );
    if (assistantMessage) {
      responseText =
        typeof assistantMessage.content === 'string'
          ? assistantMessage.content.trim()
          : flattenMessageContent(assistantMessage.content).trim();
    } else {
      responseText = output
        .map((entry) =>
          typeof entry === 'string'
            ? entry
            : entry?.content
              ? flattenMessageContent(entry.content)
              : ''
        )
        .filter(Boolean)
        .join('\n')
        .trim();
    }
  } else if (output && typeof output === 'object') {
    if (typeof output.content === 'string') {
      responseText = output.content.trim();
    } else if (Array.isArray(output.content)) {
      responseText = flattenMessageContent(output.content).trim();
    }
  }

  if (!responseText) {
    throw new Error('Bytez model returned an empty response.');
  }

  return responseText;
}

// Helper function to verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, model } = req.body;
    const message = typeof req.body.message === 'string' ? req.body.message : '';
    const trimmedMessage = message.trim();
    const attachments = sanitizeAttachments(req.body.attachments || []);

    // Check authentication if attachments are present
    if (attachments.length > 0) {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ 
          error: 'Authentication required to upload attachments. Please log in first.' 
        });
      }

      // Check upload limit (last 4 hours only)
      const pool = getPool();
      const uploadCountResult = await pool.query(
        "SELECT COUNT(*)::int as count FROM user_uploads WHERE user_id = $1 AND uploaded_at >= NOW() - INTERVAL '4 hours'",
        [decoded.userId]
      );

      const count = parseInt(uploadCountResult.rows[0].count) || 0;
      const UPLOAD_LIMIT = 5;

      if (count >= UPLOAD_LIMIT) {
        return res.status(403).json({ 
          error: `Upload limit reached. You have reached the maximum of ${UPLOAD_LIMIT} uploads. Please try again after 4 hours.` 
        });
      }

      // Record uploads
      for (const attachment of attachments) {
        await pool.query(
          'INSERT INTO user_uploads (user_id, session_id, file_name, file_size) VALUES ($1, $2, $3, $4)',
          [decoded.userId, sessionId || null, attachment.name || 'attachment', attachment.size || 0]
        );
      }
    }

    if (!trimmedMessage && attachments.length === 0) {
      return res.status(400).json({ error: 'Message or attachment is required' });
    }

    if (!GITHUB_TOKEN) {
      return res.status(401).json({ 
        error: 'GitHub Token is required. Please add GITHUB_TOKEN to your environment variables.' 
      });
    }

    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, []);
    }
    const normalizedConversation = normalizeConversationEntries(conversations.get(sessionId));
    conversations.set(sessionId, normalizedConversation);
    const conversation = conversations.get(sessionId);

    const messages = [];
    messages.push({
      role: 'system',
      content: 'You are HarvionGPT, the flagship AI created by Harvey. You are helpful, polished, and confident. When asked who you are, respond that you are "HarvionGPT developed by Harvey."'
    });

    if (conversation.length > 0) {
      conversation.forEach((entry) => {
        if (entry?.role && entry.content !== undefined) {
          messages.push({
            role: entry.role,
            content: entry.content
          });
        }
      });
    }

    const userMessageContent = buildUserContent(trimmedMessage, attachments);

    messages.push({
      role: 'user',
      content: userMessageContent
    });

    let modelsToTry = [];
    if (model && model !== 'auto' && model !== null) {
      modelsToTry = [model];
    } else {
      modelsToTry = MODEL_FALLBACK_CHAIN;
    }

    let finalResponse = null;
    let modelUsed = null;
    let modelSuccess = false;
    let lastError = null;

    for (const modelName of modelsToTry) {
      console.log(`\n➡️ Trying model: **${modelName}**`);

      let handled = false;
      let attemptError = null;

      // Handle Bytez GPT-4.1 first (prioritized)
      if (modelName === 'openai/gpt-4.1-bytez' && bytezClient) {
        try {
          console.log(`📤 Sending request to Bytez SDK with model: ${BYTEZ_GPT41_MODEL}`);
          const responseText = await runBytezChatModel(messages, BYTEZ_GPT41_MODEL);
          finalResponse = responseText;
          modelUsed = 'openai/gpt-4.1-bytez';
          console.log(`✅ Success! Got response from Bytez GPT-4.1.`);
          modelSuccess = true;
          handled = true;
          break;
        } catch (bytezError) {
          attemptError = bytezError;
          console.error(`❌ Bytez GPT-4.1 attempt failed. Error:`, bytezError.message);
          console.error(`   Model ID used: ${BYTEZ_GPT41_MODEL}`);
        }
      }

      if ((modelName === 'openai/gpt-4.1' || modelName === 'openai/gpt-4.1-mini') && azureClient) {
        try {
          const azureMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }));
          const response = await azureClient.path("/chat/completions").post({
            body: {
              messages: azureMessages,
              temperature: 1,
              top_p: 1,
              model: modelName
            }
          });

          if (isUnexpected(response)) {
            throw response.body.error;
          }
          finalResponse = response.body.choices[0].message.content?.trim() || '';
          modelUsed = modelName;
          modelSuccess = true;
          handled = true;
          break;
        } catch (azureError) {
          attemptError = azureError;
          console.error(`Failed Azure attempt for ${modelName}:`, azureError.message);
        }
      }

      if (!handled && modelName === 'openai/gpt-4.1' && bytezClient) {
        try {
          console.log(`📤 Sending request to Bytez SDK with model: ${modelName}`);
          const responseText = await runBytezChatModel(messages, BYTEZ_GPT41_MODEL);
          finalResponse = responseText;
          modelUsed = modelName;
          modelSuccess = true;
          handled = true;
          break;
        } catch (bytezError) {
          attemptError = bytezError;
          console.error(`Failed Bytez attempt for ${modelName}:`, bytezError.message);
        }
      }

      if (!handled && (modelName === 'openai/gpt-4o' || modelName === 'openai/gpt-4o-mini')) {
        try {
          console.log(`📤 Sending request to Bytez SDK with model: ${modelName}`);
          const bytezModelId =
            modelName === 'openai/gpt-4o-mini' ? BYTEZ_GPT4O_MINI_MODEL : BYTEZ_GPT4O_MODEL;
          const responseText = await runBytezChatModel(messages, bytezModelId);
          finalResponse = responseText;
          modelUsed = modelName;
          modelSuccess = true;
          handled = true;
          break;
        } catch (bytezError) {
          attemptError = bytezError;
          console.error(`Failed Bytez attempt for ${modelName}:`, bytezError.message);
        }
      }

      if (handled) {
        continue;
      }

      try {
        if (!githubClient) {
          throw attemptError || new Error('AI client not initialized for this model type.');
        }

        const completion = await githubClient.chat.completions.create({
          model: modelName,
          messages: messages,
          temperature: 1,
          max_tokens: 4096,
          top_p: 1
        });

        if (!completion || !completion.choices || !completion.choices[0]) {
          throw new Error('Invalid response format from GitHub AI API');
        }

        const responseMessage = completion.choices[0].message;
        const responseText = responseMessage.content?.trim() || '';
        
        if (!responseText) {
          throw new Error('Empty response from GitHub AI API');
        }
        
        finalResponse = responseText;
        modelUsed = modelName;
        modelSuccess = true;
        break;
      } catch (error) {
        lastError = error || attemptError;
        console.error(`Failed with ${modelName}:`, lastError?.message || error?.message);
        continue;
      }
    }

    if (!modelSuccess) {
      throw lastError || new Error('All models failed');
    }

    conversation.push({
      role: 'user',
      content: userMessageContent
    });
    conversation.push({
      role: 'assistant',
      content: finalResponse
    });

    res.json({ response: finalResponse });
  } catch (error) {
    console.error('Error:', error);
    const statusCode = error.status || error.response?.status || 500;
    res.status(statusCode).json({ 
      error: error.message || (statusCode === 413 ? 'Attachment is too large.' : 'Failed to get AI response'),
      suggestion: statusCode === 413 ? 'Please upload images up to 8MB in size.' : 'Check your GitHub Token and model configuration.'
    });
  }
});

app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, model, options } = req.body || {};
    const trimmedPrompt = (prompt || '').trim();

    if (!trimmedPrompt) {
      return res.status(400).json({ error: 'Prompt is required for image generation.' });
    }

    if (!bytezClient) {
      return res.status(500).json({
        error: 'Image generation is not configured. Please set BYTEZ_API_KEY on the server.'
      });
    }

    const modelId = model || DEFAULT_IMAGE_MODEL;
    const imageModel = bytezClient.model(modelId);
    const runOptions = options && typeof options === 'object' ? options : undefined;
    const { error, output } = await imageModel.run(trimmedPrompt, runOptions);

    if (error) {
      throw new Error(error.message || 'Bytez model returned an error');
    }

    const imageUrl = extractImageUrlFromOutput(output);
    if (!imageUrl) {
      throw new Error('Bytez model did not return an image URL.');
    }

    res.json({
      imageUrl,
      prompt: trimmedPrompt,
      model: modelId,
      raw: output
    });
  } catch (error) {
    console.error('Image generation failed:', error.message);
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({
      error: error.message || 'Failed to generate image',
      details: error.response?.data || null
    });
  }
});

app.post('/api/clear', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && conversations.has(sessionId)) {
    conversations.delete(sessionId);
  }
  res.json({ success: true });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    vercel: process.env.VERCEL === '1',
    hasDatabase: !!getPool(),
    hasGithubToken: !!GITHUB_TOKEN
  });
});

// For Vercel serverless functions
// Export as handler function (similar to cron-cleanup.js)
module.exports = async (req, res) => {
  // Log all incoming requests for debugging
  console.log('=== INCOMING REQUEST ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Path:', req.path);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('========================');
  
  // Ensure database is initialized
  if (!getPool()) {
    try {
      console.log('Initializing database...');
      await initDatabase();
      console.log('Database initialized');
    } catch (err) {
      console.error('Database init error:', err);
    }
  }
  
  // Handle the request with Express app
  try {
    return app(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

