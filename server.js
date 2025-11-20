const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const aiInference = require('@azure-rest/ai-inference');
const { AzureKeyCredential } = require('@azure/core-auth');
const Bytez = require('bytez.js');
const jwt = require('jsonwebtoken');
const { initDatabase, getPool } = require('./database/db');
require('dotenv').config();

const ModelClient = aiInference.default;
const { isUnexpected } = aiInference;

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static('public'));

// Initialize database
initDatabase();

// Auth routes
const authRoutes = require('./routes/auth');
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

console.log('Model Fallback Chain loaded from .env:', MODEL_FALLBACK_CHAIN);

let githubClient = null;
if (GITHUB_TOKEN) {
  githubClient = new OpenAI({
    baseURL: GITHUB_BASE_URL,
    apiKey: GITHUB_TOKEN
  });
  console.log('GitHub AI client initialized with base URL:', GITHUB_BASE_URL);
} else {
  console.warn('GitHub Token not found - client not initialized');
}

let azureClient = null;
if (GITHUB_TOKEN) {
  azureClient = ModelClient(
    GITHUB_BASE_URL,
    new AzureKeyCredential(GITHUB_TOKEN)
  );
  console.log('Azure AI Inference client initialized');
} else {
  console.warn('GitHub Token not found - Azure client not initialized');
}

