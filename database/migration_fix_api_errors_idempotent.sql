-- Idempotent migration to add missing columns and table for API fixes
-- Safe to run multiple times. Uses IF NOT EXISTS where supported and INSERT IGNORE.
-- Date: October 23, 2025

USE pro2;

-- Add auto_square_percent to trading_accounts if missing
ALTER TABLE trading_accounts
  ADD COLUMN IF NOT EXISTS auto_square_percent DECIMAL(5,2) DEFAULT NULL COMMENT 'Auto square-off threshold % of balance';

-- Add individual columns to ib_commissions if missing (separate ALTERs are safer)
ALTER TABLE ib_commissions
  ADD COLUMN IF NOT EXISTS total_commission DECIMAL(15,4) NOT NULL DEFAULT 0.0000 COMMENT 'Total commission before split';
ALTER TABLE ib_commissions
  ADD COLUMN IF NOT EXISTS ib_share_percent DECIMAL(5,2) NOT NULL DEFAULT 50.00 COMMENT 'IB share percentage at time of trade';
ALTER TABLE ib_commissions
  ADD COLUMN IF NOT EXISTS ib_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000 COMMENT 'Amount going to IB';
ALTER TABLE ib_commissions
  ADD COLUMN IF NOT EXISTS admin_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000 COMMENT 'Amount retained by admin';
ALTER TABLE ib_commissions
  ADD COLUMN IF NOT EXISTS client_commission DECIMAL(15,4) DEFAULT 0.0000 COMMENT 'Commission paid by client';
ALTER TABLE ib_commissions
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD';
ALTER TABLE ib_commissions
  ADD COLUMN IF NOT EXISTS payment_method ENUM('account_credit','bank_transfer','check') DEFAULT 'account_credit';
ALTER TABLE ib_commissions
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- Create ib_global_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS ib_global_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_setting_key (setting_key),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default IB global settings (ignore duplicates)
INSERT IGNORE INTO ib_global_settings (setting_key, setting_value, description) VALUES
('default_ib_share_percent', '50.0', 'Default percentage of commission that goes to IB'),
('min_ib_share_percent', '10.0', 'Minimum allowed IB share percentage'),
('max_ib_share_percent', '90.0', 'Maximum allowed IB share percentage'),
('default_commission_rate', '0.0070', 'Default commission rate for new IB relationships'),
('ib_tier_bronze_threshold', '0', 'Commission threshold for bronze tier'),
('ib_tier_silver_threshold', '1000.00', 'Commission threshold for silver tier'),
('ib_tier_gold_threshold', '5000.00', 'Commission threshold for gold tier'),
('ib_tier_platinum_threshold', '10000.00', 'Commission threshold for platinum tier');

COMMIT;
