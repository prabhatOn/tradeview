-- Complete Trading Platform Database Schema
-- Comprehensive schema with all required tables for the trading platform
-- Includes proper normalization, indexes, and relationships
-- Created: October 23, 2025

-- =================================================================
-- DATABASE SETUP
-- =================================================================

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS pro2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pro2;

-- Set SQL mode and timezone
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

-- =================================================================
-- USER MANAGEMENT TABLES
-- =================================================================

-- Users table (core user information)
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    uuid VARCHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    phone_number VARCHAR(50),
    date_of_birth DATE,
    address VARCHAR(500),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'India',
    avatar_url VARCHAR(500),
    bio TEXT,
    status ENUM('active', 'inactive', 'suspended', 'pending_verification') DEFAULT 'pending_verification',
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    kyc_status ENUM('pending', 'submitted', 'approved', 'rejected') DEFAULT 'pending',
    kyc_submitted_at TIMESTAMP NULL,
    kyc_approved_at TIMESTAMP NULL,
    kyc_rejection_reason VARCHAR(500) NULL,
    preferred_leverage DECIMAL(8,2) DEFAULT 100.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,

    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- User roles and permissions
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User role assignments
CREATE TABLE user_roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,

    UNIQUE KEY unique_user_role (user_id, role_id),
    INDEX idx_user_id (user_id),
    INDEX idx_role_id (role_id)
);

-- User addresses
CREATE TABLE user_addresses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('billing', 'mailing', 'both') DEFAULT 'both',
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country_code VARCHAR(3) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_country (country_code)
);

-- User settings and preferences
CREATE TABLE user_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_setting (user_id, setting_key),
    INDEX idx_user_id (user_id)
);

-- =================================================================
-- TRADING ACCOUNT MANAGEMENT
-- =================================================================

-- Trading accounts (users can have multiple accounts)
CREATE TABLE trading_accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    account_number VARCHAR(50) UNIQUE NOT NULL,
    account_type ENUM('demo', 'live', 'islamic') NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    leverage DECIMAL(10,2) DEFAULT 1.00,
    balance DECIMAL(15,4) DEFAULT 0.0000,
    equity DECIMAL(15,4) DEFAULT 0.0000,
    used_margin DECIMAL(15,4) DEFAULT 0.0000,
    free_margin DECIMAL(15,4) DEFAULT 0.0000,
    margin_level DECIMAL(8,2) DEFAULT 0.00,
    auto_square_percent DECIMAL(5,2) DEFAULT NULL COMMENT 'Auto square-off threshold % of balance',
    status ENUM('active', 'inactive', 'frozen', 'closed') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_account_number (account_number),
    INDEX idx_status (status)
);

-- Account balance history for audit trail
CREATE TABLE account_balance_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    account_id INT NOT NULL,
    previous_balance DECIMAL(15,4),
    new_balance DECIMAL(15,4),
    change_amount DECIMAL(15,4),
    change_type ENUM('deposit', 'withdrawal', 'trade_profit', 'trade_loss', 'commission', 'swap', 'adjustment', 'manual_credit', 'manual_debit', 'admin_adjustment', 'bonus') NOT NULL,
    change_context ENUM('deposit', 'withdrawal', 'trade', 'adjustment', 'bonus', 'correction', 'system') DEFAULT 'trade',
    reference_id INT,
    reference_type VARCHAR(50),
    performed_by_type ENUM('user', 'admin', 'system') DEFAULT 'user',
    performed_by_id INT,
    metadata JSON,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_account_id (account_id),
    INDEX idx_change_type (change_type),
    INDEX idx_context (change_context),
    INDEX idx_performed_by_id (performed_by_id),
    INDEX idx_created_at (created_at)
);

-- =================================================================
-- FINANCIAL INSTRUMENTS & MARKET DATA
-- =================================================================

-- Asset categories
CREATE TABLE asset_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Financial instruments/symbols
CREATE TABLE symbols (
    id INT PRIMARY KEY AUTO_INCREMENT,
    symbol VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    category_id INT NOT NULL,
    base_currency VARCHAR(10),
    quote_currency VARCHAR(10),
    pip_size DECIMAL(10,8) DEFAULT 0.0001,
    lot_size DECIMAL(12,4) DEFAULT 100000.0000,
    min_lot DECIMAL(8,4) DEFAULT 0.0100,
    max_lot DECIMAL(12,4) DEFAULT 100.0000,
    lot_step DECIMAL(8,4) DEFAULT 0.0100,
    contract_size DECIMAL(12,4) DEFAULT 100000.0000,
    margin_requirement DECIMAL(8,4) DEFAULT 1.0000,
    spread_type ENUM('fixed', 'floating') DEFAULT 'floating',
    spread_markup DECIMAL(10,4) DEFAULT 0.0000,
    commission_type ENUM('per_lot', 'percentage', 'fixed') DEFAULT 'per_lot',
    commission_value DECIMAL(10,4) DEFAULT 0.0000,
    swap_long DECIMAL(10,4) DEFAULT 0.0000,
    swap_short DECIMAL(10,4) DEFAULT 0.0000,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (category_id) REFERENCES asset_categories(id),
    INDEX idx_symbol (symbol),
    INDEX idx_category (category_id),
    INDEX idx_active (is_active)
);

-- Real-time market prices
CREATE TABLE market_prices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    symbol_id INT NOT NULL,
    bid DECIMAL(12,6) NOT NULL,
    ask DECIMAL(12,6) NOT NULL,
    last DECIMAL(12,6),
    high DECIMAL(12,6),
    low DECIMAL(12,6),
    volume DECIMAL(15,4) DEFAULT 0.0000,
    change_amount DECIMAL(12,6) DEFAULT 0.000000,
    change_percent DECIMAL(8,4) DEFAULT 0.0000,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
    INDEX idx_symbol_id (symbol_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_symbol_timestamp (symbol_id, timestamp)
);

-- Historical price data (OHLC)
CREATE TABLE price_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    symbol_id INT NOT NULL,
    timeframe ENUM('M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1') NOT NULL,
    open_price DECIMAL(12,6) NOT NULL,
    high_price DECIMAL(12,6) NOT NULL,
    low_price DECIMAL(12,6) NOT NULL,
    close_price DECIMAL(12,6) NOT NULL,
    volume DECIMAL(15,4) DEFAULT 0.0000,
    tick_volume INT DEFAULT 0,
    timestamp TIMESTAMP NOT NULL,

    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
    UNIQUE KEY unique_symbol_timeframe_time (symbol_id, timeframe, timestamp),
    INDEX idx_symbol_timeframe (symbol_id, timeframe),
    INDEX idx_timestamp (timestamp)
);

-- Historical market data (alternative format)
CREATE TABLE market_data (
    id INT PRIMARY KEY AUTO_INCREMENT,
    symbol_id INT NOT NULL,
    date DATE NOT NULL,
    open_price DECIMAL(12,6) NOT NULL,
    high_price DECIMAL(12,6) NOT NULL,
    low_price DECIMAL(12,6) NOT NULL,
    close_price DECIMAL(12,6) NOT NULL,
    current_price DECIMAL(12,6),
    volume DECIMAL(15,4) DEFAULT 0.0000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
    UNIQUE KEY unique_symbol_date (symbol_id, date),
    INDEX idx_symbol_id (symbol_id),
    INDEX idx_date (date)
);

