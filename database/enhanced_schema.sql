-- Enhanced Database Schema for Professional Forex Trading Platform
-- Adds missing tables and fields for complete forex trading functionality
-- Phase 1: Database Schema Enhancement

-- =================================================================
-- 1. ENHANCE USER REGISTRATION FIELDS
-- =================================================================

-- Add professional forex trader fields to users table
ALTER TABLE users 
ADD COLUMN country VARCHAR(3),
ADD COLUMN preferred_currency VARCHAR(3) DEFAULT 'USD',
ADD COLUMN preferred_leverage DECIMAL(10,2) DEFAULT 100.00,
ADD COLUMN phone_country_code VARCHAR(5),
ADD COLUMN address TEXT,
ADD COLUMN city VARCHAR(100),
ADD COLUMN postal_code VARCHAR(20),
ADD COLUMN gender ENUM('male', 'female', 'other'),
ADD COLUMN occupation VARCHAR(100),
ADD COLUMN experience_level ENUM('beginner', 'intermediate', 'expert') DEFAULT 'beginner',
ADD COLUMN annual_income_range ENUM('0-25k', '25k-50k', '50k-100k', '100k-250k', '250k+'),
ADD COLUMN trading_experience_years INT DEFAULT 0,
ADD COLUMN risk_tolerance ENUM('low', 'medium', 'high') DEFAULT 'medium',
ADD COLUMN investment_goals TEXT;

-- Ensure symbols support configurable spread markups
ALTER TABLE symbols
ADD COLUMN IF NOT EXISTS spread_markup DECIMAL(10,4) DEFAULT 0.0000 AFTER spread_type;

-- =================================================================
-- 2. API KEYS MANAGEMENT SYSTEM
-- =================================================================

CREATE TABLE api_keys (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    key_name VARCHAR(100) NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    api_secret VARCHAR(128) NOT NULL,
    permissions JSON NOT NULL, -- ['read', 'trade', 'admin']
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    usage_count INT DEFAULT 0,
    rate_limit_per_hour INT DEFAULT 1000,
    ip_whitelist JSON, -- ['192.168.1.1', '10.0.0.1']
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_api_key (api_key),
    INDEX idx_active (is_active),
    INDEX idx_expires_at (expires_at)
);

-- API usage tracking
CREATE TABLE api_usage_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    api_key_id INT NOT NULL,
    endpoint VARCHAR(200) NOT NULL,
    method ENUM('GET', 'POST', 'PUT', 'DELETE', 'PATCH') NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_data JSON,
    response_status INT,
    response_time_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
    INDEX idx_api_key_id (api_key_id),
    INDEX idx_created_at (created_at),
    INDEX idx_endpoint (endpoint)
);

-- =================================================================
-- 3. INTRODUCING BROKER (REFERRAL) SYSTEM
-- =================================================================

CREATE TABLE introducing_brokers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ib_user_id INT NOT NULL, -- The IB (referring user)
    client_user_id INT NOT NULL, -- The referred client
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    commission_rate DECIMAL(5,4) DEFAULT 0.0070, -- 70 cents per lot default
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    tier_level ENUM('bronze', 'silver', 'gold', 'platinum') DEFAULT 'bronze',
    total_commission_earned DECIMAL(15,4) DEFAULT 0.0000,
    total_client_volume DECIMAL(15,4) DEFAULT 0.0000,
    active_clients_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (ib_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (client_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_ib_user (ib_user_id),
    INDEX idx_client_user (client_user_id),
    INDEX idx_referral_code (referral_code),
    INDEX idx_status (status),
    UNIQUE KEY unique_ib_client (ib_user_id, client_user_id)
);

-- IB commission tracking
CREATE TABLE ib_commissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ib_relationship_id INT NOT NULL,
    trade_id INT, -- Reference to the trade that generated commission
    position_id INT, -- Reference to position that generated commission
    commission_amount DECIMAL(15,4) NOT NULL,
    commission_rate DECIMAL(5,4) NOT NULL,
    trade_volume DECIMAL(15,4),
    currency VARCHAR(3) DEFAULT 'USD',
    paid_at TIMESTAMP NULL,
    status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
    payment_method ENUM('account_credit', 'bank_transfer', 'check') DEFAULT 'account_credit',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (ib_relationship_id) REFERENCES introducing_brokers(id) ON DELETE CASCADE,
    FOREIGN KEY (trade_id) REFERENCES trade_history(id) ON DELETE SET NULL,
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL,
    INDEX idx_ib_relationship (ib_relationship_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_paid_at (paid_at)
);

-- Referral codes for new user signups
CREATE TABLE referral_codes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INT DEFAULT 0,
    max_usage INT DEFAULT NULL, -- NULL for unlimited
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_code (code),
    INDEX idx_active (is_active)
);

-- =================================================================
-- 4. TRADING CHARGES & COMMISSION SYSTEM
-- =================================================================

