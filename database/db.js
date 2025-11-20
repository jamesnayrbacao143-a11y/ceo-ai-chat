const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;

function createPool() {
  if (pool) return pool;

  // Use connection string if available (for Vercel/Production)
  if (process.env.MYSQL_CONNECTION_STRING) {
    pool = mysql.createPool(process.env.MYSQL_CONNECTION_STRING);
  } else {
    // Use individual connection parameters
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'harviongpt',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
  }

  return pool;
}

async function initDatabase() {
  try {
    const connection = await createPool().getConnection();
    console.log('✅ MySQL database connected successfully');
    
    // Test query
    await connection.query('SELECT 1');
    connection.release();
    
    return true;
  } catch (error) {
    console.error('❌ MySQL database connection failed:', error.message);
    return false;
  }
}

function getPool() {
  if (!pool) {
    createPool();
  }
  return pool;
}

module.exports = {
  createPool,
  initDatabase,
  getPool
};

