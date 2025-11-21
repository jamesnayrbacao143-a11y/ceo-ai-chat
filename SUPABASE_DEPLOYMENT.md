# 🚀 Supabase + Vercel Deployment Guide

Complete step-by-step guide para sa deployment ng HarvionGPT gamit ang Supabase (PostgreSQL) at Vercel, kasama ang auto-delete feature.

---

## 📋 Prerequisites

- ✅ GitHub account
- ✅ Vercel account
- ✅ Supabase account (free)
- ✅ Email account (para sa verification)

---

## STEP 1: Supabase Database Setup

### 1.1 Create Supabase Account

1. Pumunta sa https://supabase.com
2. Click "Start your project" o "Sign up"
3. Sign up with GitHub (recommended)
4. Complete registration

### 1.2 Create New Project

1. Sa dashboard, click "New Project"
2. **Organization:** Piliin ang organization mo (o create new)
3. **Project Name:** `harviongpt` (o kahit anong name)
4. **Database Password:** 
   - Gumawa ng strong password
   - ⚠️ **IMPORTANTE:** I-save ito! Hindi mo na ito makikita ulit
   - Recommended: Gumamit ng password manager
5. **Region:** Piliin ang pinakamalapit sa iyo
6. **Pricing Plan:** Free (Hobby)
7. Click "Create new project"
8. Hintayin matapos ang setup (2-3 minutes)

### 1.3 Get Connection String

⚠️ **IMPORTANTE PARA SA VERCEL:** Gamitin ang **Session Pooler**, hindi Direct connection!

1. Sa project dashboard, pumunta sa **"Settings"** → **"Database"**
2. Scroll down sa **"Connection string"** section
3. **Piliin ang "Session Pooler" tab** (hindi "Direct connection")
   - Session Pooler: Para sa serverless functions (Vercel, AWS Lambda, etc.)
   - Direct connection: Para sa long-lived connections (VMs, containers)
4. Piliin ang **"URI"** format
5. I-copy ang connection string

**May dalawang format ng Session Pooler:**
- **Format 1 (Port 6543):** `postgresql://postgres:password@db.xxxxx.supabase.co:6543/postgres?pgbouncer=true`
- **Format 2 (Port 5432 with pooler hostname):** `postgresql://postgres.xxxxx:password@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres`

**Pareho silang gumagana!** Gamitin kung alin ang available sa iyo.

**Example connection string:**
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:6543/postgres?pgbouncer=true
   ```
   ⚠️ **TANDAAN:** Port **6543** (Session Pooler), hindi 5432 (Direct connection)
6. ⚠️ **IMPORTANTE:** I-replace ang `[YOUR-PASSWORD]` sa actual password mo
7. Final connection string:
   ```
   postgresql://postgres:your_actual_password@db.xxxxx.supabase.co:6543/postgres?pgbouncer=true
   ```
8. I-save ito para sa Step 4

**Bakit Session Pooler?**
- ✅ Compatible sa IPv4 networks (Vercel uses IPv4)
- ✅ Optimized para sa serverless functions (short-lived connections)
- ✅ Mas mabilis connection establishment
- ✅ Mas efficient para sa Vercel serverless functions

### 1.4 Run Database Schema

1. Sa Supabase dashboard, pumunta sa **"SQL Editor"** (left sidebar)
2. Click **"New query"**
3. Buksan ang file: `database/schema-pg.sql`
4. I-copy ang **lahat** ng contents
5. I-paste sa SQL Editor
6. Click **"Run"** (o press Ctrl+Enter)
7. Dapat makita mo ang success message
8. Verify: Pumunta sa **"Table Editor"** → Dapat makita mo ang tables:
   - `users`
   - `user_uploads`
   - `user_sessions`
   - `chat_messages`

---

## STEP 2: GitHub Setup

### 2.1 Create GitHub Personal Access Token

1. Pumunta sa https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. **Token name:** `HarvionGPT Deployment`
4. **Expiration:** Piliin (recommended: 90 days o No expiration)
5. **Scopes:** Check `repo` (full control)
6. Click **"Generate token"**
7. ⚠️ **IMPORTANTE:** I-copy agad ang token (hindi mo na ito makikita ulit)

### 2.2 Upload Code sa GitHub

**Open PowerShell sa project folder:**
```powershell
cd C:\Users\Dell\Documents\AI
```

**Initialize Git (kung hindi pa):**
```bash
git init
```

**Add all files:**
```bash
git add .
```

**Create commit:**
```bash
git commit -m "Convert to Supabase PostgreSQL with auto-cleanup"
```

**Create GitHub Repository:**
1. Pumunta sa https://github.com
2. Click **"+"** (top right) → **"New repository"**
3. **Repository name:** `harviongpt` (o kahit anong name)
4. **Description: "HarvionGPT - AI Chat Application with Supabase"
5. Choose **Public** o **Private**
6. ⚠️ **HUWAG** i-check ang "Add README" (meron na tayo)
7. Click **"Create repository"**

**Connect at Push:**
```bash
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/harviongpt.git