-- =================================================================
-- TRADING ORDERS & POSITIONS
-- =================================================================

-- Orders table (pending orders)
CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    account_id INT NOT NULL,
    symbol_id INT NOT NULL,
    order_type ENUM('market', 'limit', 'stop', 'stop_limit') NOT NULL,
    side ENUM('buy', 'sell') NOT NULL,
    lot_size DECIMAL(8,4) NOT NULL,
    price DECIMAL(12,6),
    stop_loss DECIMAL(12,6),
    take_profit DECIMAL(12,6),
    expiry_date TIMESTAMP NULL,
    status ENUM('pending', 'filled', 'partially_filled', 'cancelled', 'rejected', 'expired') DEFAULT 'pending',
    filled_lot_size DECIMAL(8,4) DEFAULT 0.0000,
    average_fill_price DECIMAL(12,6),
    commission DECIMAL(10,4) DEFAULT 0.0000,
    swap DECIMAL(10,4) DEFAULT 0.0000,
    comment TEXT,
    magic_number INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    filled_at TIMESTAMP NULL,

    FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (symbol_id) REFERENCES symbols(id),
    INDEX idx_account_id (account_id),
    INDEX idx_symbol_id (symbol_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Positions table (open trades)
CREATE TABLE positions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    account_id INT NOT NULL,
    symbol_id INT NOT NULL,
    order_id INT,
    side ENUM('buy', 'sell') NOT NULL,
    lot_size DECIMAL(8,4) NOT NULL,
    open_price DECIMAL(12,6) NOT NULL,
    current_price DECIMAL(12,6),
    close_price DECIMAL(12,6),
    stop_loss DECIMAL(12,6),
    take_profit DECIMAL(12,6),
    commission DECIMAL(10,4) DEFAULT 0.0000,
    swap DECIMAL(10,4) DEFAULT 0.0000,
    profit DECIMAL(12,4) DEFAULT 0.0000,
    profit_loss DECIMAL(12,4) DEFAULT 0.0000,
    status ENUM('open', 'closed', 'partially_closed') DEFAULT 'open',
    close_reason ENUM('manual', 'stop_loss', 'take_profit', 'margin_call', 'system') DEFAULT 'manual',
    comment TEXT,
    magic_number INT,
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    close_time TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (symbol_id) REFERENCES symbols(id),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    INDEX idx_account_id (account_id),
    INDEX idx_symbol_id (symbol_id),
    INDEX idx_status (status),
    INDEX idx_opened_at (opened_at),
    INDEX idx_closed_at (closed_at),
    INDEX idx_close_time (close_time),
    INDEX idx_close_reason (close_reason)
);

-- Trade history (closed positions)
CREATE TABLE trade_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    account_id INT NOT NULL,
    symbol_id INT NOT NULL,
    position_id INT,
    side ENUM('buy', 'sell') NOT NULL,
    lot_size DECIMAL(8,4) NOT NULL,
    open_price DECIMAL(12,6) NOT NULL,
    close_price DECIMAL(12,6) NOT NULL,
    stop_loss DECIMAL(12,6),
    take_profit DECIMAL(12,6),
    commission DECIMAL(10,4) DEFAULT 0.0000,
    swap DECIMAL(10,4) DEFAULT 0.0000,
    profit DECIMAL(12,4) NOT NULL,
    duration_minutes INT,
    close_reason ENUM('manual', 'stop_loss', 'take_profit', 'margin_call', 'system') DEFAULT 'manual',
    comment TEXT,
    magic_number INT,
    opened_at TIMESTAMP NOT NULL,
    closed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (symbol_id) REFERENCES symbols(id),
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL,
    INDEX idx_account_id (account_id),
    INDEX idx_symbol_id (symbol_id),
    INDEX idx_profit (profit),
    INDEX idx_closed_at (closed_at),
    INDEX idx_opened_at (opened_at)
);

-- =================================================================
-- FINANCIAL TRANSACTIONS
-- =================================================================

