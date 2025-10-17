const mysql = require('mysql2/promise');

async function cleanDatabase() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'pro2',
        multipleStatements: false
    });
    
    console.log('🧹 Starting database cleanup...');
    console.log('📌 Keeping: Admin users, Symbols, System settings, Roles\n');
    
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
        console.log('✅ Admin users to preserve:');
        adminUsers.forEach(u => console.log(`   - ${u.email} (ID: ${u.id})`));
        console.log();
        
        if (adminIds.length === 0) {
            console.error('❌ No admin users found! Aborting cleanup.');
            return;
        }
        
        // Step 2: Clean ALL trading/transaction data
        console.log('🗑️  Cleaning ALL trading and transaction data...');
        const tradingTables = [
            'positions',
            'trade_history',
            'ib_commissions',
            'introducing_brokers',
            'swap_charges_log',
            'margin_events',
            'orders',
            'deposits',
            'withdrawals',
            'transactions',
            'account_balance_history',
            'trading_sessions',
            'position_state_history',
            'trading_performance',
            'daily_trading_volume'
        ];
        
        for (const table of tradingTables) {
            try {
                const [result] = await connection.execute(`DELETE FROM ${table}`);
                console.log(`   ✓ ${table} - deleted ${result.affectedRows} rows`);
            } catch (error) {
                console.log(`   ⚠️  ${table} - ${error.message}`);
            }
        }
        console.log();
        
        // Step 3: Clean non-admin user data
        console.log('🗑️  Cleaning non-admin user data...');
        const placeholders = adminIds.map(() => '?').join(',');
        
        const userDataTables = [
            'trading_accounts',
            'user_notifications',
            'price_alerts',
            'api_keys',
            'support_tickets',
            'ib_applications',
            'payment_methods',
            'referral_codes',
            'user_settings',
            'user_addresses',
            'user_tier_assignments',
            'api_usage_logs'
        ];
        
        for (const table of userDataTables) {
            try {
                const [result] = await connection.execute(
                    `DELETE FROM ${table} WHERE user_id NOT IN (${placeholders})`,
                    adminIds
                );
                console.log(`   ✓ ${table} - deleted ${result.affectedRows} non-admin rows`);
            } catch (error) {
                console.log(`   ⚠️  ${table} - ${error.message}`);
            }
        }
        console.log();
        
        // Step 4: Clean non-admin user roles
        console.log('🗑️  Cleaning non-admin user roles...');
        const [rolesResult] = await connection.execute(
            `DELETE FROM user_roles WHERE user_id NOT IN (${placeholders})`,
            adminIds
        );
        console.log(`   ✓ Deleted ${rolesResult.affectedRows} non-admin user roles\n`);
        
        // Step 5: Delete non-admin users
        console.log('🗑️  Deleting non-admin users...');
        const [usersResult] = await connection.execute(
            `DELETE FROM users WHERE id NOT IN (${placeholders})`,
            adminIds
        );
        console.log(`   ✓ Deleted ${usersResult.affectedRows} non-admin users\n`);
        
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        
        // Final verification
        console.log('═'.repeat(60));
        console.log('✅ DATABASE CLEANUP COMPLETED!');
        console.log('═'.repeat(60));
        console.log();
        
        console.log('📊 Final Database State:');
        console.log('-'.repeat(60));
        
        const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
        console.log(`👤 Users: ${users[0].count} (admin only)`);
        
        const [userRoles] = await connection.execute('SELECT COUNT(*) as count FROM user_roles');
        console.log(`🎭 User roles: ${userRoles[0].count}`);
        
        const [roles] = await connection.execute('SELECT COUNT(*) as count FROM roles');
        console.log(`🛡️  System roles: ${roles[0].count} (preserved)`);
        
        const [positions] = await connection.execute('SELECT COUNT(*) as count FROM positions');
        console.log(`📊 Positions: ${positions[0].count}`);
        
        const [tradeHistory] = await connection.execute('SELECT COUNT(*) as count FROM trade_history');
        console.log(`📈 Trade history: ${tradeHistory[0].count}`);
        
        const [tradingAccounts] = await connection.execute('SELECT COUNT(*) as count FROM trading_accounts');
        console.log(`💼 Trading accounts: ${tradingAccounts[0].count}`);
        
        const [transactions] = await connection.execute('SELECT COUNT(*) as count FROM transactions');
        console.log(`💰 Transactions: ${transactions[0].count}`);
        
        const [symbols] = await connection.execute('SELECT COUNT(*) as count FROM symbols WHERE is_active = TRUE');
        console.log(`🎯 Active symbols: ${symbols[0].count} (preserved)`);
        
        const [categories] = await connection.execute('SELECT COUNT(*) as count FROM asset_categories');
        console.log(`📁 Asset categories: ${categories[0].count} (preserved)`);
        
        const [settings] = await connection.execute('SELECT COUNT(*) as count FROM system_settings');
        console.log(`⚙️  System settings: ${settings[0].count} (preserved)`);
        
        const [ibSettings] = await connection.execute('SELECT COUNT(*) as count FROM ib_global_settings');
        console.log(`🤝 IB global settings: ${ibSettings[0].count} (preserved)`);
        
        const [charges] = await connection.execute('SELECT COUNT(*) as count FROM trading_charges');
        console.log(`💵 Trading charges: ${charges[0].count} (preserved)`);
        
        console.log();
        console.log('🎉 Preserved System Data:');
        console.log('   ✓ All symbols and asset categories');
        console.log('   ✓ System settings and configurations');
        console.log('   ✓ Roles and permissions structure');
        console.log('   ✓ IB commission settings');
        console.log('   ✓ Trading charges configuration');
        console.log('   ✓ Admin user accounts');
        
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

cleanDatabase().catch(console.error);
