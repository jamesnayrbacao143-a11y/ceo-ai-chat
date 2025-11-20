const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const aiInference = require('@azure-rest/ai-inference');
const { AzureKeyCredential } = require('@azure/core-auth');
require('dotenv').config();

const ModelClient = aiInference.default;
const { isUnexpected } = aiInference;

const app = express();
const PORT = process.env.PORT || 3000;

// Export for Vercel serverless function
module.exports = app;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// GitHub AI API configuration
// Get your Personal Access Token (PAT) from GitHub settings
// Create your PAT token: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
const GITHUB_TOKEN = (process.env.GITHUB_TOKEN || '').trim();
const GITHUB_BASE_URL = 'https://models.github.ai/inference';

// Default model
const DEFAULT_MODEL = process.env.GITHUB_MODEL || 'openai/gpt-4o';

// Get multiple models from environment variable (comma-separated)
// If GITHUB_MODELS is set, use it; otherwise use DEFAULT_MODEL as single-item array
let MODEL_FALLBACK_CHAIN = [];
if (process.env.GITHUB_MODELS) {
  // Parse comma-separated models from .env
  MODEL_FALLBACK_CHAIN = process.env.GITHUB_MODELS
    .split(',')
    .map(model => model.trim())
    .filter(model => model.length > 0);
} else {
  // Fallback to single model if GITHUB_MODELS not specified
  MODEL_FALLBACK_CHAIN = [DEFAULT_MODEL];
}

console.log('Model Fallback Chain loaded from .env:', MODEL_FALLBACK_CHAIN);

// Initialize GitHub AI client (OpenAI SDK)
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

// Initialize Azure AI Inference client
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

// Store conversation history per session
const conversations = new Map();

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, model } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get or create conversation history for this session
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, []);
    }
    const conversation = conversations.get(sessionId);

    // Check if GitHub Token is available
    if (!GITHUB_TOKEN || !githubClient) {
      return res.status(401).json({ 
        error: 'GitHub Token is required. Please add GITHUB_TOKEN to your .env file.' 
      });
    }

    // Build messages array for GitHub AI API (OpenAI-compatible format)
    const messages = [];
    
    // Add system message
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
      // If specific model selected, use ONLY that model (no fallback)
      modelsToTry = [model];
      console.log('🎯 Specific model selected:', model);
    } else {
      // Auto mode: Use all models from fallback chain (balanced quality and speed)
      modelsToTry = MODEL_FALLBACK_CHAIN;
      console.log('⚡ Auto mode: Using balanced models from fallback chain');
    }
    
    console.log('🚀 Starting GitHub AI API Request...');
    console.log('Base URL:', GITHUB_BASE_URL);
    console.log('Messages count:', messages.length);
    console.log('Models to try:', modelsToTry.length);
    console.log('Model list:', modelsToTry);
    
    let finalResponse = null;
    let modelUsed = null;
    
    if (model && model !== 'auto' && model !== null) {
      // SPECIFIC MODEL MODE: Try the selected model
      try {
        // Check if model uses Azure AI Inference API (openai/gpt-4.1)
        if (model === 'openai/gpt-4.1' && azureClient) {
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
          console.log(`✅ Success! Got response from Azure AI Inference API ${model}.`);
        } else {
          // Use GitHub AI API (OpenAI SDK) for other models
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
          console.log(`✅ Success! Got response from ${model}.`);
        }
        
      } catch (error) {
        console.error(`❌ Failed with ${model}. Error:`, error.message);
        const apiName = model === 'openai/gpt-4.1' ? 'Azure AI Inference' : 'GitHub AI';
        throw new Error(`${apiName} model "${model}" failed: ${error.message}. Please check your GitHub Token and model availability.`);
      }
      
    } else {
      // AUTO MODE: Sequential fallback - try each model until one succeeds (recommended for most tasks)
      console.log('⚡ Auto mode: Sequential fallback (balanced quality and speed, recommended for most tasks)...');
      
      let modelSuccess = false;
      let lastError = null;
      
      for (const modelName of modelsToTry) {
        try {
          console.log(`\n➡️ Trying model: **${modelName}**`);
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
          break; // Break out of loop on success
          
        } catch (error) {
          console.error(`❌ Failed with ${modelName}. Error:`, error.message);
          if (error.status) {
            console.error('Error status:', error.status);
          }
          lastError = error;
          continue; // Try next model
        }
      }
      
      if (!modelSuccess) {
        // Check if it's a rate limit error
        if (lastError?.status === 429) {
          throw new Error('All models are currently rate-limited. Please wait a few moments and try again.');
        }
        
        throw new Error('Failed to get response from all models in fallback chain. Please check your GitHub Token and model availability.');
      }
    }
    
    const aiResponse = finalResponse;

    // Add to conversation history
    conversation.push(`User: ${message}`);
    conversation.push(`Assistant: ${aiResponse}`);

    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error calling GitHub AI API:', error.message);
    console.error('Error status:', error.status);
    console.error('Error code:', error.code);
    console.error('Error type:', error.constructor.name);
    
    // Check for OpenAI SDK error format
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
    
    // Handle different error cases
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

// Clear conversation endpoint
app.post('/api/clear', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && conversations.has(sessionId)) {
    conversations.delete(sessionId);
  }
  res.json({ success: true });
});

// Only start server if not in Vercel serverless environment
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
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
  });
}
