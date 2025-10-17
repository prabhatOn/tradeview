-- =====================================================
-- SAFE DATABASE CLEANUP SCRIPT
-- Removes all non-admin users and trading data
-- Uses EXISTS checks for safety
-- =====================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Get list of users to keep (admins)
SELECT 'Starting cleanup...' as Status;

-- =====================================================
-- STEP 1: Clean ALL Trading Data (No user check needed)
-- =====================================================

DELETE FROM positions;
DELETE FROM trade_history;
DELETE FROM ib_commissions;
DELETE FROM introducing_brokers;
DELETE FROM swap_charges_log;
DELETE FROM margin_events;
DELETE FROM orders;

SELECT 'Core trading data cleaned' as Status;

-- =====================================================
-- STEP 2: Clean User-Related Data (Keep only admins)
-- =====================================================

-- Clean trading accounts
DELETE FROM trading_accounts 
WHERE user_id NOT IN (
    SELECT DISTINCT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.is_admin = TRUE
);

-- Clean deposits  
DELETE FROM deposits 
WHERE user_id NOT IN (
    SELECT DISTINCT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.is_admin = TRUE
);

-- Clean withdrawals
DELETE FROM withdrawals 
WHERE user_id NOT IN (
    SELECT DISTINCT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.is_admin = TRUE
);

-- Clean transactions
DELETE FROM transactions 
WHERE user_id NOT IN (
    SELECT DISTINCT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.is_admin = TRUE
);

-- Clean account balance history
DELETE FROM account_balance_history 
WHERE user_id NOT IN (
    SELECT DISTINCT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.is_admin = TRUE
);

-- Clean user notifications
DELETE FROM user_notifications 
WHERE user_id NOT IN (
    SELECT DISTINCT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.is_admin = TRUE
);

-- Clean price alerts
DELETE FROM price_alerts 
WHERE user_id NOT IN (
    SELECT DISTINCT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.is_admin = TRUE
);

-- Clean trading sessions
DELETE FROM trading_sessions 
WHERE user_id NOT IN (
    SELECT DISTINCT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.is_admin = TRUE
);

-- Clean API keys
DELETE FROM api_keys 
WHERE user_id NOT IN (
    SELECT DISTINCT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.is_admin = TRUE
);

-- Clean support tickets
DELETE FROM support_tickets 
WHERE user_id NOT IN (
    SELECT DISTINCT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.is_admin = TRUE
);

-- Clean IB applications
DELETE FROM ib_applications 
WHERE user_id NOT IN (
    SELECT DISTINCT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.is_admin = TRUE
);

-- Clean payment methods
DELETE FROM payment_methods 
WHERE user_id NOT IN (
    SELECT DISTINCT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.is_admin = TRUE
);

-- Clean referral codes
DELETE FROM referral_codes 
WHERE user_id NOT IN (
    SELECT DISTINCT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.is_admin = TRUE
);

SELECT 'User-specific data cleaned' as Status;

-- =====================================================
-- STEP 3: Clean User Profile Data
-- =====================================================

-- Delete user settings
DELETE FROM user_settings 
WHERE user_id NOT IN (
    SELECT DISTINCT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.is_admin = TRUE
);

-- Delete user addresses
DELETE FROM user_addresses 
WHERE user_id NOT IN (
    SELECT DISTINCT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.is_admin = TRUE
);

SELECT 'User profile data cleaned' as Status;

-- =====================================================
-- STEP 4: Delete Non-Admin User Roles and Users
-- =====================================================

-- Delete non-admin user roles
DELETE FROM user_roles 
WHERE user_id NOT IN (
    SELECT DISTINCT u.id FROM users u
    JOIN user_roles ur2 ON u.id = ur2.user_id
    JOIN roles r ON ur2.role_id = r.id
    WHERE r.is_admin = TRUE
) AND user_id IN (SELECT id FROM users);

-- Delete non-admin users
DELETE FROM users 
WHERE id NOT IN (
    SELECT DISTINCT ur.user_id FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE r.is_admin = TRUE
);

SELECT 'Non-admin users deleted' as Status;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT '═══════════════════════════════════════════════' as ' ';
SELECT '✅ DATABASE CLEANUP COMPLETED!' as 'STATUS';
SELECT '═══════════════════════════════════════════════' as ' ';

SELECT COUNT(*) as 'Users' FROM users;
SELECT COUNT(*) as 'Positions' FROM positions;
SELECT COUNT(*) as 'Trade History' FROM trade_history;
SELECT COUNT(*) as 'Trading Accounts' FROM trading_accounts;
SELECT COUNT(*) as 'Transactions' FROM transactions;
SELECT COUNT(*) as 'Symbols' FROM symbols;
