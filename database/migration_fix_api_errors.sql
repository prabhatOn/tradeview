-- Migration to add missing columns and table for API fixes
-- Date: October 23, 2025
-- This migration adds the missing database elements that are causing API errors

USE pro2;

-- Add auto_square_percent column to trading_accounts table
ALTER TABLE trading_accounts
ADD COLUMN auto_square_percent DECIMAL(5,2) DEFAULT NULL COMMENT 'Auto square-off threshold % of balance';

-- Add missing columns to ib_commissions table
ALTER TABLE ib_commissions
ADD COLUMN total_commission DECIMAL(15,4) NOT NULL DEFAULT 0.0000 COMMENT 'Total commission before split',
ADD COLUMN ib_share_percent DECIMAL(5,2) NOT NULL DEFAULT 50.00 COMMENT 'IB share percentage at time of trade',
ADD COLUMN ib_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000 COMMENT 'Amount going to IB',
ADD COLUMN admin_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000 COMMENT 'Amount retained by admin',
ADD COLUMN client_commission DECIMAL(15,4) DEFAULT 0.0000 COMMENT 'Commission paid by client',
ADD COLUMN currency VARCHAR(3) DEFAULT 'USD',
ADD COLUMN payment_method ENUM('account_credit','bank_transfer','check') DEFAULT 'account_credit',
ADD COLUMN notes TEXT DEFAULT NULL;

-- Create ib_global_settings table
CREATE TABLE ib_global_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_setting_key (setting_key),
    INDEX idx_is_active (is_active)
);

-- Insert default IB global settings
INSERT INTO ib_global_settings (setting_key, setting_value, description) VALUES
('default_ib_share_percent', '50.0', 'Default percentage of commission that goes to IB'),
('min_ib_share_percent', '10.0', 'Minimum allowed IB share percentage'),
('max_ib_share_percent', '90.0', 'Maximum allowed IB share percentage'),
('default_commission_rate', '0.0070', 'Default commission rate for new IB relationships'),
('ib_tier_bronze_threshold', '0', 'Commission threshold for bronze tier'),
('ib_tier_silver_threshold', '1000.00', 'Commission threshold for silver tier'),
('ib_tier_gold_threshold', '5000.00', 'Commission threshold for gold tier'),
('ib_tier_platinum_threshold', '10000.00', 'Commission threshold for platinum tier');

COMMIT;