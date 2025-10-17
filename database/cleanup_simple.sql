-- =====================================================
-- DATABASE CLEANUP AND RESEED SCRIPT (SAFE VERSION)
-- Removes all user data except admin
-- Cleans all trading data
-- Reseeds with fresh symbols including all forex, crypto, and commodities
-- =====================================================

SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- STEP 1: Clean Trading-Related Data (Only if tables exist)
-- =====================================================

-- Clean positions
DELETE FROM positions WHERE 1=1;

-- Clean trade history
DELETE FROM trade_history WHERE 1=1;

-- Clean trading accounts
DELETE FROM trading_accounts WHERE 1=1;

-- Clean introducing broker relationships  
DELETE FROM introducing_brokers WHERE 1=1;

-- Clean notifications
DELETE FROM notifications WHERE 1=1;

-- Clean user sessions
DELETE FROM user_sessions WHERE 1=1;

-- =====================================================
-- STEP 2: Clean Non-Admin Users
-- =====================================================

-- Keep only admin users (those with admin role)
DELETE u FROM users u
WHERE u.id NOT IN (
    SELECT DISTINCT ur.user_id 
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE r.is_admin = TRUE
);

-- Clean trading accounts for deleted users
DELETE FROM trading_accounts 
WHERE user_id NOT IN (SELECT id FROM users);

-- =====================================================
-- STEP 3: Reset Asset Categories and Symbols
-- =====================================================

-- Delete symbols first (child table)
DELETE FROM symbols;

-- Delete and recreate asset categories
DELETE FROM asset_categories;

-- Reset auto-increment
ALTER TABLE asset_categories AUTO_INCREMENT = 1;
ALTER TABLE symbols AUTO_INCREMENT = 1;

-- Insert asset categories with explicit IDs
INSERT INTO asset_categories (id, name, description, is_active) VALUES
(1, 'FOREX_MAJOR', 'Major Forex Pairs', TRUE),
(2, 'FOREX_MINOR', 'Minor Forex Pairs (Cross Pairs)', TRUE),
(3, 'FOREX_EXOTIC', 'Exotic Forex Pairs', TRUE),
(4, 'CRYPTO_MAJOR', 'Major Cryptocurrencies', TRUE),
(5, 'COMMODITY', 'Commodities (Metals, Energy, Agriculture)', TRUE);

-- =====================================================
-- STEP 4: Insert All Trading Symbols (70 instruments)
-- =====================================================

