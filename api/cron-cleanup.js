const { cleanupOldData } = require('../utils/cleanup');

module.exports = async (req, res) => {
  // Verify it's called by Vercel Cron (optional security)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🕐 Cron job triggered: Starting cleanup...');
    const result = await cleanupOldData();
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Cleanup completed successfully',
        deleted: result.deleted,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Cron cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

