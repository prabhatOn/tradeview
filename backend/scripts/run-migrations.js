/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Database Migration Runner
 * Executes SQL migration files in order
 * Usage: node backend/scripts/run-migrations.js
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pro2',
  multipleStatements: true // Allow multiple SQL statements
};

// Migration files directory
const MIGRATIONS_DIR = path.join(__dirname, '../../database/migrations');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Create migrations tracking table
 */
async function createMigrationsTable(connection) {
  const sql = `
    CREATE TABLE IF NOT EXISTS migrations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      migration_name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      execution_time_ms INT,
      executed_by VARCHAR(100),
      
      INDEX idx_migration_name (migration_name),
      INDEX idx_executed_at (executed_at)
    ) COMMENT='Track executed database migrations';
  `;
  
  await connection.query(sql);
  console.log(`${colors.green}✓${colors.reset} Migrations tracking table ready`);
}

/**
 * Get list of migration files
 */
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log(`${colors.red}✗${colors.reset} Migrations directory not found: ${MIGRATIONS_DIR}`);
    return [];
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .filter(file => /^\d{3}_/.test(file)) // Only numbered migrations
    .sort();

  return files;
}

/**
 * Check if migration has already been run
 */
async function isMigrationExecuted(connection, migrationName) {
  const [rows] = await connection.query(
    'SELECT id FROM migrations WHERE migration_name = ?',
    [migrationName]
  );
  return rows.length > 0;
}

/**
 * Execute a single migration file
 */
async function executeMigration(connection, filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const migrationName = filename.replace('.sql', '');

  console.log(`\n${colors.cyan}→${colors.reset} Running migration: ${colors.bright}${migrationName}${colors.reset}`);

  // Check if already executed
  if (await isMigrationExecuted(connection, migrationName)) {
    console.log(`${colors.yellow}⊙${colors.reset} Migration already executed, skipping...`);
    return { success: true, skipped: true };
  }

  // Read migration file
  let sql = fs.readFileSync(filePath, 'utf8');

  // Remove comments for cleaner execution
  // But keep the SQL, remove only the verification queries and rollback scripts
  sql = sql.replace(/-- SELECT[\s\S]*?;/gm, ''); // Remove commented SELECT queries
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove /* */ comments

  const startTime = Date.now();

  try {
    // Execute migration
    await connection.query(sql);
    
    const executionTime = Date.now() - startTime;

    // Record successful migration
    await connection.query(
      `INSERT INTO migrations (migration_name, execution_time_ms, executed_by) 
       VALUES (?, ?, ?)`,
      [migrationName, executionTime, process.env.USER || 'system']
    );

    console.log(`${colors.green}✓${colors.reset} Migration completed in ${executionTime}ms`);
    return { success: true, executionTime };

  } catch (error) {
    const executionTime = Date.now() - startTime;

    console.log(`${colors.red}✗${colors.reset} Migration failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Display migration status
 */
async function showMigrationStatus(connection) {
  console.log(`\n${colors.bright}=== Migration Status ===${colors.reset}\n`);

  const [migrations] = await connection.query(`
    SELECT 
      migration_name,
      executed_at,
      execution_time_ms
    FROM migrations
    ORDER BY executed_at DESC
    LIMIT 10
  `);

  if (migrations.length === 0) {
    console.log('No migrations executed yet.');
    return;
  }

  migrations.forEach(m => {
    const statusIcon = `${colors.green}✓${colors.reset}`;
    const time = new Date(m.executed_at).toLocaleString();
    console.log(`${statusIcon} ${m.migration_name} (${time}) - ${m.execution_time_ms}ms`);
  });
}

/**
 * Main execution function
 */
async function runMigrations() {
  console.log(`${colors.bright}${colors.blue}`);
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   Production Trading System - Migrations      ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log(colors.reset);

  let connection;

  try {
    // Connect to database
    console.log(`${colors.cyan}→${colors.reset} Connecting to database: ${dbConfig.host}/${dbConfig.database}`);
    connection = await mysql.createConnection(dbConfig);
    console.log(`${colors.green}✓${colors.reset} Connected successfully\n`);

    // Create migrations tracking table
    await createMigrationsTable(connection);

    // Get migration files
    const migrationFiles = getMigrationFiles();
    
    if (migrationFiles.length === 0) {
      console.log(`${colors.yellow}⚠${colors.reset} No migration files found in ${MIGRATIONS_DIR}`);
      return;
    }

    console.log(`${colors.cyan}→${colors.reset} Found ${migrationFiles.length} migration file(s)\n`);

    // Execute each migration
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const file of migrationFiles) {
      const result = await executeMigration(connection, file);
      
      if (result.success) {
        if (result.skipped) {
          skippedCount++;
        } else {
          successCount++;
        }
      } else {
        failedCount++;
        console.log(`\n${colors.red}${colors.bright}✗ Migration failed! Stopping execution.${colors.reset}`);
        break;
      }
    }

    // Summary
    console.log(`\n${colors.bright}=== Migration Summary ===${colors.reset}`);
    console.log(`${colors.green}✓${colors.reset} Successful: ${successCount}`);
    console.log(`${colors.yellow}⊙${colors.reset} Skipped: ${skippedCount}`);
    console.log(`${colors.red}✗${colors.reset} Failed: ${failedCount}`);

    // Show status
    await showMigrationStatus(connection);

    if (failedCount === 0) {
      console.log(`\n${colors.green}${colors.bright}✓ All migrations completed successfully!${colors.reset}\n`);
    }

  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}✗ Fatal error:${colors.reset}`, error.message);
    console.error(error.stack);
    process.exit(1);

  } finally {
    if (connection) {
      await connection.end();
      console.log(`${colors.cyan}→${colors.reset} Database connection closed`);
    }
  }
}

// Run migrations
if (require.main === module) {
  runMigrations().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { runMigrations };
