# 🚀 Deployment Instructions - GitHub & Vercel

## Prerequisites

### 1. Install Git (if not installed)

**Download Git for Windows:**
- Visit: https://git-scm.com/download/win
- Download the installer
- Run the installer (accept all defaults)
- **Important:** Make sure "Git from the command line and also from 3rd-party software" is selected
- Restart your terminal/PowerShell after installation

**Verify Installation:**
```bash
git --version
```

---

## Step 1: Upload to GitHub

### 1.1 Open PowerShell/Terminal in Project Folder

Navigate to your project folder:
```bash
cd C:\Users\Dell\Documents\AI
```

### 1.2 Initialize Git Repository

```bash
git init
```

### 1.3 Add All Files

```bash
git add .
```

### 1.4 Create Initial Commit

```bash
git commit -m "Initial commit: CEO AI Chat Application with Dark Mode"
```

### 1.5 Create GitHub Repository

1. **Go to GitHub:**
   - Visit https://github.com
   - Sign in (or create account if you don't have one)

2. **Create New Repository:**
   - Click the "+" icon (top right) → "New repository"
   - Repository name: `ceo-ai-chat` (or any name you prefer)
   - Description: "CEO AI Chat Application - Modern ChatGPT-like interface with Dark Mode"
   - Choose **Public** or **Private**
   - **DO NOT** check "Add a README file" (we already have one)
   - **DO NOT** check "Add .gitignore" (we already have one)
   - Click **"Create repository"**

### 1.6 Connect Local Repository to GitHub

After creating the repository, GitHub will show you commands. Use these (replace `YOUR_USERNAME` with your GitHub username):

```bash
# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/ceo-ai-chat.git

# Rename branch to main
git branch -M main

# Push to GitHub
git push -u origin main
```

**If asked for credentials:**
- **Username:** Your GitHub username
- **Password:** Use a **Personal Access Token** (NOT your GitHub password)
  - Create token: https://github.com/settings/tokens
  - Click "Generate new token" → "Generate new token (classic)"
  - Name: `Git Push Token`
  - Expiration: Choose your preference
  - Scopes: Check `repo` (full control of private repositories)
  - Click "Generate token"
  - **Copy the token immediately** (you won't see it again!)
  - Use this token as your password

---

## Step 2: Deploy to Vercel

### 2.1 Go to Vercel

1. Visit https://vercel.com
2. Click **"Sign Up"** or **"Log In"**
3. **Sign in with GitHub** (recommended - easier to connect repositories)

### 2.2 Import Your GitHub Repository

1. After logging in, click **"Add New..."** → **"Project"**
2. You should see your `ceo-ai-chat` repository
3. Click **"Import"** next to your repository

### 2.3 Configure Project Settings

**Framework Preset:** Select **"Other"**

**Root Directory:** Leave as `./` (default)

**Build Command:** Leave empty (or `npm install`)

**Output Directory:** Leave empty

**Install Command:** `npm install`

### 2.4 Add Environment Variables

**IMPORTANT:** Before deploying, add your environment variables:

1. Click **"Environment Variables"** section
2. Add these variables one by one:

   **Variable 1:**
   - Name: `GITHUB_TOKEN`
   - Value: `your_github_pat_token_here` (paste your GitHub token)
   - Environment: Select all (Production, Preview, Development)

   **Variable 2 (Optional):**
   - Name: `GITHUB_MODEL`
   - Value: `openai/gpt-4o`
   - Environment: Select all

   **Variable 3 (Optional - for Auto mode):**
   - Name: `GITHUB_MODELS`
   - Value: `openai/gpt-4o,openai/gpt-4o-mini`
   - Environment: Select all

3. Click **"Save"** after adding each variable

### 2.5 Deploy

1. Click **"Deploy"** button
2. Wait for deployment (usually 1-2 minutes)
3. You'll see build logs in real-time

### 2.6 Get Your Live URL

After successful deployment:
- Vercel will provide you with a URL like: `https://ceo-ai-chat.vercel.app`
- Click the URL to visit your live site!
- You can also add a custom domain later in Settings → Domains

---

## Step 3: Update Environment Variables (After Deployment)

If you need to add/update environment variables later:

1. Go to your project on Vercel dashboard
2. Click **"Settings"** → **"Environment Variables"**
3. Add or edit variables
4. Click **"Save"**
5. Go to **"Deployments"** tab
6. Click **"..."** on the latest deployment
7. Click **"Redeploy"**

---

## Step 4: Future Updates

When you make changes to your code:

```bash
# Navigate to project folder
cd C:\Users\Dell\Documents\AI

# Add changed files
git add .

# Commit changes
git commit -m "Your update description"

# Push to GitHub
git push

# Vercel will automatically redeploy (if connected via GitHub)
```

**Note:** Vercel automatically detects pushes to your GitHub repository and redeploys automatically!

---

## Troubleshooting

### Git Not Found Error

**Solution:** Install Git from https://git-scm.com/download/win and restart your terminal.

### Authentication Failed (GitHub)

**Solution:** Use a Personal Access Token instead of password:
- Create token: https://github.com/settings/tokens
- Use token as password when pushing

### Build Failed on Vercel

**Check:**
1. Environment variables are set correctly
2. All dependencies are in `package.json`
3. Check build logs in Vercel dashboard

### API Not Working After Deployment

**Check:**
1. `GITHUB_TOKEN` is set in Vercel environment variables
2. Token is valid and not expired
3. Check Vercel function logs for errors

### 404 Errors

**Check:**
1. `vercel.json` file exists and is correct
2. Routes are configured properly
3. Public files are in `/public` folder

---

## Quick Reference

### GitHub Commands
```bash
git init                          # Initialize repository
git add .                          # Add all files
git commit -m "message"            # Commit changes
git remote add origin <url>        # Add GitHub remote
git push -u origin main           # Push to GitHub
```

### Vercel Deployment
- Sign in with GitHub at https://vercel.com
- Import repository
- Add environment variables
- Deploy!

---

## Useful Links

- **GitHub:** https://github.com
- **Vercel:** https://vercel.com
- **GitHub PAT Creation:** https://github.com/settings/tokens
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Vercel Docs:** https://vercel.com/docs

---

## Notes

✅ **Free Tier Includes:**
- Unlimited deployments
- 100GB bandwidth/month
- Serverless functions
- Perfect for personal projects

✅ **Security:**
- Never commit `.env` file (already in `.gitignore`)
- Always use Vercel environment variables for production
- Keep your GitHub token secure

✅ **Auto Deploy:**
- Vercel automatically deploys when you push to GitHub
- No manual deployment needed after initial setup

---

**Good luck with your deployment! 🚀**