# Rename branch to main
git branch -M main

# Push to GitHub
git push -u origin main
```

**Kapag nag-prompt ng credentials:**
- **Username:** Your GitHub username
- **Password:** I-paste ang Personal Access Token (hindi ang password)

---

## STEP 3: Vercel Deployment

### 3.1 Create Vercel Account

1. Pumunta sa https://vercel.com
2. Click **"Sign Up"**
3. Piliin **"Continue with GitHub"**
4. Authorize Vercel

### 3.2 Import Project

1. Sa Vercel dashboard, click **"Add New..."** → **"Project"**
2. Hanapin ang `harviongpt` repository
3. Click **"Import"** sa tabi ng repository

### 3.3 Configure Project Settings

- **Framework Preset:** Other
- **Root Directory:** `./` (default)
- **Build Command:** (iwanan blank)
- **Output Directory:** (iwanan blank)
- **Install Command:** `npm install`

### 3.4 Add Environment Variables

**Bago mag-deploy, i-add ang environment variables:**

Click **"Environment Variables"** at i-add ang mga sumusunod:

#### Required Variables:

1. **DATABASE_URL** (o **POSTGRES_CONNECTION_STRING**)
   - Name: `DATABASE_URL`
   - Value: (i-paste ang Supabase **Session Pooler** connection string mula sa Step 1.3)
   - Format: `postgresql://postgres:password@db.xxxxx.supabase.co:6543/postgres?pgbouncer=true`
   - ⚠️ **IMPORTANTE:** Gamitin ang Session Pooler (port 6543), hindi Direct connection (port 5432)
   - Environment: ✅ Production, ✅ Preview, ✅ Development

2. **JWT_SECRET**
   - Name: `JWT_SECRET`
   - Value: (gumawa ng random string, halimbawa: `my_super_secret_jwt_key_2024_harviongpt`)
   - Environment: ✅ All

3. **APP_URL**
   - Name: `APP_URL`
   - Value: `https://harviongpt.vercel.app` (o kung ano ang Vercel URL mo)
   - Environment: ✅ All
   - ⚠️ Note: I-update ito pagkatapos ng deployment sa actual URL
4db1d0a6ebfd32740764b13b4a772e2ddc3cc4343881a0a062dbbb1f72c31f91
4. **CRON_SECRET** (para sa auto-cleanup security)
   - Name: `CRON_SECRET`
   - Value: (gumawa ng random string, halimbawa: `my_cron_secret_key_2024`)
   - Environment: ✅ All

#### Optional pero Recommended:

5. **GITHUB_TOKEN**
   - Name: `GITHUB_TOKEN`
   - Value: (GitHub Personal Access Token mula sa Step 2.1)
   - Environment: ✅ All

6. **GITHUB_MODEL**
   - Name: `GITHUB_MODEL`
   - Value: `openai/gpt-4o`
   - Environment: ✅ All

7. **GITHUB_MODELS** (para sa Auto mode)
   - Name: `GITHUB_MODELS`
   - Value: `openai/gpt-4.1-bytez,openai/gpt-4.1,openai/gpt-4.1-mini,openai/gpt-4o,openai/gpt-4o-mini`
   - Environment: ✅ All

