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
    const [rows] = await connection.execute(`SELECT ib.*, u.email as ib_email, cu.email as client_email FROM introducing_brokers ib JOIN users u ON u.id = ib.ib_user_id JOIN users cu ON cu.id = ib.client_user_id ORDER BY ib.created_at DESC LIMIT 100`);
    console.log('introducing_brokers count:', Array.isArray(rows) ? rows.length : 0);
    if (Array.isArray(rows) && rows.length) {
      console.log('Sample row:', rows[0]);
    } else {
      console.log('No IB relationships found in DB.');
    }
  } catch (err) {
    console.error('Query failed:', err && err.message ? err.message : err);
  } finally {
    await connection.end();
  }
})();
