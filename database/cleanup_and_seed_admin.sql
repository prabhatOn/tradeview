-- Database Cleanup and Admin Seeding Script
-- This script will completely reset the database and create a fresh admin user
-- WARNING: This will delete ALL user data permanently

USE pro2;

-- =================================================================
-- STEP 1: DISABLE FOREIGN KEY CHECKS
-- =================================================================
SET FOREIGN_KEY_CHECKS = 0;

-- =================================================================
-- STEP 2: TRUNCATE ALL USER-RELATED TABLES (preserves structure)
-- =================================================================

-- Core user tables
TRUNCATE TABLE users;
TRUNCATE TABLE user_roles;
TRUNCATE TABLE roles;

-- Trading related tables
TRUNCATE TABLE trading_accounts;
TRUNCATE TABLE positions;
TRUNCATE TABLE trades;
TRUNCATE TABLE trade_history;
TRUNCATE TABLE balance_history;

-- API and access related
TRUNCATE TABLE api_keys;
TRUNCATE TABLE api_usage_logs;

-- IB system tables
TRUNCATE TABLE introducing_brokers;
TRUNCATE TABLE ib_commissions;
TRUNCATE TABLE ib_applications;

-- Transaction and financial tables
TRUNCATE TABLE transactions;
TRUNCATE TABLE deposits;
TRUNCATE TABLE withdrawals;
TRUNCATE TABLE payment_methods;

-- Notification and support tables
TRUNCATE TABLE notifications;
TRUNCATE TABLE support_tickets;
TRUNCATE TABLE support_messages;

-- Document and verification tables
TRUNCATE TABLE user_documents;

-- Session and security tables  
TRUNCATE TABLE user_sessions;
TRUNCATE TABLE user_login_history;

-- MAM/PAMM system tables (if they exist)
TRUNCATE TABLE mam_accounts;
TRUNCATE TABLE pamm_accounts;
TRUNCATE TABLE investor_accounts;

-- Admin and management tables
TRUNCATE TABLE admin_actions;
TRUNCATE TABLE system_logs;

-- =================================================================
-- STEP 3: RE-ENABLE FOREIGN KEY CHECKS
-- =================================================================
SET FOREIGN_KEY_CHECKS = 1;

-- =================================================================
-- STEP 4: RESET AUTO_INCREMENT VALUES
-- =================================================================
ALTER TABLE users AUTO_INCREMENT = 1;
ALTER TABLE user_roles AUTO_INCREMENT = 1;
ALTER TABLE roles AUTO_INCREMENT = 1;
ALTER TABLE trading_accounts AUTO_INCREMENT = 1;
ALTER TABLE positions AUTO_INCREMENT = 1;
ALTER TABLE trades AUTO_INCREMENT = 1;
ALTER TABLE transactions AUTO_INCREMENT = 1;
ALTER TABLE api_keys AUTO_INCREMENT = 1;
ALTER TABLE introducing_brokers AUTO_INCREMENT = 1;
ALTER TABLE ib_commissions AUTO_INCREMENT = 1;

-- =================================================================
-- STEP 5: CREATE DEFAULT ROLES
-- =================================================================
INSERT INTO roles (name, description, is_admin) VALUES
('Super Admin', 'Full system administrator with all permissions', TRUE),
('Admin', 'System administrator with most permissions', TRUE),
('Manager', 'Account manager with limited admin permissions', FALSE),
('IB', 'Introducing Broker with referral permissions', FALSE),
('Trader', 'Regular trading user', FALSE),
('Viewer', 'Read-only access user', FALSE);

