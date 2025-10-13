// reset-db.js
// A script to truncate and seed the database.

const mysql = require('mysql2/promise');

// --- Database Configuration ---
// These are the default settings for a local XAMPP installation.
const dbConfig = {
    host: 'localhost',
    user: 'root',      // Default XAMPP username
    password: '',      // As requested, no password
    database: 'pro2',
};

// --- List of tables to be truncated ---
// This list is derived from your SQL script.
const tablesToTruncate = [
    // Core authentication and user metadata
    'user_roles', 'users', 'roles', 'user_addresses', 'user_settings',
    'user_documents', 'user_sessions', 'user_login_history',

    // Trading and financial activity
    'trading_accounts', 'account_balance_history', 'orders', 'positions',
    'trade_history', 'trades', 'transactions', 'deposits', 'withdrawals',
    'payment_methods', 'price_alerts',

    // API, audit, and admin subsystems
    'api_keys', 'api_usage_logs', 'admin_actions', 'system_logs',

    // Notifications and support
    'notifications', 'user_notifications', 'support_categories', 'support_tickets',
    'support_responses', 'support_messages',

    // Introducing broker and referral program
    'introducing_brokers', 'introducing_broker_partners', 'introducing_broker_clients',
    'ib_commissions', 'ib_applications', 'ib_commission_payouts',

    // MAM/PAMM or copy-trading
    'mam_accounts', 'pamm_accounts', 'investor_accounts', 'mam_pamm_masters',
    'mam_pamm_investors', 'mam_pamm_performance'
];


// --- Main execution function ---
async function resetAndSeedDatabase() {
    let connection;
    console.log('🚀 Starting database reset and seed process...');

    try {
        // Establish connection to the database
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Database connection successful.');

        // 1. Disable Foreign Key Checks
        console.log('Temporarily disabling foreign key checks...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

        // 2. Truncate all specified tables
        console.log('Truncating tables...');
        for (const tableName of tablesToTruncate) {
            try {
                await connection.query(`TRUNCATE TABLE \`${tableName}\``);
                console.log(`  - Table truncated: ${tableName}`);
            } catch (error) {
                // Safely handle cases where a table might not exist
                if (error.code === 'ER_NO_SUCH_TABLE') {
                    console.warn(`  - Table not found, skipping: ${tableName}`);
                } else {
                    throw error; // Rethrow other errors
                }
            }
        }
        console.log('✅ All specified tables have been truncated.');

        // Start a transaction for seeding to ensure atomicity
        await connection.beginTransaction();

        // 3. Seed baseline roles
        console.log('Seeding baseline roles...');
        const rolesSql = `
            INSERT INTO roles (name, description, is_admin)
            VALUES
                ('Super Admin', 'Full system administrator with all permissions', TRUE),
                ('Admin', 'Standard administrator with elevated permissions', TRUE),
                ('Manager', 'Back-office manager level access', FALSE),
                ('Trader', 'Regular trading user', FALSE)
            ON DUPLICATE KEY UPDATE
                description = VALUES(description), is_admin = VALUES(is_admin);
        `;
        await connection.query(rolesSql);

        // 4. Seed super admin user (password: admin123)
        console.log('Seeding super admin user...');
        const adminUserSql = `
            INSERT INTO users (
                email, password_hash, first_name, last_name, status,
                email_verified, phone_verified, kyc_status, created_at, updated_at
            ) VALUES (
                'admin@tradingplatform.com',
                '$2a$10$zWQbYqHxLchM8D6Iw.dhfe8W96o4KAGHLKcJySq00O3hPKJGlPoMq',
                'System', 'Administrator', 'active', TRUE, TRUE, 'approved', NOW(), NOW()
            ) ON DUPLICATE KEY UPDATE
                password_hash = VALUES(password_hash), status = VALUES(status), updated_at = NOW();
        `;
        await connection.query(adminUserSql);

        // 5. Get IDs of the newly created admin and role
        const [[adminUser]] = await connection.query("SELECT id FROM users WHERE email = 'admin@tradingplatform.com' LIMIT 1");
        const [[superAdminRole]] = await connection.query("SELECT id FROM roles WHERE name = 'Super Admin' LIMIT 1");
        if (!adminUser || !superAdminRole) {
            throw new Error('Failed to retrieve admin user or super admin role IDs.');
        }
        const adminUserId = adminUser.id;
        const superAdminRoleId = superAdminRole.id;

        // 6. Assign Super Admin role to the user
        console.log(`Assigning role ID ${superAdminRoleId} to user ID ${adminUserId}...`);
        const userRoleSql = `
            INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by)
            VALUES (?, ?, NOW(), ?)
            ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);
        `;
        await connection.query(userRoleSql, [adminUserId, superAdminRoleId, adminUserId]);

        // 7. Create a primary live trading account for the admin
        console.log('Creating trading account for admin...');
        const tradingAccountSql = `
            INSERT INTO trading_accounts (
                user_id, account_number, account_type, currency, leverage, balance,
                equity, free_margin, margin_level, status, created_at, updated_at
            ) VALUES (
                ?, CONCAT('ADM', LPAD(?, 6, '0')), 'live', 'USD', 500.00, 100000.00,
                100000.00, 100000.00, 0.00, 'active', NOW(), NOW()
            ) ON DUPLICATE KEY UPDATE
                balance = VALUES(balance), equity = VALUES(equity), status = VALUES(status), updated_at = NOW();
        `;
        await connection.query(tradingAccountSql, [adminUserId, adminUserId]);

        // 8. Get the ID of the new trading account
        const [[adminAccount]] = await connection.query("SELECT id FROM trading_accounts WHERE user_id = ? ORDER BY id ASC LIMIT 1", [adminUserId]);
        if (!adminAccount) {
            throw new Error('Failed to retrieve admin trading account ID.');
        }
        const adminAccountId = adminAccount.id;

        // 9. Record baseline account balance history
        console.log('Recording initial account balance history...');
        const balanceHistorySql = `
            INSERT INTO account_balance_history (
                account_id, previous_balance, new_balance, change_amount, change_type,
                change_context, performed_by_type, performed_by_id, created_at, notes
            ) VALUES (
                ?, 0.00, 100000.00, 100000.00, 'manual_credit', 'adjustment',
                'admin', ?, NOW(), 'Initial admin account funding after database reset'
            ) ON DUPLICATE KEY UPDATE
                new_balance = VALUES(new_balance), change_amount = VALUES(change_amount);
        `;
        await connection.query(balanceHistorySql, [adminAccountId, adminUserId]);

        // If everything was successful, commit the changes
        await connection.commit();
        console.log('✅ Database seeding transaction committed successfully.');

    } catch (error) {
        console.error('\n❌ An error occurred during the process:', error);
        // If an error occurs, roll back any changes made during the transaction
        if (connection) {
            console.log('Rolling back transaction...');
            await connection.rollback();
        }
        process.exit(1); // Exit with an error code
    } finally {
        // 10. Re-enable Foreign Key Checks, regardless of success or failure
        if (connection) {
            console.log('Re-enabling foreign key checks...');
            await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
            await connection.end();
            console.log('Database connection closed.');
        }
    }

    // --- Final Summary ---
    console.log('\n-----------------------------------------------');
    console.log('✅ Database reset and seed completed successfully!');
    console.log('-----------------------------------------------\n');
}

// Execute the main function
resetAndSeedDatabase();