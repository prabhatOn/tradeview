-- =====================================================
-- Migration: 001 - Enhance Trading Accounts Table
-- Description: Add margin management, leverage, and risk control fields
-- Date: 2025-10-17
-- =====================================================

-- Check and add new columns only if they don't exist
SET @dbname = DATABASE();

-- Add margin_used if not exists
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'trading_accounts' AND COLUMN_NAME = 'margin_used');
SET @query = IF(@col_exists = 0, 
    'ALTER TABLE trading_accounts ADD COLUMN margin_used DECIMAL(15,4) DEFAULT 0.0000 COMMENT ''Total margin currently used by open positions'' AFTER free_margin',
    'SELECT ''Column margin_used already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add margin_call_level if not exists
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'trading_accounts' AND COLUMN_NAME = 'margin_call_level');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE trading_accounts ADD COLUMN margin_call_level DECIMAL(5,2) DEFAULT 50.00 COMMENT ''Margin level % that triggers margin call warning'' AFTER margin_level',
    'SELECT ''Column margin_call_level already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add stop_out_level if not exists
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'trading_accounts' AND COLUMN_NAME = 'stop_out_level');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE trading_accounts ADD COLUMN stop_out_level DECIMAL(5,2) DEFAULT 20.00 COMMENT ''Margin level % that triggers automatic position closure'' AFTER margin_call_level',
    'SELECT ''Column stop_out_level already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add trading_power if not exists
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'trading_accounts' AND COLUMN_NAME = 'trading_power');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE trading_accounts ADD COLUMN trading_power DECIMAL(15,4) DEFAULT 0.0000 COMMENT ''Balance × Leverage = Available trading power'' AFTER leverage',
    'SELECT ''Column trading_power already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add is_demo if not exists
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'trading_accounts' AND COLUMN_NAME = 'is_demo');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE trading_accounts ADD COLUMN is_demo BOOLEAN DEFAULT FALSE COMMENT ''Flag for demo vs live account'' AFTER account_type',
    'SELECT ''Column is_demo already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add max_leverage if not exists
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'trading_accounts' AND COLUMN_NAME = 'max_leverage');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE trading_accounts ADD COLUMN max_leverage DECIMAL(10,2) DEFAULT 100.00 COMMENT ''Maximum allowed leverage for this account'' AFTER leverage',
    'SELECT ''Column max_leverage already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add min_margin_requirement if not exists
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'trading_accounts' AND COLUMN_NAME = 'min_margin_requirement');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE trading_accounts ADD COLUMN min_margin_requirement DECIMAL(8,4) DEFAULT 1.0000 COMMENT ''Minimum margin requirement percentage''',
    'SELECT ''Column min_margin_requirement already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add indexes only if they don't exist
SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'trading_accounts' AND INDEX_NAME = 'idx_margin_level');
SET @query = IF(@index_exists = 0,
    'CREATE INDEX idx_margin_level ON trading_accounts(margin_level)',
    'SELECT ''Index idx_margin_level already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'trading_accounts' AND INDEX_NAME = 'idx_is_demo');
SET @query = IF(@index_exists = 0,
    'CREATE INDEX idx_is_demo ON trading_accounts(is_demo)',
    'SELECT ''Index idx_is_demo already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'trading_accounts' AND INDEX_NAME = 'idx_margin_used');
SET @query = IF(@index_exists = 0,
    'CREATE INDEX idx_margin_used ON trading_accounts(margin_used)',
    'SELECT ''Index idx_margin_used already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing accounts to calculate initial trading power
UPDATE trading_accounts 
SET trading_power = balance * leverage
WHERE trading_power = 0.0000 OR trading_power IS NULL;

SELECT '✓ Migration 001 completed successfully' AS status;

-- =====================================================
-- Verification Queries (Comment out after migration)
-- =====================================================

-- SELECT 
--     account_number,
--     balance,
--     leverage,
--     trading_power,
--     margin_used,
--     free_margin,
--     margin_level,
--     margin_call_level,
--     stop_out_level
-- FROM trading_accounts
-- LIMIT 5;

-- =====================================================
-- Rollback Script (Keep for emergency)
-- =====================================================

-- To rollback this migration, run:
/*
ALTER TABLE trading_accounts
DROP COLUMN margin_used,
DROP COLUMN margin_call_level,
DROP COLUMN stop_out_level,
DROP COLUMN trading_power,
DROP COLUMN is_demo,
DROP COLUMN max_leverage,
DROP COLUMN min_margin_requirement;

DROP INDEX idx_margin_level ON trading_accounts;
DROP INDEX idx_is_demo ON trading_accounts;
DROP INDEX idx_margin_used ON trading_accounts;

ALTER TABLE trading_accounts
MODIFY COLUMN account_type ENUM('demo', 'live', 'islamic') NOT NULL;
*/
