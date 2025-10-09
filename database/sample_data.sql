-- Sample Data for Trading Platform
-- This file contains realistic sample data to populate the database for development and testing

-- =================================================================
-- USERS AND ROLES SAMPLE DATA
-- =================================================================

-- Insert sample users
INSERT INTO users (email, password_hash, first_name, last_name, phone, status, email_verified, kyc_status, last_login) VALUES
('john.anderson@example.com', '$2b$12$LQv3c1yqBwEHXw17C1nLpeF.xKwOFxkXO8.l1J0w7Vxz5z5z5z5z5', 'John', 'Anderson', '+1-555-0101', 'active', TRUE, 'approved', '2024-01-20 14:30:00'),
('sarah.mitchell@example.com', '$2b$12$LQv3c1yqBwEHXw17C1nLpeF.xKwOFxkXO8.l1J0w7Vxz5z5z5z5z5', 'Sarah', 'Mitchell', '+1-555-0102', 'active', TRUE, 'approved', '2024-01-20 09:15:00'),
('michael.chen@example.com', '$2b$12$LQv3c1yqBwEHXw17C1nLpeF.xKwOFxkXO8.l1J0w7Vxz5z5z5z5z5', 'Michael', 'Chen', '+1-555-0103', 'suspended', TRUE, 'pending', '2024-01-19 16:45:00'),
('emma.williams@example.com', '$2b$12$LQv3c1yqBwEHXw17C1nLpeF.xKwOFxkXO8.l1J0w7Vxz5z5z5z5z5', 'Emma', 'Williams', '+1-555-0104', 'active', TRUE, 'approved', '2024-01-20 13:20:00'),
('admin@tradepro.com', '$2b$12$LQv3c1yqBwEHXw17C1nLpeF.xKwOFxkXO8.l1J0w7Vxz5z5z5z5z5', 'Admin', 'User', '+1-555-0001', 'active', TRUE, 'approved', '2024-01-20 15:00:00'),
('support@tradepro.com', '$2b$12$LQv3c1yqBwEHXw17C1nLpeF.xKwOFxkXO8.l1J0w7Vxz5z5z5z5z5', 'Support', 'Team', '+1-555-0002', 'active', TRUE, 'approved', '2024-01-20 12:00:00');

-- Assign roles to users
INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES
(1, 6, 1), -- John Anderson - Premium
(2, 5, 1), -- Sarah Mitchell - Professional
(3, 7, 1), -- Michael Chen - Basic
(4, 4, 1), -- Emma Williams - VIP
(5, 1, 1), -- Admin User - Admin
(6, 3, 1); -- Support Team - Support

-- Insert user addresses
INSERT INTO user_addresses (user_id, type, address_line_1, city, state_province, postal_code, country_code, is_primary) VALUES
(1, 'both', '123 Main Street', 'New York', 'NY', '10001', 'USA', TRUE),
(2, 'both', '456 Oak Avenue', 'Los Angeles', 'CA', '90001', 'USA', TRUE),
(3, 'both', '789 Pine Road', 'Chicago', 'IL', '60601', 'USA', TRUE),
(4, 'both', '321 Elm Street', 'Miami', 'FL', '33101', 'USA', TRUE);

-- Insert user settings
INSERT INTO user_settings (user_id, setting_key, setting_value) VALUES
(1, 'theme', 'dark'),
(1, 'language', 'en'),
(1, 'timezone', 'America/New_York'),
(1, 'notifications_email', 'true'),
(1, 'notifications_sms', 'false'),
(2, 'theme', 'light'),
(2, 'language', 'en'),
(2, 'timezone', 'America/Los_Angeles'),
(3, 'theme', 'dark'),
(3, 'language', 'en'),
(4, 'theme', 'light'),
(4, 'language', 'en');

-- =================================================================
-- TRADING ACCOUNTS SAMPLE DATA
-- =================================================================

-- Insert trading accounts
INSERT INTO trading_accounts (user_id, account_number, account_type, currency, leverage, balance, equity, free_margin, status) VALUES
(1, '1001234567', 'live', 'USD', 100.00, 15847.92, 16165.57, 13397.92, 'active'),
(1, '1001234568', 'demo', 'USD', 500.00, 100000.00, 100000.00, 95000.00, 'active'),
(2, '1002345678', 'live', 'USD', 200.00, 8923.15, 9156.80, 7245.30, 'active'),
(3, '1003456789', 'live', 'USD', 50.00, 2154.78, 2089.45, 1856.23, 'frozen'),
(4, '1004567890', 'live', 'USD', 500.00, 45692.41, 46234.87, 41523.65, 'active'),
(4, '1004567891', 'demo', 'EUR', 400.00, 75000.00, 75000.00, 70000.00, 'active');