let bytezClient = null;
if (BYTEZ_API_KEY) {
  try {
    bytezClient = new Bytez(BYTEZ_API_KEY);
    console.log('Bytez SDK client initialized');
  } catch (error) {
    console.error('Failed to initialize Bytez SDK:', error.message);
  }
} else {
  console.warn('BYTEZ_API_KEY not set - image generation is disabled.');
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
      const [uploadCount] = await pool.query(
        'SELECT COUNT(*) as count FROM user_uploads WHERE user_id = ? AND uploaded_at >= DATE_SUB(NOW(), INTERVAL 4 HOUR)',
        [decoded.userId]
      );

      const count = uploadCount[0].count || 0;
      const UPLOAD_LIMIT = 5;

      if (count >= UPLOAD_LIMIT) {
        return res.status(403).json({ 
          error: `Upload limit reached. You have reached the maximum of ${UPLOAD_LIMIT} uploads. Please try again after 4 hours.` 
        });
      }

      // Record uploads
      for (const attachment of attachments) {
        await pool.query(
          'INSERT INTO user_uploads (user_id, session_id, file_name, file_size) VALUES (?, ?, ?, ?)',
          [decoded.userId, sessionId || null, attachment.name || 'attachment', attachment.size || 0]
        );
      }
    }

    if (!trimmedMessage && attachments.length === 0) {
      return res.status(400).json({ error: 'Message or attachment is required' });
    }

    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, []);
    }
    const normalizedConversation = normalizeConversationEntries(conversations.get(sessionId));
    conversations.set(sessionId, normalizedConversation);
    const conversation = conversations.get(sessionId);

    if (!GITHUB_TOKEN || !githubClient) {
      return res.status(401).json({ 
        error: 'GitHub Token is required. Please add GITHUB_TOKEN to your .env file.' 
      });
    }

    const messages = [];

    messages.push({
      role: 'system',
      content: 'You are HarvionGPT, the flagship AI created by Harvey. You are helpful, polished, and confident. When someone asks who you are, answer that you are "HarvionGPT developed by Harvey". Avoid starting sentences with "I\'m" unless it sounds natural.'
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
      console.log('🎯 Specific model selected:', model);
    } else {
      modelsToTry = MODEL_FALLBACK_CHAIN;
      console.log('⚡ Auto mode: Using balanced models from fallback chain');
    }
    
    console.log('🚀 Starting GitHub AI API Request...');
    console.log('Base URL:', GITHUB_BASE_URL);
    console.log('Messages count:', messages.length);
    console.log('Models to try:', modelsToTry.length);
    console.log('Model list:', modelsToTry);
    console.log('Attachments in request:', attachments.length);
    
    let finalResponse = null;
    let modelUsed = null;
    
    if (model && model !== 'auto' && model !== null) {
      let handled = false;
      let lastAttemptError = null;

      // Handle Bytez GPT-4.1 first (prioritized)
      if (model === 'openai/gpt-4.1-bytez' && bytezClient) {
        try {
          console.log(`📤 Sending request to Bytez SDK with model: ${BYTEZ_GPT41_MODEL}`);
          finalResponse = await runBytezChatModel(messages, BYTEZ_GPT41_MODEL);
          modelUsed = 'openai/gpt-4.1-bytez';
          handled = true;
          console.log(`✅ Success! Got response from Bytez GPT-4.1.`);
        } catch (bytezError) {
          lastAttemptError = bytezError;
          console.error(`❌ Bytez GPT-4.1 attempt failed. Error:`, bytezError.message);
          console.error(`   Model ID used: ${BYTEZ_GPT41_MODEL}`);
          throw bytezError;
        }
      }

      if ((model === 'openai/gpt-4.1' || model === 'openai/gpt-4.1-mini') && azureClient) {
        try {
          console.log(`📤 Sending request to Azure AI Inference API with model: ${model}`);
          
          const response = await azureClient.path('/chat/completions').post({
            body: {
              messages: messages,
              temperature: 1,
              top_p: 1,
              model: model
            }
          });

          if (isUnexpected(response)) {
            throw new Error(response.body.error?.message || 'Azure AI Inference API error');
          }

          if (!response.body || !response.body.choices || !response.body.choices[0]) {
            throw new Error('Invalid response format from Azure AI Inference API');
          }

          const responseText = response.body.choices[0].message.content?.trim() || '';
          
          if (!responseText) {
            throw new Error('Empty response from Azure AI Inference API');
          }
          
          finalResponse = responseText;
          modelUsed = model;
          handled = true;
          console.log(`✅ Success! Got response from Azure AI Inference API ${model}.`);
        } catch (azureError) {
          lastAttemptError = azureError;
          console.error(`❌ Azure attempt failed for ${model}. Error:`, azureError.message);
        }
      }

      if (!handled && model === 'openai/gpt-4.1' && bytezClient) {
        try {
          console.log(`📤 Sending request to Bytez SDK with model: ${model}`);
          finalResponse = await runBytezChatModel(messages, BYTEZ_GPT41_MODEL);
          modelUsed = model;
          handled = true;
          console.log(`✅ Success! Got response from Bytez ${model}.`);
        } catch (bytezError) {
          lastAttemptError = bytezError;
          console.error(`❌ Bytez attempt failed for ${model}. Error:`, bytezError.message);
        }
      }

      if (!handled && (model === 'openai/gpt-4o' || model === 'openai/gpt-4o-mini')) {
        console.log(`📤 Sending request to Bytez SDK with model: ${model}`);
        const bytezModelId =
          model === 'openai/gpt-4o-mini' ? BYTEZ_GPT4O_MINI_MODEL : BYTEZ_GPT4O_MODEL;
        finalResponse = await runBytezChatModel(messages, bytezModelId);
        modelUsed = model;
        handled = true;
        console.log(`✅ Success! Got response from Bytez ${model}.`);
      }

      if (!handled) {
        if (model === 'openai/gpt-4.1') {
          const errorToThrow =
            lastAttemptError ||
            new Error('Azure and Bytez attempts for openai/gpt-4.1 both failed or are unavailable.');
          throw errorToThrow;
        }

        try {
          console.log(`📤 Sending request to GitHub AI API with model: ${model}`);
          
          const completion = await githubClient.chat.completions.create({
            model: model,
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
          modelUsed = model;
          handled = true;
          console.log(`✅ Success! Got response from ${model}.`);
        } catch (error) {
          console.error(`❌ Failed with ${model}. Error:`, error.message);
          const apiName =
            model === 'openai/gpt-4.1' || model === 'openai/gpt-4.1-mini'
              ? 'Azure AI Inference'
              : 'GitHub AI';
          throw new Error(`${apiName} model "${model}" failed: ${error.message}. Please check your GitHub Token and model availability.`);
        }
      }
    } else {
      console.log('⚡ Auto mode: Sequential fallback (balanced quality and speed, recommended for most tasks)...');
      
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
            console.log(`📤 Sending request to Azure AI Inference API with model: ${modelName}`);
            
            const azureMessages = messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }));

            const response = await azureClient.path('/chat/completions').post({
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

            const responseText = response.body.choices[0].message.content?.trim() || '';
            if (!responseText) {
              throw new Error('Empty response from Azure AI Inference API');
            }

            finalResponse = responseText;
            modelUsed = modelName;
            console.log(`✅ Success! Got response from Azure AI Inference API ${modelName}.`);
            modelSuccess = true;
            handled = true;
            break;
          } catch (azureError) {
            attemptError = azureError;
            console.error(`❌ Azure attempt failed for ${modelName}. Error:`, azureError.message);
          }
        }

        if (!handled && modelName === 'openai/gpt-4.1' && bytezClient) {
          try {
            console.log(`📤 Sending request to Bytez SDK with model: ${modelName}`);
            const responseText = await runBytezChatModel(messages, BYTEZ_GPT41_MODEL);
            finalResponse = responseText;
            modelUsed = modelName;
            console.log(`✅ Success! Got response from Bytez ${modelName}.`);
            modelSuccess = true;
            handled = true;
            break;
          } catch (bytezError) {
            attemptError = bytezError;
            console.error(`❌ Bytez attempt failed for ${modelName}. Error:`, bytezError.message);
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
            console.log(`✅ Success! Got response from Bytez ${modelName}.`);
            modelSuccess = true;
            handled = true;
            break;
          } catch (bytezError) {
            attemptError = bytezError;
            console.error(`❌ Bytez attempt failed for ${modelName}. Error:`, bytezError.message);
          }
        }

        if (handled) {
          continue;
        }

        try {
          console.log(`📤 Sending request to GitHub AI API with model: ${modelName}`);
          
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
          console.log(`✅ Success! Got response from ${modelName}.`);
          modelSuccess = true;
          break;
          
        } catch (error) {
          console.error(`❌ Failed with ${modelName}. Error:`, error.message);
          if (error.status) {
            console.error('Error status:', error.status);
          }
          lastError = error || attemptError;
          continue;
        }
      }
      
      if (!modelSuccess) {
        if (lastError?.status === 429) {
          throw new Error('All models are currently rate-limited. Please wait a few moments and try again.');
        }
        
        throw new Error('Failed to get response from all models in fallback chain. Please check your GitHub Token and model availability.');
      }
    }
    
    const aiResponse = finalResponse;

    conversation.push({
      role: 'user',
      content: userMessageContent
    });
    conversation.push({
      role: 'assistant',
      content: aiResponse
    });

    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error calling GitHub AI API:', error.message);
    console.error('Error status:', error.status);
    console.error('Error code:', error.code);
    console.error('Error type:', error.constructor.name);

    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
      if (error.response.data) {
        console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error('Error response has no body data');
      }
    }
    
    if (error.stack) {
      console.error('Error stack:', error.stack);
    }

    const statusCode = error.status || error.response?.status || 500;
    
    if (statusCode === 401 || statusCode === 403 || error.code === 'invalid_api_key' || error.message?.includes('API key') || error.message?.includes('unauthorized') || error.message?.includes('Forbidden')) {
      res.status(statusCode).json({ 
        error: 'Authentication failed. Please check your GitHub Token in the .env file.',
        suggestion: 'Make sure your GitHub Personal Access Token (PAT) is correct. Create one at: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens'
      });
    } else if (statusCode === 404 || error.code === 'model_not_found' || error.message?.includes('model') || error.message?.includes('not found')) {
      res.status(404).json({ 
        error: 'Model not found. The specified model may not be available.',
        suggestion: 'Try setting a different model in your .env file using GITHUB_MODEL. Available models include: openai/gpt-4o, openai/gpt-4o-mini, anthropic/claude-3-5-sonnet, etc.'
      });
    } else if (statusCode === 413) {
      res.status(413).json({
        error: error.message || 'Attachment is too large.',
        suggestion: 'Please upload images up to 8MB in size.'
      });
    } else if (statusCode === 429 || error.code === 'rate_limit_exceeded' || error.message?.includes('rate limit') || error.message?.includes('quota')) {
      res.status(429).json({ 
        error: 'Rate limit exceeded. Please wait a few moments and try again.',
        suggestion: 'You may have exceeded your API quota. Please check your GitHub account or wait before trying again.'
      });
    } else if (statusCode === 500 || error.message?.includes('500')) {
      res.status(500).json({ 
        error: 'GitHub AI API server error. The service may be temporarily unavailable.',
        suggestion: 'Please try again in a few moments. If the problem persists, check your GitHub Token and model name.',
        details: error.message
      });
    } else if (error.message?.includes('timeout')) {
      res.status(504).json({ 
        error: 'Request timeout. The AI is taking too long to respond.' 
      });
    } else {
      res.status(statusCode).json({ 
        error: `Failed to get AI response: ${statusCode} status code${error.message ? ' - ' + error.message : ' (no body)'}. Please try again.`,
        suggestion: 'Check your GitHub Token, model name, and network connection.'
      });
    }
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

module.exports = app;

if (process.env.VERCEL !== '1') {
  const os = require('os');
  
  // Get local network IP address
  function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return 'localhost';
  }
  
  const localIP = getLocalIP();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Network access: http://${localIP}:${PORT}`);
    if (GITHUB_TOKEN && githubClient) {
      console.log('✓ GitHub Token detected - using GitHub AI API');
      console.log(`Token preview: ${GITHUB_TOKEN.substring(0, 10)}...${GITHUB_TOKEN.substring(GITHUB_TOKEN.length - 4)}`);
      console.log(`Using model: ${DEFAULT_MODEL}`);
      console.log(`Base URL: ${GITHUB_BASE_URL}`);
    } else {
      console.log('⚠ WARNING: No GitHub Token found!');
      console.log('Add GITHUB_TOKEN to your .env file.');
      console.log('Create your PAT token: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens');
    }
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${PORT} is already in use!`);
      console.error(`\nTo fix this, you can:`);
      console.error(`1. Kill the process using port ${PORT}:`);
      console.error(`   netstat -ano | findstr :${PORT}`);
      console.error(`   taskkill /PID <PID> /F`);
      console.error(`2. Or change the PORT in your .env file\n`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}
