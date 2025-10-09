const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Database configuration from environment
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pro2',
  multipleStatements: true
};

async function cleanupAndSeedDatabase() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    console.log('   Host:', dbConfig.host);
    console.log('   Database:', dbConfig.database);
    console.log('   User:', dbConfig.user);
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    console.log('');
    console.log('⚠️  WARNING: This will DELETE ALL user data permanently!');
    console.log('⚠️  All users, trading accounts, positions, and transactions will be removed!');
    console.log('⚠️  This action cannot be undone!');
    console.log('');
    
    console.log('🔄 Starting database cleanup...');
    
    // Step 1: Disable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    console.log('   ✓ Foreign key checks disabled');
    
    // Step 2: Get list of tables to truncate
    const tablesToTruncate = [
      'users', 'user_roles', 'roles', 'trading_accounts', 'positions', 'trades', 
      'trade_history', 'balance_history', 'api_keys', 'api_usage_logs',
      'introducing_brokers', 'ib_commissions', 'ib_applications', 'transactions',
      'deposits', 'withdrawals', 'payment_methods', 'notifications', 
      'support_tickets', 'support_messages', 'user_documents', 'user_sessions',
      'user_login_history', 'mam_accounts', 'pamm_accounts', 'investor_accounts',
      'admin_actions', 'system_logs'
    ];
    
    // Truncate tables (only those that exist)
    let truncatedCount = 0;
    for (const table of tablesToTruncate) {
      try {
        await connection.execute(`TRUNCATE TABLE ${table}`);
        console.log(`   ✓ Truncated table: ${table}`);
        truncatedCount++;
      } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
          console.log(`   - Table doesn't exist: ${table} (skipping)`);
        } else {
          console.log(`   ! Error truncating ${table}:`, error.message);
        }
      }
    }
    
    console.log(`   ✓ Truncated ${truncatedCount} tables`);
    
    // Step 3: Re-enable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('   ✓ Foreign key checks re-enabled');
    
    console.log('🔄 Creating default roles...');
    
    // Step 4: Create default roles
    await connection.execute(`
      INSERT INTO roles (name, description, is_admin) VALUES
      ('Super Admin', 'Full system administrator with all permissions', TRUE),
      ('Admin', 'System administrator with most permissions', TRUE),
      ('Manager', 'Account manager with limited admin permissions', FALSE),
      ('IB', 'Introducing Broker with referral permissions', FALSE),
      ('Trader', 'Regular trading user', FALSE),
      ('Viewer', 'Read-only access user', FALSE)
    `);
    console.log('   ✓ Default roles created');
    
    console.log('🔄 Creating admin user...');
    
    // Step 5: Create admin user
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
    console.log(`   ✓ Admin user created with ID: ${adminUserId}`);
    
    // Step 6: Assign Super Admin role
    await connection.execute(`
      INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (?, 1, ?)
    `, [adminUserId, adminUserId]);
    console.log('   ✓ Super Admin role assigned');
    
    console.log('🔄 Creating admin trading account...');
    
    // Step 7: Create admin trading account
    const accountNumber = `ADM${adminUserId.toString().padStart(6, '0')}`;
    const [accountResult] = await connection.execute(`
      INSERT INTO trading_accounts (
        user_id, account_number, account_type, balance, currency,
        leverage, margin_level, equity, free_margin, status
      ) VALUES (?, ?, 'standard', 100000.00, 'USD', 500.00, 0.00, 100000.00, 100000.00, 'active')
    `, [adminUserId, accountNumber]);
    
    const accountId = accountResult.insertId;
    console.log(`   ✓ Trading account created: ${accountNumber}`);
    
    // Step 8: Create balance history entry
    await connection.execute(`
      INSERT INTO balance_history (
        account_id, user_id, change_amount, change_type,
        previous_balance, new_balance, notes
      ) VALUES (?, ?, 100000.00, 'deposit', 0.00, 100000.00, 'Initial admin account funding')
    `, [accountId, adminUserId]);
    console.log('   ✓ Balance history initialized');
    
    console.log('🔍 Verifying admin user creation...');
    
    // Verification
    const [adminUser] = await connection.execute(`
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.status,
        r.name as role_name, ta.account_number, ta.balance
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      LEFT JOIN trading_accounts ta ON u.id = ta.user_id
      WHERE u.email = 'admin@tradingplatform.com'
    `);
    
    if (adminUser.length > 0) {
      const admin = adminUser[0];
      console.log('✅ Admin user verified successfully:');
      console.log(`   ID: ${admin.id}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Name: ${admin.first_name} ${admin.last_name}`);
      console.log(`   Role: ${admin.role_name}`);
      console.log(`   Account: ${admin.account_number}`);
      console.log(`   Balance: $${admin.balance}`);
    } else {
      throw new Error('Admin user verification failed!');
    }
    
    // Final count
    const [userCount] = await connection.execute('SELECT COUNT(*) as total FROM users');
    console.log(`📊 Total users in database: ${userCount[0].total}`);
    
    console.log('');
    console.log('🎉 Database cleanup and admin seeding completed successfully!');
    console.log('');
    console.log('🔐 Admin Login Credentials:');
    console.log('   Email: admin@tradingplatform.com');
    console.log('   Password: admin123');
    console.log('');
    console.log('⚠️  IMPORTANT: Please change the admin password after first login!');
    
  } catch (error) {
    console.error('❌ Error during database cleanup and seeding:', error);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Solution: Make sure MySQL server is running');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('💡 Solution: Check database credentials in .env file');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('💡 Solution: Create the database first or check DB_NAME in .env');
    }
    
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Execute the cleanup and seeding
if (require.main === module) {
  cleanupAndSeedDatabase()
    .then(() => {
      console.log('');
      console.log('✨ Process completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('');
      console.error('💥 Process failed:', error.message);
      process.exit(1);
    });
}

module.exports = { cleanupAndSeedDatabase };