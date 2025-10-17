const mysql = require('mysql2/promise');
require('dotenv').config();

async function cleanupUsersOnly() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pro2',
      multipleStatements: true
    });

    console.log('✅ Connected to database');

    // Start transaction
    await connection.beginTransaction();

    console.log('\n🧹 Cleaning up user data (keeping admin)...\n');

    // 1. Delete all positions for non-admin users
    const [positionsResult] = await connection.query(`
      DELETE p FROM positions p
      INNER JOIN trading_accounts ta ON p.account_id = ta.id
      INNER JOIN users u ON ta.user_id = u.id
      WHERE u.id != 1
    `);
    console.log(`✅ Deleted ${positionsResult.affectedRows} positions for non-admin users`);

    // 2. Delete trade history for non-admin users
    const [tradeHistoryResult] = await connection.query(`
      DELETE th FROM trade_history th
      INNER JOIN trading_accounts ta ON th.account_id = ta.id
      INNER JOIN users u ON ta.user_id = u.id
      WHERE u.id != 1
    `);
    console.log(`✅ Deleted ${tradeHistoryResult.affectedRows} trade history records`);

    // 3. Delete trading accounts for non-admin users
    const [accountsResult] = await connection.query(`
      DELETE ta FROM trading_accounts ta
      INNER JOIN users u ON ta.user_id = u.id
      WHERE u.id != 1
    `);
    console.log(`✅ Deleted ${accountsResult.affectedRows} trading accounts`);

    // 4. Delete funds transactions for non-admin users (if table exists)
    try {
      const [fundsResult] = await connection.query(`
        DELETE FROM funds_transactions
        WHERE user_id != 1
      `);
      console.log(`✅ Deleted ${fundsResult.affectedRows} funds transactions`);
    } catch (error) {
      console.log(`⚠️  Skipped funds_transactions (table doesn't exist)`);
    }

    // 5. Delete KYC documents for non-admin users (if table exists)
    try {
      const [kycResult] = await connection.query(`
        DELETE FROM kyc_documents
        WHERE user_id != 1
      `);
      console.log(`✅ Deleted ${kycResult.affectedRows} KYC documents`);
    } catch (error) {
      console.log(`⚠️  Skipped kyc_documents (table doesn't exist)`);
    }

    // 6. Delete bank details for non-admin users (if table exists)
    try {
      const [bankResult] = await connection.query(`
        DELETE FROM bank_details
        WHERE user_id != 1
      `);
      console.log(`✅ Deleted ${bankResult.affectedRows} bank details`);
    } catch (error) {
      console.log(`⚠️  Skipped bank_details (table doesn't exist)`);
    }

    // 7. Delete notifications for non-admin users (if table exists)
    try {
      const [notificationsResult] = await connection.query(`
        DELETE FROM notifications
        WHERE user_id != 1
      `);
      console.log(`✅ Deleted ${notificationsResult.affectedRows} notifications`);
    } catch (error) {
      console.log(`⚠️  Skipped notifications (table doesn't exist)`);
    }

    // 8. Delete price alerts for non-admin users (if table exists)
    try {
      const [alertsResult] = await connection.query(`
        DELETE FROM price_alerts
        WHERE user_id != 1
      `);
      console.log(`✅ Deleted ${alertsResult.affectedRows} price alerts`);
    } catch (error) {
      console.log(`⚠️  Skipped price_alerts (table doesn't exist)`);
    }

    // 9. Delete user settings for non-admin users (if table exists)
    try {
      const [settingsResult] = await connection.query(`
        DELETE FROM user_settings
        WHERE user_id != 1
      `);
      console.log(`✅ Deleted ${settingsResult.affectedRows} user settings`);
    } catch (error) {
      console.log(`⚠️  Skipped user_settings (table doesn't exist)`);
    }

    // 10. Delete API keys for non-admin users (if table exists)
    try {
      const [apiKeysResult] = await connection.query(`
        DELETE FROM api_keys
        WHERE user_id != 1
      `);
      console.log(`✅ Deleted ${apiKeysResult.affectedRows} API keys`);
    } catch (error) {
      console.log(`⚠️  Skipped api_keys (table doesn't exist)`);
    }

    // 11. Delete non-admin users
    const [usersResult] = await connection.query(`
      DELETE FROM users
      WHERE id != 1
    `);
    console.log(`✅ Deleted ${usersResult.affectedRows} non-admin users`);

    // Commit transaction
    await connection.commit();
    console.log('\n✅ Cleanup completed successfully!');

    // Show remaining admin user(s)
    const [admins] = await connection.query(`
      SELECT id, email, first_name, last_name, created_at
      FROM users
      WHERE id = 1
    `);

    console.log('\n📊 Remaining admin user:');
    console.table(admins);

    // Show system data counts
    const [symbolsCount] = await connection.query('SELECT COUNT(*) as count FROM symbols');
    
    console.log('\n📊 System data preserved:');
    console.log(`   Symbols: ${symbolsCount[0].count}`);
    
    try {
      const [categoriesCount] = await connection.query('SELECT COUNT(*) as count FROM symbol_categories');
      console.log(`   Categories: ${categoriesCount[0].count}`);
    } catch (error) {
      console.log(`   Categories: N/A (table doesn't exist)`);
    }
    
    try {
      const [pricesCount] = await connection.query('SELECT COUNT(*) as count FROM market_prices');
      console.log(`   Market Prices: ${pricesCount[0].count}`);
    } catch (error) {
      console.log(`   Market Prices: N/A (table doesn't exist)`);
    }

  } catch (error) {
    // Rollback on error
    if (connection) {
      await connection.rollback();
    }
    console.error('❌ Error during cleanup:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Database connection closed');
    }
  }
}

// Run cleanup
cleanupUsersOnly()
  .then(() => {
    console.log('\n🎉 Database cleanup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Cleanup failed:', error);
    process.exit(1);
  });
