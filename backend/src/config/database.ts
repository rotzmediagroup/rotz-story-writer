import { Pool, PoolClient } from 'pg';
import { logger } from './logger';

let pool: Pool;

export async function connectDatabase(): Promise<void> {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.DB_POOL_MAX || '10'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logger.info('✅ Database connected successfully');

    // Handle pool errors
    pool.on('error', (err) => {
      logger.error('Unexpected error on idle database client:', err);
    });

  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    logger.info('Database disconnected');
  }
}

export async function getClient(): Promise<PoolClient> {
  if (!pool) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return pool.connect();
}

export async function query(text: string, params?: any[]): Promise<any> {
  const client = await getClient();
  try {
    const start = Date.now();
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Executed query', { 
      text: text.substring(0, 100), 
      duration: `${duration}ms`,
      rows: result.rowCount 
    });
    
    return result;
  } finally {
    client.release();
  }
}

export { pool };