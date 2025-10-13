/*
 * cleanup_and_seed_admin.js
 * ------------------------------------------------------------
 * Node.js helper that mirrors the SQL cleanup script using mysql2.
 * It truncates user-generated tables (if present) and reseeds a super
 * admin account with a funded trading account.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const mysql = require('mysql2/promise');

// Default connection settings (align with backend/config/database.js)
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pro2',
};

// Tables to truncate. Missing tables are skipped gracefully.
const tablesToTruncate = [
  // Core authentication and user metadata
  'user_roles',
  'users',
  'roles',
  'user_addresses',
  'user_settings',
  'user_documents',
  'user_sessions',
  'user_login_history',

  // Trading and financial activity
  'trading_accounts',
  'account_balance_history',
  'orders',
  'positions',
  'trade_history',
  'trades',
  'transactions',
  'deposits',
  'withdrawals',
  'payment_methods',
  'price_alerts',

  // API, audit, and admin subsystems
  'api_keys',
  'api_usage_logs',
  'admin_actions',
  'system_logs',

  // Notifications and support
  'notifications',
  'user_notifications',
  'support_categories',
  'support_tickets',
  'support_responses',
  'support_messages',

  // Introducing broker and referral program
  'introducing_brokers',
  'introducing_broker_partners',
  'introducing_broker_clients',
  'ib_commissions',
  'ib_applications',
  'ib_commission_payouts',

  // MAM/PAMM or copy-trading
  'mam_accounts',
  'pamm_accounts',
  'investor_accounts',
  'mam_pamm_masters',
  'mam_pamm_investors',
  'mam_pamm_performance',
];

async function truncateTables(connection) {
  console.log('🧹 Truncating user-generated tables...');

  for (const tableName of tablesToTruncate) {
    try {
      await connection.query(`TRUNCATE TABLE \`${tableName}\``);
      console.log(`  • ${tableName}`);
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log(`  • ${tableName} (skipped, table not found)`);
      } else {
        throw error;
      }
    }
  }
}

async function seedBaselineData(connection) {
  console.log('🌱 Seeding baseline roles and admin user...');

  // Insert core roles (matches current schema: id, name, description, is_admin, created_at)
  await connection.query(`
    INSERT INTO roles (name, description, is_admin)
    VALUES
      ('Super Admin', 'Full system administrator with all permissions', TRUE),
      ('Admin', 'Standard administrator with elevated permissions', TRUE),
      ('Manager', 'Back-office manager level access', FALSE),
      ('Trader', 'Regular trading user', FALSE)
    ON DUPLICATE KEY UPDATE
      description = VALUES(description),
      is_admin = VALUES(is_admin);
  `);

  // Create or refresh a super admin user (match existing columns; optional fields omitted)
  await connection.query(`
    INSERT INTO users (
      email,
      password_hash,
      first_name,
      last_name,
      status,
      email_verified,
      phone_verified,
      kyc_status,
      created_at,
      updated_at
    ) VALUES (
      'admin@tradingplatform.com',
  '$2a$10$zWQbYqHxLchM8D6Iw.dhfe8W96o4KAGHLKcJySq00O3hPKJGlPoMq',
      'System',
      'Administrator',
      'active',
      TRUE,
      TRUE,
      'approved',
      NOW(),
      NOW()
    ) ON DUPLICATE KEY UPDATE
      password_hash = VALUES(password_hash),
      status = VALUES(status),
      email_verified = VALUES(email_verified),
      phone_verified = VALUES(phone_verified),
      kyc_status = VALUES(kyc_status),
      updated_at = NOW();
  `);

  const [[adminUser]] = await connection.query(
    "SELECT id FROM users WHERE email = 'admin@tradingplatform.com' LIMIT 1"
  );
  const [[superAdminRole]] = await connection.query(
    "SELECT id FROM roles WHERE name = 'Super Admin' LIMIT 1"
  );
  const [[adminRole]] = await connection.query(
    "SELECT id FROM roles WHERE name = 'Admin' LIMIT 1"
  );

  if (!adminUser || !superAdminRole || !adminRole) {
    throw new Error('Failed to retrieve admin user or admin roles.');
  }

  const adminUserId = adminUser.id;
  const superAdminRoleId = superAdminRole.id;
  const adminRoleId = adminRole.id;

  await connection.query(
    `INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by)
     VALUES (?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       role_id = VALUES(role_id),
       assigned_at = NOW(),
       assigned_by = VALUES(assigned_by);`,
    [adminUserId, superAdminRoleId, adminUserId]
  );

  await connection.query(
    `INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by)
     VALUES (?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       role_id = VALUES(role_id),
       assigned_at = NOW(),
       assigned_by = VALUES(assigned_by);`,
    [adminUserId, adminRoleId, adminUserId]
  );

  await connection.query(
    `INSERT INTO trading_accounts (
        user_id,
        account_number,
        account_type,
        currency,
        leverage,
        balance,
        equity,
        free_margin,
        margin_level,
        status,
        created_at,
        updated_at
      ) VALUES (
        ?,
        CONCAT('ADM', LPAD(?, 6, '0')),
        'live',
        'USD',
        500.00,
        100000.00,
        100000.00,
        100000.00,
        0.00,
        'active',
        NOW(),
        NOW()
      ) ON DUPLICATE KEY UPDATE
        balance = VALUES(balance),
        equity = VALUES(equity),
        free_margin = VALUES(free_margin),
        margin_level = VALUES(margin_level),
        status = VALUES(status),
        updated_at = NOW();`,
    [adminUserId, adminUserId]
  );

  const [[adminAccount]] = await connection.query(
    'SELECT id FROM trading_accounts WHERE user_id = ? ORDER BY id ASC LIMIT 1',
    [adminUserId]
  );

  if (!adminAccount) {
    throw new Error('Failed to locate admin trading account.');
  }

  const adminAccountId = adminAccount.id;

  // account_balance_history in this schema lacks change_context/performed_by columns
  await connection.query(
    'DELETE FROM account_balance_history WHERE account_id = ?',
    [adminAccountId]
  );

  await connection.query(
    `INSERT INTO account_balance_history (
        account_id,
        previous_balance,
        new_balance,
        change_amount,
        change_type,
        reference_id,
        reference_type,
        notes,
        created_at
      ) VALUES (?, 0.00, 100000.00, 100000.00, 'deposit', NULL, NULL,
        'Initial admin account funding after database reset', NOW());`,
    [adminAccountId]
  );

  return { adminUserId, adminAccountId };
}

async function main() {
  let connection;

  try {
    console.log('🚀 Connecting to MySQL…');
    connection = await mysql.createConnection(dbConfig);

    console.log('🚫 Disabling foreign key checks');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

    await truncateTables(connection);

    console.log('💾 Starting seed transaction');
    await connection.beginTransaction();

    const { adminUserId, adminAccountId } = await seedBaselineData(connection);

    await connection.commit();
    console.log('✅ Seed transaction committed');

    console.log('\nSummary');
    console.log('-------');
    console.log(`Admin user ID: ${adminUserId}`);
    console.log(`Admin account ID: ${adminAccountId}`);
  } catch (error) {
    console.error('\n❌ Error during cleanup/seed:', error.message);
    if (connection) {
      try {
        await connection.rollback();
        console.error('↩️ Transaction rolled back');
      } catch (rollbackError) {
        console.error('⚠️ Rollback failed:', rollbackError.message);
      }
    }
    process.exitCode = 1;
  } finally {
    if (connection) {
      try {
        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
      } catch (fkError) {
        console.error('⚠️ Could not re-enable FOREIGN_KEY_CHECKS:', fkError.message);
      }
      await connection.end();
      console.log('🔌 MySQL connection closed');
    }
  }
}

main();
