const mysql = require('mysql2/promise');

async function cleanDatabase() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'pro2',
        multipleStatements: false
    });
    
    console.log('🧹 Starting database cleanup...\n');
    
    try {
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        
        // Step 1: Get admin user IDs
        const [adminUsers] = await connection.execute(`
            SELECT DISTINCT u.id, u.email
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE r.is_admin = TRUE
        `);
        
        const adminIds = adminUsers.map(u => u.id);
        console.log('✅ Found admin users:');
        adminUsers.forEach(u => console.log(`   - ${u.email} (ID: ${u.id})`));
        console.log();
        
        // Step 2: Clean all trading data
        console.log('🗑️  Cleaning trading data...');
        await connection.execute('DELETE FROM positions');
        await connection.execute('DELETE FROM trade_history');
        await connection.execute('DELETE FROM ib_commissions');
        await connection.execute('DELETE FROM introducing_brokers');
        await connection.execute('DELETE FROM swap_charges_log');
        await connection.execute('DELETE FROM margin_events');
        await connection.execute('DELETE FROM orders');
        console.log('   ✓ Trading data cleaned\n');
        
        // Step 3: Clean user-related data (keep admin data)
        console.log('🗑️  Cleaning user-related data...');
        
        const tablesToClean = [
            'trading_accounts',
            'deposits',
            'withdrawals', 
            'transactions',
            'account_balance_history',
            'user_notifications',
            'price_alerts',
            'trading_sessions',
            'api_keys',
            'support_tickets',
            'ib_applications',
            'payment_methods',
            'referral_codes',
            'user_settings',
            'user_addresses'
        ];
        
        for (const table of tablesToClean) {
            try {
                const placeholders = adminIds.map(() => '?').join(',');
                await connection.execute(
                    `DELETE FROM ${table} WHERE user_id NOT IN (${placeholders})`,
                    adminIds
                );
                console.log(`   ✓ ${table} cleaned`);
            } catch (error) {
                console.log(`   ⚠️  ${table} - ${error.message}`);
            }
        }
        
        console.log();
        
        // Step 4: Delete non-admin user roles
        console.log('🗑️  Cleaning user roles...');
        const placeholders = adminIds.map(() => '?').join(',');
        await connection.execute(
            `DELETE FROM user_roles WHERE user_id NOT IN (${placeholders})`,
            adminIds
        );
        console.log('   ✓ User roles cleaned\n');
        
        // Step 5: Delete non-admin users
        console.log('🗑️  Deleting non-admin users...');
        const [result] = await connection.execute(
            `DELETE FROM users WHERE id NOT IN (${placeholders})`,
            adminIds
        );
        console.log(`   ✓ Deleted ${result.affectedRows} non-admin users\n`);
        
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        
        // Final verification
        console.log('═'.repeat(60));
        console.log('✅ DATABASE CLEANUP COMPLETED!');
        console.log('═'.repeat(60));
        console.log();
        
        const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
        console.log(`👤 Users remaining: ${users[0].count}`);
        
        const [positions] = await connection.execute('SELECT COUNT(*) as count FROM positions');
        console.log(`📊 Positions: ${positions[0].count}`);
        
        const [tradeHistory] = await connection.execute('SELECT COUNT(*) as count FROM trade_history');
        console.log(`📈 Trade history: ${tradeHistory[0].count}`);
        
        const [tradingAccounts] = await connection.execute('SELECT COUNT(*) as count FROM trading_accounts');
        console.log(`💼 Trading accounts: ${tradingAccounts[0].count}`);
        
        const [transactions] = await connection.execute('SELECT COUNT(*) as count FROM transactions');
        console.log(`💰 Transactions: ${transactions[0].count}`);
        
        const [symbols] = await connection.execute('SELECT COUNT(*) as count FROM symbols');
        console.log(`🎯 Symbols: ${symbols[0].count}`);
        
        console.log();
        console.log('═'.repeat(60));
        console.log('✅ Database is clean and ready for production!');
        console.log('═'.repeat(60));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await connection.end();
    }
}

cleanDatabase();