-- =================================================================
-- STEP 6: CREATE ADMIN USER
-- =================================================================
-- Password is 'admin123' (hashed with bcrypt)
INSERT INTO users (
    email, 
    password_hash, 
    first_name, 
    last_name, 
    phone,
    country,
    preferred_currency,
    preferred_leverage,
    status,
    email_verified,
    phone_verified,
    kyc_status,
    experience_level,
    risk_tolerance,
    created_at,
    updated_at
) VALUES (
    'admin@tradingplatform.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'System',
    'Administrator',
    '+1-555-0123',
    'US',
    'USD',
    500.00,
    'active',
    TRUE,
    TRUE,
    'approved',
    'expert',
    'medium',
    NOW(),
    NOW()
);

-- Get the admin user ID
SET @admin_user_id = LAST_INSERT_ID();

-- =================================================================
-- STEP 7: ASSIGN SUPER ADMIN ROLE
-- =================================================================
INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES 
(@admin_user_id, 1, @admin_user_id);

-- =================================================================
-- STEP 8: CREATE ADMIN TRADING ACCOUNT
-- =================================================================
INSERT INTO trading_accounts (
    user_id,
    account_number,
    account_type,
    balance,
    currency,
    leverage,
    margin_level,
    equity,
    free_margin,
    status,
    created_at,
    updated_at
) VALUES (
    @admin_user_id,
    CONCAT('ADM', LPAD(@admin_user_id, 6, '0')),
    'standard',
    100000.00,
    'USD',
    500.00,
    0.00,
    100000.00,
    100000.00,
    'active',
    NOW(),
    NOW()
);

-- =================================================================
-- STEP 9: CREATE ADMIN API KEY (OPTIONAL)
-- =================================================================
INSERT INTO api_keys (
    user_id,
    key_name,
    api_key,
    api_secret,
    permissions,
    is_active,
    rate_limit_per_hour,
    created_at,
    updated_at
) VALUES (
    @admin_user_id,
    'Admin Master Key',
    SHA2(CONCAT('admin_key_', UNIX_TIMESTAMP(), RAND()), 256),
    SHA2(CONCAT('admin_secret_', UNIX_TIMESTAMP(), RAND()), 256),
    JSON_ARRAY('read', 'trade', 'admin', 'manage_users', 'manage_system'),
    TRUE,
    10000,
    NOW(),
    NOW()
);

-- =================================================================
-- STEP 10: INITIALIZE BALANCE HISTORY FOR ADMIN
-- =================================================================
INSERT INTO balance_history (
    account_id,
    user_id,
    change_amount,
    change_type,
    previous_balance,
    new_balance,
    notes,
    created_at
) VALUES (
    LAST_INSERT_ID(),
    @admin_user_id,
    100000.00,
    'deposit',
    0.00,
    100000.00,
    'Initial admin account funding',
    NOW()
);

-- =================================================================
-- VERIFICATION QUERIES
-- =================================================================

-- Show created admin user
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.status,
    u.email_verified,
    u.kyc_status,
    r.name as role_name
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'admin@tradingplatform.com';

-- Show admin trading account
SELECT 
    ta.id,
    ta.account_number,
    ta.balance,
    ta.currency,
    ta.leverage,
    ta.status
FROM trading_accounts ta
JOIN users u ON ta.user_id = u.id
WHERE u.email = 'admin@tradingplatform.com';

-- Show all roles
SELECT * FROM roles ORDER BY id;

-- Show total user count (should be 1)
SELECT COUNT(*) as total_users FROM users;

-- Show admin API key
SELECT 
    ak.key_name,
    ak.api_key,
    ak.permissions,
    ak.is_active,
    ak.rate_limit_per_hour
FROM api_keys ak
JOIN users u ON ak.user_id = u.id
WHERE u.email = 'admin@tradingplatform.com';

-- =================================================================
-- SUCCESS MESSAGE
-- =================================================================
SELECT 'Database cleanup and admin seeding completed successfully!' as status;
SELECT 'Admin Login Credentials:' as info;
SELECT 'Email: admin@tradingplatform.com' as email;
SELECT 'Password: admin123' as password;
SELECT 'Please change the admin password after first login!' as warning;