const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;

function createTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  return transporter;
}

async function sendVerificationEmail(email, token, name) {
  try {
    const transporter = createTransporter();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const verificationLink = `${appUrl}/api/auth/verify?token=${token}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: 'Verify your HarvionGPT account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7c5dfa, #5a3ee8); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 30px; background: #7c5dfa; color: white !important; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .button:link, .button:visited, .button:hover, .button:active { color: white !important; text-decoration: none; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>HarvionGPT</h1>
            </div>
            <div class="content">
              <h2>Hello ${name || 'there'}!</h2>
              <p>Thank you for signing up for HarvionGPT. Please verify your email address by clicking the button below:</p>
              <a href="${verificationLink}" class="button" style="color: white !important; text-decoration: none;">Verify Email</a>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #7c5dfa;">${verificationLink}</p>
              <p>This link will expire in 24 hours.</p>
            </div>
            <div class="footer">
              <p>If you didn't create this account, please ignore this email.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    throw error;
  }
}

async function sendThankYouEmail(email, name, type = 'verification') {
  try {
    const transporter = createTransporter();
    
    const subject = type === 'verification' 
      ? 'Thank you for verifying your HarvionGPT account! 🚀'
      : 'Welcome to HarvionGPT! Thank you for joining us! 🎉';
    
    const title = type === 'verification'
      ? 'Email Verified Successfully!'
      : 'Welcome to HarvionGPT!';
    
    const message = type === 'verification'
      ? 'Your email has been successfully verified. You can now log in to your account and start using all the amazing features of HarvionGPT.'
      : 'Thank you for using HarvionGPT! We\'re excited to have you here. You can now start using all the amazing features of our AI-powered platform.';

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 0; }
            .header { background: linear-gradient(135deg, #7c5dfa 0%, #5a3ee8 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 32px; font-weight: 700; }
            .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 8px 8px; }
            .thank-you { text-align: center; margin: 30px 0; }
            .thank-you h2 { color: #7c5dfa; font-size: 28px; font-weight: 700; margin: 0 0 15px 0; }
            .thank-you p { color: #6b7280; font-size: 16px; margin: 10px 0; line-height: 1.8; }
            .features { background: #f9fafb; padding: 25px; border-radius: 8px; margin: 30px 0; }
            .features h3 { color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 15px 0; }
            .features ul { margin: 0; padding-left: 20px; color: #4b5563; }
            .features li { margin: 8px 0; line-height: 1.6; }
            .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #7c5dfa 0%, #5b4dc4 100%); color: white !important; text-decoration: none; border-radius: 10px; font-weight: 600; margin: 20px 0; box-shadow: 0 4px 12px rgba(124, 93, 250, 0.4); }
            .button:link, .button:visited, .button:hover, .button:active { color: white !important; }
            .button-container { text-align: center; margin: 30px 0; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
            .emoji { font-size: 48px; margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>HarvionGPT</h1>
            </div>
            <div class="content">
              <div class="thank-you">
                <div class="emoji">${type === 'verification' ? '✅' : '🎉'}</div>
                <h2>${title}</h2>
                <p style="color: #5a3ee8 !important; font-size: 18px; font-weight: 600; margin: 20px 0;">Thank you for using HarvionGPT!</p>
                <p>${message}</p>
              </div>
              
              <div class="features">
                <h3>What you can do with HarvionGPT:</h3>
                <ul>
                  <li>💬 Chat with advanced AI models (GPT-4.1, GPT-4o, and more)</li>
                  <li>🖼️ Upload and analyze images with AI vision</li>
                  <li>🎨 Generate stunning images with AI</li>
                  <li>📝 Get help with writing, coding, and more</li>
                  <li>💾 Save your chat history across devices</li>
                </ul>
              </div>
              
              <div class="button-container">
                <a href="${process.env.APP_URL || 'http://localhost:3000'}" class="button">Start Using HarvionGPT</a>
              </div>
              
              <div class="footer">
                <p>We're here to help! If you have any questions, feel free to reach out.</p>
                <p style="margin-top: 10px; font-size: 12px; color: #9ca3af;">© ${new Date().getFullYear()} HarvionGPT. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Thank you email sent to ${email} (${type})`);
    return true;
  } catch (error) {
    console.error('❌ Error sending thank you email:', error);
    throw error;
  }
}

module.exports = {
  sendVerificationEmail,
  sendThankYouEmail,
  createTransporter
};