-- Payment gateways
CREATE TABLE payment_gateways (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    type ENUM('bank_transfer', 'credit_card', 'debit_card', 'crypto', 'e_wallet', 'wire_transfer') NOT NULL,
    provider VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    min_amount DECIMAL(15,4) DEFAULT 0.0000,
    max_amount DECIMAL(15,4) DEFAULT 999999.9999,
    processing_fee_type ENUM('fixed', 'percentage') DEFAULT 'percentage',
    processing_fee_value DECIMAL(10,4) DEFAULT 0.0000,
    processing_time_hours INT DEFAULT 24,
    supported_currencies JSON,
    configuration JSON,
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

-- Bank accounts for local transfers
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

-- Payment methods
CREATE TABLE payment_methods (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    type ENUM('bank_transfer', 'credit_card', 'debit_card', 'ewallet', 'crypto', 'check') NOT NULL,
    provider VARCHAR(100),
    supported_currencies JSON,
    min_amount DECIMAL(10,2) DEFAULT 0.00,
    max_amount DECIMAL(15,2),
    deposit_fee_type ENUM('fixed', 'percentage') DEFAULT 'percentage',
    deposit_fee_value DECIMAL(8,4) DEFAULT 0.0000,
    withdrawal_fee_type ENUM('fixed', 'percentage') DEFAULT 'percentage',
    withdrawal_fee_value DECIMAL(8,4) DEFAULT 0.0000,
    processing_time_hours INT DEFAULT 24,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_type (type),
    INDEX idx_active (is_active)
);

-- Deposit transactions
CREATE TABLE deposits (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    account_id INT NOT NULL,
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    payment_method_id INT NOT NULL,
    amount DECIMAL(15,4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    fee DECIMAL(10,4) DEFAULT 0.0000,
    net_amount DECIMAL(15,4) NOT NULL,
    status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'rejected') DEFAULT 'pending',
    payment_reference VARCHAR(255),
    gateway_transaction_id VARCHAR(255),
    gateway_response JSON,
    admin_notes TEXT,
    user_notes TEXT,
    reviewed_by INT,
    reviewed_at TIMESTAMP NULL,
    review_notes TEXT,
    processed_by INT,
    processed_at TIMESTAMP NULL,
    batch_reference VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_account_id (account_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_reviewed_by (reviewed_by),
    INDEX idx_batch_reference (batch_reference),
    INDEX idx_transaction_id (transaction_id)
);

-- Withdrawal transactions
CREATE TABLE withdrawals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    account_id INT NOT NULL,
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    payment_method_id INT NOT NULL,
    amount DECIMAL(15,4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    fee DECIMAL(10,4) DEFAULT 0.0000,
    net_amount DECIMAL(15,4) NOT NULL,
    status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'rejected') DEFAULT 'pending',
    payment_reference VARCHAR(255),
    gateway_transaction_id VARCHAR(255),
    gateway_response JSON,
    admin_notes TEXT,
    user_notes TEXT,
    reviewed_by INT,
    reviewed_at TIMESTAMP NULL,
    review_notes TEXT,
    processed_by INT,
    processed_at TIMESTAMP NULL,
    batch_reference VARCHAR(100),
    payment_gateway_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_account_id (account_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_reviewed_by (reviewed_by),
    INDEX idx_batch_reference (batch_reference),
    INDEX idx_withdrawal_gateway (payment_gateway_id),
    INDEX idx_transaction_id (transaction_id)
);

-- Fund transactions (general transaction logging)
CREATE TABLE fund_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    account_id INT NOT NULL,
    transaction_type ENUM('deposit', 'withdrawal', 'transfer', 'adjustment', 'fee', 'commission', 'swap', 'bonus') NOT NULL,
    amount DECIMAL(15,4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    balance_before DECIMAL(15,4),
    balance_after DECIMAL(15,4),
    reference_id INT,
    reference_type VARCHAR(50),
    description TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_account_id (account_id),
    INDEX idx_transaction_type (transaction_type),
    INDEX idx_created_at (created_at)
);

-- =================================================================
-- MAM/PAMM (Multi-Account Management)
-- =================================================================

-- MAM/PAMM master accounts
CREATE TABLE mam_pamm_masters (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    account_id INT NOT NULL,
    strategy_name VARCHAR(200) NOT NULL,
    strategy_description TEXT,
    management_type ENUM('MAM', 'PAMM') NOT NULL,
    allocation_method ENUM('equal', 'proportional', 'custom') DEFAULT 'proportional',
    performance_fee_percent DECIMAL(5,2) DEFAULT 0.00,
    high_water_mark BOOLEAN DEFAULT TRUE,
    min_investment DECIMAL(15,4) DEFAULT 1000.0000,
    max_investors INT DEFAULT 100,
    status ENUM('active', 'inactive', 'closed') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_management_type (management_type)
);

-- MAM/PAMM investor accounts
CREATE TABLE mam_pamm_investors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    master_id INT NOT NULL,
    user_id INT NOT NULL,
    account_id INT NOT NULL,
    invested_amount DECIMAL(15,4) NOT NULL,
    current_equity DECIMAL(15,4) DEFAULT 0.0000,
    allocation_percent DECIMAL(8,4),
    join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'inactive', 'withdrawn') DEFAULT 'active',

    FOREIGN KEY (master_id) REFERENCES mam_pamm_masters(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE,
    UNIQUE KEY unique_master_investor (master_id, account_id),
    INDEX idx_master_id (master_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
);

-- MAM/PAMM performance tracking
CREATE TABLE mam_pamm_performance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    master_id INT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_return_percent DECIMAL(8,4),
    total_trades INT DEFAULT 0,
    winning_trades INT DEFAULT 0,
    losing_trades INT DEFAULT 0,
    profit_factor DECIMAL(8,4),
    sharpe_ratio DECIMAL(8,4),
    max_drawdown_percent DECIMAL(8,4),
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (master_id) REFERENCES mam_pamm_masters(id) ON DELETE CASCADE,
    UNIQUE KEY unique_master_period (master_id, period_start, period_end),
    INDEX idx_master_id (master_id),
    INDEX idx_period (period_start, period_end)
);

-- =================================================================
-- INTRODUCING BROKER SYSTEM
-- =================================================================

-- Introducing broker relationships
CREATE TABLE introducing_brokers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ib_user_id INT NOT NULL,
    client_user_id INT NOT NULL,
    referral_code VARCHAR(20) UNIQUE,
    commission_rate DECIMAL(8,6) DEFAULT 0.007000,
    ib_share_percent DECIMAL(5,2) DEFAULT 50.00,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    tier_level INT DEFAULT 1,
    total_commission_earned DECIMAL(15,4) DEFAULT 0.0000,
    total_client_volume DECIMAL(15,4) DEFAULT 0.0000,
    active_clients_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (ib_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (client_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_ib_client (ib_user_id, client_user_id),
    INDEX idx_ib_user_id (ib_user_id),
    INDEX idx_client_user_id (client_user_id),
    INDEX idx_status (status)
);

-- IB commissions tracking
CREATE TABLE ib_commissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ib_relationship_id INT NOT NULL,
    trade_id INT,
    position_id INT,
    client_user_id INT NOT NULL,
    commission_amount DECIMAL(12,4) NOT NULL,
    commission_rate DECIMAL(8,6) NOT NULL,
    total_commission DECIMAL(15,4) NOT NULL DEFAULT 0.0000 COMMENT 'Total commission before split',
    ib_share_percent DECIMAL(5,2) NOT NULL DEFAULT 50.00 COMMENT 'IB share percentage at time of trade',
    ib_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000 COMMENT 'Amount going to IB',
    admin_amount DECIMAL(15,4) NOT NULL DEFAULT 0.0000 COMMENT 'Amount retained by admin',
    client_commission DECIMAL(15,4) DEFAULT 0.0000 COMMENT 'Commission paid by client',
    trade_volume DECIMAL(12,4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    profit DECIMAL(12,4) DEFAULT 0.0000,
    symbol VARCHAR(20),
    side ENUM('buy', 'sell'),
    lot_size DECIMAL(8,4),
    payment_method ENUM('account_credit','bank_transfer','check') DEFAULT 'account_credit',
    notes TEXT DEFAULT NULL,
    status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (ib_relationship_id) REFERENCES introducing_brokers(id) ON DELETE CASCADE,
    FOREIGN KEY (trade_id) REFERENCES trade_history(id) ON DELETE SET NULL,
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL,
    FOREIGN KEY (client_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_ib_relationship_id (ib_relationship_id),
    INDEX idx_trade_id (trade_id),
    INDEX idx_position_id (position_id),
    INDEX idx_client_user_id (client_user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- IB Global Settings
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

-- Referral codes
CREATE TABLE referral_codes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    max_usage INT,
    usage_count INT DEFAULT 0,
    expires_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_code (code),
    INDEX idx_active (is_active)
);

-- IB applications
CREATE TABLE ib_applications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    application_data JSON,
    notes TEXT,
    reviewed_by INT,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uniq_user (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- =================================================================
-- SUPPORT & COMMUNICATION
-- =================================================================

-- Support ticket categories
CREATE TABLE support_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    priority_level ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Support tickets
CREATE TABLE support_tickets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    subject VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    status ENUM('open', 'in_progress', 'waiting_user', 'resolved', 'closed') DEFAULT 'open',
    assigned_to INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES support_categories(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_created_at (created_at),
    INDEX idx_ticket_number (ticket_number)
);

-- Support ticket responses
CREATE TABLE support_responses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ticket_id INT NOT NULL,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    attachments JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_ticket_id (ticket_id),
    INDEX idx_created_at (created_at)
);

-- =================================================================
-- KYC & DOCUMENT MANAGEMENT
-- =================================================================

-- KYC documents
CREATE TABLE kyc_documents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    document_type ENUM('passport', 'drivers_license', 'national_id', 'utility_bill', 'bank_statement', 'proof_of_address', 'other') NOT NULL,
    document_number VARCHAR(100),
    document_front_url VARCHAR(255) NULL,
    document_back_url VARCHAR(255) NULL,
    mime_type VARCHAR(100) NULL,
    file_size INT NULL,
    status ENUM('submitted','verified','rejected') DEFAULT 'submitted',
    rejection_reason TEXT,
    submitted_at TIMESTAMP NULL,
    verified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    reviewed_by INT,
    reviewed_at TIMESTAMP NULL,
    expires_at DATE,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_document_type (document_type)
);

-- User bank details
CREATE TABLE bank_details (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    bank_name VARCHAR(150) NOT NULL,
    account_name VARCHAR(150) NOT NULL,
    account_number VARCHAR(120) NOT NULL,
    account_type ENUM('personal', 'business') DEFAULT 'personal',
    iban VARCHAR(60),
    swift_code VARCHAR(60),
    routing_number VARCHAR(60),
    branch_name VARCHAR(150),
    branch_address VARCHAR(255),
    country VARCHAR(100),
    currency VARCHAR(3) DEFAULT 'USD',
    is_verified BOOLEAN DEFAULT FALSE,
    is_primary BOOLEAN DEFAULT FALSE,
    verification_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
    verification_date TIMESTAMP NULL,
    account_holder_name VARCHAR(150),
    ifsc_code VARCHAR(20),
    verified_at TIMESTAMP NULL,
    status ENUM('pending_verification','verified','rejected') DEFAULT 'pending_verification',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_verified (is_verified),
    INDEX idx_is_primary (is_primary)
);

-- =================================================================
-- API MANAGEMENT
-- =================================================================

-- API keys for users
CREATE TABLE api_keys (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    key_name VARCHAR(100) NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    api_secret VARCHAR(128) NOT NULL,
    api_secret_hash VARCHAR(128) NOT NULL,
    permissions JSON NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP NULL,
    last_used_at TIMESTAMP NULL,
    usage_count INT DEFAULT 0,
    rate_limit_per_hour INT DEFAULT 1000,
    ip_whitelist JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_api_key (api_key),
    INDEX idx_active (is_active)
);

-- API usage logs
CREATE TABLE api_usage_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    api_key_id INT NOT NULL,
    user_id INT NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INT NOT NULL,
    response_time_ms INT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_data JSON,
    response_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_api_key_id (api_key_id),
    INDEX idx_user_id (user_id),
    INDEX idx_endpoint (endpoint),
    INDEX idx_created_at (created_at)
);

-- =================================================================
-- SYSTEM CONFIGURATION & SETTINGS
-- =================================================================

-- System settings
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_setting_key (setting_key),
    INDEX idx_is_public (is_public)
);

-- Trading sessions and market hours
CREATE TABLE trading_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    symbol_id INT NOT NULL,
    session_name VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    days_of_week VARCHAR(7) NOT NULL, -- 1234567 where 1=Monday
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT TRUE,

    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
    INDEX idx_symbol_id (symbol_id),
    INDEX idx_active (is_active)
);

