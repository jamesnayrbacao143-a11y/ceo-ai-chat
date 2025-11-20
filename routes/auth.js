const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { getPool } = require('../database/db');
const { sendVerificationEmail, sendThankYouEmail } = require('../utils/email');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const UPLOAD_LIMIT = 5; // Maximum uploads per user

// Google OAuth Client
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

let googleOAuthClient = null;
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  googleOAuthClient = new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

// Helper function to generate JWT token
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

// Signup endpoint
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const pool = getPool();

    // Check if user already exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date();
    verificationTokenExpires.setHours(verificationTokenExpires.getHours() + 24);

    // Create user
    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, name, verification_token, verification_token_expires) VALUES (?, ?, ?, ?, ?)',
      [email.toLowerCase(), passwordHash, name || null, verificationToken, verificationTokenExpires]
    );

    const userId = result.insertId;

    // Send verification email
    try {
      await sendVerificationEmail(email, verificationToken, name);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail signup if email fails, but log it
    }

    res.status(201).json({
      message: 'Account created successfully. Please check your email to verify your account.',
      userId
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const pool = getPool();

    // Find user
    const [users] = await pool.query(
      'SELECT id, email, password_hash, name, is_verified FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Check if email is verified
    if (!user.is_verified) {
      return res.status(401).json({ 
        error: 'Please verify your email before logging in. Check your inbox for the verification link.' 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user.id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify email endpoint
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const pool = getPool();

    // Find user by token
    const [users] = await pool.query(
      'SELECT id, verification_token_expires FROM users WHERE verification_token = ?',
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    const user = users[0];

    // Check if token expired
    if (new Date() > new Date(user.verification_token_expires)) {
      return res.status(400).json({ error: 'Verification token has expired' });
    }

    // Get user email and name before updating
    const [userInfo] = await pool.query(
      'SELECT email, name FROM users WHERE id = ?',
      [user.id]
    );
    const userEmail = userInfo[0].email;
    const userName = userInfo[0].name;

    // Verify user
    await pool.query(
      'UPDATE users SET is_verified = TRUE, verification_token = NULL, verification_token_expires = NULL WHERE id = ?',
      [user.id]
    );

    // Send thank you email after verification
    try {
      await sendThankYouEmail(userEmail, userName, 'verification');
    } catch (emailError) {
      console.error('Failed to send thank you email after verification:', emailError);
      // Don't fail verification if email fails
    }

    // Redirect to login page or show success
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Verified</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
          .container { background: white; padding: 50px 40px; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center; max-width: 450px; }
          .success { color: #10b981; font-size: 64px; margin-bottom: 24px; font-weight: bold; }
          h1 { color: #1f2937; margin-bottom: 16px; font-size: 28px; font-weight: 700; }
          .thank-you { color: #7c5dfa; font-size: 18px; font-weight: 600; margin-bottom: 12px; }
          p { color: #6b7280; margin-bottom: 20px; line-height: 1.6; font-size: 15px; }
          .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #7c5dfa 0%, #5b4dc4 100%); color: white; text-decoration: none; border-radius: 10px; font-weight: 600; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 12px rgba(124, 93, 250, 0.4); }
          .button:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(124, 93, 250, 0.5); }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✓</div>
          <h1>Email Verified Successfully!</h1>
          <p class="thank-you">Thank you for using HarvionGPT!</p>
          <p>Your email has been successfully verified. You can now log in to your account and start using all features.</p>
          <a href="/" class="button">Go to Login</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user info
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const pool = getPool();

      const [users] = await pool.query(
        'SELECT id, email, name, is_verified FROM users WHERE id = ?',
        [decoded.userId]
      );

      if (users.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      const user = users[0];

      // Get upload count from last 4 hours
      const [uploadCount] = await pool.query(
        'SELECT COUNT(*) as count FROM user_uploads WHERE user_id = ? AND uploaded_at >= DATE_SUB(NOW(), INTERVAL 4 HOUR)',
        [user.id]
      );

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isVerified: user.is_verified
        },
        uploadCount: uploadCount[0].count || 0,
        uploadLimit: UPLOAD_LIMIT
      });
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check upload limit
router.get('/upload-limit', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const pool = getPool();

      // Count uploads from last 4 hours only
      const [uploadCount] = await pool.query(
        'SELECT COUNT(*) as count FROM user_uploads WHERE user_id = ? AND uploaded_at >= DATE_SUB(NOW(), INTERVAL 4 HOUR)',
        [decoded.userId]
      );

      const count = uploadCount[0].count || 0;
      const remaining = Math.max(0, UPLOAD_LIMIT - count);

      res.json({
        count,
        limit: UPLOAD_LIMIT,
        remaining,
        canUpload: remaining > 0
      });
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Upload limit check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Record upload
router.post('/record-upload', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const { sessionId, fileName, fileSize } = req.body;

      const pool = getPool();

      // Check current upload count from last 4 hours only
      const [uploadCount] = await pool.query(
        'SELECT COUNT(*) as count FROM user_uploads WHERE user_id = ? AND uploaded_at >= DATE_SUB(NOW(), INTERVAL 4 HOUR)',
        [decoded.userId]
      );

      const count = uploadCount[0].count || 0;

      if (count >= UPLOAD_LIMIT) {
        return res.status(403).json({ 
          error: `Upload limit reached. You have reached the maximum of ${UPLOAD_LIMIT} uploads. Please try again after 4 hours.` 
        });
      }

      // Record upload
      await pool.query(
        'INSERT INTO user_uploads (user_id, session_id, file_name, file_size) VALUES (?, ?, ?, ?)',
        [decoded.userId, sessionId || null, fileName || 'attachment', fileSize || 0]
      );

      res.json({ 
        message: 'Upload recorded',
        count: count + 1,
        remaining: UPLOAD_LIMIT - count - 1
      });
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Record upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save chat history
router.post('/chat-history', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const { chats } = req.body;

      if (!Array.isArray(chats)) {
        return res.status(400).json({ error: 'Invalid chat data format' });
      }

      const pool = getPool();

      // Delete existing chat history for this user
      await pool.query('DELETE FROM chat_messages WHERE user_id = ?', [decoded.userId]);
      await pool.query('DELETE FROM user_sessions WHERE user_id = ?', [decoded.userId]);

      // Save each chat session
      for (const chat of chats) {
        if (!chat.sessionId || !chat.messages || !Array.isArray(chat.messages)) {
          continue;
        }

        // Save session
        await pool.query(
          'INSERT INTO user_sessions (user_id, session_id, topic) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE topic = ?, updated_at = CURRENT_TIMESTAMP',
          [decoded.userId, chat.sessionId, chat.topic || 'New Chat', chat.topic || 'New Chat']
        );

        // Save messages
        for (const message of chat.messages) {
          if (!message.role || !message.content) {
            continue;
          }

          const attachmentsJson = message.attachments ? JSON.stringify(message.attachments) : null;

          await pool.query(
            'INSERT INTO chat_messages (user_id, session_id, role, content, attachments) VALUES (?, ?, ?, ?, ?)',
            [decoded.userId, chat.sessionId, message.role, message.content, attachmentsJson]
          );
        }
      }

      res.json({ message: 'Chat history saved successfully' });
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Save chat history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Load chat history
router.get('/chat-history', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const pool = getPool();

      // Get all sessions for this user
      const [sessions] = await pool.query(
        'SELECT session_id, topic, created_at, updated_at FROM user_sessions WHERE user_id = ? ORDER BY updated_at DESC',
        [decoded.userId]
      );

      // Get all messages for this user
      const [messages] = await pool.query(
        'SELECT session_id, role, content, attachments, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC',
        [decoded.userId]
      );

      // Group messages by session
      const chatsMap = {};
      
      for (const session of sessions) {
        chatsMap[session.session_id] = {
          sessionId: session.session_id,
          topic: session.topic || 'New Chat',
          messages: [],
          createdAt: session.created_at,
          updatedAt: session.updated_at
        };
      }

      // Add messages to their sessions
      for (const message of messages) {
        if (chatsMap[message.session_id]) {
          const messageObj = {
            role: message.role,
            content: message.content
          };

          if (message.attachments) {
            try {
              messageObj.attachments = JSON.parse(message.attachments);
            } catch (e) {
              // Invalid JSON, skip attachments
            }
          }

          chatsMap[message.session_id].messages.push(messageObj);
        }
      }

      // Convert to array
      const chats = Object.values(chatsMap);

      res.json({ chats });
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Load chat history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google OAuth - Initiate login
router.get('/google', async (req, res) => {
  if (!googleOAuthClient) {
    console.error('Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file');
    const frontendUrl = process.env.APP_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/?error=google_oauth_not_configured`);
  }

  try {
    const authUrl = googleOAuthClient.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ],
      prompt: 'consent'
    });

    res.redirect(authUrl);
  } catch (error) {
    console.error('Google OAuth redirect error:', error);
    const frontendUrl = process.env.APP_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/?error=google_auth_failed`);
  }
});

// Google OAuth - Callback
router.get('/google/callback', async (req, res) => {
  try {
    if (!googleOAuthClient) {
      console.error('Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file');
      const frontendUrl = process.env.APP_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/?error=google_oauth_not_configured`);
    }

    const { code, error: googleError } = req.query;
    
    if (googleError) {
      console.error('Google OAuth error:', googleError);
      const frontendUrl = process.env.APP_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/?error=google_auth_failed&details=${encodeURIComponent(googleError)}`);
    }
    
    if (!code) {
      console.error('No authorization code received from Google');
      const frontendUrl = process.env.APP_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/?error=google_auth_failed&details=no_code`);
    }

    // Exchange code for tokens
    const { tokens } = await googleOAuthClient.getToken(code);
    googleOAuthClient.setCredentials(tokens);

    // Get user info from Google
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const googleEmail = payload.email;
    const googleName = payload.name;
    const googlePicture = payload.picture;

    if (!googleEmail) {
      return res.redirect('/?error=no_email_from_google');
    }

    const pool = getPool();

    // Check if user exists
    const [existingUsers] = await pool.query(
      'SELECT id, email, name, is_verified FROM users WHERE email = ?',
      [googleEmail.toLowerCase()]
    );

    let userId;
    let user;

    if (existingUsers.length > 0) {
      // User exists - update if needed and auto-verify
      user = existingUsers[0];
      userId = user.id;

      // Auto-verify Google users (Google already verifies emails)
      if (!user.is_verified) {
        await pool.query(
          'UPDATE users SET is_verified = TRUE, name = COALESCE(?, name) WHERE id = ?',
          [googleName, userId]
        );
      }
    } else {
      // Create new user - auto-verified since Google verifies emails
      const [result] = await pool.query(
        'INSERT INTO users (email, password_hash, name, is_verified) VALUES (?, ?, ?, TRUE)',
        [googleEmail.toLowerCase(), crypto.randomBytes(32).toString('hex'), googleName]
      );
      userId = result.insertId;
    }

    // Get updated user info
    const [users] = await pool.query(
      'SELECT id, email, name, is_verified FROM users WHERE id = ?',
      [userId]
    );
    user = users[0];

    // Send thank you email after Google login (only for new users)
    try {
      const isNewUser = existingUsers.length === 0;
      if (isNewUser) {
        // Send welcome email for new Google users
        await sendThankYouEmail(user.email, user.name || googleName, 'google');
      }
    } catch (emailError) {
      console.error('Failed to send thank you email after Google login:', emailError);
      // Don't fail login if email fails
    }

    // Generate JWT token
    const token = generateToken(userId);

    // Redirect to frontend with token
    const frontendUrl = process.env.APP_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/?google_auth_success=true&token=${token}&email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name || '')}`);
  } catch (error) {
    console.error('Google OAuth error:', error);
    const frontendUrl = process.env.APP_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/?error=google_auth_failed`);
  }
});

module.exports = router;