CREATE TABLE trading_charges (
    id INT PRIMARY KEY AUTO_INCREMENT,
    symbol_id INT,
    account_type ENUM('demo', 'live', 'islamic') DEFAULT 'live',
    charge_type ENUM('commission', 'spread_markup', 'swap_long', 'swap_short') NOT NULL,
    charge_value DECIMAL(10,4) NOT NULL,
    charge_unit ENUM('per_lot', 'percentage', 'fixed', 'pips') NOT NULL,
    tier_level ENUM('standard', 'gold', 'platinum', 'vip') DEFAULT 'standard',
    is_active BOOLEAN DEFAULT TRUE,
    effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    effective_until TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
    INDEX idx_symbol (symbol_id),
    INDEX idx_type (charge_type),
    INDEX idx_tier (tier_level),
    INDEX idx_active (is_active),
    INDEX idx_effective (effective_from, effective_until)
);

-- =================================================================
-- 5. PAYMENT GATEWAY SYSTEM
-- =================================================================

CREATE TABLE payment_gateways (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    type ENUM('bank_transfer', 'credit_card', 'debit_card', 'crypto', 'e_wallet', 'wire_transfer') NOT NULL,
    provider VARCHAR(50), -- stripe, paypal, coinbase, etc.
    is_active BOOLEAN DEFAULT TRUE,
    min_amount DECIMAL(15,4) DEFAULT 0.0000,
    max_amount DECIMAL(15,4) DEFAULT 999999.9999,
    processing_fee_type ENUM('fixed', 'percentage') DEFAULT 'percentage',
    processing_fee_value DECIMAL(10,4) DEFAULT 0.0000,
    processing_time_hours INT DEFAULT 24,
    supported_currencies JSON, -- ['USD', 'EUR', 'GBP']
    configuration JSON, -- Gateway-specific config
    sort_order INT DEFAULT 0,
    icon_url VARCHAR(500),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_name (name),
    INDEX idx_type (type),
    INDEX idx_active (is_active),
    INDEX idx_sort_order (sort_order)
);

-- =================================================================
-- 5A. BANK ACCOUNTS FOR LOCAL TRANSFERS
-- =================================================================

CREATE TABLE bank_accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    payment_gateway_id INT NULL,
    label VARCHAR(120) NOT NULL,
    bank_name VARCHAR(150) NOT NULL,
    account_name VARCHAR(150) NOT NULL,
    account_number VARCHAR(120) NOT NULL,
    account_type ENUM('personal', 'business') DEFAULT 'business',
    iban VARCHAR(60),
    swift_code VARCHAR(60),
    routing_number VARCHAR(60),
    branch_name VARCHAR(150),
    branch_address VARCHAR(255),
    country VARCHAR(100),
    currency VARCHAR(3) DEFAULT 'USD',
    instructions TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0.00,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (payment_gateway_id) REFERENCES payment_gateways(id) ON DELETE SET NULL,
    INDEX idx_gateway (payment_gateway_id),
    INDEX idx_active (is_active),
    INDEX idx_sort_order (sort_order)
);

-- =================================================================
-- 6. ENHANCED TRANSACTION MANAGEMENT
-- =================================================================

-- Add missing fields to existing transactions table
ALTER TABLE transactions 
ADD COLUMN payment_gateway_id INT,
ADD COLUMN transaction_fee DECIMAL(15,4) DEFAULT 0.0000,
ADD COLUMN exchange_rate DECIMAL(12,6) DEFAULT 1.000000,
ADD COLUMN reference_number VARCHAR(100),
ADD COLUMN external_transaction_id VARCHAR(200),
ADD COLUMN admin_notes TEXT,
ADD COLUMN processed_by INT, -- Admin user who processed
ADD COLUMN processed_at TIMESTAMP NULL,
ADD COLUMN batch_id INT, -- For batch processing
ADD COLUMN priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
ADD COLUMN notification_sent BOOLEAN DEFAULT FALSE;

-- Add foreign key constraints
ALTER TABLE transactions 
ADD FOREIGN KEY (payment_gateway_id) REFERENCES payment_gateways(id),
ADD FOREIGN KEY (processed_by) REFERENCES users(id);

-- Add additional indexes
ALTER TABLE transactions 
ADD INDEX idx_payment_gateway (payment_gateway_id),
ADD INDEX idx_processed_by (processed_by),
ADD INDEX idx_batch_id (batch_id),
ADD INDEX idx_priority (priority),
ADD INDEX idx_reference_number (reference_number);

-- =================================================================
-- 7. ADMIN MANAGEMENT ENHANCEMENTS
-- =================================================================

-- Admin actions log
CREATE TABLE admin_actions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    admin_user_id INT NOT NULL,
    action_type ENUM('user_suspend', 'user_activate', 'user_lock', 'user_unlock', 'balance_adjustment', 'transaction_approve', 'transaction_reject', 'settings_change') NOT NULL,
    target_user_id INT,
    target_table VARCHAR(50),
    target_record_id INT,
    action_data JSON, -- Store the action details
    reason TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_admin_user (admin_user_id),
    INDEX idx_target_user (target_user_id),
    INDEX idx_action_type (action_type),
    INDEX idx_created_at (created_at)
);

