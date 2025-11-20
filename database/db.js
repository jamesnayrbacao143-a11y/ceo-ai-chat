const { Pool } = require('pg');
require('dotenv').config();

let pool = null;

function createPool() {
  if (pool) return pool;

  // Use connection string if available (for Vercel/Production with Supabase)
  if (process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING,
      ssl: {
        rejectUnauthorized: false // Required for Supabase
      }
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
      } : false
    });
  }

  return pool;
}

async function initDatabase() {
  try {
    const client = await createPool().connect();
    console.log('✅ PostgreSQL database connected successfully');
    
    // Test query
    await client.query('SELECT 1');
    client.release();
    
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL database connection failed:', error.message);
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
