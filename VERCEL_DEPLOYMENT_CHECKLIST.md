# ✅ Vercel Deployment Checklist

## Pre-Deployment

- [x] Code is working on localhost
- [x] All fixes applied (path variable, lazy loading, timeouts)
- [ ] All changes committed and pushed to GitHub

## Step 1: Push Latest Code

```bash
git add .
git commit -m "Add documentation and fixes"
git push origin main
```

## Step 2: Environment Variables in Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

### Required Variables:

1. **GITHUB_TOKEN**
   - Value: Your GitHub Personal Access Token
   - Environment: ✅ All (Production, Preview, Development)

2. **JWT_SECRET**
   - Value: Random secret string (same as localhost)
   - Environment: ✅ All

3. **DATABASE_URL** ⚠️ IMPORTANT
   - Value: Supabase Session Pooler connection string
   - Format: `postgresql://postgres:password@db.xxxxx.supabase.co:6543/postgres?pgbouncer=true`
   - ⚠️ MUST use port 6543 (Session Pooler), NOT 5432 (Direct)
   - Environment: ✅ All

4. **APP_URL**
   - Value: `https://harviongpt.vercel.app` (or your Vercel domain)
   - Environment: ✅ All

5. **GOOGLE_CLIENT_ID**
   - Value: Your Google OAuth Client ID
   - Environment: ✅ All

6. **GOOGLE_CLIENT_SECRET**
   - Value: Your Google OAuth Client Secret
   - Environment: ✅ All

7. **GOOGLE_REDIRECT_URI** ⚠️ IMPORTANT
   - Value: `https://harviongpt.vercel.app/api/auth/google/callback`
   - ⚠️ Must match your Vercel domain exactly
   - Environment: ✅ All

### Optional Variables:

8. **BYTEZ_API_KEY** (if using image generation)
   - Value: Your Bytez API key
   - Environment: ✅ All

9. **CRON_SECRET** (for auto-cleanup cron job)
   - Value: Random secret string
   - Environment: ✅ All

10. **EMAIL_*** (if using email verification)
    - EMAIL_HOST
    - EMAIL_PORT
    - EMAIL_USER
    - EMAIL_PASSWORD
    - EMAIL_FROM

## Step 3: Update Google OAuth Redirect URI

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Credentials
3. Click your OAuth 2.0 Client ID
4. Under "Authorized redirect URIs", add:
   ```
   https://harviongpt.vercel.app/api/auth/google/callback
   ```
5. Save

## Step 4: Verify Database Connection

1. Make sure `DATABASE_URL` uses **Session Pooler** (port 6543)
2. Format should be: `postgresql://postgres:password@db.xxxxx.supabase.co:6543/postgres?pgbouncer=true`
3. NOT: `postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres` ❌

## Step 5: Deploy

1. Go to Vercel Dashboard
2. Your project should auto-deploy from GitHub
3. Or manually trigger: Deployments → "Redeploy"

## Step 6: Test After Deployment

1. **Health Check**: `https://harviongpt.vercel.app/api/health`
   - Should return: `{"status":"ok",...}`

2. **Chat Endpoint**: Test sending a message
   - Should work without errors

3. **Google OAuth**: Click "Continue with Google"
   - Should redirect to Google and back

## Common Issues

### Issue: "path is not defined"
- ✅ Fixed in latest code
- Make sure latest code is deployed

### Issue: Database connection timeout
- Check `DATABASE_URL` uses Session Pooler (port 6543)
- Not Direct connection (port 5432)

### Issue: Google OAuth "redirect_uri_mismatch"
- Verify `GOOGLE_REDIRECT_URI` in Vercel matches Google Cloud Console
- Must be exact: `https://harviongpt.vercel.app/api/auth/google/callback`

### Issue: Timeout errors
- ✅ Fixed with shorter timeouts
- Should work now

## Quick Deploy Command

```bash
# Make sure everything is committed
git add .
git commit -m "Ready for Vercel deployment"
git push origin main

# Vercel will auto-deploy from GitHub
```

## After Deployment

1. Test all endpoints
2. Check Vercel logs for any errors
3. Monitor for first few requests
4. Update Google OAuth redirect URI if domain changed