-- =================================================================
-- TRADING CHARGES & FEES
-- =================================================================

-- Trading charges configuration
CREATE TABLE trading_charges (
    id INT PRIMARY KEY AUTO_INCREMENT,
    symbol_id INT,
    account_type ENUM('live', 'demo') DEFAULT 'live',
    charge_type ENUM('commission', 'spread', 'swap', 'margin') NOT NULL,
    charge_value DECIMAL(10,4) NOT NULL,
    charge_unit ENUM('fixed', 'percentage', 'per_lot', 'per_contract') DEFAULT 'fixed',
    tier_level INT DEFAULT 1,
    min_volume DECIMAL(12,4),
    max_volume DECIMAL(12,4),
    is_active BOOLEAN DEFAULT TRUE,
    effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    effective_to TIMESTAMP NULL,
    -- Backwards-compatible column used by some services: keep both names to avoid runtime errors
    effective_until TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
    INDEX idx_symbol_id (symbol_id),
    INDEX idx_account_type (account_type),
    INDEX idx_charge_type (charge_type),
    INDEX idx_active (is_active)
);

-- Swap charges log
CREATE TABLE swap_charges_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    position_id INT NOT NULL,
    account_id INT NOT NULL,
    symbol_id INT NOT NULL,
    swap_amount DECIMAL(10,4) NOT NULL,
    swap_rate DECIMAL(10,6),
    charged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
    INDEX idx_position_id (position_id),
    INDEX idx_account_id (account_id),
    INDEX idx_charged_at (charged_at)
);

-- =================================================================
-- MARGIN MANAGEMENT
-- =================================================================

-- Margin events (calls, stops, warnings)
CREATE TABLE margin_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    account_id INT NOT NULL,
    event_type ENUM('margin_call', 'stop_out', 'margin_warning', 'margin_reset') NOT NULL,
    margin_level DECIMAL(8,2),
    equity DECIMAL(15,4),
    used_margin DECIMAL(15,4),
    free_margin DECIMAL(15,4),
    required_margin DECIMAL(15,4),
    triggered_positions JSON,
    action_taken VARCHAR(255),
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE,
    INDEX idx_account_id (account_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at)
);

-- =================================================================
-- AUDIT LOGS & ADMIN ACTIONS
-- =================================================================

-- Audit log for important system events
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at),
    INDEX idx_table_record (table_name, record_id)
);

-- Admin actions log
CREATE TABLE admin_actions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    admin_user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id INT,
    details JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_admin_user_id (admin_user_id),
    INDEX idx_action (action),
    INDEX idx_target (target_type, target_id),
    INDEX idx_created_at (created_at)
);

-- User activity log
CREATE TABLE user_activity_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    details JSON,
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_action_type (action_type),
    INDEX idx_created_at (created_at)
);

-- =================================================================
-- NOTIFICATIONS & ALERTS
-- =================================================================

-- Notification templates
CREATE TABLE notification_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    type ENUM('email', 'sms', 'push', 'in_app') NOT NULL,
    subject VARCHAR(500),
    body TEXT NOT NULL,
    variables JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_name (name),
    INDEX idx_type (type),
    INDEX idx_active (is_active)
);

-- User notifications
CREATE TABLE user_notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    template_id INT,
    type ENUM('email', 'sms', 'push', 'in_app') NOT NULL,
    title VARCHAR(500),
    message TEXT NOT NULL,
    data JSON,
    status ENUM('pending', 'sent', 'delivered', 'failed', 'read') DEFAULT 'pending',
    sent_at TIMESTAMP NULL,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES notification_templates(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_type (type),
    INDEX idx_created_at (created_at)
);