8. **BYTEZ_API_KEY** (kung may Bytez account)
   - Name: `BYTEZ_API_KEY`
   - Value: (your Bytez API key)
   - Environment: ✅ All

#### Email Configuration (para sa verification):

9. **EMAIL_HOST**
   - Name: `EMAIL_HOST`
   - Value: `smtp.gmail.com` (o kung ano ang email provider mo)
   - Environment: ✅ All

10. **EMAIL_PORT**
    - Name: `EMAIL_PORT`
    - Value: `587`
    - Environment: ✅ All

11. **EMAIL_USER**
    - Name: `EMAIL_USER`
    - Value: (your email address, halimbawa: `yourname@gmail.com`)
    - Environment: ✅ All

12. **EMAIL_PASSWORD**
    - Name: `EMAIL_PASSWORD`
    - Value: (Gmail App Password - hindi regular password)
    - Environment: ✅ All
    - ⚠️ Para sa Gmail: Gumawa ng App Password sa https://myaccount.google.com/apppasswords

13. **EMAIL_FROM**
    - Name: `EMAIL_FROM`
    - Value: `noreply@harviongpt.com` (o your email)
    - Environment: ✅ All

#### Google OAuth (Optional):

14. **GOOGLE_CLIENT_ID**
    - Name: `GOOGLE_CLIENT_ID`
    - Value: (mula sa Google Cloud Console)
    - Environment: ✅ All

15. **GOOGLE_CLIENT_SECRET**
    - Name: `GOOGLE_CLIENT_SECRET`
    - Value: (mula sa Google Cloud Console)
    - Environment: ✅ All

16. **GOOGLE_REDIRECT_URI**
    - Name: `GOOGLE_REDIRECT_URI`
    - Value: `https://harviongpt.vercel.app/api/auth/google/callback`
    - Environment: ✅ All
    - ⚠️ I-update ito pagkatapos ng deployment sa actual URL

**After adding each variable, click "Save"**

### 3.5 Deploy

1. Click **"Deploy"** button
2. Hintayin matapos ang build (1-2 minutes)
3. Makikita mo ang build logs in real-time

### 3.6 Get Your Live URL

Pagkatapos ng successful deployment:
- Makikita mo ang URL, halimbawa: `https://harviongpt-abc123.vercel.app`
- I-copy ang URL na ito

---

## STEP 4: Update Environment Variables (After Deployment)

### 4.1 Update APP_URL

1. Sa Vercel dashboard, pumunta sa **"Settings"** → **"Environment Variables"**
2. Hanapin ang `APP_URL`
3. I-edit at i-update sa actual Vercel URL mo
4. Click **"Save"**

### 4.2 Update GOOGLE_REDIRECT_URI (kung may Google OAuth)

1. Hanapin ang `GOOGLE_REDIRECT_URI`
2. I-update sa: `https://your-actual-url.vercel.app/api/auth/google/callback`
3. Click **"Save"**

### 4.3 Redeploy

1. Pumunta sa **"Deployments"** tab
2. Click **"..."** sa latest deployment
3. Click **"Redeploy"**
4. Hintayin matapos

---

## STEP 5: Verify Auto-Cleanup Setup

### 5.1 Check Cron Job Configuration

1. Sa Vercel dashboard, pumunta sa **"Settings"** → **"Cron Jobs"**
2. Dapat makita mo ang:
   - **Path:** `/api/cron/cleanup`
   - **Schedule:** `0 2 * * *` (Every day at 2:00 AM UTC)

### 5.2 Test Cleanup Manually (Optional)

Pwede mong i-test ang cleanup endpoint manually:

