const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkTables() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'lkjhg0.1',
      database: process.env.DB_NAME || 'pro2'
    });

    console.log('🔗 Connected to database successfully');
    
    // Get all tables
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('📋 Existing tables in database:');
    tables.forEach(table => {
      console.log(`  • ${Object.values(table)[0]}`);
    });

    console.log('\n📊 Checking specific tables structure...');
    
    // Check users table structure
    try {
      const [userColumns] = await connection.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
        ORDER BY ORDINAL_POSITION
      `, [process.env.DB_NAME || 'pro2']);
      
      console.log('\n👤 Users table columns:');
      userColumns.forEach(col => {
        console.log(`  • ${col.COLUMN_NAME} (${col.DATA_TYPE}) - ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    } catch (error) {
      console.log('⚠️ Users table not found');
    }

    // Check positions table structure
    try {
      const [positionColumns] = await connection.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'positions'
        ORDER BY ORDINAL_POSITION
      `, [process.env.DB_NAME || 'pro2']);
      
      console.log('\n📈 Positions table columns:');
      positionColumns.forEach(col => {
        console.log(`  • ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
      });
    } catch (error) {
      console.log('⚠️ Positions table not found');
    }

    // Check if transactions table exists by a different name
    const [allTables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE '%transaction%'
    `, [process.env.DB_NAME || 'pro2']);
    
    console.log('\n💳 Transaction-related tables:');
    if (allTables.length === 0) {
      console.log('  • No transaction tables found');
    } else {
      allTables.forEach(table => {
        console.log(`  • ${table.TABLE_NAME}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkTables();