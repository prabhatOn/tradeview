-- =====================================================
-- COMPLETE DATABASE CLEANUP SCRIPT
-- Removes all non-admin users and all trading data
-- =====================================================

SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- STEP 1: Identify admin user IDs first
-- =====================================================

-- Create temporary table to store admin user IDs
CREATE TEMPORARY TABLE admin_users AS
SELECT DISTINCT u.id 
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE r.is_admin = TRUE;

-- =====================================================
-- STEP 2: Clean ALL Trading Data
-- =====================================================

-- Clean positions completely
DELETE FROM positions WHERE 1=1;

-- Clean trade history completely
DELETE FROM trade_history WHERE 1=1;

-- Clean introducing broker relationships
DELETE FROM introducing_brokers WHERE 1=1;

-- Clean user sessions (keep only admin sessions)
DELETE FROM user_sessions WHERE user_id NOT IN (SELECT id FROM admin_users);

-- Clean trading accounts (keep only admin accounts)
DELETE FROM trading_accounts WHERE user_id NOT IN (SELECT id FROM admin_users);

-- =====================================================
-- STEP 3: Clean Non-Admin Users
-- =====================================================

-- Delete user roles for non-admin users
DELETE FROM user_roles WHERE user_id NOT IN (SELECT id FROM admin_users);

-- Delete user settings for non-admin users
DELETE FROM user_settings WHERE user_id NOT IN (SELECT id FROM admin_users);

-- Delete user addresses for non-admin users
DELETE FROM user_addresses WHERE user_id NOT IN (SELECT id FROM admin_users);

-- Delete non-admin users
DELETE FROM users WHERE id NOT IN (SELECT id FROM admin_users);

-- Clean temporary table
DROP TEMPORARY TABLE admin_users;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT '✅ Database cleaned successfully!' as Status;
SELECT COUNT(*) as 'Remaining Users' FROM users;
SELECT COUNT(*) as 'Positions' FROM positions;
SELECT COUNT(*) as 'Trade History' FROM trade_history;
SELECT COUNT(*) as 'Trading Accounts' FROM trading_accounts;
SELECT COUNT(*) as 'IB Relationships' FROM introducing_brokers;
SELECT COUNT(*) as 'Symbols' FROM symbols;
