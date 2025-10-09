-- Performance Optimization Indexes for Trading Platform
-- Run this script to add missing indexes for better query performance

-- Optimize position lookups by account and status
CREATE INDEX IF NOT EXISTS idx_positions_account_status ON positions(account_id, status);

-- Optimize position lookups by symbol
CREATE INDEX IF NOT EXISTS idx_positions_symbol_status ON positions(symbol_id, status);

-- Optimize recent positions queries
CREATE INDEX IF NOT EXISTS idx_positions_opened_at ON positions(opened_at DESC);

-- Optimize position updates
CREATE INDEX IF NOT EXISTS idx_positions_updated_at ON positions(updated_at DESC);

-- Optimize user position lookups (via trading_accounts)
CREATE INDEX IF NOT EXISTS idx_trading_accounts_user_id ON trading_accounts(user_id);

-- Optimize market price lookups for real-time calculations
CREATE INDEX IF NOT EXISTS idx_market_prices_symbol_timestamp ON market_prices(symbol_id, timestamp DESC);

-- Optimize symbol lookups
CREATE INDEX IF NOT EXISTS idx_symbols_active ON symbols(is_active);

-- Optimize trade history queries
CREATE INDEX IF NOT EXISTS idx_trade_history_account_date ON trade_history(account_id, closed_at DESC);

-- Composite index for position queries with symbol joins
CREATE INDEX IF NOT EXISTS idx_positions_composite ON positions(account_id, status, symbol_id);

-- Show index usage statistics (for monitoring)
-- You can uncomment and run this to see index effectiveness:
-- SHOW INDEX FROM positions;
-- SHOW INDEX FROM trading_accounts;
-- SHOW INDEX FROM market_prices;

ANALYZE TABLE positions;
ANALYZE TABLE trading_accounts;
ANALYZE TABLE market_prices;
ANALYZE TABLE symbols;
ANALYZE TABLE trade_history;