-- Support tickets system
CREATE TABLE support_tickets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    category ENUM('account', 'trading', 'deposit', 'withdrawal', 'technical', 'general') NOT NULL,
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    status ENUM('open', 'in_progress', 'waiting_user', 'resolved', 'closed') DEFAULT 'open',
    subject VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    assigned_to INT, -- Admin user assigned
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_ticket_number (ticket_number),
    INDEX idx_status (status),
    INDEX idx_assigned_to (assigned_to),
    INDEX idx_created_at (created_at)
);

-- Support ticket messages
CREATE TABLE support_ticket_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ticket_id INT NOT NULL,
    sender_id INT NOT NULL,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE, -- Internal admin notes
    attachments JSON, -- File attachments
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_ticket_id (ticket_id),
    INDEX idx_sender_id (sender_id),
    INDEX idx_created_at (created_at)
);

-- =================================================================
-- 8. SYSTEM CONFIGURATION
-- =================================================================

CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    category VARCHAR(50) DEFAULT 'general',
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE, -- Can be accessed by non-admin users
    updated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_setting_key (setting_key),
    INDEX idx_category (category),
    INDEX idx_public (is_public)
);

-- =================================================================
-- 9. INSERT DEFAULT DATA
-- =================================================================

-- Insert default payment gateways
INSERT INTO payment_gateways (name, display_name, type, is_active, min_amount, max_amount, processing_fee_type, processing_fee_value, processing_time_hours, supported_currencies, description) VALUES
('bank_transfer', 'Bank Transfer', 'bank_transfer', TRUE, 100.00, 50000.00, 'fixed', 0.00, 24, '["USD", "EUR", "GBP"]', 'Secure bank wire transfer'),
('credit_card', 'Credit Card', 'credit_card', TRUE, 50.00, 5000.00, 'percentage', 2.50, 1, '["USD", "EUR", "GBP"]', 'Instant credit card deposits'),
('debit_card', 'Debit Card', 'debit_card', TRUE, 50.00, 5000.00, 'percentage', 2.00, 1, '["USD", "EUR", "GBP"]', 'Instant debit card deposits'),
('crypto_btc', 'Bitcoin', 'crypto', TRUE, 100.00, 10000.00, 'percentage', 1.00, 6, '["USD", "EUR", "GBP"]', 'Bitcoin cryptocurrency deposits'),
('paypal', 'PayPal', 'e_wallet', TRUE, 25.00, 2500.00, 'percentage', 3.00, 2, '["USD", "EUR", "GBP"]', 'PayPal e-wallet transfers');

-- Insert default trading charges
INSERT INTO trading_charges (symbol_id, charge_type, charge_value, charge_unit, tier_level) VALUES
(1, 'commission', 7.00, 'per_lot', 'standard'), -- EURUSD commission
(2, 'commission', 7.00, 'per_lot', 'standard'), -- GBPUSD commission
(3, 'commission', 7.00, 'per_lot', 'standard'), -- USDJPY commission
(1, 'commission', 5.00, 'per_lot', 'gold'),     -- EURUSD gold tier
(2, 'commission', 5.00, 'per_lot', 'gold'),     -- GBPUSD gold tier
(3, 'commission', 5.00, 'per_lot', 'gold');     -- USDJPY gold tier

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, is_public) VALUES
('site_name', 'ForexTrade Pro', 'string', 'general', 'Website name', TRUE),
('default_leverage', '100', 'number', 'trading', 'Default leverage for new accounts', FALSE),
('max_leverage', '500', 'number', 'trading', 'Maximum allowed leverage', FALSE),
('min_deposit', '100', 'number', 'financial', 'Minimum deposit amount', TRUE),
('max_daily_withdrawal', '10000', 'number', 'financial', 'Maximum daily withdrawal limit', FALSE),
('commission_rate_standard', '7.00', 'number', 'trading', 'Standard commission rate per lot', FALSE),
('ib_default_commission', '0.70', 'number', 'ib', 'Default IB commission rate', FALSE);

-- =================================================================
-- 10. CREATE INDEXES FOR PERFORMANCE
-- =================================================================

-- Performance indexes for large tables
CREATE INDEX idx_positions_user_status ON positions(user_id, status);
CREATE INDEX idx_positions_account_status ON positions(account_id, status);
CREATE INDEX idx_trade_history_user_date ON trade_history(user_id, created_at);
CREATE INDEX idx_trade_history_account_date ON trade_history(account_id, created_at);
CREATE INDEX idx_transactions_user_status ON transactions(user_id, status);
CREATE INDEX idx_transactions_type_status ON transactions(transaction_type, status);

-- Composite indexes for common queries
CREATE INDEX idx_users_status_created ON users(status, created_at);
CREATE INDEX idx_trading_accounts_user_status ON trading_accounts(user_id, status);
CREATE INDEX idx_market_prices_symbol_timestamp ON market_prices(symbol_id, timestamp);