-- =================================================================
-- ASSET CATEGORIES AND SYMBOLS SAMPLE DATA
-- =================================================================

-- Insert asset categories
INSERT INTO asset_categories (name, description, is_active) VALUES
('Forex', 'Foreign Exchange Currency Pairs', TRUE),
('Precious Metals', 'Gold, Silver and other precious metals', TRUE),
('Cryptocurrency', 'Digital currencies like Bitcoin, Ethereum', TRUE),
('Indices', 'Stock market indices', TRUE),
('Commodities', 'Raw materials and agricultural products', TRUE);

-- Insert symbols
INSERT INTO symbols (id, symbol, name, category_id, base_currency, quote_currency, pip_size, lot_size, min_lot, max_lot, contract_size, margin_requirement, commission_value) VALUES
(1, 'EURUSD', 'Euro/US Dollar', 1, 'EUR', 'USD', 0.0001, 100000.0000, 0.01, 100.0000, 100000.0000, 3.3333, 3.50),
(2, 'GBPUSD', 'British Pound/US Dollar', 1, 'GBP', 'USD', 0.0001, 100000.0000, 0.01, 100.0000, 100000.0000, 3.3333, 3.50),
(3, 'USDJPY', 'US Dollar/Japanese Yen', 1, 'USD', 'JPY', 0.01, 100000.0000, 0.01, 100.0000, 100000.0000, 3.3333, 3.50),
(4, 'XAUUSD', 'Gold/US Dollar', 2, 'XAU', 'USD', 0.01, 100.0000, 0.01, 10.0000, 100.0000, 5.0000, 2.50),
(5, 'BTCUSD', 'Bitcoin/US Dollar', 3, 'BTC', 'USD', 0.01, 1.0000, 0.001, 1.0000, 1.0000, 20.0000, 5.00),
(6, 'ETHUSD', 'Ethereum/US Dollar', 3, 'ETH', 'USD', 0.01, 1.0000, 0.01, 10.0000, 1.0000, 10.0000, 2.50),
(7, 'US30', 'Dow Jones Industrial Average', 4, 'US30', 'USD', 0.1, 1.0000, 0.1, 10.0000, 1.0000, 1.0000, 5.00),
(8, 'SPX500', 'S&P 500 Index', 4, 'SPX500', 'USD', 0.1, 1.0000, 0.1, 10.0000, 1.0000, 1.0000, 5.00);

-- =================================================================
-- MARKET DATA SAMPLE DATA
-- =================================================================

-- Insert current market prices
INSERT INTO market_prices (symbol_id, bid, ask, last, high, low, volume, change_amount, change_percent, timestamp) VALUES
(1, 1.0770, 1.0772, 1.0771, 1.0785, 1.0765, 125000.50, 0.0009, 0.08, '2024-01-20 15:30:00'), -- EURUSD
(2, 1.2648, 1.2652, 1.2650, 1.2665, 1.2635, 98500.25, -0.0015, -0.12, '2024-01-20 15:30:00'), -- GBPUSD
(3, 148.74, 148.76, 148.75, 149.15, 148.45, 156750.75, 0.25, 0.17, '2024-01-20 15:30:00'), -- USDJPY
(4, 2076.56, 2076.60, 2076.58, 2085.42, 2071.23, 45620.30, 15.42, 0.75, '2024-01-20 15:30:00'), -- XAUUSD
(5, 63649.50, 63651.50, 63650.00, 64250.80, 63125.40, 1256.85, -985.32, -1.53, '2024-01-20 15:30:00'), -- BTCUSD
(6, 3561.40, 3561.44, 3561.42, 3587.65, 3545.20, 8956.45, 39.87, 1.13, '2024-01-20 15:30:00'), -- ETHUSD
(7, 39984.5, 39986.5, 39985.0, 40125.8, 39845.2, 2845.60, -48.23, -0.12, '2024-01-20 15:30:00'), -- US30
(8, 4967.8, 4968.2, 4968.0, 4985.4, 4952.1, 1896.35, 12.45, 0.25, '2024-01-20 15:30:00'); -- SPX500

-- =================================================================
-- TRADING POSITIONS AND HISTORY SAMPLE DATA
-- =================================================================