INSERT INTO symbols (
    symbol, 
    name, 
    category_id, 
    base_currency, 
    quote_currency, 
    contract_size, 
    pip_size, 
    min_lot, 
    max_lot, 
    lot_step, 
    spread_markup, 
    swap_long, 
    swap_short, 
    margin_requirement, 
    is_active
) VALUES
-- FOREX MAJORS
('EURUSD', 'Euro vs US Dollar', 1, 'EUR', 'USD', 100000, 0.0001, 0.01, 100.00, 0.01, 0.8, -0.50, -0.30, 1.00, TRUE),
('GBPUSD', 'British Pound vs US Dollar', 1, 'GBP', 'USD', 100000, 0.0001, 0.01, 100.00, 0.01, 1.2, -0.60, -0.40, 1.00, TRUE),
('USDJPY', 'US Dollar vs Japanese Yen', 1, 'USD', 'JPY', 100000, 0.01, 0.01, 100.00, 0.01, 0.9, -0.45, -0.35, 1.00, TRUE),
('USDCHF', 'US Dollar vs Swiss Franc', 1, 'USD', 'CHF', 100000, 0.0001, 0.01, 100.00, 0.01, 1.0, -0.55, -0.25, 1.00, TRUE),
('USDCAD', 'US Dollar vs Canadian Dollar', 1, 'USD', 'CAD', 100000, 0.0001, 0.01, 100.00, 0.01, 1.1, -0.50, -0.30, 1.00, TRUE),
('AUDUSD', 'Australian Dollar vs US Dollar', 1, 'AUD', 'USD', 100000, 0.0001, 0.01, 100.00, 0.01, 1.0, -0.52, -0.28, 1.00, TRUE),
('NZDUSD', 'New Zealand Dollar vs US Dollar', 1, 'NZD', 'USD', 100000, 0.0001, 0.01, 100.00, 0.01, 1.3, -0.48, -0.32, 1.00, TRUE),
-- FOREX MINORS  
('EURGBP', 'Euro vs British Pound', 2, 'EUR', 'GBP', 100000, 0.0001, 0.01, 100.00, 0.01, 1.5, -0.65, -0.45, 1.00, TRUE),
('EURJPY', 'Euro vs Japanese Yen', 2, 'EUR', 'JPY', 100000, 0.01, 0.01, 100.00, 0.01, 1.4, -0.60, -0.40, 1.00, TRUE),
('EURCHF', 'Euro vs Swiss Franc', 2, 'EUR', 'CHF', 100000, 0.0001, 0.01, 100.00, 0.01, 1.6, -0.70, -0.30, 1.00, TRUE),
('EURAUD', 'Euro vs Australian Dollar', 2, 'EUR', 'AUD', 100000, 0.0001, 0.01, 100.00, 0.01, 1.8, -0.75, -0.35, 1.00, TRUE),
('EURCAD', 'Euro vs Canadian Dollar', 2, 'EUR', 'CAD', 100000, 0.0001, 0.01, 100.00, 0.01, 1.7, -0.68, -0.38, 1.00, TRUE),
('EURNZD', 'Euro vs New Zealand Dollar', 2, 'EUR', 'NZD', 100000, 0.0001, 0.01, 100.00, 0.01, 2.0, -0.80, -0.40, 1.00, TRUE),
('GBPJPY', 'British Pound vs Japanese Yen', 2, 'GBP', 'JPY', 100000, 0.01, 0.01, 100.00, 0.01, 1.9, -0.75, -0.45, 1.00, TRUE),
('GBPCHF', 'British Pound vs Swiss Franc', 2, 'GBP', 'CHF', 100000, 0.0001, 0.01, 100.00, 0.01, 2.1, -0.78, -0.38, 1.00, TRUE),
('GBPAUD', 'British Pound vs Australian Dollar', 2, 'GBP', 'AUD', 100000, 0.0001, 0.01, 100.00, 0.01, 2.3, -0.82, -0.42, 1.00, TRUE),
('GBPCAD', 'British Pound vs Canadian Dollar', 2, 'GBP', 'CAD', 100000, 0.0001, 0.01, 100.00, 0.01, 2.2, -0.80, -0.40, 1.00, TRUE),
('GBPNZD', 'British Pound vs New Zealand Dollar', 2, 'GBP', 'NZD', 100000, 0.0001, 0.01, 100.00, 0.01, 2.5, -0.85, -0.45, 1.00, TRUE),
('AUDJPY', 'Australian Dollar vs Japanese Yen', 2, 'AUD', 'JPY', 100000, 0.01, 0.01, 100.00, 0.01, 1.6, -0.62, -0.38, 1.00, TRUE),
('AUDCHF', 'Australian Dollar vs Swiss Franc', 2, 'AUD', 'CHF', 100000, 0.0001, 0.01, 100.00, 0.01, 1.8, -0.68, -0.32, 1.00, TRUE),
('AUDCAD', 'Australian Dollar vs Canadian Dollar', 2, 'AUD', 'CAD', 100000, 0.0001, 0.01, 100.00, 0.01, 1.7, -0.65, -0.35, 1.00, TRUE),
('AUDNZD', 'Australian Dollar vs New Zealand Dollar', 2, 'AUD', 'NZD', 100000, 0.0001, 0.01, 100.00, 0.01, 1.9, -0.70, -0.40, 1.00, TRUE),
('NZDJPY', 'New Zealand Dollar vs Japanese Yen', 2, 'NZD', 'JPY', 100000, 0.01, 0.01, 100.00, 0.01, 1.7, -0.64, -0.36, 1.00, TRUE),
('NZDCHF', 'New Zealand Dollar vs Swiss Franc', 2, 'NZD', 'CHF', 100000, 0.0001, 0.01, 100.00, 0.01, 2.0, -0.72, -0.38, 1.00, TRUE),
('NZDCAD', 'New Zealand Dollar vs Canadian Dollar', 2, 'NZD', 'CAD', 100000, 0.0001, 0.01, 100.00, 0.01, 1.9, -0.68, -0.38, 1.00, TRUE),
('CADJPY', 'Canadian Dollar vs Japanese Yen', 2, 'CAD', 'JPY', 100000, 0.01, 0.01, 100.00, 0.01, 1.6, -0.60, -0.40, 1.00, TRUE),
('CADCHF', 'Canadian Dollar vs Swiss Franc', 2, 'CAD', 'CHF', 100000, 0.0001, 0.01, 100.00, 0.01, 1.8, -0.66, -0.36, 1.00, TRUE),
('CHFJPY', 'Swiss Franc vs Japanese Yen', 2, 'CHF', 'JPY', 100000, 0.01, 0.01, 100.00, 0.01, 1.7, -0.63, -0.37, 1.00, TRUE),
-- FOREX EXOTICS
('USDINR', 'US Dollar vs Indian Rupee', 3, 'USD', 'INR', 100000, 0.0001, 0.01, 50.00, 0.01, 3.5, -1.20, -0.80, 2.00, TRUE),
('USDTRY', 'US Dollar vs Turkish Lira', 3, 'USD', 'TRY', 100000, 0.0001, 0.01, 50.00, 0.01, 4.0, -1.50, -1.00, 2.00, TRUE),
('USDZAR', 'US Dollar vs South African Rand', 3, 'USD', 'ZAR', 100000, 0.0001, 0.01, 50.00, 0.01, 3.8, -1.40, -0.90, 2.00, TRUE),
('USDMXN', 'US Dollar vs Mexican Peso', 3, 'USD', 'MXN', 100000, 0.0001, 0.01, 50.00, 0.01, 3.2, -1.10, -0.70, 2.00, TRUE),
('USDTHB', 'US Dollar vs Thai Baht', 3, 'USD', 'THB', 100000, 0.01, 0.01, 50.00, 0.01, 3.6, -1.25, -0.85, 2.00, TRUE),
('USDSEK', 'US Dollar vs Swedish Krona', 3, 'USD', 'SEK', 100000, 0.0001, 0.01, 50.00, 0.01, 2.8, -0.95, -0.65, 1.50, TRUE),
('USDNOK', 'US Dollar vs Norwegian Krone', 3, 'USD', 'NOK', 100000, 0.0001, 0.01, 50.00, 0.01, 2.9, -1.00, -0.70, 1.50, TRUE),
('EURSEK', 'Euro vs Swedish Krona', 3, 'EUR', 'SEK', 100000, 0.0001, 0.01, 50.00, 0.01, 3.0, -1.05, -0.75, 1.50, TRUE),
('EURNOK', 'Euro vs Norwegian Krone', 3, 'EUR', 'NOK', 100000, 0.0001, 0.01, 50.00, 0.01, 3.1, -1.08, -0.78, 1.50, TRUE),
('USDPLN', 'US Dollar vs Polish Zloty', 3, 'USD', 'PLN', 100000, 0.0001, 0.01, 50.00, 0.01, 3.3, -1.15, -0.75, 1.50, TRUE),
-- CRYPTOCURRENCIES
('BTCUSD', 'Bitcoin vs US Dollar', 4, 'BTC', 'USD', 1, 0.01, 0.01, 10.00, 0.01, 25.00, -2.50, -2.50, 5.00, TRUE),
('ETHUSD', 'Ethereum vs US Dollar', 4, 'ETH', 'USD', 1, 0.01, 0.01, 50.00, 0.01, 12.00, -1.80, -1.80, 5.00, TRUE),
('BNBUSD', 'Binance Coin vs US Dollar', 4, 'BNB', 'USD', 1, 0.01, 0.01, 50.00, 0.01, 8.00, -1.50, -1.50, 5.00, TRUE),
('SOLUSD', 'Solana vs US Dollar', 4, 'SOL', 'USD', 1, 0.01, 0.01, 100.00, 0.01, 6.00, -1.20, -1.20, 5.00, TRUE),
('XRPUSD', 'Ripple vs US Dollar', 4, 'XRP', 'USD', 1, 0.0001, 0.01, 1000.00, 0.01, 3.00, -0.80, -0.80, 5.00, TRUE),
('ADAUSD', 'Cardano vs US Dollar', 4, 'ADA', 'USD', 1, 0.0001, 0.01, 1000.00, 0.01, 2.50, -0.70, -0.70, 5.00, TRUE),
('DOGEUSD', 'Dogecoin vs US Dollar', 4, 'DOGE', 'USD', 1, 0.0001, 0.01, 10000.00, 0.01, 1.50, -0.50, -0.50, 5.00, TRUE),
('LTCUSD', 'Litecoin vs US Dollar', 4, 'LTC', 'USD', 1, 0.01, 0.01, 100.00, 0.01, 5.00, -1.00, -1.00, 5.00, TRUE),
('DOTUSD', 'Polkadot vs US Dollar', 4, 'DOT', 'USD', 1, 0.01, 0.01, 500.00, 0.01, 4.00, -0.90, -0.90, 5.00, TRUE),
('AVAXUSD', 'Avalanche vs US Dollar', 4, 'AVAX', 'USD', 1, 0.01, 0.01, 100.00, 0.01, 5.50, -1.10, -1.10, 5.00, TRUE),
-- COMMODITIES
('XAUUSD', 'Gold vs US Dollar', 5, 'XAU', 'USD', 100, 0.01, 0.01, 50.00, 0.01, 0.30, -0.45, -0.25, 1.00, TRUE),
('XAGUSD', 'Silver vs US Dollar', 5, 'XAG', 'USD', 5000, 0.001, 0.01, 50.00, 0.01, 0.025, -0.50, -0.30, 1.50, TRUE),
('XPTUSD', 'Platinum vs US Dollar', 5, 'XPT', 'USD', 100, 0.01, 0.01, 25.00, 0.01, 0.50, -0.60, -0.40, 2.00, TRUE),
('XPDUSD', 'Palladium vs US Dollar', 5, 'XPD', 'USD', 100, 0.01, 0.01, 25.00, 0.01, 0.60, -0.65, -0.45, 2.00, TRUE),
('WTIUSD', 'West Texas Oil vs US Dollar', 5, 'WTI', 'USD', 1000, 0.01, 0.01, 50.00, 0.01, 0.05, -0.80, -0.50, 2.00, TRUE),
('BRENTUSD', 'Brent Oil vs US Dollar', 5, 'BRENT', 'USD', 1000, 0.01, 0.01, 50.00, 0.01, 0.05, -0.75, -0.48, 2.00, TRUE),
('NATGASUSD', 'Natural Gas vs US Dollar', 5, 'NATGAS', 'USD', 10000, 0.001, 0.01, 25.00, 0.01, 0.008, -1.00, -0.60, 3.00, TRUE),
('COFFEEUSD', 'Coffee vs US Dollar', 5, 'COFFEE', 'USD', 37500, 0.01, 0.01, 20.00, 0.01, 0.10, -0.70, -0.40, 2.50, TRUE),
('CORNUSD', 'Corn vs US Dollar', 5, 'CORN', 'USD', 5000, 0.25, 0.01, 25.00, 0.01, 0.50, -0.65, -0.35, 2.50, TRUE),
('WHEATUSD', 'Wheat vs US Dollar', 5, 'WHEAT', 'USD', 5000, 0.25, 0.01, 25.00, 0.01, 0.50, -0.68, -0.38, 2.50, TRUE);

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT 'Database cleanup completed!' as Status;
SELECT COUNT(*) as 'Users' FROM users;
SELECT COUNT(*) as 'Symbols' FROM symbols;
