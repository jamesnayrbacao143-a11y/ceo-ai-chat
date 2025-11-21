# Update Vercel Environment Variables

## DATABASE_URL para sa Vercel

Gamitin ang connection string na gumagana sa localhost:

```
postgresql://postgres.vyvanzdayhcqkygycnzs:12664365001@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres
```

## Steps para i-update sa Vercel:

1. **Pumunta sa Vercel Dashboard**
   - https://vercel.com/dashboard
   - Piliin ang project mo (harviongpt)

2. **Go to Settings → Environment Variables**

3. **Hanapin ang `DATABASE_URL`**
   - Kung wala, click "Add New"
   - Name: `DATABASE_URL`
   - Value: `postgresql://postgres.vyvanzdayhcqkygycnzs:12664365001@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres`
   - Environment: ✅ All (Production, Preview, Development)
   - Click "Save"

4. **I-verify ang iba pang environment variables:**
   - `GITHUB_TOKEN` - ✅ Set
   - `JWT_SECRET` - ✅ Set
   - `APP_URL` - `https://harviongpt.vercel.app`
   - `GOOGLE_CLIENT_ID` - ✅ Set
   - `GOOGLE_CLIENT_SECRET` - ✅ Set
   - `GOOGLE_REDIRECT_URI` - `https://harviongpt.vercel.app/api/auth/google/callback`

5. **Redeploy**
   - Go to Deployments
   - Click "..." sa latest deployment
   - Click "Redeploy"
   - O hintayin ang automatic deployment mula sa GitHub

## Important Notes:

- ✅ Ang connection string na ito ay gumagana sa localhost, kaya dapat gumana din sa Vercel
- ✅ Ito ay Session Pooler format (may `pooler.supabase.com` sa hostname)
- ✅ Port 5432 ay okay kung pooler hostname ang gamit
- ⚠️ After updating, i-redeploy ang application

## Test After Deployment:

1. Health check: `https://harviongpt.vercel.app/api/health`
2. Chat: Test sending a message
3. Google OAuth: Test login