-- Price alerts set by users
CREATE TABLE price_alerts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    symbol_id INT NOT NULL,
    alert_type ENUM('price_above', 'price_below', 'price_change_percent') NOT NULL,
    trigger_value DECIMAL(12,6) NOT NULL,
    current_value DECIMAL(12,6),
    is_triggered BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    message TEXT,
    triggered_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_symbol_id (symbol_id),
    INDEX idx_active (is_active),
    INDEX idx_triggered (is_triggered)
);

-- =================================================================
-- MIGRATION TRACKING
-- =================================================================

-- Migration tracking table
CREATE TABLE migrations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INT,
    executed_by VARCHAR(100),

    INDEX idx_migration_name (migration_name),
    INDEX idx_executed_at (executed_at)
);

-- =================================================================
-- SAMPLE DATA INSERTION
-- =================================================================

-- Insert default roles
INSERT INTO roles (name, description, is_admin) VALUES
('Admin', 'Full system administrator access', TRUE),
('Manager', 'Account manager with limited admin access', TRUE),
('Support', 'Customer support representative', TRUE),
('VIP', 'VIP trading account', FALSE),
('Premium', 'Premium trading account', FALSE),
('Professional', 'Professional trading account', FALSE),
('Basic', 'Basic trading account', FALSE),
('IB', 'Introducing Broker', FALSE);

-- Insert admin user
INSERT INTO users (uuid, email, password_hash, first_name, last_name, status, email_verified, kyc_status, preferred_leverage) VALUES
(UUID(), 'admin@tradingplatform.com', '$2a$12$FoTes8mde67ZQKn3mCxzJOdtrjIhT0oWULg3rM0/DBv6AEn9d95ia', 'System', 'Administrator', 'active', TRUE, 'approved', 100.00);

-- Assign admin role to admin user
INSERT INTO user_roles (user_id, role_id) VALUES
(1, 1);

-- Insert asset categories
INSERT INTO asset_categories (name, description) VALUES
('FOREX_MAJOR', 'Major Currency Pairs'),
('FOREX_MINOR', 'Minor Currency Pairs'),
('FOREX_EXOTIC', 'Exotic Currency Pairs'),
('CRYPTO_MAJOR', 'Major Cryptocurrencies'),
('COMMODITY', 'Commodities and Raw Materials'),
('INDICES', 'Stock Market Indices'),
('STOCKS', 'Individual Company Shares'),
('BONDS', 'Government and Corporate Bonds');

-- Insert comprehensive trading symbols
INSERT INTO symbols (symbol, name, category_id, base_currency, quote_currency, pip_size, lot_size, min_lot, max_lot, lot_step, contract_size, margin_requirement, spread_type, commission_type, commission_value, swap_long, swap_short, is_active) VALUES
-- FOREX MAJOR PAIRS
('EURUSD', 'Euro vs US Dollar', 1, 'EUR', 'USD', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 3.50, -0.8, 0.1, TRUE),
('GBPUSD', 'British Pound vs US Dollar', 1, 'GBP', 'USD', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 3.50, -1.2, 0.3, TRUE),
('USDJPY', 'US Dollar vs Japanese Yen', 1, 'USD', 'JPY', 0.01, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 3.50, 0.2, -0.9, TRUE),
('USDCHF', 'US Dollar vs Swiss Franc', 1, 'USD', 'CHF', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 3.50, -0.5, 0.8, TRUE),
('USDCAD', 'US Dollar vs Canadian Dollar', 1, 'USD', 'CAD', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 3.50, -0.3, 0.6, TRUE),
('AUDUSD', 'Australian Dollar vs US Dollar', 1, 'AUD', 'USD', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 3.50, -0.4, 0.7, TRUE),
('NZDUSD', 'New Zealand Dollar vs US Dollar', 1, 'NZD', 'USD', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 3.50, -0.3, 0.6, TRUE),

-- FOREX MINOR PAIRS
('EURGBP', 'Euro vs British Pound', 2, 'EUR', 'GBP', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, -0.2, 0.4, TRUE),
('EURJPY', 'Euro vs Japanese Yen', 2, 'EUR', 'JPY', 0.01, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, 0.1, -0.8, TRUE),
('EURCHF', 'Euro vs Swiss Franc', 2, 'EUR', 'CHF', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, -0.3, 0.6, TRUE),
('EURAUD', 'Euro vs Australian Dollar', 2, 'EUR', 'AUD', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, -0.5, 0.8, TRUE),
('EURCAD', 'Euro vs Canadian Dollar', 2, 'EUR', 'CAD', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, -0.4, 0.7, TRUE),
('EURNZD', 'Euro vs New Zealand Dollar', 2, 'EUR', 'NZD', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, -0.6, 0.9, TRUE),
('GBPJPY', 'British Pound vs Japanese Yen', 2, 'GBP', 'JPY', 0.01, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, 0.3, -1.1, TRUE),
('GBPCHF', 'British Pound vs Swiss Franc', 2, 'GBP', 'CHF', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, -0.4, 0.7, TRUE),
('GBPAUD', 'British Pound vs Australian Dollar', 2, 'GBP', 'AUD', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, -0.6, 0.9, TRUE),
('GBPCAD', 'British Pound vs Canadian Dollar', 2, 'GBP', 'CAD', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, -0.5, 0.8, TRUE),
('GBPNZD', 'British Pound vs New Zealand Dollar', 2, 'GBP', 'NZD', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, -0.7, 1.0, TRUE),
('AUDJPY', 'Australian Dollar vs Japanese Yen', 2, 'AUD', 'JPY', 0.01, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, 0.2, -0.9, TRUE),
('AUDCHF', 'Australian Dollar vs Swiss Franc', 2, 'AUD', 'CHF', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, -0.3, 0.6, TRUE),
('AUDCAD', 'Australian Dollar vs Canadian Dollar', 2, 'AUD', 'CAD', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, -0.2, 0.5, TRUE),
('AUDNZD', 'Australian Dollar vs New Zealand Dollar', 2, 'AUD', 'NZD', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, -0.4, 0.7, TRUE),
('NZDJPY', 'New Zealand Dollar vs Japanese Yen', 2, 'NZD', 'JPY', 0.01, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, 0.1, -0.8, TRUE),
('NZDCHF', 'New Zealand Dollar vs Swiss Franc', 2, 'NZD', 'CHF', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, -0.3, 0.6, TRUE),
('NZDCAD', 'New Zealand Dollar vs Canadian Dollar', 2, 'NZD', 'CAD', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, -0.2, 0.5, TRUE),
('CADJPY', 'Canadian Dollar vs Japanese Yen', 2, 'CAD', 'JPY', 0.01, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, 0.3, -1.0, TRUE),
('CADCHF', 'Canadian Dollar vs Swiss Franc', 2, 'CAD', 'CHF', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, -0.1, 0.4, TRUE),
('CHFJPY', 'Swiss Franc vs Japanese Yen', 2, 'CHF', 'JPY', 0.01, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 3.3333, 'floating', 'per_lot', 4.00, 0.4, -1.2, TRUE),

