# Authentication & Upload Limit Setup Guide

## Overview
This application now includes:
- User authentication (signup/login with email)
- Email verification on signup
- Upload limit of 5 attachments per user
- MySQL database for user data

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Setup

#### Option A: Local MySQL
1. Install MySQL on your machine
2. Create a database:
```sql
CREATE DATABASE harviongpt;
```
3. Run the schema:
```bash
mysql -u root -p harviongpt < database/schema.sql
```

#### Option B: Cloud MySQL (Recommended for Vercel)
Use one of these services:
- **PlanetScale** (Recommended): https://planetscale.com
- **Railway**: https://railway.app
- **AWS RDS**: https://aws.amazon.com/rds
- **Google Cloud SQL**: https://cloud.google.com/sql

Get your connection string and add it to `.env` as `MYSQL_CONNECTION_STRING`

### 3. Email Configuration

#### For Gmail:
1. Enable 2-Step Verification on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password in your `.env` file

#### For Other Email Providers:
Update the SMTP settings in `.env`:
- `EMAIL_HOST`: Your SMTP server (e.g., smtp.gmail.com)
- `EMAIL_PORT`: Usually 587 for TLS
- `EMAIL_USER`: Your email address
- `EMAIL_PASSWORD`: Your email password or app password

### 4. Google OAuth Setup (Optional but Recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3000/api/auth/google/callback` (for local)
     - `https://yourdomain.com/api/auth/google/callback` (for production)
   - Copy the Client ID and Client Secret

### 5. Environment Variables

Create a `.env` file with:

```env
# Database (choose one)
# Option 1: Individual settings
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=harviongpt
MYSQL_PORT=3306

# Option 2: Connection string (for Vercel/Production)
MYSQL_CONNECTION_STRING=mysql://user:password@host:port/database

# JWT Secret (change this to a random string)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=noreply@harviongpt.com

# App URL (for email verification links)
APP_URL=http://localhost:3000
# For production: APP_URL=https://yourdomain.com

# Google OAuth (Optional - for Google login)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
# For production: GOOGLE_REDIRECT_URI=https://https://harviongpt.vercel.app/api/auth/google/callback
```

### 6. Start the Server
```bash
npm start
```

## Vercel Deployment

### 1. Database Setup
Use PlanetScale (recommended) or another MySQL-compatible service:
1. Create a database
2. Run the schema: `database/schema.sql`
3. Get your connection string

### 2. Environment Variables in Vercel
Add all environment variables in Vercel dashboard:
- Go to your project → Settings → Environment Variables
- Add all variables from `.env`

### 3. Google OAuth in Vercel
- Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to Vercel environment variables
- Update `GOOGLE_REDIRECT_URI` to your production URL

### 4. Deploy
```bash
vercel --prod
```

### 5. Update APP_URL
After deployment, update `APP_URL` in Vercel environment variables to your production URL.

## Features

### Authentication Flow
1. User clicks attach button
2. If not logged in → Auth modal appears
3. User has two options:
   - **Continue with Google**: One-click login, automatically verified
   - **Email/Password**: Traditional signup/login with email verification
4. After email signup → Verification email sent
5. User verifies email → Can log in
6. User can now upload attachments

### Google OAuth Benefits
- One-click login (no password needed)
- Automatically verified (Google already verifies emails)
- More secure (no password storage)
- Better user experience

### Upload Limit
- Each user can upload maximum 5 attachments
- Limit is tracked per user account
- When limit is reached, user sees error message
- Upload count resets when needed (manual database update)

## Troubleshooting

### Database Connection Issues
- Check your connection string format
- Verify database credentials
- Ensure database is accessible from your server

### Email Not Sending
- Check email credentials
- For Gmail: Use App Password, not regular password
- Check spam folder
- Verify SMTP settings

### Authentication Not Working
- Check JWT_SECRET is set
- Verify database connection
- Check browser console for errors

## Security Notes
- Change JWT_SECRET to a strong random string in production
- Use environment variables, never commit secrets
- Enable HTTPS in production
- Consider rate limiting for auth endpoints

