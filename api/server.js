// Vercel serverless function handler
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const aiInference = require('@azure-rest/ai-inference');
const { AzureKeyCredential } = require('@azure/core-auth');

const ModelClient = aiInference.default;
const { isUnexpected } = aiInference;

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// GitHub AI API configuration
const GITHUB_TOKEN = (process.env.GITHUB_TOKEN || '').trim();
const GITHUB_BASE_URL = 'https://models.github.ai/inference';
const DEFAULT_MODEL = process.env.GITHUB_MODEL || 'openai/gpt-4o';

// Get multiple models from environment variable (comma-separated)
let MODEL_FALLBACK_CHAIN = [];
if (process.env.GITHUB_MODELS) {
  MODEL_FALLBACK_CHAIN = process.env.GITHUB_MODELS
    .split(',')
    .map(model => model.trim())
    .filter(model => model.length > 0);
} else {
  MODEL_FALLBACK_CHAIN = [DEFAULT_MODEL];
}

// Initialize GitHub AI client
let githubClient = null;
if (GITHUB_TOKEN) {
  githubClient = new OpenAI({
    baseURL: GITHUB_BASE_URL,
    apiKey: GITHUB_TOKEN
  });
}

// Initialize Azure AI Inference client
let azureClient = null;
if (GITHUB_TOKEN) {
  azureClient = ModelClient(
    GITHUB_BASE_URL,
    new AzureKeyCredential(GITHUB_TOKEN)
  );
}

// Store conversations in memory (for serverless, consider using a database)
const conversations = new Map();

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, model } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!GITHUB_TOKEN) {
      return res.status(401).json({ 
        error: 'GitHub Token is required. Please add GITHUB_TOKEN to your environment variables.' 
      });
    }

    // Get or create conversation
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, []);
    }
    const conversation = conversations.get(sessionId);

    // Build messages array
    const messages = [];
    messages.push({
      role: 'system',
      content: 'You are CEO AI Assistant, developed by Harvey. You are a helpful, friendly, and knowledgeable AI assistant. When asked about your name or who you are, respond that you are "CEO AI Assistant developed by Harvey" or "CEO AI Assistant developed by Harvey". Do not mention your identity unless specifically asked. Avoid starting responses with "I\'m" unnecessarily.'
    });

    // Add conversation history
    if (conversation.length > 0) {
      for (let i = 0; i < conversation.length; i++) {
        if (conversation[i].startsWith('User: ')) {
          messages.push({
            role: 'user',
            content: conversation[i].replace('User: ', '')
          });
        } else if (conversation[i].startsWith('Assistant: ')) {
          messages.push({
            role: 'assistant',
            content: conversation[i].replace('Assistant: ', '')
          });
        }
      }
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    });

    // Determine which models to try
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
      try {
        let completion;
        if (modelName === 'openai/gpt-4.1' && azureClient) {
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
          break;
        } else if (githubClient) {
          completion = await githubClient.chat.completions.create({
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
        } else {
          throw new Error('AI client not initialized for this model type.');
        }
      } catch (error) {
        lastError = error;
        console.error(`Failed with ${modelName}:`, error.message);
        continue;
      }
    }

    if (!modelSuccess) {
      throw lastError || new Error('All models failed');
    }

    // Update conversation
    conversation.push(`User: ${message}`);
    conversation.push(`Assistant: ${finalResponse}`);

    // Return response
    res.json({ response: finalResponse });
  } catch (error) {
    console.error('Error:', error);
    const statusCode = error.status || error.response?.status || 500;
    res.status(statusCode).json({ 
      error: error.message || 'Failed to get AI response',
      suggestion: 'Check your GitHub Token and model configuration.'
    });
  }
});

// Clear conversation endpoint
app.post('/api/clear', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && conversations.has(sessionId)) {
    conversations.delete(sessionId);
  }
  res.json({ success: true });
});

// Export handler for Vercel
module.exports = app;