-- Insert open positions
INSERT INTO positions (account_id, symbol_id, side, lot_size, open_price, current_price, stop_loss, take_profit, commission, swap, profit, opened_at) VALUES
(1, 4, 'buy', 0.01, 2064.54, 2076.58, 2740.00, 2790.00, 2.50, 2.45, 317.65, '2024-01-20 12:46:44'),
(1, 4, 'sell', 0.01, 2333.85, 2076.58, NULL, NULL, 2.50, -1.23, -443.85, '2024-01-20 12:46:44'),
(2, 1, 'buy', 0.05, 1.0845, 1.0771, 1.0820, 1.0880, 3.50, 0.85, 110.00, '2024-01-20 11:32:15'),
(4, 5, 'buy', 0.001, 62500.00, 63650.00, 60000.00, 65000.00, 5.00, 0.00, 1150.00, '2024-01-20 10:15:30'),
(4, 6, 'sell', 0.01, 3580.50, 3561.42, 3600.00, 3520.00, 2.50, -0.50, 191.08, '2024-01-20 13:25:18');

-- Insert trade history (closed positions)
INSERT INTO trade_history (account_id, symbol_id, side, lot_size, open_price, close_price, commission, swap, profit, duration_minutes, close_reason, opened_at, closed_at) VALUES
(1, 1, 'buy', 0.05, 1.0845, 1.0867, 3.50, 0.85, 110.00, 135, 'manual', '2024-01-20 09:30:00', '2024-01-20 11:45:00'),
(2, 2, 'sell', 0.03, 1.2654, 1.2631, 2.75, -0.45, 69.00, 45, 'take_profit', '2024-01-20 10:15:00', '2024-01-20 11:00:00'),
(1, 3, 'buy', 0.02, 149.85, 149.42, 2.00, 1.25, -86.00, 90, 'stop_loss', '2024-01-20 08:45:00', '2024-01-20 10:15:00'),
(4, 5, 'sell', 0.0005, 64200.00, 63950.00, 2.50, 0.00, 125.00, 180, 'manual', '2024-01-19 14:30:00', '2024-01-19 17:30:00'),
(2, 4, 'buy', 0.005, 2055.30, 2068.75, 1.25, 1.80, 67.25, 240, 'manual', '2024-01-19 10:00:00', '2024-01-19 14:00:00'),
(3, 1, 'sell', 0.02, 1.0890, 1.0875, 1.40, -0.65, 30.00, 60, 'manual', '2024-01-18 15:30:00', '2024-01-18 16:30:00'),
(4, 7, 'buy', 0.1, 39850.0, 39925.5, 5.00, -2.50, 75.50, 320, 'manual', '2024-01-18 09:00:00', '2024-01-18 14:20:00');

-- =================================================================
-- FINANCIAL TRANSACTIONS SAMPLE DATA
-- =================================================================

-- Insert deposit transactions
INSERT INTO deposits (user_id, account_id, transaction_id, payment_method_id, amount, currency, fee, net_amount, status, payment_reference, processed_by, processed_at, created_at) VALUES
(1, 1, 'DEP-2024-001', 1, 5000.00, 'USD', 0.00, 5000.00, 'completed', 'BANK-TXN-12345', 5, '2024-01-20 10:30:00', '2024-01-20 09:00:00'),
(2, 3, 'DEP-2024-002', 2, 1000.00, 'USD', 29.00, 971.00, 'completed', 'STRIPE-pi_1234567890', 5, '2024-01-20 11:00:00', '2024-01-20 10:45:00'),
(4, 5, 'DEP-2024-003', 3, 2500.00, 'USD', 85.00, 2415.00, 'completed', 'PP-TXN-ABCD1234', 5, '2024-01-19 14:20:00', '2024-01-19 13:15:00'),
(1, 1, 'DEP-2024-004', 4, 1500.00, 'USD', 15.00, 1485.00, 'pending', 'BTC-ADDR-xyz789', NULL, NULL, '2024-01-20 14:00:00'),
(3, 4, 'DEP-2024-005', 1, 750.00, 'USD', 0.00, 750.00, 'processing', 'BANK-TXN-67890', NULL, NULL, '2024-01-20 08:30:00');

