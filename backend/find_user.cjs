const mysql = require('mysql2/promise');
require('dotenv').config();

async function find(term) {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pro2',
  });

  try {
    const q = `SELECT id, email, first_name, last_name, display_name FROM users WHERE email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR display_name LIKE ? LIMIT 50`;
    const like = `%${term}%`;
    const [rows] = await connection.execute(q, [like, like, like, like]);
    console.log('Found users:', rows.length);
    for (const r of rows) console.log(r);
  } catch (err) {
    console.error('Find failed:', err && err.message ? err.message : err);
  } finally {
    await connection.end();
  }
}

const term = process.argv[2] || 'prabhat';
find(term).catch((e) => { console.error(e); process.exit(1); });
