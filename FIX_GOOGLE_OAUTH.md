# Fix "Access blocked: This app's request is invalid"

## Common Causes and Solutions

### 1. OAuth Consent Screen Not Configured Properly

**Problem**: Google requires the OAuth consent screen to be configured before OAuth can work.

**Solution**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **OAuth consent screen**
4. Make sure it's configured:
   - **User Type**: Choose "External" (unless you have Google Workspace)
   - **App name**: Your app name (e.g., "HarvionGPT")
   - **User support email**: Your email
   - **Developer contact**: Your email
   - **Scopes**: Add `userinfo.email` and `userinfo.profile`
   - **Test users**: Add your email address if app is in "Testing" mode

### 2. App is in "Testing" Mode

**Problem**: If your app is in "Testing" mode, only test users can access it.

**Solution**:
- **Option A**: Add yourself as a test user
  1. Go to OAuth consent screen
  2. Scroll to "Test users"
  3. Click "Add users"
  4. Add your email address
  5. Save

- **Option B**: Publish the app (for production)
  1. Go to OAuth consent screen
  2. Click "Publish App"
  3. Confirm (Note: This makes it available to all users)

### 3. Redirect URI Mismatch

**Problem**: The redirect URI in your `.env` doesn't match what's in Google Cloud Console.

**Solution**:
1. Check your `.env` file:
   ```
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
   ```

2. Go to Google Cloud Console → **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under "Authorized redirect URIs", make sure you have:
   ```
   http://localhost:3000/api/auth/google/callback
   ```
5. **Important**: Must match EXACTLY (no trailing slash, correct port, http vs https)

### 4. Missing or Incorrect Scopes

**Problem**: The app is requesting scopes that aren't approved.

**Solution**:
1. Go to OAuth consent screen
2. Click "Edit App"
3. Under "Scopes", make sure you have:
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
4. Save

### 5. Client ID/Secret Not Set

**Problem**: Missing or incorrect credentials in `.env`.

**Solution**:
1. Check your `.env` file has:
   ```
   GOOGLE_CLIENT_ID=your_actual_client_id_here
   GOOGLE_CLIENT_SECRET=your_actual_client_secret_here
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
   ```

2. Make sure:
   - No extra spaces
   - No quotes around values
   - Values are correct (copy from Google Cloud Console)

3. Restart your server after updating `.env`

## Quick Checklist

- [ ] OAuth consent screen is configured
- [ ] You're added as a test user (if app is in Testing mode)
- [ ] Redirect URI matches exactly in both `.env` and Google Cloud Console
- [ ] Scopes are added in OAuth consent screen
- [ ] Client ID and Secret are correct in `.env`
- [ ] Server restarted after updating `.env`

## Step-by-Step Fix

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Select your project**
3. **Go to OAuth consent screen**:
   - APIs & Services → OAuth consent screen
   - Make sure it's configured
   - Add yourself as test user if in Testing mode
4. **Check Credentials**:
   - APIs & Services → Credentials
   - Click your OAuth 2.0 Client ID
   - Verify redirect URI: `http://localhost:3000/api/auth/google/callback`
5. **Update `.env` file** (if needed):
   ```
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
   ```
6. **Restart server**: `npm start`
7. **Try again**: Click "Continue with Google"

## Still Not Working?

Check the browser console for the exact error message. Common errors:
- `redirect_uri_mismatch` → Fix redirect URI
- `access_denied` → User cancelled (normal)
- `invalid_client` → Check Client ID/Secret
- `invalid_request` → Check OAuth consent screen configuration