-- FOREX EXOTIC PAIRS
('USDINR', 'US Dollar vs Indian Rupee', 3, 'USD', 'INR', 0.01, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 5.0000, 'floating', 'per_lot', 5.00, 0.0, 0.0, TRUE),
('USDTRY', 'US Dollar vs Turkish Lira', 3, 'USD', 'TRY', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 5.0000, 'floating', 'per_lot', 5.00, -2.0, 1.5, TRUE),
('USDZAR', 'US Dollar vs South African Rand', 3, 'USD', 'ZAR', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 5.0000, 'floating', 'per_lot', 5.00, -1.5, 1.2, TRUE),
('USDMXN', 'US Dollar vs Mexican Peso', 3, 'USD', 'MXN', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 5.0000, 'floating', 'per_lot', 5.00, -1.0, 0.8, TRUE),
('USDTHB', 'US Dollar vs Thai Baht', 3, 'USD', 'THB', 0.01, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 5.0000, 'floating', 'per_lot', 5.00, 0.0, 0.0, TRUE),
('USDSEK', 'US Dollar vs Swedish Krona', 3, 'USD', 'SEK', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 5.0000, 'floating', 'per_lot', 5.00, -0.8, 0.6, TRUE),
('USDNOK', 'US Dollar vs Norwegian Krone', 3, 'USD', 'NOK', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 5.0000, 'floating', 'per_lot', 5.00, -0.9, 0.7, TRUE),
('EURSEK', 'Euro vs Swedish Krona', 3, 'EUR', 'SEK', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 5.0000, 'floating', 'per_lot', 5.00, -0.7, 0.5, TRUE),
('EURNOK', 'Euro vs Norwegian Krone', 3, 'EUR', 'NOK', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 5.0000, 'floating', 'per_lot', 5.00, -0.8, 0.6, TRUE),
('USDPLN', 'US Dollar vs Polish Zloty', 3, 'USD', 'PLN', 0.0001, 100000.0000, 0.01, 100.0000, 0.01, 100000.0000, 5.0000, 'floating', 'per_lot', 5.00, -0.6, 0.4, TRUE),

-- CRYPTO MAJOR PAIRS
('BTCUSD', 'Bitcoin vs US Dollar', 4, 'BTC', 'USD', 0.01, 1.0000, 0.001, 10.0000, 0.001, 1.0000, 20.0000, 'floating', 'percentage', 0.1000, 0.0, 0.0, TRUE),
('ETHUSD', 'Ethereum vs US Dollar', 4, 'ETH', 'USD', 0.01, 1.0000, 0.01, 100.0000, 0.01, 1.0000, 10.0000, 'floating', 'percentage', 0.1000, 0.0, 0.0, TRUE),
('BNBUSD', 'Binance Coin vs US Dollar', 4, 'BNB', 'USD', 0.01, 1.0000, 0.01, 1000.0000, 0.01, 1.0000, 8.0000, 'floating', 'percentage', 0.1000, 0.0, 0.0, TRUE),
('SOLUSD', 'Solana vs US Dollar', 4, 'SOL', 'USD', 0.01, 1.0000, 0.01, 1000.0000, 0.01, 1.0000, 8.0000, 'floating', 'percentage', 0.1000, 0.0, 0.0, TRUE),
('XRPUSD', 'Ripple vs US Dollar', 4, 'XRP', 'USD', 0.0001, 1000.0000, 1.00, 100000.0000, 1.00, 1000.0000, 6.0000, 'floating', 'percentage', 0.1000, 0.0, 0.0, TRUE),
('ADAUSD', 'Cardano vs US Dollar', 4, 'ADA', 'USD', 0.0001, 1000.0000, 1.00, 100000.0000, 1.00, 1000.0000, 6.0000, 'floating', 'percentage', 0.1000, 0.0, 0.0, TRUE),
('DOGEUSD', 'Dogecoin vs US Dollar', 4, 'DOGE', 'USD', 0.00001, 10000.0000, 10.00, 1000000.0000, 10.00, 10000.0000, 4.0000, 'floating', 'percentage', 0.1000, 0.0, 0.0, TRUE),
('LTCUSD', 'Litecoin vs US Dollar', 4, 'LTC', 'USD', 0.01, 10.0000, 0.01, 1000.0000, 0.01, 10.0000, 7.0000, 'floating', 'percentage', 0.1000, 0.0, 0.0, TRUE),
('DOTUSD', 'Polkadot vs US Dollar', 4, 'DOT', 'USD', 0.001, 100.0000, 0.1, 10000.0000, 0.1, 100.0000, 6.0000, 'floating', 'percentage', 0.1000, 0.0, 0.0, TRUE),
('AVAXUSD', 'Avalanche vs US Dollar', 4, 'AVAX', 'USD', 0.01, 10.0000, 0.01, 1000.0000, 0.01, 10.0000, 7.0000, 'floating', 'percentage', 0.1000, 0.0, 0.0, TRUE),

-- COMMODITIES
('XAUUSD', 'Gold vs US Dollar', 5, 'XAU', 'USD', 0.01, 100.0000, 0.01, 100.0000, 0.01, 100.0000, 5.0000, 'floating', 'per_lot', 2.50, -2.5, -1.8, TRUE),
('XAGUSD', 'Silver vs US Dollar', 5, 'XAG', 'USD', 0.001, 5000.0000, 0.01, 500.0000, 0.01, 5000.0000, 5.0000, 'floating', 'per_lot', 2.50, -1.2, -0.9, TRUE),
('XPTUSD', 'Platinum vs US Dollar', 5, 'XPT', 'USD', 0.01, 100.0000, 0.01, 100.0000, 0.01, 100.0000, 5.0000, 'floating', 'per_lot', 2.50, -2.0, -1.5, TRUE),
('XPDUSD', 'Palladium vs US Dollar', 5, 'XPD', 'USD', 0.01, 100.0000, 0.01, 100.0000, 0.01, 100.0000, 5.0000, 'floating', 'per_lot', 2.50, -2.2, -1.6, TRUE),
('WTIUSD', 'West Texas Oil vs US Dollar', 5, 'WTI', 'USD', 0.01, 1000.0000, 0.01, 100.0000, 0.01, 1000.0000, 5.0000, 'floating', 'per_lot', 2.50, 0.0, 0.0, TRUE),
('BRENTUSD', 'Brent Oil vs US Dollar', 5, 'BRENT', 'USD', 0.01, 1000.0000, 0.01, 100.0000, 0.01, 1000.0000, 5.0000, 'floating', 'per_lot', 2.50, 0.0, 0.0, TRUE),
('NATGASUSD', 'Natural Gas vs US Dollar', 5, 'NATGAS', 'USD', 0.001, 10000.0000, 0.01, 1000.0000, 0.01, 10000.0000, 5.0000, 'floating', 'per_lot', 2.50, 0.0, 0.0, TRUE),
('COFFEEUSD', 'Coffee vs US Dollar', 5, 'COFFEE', 'USD', 0.01, 37500.0000, 0.01, 375.0000, 0.01, 37500.0000, 5.0000, 'floating', 'per_lot', 2.50, 0.0, 0.0, TRUE),
('CORNUSD', 'Corn vs US Dollar', 5, 'CORN', 'USD', 0.01, 5000.0000, 0.01, 500.0000, 0.01, 5000.0000, 5.0000, 'floating', 'per_lot', 2.50, 0.0, 0.0, TRUE),
('WHEATUSD', 'Wheat vs US Dollar', 5, 'WHEAT', 'USD', 0.01, 5000.0000, 0.01, 500.0000, 0.01, 5000.0000, 5.0000, 'floating', 'per_lot', 2.50, 0.0, 0.0, TRUE);

