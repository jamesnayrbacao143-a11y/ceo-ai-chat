const { Pool } = require('pg');
require('dotenv').config();

let pool = null;

function createPool() {
  if (pool) return pool;

  const poolConfig = {
    // Connection timeout settings for serverless
    connectionTimeoutMillis: 5000, // 5 seconds to establish connection
    idleTimeoutMillis: 30000, // 30 seconds idle timeout
    max: 1, // Single connection for serverless (Vercel)
    // Allow pool to close idle connections quickly
    allowExitOnIdle: true
  };

  // Use connection string if available (for Vercel/Production with Supabase)
  if (process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING,
      ssl: {
        rejectUnauthorized: false // Required for Supabase
      },
      ...poolConfig
    });
  } else {
    // Use individual connection parameters
    pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || '',
      database: process.env.POSTGRES_DATABASE || 'postgres',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      ssl: process.env.POSTGRES_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false,
      ...poolConfig
    });
  }

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
  });

  return pool;
}

async function initDatabase() {
  try {
    const pool = createPool();
    
    // Add timeout to connection attempt
    const connectPromise = pool.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout')), 5000)
    );
    
    const client = await Promise.race([connectPromise, timeoutPromise]);
    console.log('✅ PostgreSQL database connected successfully');
    
    // Test query with timeout
    const queryPromise = client.query('SELECT 1');
    const queryTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database query timeout')), 3000)
    );
    
    await Promise.race([queryPromise, queryTimeoutPromise]);
    client.release();
    
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL database connection failed:', error.message);
    // Don't throw - allow app to continue even if DB fails
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
