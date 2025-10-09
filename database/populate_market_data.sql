-- Insert asset categories
INSERT INTO asset_categories (name, description, is_active) VALUES
('Forex', 'Foreign Exchange Currency Pairs', TRUE),
('Commodities', 'Precious Metals and Energy', TRUE),
('Indices', 'Stock Market Indices', TRUE),
('Crypto', 'Cryptocurrencies', TRUE);

-- Insert popular trading symbols
INSERT INTO symbols (symbol, name, category_id, base_currency, quote_currency, pip_size, lot_size, min_lot, max_lot, lot_step, contract_size, margin_requirement, spread_type, commission_type, commission_value, swap_long, swap_short, is_active) VALUES
-- Major Forex Pairs
('EURUSD', 'Euro vs US Dollar', 1, 'EUR', 'USD', 0.0001, 1.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 3.3333, 'floating', 'per_lot', 7.0000, -8.5000, -3.2000, TRUE),
('GBPUSD', 'British Pound vs US Dollar', 1, 'GBP', 'USD', 0.0001, 1.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 3.3333, 'floating', 'per_lot', 7.0000, -7.8000, -2.1000, TRUE),
('USDJPY', 'US Dollar vs Japanese Yen', 1, 'USD', 'JPY', 0.0100, 1.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 3.3333, 'floating', 'per_lot', 7.0000, -5.2000, -8.7000, TRUE),
('USDCHF', 'US Dollar vs Swiss Franc', 1, 'USD', 'CHF', 0.0001, 1.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 3.3333, 'floating', 'per_lot', 7.0000, -3.1000, -6.4000, TRUE),
('AUDUSD', 'Australian Dollar vs US Dollar', 1, 'AUD', 'USD', 0.0001, 1.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 3.3333, 'floating', 'per_lot', 7.0000, -4.5000, -2.8000, TRUE),
('USDCAD', 'US Dollar vs Canadian Dollar', 1, 'USD', 'CAD', 0.0001, 1.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 3.3333, 'floating', 'per_lot', 7.0000, -3.7000, -4.9000, TRUE),
('NZDUSD', 'New Zealand Dollar vs US Dollar', 1, 'NZD', 'USD', 0.0001, 1.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 3.3333, 'floating', 'per_lot', 7.0000, -5.1000, -1.8000, TRUE),

-- Cross Currency Pairs
('EURGBP', 'Euro vs British Pound', 1, 'EUR', 'GBP', 0.0001, 1.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 3.3333, 'floating', 'per_lot', 7.0000, -6.2000, -4.5000, TRUE),
('EURJPY', 'Euro vs Japanese Yen', 1, 'EUR', 'JPY', 0.0100, 1.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 3.3333, 'floating', 'per_lot', 7.0000, -7.1000, -2.3000, TRUE),
('GBPJPY', 'British Pound vs Japanese Yen', 1, 'GBP', 'JPY', 0.0100, 1.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 3.3333, 'floating', 'per_lot', 7.0000, -8.4000, -1.7000, TRUE),

-- Commodities
('XAUUSD', 'Gold vs US Dollar', 2, 'XAU', 'USD', 0.0100, 1.0000, 0.0100, 100.0000, 0.0100, 100.0000, 5.0000, 'floating', 'per_lot', 5.0000, -12.5000, -8.7000, TRUE),
('XAGUSD', 'Silver vs US Dollar', 2, 'XAG', 'USD', 0.0010, 1.0000, 0.0100, 100.0000, 0.0100, 5000.0000, 5.0000, 'floating', 'per_lot', 5.0000, -8.3000, -6.2000, TRUE),
('USOIL', 'US Crude Oil', 2, 'OIL', 'USD', 0.0100, 1.0000, 0.0100, 100.0000, 0.0100, 1000.0000, 10.0000, 'floating', 'per_lot', 3.0000, -2.1000, -3.8000, TRUE),