-- Insert payment methods
INSERT INTO payment_methods (name, type, provider, supported_currencies, min_amount, max_amount, deposit_fee_value, withdrawal_fee_value, processing_time_hours) VALUES
('Bank Transfer', 'bank_transfer', 'Various Banks', '["USD", "EUR", "GBP"]', 100.00, 50000.00, 0.0000, 25.0000, 24),
('Credit Card', 'credit_card', 'Stripe', '["USD", "EUR", "GBP"]', 10.00, 10000.00, 2.9000, 0.0000, 1),
('PayPal', 'ewallet', 'PayPal', '["USD", "EUR", "GBP", "CAD"]', 5.00, 5000.00, 3.4000, 1.5000, 4),
('Bitcoin', 'crypto', 'Coinbase', '["BTC", "USDT", "USDC"]', 25.00, 25000.00, 1.0000, 0.5000, 2),
('Ethereum', 'crypto', 'Coinbase', '["ETH", "USDT", "USDC"]', 25.00, 25000.00, 1.0000, 0.5000, 2);

-- Insert support categories
INSERT INTO support_categories (name, description, priority_level) VALUES
('Account Issues', 'Problems with account access, verification, settings', 'high'),
('Trading Issues', 'Problems with orders, positions, platform functionality', 'high'),
('Deposit/Withdrawal', 'Issues with funding account or withdrawing funds', 'medium'),
('Technical Support', 'Platform bugs, connection issues, technical problems', 'medium'),
('General Inquiry', 'General questions and information requests', 'low');

-- Insert system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
('platform_name', 'TradePro Platform', 'string', 'Name of the trading platform', TRUE),
('default_leverage', '100', 'number', 'Default leverage for new accounts', FALSE),
('max_leverage', '500', 'number', 'Maximum allowed leverage', FALSE),
('margin_call_level', '50', 'number', 'Margin call level percentage', FALSE),
('stop_out_level', '20', 'number', 'Stop out level percentage', FALSE),
('min_deposit', '100', 'number', 'Minimum deposit amount in USD', TRUE),
('maintenance_mode', 'false', 'boolean', 'Platform maintenance mode status', TRUE);

-- Insert notification templates
INSERT INTO notification_templates (name, type, subject, body, variables) VALUES
('welcome_email', 'email', 'Welcome to {{platform_name}}!', 'Dear {{first_name}},\n\nWelcome to our trading platform! Your account has been successfully created.', '["platform_name", "first_name"]'),
('deposit_confirmed', 'email', 'Deposit Confirmed', 'Your deposit of {{amount}} {{currency}} has been confirmed and added to your account.', '["amount", "currency"]'),
('withdrawal_processed', 'email', 'Withdrawal Processed', 'Your withdrawal request of {{amount}} {{currency}} has been processed.', '["amount", "currency"]'),
('margin_call', 'email', 'Margin Call Alert', 'Your account margin level has fallen below the required threshold. Please add funds or close positions.', '[]'),
('trade_executed', 'in_app', 'Trade Executed', 'Your {{side}} order for {{symbol}} has been executed at {{price}}.', '["side", "symbol", "price"]');

-- Insert IB global settings
INSERT INTO ib_global_settings (setting_key, setting_value, description) VALUES
('default_ib_share_percent', '50.0', 'Default percentage of commission that goes to IB'),
('min_ib_share_percent', '10.0', 'Minimum allowed IB share percentage'),
('max_ib_share_percent', '90.0', 'Maximum allowed IB share percentage'),
('default_commission_rate', '0.0070', 'Default commission rate for new IB relationships'),
('ib_tier_bronze_threshold', '0', 'Commission threshold for bronze tier'),
('ib_tier_silver_threshold', '1000.00', 'Commission threshold for silver tier'),
('ib_tier_gold_threshold', '5000.00', 'Commission threshold for gold tier'),
('ib_tier_platinum_threshold', '10000.00', 'Commission threshold for platinum tier');

-- =================================================================
-- VIEWS FOR COMMON QUERIES
-- =================================================================

-- User account summary view
CREATE VIEW user_account_summary AS
SELECT
    u.id as user_id,
    u.first_name,
    u.last_name,
    u.email,
    u.status as user_status,
    ta.id as account_id,
    ta.account_number,
    ta.account_type,
    ta.currency,
    ta.balance,
    ta.equity,
    ta.free_margin,
    ta.status as account_status,
    COUNT(p.id) as open_positions,
    COALESCE(SUM(p.profit), 0) as total_unrealized_pnl
FROM users u
LEFT JOIN trading_accounts ta ON u.id = ta.user_id
LEFT JOIN positions p ON ta.id = p.account_id AND p.status = 'open'
GROUP BY u.id, ta.id;

-- Trading performance view
CREATE VIEW trading_performance AS
SELECT
    th.account_id,
    COUNT(*) as total_trades,
    COUNT(CASE WHEN th.profit > 0 THEN 1 END) as winning_trades,
    COUNT(CASE WHEN th.profit < 0 THEN 1 END) as losing_trades,
    ROUND((COUNT(CASE WHEN th.profit > 0 THEN 1 END) / COUNT(*)) * 100, 2) as win_rate,
    SUM(th.profit) as total_profit_loss,
    AVG(th.profit) as average_profit_loss,
    MAX(th.profit) as best_trade,
    MIN(th.profit) as worst_trade,
    SUM(th.commission) as total_commission,
    SUM(th.swap) as total_swap
FROM trade_history th
GROUP BY th.account_id;

-- Daily trading volume view
CREATE VIEW daily_trading_volume AS
SELECT
    DATE(th.closed_at) as trade_date,
    s.symbol,
    COUNT(*) as trades_count,
    SUM(th.lot_size) as total_volume,
    SUM(th.profit) as daily_pnl
FROM trade_history th
JOIN symbols s ON th.symbol_id = s.id
GROUP BY DATE(th.closed_at), s.symbol
ORDER BY trade_date DESC, total_volume DESC;

-- Pending transaction summary
CREATE VIEW pending_transactions AS
SELECT
    'deposit' as transaction_type,
    d.id,
    d.user_id,
    u.first_name,
    u.last_name,
    d.amount,
    d.currency,
    d.status,
    d.created_at,
    pm.name as payment_method
FROM deposits d
JOIN users u ON d.user_id = u.id
JOIN payment_methods pm ON d.payment_method_id = pm.id
WHERE d.status IN ('pending', 'processing')

UNION ALL

