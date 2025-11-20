# Deployment Guide - GitHub & Vercel

## Step 1: Upload to GitHub

### 1.1 Initialize Git Repository (if not already done)

```bash
git init
```

### 1.2 Add All Files

```bash
git add .
```

### 1.3 Create Initial Commit

```bash
git commit -m "Initial commit: CEO AI Chat Application"
```

### 1.4 Create GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Repository name: `ceo-ai-chat` (or any name you prefer)
5. Description: "CEO AI Chat Application - Modern ChatGPT-like interface"
6. Choose Public or Private
7. **DO NOT** initialize with README, .gitignore, or license (we already have these)
8. Click "Create repository"

### 1.5 Connect and Push to GitHub

After creating the repository, GitHub will show you commands. Use these:

```bash
# Add remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/ceo-ai-chat.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

**Note:** If you're asked for credentials:
- Username: Your GitHub username
- Password: Use a Personal Access Token (not your GitHub password)
  - Create token: https://github.com/settings/tokens
  - Select scopes: `repo` (full control of private repositories)

---

## Step 2: Deploy to Vercel

### 2.1 Install Vercel CLI (Optional - for command line deployment)

```bash
npm install -g vercel
```

### 2.2 Deploy via Vercel Website (Recommended)

1. **Go to Vercel:**
   - Visit https://vercel.com
   - Sign up/Login with your GitHub account

2. **Import Project:**
   - Click "Add New..." → "Project"
   - Select your GitHub repository (`ceo-ai-chat`)
   - Click "Import"

3. **Configure Project:**
   - **Framework Preset:** Other
   - **Root Directory:** `./` (leave as default)
   - **Build Command:** Leave empty (or `npm install`)
   - **Output Directory:** Leave empty
   - **Install Command:** `npm install`

4. **Environment Variables:**
   - Click "Environment Variables"
   - Add the following variables:
     ```
     GITHUB_TOKEN = your_github_pat_token_here
     GITHUB_MODEL = openai/gpt-4o
     ```
   - Or if using multiple models:
     ```
     GITHUB_MODELS = openai/gpt-4o,openai/gpt-4o-mini
     ```

5. **Deploy:**
   - Click "Deploy"
   - Wait for deployment to complete (usually 1-2 minutes)

6. **Get Your Live URL:**
   - After deployment, Vercel will provide you with a URL like:
     `https://ceo-ai-chat.vercel.app`
   - You can also add a custom domain later

### 2.3 Deploy via Vercel CLI (Alternative)

If you prefer command line:

```bash
# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# For production deployment
vercel --prod
```

When prompted:
- Set up and deploy? **Yes**
- Which scope? Select your account
- Link to existing project? **No** (first time)
- Project name? `ceo-ai-chat` (or your preferred name)
- Directory? `./` (current directory)
- Override settings? **No**

Then add environment variables:
```bash
vercel env add GITHUB_TOKEN
# Paste your token when prompted

vercel env add GITHUB_MODEL
# Enter: openai/gpt-4o
```

---

## Step 3: Update Environment Variables in Vercel

After deployment, you can update environment variables:

1. Go to your project on Vercel dashboard
2. Click "Settings" → "Environment Variables"
3. Add or edit variables:
   - `GITHUB_TOKEN` - Your GitHub Personal Access Token
   - `GITHUB_MODEL` - Default model (optional)
   - `GITHUB_MODELS` - Comma-separated models for Auto mode (optional)
4. Click "Save"
5. Redeploy: Go to "Deployments" → Click "..." on latest deployment → "Redeploy"

---

## Step 4: Custom Domain (Optional)

1. In Vercel dashboard, go to "Settings" → "Domains"
2. Add your custom domain
3. Follow DNS configuration instructions
4. Wait for DNS propagation (usually 5-30 minutes)

---

## Troubleshooting

### Build Fails on Vercel

- **Check logs:** Go to deployment → "View Function Logs"
- **Common issues:**
  - Missing environment variables
  - Node.js version mismatch (Vercel uses Node 18 by default)
  - Missing dependencies in package.json

### API Not Working After Deployment

- **Check environment variables:** Make sure `GITHUB_TOKEN` is set in Vercel
- **Check CORS:** Vercel handles CORS automatically
- **Check API routes:** Make sure routes start with `/api/`

### 404 Errors

- **Check vercel.json:** Make sure routing is configured correctly
- **Check file paths:** All public files should be in `/public` folder

---

## Updating Your Deployment

After making changes to your code:

```bash
# Commit changes
git add .
git commit -m "Your update message"

# Push to GitHub
git push

# Vercel will automatically redeploy (if connected via GitHub)
# Or manually redeploy via Vercel dashboard or CLI
```

---

## Useful Links

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Vercel Docs:** https://vercel.com/docs
- **GitHub:** https://github.com
- **GitHub PAT Creation:** https://github.com/settings/tokens

---

## Notes

- **Free Tier:** Vercel free tier includes:
  - Unlimited deployments
  - 100GB bandwidth/month
  - Serverless functions with execution limits
  - Perfect for personal projects

- **Environment Variables:** Never commit `.env` file to GitHub. Always use Vercel's environment variables for production.

- **Auto Deploy:** Vercel automatically deploys when you push to GitHub (if connected).

