const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pro2',
  });

  try {
    const [cols] = await connection.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`, [process.env.DB_NAME || 'pro2']);
    console.log('users table columns:');
    for (const c of cols) console.log('-', c.COLUMN_NAME);
  } catch (err) {
    console.error('failed:', err && err.message ? err.message : err);
  } finally {
    await connection.end();
  }
})();
