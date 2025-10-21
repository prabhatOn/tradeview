-- =====================================================
-- Migration: 006 - Add auto_square_percent to trading_accounts
-- Description: Add per-account admin-configurable auto square-off threshold (percentage of balance)
-- Date: 2025-10-18
-- =====================================================

SET @dbname = DATABASE();

-- Add auto_square_percent if not exists
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'trading_accounts' AND COLUMN_NAME = 'auto_square_percent');
SET @query = IF(@col_exists = 0, 
    'ALTER TABLE trading_accounts ADD COLUMN auto_square_percent DECIMAL(5,2) NULL DEFAULT NULL COMMENT ''Auto square-off threshold % of balance'' AFTER stop_out_level',
    'SELECT ''Column auto_square_percent already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT '✓ Migration 006 completed (auto_square_percent)' AS status;

-- Rollback (manual)
-- To rollback this migration, run:
/*
ALTER TABLE trading_accounts DROP COLUMN auto_square_percent;
*/
