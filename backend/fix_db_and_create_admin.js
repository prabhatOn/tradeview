const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixDatabaseAndCreateAdmin() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'pro2'
        });

        console.log('🔧 Fixing database schema and creating admin user...\n');

        // Step 1: Fix trading_accounts.account_type enum to include 'standard'
        console.log('1. Fixing trading_accounts.account_type enum...');
        await connection.execute(`
            ALTER TABLE trading_accounts 
            MODIFY COLUMN account_type ENUM('demo','live','islamic','standard') NOT NULL
        `);
        console.log('   ✅ Added "standard" to account_type enum values');

        // Step 2: Clear existing data and reset auto increments
        console.log('\n2. Clearing existing data...');
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        
        const tablesToClear = ['users', 'user_roles', 'trading_accounts', 'account_balance_history'];
        for (const table of tablesToClear) {
            await connection.execute(`TRUNCATE TABLE ${table}`);
            console.log(`   ✅ Cleared ${table}`);
        }
        
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

        // Step 3: Create admin user
        console.log('\n3. Creating admin user...');
        // Password 'admin123' hashed with bcrypt
        const [userResult] = await connection.execute(`
            INSERT INTO users (
                email, password_hash, first_name, last_name, phone, country,
                preferred_currency, preferred_leverage, status, email_verified,
                phone_verified, kyc_status, experience_level, risk_tolerance
            ) VALUES (
                'admin@tradingplatform.com',
                '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
                'System', 'Administrator', '+1-555-0123', 'US',
                'USD', 500.00, 'active', TRUE,
                TRUE, 'approved', 'expert', 'medium'
            )
        `);
        
        const adminUserId = userResult.insertId;
        console.log(`   ✅ Admin user created with ID: ${adminUserId}`);

        // Step 4: Assign Super Admin role
        await connection.execute(`
            INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (?, 1, ?)
        `, [adminUserId, adminUserId]);
        console.log('   ✅ Super Admin role assigned');

        // Step 5: Create admin trading account with 'standard' type
        console.log('\n4. Creating admin trading account...');
        const accountNumber = `ADM${adminUserId.toString().padStart(6, '0')}`;
        const [accountResult] = await connection.execute(`
            INSERT INTO trading_accounts (
                user_id, account_number, account_type, balance, currency,
                leverage, margin_level, equity, free_margin, status
            ) VALUES (?, ?, 'standard', 100000.00, 'USD', 500.00, 0.00, 100000.00, 100000.00, 'active')
        `, [adminUserId, accountNumber]);
        
        const accountId = accountResult.insertId;
        console.log(`   ✅ Trading account created: ${accountNumber} (ID: ${accountId})`);

        // Step 6: Create balance history entry
        await connection.execute(`
            INSERT INTO account_balance_history (
                account_id, previous_balance, new_balance, change_amount, 
                change_type, notes
            ) VALUES (?, 0.00, 100000.00, 100000.00, 'deposit', 'Initial admin account funding')
        `, [accountId]);
        console.log('   ✅ Balance history initialized');

        // Step 7: Verification
        console.log('\n5. Verifying admin user setup...');
        const [adminUser] = await connection.execute(`
            SELECT 
                u.id, u.email, u.first_name, u.last_name, u.status,
                r.name as role_name, ta.account_number, ta.account_type, ta.balance
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN trading_accounts ta ON u.id = ta.user_id
            WHERE u.email = 'admin@tradingplatform.com'
        `);
        
        if (adminUser.length > 0) {
            const admin = adminUser[0];
            console.log('✅ Admin user verification successful:');
            console.log(`   👤 User: ${admin.first_name} ${admin.last_name} (ID: ${admin.id})`);
            console.log(`   📧 Email: ${admin.email}`);
            console.log(`   🔐 Role: ${admin.role_name}`);
            console.log(`   💳 Account: ${admin.account_number} (${admin.account_type})`);
            console.log(`   💰 Balance: $${admin.balance}`);
            console.log(`   📊 Status: ${admin.status}`);
        } else {
            throw new Error('Admin user verification failed!');
        }

        // Step 8: Check balance history
        const [balanceHistory] = await connection.execute(`
            SELECT * FROM account_balance_history WHERE account_id = ? ORDER BY created_at DESC LIMIT 1
        `, [accountId]);
        
        if (balanceHistory.length > 0) {
            const history = balanceHistory[0];
            console.log(`   📈 Balance History: ${history.change_type} of $${history.change_amount} - ${history.notes}`);
        }

        console.log('\n🎉 Database fix and admin setup completed successfully!');
        console.log('\n🔐 Admin Login Credentials:');
        console.log('   📧 Email: admin@tradingplatform.com');
        console.log('   🔑 Password: admin123');
        console.log('\n⚠️  IMPORTANT: Change the admin password after first login!');

        // Final summary
        const [userCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
        const [accountCount] = await connection.execute('SELECT COUNT(*) as count FROM trading_accounts');
        const [historyCount] = await connection.execute('SELECT COUNT(*) as count FROM account_balance_history');
        
        console.log('\n📊 Database Summary:');
        console.log(`   👥 Users: ${userCount[0].count}`);
        console.log(`   💳 Trading Accounts: ${accountCount[0].count}`);
        console.log(`   📈 Balance History Records: ${historyCount[0].count}`);

    } catch (error) {
        console.error('❌ Error fixing database:', error.message);
        
        if (error.code === 'ER_TRUNCATED_WRONG_VALUE') {
            console.error('💡 Solution: Check enum values and data types');
        } else if (error.code === 'ER_DUP_ENTRY') {
            console.error('💡 Solution: Admin user may already exist');
        }
        
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

fixDatabaseAndCreateAdmin();