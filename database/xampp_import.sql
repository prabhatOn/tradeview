-- Trading Platform Database Setup for XAMPP
-- Compatible with MySQL/MariaDB
-- Generated: October 23, 2025

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS `pro2` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `pro2`;

-- Set SQL mode and timezone
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

-- =================================================================
-- USER MANAGEMENT TABLES
-- =================================================================

-- Users table
CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `uuid` varchar(36) NOT NULL DEFAULT (uuid()),
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `status` enum('active','inactive','suspended','pending_verification') DEFAULT 'pending_verification',
  `email_verified` tinyint(1) DEFAULT 0,
  `phone_verified` tinyint(1) DEFAULT 0,
  `kyc_status` enum('pending','submitted','approved','rejected') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_login` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Roles table
CREATE TABLE `roles` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `is_admin` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- User roles junction table
CREATE TABLE `user_roles` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `assigned_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =================================================================
-- TRADING SYSTEM TABLES
-- =================================================================

-- Asset categories
CREATE TABLE `asset_categories` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Symbols table
CREATE TABLE `symbols` (
  `id` int(11) NOT NULL,
  `symbol` varchar(20) NOT NULL,
  `name` varchar(200) NOT NULL,
  `category_id` int(11) NOT NULL,
  `base_currency` varchar(10) DEFAULT NULL,
  `quote_currency` varchar(10) DEFAULT NULL,
  `pip_size` decimal(10,8) DEFAULT 0.00010000,
  `lot_size` decimal(12,4) DEFAULT 100000.0000,
  `min_lot` decimal(8,4) DEFAULT 0.0100,
  `max_lot` decimal(12,4) DEFAULT 100.0000,
  `lot_step` decimal(8,4) DEFAULT 0.0100,
  `contract_size` decimal(12,4) DEFAULT 100000.0000,
  `margin_requirement` decimal(8,4) DEFAULT 1.0000,
  `spread` decimal(10,6) DEFAULT 0.000200,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Trading accounts
CREATE TABLE `trading_accounts` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `account_number` varchar(50) NOT NULL,
  `account_type` enum('live','islamic','professional') NOT NULL DEFAULT 'live',
  `is_demo` tinyint(1) DEFAULT 0,
  `currency` varchar(3) DEFAULT 'USD',
  `leverage` decimal(10,2) DEFAULT 100.00,
  `max_leverage` decimal(10,2) DEFAULT 500.00,
  `trading_power` decimal(15,4) DEFAULT 0.0000,
  `balance` decimal(15,4) DEFAULT 0.0000,
  `equity` decimal(15,4) DEFAULT 0.0000,
  `used_margin` decimal(15,4) DEFAULT 0.0000,
  `free_margin` decimal(15,4) DEFAULT 0.0000,
  `margin_used` decimal(15,4) DEFAULT 0.0000,
  `margin_level` decimal(8,2) DEFAULT 0.00,
  `margin_call_level` decimal(5,2) DEFAULT 50.00,
  `stop_out_level` decimal(5,2) DEFAULT 20.00,
  `auto_square_percent` decimal(5,2) DEFAULT NULL,
  `status` enum('active','inactive','frozen','closed') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `min_margin_requirement` decimal(8,4) DEFAULT 1.0000
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Positions table
CREATE TABLE `positions` (
  `id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `symbol_id` int(11) NOT NULL,
  `side` enum('buy','sell') NOT NULL,
  `lot_size` decimal(8,4) NOT NULL,
  `open_price` decimal(12,6) NOT NULL,
  `current_price` decimal(12,6) DEFAULT NULL,
  `stop_loss` decimal(12,6) DEFAULT NULL,
  `take_profit` decimal(12,6) DEFAULT NULL,
  `trigger_price` decimal(12,6) DEFAULT NULL,
  `profit` decimal(12,4) DEFAULT 0.0000,
  `commission` decimal(10,4) DEFAULT 0.0000,
  `swap` decimal(10,4) DEFAULT 0.0000,
  `status` enum('open','closed','pending') DEFAULT 'open',
  `order_type` enum('market','limit','stop','stop_limit') DEFAULT 'market',
  `close_reason` enum('manual','stop_loss','take_profit','margin_call','system') DEFAULT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `close_time` timestamp NULL DEFAULT NULL,
  `opened_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `magic_number` int(11) DEFAULT NULL,
  `comment` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Trade history
CREATE TABLE `trade_history` (
  `id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `symbol_id` int(11) NOT NULL,
  `position_id` int(11) DEFAULT NULL,
  `side` enum('buy','sell') NOT NULL,
  `lot_size` decimal(8,4) NOT NULL,
  `open_price` decimal(12,6) NOT NULL,
  `close_price` decimal(12,6) NOT NULL,
  `stop_loss` decimal(12,6) DEFAULT NULL,
  `take_profit` decimal(12,6) DEFAULT NULL,
  `commission` decimal(10,4) DEFAULT 0.0000,
  `swap` decimal(10,4) DEFAULT 0.0000,
  `profit` decimal(12,4) NOT NULL,
  `duration_minutes` int(11) DEFAULT NULL,
  `close_reason` enum('manual','stop_loss','take_profit','margin_call','system') DEFAULT 'manual',
  `comment` text DEFAULT NULL,
  `magic_number` int(11) DEFAULT NULL,
  `opened_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `closed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =================================================================
-- PAYMENT AND FINANCIAL TABLES
-- =================================================================

-- Payment gateways
CREATE TABLE `payment_gateways` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `code` varchar(50) NOT NULL,
  `type` enum('deposit','withdrawal','both') DEFAULT 'both',
  `is_active` tinyint(1) DEFAULT 1,
  `config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`config`)),
  `min_amount` decimal(15,4) DEFAULT 10.0000,
  `max_amount` decimal(15,4) DEFAULT 10000.0000,
  `fee_type` enum('fixed','percentage','both') DEFAULT 'percentage',
  `fee_value` decimal(10,4) DEFAULT 0.0000,
  `processing_time` varchar(100) DEFAULT 'Instant',
  `sort_order` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Payment methods
CREATE TABLE `payment_methods` (
  `id` int(11) NOT NULL,
  `gateway_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `code` varchar(50) NOT NULL,
  `type` enum('bank_transfer','crypto','card','wallet','other') DEFAULT 'bank_transfer',
  `is_active` tinyint(1) DEFAULT 1,
  `min_amount` decimal(15,4) DEFAULT 10.0000,
  `max_amount` decimal(15,4) DEFAULT 10000.0000,
  `fee_type` enum('fixed','percentage','both') DEFAULT 'percentage',
  `fee_value` decimal(10,4) DEFAULT 0.0000,
  `processing_time` varchar(100) DEFAULT '1-3 business days',
  `instructions` text DEFAULT NULL,
  `sort_order` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Deposits
CREATE TABLE `deposits` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `transaction_id` varchar(100) NOT NULL,
  `payment_method_id` int(11) NOT NULL,
  `amount` decimal(15,4) NOT NULL,
  `currency` varchar(3) NOT NULL,
  `fee` decimal(10,4) DEFAULT 0.0000,
  `net_amount` decimal(15,4) NOT NULL,
  `status` enum('pending','processing','completed','failed','cancelled','rejected') DEFAULT 'pending',
  `payment_reference` varchar(255) DEFAULT NULL,
  `gateway_transaction_id` varchar(255) DEFAULT NULL,
  `gateway_response` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`gateway_response`)),
  `admin_notes` text DEFAULT NULL,
  `user_notes` text DEFAULT NULL,
  `processed_by` int(11) DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Market prices table
CREATE TABLE `market_prices` (
  `id` int(11) NOT NULL,
  `symbol_id` int(11) NOT NULL,
  `bid` decimal(12,6) NOT NULL,
  `ask` decimal(12,6) NOT NULL,
  `last` decimal(12,6) NOT NULL,
  `high` decimal(12,6) NOT NULL,
  `low` decimal(12,6) NOT NULL,
  `volume` int(11) DEFAULT 0,
  `change_amount` decimal(12,6) DEFAULT 0.000000,
  `change_percent` decimal(8,4) DEFAULT 0.0000,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Account balance history
CREATE TABLE `account_balance_history` (
  `id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `previous_balance` decimal(15,4) DEFAULT NULL,
  `new_balance` decimal(15,4) DEFAULT NULL,
  `change_amount` decimal(15,4) DEFAULT NULL,
  `change_type` enum('deposit','withdrawal','trade_profit','trade_loss','commission','swap','adjustment') NOT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `reference_type` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Margin events
CREATE TABLE `margin_events` (
  `id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `event_type` enum('margin_call','stop_out','warning') NOT NULL,
  `margin_level` decimal(8,2) NOT NULL,
  `equity` decimal(15,4) NOT NULL,
  `margin_used` decimal(15,4) NOT NULL,
  `free_margin` decimal(15,4) NOT NULL,
  `positions_closed` int(11) DEFAULT 0,
  `total_loss` decimal(15,4) DEFAULT 0.0000,
  `notification_sent` tinyint(1) DEFAULT 0,
  `resolved` tinyint(1) DEFAULT 0,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =================================================================
-- API AND SECURITY TABLES
-- =================================================================

-- API Keys
CREATE TABLE `api_keys` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `key_name` varchar(100) NOT NULL,
  `api_key` varchar(64) NOT NULL,
  `api_secret` varchar(128) NOT NULL,
  `permissions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`permissions`)),
  `is_active` tinyint(1) DEFAULT 1,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `usage_count` int(11) DEFAULT 0,
  `rate_limit_per_hour` int(11) DEFAULT 1000,
  `ip_whitelist` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`ip_whitelist`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Password reset tokens
CREATE TABLE `password_reset_tokens` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =================================================================
-- SYSTEM TABLES
-- =================================================================

-- System settings
CREATE TABLE `system_settings` (
  `id` int(11) NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text NOT NULL,
  `setting_type` enum('string','number','boolean','json') DEFAULT 'string',
  `description` text DEFAULT NULL,
  `is_public` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `category` varchar(50) DEFAULT 'general'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =================================================================
-- INDEXES
-- =================================================================

-- Users table indexes
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uuid` (`uuid`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`);

-- Roles table indexes
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

-- User roles indexes
ALTER TABLE `user_roles`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `role_id` (`role_id`);

-- Asset categories indexes
ALTER TABLE `asset_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

-- Symbols table indexes
ALTER TABLE `symbols`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `symbol` (`symbol`),
  ADD KEY `category_id` (`category_id`),
  ADD KEY `idx_is_active` (`is_active`);

-- Trading accounts indexes
ALTER TABLE `trading_accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `account_number` (`account_number`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_status` (`status`);

-- Positions indexes
ALTER TABLE `positions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `account_id` (`account_id`),
  ADD KEY `symbol_id` (`symbol_id`),
  ADD KEY `idx_status` (`status`);

-- Trade history indexes
ALTER TABLE `trade_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `account_id` (`account_id`),
  ADD KEY `symbol_id` (`symbol_id`),
  ADD KEY `position_id` (`position_id`);

-- Payment gateways indexes
ALTER TABLE `payment_gateways`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `idx_is_active` (`is_active`);

-- Payment methods indexes
ALTER TABLE `payment_methods`
  ADD PRIMARY KEY (`id`),
  ADD KEY `gateway_id` (`gateway_id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `idx_is_active` (`is_active`);

-- Deposits indexes
ALTER TABLE `deposits`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `transaction_id` (`transaction_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `account_id` (`account_id`),
  ADD KEY `payment_method_id` (`payment_method_id`),
  ADD KEY `idx_status` (`status`);

-- Withdrawals indexes
ALTER TABLE `withdrawals`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `transaction_id` (`transaction_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `account_id` (`account_id`),
  ADD KEY `payment_method_id` (`payment_method_id`),
  ADD KEY `idx_status` (`status`);

-- API keys indexes
ALTER TABLE `api_keys`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `api_key` (`api_key`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_is_active` (`is_active`);

-- Password reset tokens indexes
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `expires_at` (`expires_at`);

-- Market prices indexes
ALTER TABLE `market_prices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `symbol_id` (`symbol_id`),
  ADD KEY `timestamp` (`timestamp`);

-- Account balance history indexes
ALTER TABLE `account_balance_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `account_id` (`account_id`),
  ADD KEY `change_type` (`change_type`),
  ADD KEY `created_at` (`created_at`);

-- Margin events indexes
ALTER TABLE `margin_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `account_id` (`account_id`),
  ADD KEY `event_type` (`event_type`),
  ADD KEY `resolved` (`resolved`),
  ADD KEY `created_at` (`created_at`);

-- =================================================================
-- AUTO INCREMENT SETTINGS
-- =================================================================

ALTER TABLE `users` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `roles` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `user_roles` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `asset_categories` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `symbols` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `trading_accounts` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `positions` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `trade_history` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `payment_gateways` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `payment_methods` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `deposits` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `withdrawals` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `api_keys` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `password_reset_tokens` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `system_settings` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `market_prices` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `account_balance_history` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
ALTER TABLE `margin_events` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

-- =================================================================
-- FOREIGN KEY CONSTRAINTS
-- =================================================================

ALTER TABLE `user_roles`
  ADD CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE;

ALTER TABLE `symbols`
  ADD CONSTRAINT `fk_symbols_category` FOREIGN KEY (`category_id`) REFERENCES `asset_categories` (`id`);

ALTER TABLE `trading_accounts`
  ADD CONSTRAINT `fk_trading_accounts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `positions`
  ADD CONSTRAINT `fk_positions_account` FOREIGN KEY (`account_id`) REFERENCES `trading_accounts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_positions_symbol` FOREIGN KEY (`symbol_id`) REFERENCES `symbols` (`id`);

ALTER TABLE `trade_history`
  ADD CONSTRAINT `fk_trade_history_account` FOREIGN KEY (`account_id`) REFERENCES `trading_accounts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_trade_history_symbol` FOREIGN KEY (`symbol_id`) REFERENCES `symbols` (`id`),
  ADD CONSTRAINT `fk_trade_history_position` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE SET NULL;

ALTER TABLE `payment_methods`
  ADD CONSTRAINT `fk_payment_methods_gateway` FOREIGN KEY (`gateway_id`) REFERENCES `payment_gateways` (`id`) ON DELETE CASCADE;

ALTER TABLE `deposits`
  ADD CONSTRAINT `fk_deposits_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_deposits_account` FOREIGN KEY (`account_id`) REFERENCES `trading_accounts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_deposits_payment_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`);

ALTER TABLE `withdrawals`
  ADD CONSTRAINT `fk_withdrawals_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_withdrawals_account` FOREIGN KEY (`account_id`) REFERENCES `trading_accounts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_withdrawals_payment_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`);

ALTER TABLE `api_keys`
  ADD CONSTRAINT `fk_api_keys_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `market_prices`
  ADD CONSTRAINT `fk_market_prices_symbol` FOREIGN KEY (`symbol_id`) REFERENCES `symbols` (`id`) ON DELETE CASCADE;

ALTER TABLE `account_balance_history`
  ADD CONSTRAINT `fk_account_balance_history_account` FOREIGN KEY (`account_id`) REFERENCES `trading_accounts` (`id`) ON DELETE CASCADE;

ALTER TABLE `margin_events`
  ADD CONSTRAINT `fk_margin_events_account` FOREIGN KEY (`account_id`) REFERENCES `trading_accounts` (`id`) ON DELETE CASCADE;

-- =================================================================
-- STORED PROCEDURES
-- =================================================================

DELIMITER $$

-- Calculate account equity procedure
CREATE PROCEDURE `CalculateAccountEquity`(IN account_id_param INT)
BEGIN
    DECLARE account_balance DECIMAL(15,4);
    DECLARE unrealized_pnl DECIMAL(15,4) DEFAULT 0;
    DECLARE new_equity DECIMAL(15,4);

    -- Get current balance
    SELECT balance INTO account_balance
    FROM trading_accounts
    WHERE id = account_id_param;

    -- Calculate unrealized P&L from open positions
    SELECT COALESCE(SUM(profit), 0) INTO unrealized_pnl
    FROM positions
    WHERE account_id = account_id_param AND status = 'open';

    -- Calculate new equity
    SET new_equity = account_balance + unrealized_pnl;

    -- Update account equity
    UPDATE trading_accounts
    SET
        equity = new_equity,
        free_margin = new_equity - (SELECT COALESCE(SUM(lot_size * open_price * (SELECT margin_requirement FROM symbols WHERE id = symbol_id)), 0) FROM positions WHERE account_id = account_id_param AND status = 'open'),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = account_id_param;
END$$

-- Close position procedure
CREATE PROCEDURE `ClosePosition`(IN position_id_param INT, IN close_price_param DECIMAL(12,6), IN close_reason_param VARCHAR(50))
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
    SET status = 'closed', profit = calculated_profit, current_price = close_price_param
    WHERE id = position_id_param;

    -- Update account balance
    UPDATE trading_accounts
    SET balance = balance + calculated_profit
    WHERE id = position_account_id;

    -- Recalculate account equity
    CALL CalculateAccountEquity(position_account_id);
END$$

DELIMITER ;

-- =================================================================
-- TRIGGERS
-- =================================================================

DELIMITER $$

-- Account balance change logging trigger
CREATE TRIGGER `account_balance_change_log` AFTER UPDATE ON `trading_accounts`
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
END$$

DELIMITER ;

-- =================================================================
-- SAMPLE DATA
-- =================================================================

-- Insert default roles
INSERT INTO `roles` (`name`, `description`, `is_admin`) VALUES
('Super Admin', 'Full system administrator with all permissions', 1),
('Admin', 'Standard administrator with elevated permissions', 1),
('Manager', 'Back-office manager level access', 0),
('Trader', 'Regular trading user', 0),
('IB', 'Introducing Broker', 0);

-- Insert asset categories
INSERT INTO `asset_categories` (`name`, `description`) VALUES
('FOREX_MAJOR', 'Major Forex Pairs'),
('FOREX_MINOR', 'Minor Forex Pairs (Cross Pairs)'),
('FOREX_EXOTIC', 'Exotic Forex Pairs'),
('CRYPTO_MAJOR', 'Major Cryptocurrencies'),
('COMMODITY', 'Commodities (Metals, Energy, Agriculture)');

-- Insert sample symbols
INSERT INTO `symbols` (`symbol`, `name`, `category_id`, `base_currency`, `quote_currency`, `pip_size`, `lot_size`, `min_lot`, `max_lot`, `lot_step`, `contract_size`, `margin_requirement`, `spread`, `is_active`) VALUES
('EURUSD', 'Euro vs US Dollar', 1, 'EUR', 'USD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 0.000200, 1),
('GBPUSD', 'British Pound vs US Dollar', 1, 'GBP', 'USD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 0.000300, 1),
('USDJPY', 'US Dollar vs Japanese Yen', 1, 'USD', 'JPY', 0.01000000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 0.020000, 1),
('AUDUSD', 'Australian Dollar vs US Dollar', 1, 'AUD', 'USD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 0.000250, 1),
('USDCAD', 'US Dollar vs Canadian Dollar', 1, 'USD', 'CAD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 0.000300, 1),
('BTCUSD', 'Bitcoin vs US Dollar', 4, 'BTC', 'USD', 0.01000000, 1.0000, 0.0010, 10.0000, 0.0010, 1.0000, 10.0000, 50.000000, 1),
('ETHUSD', 'Ethereum vs US Dollar', 4, 'ETH', 'USD', 0.01000000, 1.0000, 0.0010, 10.0000, 0.0010, 1.0000, 10.0000, 5.000000, 1);

-- Insert system settings
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `setting_type`, `description`, `is_public`, `category`) VALUES
('platform_name', 'TradePro Platform', 'string', 'Name of the trading platform', 1, 'general'),
('default_leverage', '100', 'number', 'Default leverage for new accounts', 0, 'general'),
('max_leverage', '500', 'number', 'Maximum allowed leverage', 0, 'general'),
('margin_call_level', '50', 'number', 'Margin call level percentage', 0, 'general'),
('stop_out_level', '20', 'number', 'Stop out level percentage', 0, 'general'),
('min_deposit', '100', 'number', 'Minimum deposit amount in USD', 1, 'general'),
('maintenance_mode', 'false', 'boolean', 'Platform maintenance mode status', 1, 'general'),
('site_name', 'ForexTrade Pro', 'string', 'Website name', 1, 'general'),
('max_daily_withdrawal', '10000', 'number', 'Maximum daily withdrawal limit', 0, 'financial'),
('commission_rate_standard', '7.00', 'number', 'Standard commission rate per lot', 0, 'trading'),
('ib_default_commission', '0.70', 'number', 'Default IB commission rate', 0, 'ib');

-- Insert sample payment gateway
INSERT INTO `payment_gateways` (`name`, `code`, `type`, `is_active`, `min_amount`, `max_amount`, `fee_type`, `fee_value`, `processing_time`, `sort_order`) VALUES
('Bank Transfer', 'bank_transfer', 'both', 1, 50.0000, 50000.0000, 'percentage', 0.0000, '1-3 business days', 1),
('Credit Card', 'credit_card', 'deposit', 1, 10.0000, 5000.0000, 'percentage', 2.5000, 'Instant', 2),
('PayPal', 'paypal', 'both', 1, 5.0000, 10000.0000, 'percentage', 1.5000, 'Instant', 3);

-- Insert sample payment methods
INSERT INTO `payment_methods` (`gateway_id`, `name`, `code`, `type`, `is_active`, `min_amount`, `max_amount`, `fee_type`, `fee_value`, `processing_time`, `sort_order`) VALUES
(1, 'Wire Transfer', 'wire_transfer', 'bank_transfer', 1, 100.0000, 50000.0000, 'fixed', 25.0000, '1-3 business days', 1),
(2, 'Visa/Mastercard', 'visa_mastercard', 'card', 1, 10.0000, 5000.0000, 'percentage', 2.5000, 'Instant', 2),
(3, 'PayPal Account', 'paypal_account', 'wallet', 1, 5.0000, 10000.0000, 'percentage', 1.5000, 'Instant', 3);

-- Create a default admin user (password: admin123)
INSERT INTO `users` (`email`, `password_hash`, `first_name`, `last_name`, `status`, `email_verified`, `created_at`) VALUES
('admin@tradingplatform.com', '$2b$10$rOz8vZKZx5QX8vZKZx5QX.KZx5QX8vZKZx5QX8vZKZx5QX8vZKZx5QX8vZK', 'System', 'Administrator', 'active', 1, NOW());

-- Assign admin role to default user
INSERT INTO `user_roles` (`user_id`, `role_id`) VALUES (1, 1);

-- Create a demo trading account for admin
INSERT INTO `trading_accounts` (`user_id`, `account_number`, `account_type`, `is_demo`, `balance`, `equity`, `free_margin`, `leverage`) VALUES
(1, 'DEMO001', 'live', 1, 10000.0000, 10000.0000, 10000.0000, 100.00);

COMMIT;