-- Insert withdrawal transactions
INSERT INTO withdrawals (user_id, account_id, transaction_id, payment_method_id, amount, currency, fee, net_amount, status, payment_reference, processed_by, processed_at, created_at) VALUES
(2, 3, 'WTH-2024-001', 1, 500.00, 'USD', 25.00, 475.00, 'completed', 'WIRE-OUT-ABC123', 5, '2024-01-19 16:30:00', '2024-01-19 14:00:00'),
(4, 5, 'WTH-2024-002', 3, 1200.00, 'USD', 18.00, 1182.00, 'pending', NULL, NULL, NULL, '2024-01-20 12:00:00'),
(1, 1, 'WTH-2024-003', 1, 800.00, 'USD', 25.00, 775.00, 'processing', NULL, NULL, NULL, '2024-01-20 13:15:00');

-- =================================================================
-- SUPPORT TICKETS SAMPLE DATA
-- =================================================================

-- Insert support tickets
INSERT INTO support_tickets (ticket_number, user_id, category_id, subject, description, priority, status, assigned_to, created_at) VALUES
('TKT-2024-001', 1, 1, 'Cannot access my account', 'I am unable to log into my trading account. The system says my credentials are invalid but I am sure they are correct.', 'high', 'in_progress', 6, '2024-01-20 09:30:00'),
('TKT-2024-002', 2, 3, 'Deposit not reflected in account', 'I made a deposit of $1000 via credit card 2 hours ago but it is not showing in my account balance.', 'medium', 'resolved', 6, '2024-01-20 08:15:00'),
('TKT-2024-003', 3, 2, 'Order execution problem', 'My buy order for EURUSD was not executed at the requested price. There seems to be slippage issues.', 'high', 'open', NULL, '2024-01-20 11:45:00'),
('TKT-2024-004', 4, 5, 'Question about leverage', 'I would like to understand how to change my account leverage and what are the implications.', 'low', 'waiting_user', 6, '2024-01-19 16:20:00'),
('TKT-2024-005', 1, 4, 'Platform connection issues', 'The trading platform keeps disconnecting every few minutes. This is affecting my trading.', 'medium', 'open', NULL, '2024-01-20 14:10:00');

-- Insert support responses
INSERT INTO support_responses (ticket_id, user_id, message, is_internal, created_at) VALUES
(1, 6, 'Hello John, thank you for contacting us. I can see your account is active. Please try clearing your browser cache and cookies, then attempt to log in again.', FALSE, '2024-01-20 10:00:00'),
(1, 1, 'I tried clearing the cache but still cannot log in. Can you please reset my password?', FALSE, '2024-01-20 10:15:00'),
(1, 6, 'I have sent you a password reset link to your registered email address. Please check your inbox and spam folder.', FALSE, '2024-01-20 10:30:00'),
(2, 6, 'Hi Sarah, I can confirm your deposit has been processed successfully. The funds should reflect in your account within the next 30 minutes.', FALSE, '2024-01-20 09:00:00'),
(2, 2, 'Thank you! I can see the funds in my account now. Issue resolved.', FALSE, '2024-01-20 09:45:00'),
(4, 6, 'Hello Emma, to change your leverage, please go to Account Settings > Trading Preferences. Note that higher leverage increases both potential profits and risks.', FALSE, '2024-01-19 17:00:00'),
(4, 4, 'Thank you for the explanation. I understand the risks now. Can you help me change it to 1:200?', FALSE, '2024-01-20 10:00:00');

-- =================================================================
-- MAM/PAMM SAMPLE DATA
-- =================================================================

-- Insert MAM/PAMM master accounts
INSERT INTO mam_pamm_masters (user_id, account_id, strategy_name, strategy_description, management_type, allocation_method, performance_fee_percent, min_investment, status) VALUES
(4, 5, 'Conservative Growth Strategy', 'Low-risk trading strategy focusing on major currency pairs with strict risk management', 'PAMM', 'proportional', 20.00, 1000.00, 'active'),
(1, 1, 'Aggressive Forex Trading', 'High-frequency trading strategy targeting quick profits from forex market volatility', 'MAM', 'proportional', 30.00, 5000.00, 'active');

-- Insert MAM/PAMM investors
INSERT INTO mam_pamm_investors (master_id, user_id, account_id, invested_amount, current_equity, allocation_percent, status) VALUES
(1, 2, 3, 5000.00, 5350.00, 25.00, 'active'),
(1, 3, 4, 2000.00, 2140.00, 10.00, 'active'),
(2, 2, 3, 3000.00, 3180.00, 15.00, 'active');

-- Insert MAM/PAMM performance data
INSERT INTO mam_pamm_performance (master_id, period_start, period_end, total_return_percent, total_trades, winning_trades, losing_trades, profit_factor, max_drawdown_percent) VALUES
(1, '2024-01-01', '2024-01-20', 7.50, 45, 32, 13, 2.35, -5.20),
(2, '2024-01-01', '2024-01-20', 12.30, 78, 48, 30, 1.85, -8.75);

