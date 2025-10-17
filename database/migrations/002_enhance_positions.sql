-- =====================================================
-- Migration: 002 - Enhance Positions Table  
-- Description: Add margin tracking, swap charges, order types, and advanced position management
-- Date: 2025-10-17
-- =====================================================

SET @dbname = DATABASE();

-- margin_required
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'positions' AND COLUMN_NAME = 'margin_required');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE positions ADD COLUMN margin_required DECIMAL(15,4) DEFAULT 0.0000 COMMENT ''Margin locked for this position'' AFTER lot_size',
    'SELECT ''margin_required exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- swap_long
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'positions' AND COLUMN_NAME = 'swap_long');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE positions ADD COLUMN swap_long DECIMAL(10,4) DEFAULT 0.0000 COMMENT ''Swap rate for long positions'' AFTER swap',
    'SELECT ''swap_long exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- swap_short
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'positions' AND COLUMN_NAME = 'swap_short');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE positions ADD COLUMN swap_short DECIMAL(10,4) DEFAULT 0.0000 COMMENT ''Swap rate for short positions'' AFTER swap_long',
    'SELECT ''swap_short exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- daily_swap_charge
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'positions' AND COLUMN_NAME = 'daily_swap_charge');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE positions ADD COLUMN daily_swap_charge DECIMAL(10,4) DEFAULT 0.0000 COMMENT ''Last applied daily swap charge'' AFTER swap_short',
    'SELECT ''daily_swap_charge exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- days_held
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'positions' AND COLUMN_NAME = 'days_held');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE positions ADD COLUMN days_held INT DEFAULT 0 COMMENT ''Number of days position has been held'' AFTER daily_swap_charge',
    'SELECT ''days_held exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- carry_forward_charge
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'positions' AND COLUMN_NAME = 'carry_forward_charge');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE positions ADD COLUMN carry_forward_charge DECIMAL(10,4) DEFAULT 0.0000 COMMENT ''Total carry forward charges'' AFTER days_held',
    'SELECT ''carry_forward_charge exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- spread_charge
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'positions' AND COLUMN_NAME = 'spread_charge');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE positions ADD COLUMN spread_charge DECIMAL(10,4) DEFAULT 0.0000 COMMENT ''Spread cost at position opening'' AFTER carry_forward_charge',
    'SELECT ''spread_charge exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- total_charges
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'positions' AND COLUMN_NAME = 'total_charges');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE positions ADD COLUMN total_charges DECIMAL(10,4) DEFAULT 0.0000 COMMENT ''Sum of all charges'' AFTER spread_charge',
    'SELECT ''total_charges exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- net_profit
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'positions' AND COLUMN_NAME = 'net_profit');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE positions ADD COLUMN net_profit DECIMAL(12,4) DEFAULT 0.0000 COMMENT ''Gross profit minus all charges'' AFTER profit',
    'SELECT ''net_profit exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Update order_type enum to include stop and stop_limit
SET @current_type = (SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'positions' AND COLUMN_NAME = 'order_type');
SET @has_all = IF(@current_type LIKE '%stop%' AND @current_type LIKE '%stop_limit%', 1, 0);
SET @query = IF(@has_all = 0,
    'ALTER TABLE positions MODIFY COLUMN order_type ENUM(''market'',''limit'',''stop'',''stop_limit'') DEFAULT ''market'' COMMENT ''Type of order''',
    'SELECT ''order_type already has all values'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- is_triggered
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'positions' AND COLUMN_NAME = 'is_triggered');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE positions ADD COLUMN is_triggered BOOLEAN DEFAULT FALSE COMMENT ''Whether pending order has been triggered'' AFTER trigger_price',
    'SELECT ''is_triggered exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- execution_price
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'positions' AND COLUMN_NAME = 'execution_price');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE positions ADD COLUMN execution_price DECIMAL(12,6) NULL COMMENT ''Actual execution price'' AFTER is_triggered',
    'SELECT ''execution_price exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- slippage
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'positions' AND COLUMN_NAME = 'slippage');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE positions ADD COLUMN slippage DECIMAL(10,4) DEFAULT 0.0000 COMMENT ''Difference between trigger and execution price'' AFTER execution_price',
    'SELECT ''slippage exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Update status enum
SET @current_status = (SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'positions' AND COLUMN_NAME = 'status');
SET @has_all_status = IF(@current_status LIKE '%cancelled%' AND @current_status LIKE '%expired%', 1, 0);
SET @query = IF(@has_all_status = 0,
    'ALTER TABLE positions MODIFY COLUMN status ENUM(''pending'',''open'',''closed'',''partially_closed'',''cancelled'',''expired'') DEFAULT ''pending'' COMMENT ''Position lifecycle''',
    'SELECT ''status already has all values'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add indexes
SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'positions' AND INDEX_NAME = 'idx_is_triggered');
SET @query = IF(@index_exists = 0,
    'CREATE INDEX idx_is_triggered ON positions(is_triggered)',
    'SELECT ''idx_is_triggered exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'positions' AND INDEX_NAME = 'idx_days_held');
SET @query = IF(@index_exists = 0,
    'CREATE INDEX idx_days_held ON positions(days_held)',
    'SELECT ''idx_days_held exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'positions' AND INDEX_NAME = 'idx_margin_required');
SET @query = IF(@index_exists = 0,
    'CREATE INDEX idx_margin_required ON positions(margin_required)',
    'SELECT ''idx_margin_required exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT '✓ Migration 002 completed successfully' AS status;
