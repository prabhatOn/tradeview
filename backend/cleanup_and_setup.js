const { executeQuery, executeTransaction, initializeDatabase } = require('./config/database');

async function cleanupAndSetupTestData() {
  try {
    console.log('🧹 Starting database cleanup and test setup...');
    await initializeDatabase();
    
    // Step 1: Find john.anderson@example.com user
    console.log('\n📋 Finding john.anderson@example.com user...');
    const users = await executeQuery(
      'SELECT id, first_name, last_name, email FROM users WHERE email = ?',
      ['john.anderson@example.com']
    );
    
    if (!users.length) {
      throw new Error('User john.anderson@example.com not found!');
    }
    
    const user = users[0];
    console.log(`✅ Found user: ${user.first_name} ${user.last_name} (ID: ${user.id})`);
    
    // Step 2: Get user's trading accounts
    console.log('\n📊 Getting user trading accounts...');
    const accounts = await executeQuery(
      'SELECT * FROM trading_accounts WHERE user_id = ?',
      [user.id]
    );
    
    console.log(`Found ${accounts.length} trading accounts for user ${user.first_name} ${user.last_name}`);
    accounts.forEach(acc => {
      console.log(`- Account ${acc.account_number} (ID: ${acc.id}) - Balance: $${acc.balance}`);
    });
    
    if (!accounts.length) {
      throw new Error('No trading accounts found for user!');
    }
    
    // Step 3: Clean up existing positions and history
    console.log('\n🗑️ Cleaning up existing trading data...');
    
    // Prepare cleanup queries
    const accountIds = accounts.map(acc => acc.id);
    const placeholders = accountIds.map(() => '?').join(',');
    
    const cleanupQueries = [
      {
        sql: `DELETE FROM trade_history WHERE account_id IN (${placeholders})`,
        params: accountIds
      },
      {
        sql: `DELETE FROM positions WHERE account_id IN (${placeholders})`,
        params: accountIds
      },
      {
        sql: `DELETE FROM account_balance_history WHERE account_id IN (${placeholders})`,
        params: accountIds
      }
    ];
    
    await executeTransaction(cleanupQueries);
    console.log('✅ Cleaned up positions, trade history, and balance history');
    
    // Step 4: Add $100,000 to user's main account
    console.log('\n💰 Adding $100,000 to user account...');
    
    const mainAccount = accounts[0]; // Use first account as main
    const newBalance = 100000.00;
    
    const fundingQueries = [
      {
        sql: 'UPDATE trading_accounts SET balance = ?, equity = ?, free_margin = ?, updated_at = NOW() WHERE id = ?',
        params: [newBalance, newBalance, newBalance, mainAccount.id]
      },
      {
        sql: `INSERT INTO account_balance_history 
             (account_id, change_type, change_amount, previous_balance, new_balance, notes, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        params: [
          mainAccount.id,
          'deposit',
          newBalance,
          parseFloat(mainAccount.balance),
          newBalance,
          'Initial test fund deposit - Database cleanup'
        ]
      }
    ];
    
    await executeTransaction(fundingQueries);
    console.log(`✅ Added $${newBalance.toLocaleString()} to account ${mainAccount.account_number}`);
    
    // Step 5: Verify the setup
    console.log('\n🔍 Verifying setup...');
    
    const updatedAccount = await executeQuery(
      'SELECT * FROM trading_accounts WHERE id = ?',
      [mainAccount.id]
    );
    
    const positionCount = await executeQuery(
      'SELECT COUNT(*) as count FROM positions WHERE account_id = ?',
      [mainAccount.id]
    );
    
    const historyCount = await executeQuery(
      'SELECT COUNT(*) as count FROM trade_history WHERE account_id = ?',
      [mainAccount.id]
    );
    
    console.log('✅ Setup verification:');
    console.log(`   - Account Balance: $${parseFloat(updatedAccount[0].balance).toLocaleString()}`);
    console.log(`   - Account Equity: $${parseFloat(updatedAccount[0].equity).toLocaleString()}`);
    console.log(`   - Free Margin: $${parseFloat(updatedAccount[0].free_margin).toLocaleString()}`);
    console.log(`   - Open Positions: ${positionCount[0].count}`);
    console.log(`   - Trade History: ${historyCount[0].count}`);
    
    // Step 6: Display test instructions
    console.log('\n🎯 TEST INSTRUCTIONS:');
    console.log('=====================================');
    console.log('1. Login with: john.anderson@example.com');
    console.log(`2. Select Account: ${mainAccount.account_number}`);
    console.log('3. Current Balance: $100,000.00');
    console.log('4. Test Flow:');
    console.log('   a) Open a BUY position (e.g., EURUSD)');
    console.log('   b) Open a SELL position (e.g., GBPUSD)');
    console.log('   c) Check Positions tab - should show 2 open positions');
    console.log('   d) Check balance updates in real-time');
    console.log('   e) Close positions and verify P&L calculations');
    console.log('   f) Verify fund management in both tabs');
    console.log('=====================================');
    
    console.log('\n🚀 Database cleanup and setup completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during cleanup and setup:', error);
    process.exit(1);
  }
}

cleanupAndSetupTestData();