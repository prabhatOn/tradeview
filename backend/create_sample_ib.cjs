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
    const [users] = await connection.execute('SELECT id, email FROM users ORDER BY id ASC LIMIT 2');
    if (!Array.isArray(users) || users.length < 2) {
      console.log('Need at least 2 users in users table to create a sample IB relationship.');
      console.log('You can create users via your registration flow or insert directly into the users table.');
      return;
    }

    const ibUser = users[0];
    const clientUser = users[1];

    console.log('Using users:', ibUser, clientUser);

    // Check if relationship already exists
    const [existing] = await connection.execute(
      'SELECT * FROM introducing_brokers WHERE ib_user_id = ? AND client_user_id = ?',
      [ibUser.id, clientUser.id]
    );

    if (Array.isArray(existing) && existing.length > 0) {
      console.log('Introducing broker relationship already exists:', existing[0]);
      return;
    }

    const referral = `ref-${Date.now()}`;
    const commissionRate = 0.0070;
    const ibSharePercent = 50.00;

    const [result] = await connection.execute(
      `INSERT INTO introducing_brokers (ib_user_id, client_user_id, referral_code, commission_rate, ib_share_percent, status, tier_level) VALUES (?, ?, ?, ?, ?, 'active', 'bronze')`,
      [ibUser.id, clientUser.id, referral, commissionRate, ibSharePercent]
    );

    console.log('Inserted IB relationship id:', result.insertId);
    const [row] = await connection.execute('SELECT ib.*, u.email AS ib_email, cu.email AS client_email FROM introducing_brokers ib JOIN users u ON u.id = ib.ib_user_id JOIN users cu ON cu.id = ib.client_user_id WHERE ib.id = ?', [result.insertId]);
    console.log('Created IB relationship:', row[0]);
  } catch (err) {
    console.error('Failed to create sample IB:', err && err.message ? err.message : err);
  } finally {
    await connection.end();
  }
})();
