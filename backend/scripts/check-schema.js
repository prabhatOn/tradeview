/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Check Database Schema
 * Shows current columns in trading_accounts and positions tables
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pro2'
};

async function checkSchema() {
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('=== INTRODUCING_BROKERS COLUMNS ===\n');
    const [ibColumns] = await connection.query('DESCRIBE introducing_brokers');
    ibColumns.forEach(col => {
      console.log(`${col.Field.padEnd(30)} ${col.Type.padEnd(40)} ${col.Null} ${col.Key} ${col.Default || ''}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkSchema();