-- Indices
('US30', 'Dow Jones Industrial Average', 3, 'US30', 'USD', 1.0000, 1.0000, 0.0100, 100.0000, 0.0100, 10.0000, 2.0000, 'floating', 'per_lot', 2.0000, -5.0000, -3.0000, TRUE),
('SPX500', 'S&P 500 Index', 3, 'SPX', 'USD', 1.0000, 1.0000, 0.0100, 100.0000, 0.0100, 10.0000, 2.0000, 'floating', 'per_lot', 2.0000, -5.2000, -2.8000, TRUE),
('NAS100', 'NASDAQ 100 Index', 3, 'NAS', 'USD', 1.0000, 1.0000, 0.0100, 100.0000, 0.0100, 10.0000, 2.0000, 'floating', 'per_lot', 2.0000, -6.1000, -3.4000, TRUE),

-- Cryptocurrencies
('BTCUSD', 'Bitcoin vs US Dollar', 4, 'BTC', 'USD', 1.0000, 1.0000, 0.0100, 100.0000, 0.0100, 1.0000, 5.0000, 'floating', 'per_lot', 10.0000, -15.0000, -10.0000, TRUE),
('ETHUSD', 'Ethereum vs US Dollar', 4, 'ETH', 'USD', 1.0000, 1.0000, 0.0100, 100.0000, 0.0100, 1.0000, 5.0000, 'floating', 'per_lot', 10.0000, -12.0000, -8.0000, TRUE);

-- Insert current market prices (sample data)
INSERT INTO market_prices (symbol_id, bid, ask, last, high, low, volume, change_amount, change_percent) VALUES
-- Major Forex
(1, 1.09234, 1.09237, 1.09235, 1.09458, 1.09102, 125000.0000, 0.00123, 0.1127),
(2, 1.26891, 1.26894, 1.26892, 1.27234, 1.26654, 98500.0000, -0.00087, -0.0687),
(3, 149.567, 149.572, 149.569, 150.234, 149.123, 156000.0000, 0.234, 0.1564),
(4, 0.91234, 0.91237, 0.91235, 0.91567, 0.90989, 87600.0000, -0.00156, -0.1705),
(5, 0.67891, 0.67894, 0.67892, 0.68234, 0.67654, 76500.0000, 0.00089, 0.1312),
(6, 1.35678, 1.35681, 1.35679, 1.36123, 1.35234, 92300.0000, -0.00234, -0.1725),
(7, 0.61234, 0.61237, 0.61235, 0.61567, 0.60891, 54200.0000, 0.00067, 0.1095),

-- Cross Pairs
(8, 0.86234, 0.86237, 0.86235, 0.86567, 0.85891, 65400.0000, 0.00034, 0.0394),
(9, 163.456, 163.461, 163.458, 164.123, 163.012, 84300.0000, 0.178, 0.1089),
(10, 189.734, 189.739, 189.736, 190.456, 189.123, 73200.0000, -0.234, -0.1234),

-- Commodities
(11, 2034.56, 2034.89, 2034.72, 2038.45, 2031.23, 23400.0000, 12.34, 0.6098),
(12, 24.567, 24.572, 24.569, 24.789, 24.345, 15600.0000, 0.234, 0.9634),
(13, 89.456, 89.461, 89.458, 90.123, 89.012, 34500.0000, -1.234, -1.3612),

-- Indices
(14, 33456.78, 33457.12, 33456.95, 33567.89, 33345.67, 125000.0000, 123.45, 0.3708),
(15, 4234.56, 4234.59, 4234.57, 4245.67, 4223.45, 98000.0000, 23.45, 0.5573),
(16, 14567.89, 14568.23, 14568.06, 14678.90, 14456.78, 87500.0000, 89.12, 0.6159),

-- Crypto
(17, 43567.89, 43568.45, 43568.17, 44123.45, 43234.56, 5600.0000, 567.89, 1.3204),
(18, 2345.67, 2345.89, 2345.78, 2398.45, 2312.34, 8900.0000, 34.56, 1.4957);

