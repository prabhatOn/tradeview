/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Fix Migrations Table
 * Drops and recreates the migrations table with correct schema
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pro2'
};

async function fixMigrationsTable() {
  let connection;

  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Connected\n');

    // Drop existing migrations table
    console.log('Dropping existing migrations table...');
    await connection.query('DROP TABLE IF EXISTS migrations');
    console.log('✓ Dropped\n');

    // Recreate with correct schema
    console.log('Creating migrations table with correct schema...');
    await connection.query(`
      CREATE TABLE migrations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        execution_time_ms INT,
        executed_by VARCHAR(100),
        
        INDEX idx_migration_name (migration_name),
        INDEX idx_executed_at (executed_at)
      ) COMMENT='Track executed database migrations'
    `);
    console.log('✓ Created\n');

    console.log('✓ Migrations table fixed! You can now run migrations.\n');

  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);

  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixMigrationsTable();
