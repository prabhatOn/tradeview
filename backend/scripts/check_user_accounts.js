const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkUserAccounts() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'pro2'
  });

  try {
    console.log('🔍 Checking user accounts for debugging...\n');

    // Check user 8 specifically (from the error logs)
    const [user8] = await connection.execute('SELECT * FROM users WHERE id = 8');
    console.log('👤 User 8 details:', user8[0]);

    // Check trading accounts for user 8
    const [accounts8] = await connection.execute('SELECT * FROM trading_accounts WHERE user_id = 8');
    console.log('\n💰 Trading accounts for user 8:');
    accounts8.forEach(acc => {
      console.log(`  Account ID: ${acc.id}, Account Number: ${acc.account_number}, Balance: $${acc.balance}, Status: ${acc.status}`);
    });

    // Check all users and their accounts
    const [allAccounts] = await connection.execute(`
      SELECT u.id as user_id, u.email, ta.id as account_id, ta.account_number, ta.balance, ta.status
      FROM users u
      LEFT JOIN trading_accounts ta ON u.id = ta.user_id
      ORDER BY u.id
    `);
    console.log('\n📊 All users and their accounts:');
    allAccounts.forEach(row => {
      console.log(`  User ${row.user_id} (${row.email}): Account ${row.account_id} - $${row.balance} (${row.status})`);
    });

    // Check what the API would return for user 8
    console.log('\n🔗 Simulating API call for user 8:');
    console.log('GET /api/trading/accounts (user_id: 8)');
    console.log('Should return account with ID:', accounts8[0]?.id);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

checkUserAccounts();