-- =================================================================
-- NOTIFICATIONS AND ALERTS SAMPLE DATA
-- =================================================================

-- Insert user notifications
INSERT INTO user_notifications (user_id, template_id, type, title, message, status, created_at) VALUES
(1, 1, 'email', 'Welcome to TradePro Platform!', 'Dear John, Welcome to our trading platform! Your account has been successfully created.', 'delivered', '2024-01-15 10:00:00'),
(1, 2, 'email', 'Deposit Confirmed', 'Your deposit of $5000.00 USD has been confirmed and added to your account.', 'delivered', '2024-01-20 10:30:00'),
(2, 3, 'email', 'Withdrawal Processed', 'Your withdrawal request of $500.00 USD has been processed.', 'delivered', '2024-01-19 16:30:00'),
(1, 5, 'in_app', 'Trade Executed', 'Your BUY order for XAUUSD has been executed at 2064.54.', 'read', '2024-01-20 12:46:44'),
(4, 5, 'in_app', 'Trade Executed', 'Your SELL order for ETHUSD has been executed at 3580.50.', 'sent', '2024-01-20 13:25:18');

-- Insert price alerts
INSERT INTO price_alerts (user_id, symbol_id, alert_type, trigger_value, current_value, message, is_active) VALUES
(1, 4, 'price_above', 2080.00, 2076.58, 'Alert me when Gold goes above $2080', TRUE),
(2, 5, 'price_below', 60000.00, 63650.00, 'Alert me when Bitcoin drops below $60,000', TRUE),
(4, 1, 'price_change_percent', 1.50, 0.08, 'Alert me when EURUSD changes by 1.5%', TRUE),
(1, 6, 'price_above', 3600.00, 3561.42, 'Alert me when Ethereum goes above $3600', TRUE);

-- =================================================================
-- AUDIT LOG SAMPLE DATA
-- =================================================================

-- Insert audit log entries
INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values, ip_address, created_at) VALUES
(5, 'UPDATE_USER_STATUS', 'users', 3, '{"status": "active"}', '{"status": "suspended"}', '192.168.1.100', '2024-01-20 09:00:00'),
(6, 'PROCESS_DEPOSIT', 'deposits', 1, '{"status": "pending"}', '{"status": "completed", "processed_by": 5}', '192.168.1.101', '2024-01-20 10:30:00'),
(5, 'CLOSE_POSITION', 'positions', 10, '{"status": "open"}', '{"status": "closed", "profit": 110.00}', '192.168.1.100', '2024-01-20 11:45:00'),
(1, 'LOGIN', 'users', 1, NULL, '{"last_login": "2024-01-20 14:30:00"}', '203.0.113.1', '2024-01-20 14:30:00'),
(2, 'LOGIN', 'users', 2, NULL, '{"last_login": "2024-01-20 09:15:00"}', '203.0.113.5', '2024-01-20 09:15:00');

-- =================================================================
-- ACCOUNT BALANCE HISTORY SAMPLE DATA
-- =================================================================

-- Insert balance history entries
INSERT INTO account_balance_history (account_id, previous_balance, new_balance, change_amount, change_type, reference_id, reference_type, notes, created_at) VALUES
(1, 10847.92, 15847.92, 5000.00, 'deposit', 1, 'deposits', 'Bank transfer deposit processed', '2024-01-20 10:30:00'),
(1, 15847.92, 15957.92, 110.00, 'trade_profit', 10, 'trade_history', 'EURUSD trade closed with profit', '2024-01-20 11:45:00'),
(1, 15957.92, 15847.92, -110.00, 'trade_loss', 11, 'trade_history', 'USDJPY trade closed with loss', '2024-01-20 10:15:00'),
(3, 1183.15, 1154.15, -29.00, 'commission', 2, 'deposits', 'Credit card deposit fee', '2024-01-20 11:00:00'),
(3, 1154.15, 2154.15, 1000.00, 'deposit', 2, 'deposits', 'Credit card deposit processed', '2024-01-20 11:00:00'),
(3, 2154.15, 2085.15, -69.00, 'trade_profit', 12, 'trade_history', 'GBPUSD trade closed with profit', '2024-01-20 11:00:00');

-- Update account balances to match history
UPDATE trading_accounts SET balance = 15847.92 WHERE id = 1;
UPDATE trading_accounts SET balance = 2154.78 WHERE id = 4;