const mysql = require('mysql2/promise');

async function checkAccountData() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'pro2'
  });

  try {
    console.log('Checking account data in database...\n');
    
    // Get account 7 details
    const [accounts] = await connection.execute(`
      SELECT id, account_number, balance, equity, used_margin, free_margin, margin_level
      FROM trading_accounts 
      WHERE id = 7
    `);
    
    if (accounts.length > 0) {
      const account = accounts[0];
      console.log('Account 7 data:');
      console.log('  ID:', account.id);
      console.log('  Account Number:', account.account_number);
      console.log('  Balance:', account.balance);
      console.log('  Equity:', account.equity);
      console.log('  Used Margin:', account.used_margin);
      console.log('  Free Margin:', account.free_margin);
      console.log('  Margin Level:', account.margin_level);
    } else {
      console.log('Account 7 not found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkAccountData();
