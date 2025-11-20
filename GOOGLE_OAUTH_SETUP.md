# Google OAuth Setup Guide

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name (e.g., "HarvionGPT")
4. Click "Create"

## Step 2: Enable Google+ API

1. In Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google+ API" or "People API"
3. Click on it and click "Enable"

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure OAuth consent screen first:
   - Choose "External" (unless you have Google Workspace)
   - Fill in required fields:
     - App name: HarvionGPT
     - User support email: your email
     - Developer contact: your email
   - Click "Save and Continue"
   - Add scopes: `userinfo.email` and `userinfo.profile`
   - Click "Save and Continue"
   - Add test users (your email) if needed
   - Click "Save and Continue"

4. Back to Credentials, click "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Name it (e.g., "HarvionGPT Web Client")
7. **IMPORTANT**: Add Authorized redirect URIs:
   - `http://localhost:3000/api/auth/google/callback` (for local development)
   - `https://yourdomain.com/api/auth/google/callback` (for production)
8. Click "Create"
9. **Copy the Client ID and Client Secret**

## Step 4: Add to .env File

Add these to your `.env` file:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

**Important Notes:**
- Replace `your_client_id_here` with your actual Client ID
- Replace `your_client_secret_here` with your actual Client Secret
- For localhost, use `http://localhost:3000/api/auth/google/callback`
- For production, update `GOOGLE_REDIRECT_URI` to your production URL

## Step 5: Restart Server

After adding the credentials, restart your server:

```bash
npm start
```

## Common Errors and Solutions

### Error: "redirect_uri_mismatch"
- **Solution**: Make sure the redirect URI in your `.env` file matches EXACTLY what you added in Google Cloud Console
- Check for trailing slashes, `http` vs `https`, and port numbers

### Error: "invalid_client"
- **Solution**: Check that your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Make sure there are no extra spaces or quotes in your `.env` file

### Error: "Google OAuth not configured"
- **Solution**: Make sure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in your `.env` file
- Restart the server after adding them

### Error: "access_denied"
- **Solution**: User cancelled the authorization. This is normal if user clicks "Cancel"

## Testing

1. Make sure your server is running
2. Click "Continue with Google" button
3. You should be redirected to Google login
4. After logging in, you should be redirected back to your app
5. You should be automatically logged in

## Production Setup

For production deployment:

1. Update `GOOGLE_REDIRECT_URI` in your `.env` to your production URL
2. Add the production redirect URI to Google Cloud Console
3. Update `APP_URL` in `.env` to your production URL
4. Deploy and test

## Security Notes

- Never commit your `.env` file to git
- Keep your Client Secret secure
- Use environment variables in production (Vercel, Heroku, etc.)
- Regularly rotate your OAuth credentials

