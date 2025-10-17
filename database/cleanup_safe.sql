-- =====================================================
-- COMPLETE DATABASE CLEANUP SCRIPT (Safe Version)
-- Removes all non-admin users and all trading data
-- Only operates on existing tables
-- =====================================================

SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- STEP 1: Identify admin user IDs
-- =====================================================

CREATE TEMPORARY TABLE admin_users AS
SELECT DISTINCT u.id 
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE r.is_admin = TRUE;

SELECT 'Admin users identified' as Status;
SELECT COUNT(*) as 'Admin Count' FROM admin_users;

-- =====================================================
-- STEP 2: Clean ALL Trading Data
-- =====================================================

-- Clean positions
DELETE FROM positions WHERE 1=1;
SELECT 'Positions cleaned' as Status;

-- Clean trade history
DELETE FROM trade_history WHERE 1=1;
SELECT 'Trade history cleaned' as Status;

-- Clean IB commissions
DELETE FROM ib_commissions WHERE 1=1;
SELECT 'IB commissions cleaned' as Status;

-- Clean introducing broker relationships
DELETE FROM introducing_brokers WHERE 1=1;
SELECT 'IB relationships cleaned' as Status;

-- Clean swap charges log
DELETE FROM swap_charges_log WHERE 1=1;
SELECT 'Swap charges cleaned' as Status;

-- Clean margin events
DELETE FROM margin_events WHERE 1=1;
SELECT 'Margin events cleaned' as Status;

-- Clean orders
DELETE FROM orders WHERE 1=1;
SELECT 'Orders cleaned' as Status;

-- Clean trading accounts (keep only admin accounts)
DELETE FROM trading_accounts WHERE user_id NOT IN (SELECT id FROM admin_users);
SELECT 'Non-admin trading accounts cleaned' as Status;

-- Clean deposits
DELETE FROM deposits WHERE user_id NOT IN (SELECT id FROM admin_users);
SELECT 'Deposits cleaned' as Status;

-- Clean withdrawals
DELETE FROM withdrawals WHERE user_id NOT IN (SELECT id FROM admin_users);
SELECT 'Withdrawals cleaned' as Status;

-- Clean transactions
DELETE FROM transactions WHERE user_id NOT IN (SELECT id FROM admin_users);
SELECT 'Transactions cleaned' as Status;

-- Skip pending_transactions as it might be a view

-- Clean account balance history
DELETE FROM account_balance_history WHERE user_id NOT IN (SELECT id FROM admin_users);
SELECT 'Balance history cleaned' as Status;

-- Clean user notifications
DELETE FROM user_notifications WHERE user_id NOT IN (SELECT id FROM admin_users);
SELECT 'User notifications cleaned' as Status;

-- Clean price alerts
DELETE FROM price_alerts WHERE user_id NOT IN (SELECT id FROM admin_users);
SELECT 'Price alerts cleaned' as Status;

-- Clean trading sessions
DELETE FROM trading_sessions WHERE user_id NOT IN (SELECT id FROM admin_users);
SELECT 'Trading sessions cleaned' as Status;

-- Clean API keys
DELETE FROM api_keys WHERE user_id NOT IN (SELECT id FROM admin_users);
SELECT 'API keys cleaned' as Status;

-- Clean support tickets
DELETE FROM support_tickets WHERE user_id NOT IN (SELECT id FROM admin_users);
SELECT 'Support tickets cleaned' as Status;

-- =====================================================
-- STEP 3: Clean Non-Admin User Data
-- =====================================================

-- Delete user roles for non-admin users
DELETE FROM user_roles WHERE user_id NOT IN (SELECT id FROM admin_users);
SELECT 'Non-admin user roles cleaned' as Status;

-- Delete user settings
DELETE FROM user_settings WHERE user_id NOT IN (SELECT id FROM admin_users);
SELECT 'User settings cleaned' as Status;

-- Delete user addresses
DELETE FROM user_addresses WHERE user_id NOT IN (SELECT id FROM admin_users);
SELECT 'User addresses cleaned' as Status;

-- Delete user tier assignments
DELETE FROM user_tier_assignments WHERE user_id NOT IN (SELECT id FROM admin_users);
SELECT 'User tier assignments cleaned' as Status;

-- Delete IB applications
DELETE FROM ib_applications WHERE user_id NOT IN (SELECT id FROM admin_users);
SELECT 'IB applications cleaned' as Status;

-- Delete payment methods
DELETE FROM payment_methods WHERE user_id NOT IN (SELECT id FROM admin_users);
SELECT 'Payment methods cleaned' as Status;

-- Delete referral codes
DELETE FROM referral_codes WHERE user_id NOT IN (SELECT id FROM admin_users);
SELECT 'Referral codes cleaned' as Status;

-- =====================================================
-- STEP 4: Delete Non-Admin Users
-- =====================================================

DELETE FROM users WHERE id NOT IN (SELECT id FROM admin_users);
SELECT 'Non-admin users deleted' as Status;

-- =====================================================
-- STEP 5: Cleanup
-- =====================================================

DROP TEMPORARY TABLE admin_users;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- FINAL VERIFICATION
-- =====================================================

SELECT '═══════════════════════════════════════════════' as ' ';
SELECT '✅ DATABASE CLEANUP COMPLETED!' as 'STATUS';
SELECT '═══════════════════════════════════════════════' as ' ';

SELECT COUNT(*) as 'Total Users Remaining' FROM users;
SELECT COUNT(*) as 'Positions' FROM positions;
SELECT COUNT(*) as 'Trade History Records' FROM trade_history;
SELECT COUNT(*) as 'Trading Accounts' FROM trading_accounts;
SELECT COUNT(*) as 'IB Relationships' FROM introducing_brokers;
SELECT COUNT(*) as 'Transactions' FROM transactions;
SELECT COUNT(*) as 'Deposits' FROM deposits;
SELECT COUNT(*) as 'Withdrawals' FROM withdrawals;
SELECT COUNT(*) as 'Symbols Available' FROM symbols;

SELECT '═══════════════════════════════════════════════' as ' ';
SELECT 'Database is now clean and ready!' as 'RESULT';
SELECT '═══════════════════════════════════════════════' as ' ';
