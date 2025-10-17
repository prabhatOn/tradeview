-- =====================================================
-- Migration: 004 - Enhance IB Commission System
-- Description: Admin-configurable IB settings with global commission rate and IB share percentage
-- Date: 2025-10-17
-- =====================================================

SET @dbname = DATABASE();

-- =====================================================
-- Create IB Global Settings Table
-- =====================================================

CREATE TABLE IF NOT EXISTS ib_global_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value DECIMAL(10,4) NOT NULL,
    setting_description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_setting_key (setting_key),
    INDEX idx_is_active (is_active)
) COMMENT='Global IB configuration - admin controls commission rates and share percentages';

-- Insert default IB settings
INSERT IGNORE INTO ib_global_settings (setting_key, setting_value, setting_description) VALUES
('default_commission_rate', 0.0070, 'Default commission rate as decimal (0.0070 = 0.70%)'),
('default_ib_share_percent', 50.00, 'Default percentage of commission that IBs receive'),
('min_ib_share_percent', 10.00, 'Minimum IB share percentage allowed'),
('max_ib_share_percent', 90.00, 'Maximum IB share percentage allowed'),
('commission_calculation_method', 1.00, '1=per trade, 2=per lot, 3=percentage');

-- =====================================================
-- Enhance introducing_brokers Table
-- =====================================================

-- custom_commission_rate
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'introducing_brokers' AND COLUMN_NAME = 'custom_commission_rate');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE introducing_brokers ADD COLUMN custom_commission_rate DECIMAL(10,4) NULL COMMENT ''Custom rate for this IB (overrides global)'' AFTER commission_rate',
    'SELECT ''custom_commission_rate exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- use_custom_rate
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'introducing_brokers' AND COLUMN_NAME = 'use_custom_rate');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE introducing_brokers ADD COLUMN use_custom_rate BOOLEAN DEFAULT FALSE COMMENT ''Whether to use custom rate or global rate'' AFTER custom_commission_rate',
    'SELECT ''use_custom_rate exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- total_admin_share
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'introducing_brokers' AND COLUMN_NAME = 'total_admin_share');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE introducing_brokers ADD COLUMN total_admin_share DECIMAL(15,4) DEFAULT 0.0000 COMMENT ''Total admin portion of commissions'' AFTER total_commission_earned',
    'SELECT ''total_admin_share exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- total_ib_share
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'introducing_brokers' AND COLUMN_NAME = 'total_ib_share');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE introducing_brokers ADD COLUMN total_ib_share DECIMAL(15,4) DEFAULT 0.0000 COMMENT ''Total IB portion of commissions'' AFTER total_admin_share',
    'SELECT ''total_ib_share exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- last_commission_date
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'introducing_brokers' AND COLUMN_NAME = 'last_commission_date');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE introducing_brokers ADD COLUMN last_commission_date TIMESTAMP NULL COMMENT ''Last time commission was earned'' AFTER total_ib_share',
    'SELECT ''last_commission_date exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ib_share_percent (add this column if it doesn't exist)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'introducing_brokers' AND COLUMN_NAME = 'ib_share_percent');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE introducing_brokers ADD COLUMN ib_share_percent DECIMAL(5,2) DEFAULT 50.00 NOT NULL COMMENT ''Percentage of commission this IB receives (10-90)'' AFTER commission_rate',
    'ALTER TABLE introducing_brokers MODIFY COLUMN ib_share_percent DECIMAL(5,2) DEFAULT 50.00 NOT NULL COMMENT ''Percentage of commission this IB receives (10-90)''');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- Enhance ib_commissions Table
-- =====================================================

-- total_commission
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ib_commissions' AND COLUMN_NAME = 'total_commission');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE ib_commissions ADD COLUMN total_commission DECIMAL(15,4) NOT NULL DEFAULT 0.0000 COMMENT ''Total commission before split'' AFTER commission_rate',
    'SELECT ''total_commission exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ib_share_percent
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ib_commissions' AND COLUMN_NAME = 'ib_share_percent');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE ib_commissions ADD COLUMN ib_share_percent DECIMAL(5,2) NOT NULL DEFAULT 50.00 COMMENT ''IB share percentage at time of trade'' AFTER total_commission',
    'SELECT ''ib_share_percent exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ib_amount
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ib_commissions' AND COLUMN_NAME = 'ib_amount');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE ib_commissions ADD COLUMN ib_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000 COMMENT ''Amount going to IB'' AFTER ib_share_percent',
    'SELECT ''ib_amount exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- admin_amount
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ib_commissions' AND COLUMN_NAME = 'admin_amount');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE ib_commissions ADD COLUMN admin_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000 COMMENT ''Amount retained by admin'' AFTER ib_amount',
    'SELECT ''admin_amount exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- client_commission
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ib_commissions' AND COLUMN_NAME = 'client_commission');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE ib_commissions ADD COLUMN client_commission DECIMAL(15,4) DEFAULT 0.0000 COMMENT ''Commission paid by client'' AFTER admin_amount',
    'SELECT ''client_commission exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- currency
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ib_commissions' AND COLUMN_NAME = 'currency');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE ib_commissions MODIFY COLUMN currency VARCHAR(3) DEFAULT ''USD'' COMMENT ''Currency of commission''',
    'SELECT ''currency column modified'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- payment_method
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ib_commissions' AND COLUMN_NAME = 'payment_method');
SET @query = IF(@col_exists = 0,
    'ALTER TABLE ib_commissions MODIFY COLUMN payment_method ENUM(''account_credit'',''bank_transfer'',''check'',''pending'') DEFAULT ''pending''',
    'SELECT ''payment_method column modified'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add indexes
SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ib_commissions' AND INDEX_NAME = 'idx_ib_relationship');
SET @query = IF(@index_exists = 0,
    'CREATE INDEX idx_ib_relationship ON ib_commissions(ib_relationship_id)',
    'SELECT ''idx_ib_relationship exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ib_commissions' AND INDEX_NAME = 'idx_status');
SET @query = IF(@index_exists = 0,
    'CREATE INDEX idx_status ON ib_commissions(status)',
    'SELECT ''idx_status exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ib_commissions' AND INDEX_NAME = 'idx_created_at');
SET @query = IF(@index_exists = 0,
    'CREATE INDEX idx_created_at ON ib_commissions(created_at)',
    'SELECT ''idx_created_at exists'' AS msg');
PREPARE stmt FROM @query; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- Create helper views
-- =====================================================

CREATE OR REPLACE VIEW v_ib_commission_summary AS
SELECT 
    ib.id as ib_id,
    ib.ib_user_id,
    u.email as ib_email,
    u.first_name,
    u.last_name,
    ib.ib_share_percent,
    COUNT(ic.id) as total_trades,
    SUM(ic.trade_volume) as total_volume,
    SUM(ic.total_commission) as total_commission,
    SUM(ic.ib_amount) as total_ib_earnings,
    SUM(ic.admin_amount) as total_admin_earnings,
    ib.status as ib_status,
    ib.last_commission_date
FROM introducing_brokers ib
JOIN users u ON ib.ib_user_id = u.id
LEFT JOIN ib_commissions ic ON ic.ib_relationship_id = ib.id
GROUP BY ib.id, ib.ib_user_id, u.email, u.first_name, u.last_name, ib.ib_share_percent, ib.status, ib.last_commission_date;

SELECT '✓ Migration 004 completed successfully - IB commission system enhanced' AS status;
