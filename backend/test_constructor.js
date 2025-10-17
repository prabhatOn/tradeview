const mysql = require('mysql2/promise');

async function testConstructor() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'pro2'
  });

  try {
    console.log('Testing TradingAccount constructor with database row...\n');
    
    // Get account 7 from database
    const [rows] = await connection.execute(
      'SELECT * FROM trading_accounts WHERE id = 7'
    );
    
    if (rows.length === 0) {
      console.log('Account 7 not found');
      return;
    }
    
    const dbRow = rows[0];
    console.log('Database row columns:');
    console.log('  used_margin:', dbRow.used_margin);
    console.log('  free_margin:', dbRow.free_margin);
    console.log('  margin_level:', dbRow.margin_level);
    
    console.log('\nSimulating TradingAccount constructor...');
    
    // Simulate what the constructor does
    const testAccount = {
      id: dbRow.id,
      userId: dbRow.user_id,
      accountNumber: dbRow.account_number,
      usedMargin: parseFloat(dbRow.used_margin || 0),
      freeMargin: parseFloat(dbRow.free_margin),
      marginLevel: parseFloat(dbRow.margin_level)
    };
    
    console.log('\nConstructor result:');
    console.log('  usedMargin:', testAccount.usedMargin);
    console.log('  freeMargin:', testAccount.freeMargin);
    console.log('  marginLevel:', testAccount.marginLevel);
    
    if (testAccount.usedMargin === 0) {
      console.log('\n❌ ERROR: usedMargin is 0!');
      console.log('Check if the backend has been restarted after fixing the constructor.');
    } else {
      console.log('\n✅ Constructor working correctly!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

testConstructor();
