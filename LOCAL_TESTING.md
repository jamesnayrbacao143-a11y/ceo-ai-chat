# Local Testing Guide

## Quick Start

1. **Install Dependencies** (if not already installed)
   ```bash
   npm install
   ```

2. **Create `.env` file** (if not exists)
   ```bash
   # Copy from example
   copy env.example .env
   ```

3. **Configure `.env` file**
   
   **Required:**
   - `GITHUB_TOKEN` - Your GitHub Personal Access Token
   - `JWT_SECRET` - Any random string (for authentication)
   - `DATABASE_URL` - Your Supabase connection string (or leave empty for testing without DB)
   
   **Optional:**
   - `BYTEZ_API_KEY` - For image generation
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` - For Google OAuth
   - `EMAIL_*` - For email verification

4. **Start the Server**
   ```bash
   npm start
   ```
   
   Or:
   ```bash
   node server.js
   ```

5. **Open in Browser**
   - Main app: http://localhost:3000
   - Health check: http://localhost:3000/api/health
   - Chat API: http://localhost:3000/api/chat (POST)

## Testing Endpoints

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Chat Endpoint
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "sessionId": "test123"}'
```

### Google Auth
```bash
# Open in browser:
http://localhost:3000/api/auth/google
```

## Notes

- The local server uses `server.js` (not `api/server.js`)
- `api/server.js` is for Vercel deployment only
- Database is optional for local testing (chat will work without it)
- Make sure port 3000 is not in use

## Troubleshooting

**Port already in use:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or change PORT in .env
PORT=3001
```

**Missing dependencies:**
```bash
npm install
```

**Database connection issues:**
- For local testing, you can skip DATABASE_URL
- Chat will work, but auth features won't