-- Insert some historical price data for charts (last 24 hours worth of hourly data)
INSERT INTO price_history (symbol_id, timeframe, open_price, high_price, low_price, close_price, volume, tick_volume, timestamp) VALUES
-- EURUSD hourly data for last 24 hours
(1, 'H1', 1.09112, 1.09156, 1.09087, 1.09134, 5200.0000, 1250, DATE_SUB(NOW(), INTERVAL 24 HOUR)),
(1, 'H1', 1.09134, 1.09178, 1.09098, 1.09156, 5400.0000, 1180, DATE_SUB(NOW(), INTERVAL 23 HOUR)),
(1, 'H1', 1.09156, 1.09189, 1.09123, 1.09167, 4800.0000, 1340, DATE_SUB(NOW(), INTERVAL 22 HOUR)),
(1, 'H1', 1.09167, 1.09234, 1.09134, 1.09201, 6100.0000, 1450, DATE_SUB(NOW(), INTERVAL 21 HOUR)),
(1, 'H1', 1.09201, 1.09267, 1.09178, 1.09234, 5800.0000, 1320, DATE_SUB(NOW(), INTERVAL 20 HOUR)),
(1, 'H1', 1.09234, 1.09289, 1.09198, 1.09245, 5600.0000, 1280, DATE_SUB(NOW(), INTERVAL 19 HOUR)),
(1, 'H1', 1.09245, 1.09298, 1.09212, 1.09278, 5900.0000, 1390, DATE_SUB(NOW(), INTERVAL 18 HOUR)),
(1, 'H1', 1.09278, 1.09334, 1.09234, 1.09312, 6200.0000, 1420, DATE_SUB(NOW(), INTERVAL 17 HOUR)),
(1, 'H1', 1.09312, 1.09367, 1.09278, 1.09345, 5700.0000, 1350, DATE_SUB(NOW(), INTERVAL 16 HOUR)),
(1, 'H1', 1.09345, 1.09389, 1.09301, 1.09356, 5500.0000, 1290, DATE_SUB(NOW(), INTERVAL 15 HOUR)),
(1, 'H1', 1.09356, 1.09398, 1.09312, 1.09367, 5300.0000, 1260, DATE_SUB(NOW(), INTERVAL 14 HOUR)),
(1, 'H1', 1.09367, 1.09423, 1.09334, 1.09389, 5800.0000, 1380, DATE_SUB(NOW(), INTERVAL 13 HOUR)),
(1, 'H1', 1.09389, 1.09445, 1.09356, 1.09412, 6000.0000, 1410, DATE_SUB(NOW(), INTERVAL 12 HOUR)),
(1, 'H1', 1.09412, 1.09467, 1.09378, 1.09434, 5900.0000, 1390, DATE_SUB(NOW(), INTERVAL 11 HOUR)),
(1, 'H1', 1.09434, 1.09478, 1.09389, 1.09445, 5600.0000, 1320, DATE_SUB(NOW(), INTERVAL 10 HOUR)),
(1, 'H1', 1.09445, 1.09489, 1.09401, 1.09456, 5400.0000, 1280, DATE_SUB(NOW(), INTERVAL 9 HOUR)),
(1, 'H1', 1.09456, 1.09498, 1.09412, 1.09467, 5200.0000, 1250, DATE_SUB(NOW(), INTERVAL 8 HOUR)),
(1, 'H1', 1.09467, 1.09512, 1.09423, 1.09478, 5700.0000, 1340, DATE_SUB(NOW(), INTERVAL 7 HOUR)),
(1, 'H1', 1.09478, 1.09523, 1.09434, 1.09489, 5800.0000, 1370, DATE_SUB(NOW(), INTERVAL 6 HOUR)),
(1, 'H1', 1.09489, 1.09534, 1.09445, 1.09501, 5900.0000, 1390, DATE_SUB(NOW(), INTERVAL 5 HOUR)),
(1, 'H1', 1.09501, 1.09545, 1.09456, 1.09512, 6100.0000, 1430, DATE_SUB(NOW(), INTERVAL 4 HOUR)),
(1, 'H1', 1.09512, 1.09556, 1.09467, 1.09523, 5800.0000, 1360, DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(1, 'H1', 1.09523, 1.09567, 1.09478, 1.09534, 5600.0000, 1320, DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(1, 'H1', 1.09534, 1.09578, 1.09489, 1.09235, 5400.0000, 1280, DATE_SUB(NOW(), INTERVAL 1 HOUR));

-- Add default roles if they don't exist
INSERT IGNORE INTO roles (id, name, description, is_admin) VALUES
(1, 'Super Admin', 'Full system access', TRUE),
(2, 'Admin', 'Administrative access', TRUE),
(3, 'Manager', 'Management access', FALSE),
(4, 'Support', 'Customer support access', FALSE),
(5, 'Analyst', 'Market analysis access', FALSE),
(6, 'Trader', 'Advanced trading features', FALSE),
(7, 'User', 'Basic user access', FALSE);