"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const fs_1 = require("fs");
const path_1 = require("path");
const dotenv_1 = require("dotenv");
const database_1 = require("../src/config/database");
const logger_1 = require("../src/config/logger");
// Load environment variables
(0, dotenv_1.config)();
async function createMigrationsTable() {
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    );
  `;
    await (0, database_1.query)(createTableQuery);
    logger_1.logger.info('Migrations table ensured');
}
async function getAppliedMigrations() {
    const result = await (0, database_1.query)('SELECT version FROM schema_migrations ORDER BY version');
    return result.rows.map((row) => row.version);
}
async function loadMigrations() {
    const migrationsDir = __dirname;
    const files = (0, fs_1.readdirSync)(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();
    const migrations = [];
    for (const filename of files) {
        const version = filename.replace('.sql', '');
        const filepath = (0, path_1.join)(migrationsDir, filename);
        const sql = (0, fs_1.readFileSync)(filepath, 'utf8');
        migrations.push({
            version,
            filename,
            sql,
        });
    }
    return migrations;
}
async function applyMigration(migration) {
    logger_1.logger.info(`Applying migration: ${migration.filename}`);
    try {
        // Execute migration SQL
        await (0, database_1.query)(migration.sql);
        // Record migration as applied (if not already in the SQL)
        const insertMigrationQuery = `
      INSERT INTO schema_migrations (version, applied_at) 
      VALUES ($1, NOW()) 
      ON CONFLICT (version) DO NOTHING;
    `;
        await (0, database_1.query)(insertMigrationQuery, [migration.version]);
        logger_1.logger.info(`✅ Migration ${migration.filename} applied successfully`);
    }
    catch (error) {
        logger_1.logger.error(`❌ Failed to apply migration ${migration.filename}:`, error);
        throw error;
    }
}
async function runMigrations() {
    try {
        logger_1.logger.info('🔄 Starting database migrations...');
        // Connect to database
        await (0, database_1.connectDatabase)();
        // Ensure migrations table exists
        await createMigrationsTable();
        // Load all migrations
        const migrations = await loadMigrations();
        logger_1.logger.info(`Found ${migrations.length} migration files`);
        // Get applied migrations
        const appliedMigrations = await getAppliedMigrations();
        logger_1.logger.info(`${appliedMigrations.length} migrations already applied`);
        // Apply pending migrations
        const pendingMigrations = migrations.filter(migration => !appliedMigrations.includes(migration.version));
        if (pendingMigrations.length === 0) {
            logger_1.logger.info('✅ No pending migrations');
            return;
        }
        logger_1.logger.info(`Applying ${pendingMigrations.length} pending migrations...`);
        for (const migration of pendingMigrations) {
            await applyMigration(migration);
        }
        logger_1.logger.info('✅ All migrations completed successfully');
    }
    catch (error) {
        logger_1.logger.error('❌ Migration failed:', error);
        throw error;
    }
    finally {
        // Always disconnect database
        await (0, database_1.disconnectDatabase)();
    }
}
// CLI usage
if (require.main === module) {
    runMigrations()
        .then(() => {
        logger_1.logger.info('Migration script completed');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error('Migration script failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=migrate.js.map