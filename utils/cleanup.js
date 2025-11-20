const { getPool } = require('../database/db');

/**
 * Cleanup old data from database
 * Deletes:
 * - Chat messages older than 30 days
 * - User uploads older than 7 days (since limit resets every 4 hours)
 * - User sessions older than 90 days (inactive sessions)
 * - Unverified users older than 7 days
 */
async function cleanupOldData() {
  try {
    const pool = getPool();
    
    console.log('🧹 Starting database cleanup...');
    
    // Delete chat messages older than 30 days
    const messagesResult = await pool.query(
      "DELETE FROM chat_messages WHERE created_at < NOW() - INTERVAL '30 days'"
    );
    console.log(`✅ Deleted ${messagesResult.rowCount} old chat messages`);
    
    // Delete user uploads older than 7 days
    const uploadsResult = await pool.query(
      "DELETE FROM user_uploads WHERE uploaded_at < NOW() - INTERVAL '7 days'"
    );
    console.log(`✅ Deleted ${uploadsResult.rowCount} old upload records`);
    
    // Delete inactive user sessions older than 90 days
    const sessionsResult = await pool.query(
      "DELETE FROM user_sessions WHERE updated_at < NOW() - INTERVAL '90 days'"
    );
    console.log(`✅ Deleted ${sessionsResult.rowCount} old sessions`);
    
    // Delete unverified users older than 7 days (who never verified)
    const usersResult = await pool.query(
      `DELETE FROM users 
       WHERE is_verified = FALSE 
       AND created_at < NOW() - INTERVAL '7 days'
       AND verification_token IS NOT NULL`
    );
    console.log(`✅ Deleted ${usersResult.rowCount} unverified users`);
    
    const totalDeleted = 
      messagesResult.rowCount + 
      uploadsResult.rowCount + 
      sessionsResult.rowCount + 
      usersResult.rowCount;
    
    console.log(`🎉 Cleanup completed! Total records deleted: ${totalDeleted}`);
    
    return {
      success: true,
      deleted: {
        messages: messagesResult.rowCount,
        uploads: uploadsResult.rowCount,
        sessions: sessionsResult.rowCount,
        users: usersResult.rowCount,
        total: totalDeleted
      }
    };
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { cleanupOldData };

