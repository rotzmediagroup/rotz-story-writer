import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { query, connectDatabase, disconnectDatabase } from '../src/config/database';
import { logger } from '../src/config/logger';

// Load environment variables
config();

interface Migration {
  version: string;
  filename: string;
  sql: string;
}

async function createMigrationsTable(): Promise<void> {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    );
  `;
  
  await query(createTableQuery);
  logger.info('Migrations table ensured');
}

async function getAppliedMigrations(): Promise<string[]> {
  const result = await query('SELECT version FROM schema_migrations ORDER BY version');
  return result.rows.map((row: { version: string }) => row.version);
}

async function loadMigrations(): Promise<Migration[]> {
  const migrationsDir = __dirname;
  const files = readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  const migrations: Migration[] = [];

  for (const filename of files) {
    const version = filename.replace('.sql', '');
    const filepath = join(migrationsDir, filename);
    const sql = readFileSync(filepath, 'utf8');
    
    migrations.push({
      version,
      filename,
      sql,
    });
  }

  return migrations;
}

async function applyMigration(migration: Migration): Promise<void> {
  logger.info(`Applying migration: ${migration.filename}`);
  
  try {
    // Execute migration SQL
    await query(migration.sql);
    
    // Record migration as applied (if not already in the SQL)
    const insertMigrationQuery = `
      INSERT INTO schema_migrations (version, applied_at) 
      VALUES ($1, NOW()) 
      ON CONFLICT (version) DO NOTHING;
    `;
    
    await query(insertMigrationQuery, [migration.version]);
    
    logger.info(`✅ Migration ${migration.filename} applied successfully`);
  } catch (error) {
    logger.error(`❌ Failed to apply migration ${migration.filename}:`, error);
    throw error;
  }
}

export async function runMigrations(): Promise<void> {
  try {
    logger.info('🔄 Starting database migrations...');
    
    // Connect to database
    await connectDatabase();
    
    // Ensure migrations table exists
    await createMigrationsTable();
    
    // Load all migrations
    const migrations = await loadMigrations();
    logger.info(`Found ${migrations.length} migration files`);
    
    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations();
    logger.info(`${appliedMigrations.length} migrations already applied`);
    
    // Apply pending migrations
    const pendingMigrations = migrations.filter(
      migration => !appliedMigrations.includes(migration.version)
    );
    
    if (pendingMigrations.length === 0) {
      logger.info('✅ No pending migrations');
      return;
    }
    
    logger.info(`Applying ${pendingMigrations.length} pending migrations...`);
    
    for (const migration of pendingMigrations) {
      await applyMigration(migration);
    }
    
    logger.info('✅ All migrations completed successfully');
    
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    throw error;
  } finally {
    // Always disconnect database
    await disconnectDatabase();
  }
}

// CLI usage
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}