```bash
# Replace YOUR_VERCEL_URL and YOUR_CRON_SECRET
curl -X GET https://YOUR_VERCEL_URL/api/cron/cleanup \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

O sa browser (kung naka-set ang CRON_SECRET):
```
https://your-app.vercel.app/api/cron/cleanup
```

### 5.3 Monitor Cleanup

Ang cleanup ay automatic na mag-run:
- **Schedule:** Every day at 2:00 AM UTC
- **Deletes:**
  - Chat messages older than 30 days
  - User uploads older than 7 days
  - User sessions older than 90 days
  - Unverified users older than 7 days

---

## STEP 6: Testing

### 6.1 Test Basic Functionality

1. Buksan ang Vercel URL
2. Subukan mag-send ng message
3. Dapat gumagana ang chat

### 6.2 Test Authentication

1. Click "Attach" button
2. Dapat lumabas ang login modal
3. Subukan mag-signup/login
4. Check email para sa verification (kung email signup)

### 6.3 Test Upload Limit

1. Mag-login
2. Subukan mag-upload ng 5 images
3. Dapat mag-show ang error pagkatapos ng 5 uploads

### 6.4 Test Database Connection

1. Sa Supabase dashboard, pumunta sa **"Table Editor"**
2. Dapat makita mo ang data na na-save
3. Check kung nagwo-work ang queries

---

## 🔧 Troubleshooting

### Build Failed sa Vercel

- Check build logs sa Vercel dashboard
- Verify lahat ng environment variables ay naka-set
- Check kung may missing dependencies
- Verify `DATABASE_URL` ay correct format

### Database Connection Error

- Verify ang `DATABASE_URL` ay tama
- Check kung naka-replace ang `[YOUR-PASSWORD]` sa actual password
- Verify Supabase project ay active
- Check Supabase dashboard → Settings → Database → Connection string

### Cron Job Not Running

- Check Vercel dashboard → Settings → Cron Jobs
- Verify `CRON_SECRET` ay naka-set
- Check Vercel function logs
- Verify cron schedule format

### Auto-Cleanup Not Working

- Check Vercel function logs
- Verify `DATABASE_URL` ay accessible
- Test cleanup endpoint manually
- Check Supabase logs

---

## 📝 Important Notes

### Database Connection String Format

**Correct:**
```
postgresql://postgres:your_password@db.xxxxx.supabase.co:5432/postgres
```

**Wrong:**
```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

### Auto-Cleanup Schedule

- **Current:** Every day at 2:00 AM UTC
- **To change:** I-update ang `vercel.json` → `crons` → `schedule`
- **Format:** Cron expression (e.g., `"0 2 * * *"` = daily at 2 AM)

### Supabase Free Tier Limits

- **Database:** 500MB storage
- **API requests:** Unlimited
- **Bandwidth:** 2GB/month
- **File storage:** 1GB

### Data Retention

- **Chat messages:** 30 days
- **User uploads:** 7 days
- **User sessions:** 90 days
- **Unverified users:** 7 days

---

## ✅ Checklist Summary

- [ ] Supabase account created
- [ ] Supabase project created
- [ ] Database schema run successfully
- [ ] Connection string copied
- [ ] GitHub repository created
- [ ] Code pushed sa GitHub
- [ ] Vercel account created
- [ ] Project imported sa Vercel
- [ ] All environment variables added
- [ ] DATABASE_URL configured
- [ ] CRON_SECRET set
- [ ] Deployment successful
- [ ] APP_URL updated
- [ ] GOOGLE_REDIRECT_URI updated (if using OAuth)
- [ ] Cron job verified
- [ ] Testing completed

---

## 🚀 Future Updates

Kapag may changes sa code:

```bash
# Navigate to project folder
cd C:\Users\Dell\Documents\AI

# Add changes
git add .

# Commit
git commit -m "Description of changes"

# Push to GitHub
git push

# Vercel will automatically redeploy! 🎉
```

---

## 📞 Quick Reference

**Important URLs:**
- Supabase: https://supabase.com
- Vercel: https://vercel.com
- GitHub: https://github.com
- Supabase Dashboard: https://app.supabase.com

**Important Files:**
- `database/schema-pg.sql` - PostgreSQL schema ✅
- `database/db.js` - PostgreSQL connection ✅
- `utils/cleanup.js` - Auto-cleanup function ✅
- `api/cron-cleanup.js` - Vercel cron endpoint ✅
- `vercel.json` - Vercel configuration ✅

---

**Good luck with your deployment! 🚀**

