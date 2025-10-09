const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

/**
 * Database Migration Script for Enhanced Forex Trading Platform
 * This script safely applies the enhanced schema changes to the existing database
 */

async function runMigration() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pro2',
      multipleStatements: true
    });

    console.log('🔗 Connected to database successfully');
    console.log('🚀 Starting database migration...\n');

    // Step 1: Check if migrations table exists, create if not
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        migration_name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_migration_name (migration_name)
      )
    `);

    // Check if this migration has already been run
    const [existingMigrations] = await connection.execute(
      'SELECT * FROM migrations WHERE migration_name = ?',
      ['enhanced_schema_v1']
    );

    if (existingMigrations.length > 0) {
      console.log('⚠️ Migration "enhanced_schema_v1" has already been executed');
      console.log('Skipping migration to prevent duplicate changes');
      return;
    }

    // Step 2: Enhance users table with professional forex trader fields
    console.log('📝 Step 1: Enhancing users table...');
    
    // Check if columns already exist before adding them
    const [userColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
  `, [process.env.DB_NAME || 'pro2']);
    
    const existingUserColumns = userColumns.map(row => row.COLUMN_NAME);
    
    const userColumnsToAdd = [
      { name: 'country', definition: 'VARCHAR(3)' },
      { name: 'preferred_currency', definition: 'VARCHAR(3) DEFAULT "USD"' },
      { name: 'preferred_leverage', definition: 'DECIMAL(10,2) DEFAULT 100.00' },
      { name: 'phone_country_code', definition: 'VARCHAR(5)' },
      { name: 'address', definition: 'TEXT' },
      { name: 'city', definition: 'VARCHAR(100)' },
      { name: 'postal_code', definition: 'VARCHAR(20)' },
      { name: 'gender', definition: 'ENUM("male", "female", "other")' },
      { name: 'occupation', definition: 'VARCHAR(100)' },
      { name: 'experience_level', definition: 'ENUM("beginner", "intermediate", "expert") DEFAULT "beginner"' },
      { name: 'annual_income_range', definition: 'ENUM("0-25k", "25k-50k", "50k-100k", "100k-250k", "250k+")' },
      { name: 'trading_experience_years', definition: 'INT DEFAULT 0' },
      { name: 'risk_tolerance', definition: 'ENUM("low", "medium", "high") DEFAULT "medium"' },
      { name: 'investment_goals', definition: 'TEXT' }
    ];

    for (const column of userColumnsToAdd) {
      if (!existingUserColumns.includes(column.name)) {
        await connection.execute(`ALTER TABLE users ADD COLUMN ${column.name} ${column.definition}`);
        console.log(`  ✅ Added column: ${column.name}`);
      } else {
        console.log(`  ⏭️ Column already exists: ${column.name}`);
      }
    }

    // Step 3: Create API keys management system
    console.log('📝 Step 2: Creating API keys management system...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        key_name VARCHAR(100) NOT NULL,
        api_key VARCHAR(64) UNIQUE NOT NULL,
        api_secret VARCHAR(128) NOT NULL,
        permissions JSON NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        last_used_at TIMESTAMP NULL,
        expires_at TIMESTAMP NULL,
        usage_count INT DEFAULT 0,
        rate_limit_per_hour INT DEFAULT 1000,
        ip_whitelist JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_api_key (api_key),
        INDEX idx_active (is_active),
        INDEX idx_expires_at (expires_at)
      )
    `);
    console.log('  ✅ Created api_keys table');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS api_usage_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        api_key_id INT NOT NULL,
        endpoint VARCHAR(200) NOT NULL,
        method ENUM('GET', 'POST', 'PUT', 'DELETE', 'PATCH') NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        request_data JSON,
        response_status INT,
        response_time_ms INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
        INDEX idx_api_key_id (api_key_id),
        INDEX idx_created_at (created_at),
        INDEX idx_endpoint (endpoint)
      )
    `);
    console.log('  ✅ Created api_usage_logs table');

    // Step 4: Create Introducing Broker system
    console.log('📝 Step 3: Creating Introducing Broker system...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS introducing_brokers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        ib_user_id INT NOT NULL,
        client_user_id INT NOT NULL,
        referral_code VARCHAR(20) UNIQUE NOT NULL,
        commission_rate DECIMAL(5,4) DEFAULT 0.0070,
        status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
        tier_level ENUM('bronze', 'silver', 'gold', 'platinum') DEFAULT 'bronze',
        total_commission_earned DECIMAL(15,4) DEFAULT 0.0000,
        total_client_volume DECIMAL(15,4) DEFAULT 0.0000,
        active_clients_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (ib_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (client_user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_ib_user (ib_user_id),
        INDEX idx_client_user (client_user_id),
        INDEX idx_referral_code (referral_code),
        INDEX idx_status (status),
        UNIQUE KEY unique_ib_client (ib_user_id, client_user_id)
      )
    `);
    console.log('  ✅ Created introducing_brokers table');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ib_commissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        ib_relationship_id INT NOT NULL,
        trade_id INT,
        position_id INT,
        commission_amount DECIMAL(15,4) NOT NULL,
        commission_rate DECIMAL(5,4) NOT NULL,
        trade_volume DECIMAL(15,4),
        currency VARCHAR(3) DEFAULT 'USD',
        paid_at TIMESTAMP NULL,
        status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
        payment_method ENUM('account_credit', 'bank_transfer', 'check') DEFAULT 'account_credit',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (ib_relationship_id) REFERENCES introducing_brokers(id) ON DELETE CASCADE,
        INDEX idx_ib_relationship (ib_relationship_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        INDEX idx_paid_at (paid_at)
      )
    `);
    console.log('  ✅ Created ib_commissions table');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        code VARCHAR(20) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        usage_count INT DEFAULT 0,
        max_usage INT DEFAULT NULL,
        expires_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_code (code),
        INDEX idx_active (is_active)
      )
    `);
    console.log('  ✅ Created referral_codes table');

    // Step 5: Create trading charges system
    console.log('📝 Step 4: Creating trading charges system...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS trading_charges (
        id INT PRIMARY KEY AUTO_INCREMENT,
        symbol_id INT,
        account_type ENUM('demo', 'live', 'islamic') DEFAULT 'live',
        charge_type ENUM('commission', 'spread_markup', 'swap_long', 'swap_short') NOT NULL,
        charge_value DECIMAL(10,4) NOT NULL,
        charge_unit ENUM('per_lot', 'percentage', 'fixed', 'pips') NOT NULL,
        tier_level ENUM('standard', 'gold', 'platinum', 'vip') DEFAULT 'standard',
        is_active BOOLEAN DEFAULT TRUE,
        effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        effective_until TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
        INDEX idx_symbol (symbol_id),
        INDEX idx_type (charge_type),
        INDEX idx_tier (tier_level),
        INDEX idx_active (is_active),
        INDEX idx_effective (effective_from, effective_until)
      )
    `);
    console.log('  ✅ Created trading_charges table');

    // Step 6: Create payment gateway system
    console.log('📝 Step 5: Creating payment gateway system...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS payment_gateways (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        type ENUM('bank_transfer', 'credit_card', 'debit_card', 'crypto', 'e_wallet', 'wire_transfer') NOT NULL,
        provider VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        min_amount DECIMAL(15,4) DEFAULT 0.0000,
        max_amount DECIMAL(15,4) DEFAULT 999999.9999,
        processing_fee_type ENUM('fixed', 'percentage') DEFAULT 'percentage',
        processing_fee_value DECIMAL(10,4) DEFAULT 0.0000,
        processing_time_hours INT DEFAULT 24,
        supported_currencies JSON,
        configuration JSON,
        sort_order INT DEFAULT 0,
        icon_url VARCHAR(500),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_name (name),
        INDEX idx_type (type),
        INDEX idx_active (is_active),
        INDEX idx_sort_order (sort_order)
      )
    `);
    console.log('  ✅ Created payment_gateways table');

    // Step 7: Enhance transactions table
    console.log('📝 Step 6: Enhancing transactions table...');
    
    // Check existing transaction columns
    const [transactionColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'transactions'
    `, [process.env.DB_NAME || 'pro2']);
    
    const existingTransactionColumns = transactionColumns.map(row => row.COLUMN_NAME);
    
    const transactionColumnsToAdd = [
      { name: 'payment_gateway_id', definition: 'INT' },
      { name: 'transaction_fee', definition: 'DECIMAL(15,4) DEFAULT 0.0000' },
      { name: 'exchange_rate', definition: 'DECIMAL(12,6) DEFAULT 1.000000' },
      { name: 'reference_number', definition: 'VARCHAR(100)' },
      { name: 'external_transaction_id', definition: 'VARCHAR(200)' },
      { name: 'admin_notes', definition: 'TEXT' },
      { name: 'processed_by', definition: 'INT' },
      { name: 'processed_at', definition: 'TIMESTAMP NULL' },
      { name: 'batch_id', definition: 'INT' },
      { name: 'priority', definition: 'ENUM("low", "normal", "high", "urgent") DEFAULT "normal"' },
      { name: 'notification_sent', definition: 'BOOLEAN DEFAULT FALSE' }
    ];

    for (const column of transactionColumnsToAdd) {
      if (!existingTransactionColumns.includes(column.name)) {
        await connection.execute(`ALTER TABLE transactions ADD COLUMN ${column.name} ${column.definition}`);
        console.log(`  ✅ Added column: ${column.name}`);
      } else {
        console.log(`  ⏭️ Column already exists: ${column.name}`);
      }
    }

    // Add foreign key constraints if they don't exist
    try {
      if (!existingTransactionColumns.includes('payment_gateway_id')) {
        await connection.execute(`
          ALTER TABLE transactions 
          ADD FOREIGN KEY (payment_gateway_id) REFERENCES payment_gateways(id)
        `);
        console.log('  ✅ Added payment_gateway_id foreign key');
      }
      
      if (!existingTransactionColumns.includes('processed_by')) {
        await connection.execute(`
          ALTER TABLE transactions 
          ADD FOREIGN KEY (processed_by) REFERENCES users(id)
        `);
        console.log('  ✅ Added processed_by foreign key');
      }
    } catch (error) {
      console.log('  ⚠️ Foreign key constraints may already exist');
    }

    // Step 8: Create admin management tables
    console.log('📝 Step 7: Creating admin management system...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admin_actions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        admin_user_id INT NOT NULL,
        action_type ENUM('user_suspend', 'user_activate', 'user_lock', 'user_unlock', 'balance_adjustment', 'transaction_approve', 'transaction_reject', 'settings_change') NOT NULL,
        target_user_id INT,
        target_table VARCHAR(50),
        target_record_id INT,
        action_data JSON,
        reason TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_admin_user (admin_user_id),
        INDEX idx_target_user (target_user_id),
        INDEX idx_action_type (action_type),
        INDEX idx_created_at (created_at)
      )
    `);
    console.log('  ✅ Created admin_actions table');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        ticket_number VARCHAR(20) UNIQUE NOT NULL,
        category ENUM('account', 'trading', 'deposit', 'withdrawal', 'technical', 'general') NOT NULL,
        priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
        status ENUM('open', 'in_progress', 'waiting_user', 'resolved', 'closed') DEFAULT 'open',
        subject VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        assigned_to INT,
        resolved_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_ticket_number (ticket_number),
        INDEX idx_status (status),
        INDEX idx_assigned_to (assigned_to),
        INDEX idx_created_at (created_at)
      )
    `);
    console.log('  ✅ Created support_tickets table');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS support_ticket_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        ticket_id INT NOT NULL,
        sender_id INT NOT NULL,
        message TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT FALSE,
        attachments JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_ticket_id (ticket_id),
        INDEX idx_sender_id (sender_id),
        INDEX idx_created_at (created_at)
      )
    `);
    console.log('  ✅ Created support_ticket_messages table');

    // Step 9: Create system settings table
    console.log('📝 Step 8: Creating system settings...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
        category VARCHAR(50) DEFAULT 'general',
        description TEXT,
        is_public BOOLEAN DEFAULT FALSE,
        updated_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_setting_key (setting_key),
        INDEX idx_category (category),
        INDEX idx_public (is_public)
      )
    `);
    console.log('  ✅ Created system_settings table');

    // Step 10: Insert default data
    console.log('📝 Step 9: Inserting default data...');
    
    // Insert default payment gateways
    await connection.execute(`
      INSERT IGNORE INTO payment_gateways (name, display_name, type, is_active, min_amount, max_amount, processing_fee_type, processing_fee_value, processing_time_hours, supported_currencies, description) VALUES
      ('bank_transfer', 'Bank Transfer', 'bank_transfer', TRUE, 100.00, 50000.00, 'fixed', 0.00, 24, '["USD", "EUR", "GBP"]', 'Secure bank wire transfer'),
      ('credit_card', 'Credit Card', 'credit_card', TRUE, 50.00, 5000.00, 'percentage', 2.50, 1, '["USD", "EUR", "GBP"]', 'Instant credit card deposits'),
      ('debit_card', 'Debit Card', 'debit_card', TRUE, 50.00, 5000.00, 'percentage', 2.00, 1, '["USD", "EUR", "GBP"]', 'Instant debit card deposits'),
      ('crypto_btc', 'Bitcoin', 'crypto', TRUE, 100.00, 10000.00, 'percentage', 1.00, 6, '["USD", "EUR", "GBP"]', 'Bitcoin cryptocurrency deposits'),
      ('paypal', 'PayPal', 'e_wallet', TRUE, 25.00, 2500.00, 'percentage', 3.00, 2, '["USD", "EUR", "GBP"]', 'PayPal e-wallet transfers')
    `);
    console.log('  ✅ Inserted default payment gateways');

    // Insert default system settings
    await connection.execute(`
      INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_type, category, description, is_public) VALUES
      ('site_name', 'ForexTrade Pro', 'string', 'general', 'Website name', TRUE),
      ('default_leverage', '100', 'number', 'trading', 'Default leverage for new accounts', FALSE),
      ('max_leverage', '500', 'number', 'trading', 'Maximum allowed leverage', FALSE),
      ('min_deposit', '100', 'number', 'financial', 'Minimum deposit amount', TRUE),
      ('max_daily_withdrawal', '10000', 'number', 'financial', 'Maximum daily withdrawal limit', FALSE),
      ('commission_rate_standard', '7.00', 'number', 'trading', 'Standard commission rate per lot', FALSE),
      ('ib_default_commission', '0.70', 'number', 'ib', 'Default IB commission rate', FALSE)
    `);
    console.log('  ✅ Inserted default system settings');

    // Step 11: Create performance indexes
    console.log('📝 Step 10: Creating performance indexes...');
    
    const indexes = [
      'CREATE INDEX idx_positions_user_status ON positions(user_id, status)',
      'CREATE INDEX idx_positions_account_status ON positions(account_id, status)',
      'CREATE INDEX idx_trade_history_user_date ON trade_history(user_id, created_at)',
      'CREATE INDEX idx_trade_history_account_date ON trade_history(account_id, created_at)',
      'CREATE INDEX idx_transactions_user_status ON transactions(user_id, status)',
      'CREATE INDEX idx_transactions_type_status ON transactions(transaction_type, status)',
      'CREATE INDEX idx_users_status_created ON users(status, created_at)',
      'CREATE INDEX idx_trading_accounts_user_status ON trading_accounts(user_id, status)',
      'CREATE INDEX idx_market_prices_symbol_timestamp ON market_prices(symbol_id, timestamp)'
    ];

    for (const indexQuery of indexes) {
      try {
        await connection.execute(indexQuery);
        console.log(`  ✅ Created index: ${indexQuery.split(' ')[2]}`);
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`  ⏭️ Index already exists: ${indexQuery.split(' ')[2]}`);
        } else {
          console.log(`  ⚠️ Error creating index: ${error.message}`);
        }
      }
    }

    // Record migration as completed
    await connection.execute(
      'INSERT INTO migrations (migration_name) VALUES (?)',
      ['enhanced_schema_v1']
    );

    console.log('\n✅ Migration completed successfully!');
    console.log('🎉 Your forex trading platform database has been enhanced with:');
    console.log('   • Professional user registration fields');
    console.log('   • API key management system');
    console.log('   • Introducing Broker (referral) system');
    console.log('   • Trading charges and commission tracking');
    console.log('   • Payment gateway management');
    console.log('   • Enhanced transaction processing');
    console.log('   • Admin management tools');
    console.log('   • Support ticket system');
    console.log('   • System configuration management');
    console.log('   • Performance optimized indexes');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔐 Database connection closed');
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };