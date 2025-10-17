-- =====================================================
-- Migration: 003 - Create Trading Charges Table
-- Description: Comprehensive trading charges configuration system
-- Date: 2025-10-17
-- =====================================================

-- Create trading_charges table for flexible charge management
CREATE TABLE IF NOT EXISTS trading_charges (
    id INT PRIMARY KEY AUTO_INCREMENT,
    symbol_id INT NULL COMMENT 'Specific symbol (NULL = applies to all symbols)',
    account_type ENUM('live', 'islamic', 'professional') NULL COMMENT 'Specific account type (NULL = applies to all types)',
    tier_level ENUM('standard', 'premium', 'vip', 'professional') DEFAULT 'standard' COMMENT 'Client tier for preferential pricing',
    charge_type ENUM('commission', 'spread', 'swap_long', 'swap_short', 'carry_forward', 'overnight_fee') NOT NULL COMMENT 'Type of charge to apply',
    charge_value DECIMAL(10,4) NOT NULL COMMENT 'Charge amount (interpretation depends on charge_unit)',
    charge_unit ENUM('per_lot', 'percentage', 'fixed', 'pips') DEFAULT 'per_lot' COMMENT 'How charge_value is calculated',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Enable/disable this charge rule',
    effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When this charge rule becomes active',
    effective_until TIMESTAMP NULL COMMENT 'When this charge rule expires (NULL = no expiry)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
    INDEX idx_symbol_charge (symbol_id, charge_type),
    INDEX idx_account_type (account_type),
    INDEX idx_tier_level (tier_level),
    INDEX idx_active (is_active),
    INDEX idx_charge_type (charge_type),
    INDEX idx_effective_dates (effective_from, effective_until)
) COMMENT='Flexible trading charges configuration - allows global or symbol-specific charges';

-- =====================================================
-- Insert Default Charges
-- =====================================================

-- Global commission charge (applies to all symbols)
INSERT INTO trading_charges 
(symbol_id, account_type, tier_level, charge_type, charge_value, charge_unit, is_active) 
VALUES
-- Commission charges by tier
(NULL, NULL, 'standard', 'commission', 7.00, 'per_lot', TRUE),
(NULL, NULL, 'premium', 'commission', 5.00, 'per_lot', TRUE),
(NULL, NULL, 'vip', 'commission', 3.00, 'per_lot', TRUE),
(NULL, NULL, 'professional', 'commission', 2.00, 'per_lot', TRUE),

-- Carry forward charges (multi-day position holding)
(NULL, NULL, 'standard', 'carry_forward', 2.50, 'per_lot', TRUE),
(NULL, NULL, 'premium', 'carry_forward', 2.00, 'per_lot', TRUE),
(NULL, NULL, 'vip', 'carry_forward', 1.50, 'per_lot', TRUE),
(NULL, NULL, 'professional', 'carry_forward', 1.00, 'per_lot', TRUE),

-- Overnight fees (weekend/holiday holding)
(NULL, NULL, 'standard', 'overnight_fee', 1.00, 'per_lot', TRUE),
(NULL, NULL, 'premium', 'overnight_fee', 0.75, 'per_lot', TRUE),
(NULL, NULL, 'vip', 'overnight_fee', 0.50, 'per_lot', TRUE),
(NULL, NULL, 'professional', 'overnight_fee', 0.25, 'per_lot', TRUE);

-- =====================================================
-- Copy Existing Symbol-Specific Charges
-- =====================================================

-- Copy swap rates from symbols table to trading_charges
-- This makes swap rates configurable and version-controlled
INSERT INTO trading_charges 
(symbol_id, account_type, tier_level, charge_type, charge_value, charge_unit, is_active)
SELECT 
    id,
    NULL,
    'standard',
    'swap_long',
    swap_long,
    'per_lot',
    TRUE
FROM symbols
WHERE swap_long IS NOT NULL AND swap_long != 0;

INSERT INTO trading_charges 
(symbol_id, account_type, tier_level, charge_type, charge_value, charge_unit, is_active)
SELECT 
    id,
    NULL,
    'standard',
    'swap_short',
    swap_short,
    'per_lot',
    TRUE
FROM symbols
WHERE swap_short IS NOT NULL AND swap_short != 0;

-- Copy commission values from symbols table
INSERT INTO trading_charges 
(symbol_id, account_type, tier_level, charge_type, charge_value, charge_unit, is_active)
SELECT 
    id,
    NULL,
    'standard',
    'commission',
    commission_value,
    'per_lot',
    TRUE
FROM symbols
WHERE commission_value IS NOT NULL AND commission_value != 0
ON DUPLICATE KEY UPDATE charge_value = VALUES(charge_value);

-- =====================================================
-- Create User Tier Assignments Table
-- =====================================================

-- Track which users have premium/vip status
CREATE TABLE IF NOT EXISTS user_tier_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    tier_level ENUM('standard', 'premium', 'vip', 'professional') NOT NULL DEFAULT 'standard',
    assigned_by INT NULL COMMENT 'Admin user who assigned this tier',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    effective_until TIMESTAMP NULL COMMENT 'Tier expiry date (NULL = permanent)',
    reason TEXT COMMENT 'Why this tier was assigned',
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_user_active_tier (user_id, is_active),
    INDEX idx_user_tier (user_id, tier_level),
    INDEX idx_active (is_active),
    INDEX idx_effective_dates (effective_from, effective_until)
) COMMENT='Track user tier assignments for preferential pricing';

-- Assign all existing users to standard tier
INSERT INTO user_tier_assignments (user_id, tier_level, is_active)
SELECT id, 'standard', TRUE
FROM users
WHERE id NOT IN (SELECT user_id FROM user_tier_assignments WHERE is_active = TRUE);

-- =====================================================
-- Verification Queries (Comment out after migration)
-- =====================================================

-- Check default charges
/*
SELECT 
    id,
    COALESCE(symbol_id, 'ALL') as symbol,
    COALESCE(account_type, 'ALL') as account_type,
    tier_level,
    charge_type,
    charge_value,
    charge_unit,
    is_active
FROM trading_charges
WHERE is_active = TRUE
ORDER BY tier_level, charge_type;
*/

-- Check user tiers
/*
SELECT 
    u.id,
    u.email,
    uta.tier_level,
    uta.effective_from
FROM users u
LEFT JOIN user_tier_assignments uta ON u.id = uta.user_id AND uta.is_active = TRUE
LIMIT 10;
*/

-- =====================================================
-- Helper Views (Optional)
-- =====================================================

-- View to easily see effective charges for any symbol/account/tier combination
CREATE OR REPLACE VIEW v_effective_charges AS
SELECT 
    tc.id,
    COALESCE(s.symbol, 'GLOBAL') as symbol,
    COALESCE(tc.account_type, 'ALL') as account_type,
    tc.tier_level,
    tc.charge_type,
    tc.charge_value,
    tc.charge_unit,
    tc.is_active,
    tc.effective_from,
    tc.effective_until
FROM trading_charges tc
LEFT JOIN symbols s ON tc.symbol_id = s.id
WHERE tc.is_active = TRUE
AND (tc.effective_from IS NULL OR tc.effective_from <= NOW())
AND (tc.effective_until IS NULL OR tc.effective_until >= NOW());

-- =====================================================
-- Rollback Script (Keep for emergency)
-- =====================================================

-- To rollback this migration, run:
/*
DROP TABLE IF EXISTS user_tier_assignments;
DROP TABLE IF EXISTS trading_charges;
DROP VIEW IF EXISTS v_effective_charges;
*/
