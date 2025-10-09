const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './.env' });

async function loadSampleData() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'lkjhg0.1',
      database: process.env.DB_NAME || 'pro2'
    });

    console.log('Connected to database');

    const sql = fs.readFileSync(path.join(__dirname, '../database/sample_data.sql'), 'utf8');
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

    console.log(`Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        try {
          await connection.execute(statement);
          console.log(`Executed statement ${i + 1}/${statements.length}`);
        } catch (error) {
          console.error(`Error executing statement ${i + 1}:`, error.message);
          // Continue with other statements
        }
      }
    }

    console.log('Sample data loaded successfully');
  } catch (error) {
    console.error('Error loading sample data:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

loadSampleData();