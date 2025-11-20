# CEO AI 🤖

A modern, ChatGPT-like web application built with Node.js and GitHub Models API. Features dark mode, responsive design, and multiple AI model support.

## Features

- 🎨 Modern, responsive UI similar to ChatGPT
- 💬 Real-time chat interface
- 🧠 Powered by GitHub Models API (OpenAI, Anthropic, Meta, Google models)
- 📱 Mobile-friendly design
- ⚡ Fast and lightweight
- 🔒 Session-based conversation history
- 🤖 Multiple AI models available (GPT-4o, Claude, Llama, Gemini)

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installing Node.js and npm

If you see the error "npm is not recognized as the name of a cmdlet", you need to install Node.js first:

1. **Download Node.js:**
   - Visit https://nodejs.org/
   - Download the LTS (Long Term Support) version for Windows
   - Choose the Windows Installer (.msi) for your system (64-bit recommended)

2. **Install Node.js:**
   - Run the downloaded installer
   - Follow the installation wizard (accept defaults)
   - **Important:** Make sure "Add to PATH" is checked during installation

3. **Verify Installation:**
   - Close and reopen your terminal/PowerShell
   - Run these commands to verify:
     ```bash
     node --version
     npm --version
     ```
   - You should see version numbers for both commands

4. **If npm still doesn't work after installation:**
   - Restart your computer (sometimes required for PATH changes to take effect)
   - Or manually add Node.js to your PATH environment variable

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure API Token (Required)**
   
   - Copy `env.example` to `.env`:
     ```bash
     copy env.example .env
     ```
     (On Linux/Mac: `cp env.example .env`)
   
   - **Create your GitHub Personal Access Token (PAT):**
     - Visit: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
     - Click "Generate new token" → "Generate new token (classic)"
     - Give it a name (e.g., "AI Chat Bot")
     - Select appropriate scopes (check GitHub Models API documentation for required permissions)
     - Copy the token
   
   - Add your GitHub token to the `.env` file:
     ```
     GITHUB_TOKEN=your_github_pat_token_here
     ```
   
   **Optional:** You can customize the AI model:
   ```
   # Change the default model
   GITHUB_MODEL=openai/gpt-4o
   
   # Or use multiple models for Auto mode (comma-separated)
   GITHUB_MODELS=openai/gpt-4o,openai/gpt-4o-mini,anthropic/claude-3-5-sonnet
   ```
   
   **Available Models:**
   - OpenAI: `openai/gpt-4o`, `openai/gpt-4o-mini`, `openai/gpt-4-turbo`, `openai/gpt-3.5-turbo`
   - Anthropic: `anthropic/claude-3-5-sonnet`, `anthropic/claude-3-opus`, `anthropic/claude-3-sonnet`, `anthropic/claude-3-haiku`
   - Meta: `meta/llama-3.1-405b`, `meta/llama-3.1-70b`, `meta/llama-3.1-8b`
   - Google: `google/gemini-2.0-flash-exp`, `google/gemini-1.5-pro`, `google/gemini-1.5-flash`

3. **Start the Server**
   ```bash
   npm start
   ```

4. **Open in Browser**
   
   Navigate to: `http://localhost:3000`

## Usage

1. Type your message in the input box at the bottom
2. Press Enter or click the send button
3. Wait for the AI response
4. Continue the conversation!
5. Click "Clear Chat" to start a new conversation

## Project Structure

```
.
├── server.js          # Express backend server
├── package.json       # Dependencies and scripts
├── .env.example       # Environment variables template
├── README.md          # This file
└── public/
    ├── index.html     # Main HTML file
    ├── styles.css     # Styling
    └── script.js      # Frontend JavaScript
```

## Technologies Used

- **Backend:** Node.js, Express.js
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **AI API:** GitHub Models API (OpenAI-compatible)
- **Styling:** Modern CSS with gradients and animations

## Troubleshooting

### "npm is not recognized" or "node is not recognized" error
- **Solution:** Node.js is not installed. See the [Installing Node.js and npm](#installing-nodejs-and-npm) section above.
- After installing Node.js, close and reopen your terminal/PowerShell
- Verify installation with `node --version` and `npm --version`

### Authentication errors (401/403)
- Make sure your GitHub token is correctly set in the `.env` file
- Verify the token is valid and has the correct permissions
- Ensure there are no extra spaces or quotes around the token in `.env`
- Check that your GitHub Personal Access Token hasn't expired

### Rate limit errors (429)
- **Quota exceeded**: You may have exceeded your GitHub Models API quota
- **Automatic fallback**: In Auto mode, the app will automatically try other models if one is rate-limited
- **Solutions**:
  - Wait a few moments and try again
  - Switch to a different model using the model selector dropdown
  - Check your GitHub account quota limits
  - Try using Auto mode which will try multiple models

### Slow responses
- Check your internet connection
- API response times can vary based on server load and model availability

### Port already in use
- Change the PORT in `.env` file
- Or kill the process using port 3000

## Deployment

### Deploy to Vercel

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions on:
- Uploading to GitHub
- Deploying to Vercel
- Setting up environment variables
- Custom domain configuration

**Quick Deploy:**
1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables (`GITHUB_TOKEN`, `GITHUB_MODEL`)
4. Deploy!

## License

MIT License - feel free to use this project for personal or commercial purposes!

## Credits

- AI Models: Multiple models via [GitHub Models API](https://models.github.ai/)
- API Provider: [GitHub](https://github.com/)
- AI Identity: CEO AI Assistant developed by Harvey
- Deployment: [Vercel](https://vercel.com)