SELECT
    'withdrawal' as transaction_type,
    w.id,
    w.user_id,
    u.first_name,
    u.last_name,
    w.amount,
    w.currency,
    w.status,
    w.created_at,
    pm.name as payment_method
FROM withdrawals w
JOIN users u ON w.user_id = u.id
JOIN payment_methods pm ON w.payment_method_id = pm.id
WHERE w.status IN ('pending', 'processing')
ORDER BY created_at DESC;

-- =================================================================
-- STORED PROCEDURES
-- =================================================================

DELIMITER //

-- Procedure to calculate account equity
CREATE PROCEDURE CalculateAccountEquity(IN account_id_param INT)
BEGIN
    DECLARE account_balance DECIMAL(15,4);
    DECLARE unrealized_pnl DECIMAL(15,4) DEFAULT 0;

    -- Get current balance
    SELECT balance INTO account_balance
    FROM trading_accounts
    WHERE id = account_id_param;

    -- Calculate unrealized P&L from open positions
    SELECT COALESCE(SUM(profit), 0) INTO unrealized_pnl
    FROM positions
    WHERE account_id = account_id_param AND status = 'open';

    -- Update account equity
    UPDATE trading_accounts
    SET
        equity = account_balance + unrealized_pnl,
        free_margin = GREATEST(account_balance + unrealized_pnl - (SELECT COALESCE(SUM(lot_size * open_price * (SELECT margin_requirement FROM symbols WHERE id = symbol_id)), 0) FROM positions WHERE account_id = account_id_param AND status = 'open'), 0),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = account_id_param;
END //

-- Procedure to close position
CREATE PROCEDURE ClosePosition(
    IN position_id_param INT,
    IN close_price_param DECIMAL(12,6),
    IN close_reason_param VARCHAR(50)
)
BEGIN
    DECLARE position_account_id INT;
    DECLARE position_symbol_id INT;
    DECLARE position_side VARCHAR(10);
    DECLARE position_lot_size DECIMAL(8,4);
    DECLARE position_open_price DECIMAL(12,6);
    DECLARE position_commission DECIMAL(10,4);
    DECLARE position_swap DECIMAL(10,4);
    DECLARE position_opened_at TIMESTAMP;
    DECLARE calculated_profit DECIMAL(12,4);
    DECLARE pip_size_value DECIMAL(10,8);
    DECLARE contract_size_value DECIMAL(12,4);

    -- Get position details
    SELECT account_id, symbol_id, side, lot_size, open_price, commission, swap, opened_at
    INTO position_account_id, position_symbol_id, position_side, position_lot_size,
         position_open_price, position_commission, position_swap, position_opened_at
    FROM positions
    WHERE id = position_id_param AND status = 'open';

    -- Get symbol details for profit calculation
    SELECT pip_size, contract_size
    INTO pip_size_value, contract_size_value
    FROM symbols
    WHERE id = position_symbol_id;

    -- Calculate profit
    IF position_side = 'buy' THEN
        SET calculated_profit = (close_price_param - position_open_price) * position_lot_size * contract_size_value;
    ELSE
        SET calculated_profit = (position_open_price - close_price_param) * position_lot_size * contract_size_value;
    END IF;

    -- Account for commission and swap
    SET calculated_profit = calculated_profit - position_commission + position_swap;

    -- Insert into trade history
    INSERT INTO trade_history (
        account_id, symbol_id, position_id, side, lot_size,
        open_price, close_price, commission, swap, profit,
        duration_minutes, close_reason, opened_at, closed_at
    ) VALUES (
        position_account_id, position_symbol_id, position_id_param, position_side, position_lot_size,
        position_open_price, close_price_param, position_commission, position_swap, calculated_profit,
        TIMESTAMPDIFF(MINUTE, position_opened_at, NOW()), close_reason_param, position_opened_at, NOW()
    );

    -- Update position status
    UPDATE positions
    SET status = 'closed', current_price = close_price_param, close_price = close_price_param,
        profit = calculated_profit, profit_loss = calculated_profit, closed_at = NOW(),
        close_time = NOW(), close_reason = close_reason_param, updated_at = CURRENT_TIMESTAMP
    WHERE id = position_id_param;

    -- Update account balance
    UPDATE trading_accounts
    SET balance = balance + calculated_profit
    WHERE id = position_account_id;

    -- Recalculate account equity
    CALL CalculateAccountEquity(position_account_id);
END //

DELIMITER ;

-- =================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =================================================================

-- Additional composite indexes for common queries
CREATE INDEX idx_user_email_status ON users(email, status);
CREATE INDEX idx_account_user_type ON trading_accounts(user_id, account_type);
CREATE INDEX idx_position_account_status ON positions(account_id, status);
CREATE INDEX idx_trade_history_account_date ON trade_history(account_id, closed_at);
CREATE INDEX idx_market_prices_symbol_timestamp ON market_prices(symbol_id, timestamp DESC);
CREATE INDEX idx_deposits_user_status ON deposits(user_id, status);
CREATE INDEX idx_withdrawals_user_status ON withdrawals(user_id, status);
CREATE INDEX idx_support_tickets_user_status ON support_tickets(user_id, status);

-- Full-text search indexes for support tickets
ALTER TABLE support_tickets ADD FULLTEXT(subject, description);
ALTER TABLE support_responses ADD FULLTEXT(message);

-- =================================================================
-- TRIGGERS FOR DATA INTEGRITY
-- =================================================================

DELIMITER //

-- Trigger to update user's updated_at timestamp
CREATE TRIGGER user_updated_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END //

-- Trigger to log account balance changes
CREATE TRIGGER account_balance_change_log
AFTER UPDATE ON trading_accounts
FOR EACH ROW
BEGIN
    IF OLD.balance != NEW.balance THEN
        INSERT INTO account_balance_history (
            account_id, previous_balance, new_balance, change_amount,
            change_type, notes, created_at
        ) VALUES (
            NEW.id, OLD.balance, NEW.balance, NEW.balance - OLD.balance,
            'adjustment', 'Balance updated', NOW()
        );
    END IF;
END //

-- Trigger to validate deposit amounts
CREATE TRIGGER validate_deposit_amount
BEFORE INSERT ON deposits
FOR EACH ROW
BEGIN
    DECLARE min_amount DECIMAL(10,2);
    DECLARE max_amount DECIMAL(15,2);

    SELECT pm.min_amount, pm.max_amount
    INTO min_amount, max_amount
    FROM payment_methods pm
    WHERE pm.id = NEW.payment_method_id;

    IF NEW.amount < min_amount THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Deposit amount is below minimum allowed';
    END IF;

    IF max_amount IS NOT NULL AND NEW.amount > max_amount THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Deposit amount exceeds maximum allowed';
    END IF;
END //

COMMIT;

-- =================================================================
-- MIGRATION: Add api_secret column to existing api_keys table
-- =================================================================

-- If you've already imported the schema and need to add the missing api_secret column:
-- ALTER TABLE api_keys ADD COLUMN api_secret VARCHAR(128) NOT NULL AFTER api_key;

-- =================================================================
-- END OF SCHEMA
-- =================================================================