-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 17, 2025 at 09:01 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pro2`
--

DELIMITER $$
--
-- Procedures
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `CalculateAccountEquity` (IN `account_id_param` INT)   BEGIN
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

CREATE DEFINER=`root`@`localhost` PROCEDURE `ClosePosition` (IN `position_id_param` INT, IN `close_price_param` DECIMAL(12,6), IN `close_reason_param` VARCHAR(50))   BEGIN
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

-- --------------------------------------------------------

--
-- Table structure for table `account_balance_history`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `admin_actions`
--

CREATE TABLE `admin_actions` (
  `id` int(11) NOT NULL,
  `admin_user_id` int(11) NOT NULL,
  `action_type` enum('user_suspend','user_activate','user_lock','user_unlock','balance_adjustment','transaction_approve','transaction_reject','settings_change') NOT NULL,
  `target_user_id` int(11) DEFAULT NULL,
  `target_table` varchar(50) DEFAULT NULL,
  `target_record_id` int(11) DEFAULT NULL,
  `action_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`action_data`)),
  `reason` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `api_keys`
--

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

--
-- Dumping data for table `api_keys`
--

INSERT INTO `api_keys` (`id`, `user_id`, `key_name`, `api_key`, `api_secret`, `permissions`, `is_active`, `last_used_at`, `expires_at`, `usage_count`, `rate_limit_per_hour`, `ip_whitelist`, `created_at`, `updated_at`) VALUES
(10, 8, 'Personal Trading API Key', 'tk_09be956273805bf8363217f4a830b76dc28acf4d22c072cf610cb261a0b9', '18d5e4a72c4b610a227740f9e62ee6fc49dcc6ec9192693b5e3682fdc930159c42f54a35ddf8dc9b20260fc743c3d11030b17523ea16fffbe86bbd1e4a86f823', '[\"read\",\"trade\"]', 1, NULL, NULL, 0, 5000, '[]', '2025-10-17 06:59:57', '2025-10-17 06:59:57');

-- --------------------------------------------------------

--
-- Table structure for table `api_usage_logs`
--

CREATE TABLE `api_usage_logs` (
  `id` int(11) NOT NULL,
  `api_key_id` int(11) NOT NULL,
  `endpoint` varchar(200) NOT NULL,
  `method` enum('GET','POST','PUT','DELETE','PATCH') NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `request_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`request_data`)),
  `response_status` int(11) DEFAULT NULL,
  `response_time_ms` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `asset_categories`
--

CREATE TABLE `asset_categories` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `asset_categories`
--

INSERT INTO `asset_categories` (`id`, `name`, `description`, `is_active`, `created_at`) VALUES
(1, 'FOREX_MAJOR', 'Major Forex Pairs', 1, '2025-10-16 20:30:30'),
(2, 'FOREX_MINOR', 'Minor Forex Pairs (Cross Pairs)', 1, '2025-10-16 20:30:30'),
(3, 'FOREX_EXOTIC', 'Exotic Forex Pairs', 1, '2025-10-16 20:30:30'),
(4, 'CRYPTO_MAJOR', 'Major Cryptocurrencies', 1, '2025-10-16 20:30:30'),
(5, 'COMMODITY', 'Commodities (Metals, Energy, Agriculture)', 1, '2025-10-16 20:30:30');

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `table_name` varchar(50) DEFAULT NULL,
  `record_id` int(11) DEFAULT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `audit_logs`
--

INSERT INTO `audit_logs` (`id`, `user_id`, `action`, `table_name`, `record_id`, `old_values`, `new_values`, `ip_address`, `user_agent`, `created_at`) VALUES
(1, 1, 'update_ib_share', 'introducing_brokers', 6, NULL, '{\"ib_share_percent\":20}', NULL, NULL, '2025-10-17 03:43:19'),
(2, 1, 'update_ib_share', 'introducing_brokers', 6, NULL, '{\"ib_share_percent\":20}', NULL, NULL, '2025-10-17 03:44:28');

-- --------------------------------------------------------

--
-- Table structure for table `bank_details`
--

CREATE TABLE `bank_details` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `bank_name` varchar(100) NOT NULL,
  `account_holder_name` varchar(100) NOT NULL,
  `account_number` varchar(50) NOT NULL,
  `ifsc_code` varchar(20) NOT NULL,
  `account_type` enum('savings','current') DEFAULT 'savings',
  `branch_name` varchar(100) DEFAULT NULL,
  `is_primary` tinyint(1) DEFAULT 0,
  `is_verified` tinyint(1) DEFAULT 0,
  `status` enum('active','inactive','pending_verification') DEFAULT 'pending_verification',
  `verified_at` timestamp NULL DEFAULT NULL,
  `verified_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `daily_trading_volume`
-- (See below for the actual view)
--
CREATE TABLE `daily_trading_volume` (
`trade_date` date
,`symbol` varchar(20)
,`trades_count` bigint(21)
,`total_volume` decimal(30,4)
,`daily_pnl` decimal(34,4)
);

-- --------------------------------------------------------

--
-- Table structure for table `deposits`
--

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

--
-- Triggers `deposits`
--
DELIMITER $$
CREATE TRIGGER `validate_deposit_amount` BEFORE INSERT ON `deposits` FOR EACH ROW BEGIN
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
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `ib_applications`
--

CREATE TABLE `ib_applications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ib_commissions`
--

CREATE TABLE `ib_commissions` (
  `id` int(11) NOT NULL,
  `ib_relationship_id` int(11) NOT NULL,
  `trade_id` int(11) DEFAULT NULL,
  `position_id` int(11) DEFAULT NULL,
  `commission_amount` decimal(15,4) NOT NULL,
  `commission_rate` decimal(5,4) NOT NULL,
  `total_commission` decimal(15,4) NOT NULL DEFAULT 0.0000 COMMENT 'Total commission before split',
  `ib_share_percent` decimal(5,2) NOT NULL DEFAULT 50.00 COMMENT 'IB share percentage at time of trade',
  `ib_amount` decimal(15,4) NOT NULL DEFAULT 0.0000 COMMENT 'Amount going to IB',
  `admin_amount` decimal(15,4) NOT NULL DEFAULT 0.0000 COMMENT 'Amount retained by admin',
  `client_commission` decimal(15,4) DEFAULT 0.0000 COMMENT 'Commission paid by client',
  `trade_volume` decimal(15,4) DEFAULT NULL,
  `currency` varchar(3) DEFAULT 'USD',
  `paid_at` timestamp NULL DEFAULT NULL,
  `status` enum('pending','paid','cancelled') DEFAULT 'pending',
  `payment_method` enum('account_credit','bank_transfer','check') DEFAULT 'account_credit',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ib_global_settings`
--

CREATE TABLE `ib_global_settings` (
  `id` int(11) NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` decimal(10,4) NOT NULL,
  `setting_description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Global IB configuration - admin controls commission rates and share percentages';

--
-- Dumping data for table `ib_global_settings`
--

INSERT INTO `ib_global_settings` (`id`, `setting_key`, `setting_value`, `setting_description`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'default_commission_rate', 0.0070, 'Default commission rate as percentage (0.70%)', 1, '2025-10-16 19:09:45', '2025-10-16 20:25:13'),
(2, 'default_ib_share_percent', 50.0000, 'Default percentage of commission that IBs receive', 1, '2025-10-16 19:09:45', '2025-10-16 19:09:45'),
(3, 'min_ib_share_percent', 10.0000, 'Minimum IB share percentage', 1, '2025-10-16 19:09:45', '2025-10-16 20:25:13'),
(4, 'max_ib_share_percent', 90.0000, 'Maximum IB share percentage', 1, '2025-10-16 19:09:45', '2025-10-16 20:25:13'),
(5, 'commission_calculation_method', 1.0000, '1=per trade, 2=per lot, 3=percentage', 1, '2025-10-16 19:09:45', '2025-10-16 19:09:45');

-- --------------------------------------------------------

--
-- Table structure for table `introducing_brokers`
--

CREATE TABLE `introducing_brokers` (
  `id` int(11) NOT NULL,
  `ib_user_id` int(11) NOT NULL,
  `client_user_id` int(11) NOT NULL,
  `referral_code` varchar(20) NOT NULL,
  `commission_rate` decimal(5,4) DEFAULT 0.0070,
  `ib_share_percent` decimal(5,2) NOT NULL DEFAULT 50.00 COMMENT 'Percentage of commission this IB receives (10-90)',
  `custom_commission_rate` decimal(10,4) DEFAULT NULL COMMENT 'Custom rate for this IB (overrides global)',
  `use_custom_rate` tinyint(1) DEFAULT 0 COMMENT 'Whether to use custom rate or global rate',
  `status` enum('active','inactive','suspended') DEFAULT 'active',
  `tier_level` enum('bronze','silver','gold','platinum') DEFAULT 'bronze',
  `total_commission_earned` decimal(15,4) DEFAULT 0.0000,
  `total_admin_share` decimal(15,4) DEFAULT 0.0000 COMMENT 'Total admin portion of commissions',
  `total_ib_share` decimal(15,4) DEFAULT 0.0000 COMMENT 'Total IB portion of commissions',
  `last_commission_date` timestamp NULL DEFAULT NULL COMMENT 'Last time commission was earned',
  `total_client_volume` decimal(15,4) DEFAULT 0.0000,
  `active_clients_count` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `kyc_documents`
--

CREATE TABLE `kyc_documents` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `document_type` enum('aadhar','pancard','passport','driving_license','voter_id') NOT NULL,
  `document_number` varchar(50) NOT NULL,
  `document_front_url` varchar(500) DEFAULT NULL,
  `document_back_url` varchar(500) DEFAULT NULL,
  `status` enum('pending','submitted','verified','rejected') DEFAULT 'pending',
  `rejection_reason` text DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `verified_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `mam_pamm_investors`
--

CREATE TABLE `mam_pamm_investors` (
  `id` int(11) NOT NULL,
  `master_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `invested_amount` decimal(15,4) NOT NULL,
  `current_equity` decimal(15,4) DEFAULT 0.0000,
  `allocation_percent` decimal(8,4) DEFAULT NULL,
  `join_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` enum('active','inactive','withdrawn') DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `mam_pamm_masters`
--

CREATE TABLE `mam_pamm_masters` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `strategy_name` varchar(200) NOT NULL,
  `strategy_description` text DEFAULT NULL,
  `management_type` enum('MAM','PAMM') NOT NULL,
  `allocation_method` enum('equal','proportional','custom') DEFAULT 'proportional',
  `performance_fee_percent` decimal(5,2) DEFAULT 0.00,
  `high_water_mark` tinyint(1) DEFAULT 1,
  `min_investment` decimal(15,4) DEFAULT 1000.0000,
  `max_investors` int(11) DEFAULT 100,
  `status` enum('active','inactive','closed') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `mam_pamm_performance`
--

CREATE TABLE `mam_pamm_performance` (
  `id` int(11) NOT NULL,
  `master_id` int(11) NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `total_return_percent` decimal(8,4) DEFAULT NULL,
  `total_trades` int(11) DEFAULT 0,
  `winning_trades` int(11) DEFAULT 0,
  `losing_trades` int(11) DEFAULT 0,
  `profit_factor` decimal(8,4) DEFAULT NULL,
  `sharpe_ratio` decimal(8,4) DEFAULT NULL,
  `max_drawdown_percent` decimal(8,4) DEFAULT NULL,
  `calculated_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `margin_events`
--

CREATE TABLE `margin_events` (
  `id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `event_type` enum('margin_call','stop_out','margin_warning') NOT NULL,
  `margin_level` decimal(8,2) NOT NULL COMMENT 'Margin level when event occurred',
  `equity` decimal(15,4) NOT NULL COMMENT 'Account equity at event time',
  `margin_used` decimal(15,4) NOT NULL COMMENT 'Total margin in use',
  `free_margin` decimal(15,4) NOT NULL COMMENT 'Available margin',
  `positions_closed` int(11) DEFAULT 0 COMMENT 'Number of positions auto-closed',
  `total_loss` decimal(15,4) DEFAULT 0.0000 COMMENT 'Total loss from closed positions',
  `notification_sent` tinyint(1) DEFAULT 0 COMMENT 'Whether user was notified',
  `resolved` tinyint(1) DEFAULT 0 COMMENT 'Whether situation was resolved',
  `resolved_at` timestamp NULL DEFAULT NULL COMMENT 'When margin level returned to safe',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Track margin calls, stop outs, and margin warnings for risk management';

-- --------------------------------------------------------

--
-- Table structure for table `market_data`
--

CREATE TABLE `market_data` (
  `id` int(11) NOT NULL,
  `symbol_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `open_price` decimal(12,6) NOT NULL,
  `high_price` decimal(12,6) NOT NULL,
  `low_price` decimal(12,6) NOT NULL,
  `close_price` decimal(12,6) NOT NULL,
  `current_price` decimal(12,6) NOT NULL,
  `volume` bigint(20) DEFAULT 0,
  `spread` decimal(8,4) DEFAULT 0.0000,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `market_data`
--

INSERT INTO `market_data` (`id`, `symbol_id`, `date`, `open_price`, `high_price`, `low_price`, `close_price`, `current_price`, `volume`, `spread`, `created_at`, `updated_at`) VALUES
(1, 5, '2025-10-09', 82.482373, 83.752486, 82.064848, 82.142559, 82.114677, 622720, 0.0075, '2025-10-09 05:34:38', '2025-10-09 05:34:38'),
(2, 6, '2025-10-09', 25.260311, 25.417949, 25.037766, 25.073827, 25.048991, 774326, 0.0006, '2025-10-09 05:34:38', '2025-10-09 05:34:38'),
(3, 1, '2025-10-09', 20.184732, 20.371170, 19.931094, 20.158044, 20.138507, 659285, 0.0017, '2025-10-09 05:34:38', '2025-10-09 05:34:38'),
(4, 2, '2025-10-09', 6.430192, 6.498896, 6.387061, 6.376194, 6.379591, 596853, 0.0018, '2025-10-09 05:34:38', '2025-10-09 05:34:38'),
(5, 8, '2025-10-09', 46.028386, 46.415104, 45.574940, 46.003133, 45.987315, 349903, 0.0042, '2025-10-09 05:34:38', '2025-10-09 05:34:38'),
(6, 7, '2025-10-09', 2.947394, 2.951304, 2.916676, 2.970697, 2.967822, 238440, 0.0059, '2025-10-09 05:34:38', '2025-10-09 05:34:38'),
(7, 3, '2025-10-09', 22.916766, 23.013380, 22.759524, 22.969104, 22.989077, 990703, 0.0002, '2025-10-09 05:34:38', '2025-10-09 05:34:38'),
(8, 4, '2025-10-09', 62.353545, 62.816307, 61.560253, 62.806454, 62.834949, 125890, 0.0098, '2025-10-09 05:34:38', '2025-10-09 05:34:38');

-- --------------------------------------------------------

--
-- Table structure for table `market_prices`
--

CREATE TABLE `market_prices` (
  `id` int(11) NOT NULL,
  `symbol_id` int(11) NOT NULL,
  `bid` decimal(12,6) NOT NULL,
  `ask` decimal(12,6) NOT NULL,
  `last` decimal(12,6) DEFAULT NULL,
  `high` decimal(12,6) DEFAULT NULL,
  `low` decimal(12,6) DEFAULT NULL,
  `volume` decimal(15,4) DEFAULT 0.0000,
  `change_amount` decimal(12,6) DEFAULT 0.000000,
  `change_percent` decimal(8,4) DEFAULT 0.0000,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `market_prices`
--

INSERT INTO `market_prices` (`id`, `symbol_id`, `bid`, `ask`, `last`, `high`, `low`, `volume`, `change_amount`, `change_percent`, `timestamp`) VALUES
(468801, 1, 1.085000, 1.085150, 1.085075, 1.085075, 1.085075, 342976.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468802, 2, 1.265000, 1.265200, 1.265100, 1.265100, 1.265100, 547955.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468803, 3, 149.500000, 149.515000, 149.507500, 149.507500, 149.507500, 838493.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468804, 4, 0.912500, 0.912680, 0.912590, 0.912590, 0.912590, 220735.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468805, 5, 1.358000, 1.358200, 1.358100, 1.358100, 1.358100, 854996.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468806, 6, 0.672000, 0.672180, 0.672090, 0.672090, 0.672090, 994488.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468807, 7, 0.618000, 0.618250, 0.618125, 0.618125, 0.618125, 79724.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468808, 8, 0.859000, 0.859180, 0.859090, 0.859090, 0.859090, 944357.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468809, 9, 162.250000, 162.275000, 162.262500, 162.262500, 162.262500, 327362.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468810, 10, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 408770.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468811, 11, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 168591.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468812, 12, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 462183.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468813, 13, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 609699.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468814, 14, 189.100000, 189.130000, 189.115000, 189.115000, 189.115000, 736502.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468815, 15, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 337316.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468816, 16, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 50283.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468817, 17, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 105390.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468818, 18, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 663420.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468819, 19, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 740873.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468820, 20, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 876839.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468821, 21, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 766930.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468822, 22, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 866670.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468823, 23, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 219131.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468824, 24, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 492455.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468825, 25, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 16061.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468826, 26, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 912258.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468827, 27, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 699541.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468828, 28, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 401904.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468829, 29, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 975633.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468830, 30, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 471813.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468831, 31, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 295830.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468832, 32, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 404313.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468833, 33, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 367694.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468834, 34, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 219680.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468835, 35, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 377004.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468836, 36, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 698819.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468837, 37, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 236258.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468838, 38, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 661229.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468839, 39, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 878603.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468840, 40, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 776923.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468841, 41, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 557365.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468842, 42, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 157910.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468843, 43, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 532839.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468844, 44, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 649706.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468845, 45, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 921829.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468846, 46, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 956690.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468847, 47, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 973693.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468848, 48, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 863785.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468849, 49, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 627831.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468850, 50, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 982233.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468851, 51, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 387903.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468852, 52, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 439812.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468853, 53, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 535114.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468854, 54, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 737576.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468855, 55, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 744082.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468856, 56, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 260015.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468857, 57, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 599998.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468858, 58, 1.000000, 1.000200, 1.000100, 1.000100, 1.000100, 656354.0000, 0.000000, 0.0000, '2025-10-17 07:00:27'),
(468859, 1, 1.082712, 1.082862, 1.082787, 1.082787, 1.082787, 296604.0000, -0.002288, -0.2108, '2025-10-17 07:00:30'),
(468860, 2, 1.258892, 1.259092, 1.258992, 1.258992, 1.258992, 621993.0000, -0.006108, -0.4828, '2025-10-17 07:00:30'),
(468861, 3, 149.644110, 149.659110, 149.651610, 149.651610, 149.651610, 126482.0000, 0.144110, 0.0964, '2025-10-17 07:00:30'),
(468862, 4, 0.911280, 0.911460, 0.911370, 0.911370, 0.911370, 922975.0000, -0.001220, -0.1337, '2025-10-17 07:00:30'),
(468863, 5, 1.357350, 1.357550, 1.357450, 1.357450, 1.357450, 48021.0000, -0.000650, -0.0479, '2025-10-17 07:00:30'),
(468864, 6, 0.672584, 0.672764, 0.672674, 0.672674, 0.672674, 581680.0000, 0.000584, 0.0869, '2025-10-17 07:00:30'),
(468865, 7, 0.618770, 0.619020, 0.618895, 0.618895, 0.618895, 208993.0000, 0.000770, 0.1247, '2025-10-17 07:00:30'),
(468866, 8, 0.856393, 0.856573, 0.856483, 0.856483, 0.856483, 581037.0000, -0.002607, -0.3035, '2025-10-17 07:00:30'),
(468867, 9, 162.593131, 162.618131, 162.605631, 162.605631, 162.605631, 807489.0000, 0.343131, 0.2115, '2025-10-17 07:00:30'),
(468868, 10, 1.002506, 1.002706, 1.002606, 1.002606, 1.002606, 597477.0000, 0.002506, 0.2506, '2025-10-17 07:00:30'),
(468869, 11, 1.001391, 1.001591, 1.001491, 1.001491, 1.001491, 452336.0000, 0.001391, 0.1391, '2025-10-17 07:00:30'),
(468870, 12, 0.998965, 0.999165, 0.999065, 0.999065, 0.999065, 845763.0000, -0.001035, -0.1035, '2025-10-17 07:00:30'),
(468871, 13, 1.003335, 1.003535, 1.003435, 1.003435, 1.003435, 611755.0000, 0.003335, 0.3334, '2025-10-17 07:00:30'),
(468872, 14, 189.698991, 189.728991, 189.713991, 189.713991, 189.713991, 663509.0000, 0.598991, 0.3167, '2025-10-17 07:00:30'),
(468873, 15, 1.001855, 1.002055, 1.001955, 1.001955, 1.001955, 825800.0000, 0.001855, 0.1855, '2025-10-17 07:00:30'),
(468874, 16, 1.003196, 1.003396, 1.003296, 1.003296, 1.003296, 707400.0000, 0.003196, 0.3195, '2025-10-17 07:00:30'),
(468875, 17, 0.998964, 0.999164, 0.999064, 0.999064, 0.999064, 885024.0000, -0.001036, -0.1036, '2025-10-17 07:00:30'),
(468876, 18, 1.000449, 1.000649, 1.000549, 1.000549, 1.000549, 453612.0000, 0.000449, 0.0449, '2025-10-17 07:00:30'),
(468877, 19, 0.998955, 0.999155, 0.999055, 0.999055, 0.999055, 886276.0000, -0.001045, -0.1045, '2025-10-17 07:00:30'),
(468878, 20, 1.002686, 1.002886, 1.002786, 1.002786, 1.002786, 674936.0000, 0.002686, 0.2685, '2025-10-17 07:00:30'),
(468879, 21, 1.000702, 1.000902, 1.000802, 1.000802, 1.000802, 216531.0000, 0.000702, 0.0702, '2025-10-17 07:00:30'),
(468880, 22, 1.001130, 1.001330, 1.001230, 1.001230, 1.001230, 107512.0000, 0.001130, 0.1130, '2025-10-17 07:00:30'),
(468881, 23, 0.997313, 0.997513, 0.997413, 0.997413, 0.997413, 485721.0000, -0.002687, -0.2687, '2025-10-17 07:00:30'),
(468882, 24, 1.003927, 1.004127, 1.004027, 1.004027, 1.004027, 324361.0000, 0.003927, 0.3926, '2025-10-17 07:00:30'),
(468883, 25, 1.002508, 1.002708, 1.002608, 1.002608, 1.002608, 610502.0000, 0.002508, 0.2508, '2025-10-17 07:00:30'),
(468884, 26, 0.999923, 1.000123, 1.000023, 1.000023, 1.000023, 357118.0000, -0.000077, -0.0077, '2025-10-17 07:00:30'),
(468885, 27, 1.003607, 1.003807, 1.003707, 1.003707, 1.003707, 908448.0000, 0.003607, 0.3607, '2025-10-17 07:00:30'),
(468886, 28, 1.002083, 1.002283, 1.002183, 1.002183, 1.002183, 510799.0000, 0.002083, 0.2083, '2025-10-17 07:00:30'),
(468887, 29, 1.003895, 1.004095, 1.003995, 1.003995, 1.003995, 492631.0000, 0.003895, 0.3894, '2025-10-17 07:00:30'),
(468888, 30, 0.996537, 0.996737, 0.996637, 0.996637, 0.996637, 295074.0000, -0.003463, -0.3463, '2025-10-17 07:00:30'),
(468889, 31, 0.998499, 0.998699, 0.998599, 0.998599, 0.998599, 593503.0000, -0.001501, -0.1500, '2025-10-17 07:00:30'),
(468890, 32, 0.997429, 0.997629, 0.997529, 0.997529, 0.997529, 752914.0000, -0.002571, -0.2571, '2025-10-17 07:00:30'),
(468891, 33, 1.003799, 1.003999, 1.003899, 1.003899, 1.003899, 582647.0000, 0.003799, 0.3799, '2025-10-17 07:00:30'),
(468892, 34, 1.001707, 1.001907, 1.001807, 1.001807, 1.001807, 415090.0000, 0.001707, 0.1707, '2025-10-17 07:00:30'),
(468893, 35, 0.996910, 0.997110, 0.997010, 0.997010, 0.997010, 654595.0000, -0.003090, -0.3089, '2025-10-17 07:00:30'),
(468894, 36, 1.002175, 1.002375, 1.002275, 1.002275, 1.002275, 812608.0000, 0.002175, 0.2175, '2025-10-17 07:00:30'),
(468895, 37, 1.001954, 1.002154, 1.002054, 1.002054, 1.002054, 940686.0000, 0.001954, 0.1953, '2025-10-17 07:00:30'),
(468896, 38, 0.996752, 0.996952, 0.996852, 0.996852, 0.996852, 878340.0000, -0.003248, -0.3248, '2025-10-17 07:00:30'),
(468897, 39, 0.995519, 0.995719, 0.995619, 0.995619, 0.995619, 770645.0000, -0.004481, -0.4481, '2025-10-17 07:00:30'),
(468898, 40, 1.004929, 1.005129, 1.005029, 1.005029, 1.005029, 736498.0000, 0.004929, 0.4929, '2025-10-17 07:00:30'),
(468899, 41, 1.001963, 1.002163, 1.002063, 1.002063, 1.002063, 965547.0000, 0.001963, 0.1963, '2025-10-17 07:00:30'),
(468900, 42, 1.001757, 1.001957, 1.001857, 1.001857, 1.001857, 255188.0000, 0.001757, 0.1756, '2025-10-17 07:00:30'),
(468901, 43, 0.995989, 0.996189, 0.996089, 0.996089, 0.996089, 802801.0000, -0.004011, -0.4011, '2025-10-17 07:00:30'),
(468902, 44, 1.001087, 1.001287, 1.001187, 1.001187, 1.001187, 438446.0000, 0.001087, 0.1086, '2025-10-17 07:00:30'),
(468903, 45, 0.996466, 0.996666, 0.996566, 0.996566, 0.996566, 776390.0000, -0.003534, -0.3533, '2025-10-17 07:00:30'),
(468904, 46, 0.996471, 0.996671, 0.996571, 0.996571, 0.996571, 925238.0000, -0.003529, -0.3529, '2025-10-17 07:00:30'),
(468905, 47, 1.004310, 1.004510, 1.004410, 1.004410, 1.004410, 230918.0000, 0.004310, 0.4310, '2025-10-17 07:00:30'),
(468906, 48, 1.001341, 1.001541, 1.001441, 1.001441, 1.001441, 203857.0000, 0.001341, 0.1341, '2025-10-17 07:00:30'),
(468907, 49, 0.999107, 0.999307, 0.999207, 0.999207, 0.999207, 777414.0000, -0.000893, -0.0893, '2025-10-17 07:00:30'),
(468908, 50, 1.002930, 1.003130, 1.003030, 1.003030, 1.003030, 327528.0000, 0.002930, 0.2930, '2025-10-17 07:00:30'),
(468909, 51, 1.001736, 1.001936, 1.001836, 1.001836, 1.001836, 64220.0000, 0.001736, 0.1736, '2025-10-17 07:00:30'),
(468910, 52, 1.000030, 1.000230, 1.000130, 1.000130, 1.000130, 555408.0000, 0.000030, 0.0030, '2025-10-17 07:00:30'),
(468911, 53, 1.001408, 1.001608, 1.001508, 1.001508, 1.001508, 42007.0000, 0.001408, 0.1408, '2025-10-17 07:00:30'),
(468912, 54, 0.998774, 0.998974, 0.998874, 0.998874, 0.998874, 621379.0000, -0.001226, -0.1226, '2025-10-17 07:00:30'),
(468913, 55, 1.002970, 1.003170, 1.003070, 1.003070, 1.003070, 39469.0000, 0.002970, 0.2970, '2025-10-17 07:00:30'),
(468914, 56, 1.003861, 1.004061, 1.003961, 1.003961, 1.003961, 955392.0000, 0.003861, 0.3860, '2025-10-17 07:00:30'),
(468915, 57, 0.996556, 0.996756, 0.996656, 0.996656, 0.996656, 753644.0000, -0.003444, -0.3443, '2025-10-17 07:00:30'),
(468916, 58, 0.995942, 0.996142, 0.996042, 0.996042, 0.996042, 231546.0000, -0.004058, -0.4058, '2025-10-17 07:00:30'),
(468917, 1, 1.082379, 1.082529, 1.082454, 1.082454, 1.082454, 915829.0000, -0.000333, -0.0307, '2025-10-17 07:00:35'),
(468918, 2, 1.253320, 1.253520, 1.253420, 1.253420, 1.253420, 184907.0000, -0.005572, -0.4426, '2025-10-17 07:00:35'),
(468919, 3, 150.316664, 150.331664, 150.324164, 150.324164, 150.324164, 509999.0000, 0.672554, 0.4494, '2025-10-17 07:00:35'),
(468920, 4, 0.913514, 0.913694, 0.913604, 0.913604, 0.913604, 508820.0000, 0.002234, 0.2451, '2025-10-17 07:00:35'),
(468921, 5, 1.357061, 1.357261, 1.357161, 1.357161, 1.357161, 879886.0000, -0.000289, -0.0213, '2025-10-17 07:00:35'),
(468922, 6, 0.674778, 0.674958, 0.674868, 0.674868, 0.674868, 179573.0000, 0.002194, 0.3262, '2025-10-17 07:00:35'),
(468923, 7, 0.616863, 0.617113, 0.616988, 0.616988, 0.616988, 597825.0000, -0.001907, -0.3082, '2025-10-17 07:00:35'),
(468924, 8, 0.854812, 0.854992, 0.854902, 0.854902, 0.854902, 459522.0000, -0.001581, -0.1846, '2025-10-17 07:00:35'),
(468925, 9, 162.175830, 162.200830, 162.188330, 162.188330, 162.188330, 161771.0000, -0.417301, -0.2566, '2025-10-17 07:00:35'),
(468926, 10, 1.003641, 1.003841, 1.003741, 1.003741, 1.003741, 602303.0000, 0.001135, 0.1132, '2025-10-17 07:00:35'),
(468927, 11, 1.002827, 1.003027, 1.002927, 1.002927, 1.002927, 520175.0000, 0.001436, 0.1434, '2025-10-17 07:00:35'),
(468928, 12, 0.997506, 0.997706, 0.997606, 0.997606, 0.997606, 899684.0000, -0.001459, -0.1460, '2025-10-17 07:00:35'),
(468929, 13, 1.001641, 1.001841, 1.001741, 1.001741, 1.001741, 545861.0000, -0.001694, -0.1688, '2025-10-17 07:00:35'),
(468930, 14, 189.796552, 189.826552, 189.811552, 189.811552, 189.811552, 568687.0000, 0.097561, 0.0514, '2025-10-17 07:00:35'),
(468931, 15, 0.997901, 0.998101, 0.998001, 0.998001, 0.998001, 119628.0000, -0.003954, -0.3946, '2025-10-17 07:00:35'),
(468932, 16, 1.005885, 1.006085, 1.005985, 1.005985, 1.005985, 696352.0000, 0.002689, 0.2680, '2025-10-17 07:00:35'),
(468933, 17, 1.001014, 1.001214, 1.001114, 1.001114, 1.001114, 362366.0000, 0.002050, 0.2052, '2025-10-17 07:00:35'),
(468934, 18, 0.995858, 0.996058, 0.995958, 0.995958, 0.995958, 375412.0000, -0.004591, -0.4588, '2025-10-17 07:00:35'),
(468935, 19, 0.999423, 0.999623, 0.999523, 0.999523, 0.999523, 280657.0000, 0.000468, 0.0468, '2025-10-17 07:00:35'),
(468936, 20, 0.999448, 0.999648, 0.999548, 0.999548, 0.999548, 747357.0000, -0.003238, -0.3229, '2025-10-17 07:00:35'),
(468937, 21, 0.996555, 0.996755, 0.996655, 0.996655, 0.996655, 4024.0000, -0.004147, -0.4144, '2025-10-17 07:00:35'),
(468938, 22, 0.996894, 0.997094, 0.996994, 0.996994, 0.996994, 776379.0000, -0.004236, -0.4231, '2025-10-17 07:00:35'),
(468939, 23, 1.001196, 1.001396, 1.001296, 1.001296, 1.001296, 635549.0000, 0.003883, 0.3893, '2025-10-17 07:00:35'),
(468940, 24, 1.004877, 1.005077, 1.004977, 1.004977, 1.004977, 616732.0000, 0.000950, 0.0947, '2025-10-17 07:00:35'),
(468941, 25, 1.000215, 1.000415, 1.000315, 1.000315, 1.000315, 669939.0000, -0.002293, -0.2287, '2025-10-17 07:00:35'),
(468942, 26, 1.000039, 1.000239, 1.000139, 1.000139, 1.000139, 142953.0000, 0.000116, 0.0116, '2025-10-17 07:00:35'),
(468943, 27, 1.004833, 1.005033, 1.004933, 1.004933, 1.004933, 92579.0000, 0.001226, 0.1222, '2025-10-17 07:00:35'),
(468944, 28, 0.997894, 0.998094, 0.997994, 0.997994, 0.997994, 514870.0000, -0.004189, -0.4180, '2025-10-17 07:00:35'),
(468945, 29, 1.002165, 1.002365, 1.002265, 1.002265, 1.002265, 271714.0000, -0.001730, -0.1723, '2025-10-17 07:00:35'),
(468946, 30, 0.996356, 0.996556, 0.996456, 0.996456, 0.996456, 896481.0000, -0.000181, -0.0182, '2025-10-17 07:00:35'),
(468947, 31, 1.002289, 1.002489, 1.002389, 1.002389, 1.002389, 828740.0000, 0.003790, 0.3796, '2025-10-17 07:00:35'),
(468948, 32, 0.999027, 0.999227, 0.999127, 0.999127, 0.999127, 81308.0000, 0.001598, 0.1602, '2025-10-17 07:00:35'),
(468949, 33, 1.003627, 1.003827, 1.003727, 1.003727, 1.003727, 242724.0000, -0.000172, -0.0171, '2025-10-17 07:00:35'),
(468950, 34, 1.003100, 1.003300, 1.003200, 1.003200, 1.003200, 374727.0000, 0.001393, 0.1390, '2025-10-17 07:00:35'),
(468951, 35, 0.998982, 0.999182, 0.999082, 0.999082, 0.999082, 327555.0000, 0.002072, 0.2078, '2025-10-17 07:00:35'),
(468952, 36, 1.005920, 1.006120, 1.006020, 1.006020, 1.006020, 724033.0000, 0.003745, 0.3737, '2025-10-17 07:00:35'),
(468953, 37, 0.999693, 0.999893, 0.999793, 0.999793, 0.999793, 470821.0000, -0.002261, -0.2256, '2025-10-17 07:00:35'),
(468954, 38, 0.996768, 0.996968, 0.996868, 0.996868, 0.996868, 187333.0000, 0.000016, 0.0016, '2025-10-17 07:00:35'),
(468955, 39, 0.998030, 0.998230, 0.998130, 0.998130, 0.998130, 981081.0000, 0.002511, 0.2522, '2025-10-17 07:00:35'),
(468956, 40, 1.001413, 1.001613, 1.001513, 1.001513, 1.001513, 134835.0000, -0.003516, -0.3498, '2025-10-17 07:00:35'),
(468957, 41, 1.005777, 1.005977, 1.005877, 1.005877, 1.005877, 189398.0000, 0.003814, 0.3806, '2025-10-17 07:00:35'),
(468958, 42, 0.997948, 0.998148, 0.998048, 0.998048, 0.998048, 734975.0000, -0.003809, -0.3802, '2025-10-17 07:00:35'),
(468959, 43, 0.993130, 0.993330, 0.993230, 0.993230, 0.993230, 662574.0000, -0.002859, -0.2870, '2025-10-17 07:00:35'),
(468960, 44, 1.004454, 1.004654, 1.004554, 1.004554, 1.004554, 574960.0000, 0.003367, 0.3363, '2025-10-17 07:00:35'),
(468961, 45, 1.000664, 1.000864, 1.000764, 1.000764, 1.000764, 258864.0000, 0.004198, 0.4213, '2025-10-17 07:00:35'),
(468962, 46, 1.001113, 1.001313, 1.001213, 1.001213, 1.001213, 380152.0000, 0.004642, 0.4658, '2025-10-17 07:00:35'),
(468963, 47, 1.005571, 1.005771, 1.005671, 1.005671, 1.005671, 698497.0000, 0.001261, 0.1255, '2025-10-17 07:00:35'),
(468964, 48, 0.999117, 0.999317, 0.999217, 0.999217, 0.999217, 114987.0000, -0.002224, -0.2221, '2025-10-17 07:00:35'),
(468965, 49, 1.000038, 1.000238, 1.000138, 1.000138, 1.000138, 310105.0000, 0.000931, 0.0932, '2025-10-17 07:00:35'),
(468966, 50, 0.998708, 0.998908, 0.998808, 0.998808, 0.998808, 802287.0000, -0.004222, -0.4210, '2025-10-17 07:00:35'),
(468967, 51, 1.006422, 1.006622, 1.006522, 1.006522, 1.006522, 680238.0000, 0.004686, 0.4677, '2025-10-17 07:00:35'),
(468968, 52, 0.998606, 0.998806, 0.998706, 0.998706, 0.998706, 361745.0000, -0.001424, -0.1424, '2025-10-17 07:00:35'),
(468969, 53, 1.005503, 1.005703, 1.005603, 1.005603, 1.005603, 97533.0000, 0.004095, 0.4089, '2025-10-17 07:00:35'),
(468970, 54, 0.993990, 0.994190, 0.994090, 0.994090, 0.994090, 927881.0000, -0.004784, -0.4789, '2025-10-17 07:00:35'),
(468971, 55, 1.004320, 1.004520, 1.004420, 1.004420, 1.004420, 721445.0000, 0.001350, 0.1346, '2025-10-17 07:00:35'),
(468972, 56, 1.005541, 1.005741, 1.005641, 1.005641, 1.005641, 579619.0000, 0.001680, 0.1674, '2025-10-17 07:00:35'),
(468973, 57, 1.000469, 1.000669, 1.000569, 1.000569, 1.000569, 886096.0000, 0.003913, 0.3926, '2025-10-17 07:00:35'),
(468974, 58, 0.992912, 0.993112, 0.993012, 0.993012, 0.993012, 316493.0000, -0.003030, -0.3042, '2025-10-17 07:00:35'),
(468975, 1, 1.077533, 1.077683, 1.077608, 1.077608, 1.077608, 373249.0000, -0.004846, -0.4477, '2025-10-17 07:00:40'),
(468976, 2, 1.250207, 1.250407, 1.250307, 1.250307, 1.250307, 827281.0000, -0.003113, -0.2484, '2025-10-17 07:00:40'),
(468977, 3, 150.547430, 150.562430, 150.554930, 150.554930, 150.554930, 721993.0000, 0.230766, 0.1535, '2025-10-17 07:00:40'),
(468978, 4, 0.917165, 0.917345, 0.917255, 0.917255, 0.917255, 109673.0000, 0.003651, 0.3997, '2025-10-17 07:00:40'),
(468979, 5, 1.361471, 1.361671, 1.361571, 1.361571, 1.361571, 793470.0000, 0.004410, 0.3249, '2025-10-17 07:00:40'),
(468980, 6, 0.676967, 0.677147, 0.677057, 0.677057, 0.677057, 544322.0000, 0.002189, 0.3243, '2025-10-17 07:00:40'),
(468981, 7, 0.617893, 0.618143, 0.618018, 0.618018, 0.618018, 982003.0000, 0.001030, 0.1669, '2025-10-17 07:00:40'),
(468982, 8, 0.858388, 0.858568, 0.858478, 0.858478, 0.858478, 807319.0000, 0.003576, 0.4182, '2025-10-17 07:00:40'),
(468983, 9, 162.945462, 162.970462, 162.957962, 162.957962, 162.957962, 173803.0000, 0.769632, 0.4745, '2025-10-17 07:00:40'),
(468984, 10, 1.001218, 1.001418, 1.001318, 1.001318, 1.001318, 595754.0000, -0.002423, -0.2414, '2025-10-17 07:00:40'),
(468985, 11, 1.004144, 1.004344, 1.004244, 1.004244, 1.004244, 479914.0000, 0.001317, 0.1313, '2025-10-17 07:00:40'),
(468986, 12, 0.999148, 0.999348, 0.999248, 0.999248, 0.999248, 583583.0000, 0.001642, 0.1646, '2025-10-17 07:00:40'),
(468987, 13, 1.006648, 1.006848, 1.006748, 1.006748, 1.006748, 670118.0000, 0.005007, 0.4998, '2025-10-17 07:00:40'),
(468988, 14, 190.645480, 190.675480, 190.660480, 190.660480, 190.660480, 965426.0000, 0.848928, 0.4472, '2025-10-17 07:00:40'),
(468989, 15, 0.994551, 0.994751, 0.994651, 0.994651, 0.994651, 908350.0000, -0.003350, -0.3356, '2025-10-17 07:00:40'),
(468990, 16, 1.006644, 1.006844, 1.006744, 1.006744, 1.006744, 666987.0000, 0.000759, 0.0754, '2025-10-17 07:00:40'),
(468991, 17, 0.997868, 0.998068, 0.997968, 0.997968, 0.997968, 504617.0000, -0.003146, -0.3143, '2025-10-17 07:00:40'),
(468992, 18, 0.991393, 0.991593, 0.991493, 0.991493, 0.991493, 162960.0000, -0.004465, -0.4483, '2025-10-17 07:00:40'),
(468993, 19, 1.000183, 1.000383, 1.000283, 1.000283, 1.000283, 226692.0000, 0.000760, 0.0760, '2025-10-17 07:00:40'),
(468994, 20, 1.003343, 1.003543, 1.003443, 1.003443, 1.003443, 446846.0000, 0.003895, 0.3897, '2025-10-17 07:00:40'),
(468995, 21, 0.997076, 0.997276, 0.997176, 0.997176, 0.997176, 449503.0000, 0.000521, 0.0523, '2025-10-17 07:00:40'),
(468996, 22, 0.999318, 0.999518, 0.999418, 0.999418, 0.999418, 328907.0000, 0.002424, 0.2432, '2025-10-17 07:00:40'),
(468997, 23, 1.001374, 1.001574, 1.001474, 1.001474, 1.001474, 570789.0000, 0.000178, 0.0178, '2025-10-17 07:00:40'),
(468998, 24, 1.000876, 1.001076, 1.000976, 1.000976, 1.000976, 494165.0000, -0.004001, -0.3981, '2025-10-17 07:00:40'),
(468999, 25, 1.001527, 1.001727, 1.001627, 1.001627, 1.001627, 728957.0000, 0.001312, 0.1312, '2025-10-17 07:00:40'),
(469000, 26, 1.004112, 1.004312, 1.004212, 1.004212, 1.004212, 808136.0000, 0.004073, 0.4073, '2025-10-17 07:00:40'),
(469001, 27, 1.003828, 1.004028, 1.003928, 1.003928, 1.003928, 546085.0000, -0.001005, -0.1000, '2025-10-17 07:00:40'),
(469002, 28, 0.994468, 0.994668, 0.994568, 0.994568, 0.994568, 644908.0000, -0.003426, -0.3433, '2025-10-17 07:00:40'),
(469003, 29, 1.005320, 1.005520, 1.005420, 1.005420, 1.005420, 736171.0000, 0.003155, 0.3148, '2025-10-17 07:00:40'),
(469004, 30, 0.999448, 0.999648, 0.999548, 0.999548, 0.999548, 948394.0000, 0.003092, 0.3103, '2025-10-17 07:00:40'),
(469005, 31, 1.006297, 1.006497, 1.006397, 1.006397, 1.006397, 751273.0000, 0.004008, 0.3998, '2025-10-17 07:00:40'),
(469006, 32, 1.003845, 1.004045, 1.003945, 1.003945, 1.003945, 54465.0000, 0.004818, 0.4822, '2025-10-17 07:00:40'),
(469007, 33, 1.004941, 1.005141, 1.005041, 1.005041, 1.005041, 517637.0000, 0.001314, 0.1309, '2025-10-17 07:00:40'),
(469008, 34, 1.000607, 1.000807, 1.000707, 1.000707, 1.000707, 540387.0000, -0.002493, -0.2485, '2025-10-17 07:00:40'),
(469009, 35, 0.999393, 0.999593, 0.999493, 0.999493, 0.999493, 20803.0000, 0.000411, 0.0412, '2025-10-17 07:00:40'),
(469010, 36, 1.008900, 1.009100, 1.009000, 1.009000, 1.009000, 798192.0000, 0.002980, 0.2962, '2025-10-17 07:00:40'),
(469011, 37, 0.998481, 0.998681, 0.998581, 0.998581, 0.998581, 632244.0000, -0.001212, -0.1212, '2025-10-17 07:00:40'),
(469012, 38, 0.998447, 0.998647, 0.998547, 0.998547, 0.998547, 857651.0000, 0.001679, 0.1684, '2025-10-17 07:00:40'),
(469013, 39, 1.000291, 1.000491, 1.000391, 1.000391, 1.000391, 358183.0000, 0.002261, 0.2265, '2025-10-17 07:00:40'),
(469014, 40, 1.002559, 1.002759, 1.002659, 1.002659, 1.002659, 817233.0000, 0.001146, 0.1144, '2025-10-17 07:00:40'),
(469015, 41, 1.009510, 1.009710, 1.009610, 1.009610, 1.009610, 10786.0000, 0.003733, 0.3711, '2025-10-17 07:00:40'),
(469016, 42, 0.997579, 0.997779, 0.997679, 0.997679, 0.997679, 409208.0000, -0.000369, -0.0370, '2025-10-17 07:00:40'),
(469017, 43, 0.993166, 0.993366, 0.993266, 0.993266, 0.993266, 258800.0000, 0.000036, 0.0037, '2025-10-17 07:00:40'),
(469018, 44, 1.006168, 1.006368, 1.006268, 1.006268, 1.006268, 794903.0000, 0.001714, 0.1706, '2025-10-17 07:00:40'),
(469019, 45, 1.004436, 1.004636, 1.004536, 1.004536, 1.004536, 160917.0000, 0.003772, 0.3769, '2025-10-17 07:00:40'),
(469020, 46, 1.000618, 1.000818, 1.000718, 1.000718, 1.000718, 315195.0000, -0.000495, -0.0495, '2025-10-17 07:00:40'),
(469021, 47, 1.010407, 1.010607, 1.010507, 1.010507, 1.010507, 595079.0000, 0.004836, 0.4808, '2025-10-17 07:00:40'),
(469022, 48, 0.998438, 0.998638, 0.998538, 0.998538, 0.998538, 575242.0000, -0.000679, -0.0679, '2025-10-17 07:00:40'),
(469023, 49, 1.001029, 1.001229, 1.001129, 1.001129, 1.001129, 366.0000, 0.000991, 0.0991, '2025-10-17 07:00:40'),
(469024, 50, 1.001833, 1.002033, 1.001933, 1.001933, 1.001933, 165406.0000, 0.003125, 0.3128, '2025-10-17 07:00:40'),
(469025, 51, 1.002620, 1.002820, 1.002720, 1.002720, 1.002720, 252204.0000, -0.003802, -0.3777, '2025-10-17 07:00:40'),
(469026, 52, 0.994155, 0.994355, 0.994255, 0.994255, 0.994255, 220003.0000, -0.004451, -0.4456, '2025-10-17 07:00:40'),
(469027, 53, 1.008786, 1.008986, 1.008886, 1.008886, 1.008886, 792131.0000, 0.003283, 0.3264, '2025-10-17 07:00:40'),
(469028, 54, 0.994717, 0.994917, 0.994817, 0.994817, 0.994817, 681938.0000, 0.000727, 0.0731, '2025-10-17 07:00:40'),
(469029, 55, 1.002731, 1.002931, 1.002831, 1.002831, 1.002831, 951133.0000, -0.001589, -0.1582, '2025-10-17 07:00:40'),
(469030, 56, 1.006627, 1.006827, 1.006727, 1.006727, 1.006727, 488389.0000, 0.001086, 0.1080, '2025-10-17 07:00:40'),
(469031, 57, 1.003450, 1.003650, 1.003550, 1.003550, 1.003550, 832039.0000, 0.002981, 0.2979, '2025-10-17 07:00:40'),
(469032, 58, 0.996670, 0.996870, 0.996770, 0.996770, 0.996770, 629664.0000, 0.003758, 0.3784, '2025-10-17 07:00:40'),
(469033, 1, 1.075227, 1.075377, 1.075302, 1.075302, 1.075302, 652583.0000, -0.002306, -0.2140, '2025-10-17 07:00:45'),
(469034, 2, 1.247912, 1.248112, 1.248012, 1.248012, 1.248012, 665514.0000, -0.002295, -0.1835, '2025-10-17 07:00:45'),
(469035, 3, 151.073064, 151.088064, 151.080564, 151.080564, 151.080564, 281011.0000, 0.525634, 0.3491, '2025-10-17 07:00:45'),
(469036, 4, 0.919460, 0.919640, 0.919550, 0.919550, 0.919550, 907219.0000, 0.002295, 0.2502, '2025-10-17 07:00:45'),
(469037, 5, 1.365409, 1.365609, 1.365509, 1.365509, 1.365509, 565793.0000, 0.003938, 0.2893, '2025-10-17 07:00:45'),
(469038, 6, 0.677809, 0.677989, 0.677899, 0.677899, 0.677899, 365721.0000, 0.000842, 0.1243, '2025-10-17 07:00:45'),
(469039, 7, 0.618614, 0.618864, 0.618739, 0.618739, 0.618739, 643857.0000, 0.000721, 0.1167, '2025-10-17 07:00:45'),
(469040, 8, 0.858736, 0.858916, 0.858826, 0.858826, 0.858826, 691648.0000, 0.000348, 0.0405, '2025-10-17 07:00:45'),
(469041, 9, 163.599200, 163.624200, 163.611700, 163.611700, 163.611700, 832510.0000, 0.653738, 0.4012, '2025-10-17 07:00:45'),
(469042, 10, 1.003185, 1.003385, 1.003285, 1.003285, 1.003285, 838584.0000, 0.001967, 0.1964, '2025-10-17 07:00:45'),
(469043, 11, 1.001093, 1.001293, 1.001193, 1.001193, 1.001193, 494271.0000, -0.003051, -0.3038, '2025-10-17 07:00:45'),
(469044, 12, 0.997157, 0.997357, 0.997257, 0.997257, 0.997257, 132542.0000, -0.001991, -0.1992, '2025-10-17 07:00:45'),
(469045, 13, 1.006808, 1.007008, 1.006908, 1.006908, 1.006908, 393020.0000, 0.000160, 0.0159, '2025-10-17 07:00:45'),
(469046, 14, 190.498223, 190.528223, 190.513223, 190.513223, 190.513223, 540921.0000, -0.147257, -0.0772, '2025-10-17 07:00:45'),
(469047, 15, 0.992879, 0.993079, 0.992979, 0.992979, 0.992979, 866730.0000, -0.001672, -0.1681, '2025-10-17 07:00:45'),
(469048, 16, 1.006676, 1.006876, 1.006776, 1.006776, 1.006776, 546967.0000, 0.000032, 0.0032, '2025-10-17 07:00:45'),
(469049, 17, 0.992963, 0.993163, 0.993063, 0.993063, 0.993063, 178261.0000, -0.004905, -0.4915, '2025-10-17 07:00:45'),
(469050, 18, 0.995432, 0.995632, 0.995532, 0.995532, 0.995532, 411122.0000, 0.004039, 0.4073, '2025-10-17 07:00:45'),
(469051, 19, 0.997828, 0.998028, 0.997928, 0.997928, 0.997928, 995249.0000, -0.002355, -0.2354, '2025-10-17 07:00:45'),
(469052, 20, 1.001556, 1.001756, 1.001656, 1.001656, 1.001656, 326637.0000, -0.001787, -0.1781, '2025-10-17 07:00:45'),
(469053, 21, 0.994675, 0.994875, 0.994775, 0.994775, 0.994775, 681222.0000, -0.002401, -0.2408, '2025-10-17 07:00:45'),
(469054, 22, 0.997049, 0.997249, 0.997149, 0.997149, 0.997149, 646030.0000, -0.002269, -0.2270, '2025-10-17 07:00:45'),
(469055, 23, 0.999515, 0.999715, 0.999615, 0.999615, 0.999615, 758886.0000, -0.001859, -0.1856, '2025-10-17 07:00:45'),
(469056, 24, 0.999362, 0.999562, 0.999462, 0.999462, 0.999462, 454786.0000, -0.001514, -0.1512, '2025-10-17 07:00:45'),
(469057, 25, 0.998643, 0.998843, 0.998743, 0.998743, 0.998743, 808722.0000, -0.002884, -0.2880, '2025-10-17 07:00:45'),
(469058, 26, 1.001410, 1.001610, 1.001510, 1.001510, 1.001510, 338870.0000, -0.002702, -0.2691, '2025-10-17 07:00:45'),
(469059, 27, 0.999870, 1.000070, 0.999970, 0.999970, 0.999970, 900048.0000, -0.003958, -0.3943, '2025-10-17 07:00:45'),
(469060, 28, 0.992978, 0.993178, 0.993078, 0.993078, 0.993078, 323436.0000, -0.001490, -0.1498, '2025-10-17 07:00:45'),
(469061, 29, 1.002230, 1.002430, 1.002330, 1.002330, 1.002330, 188296.0000, -0.003090, -0.3074, '2025-10-17 07:00:45'),
(469062, 30, 1.002375, 1.002575, 1.002475, 1.002475, 1.002475, 155700.0000, 0.002927, 0.2929, '2025-10-17 07:00:45'),
(469063, 31, 1.009208, 1.009408, 1.009308, 1.009308, 1.009308, 740014.0000, 0.002911, 0.2892, '2025-10-17 07:00:45'),
(469064, 32, 1.004949, 1.005149, 1.005049, 1.005049, 1.005049, 354409.0000, 0.001104, 0.1099, '2025-10-17 07:00:45'),
(469065, 33, 1.002399, 1.002599, 1.002499, 1.002499, 1.002499, 997577.0000, -0.002542, -0.2529, '2025-10-17 07:00:45'),
(469066, 34, 1.005516, 1.005716, 1.005616, 1.005616, 1.005616, 988006.0000, 0.004909, 0.4906, '2025-10-17 07:00:45'),
(469067, 35, 1.001806, 1.002006, 1.001906, 1.001906, 1.001906, 634495.0000, 0.002413, 0.2414, '2025-10-17 07:00:45'),
(469068, 36, 1.012571, 1.012771, 1.012671, 1.012671, 1.012671, 483801.0000, 0.003671, 0.3638, '2025-10-17 07:00:45'),
(469069, 37, 1.001729, 1.001929, 1.001829, 1.001829, 1.001829, 582800.0000, 0.003248, 0.3253, '2025-10-17 07:00:45'),
(469070, 38, 0.995884, 0.996084, 0.995984, 0.995984, 0.995984, 399131.0000, -0.002563, -0.2567, '2025-10-17 07:00:45'),
(469071, 39, 1.001086, 1.001286, 1.001186, 1.001186, 1.001186, 599971.0000, 0.000795, 0.0794, '2025-10-17 07:00:45'),
(469072, 40, 1.000078, 1.000278, 1.000178, 1.000178, 1.000178, 862825.0000, -0.002481, -0.2474, '2025-10-17 07:00:45'),
(469073, 41, 1.009529, 1.009729, 1.009629, 1.009629, 1.009629, 580485.0000, 0.000019, 0.0019, '2025-10-17 07:00:45'),
(469074, 42, 1.001941, 1.002141, 1.002041, 1.002041, 1.002041, 829107.0000, 0.004362, 0.4372, '2025-10-17 07:00:45'),
(469075, 43, 0.996243, 0.996443, 0.996343, 0.996343, 0.996343, 408707.0000, 0.003077, 0.3098, '2025-10-17 07:00:45'),
(469076, 44, 1.001872, 1.002072, 1.001972, 1.001972, 1.001972, 728218.0000, -0.004296, -0.4269, '2025-10-17 07:00:45'),
(469077, 45, 1.000787, 1.000987, 1.000887, 1.000887, 1.000887, 188663.0000, -0.003649, -0.3632, '2025-10-17 07:00:45'),
(469078, 46, 0.998539, 0.998739, 0.998639, 0.998639, 0.998639, 823963.0000, -0.002079, -0.2077, '2025-10-17 07:00:45'),
(469079, 47, 1.011558, 1.011758, 1.011658, 1.011658, 1.011658, 385709.0000, 0.001151, 0.1139, '2025-10-17 07:00:45'),
(469080, 48, 0.994668, 0.994868, 0.994768, 0.994768, 0.994768, 637773.0000, -0.003770, -0.3775, '2025-10-17 07:00:45'),
(469081, 49, 0.996356, 0.996556, 0.996456, 0.996456, 0.996456, 551470.0000, -0.004673, -0.4668, '2025-10-17 07:00:45'),
(469082, 50, 0.997298, 0.997498, 0.997398, 0.997398, 0.997398, 338766.0000, -0.004535, -0.4526, '2025-10-17 07:00:45'),
(469083, 51, 1.000093, 1.000293, 1.000193, 1.000193, 1.000193, 776891.0000, -0.002527, -0.2520, '2025-10-17 07:00:45'),
(469084, 52, 0.989842, 0.990042, 0.989942, 0.989942, 0.989942, 611623.0000, -0.004313, -0.4338, '2025-10-17 07:00:45'),
(469085, 53, 1.005133, 1.005333, 1.005233, 1.005233, 1.005233, 159695.0000, -0.003653, -0.3621, '2025-10-17 07:00:45'),
(469086, 54, 0.991676, 0.991876, 0.991776, 0.991776, 0.991776, 169017.0000, -0.003041, -0.3056, '2025-10-17 07:00:45'),
(469087, 55, 1.001128, 1.001328, 1.001228, 1.001228, 1.001228, 121364.0000, -0.001603, -0.1598, '2025-10-17 07:00:45'),
(469088, 56, 1.010000, 1.010200, 1.010100, 1.010100, 1.010100, 858102.0000, 0.003373, 0.3351, '2025-10-17 07:00:45'),
(469089, 57, 1.000133, 1.000333, 1.000233, 1.000233, 1.000233, 341617.0000, -0.003317, -0.3305, '2025-10-17 07:00:45'),
(469090, 58, 0.996651, 0.996851, 0.996751, 0.996751, 0.996751, 145457.0000, -0.000019, -0.0019, '2025-10-17 07:00:45'),
(469091, 1, 1.076281, 1.076431, 1.076356, 1.076356, 1.076356, 83088.0000, 0.001054, 0.0980, '2025-10-17 07:00:50'),
(469092, 2, 1.253541, 1.253741, 1.253641, 1.253641, 1.253641, 313271.0000, 0.005629, 0.4511, '2025-10-17 07:00:50'),
(469093, 3, 151.509277, 151.524277, 151.516777, 151.516777, 151.516777, 582627.0000, 0.436213, 0.2887, '2025-10-17 07:00:50'),
(469094, 4, 0.920748, 0.920928, 0.920838, 0.920838, 0.920838, 700407.0000, 0.001288, 0.1401, '2025-10-17 07:00:50'),
(469095, 5, 1.361164, 1.361364, 1.361264, 1.361264, 1.361264, 157774.0000, -0.004245, -0.3109, '2025-10-17 07:00:50'),
(469096, 6, 0.677003, 0.677183, 0.677093, 0.677093, 0.677093, 808399.0000, -0.000806, -0.1189, '2025-10-17 07:00:50'),
(469097, 7, 0.617298, 0.617548, 0.617423, 0.617423, 0.617423, 599797.0000, -0.001316, -0.2127, '2025-10-17 07:00:50'),
(469098, 8, 0.854933, 0.855113, 0.855023, 0.855023, 0.855023, 832029.0000, -0.003803, -0.4428, '2025-10-17 07:00:50'),
(469099, 9, 163.309443, 163.334443, 163.321943, 163.321943, 163.321943, 744913.0000, -0.289757, -0.1771, '2025-10-17 07:00:50'),
(469100, 10, 1.003512, 1.003712, 1.003612, 1.003612, 1.003612, 704577.0000, 0.000327, 0.0325, '2025-10-17 07:00:50'),
(469101, 11, 1.005489, 1.005689, 1.005589, 1.005589, 1.005589, 752128.0000, 0.004396, 0.4391, '2025-10-17 07:00:50'),
(469102, 12, 0.998787, 0.998987, 0.998887, 0.998887, 0.998887, 268969.0000, 0.001630, 0.1635, '2025-10-17 07:00:50'),
(469103, 13, 1.002600, 1.002800, 1.002700, 1.002700, 1.002700, 226942.0000, -0.004208, -0.4179, '2025-10-17 07:00:50'),
(469104, 14, 189.629809, 189.659809, 189.644809, 189.644809, 189.644809, 147360.0000, -0.868414, -0.4558, '2025-10-17 07:00:50'),
(469105, 15, 0.992248, 0.992448, 0.992348, 0.992348, 0.992348, 589803.0000, -0.000631, -0.0635, '2025-10-17 07:00:50'),
(469106, 16, 1.011206, 1.011406, 1.011306, 1.011306, 1.011306, 702520.0000, 0.004530, 0.4500, '2025-10-17 07:00:50'),
(469107, 17, 0.990481, 0.990681, 0.990581, 0.990581, 0.990581, 432184.0000, -0.002482, -0.2499, '2025-10-17 07:00:50'),
(469108, 18, 0.997785, 0.997985, 0.997885, 0.997885, 0.997885, 359988.0000, 0.002353, 0.2364, '2025-10-17 07:00:50'),
(469109, 19, 1.001993, 1.002193, 1.002093, 1.002093, 1.002093, 731065.0000, 0.004165, 0.4174, '2025-10-17 07:00:50'),
(469110, 20, 0.998332, 0.998532, 0.998432, 0.998432, 0.998432, 151712.0000, -0.003224, -0.3219, '2025-10-17 07:00:50'),
(469111, 21, 0.990155, 0.990355, 0.990255, 0.990255, 0.990255, 818065.0000, -0.004520, -0.4544, '2025-10-17 07:00:50'),
(469112, 22, 1.001706, 1.001906, 1.001806, 1.001806, 1.001806, 504844.0000, 0.004657, 0.4671, '2025-10-17 07:00:50'),
(469113, 23, 1.004345, 1.004545, 1.004445, 1.004445, 1.004445, 269894.0000, 0.004830, 0.4831, '2025-10-17 07:00:50'),
(469114, 24, 1.001949, 1.002149, 1.002049, 1.002049, 1.002049, 499501.0000, 0.002587, 0.2589, '2025-10-17 07:00:50'),
(469115, 25, 1.002772, 1.002972, 1.002872, 1.002872, 1.002872, 411018.0000, 0.004129, 0.4134, '2025-10-17 07:00:50'),
(469116, 26, 0.999342, 0.999542, 0.999442, 0.999442, 0.999442, 523333.0000, -0.002068, -0.2064, '2025-10-17 07:00:50'),
(469117, 27, 0.998393, 0.998593, 0.998493, 0.998493, 0.998493, 496851.0000, -0.001477, -0.1477, '2025-10-17 07:00:50'),
(469118, 28, 0.994125, 0.994325, 0.994225, 0.994225, 0.994225, 990483.0000, 0.001147, 0.1155, '2025-10-17 07:00:50'),
(469119, 29, 1.003877, 1.004077, 1.003977, 1.003977, 1.003977, 693747.0000, 0.001647, 0.1643, '2025-10-17 07:00:50'),
(469120, 30, 1.003401, 1.003601, 1.003501, 1.003501, 1.003501, 852904.0000, 0.001026, 0.1023, '2025-10-17 07:00:50'),
(469121, 31, 1.011232, 1.011432, 1.011332, 1.011332, 1.011332, 501427.0000, 0.002024, 0.2005, '2025-10-17 07:00:50'),
(469122, 32, 1.005065, 1.005265, 1.005165, 1.005165, 1.005165, 105532.0000, 0.000116, 0.0115, '2025-10-17 07:00:50'),
(469123, 33, 0.999049, 0.999249, 0.999149, 0.999149, 0.999149, 507682.0000, -0.003350, -0.3341, '2025-10-17 07:00:50'),
(469124, 34, 1.003230, 1.003430, 1.003330, 1.003330, 1.003330, 156944.0000, -0.002286, -0.2274, '2025-10-17 07:00:50'),
(469125, 35, 1.005534, 1.005734, 1.005634, 1.005634, 1.005634, 340264.0000, 0.003728, 0.3721, '2025-10-17 07:00:50'),
(469126, 36, 1.011556, 1.011756, 1.011656, 1.011656, 1.011656, 583589.0000, -0.001015, -0.1002, '2025-10-17 07:00:50'),
(469127, 37, 1.000527, 1.000727, 1.000627, 1.000627, 1.000627, 436587.0000, -0.001202, -0.1200, '2025-10-17 07:00:50'),
(469128, 38, 0.993245, 0.993445, 0.993345, 0.993345, 0.993345, 52956.0000, -0.002639, -0.2650, '2025-10-17 07:00:50'),
(469129, 39, 1.005648, 1.005848, 1.005748, 1.005748, 1.005748, 608357.0000, 0.004562, 0.4556, '2025-10-17 07:00:50'),
(469130, 40, 1.001323, 1.001523, 1.001423, 1.001423, 1.001423, 433048.0000, 0.001245, 0.1244, '2025-10-17 07:00:50'),
(469131, 41, 1.006197, 1.006397, 1.006297, 1.006297, 1.006297, 734132.0000, -0.003332, -0.3300, '2025-10-17 07:00:50'),
(469132, 42, 0.998614, 0.998814, 0.998714, 0.998714, 0.998714, 718725.0000, -0.003327, -0.3320, '2025-10-17 07:00:50'),
(469133, 43, 0.993071, 0.993271, 0.993171, 0.993171, 0.993171, 37856.0000, -0.003172, -0.3183, '2025-10-17 07:00:50'),
(469134, 44, 1.000205, 1.000405, 1.000305, 1.000305, 1.000305, 739535.0000, -0.001667, -0.1664, '2025-10-17 07:00:50'),
(469135, 45, 0.996712, 0.996912, 0.996812, 0.996812, 0.996812, 323480.0000, -0.004075, -0.4072, '2025-10-17 07:00:50'),
(469136, 46, 1.003154, 1.003354, 1.003254, 1.003254, 1.003254, 742046.0000, 0.004615, 0.4621, '2025-10-17 07:00:50'),
(469137, 47, 1.014560, 1.014760, 1.014660, 1.014660, 1.014660, 937802.0000, 0.003002, 0.2968, '2025-10-17 07:00:50'),
(469138, 48, 0.997254, 0.997454, 0.997354, 0.997354, 0.997354, 540001.0000, 0.002586, 0.2600, '2025-10-17 07:00:50'),
(469139, 49, 0.992176, 0.992376, 0.992276, 0.992276, 0.992276, 967315.0000, -0.004180, -0.4194, '2025-10-17 07:00:50'),
(469140, 50, 0.994324, 0.994524, 0.994424, 0.994424, 0.994424, 332350.0000, -0.002974, -0.2982, '2025-10-17 07:00:50'),
(469141, 51, 0.998421, 0.998621, 0.998521, 0.998521, 0.998521, 602340.0000, -0.001672, -0.1672, '2025-10-17 07:00:50'),
(469142, 52, 0.989256, 0.989456, 0.989356, 0.989356, 0.989356, 592485.0000, -0.000586, -0.0592, '2025-10-17 07:00:50'),
(469143, 53, 1.006202, 1.006402, 1.006302, 1.006302, 1.006302, 674417.0000, 0.001069, 0.1063, '2025-10-17 07:00:50'),
(469144, 54, 0.995007, 0.995207, 0.995107, 0.995107, 0.995107, 560649.0000, 0.003331, 0.3359, '2025-10-17 07:00:50'),
(469145, 55, 0.997085, 0.997285, 0.997185, 0.997185, 0.997185, 775797.0000, -0.004043, -0.4038, '2025-10-17 07:00:50'),
(469146, 56, 1.011790, 1.011990, 1.011890, 1.011890, 1.011890, 466383.0000, 0.001790, 0.1772, '2025-10-17 07:00:50'),
(469147, 57, 0.995133, 0.995333, 0.995233, 0.995233, 0.995233, 302308.0000, -0.005000, -0.4999, '2025-10-17 07:00:50'),
(469148, 58, 0.993794, 0.993994, 0.993894, 0.993894, 0.993894, 202048.0000, -0.002857, -0.2866, '2025-10-17 07:00:50'),
(469149, 1, 1.081274, 1.081424, 1.081349, 1.081349, 1.081349, 102486.0000, 0.004993, 0.4638, '2025-10-17 07:00:55'),
(469150, 2, 1.252919, 1.253119, 1.253019, 1.253019, 1.253019, 804209.0000, -0.000622, -0.0496, '2025-10-17 07:00:55'),
(469151, 3, 151.009806, 151.024806, 151.017306, 151.017306, 151.017306, 35662.0000, -0.499471, -0.3296, '2025-10-17 07:00:55'),
(469152, 4, 0.918233, 0.918413, 0.918323, 0.918323, 0.918323, 302020.0000, -0.002515, -0.2731, '2025-10-17 07:00:55'),
(469153, 5, 1.358056, 1.358256, 1.358156, 1.358156, 1.358156, 239844.0000, -0.003108, -0.2283, '2025-10-17 07:00:55'),
(469154, 6, 0.676351, 0.676531, 0.676441, 0.676441, 0.676441, 895073.0000, -0.000652, -0.0963, '2025-10-17 07:00:55'),
(469155, 7, 0.615397, 0.615647, 0.615522, 0.615522, 0.615522, 527471.0000, -0.001901, -0.3078, '2025-10-17 07:00:55'),
(469156, 8, 0.852256, 0.852436, 0.852346, 0.852346, 0.852346, 329958.0000, -0.002677, -0.3130, '2025-10-17 07:00:55'),
(469157, 9, 163.302952, 163.327952, 163.315452, 163.315452, 163.315452, 787596.0000, -0.006491, -0.0040, '2025-10-17 07:00:55'),
(469158, 10, 1.003695, 1.003895, 1.003795, 1.003795, 1.003795, 293906.0000, 0.000183, 0.0182, '2025-10-17 07:00:55'),
(469159, 11, 1.003620, 1.003820, 1.003720, 1.003720, 1.003720, 85988.0000, -0.001869, -0.1859, '2025-10-17 07:00:55'),
(469160, 12, 1.003168, 1.003368, 1.003268, 1.003268, 1.003268, 539590.0000, 0.004381, 0.4386, '2025-10-17 07:00:55'),
(469161, 13, 1.006331, 1.006531, 1.006431, 1.006431, 1.006431, 963115.0000, 0.003731, 0.3721, '2025-10-17 07:00:55'),
(469162, 14, 189.518486, 189.548486, 189.533486, 189.533486, 189.533486, 49484.0000, -0.111323, -0.0587, '2025-10-17 07:00:55'),
(469163, 15, 0.992127, 0.992327, 0.992227, 0.992227, 0.992227, 118395.0000, -0.000121, -0.0122, '2025-10-17 07:00:55'),
(469164, 16, 1.006600, 1.006800, 1.006700, 1.006700, 1.006700, 620742.0000, -0.004606, -0.4554, '2025-10-17 07:00:55'),
(469165, 17, 0.995191, 0.995391, 0.995291, 0.995291, 0.995291, 173586.0000, 0.004710, 0.4755, '2025-10-17 07:00:55'),
(469166, 18, 0.993080, 0.993280, 0.993180, 0.993180, 0.993180, 858056.0000, -0.004705, -0.4715, '2025-10-17 07:00:55'),
(469167, 19, 1.001118, 1.001318, 1.001218, 1.001218, 1.001218, 654106.0000, -0.000875, -0.0874, '2025-10-17 07:00:55'),
(469168, 20, 0.997838, 0.998038, 0.997938, 0.997938, 0.997938, 723583.0000, -0.000494, -0.0495, '2025-10-17 07:00:55'),
(469169, 21, 0.991908, 0.992108, 0.992008, 0.992008, 0.992008, 18723.0000, 0.001753, 0.1771, '2025-10-17 07:00:55'),
(469170, 22, 1.002314, 1.002514, 1.002414, 1.002414, 1.002414, 94783.0000, 0.000608, 0.0607, '2025-10-17 07:00:55'),
(469171, 23, 0.999804, 1.000004, 0.999904, 0.999904, 0.999904, 232086.0000, -0.004541, -0.4521, '2025-10-17 07:00:55'),
(469172, 24, 1.005929, 1.006129, 1.006029, 1.006029, 1.006029, 66930.0000, 0.003980, 0.3972, '2025-10-17 07:00:55'),
(469173, 25, 0.998337, 0.998537, 0.998437, 0.998437, 0.998437, 282950.0000, -0.004435, -0.4422, '2025-10-17 07:00:55'),
(469174, 26, 1.003005, 1.003205, 1.003105, 1.003105, 1.003105, 824211.0000, 0.003663, 0.3665, '2025-10-17 07:00:55'),
(469175, 27, 1.000987, 1.001187, 1.001087, 1.001087, 1.001087, 730065.0000, 0.002594, 0.2598, '2025-10-17 07:00:55'),
(469176, 28, 0.993691, 0.993891, 0.993791, 0.993791, 0.993791, 427694.0000, -0.000434, -0.0437, '2025-10-17 07:00:55'),
(469177, 29, 1.008411, 1.008611, 1.008511, 1.008511, 1.008511, 974410.0000, 0.004534, 0.4516, '2025-10-17 07:00:55'),
(469178, 30, 0.998760, 0.998960, 0.998860, 0.998860, 0.998860, 779078.0000, -0.004641, -0.4625, '2025-10-17 07:00:55'),
(469179, 31, 1.007115, 1.007315, 1.007215, 1.007215, 1.007215, 963003.0000, -0.004117, -0.4070, '2025-10-17 07:00:55'),
(469180, 32, 1.001692, 1.001892, 1.001792, 1.001792, 1.001792, 479678.0000, -0.003373, -0.3355, '2025-10-17 07:00:55'),
(469181, 33, 0.994152, 0.994352, 0.994252, 0.994252, 0.994252, 26547.0000, -0.004897, -0.4901, '2025-10-17 07:00:55'),
(469182, 34, 1.006413, 1.006613, 1.006513, 1.006513, 1.006513, 358624.0000, 0.003183, 0.3172, '2025-10-17 07:00:55'),
(469183, 35, 1.009300, 1.009500, 1.009400, 1.009400, 1.009400, 724798.0000, 0.003766, 0.3745, '2025-10-17 07:00:55'),
(469184, 36, 1.007963, 1.008163, 1.008063, 1.008063, 1.008063, 375615.0000, -0.003593, -0.3551, '2025-10-17 07:00:55'),
(469185, 37, 1.000973, 1.001173, 1.001073, 1.001073, 1.001073, 83356.0000, 0.000446, 0.0446, '2025-10-17 07:00:55'),
(469186, 38, 0.990384, 0.990584, 0.990484, 0.990484, 0.990484, 274876.0000, -0.002861, -0.2880, '2025-10-17 07:00:55'),
(469187, 39, 1.009261, 1.009461, 1.009361, 1.009361, 1.009361, 389370.0000, 0.003613, 0.3592, '2025-10-17 07:00:55'),
(469188, 40, 1.002770, 1.002970, 1.002870, 1.002870, 1.002870, 595932.0000, 0.001447, 0.1445, '2025-10-17 07:00:55'),
(469189, 41, 1.009023, 1.009223, 1.009123, 1.009123, 1.009123, 11997.0000, 0.002826, 0.2809, '2025-10-17 07:00:55'),
(469190, 42, 0.998999, 0.999199, 0.999099, 0.999099, 0.999099, 187329.0000, 0.000385, 0.0385, '2025-10-17 07:00:55'),
(469191, 43, 0.992394, 0.992594, 0.992494, 0.992494, 0.992494, 280027.0000, -0.000677, -0.0682, '2025-10-17 07:00:55'),
(469192, 44, 0.998151, 0.998351, 0.998251, 0.998251, 0.998251, 211323.0000, -0.002054, -0.2054, '2025-10-17 07:00:55'),
(469193, 45, 0.993455, 0.993655, 0.993555, 0.993555, 0.993555, 896885.0000, -0.003257, -0.3267, '2025-10-17 07:00:55'),
(469194, 46, 0.998195, 0.998395, 0.998295, 0.998295, 0.998295, 91227.0000, -0.004959, -0.4942, '2025-10-17 07:00:55'),
(469195, 47, 1.012086, 1.012286, 1.012186, 1.012186, 1.012186, 626713.0000, -0.002474, -0.2438, '2025-10-17 07:00:55'),
(469196, 48, 0.993531, 0.993731, 0.993631, 0.993631, 0.993631, 130235.0000, -0.003723, -0.3733, '2025-10-17 07:00:55'),
(469197, 49, 0.987562, 0.987762, 0.987662, 0.987662, 0.987662, 170147.0000, -0.004614, -0.4650, '2025-10-17 07:00:55'),
(469198, 50, 0.990380, 0.990580, 0.990480, 0.990480, 0.990480, 501965.0000, -0.003944, -0.3966, '2025-10-17 07:00:55'),
(469199, 51, 1.001332, 1.001532, 1.001432, 1.001432, 1.001432, 154823.0000, 0.002911, 0.2916, '2025-10-17 07:00:55'),
(469200, 52, 0.991212, 0.991412, 0.991312, 0.991312, 0.991312, 824382.0000, 0.001956, 0.1977, '2025-10-17 07:00:55'),
(469201, 53, 1.003541, 1.003741, 1.003641, 1.003641, 1.003641, 854670.0000, -0.002661, -0.2644, '2025-10-17 07:00:55'),
(469202, 54, 0.991217, 0.991417, 0.991317, 0.991317, 0.991317, 833976.0000, -0.003790, -0.3808, '2025-10-17 07:00:55'),
(469203, 55, 1.000484, 1.000684, 1.000584, 1.000584, 1.000584, 991566.0000, 0.003399, 0.3408, '2025-10-17 07:00:55'),
(469204, 56, 1.012288, 1.012488, 1.012388, 1.012388, 1.012388, 167490.0000, 0.000498, 0.0492, '2025-10-17 07:00:55'),
(469205, 57, 0.998944, 0.999144, 0.999044, 0.999044, 0.999044, 791206.0000, 0.003811, 0.3830, '2025-10-17 07:00:55'),
(469206, 58, 0.991832, 0.992032, 0.991932, 0.991932, 0.991932, 976075.0000, -0.001962, -0.1974, '2025-10-17 07:00:55'),
(469207, 1, 1.077152, 1.077302, 1.077227, 1.077227, 1.077227, 38370.0000, -0.004122, -0.3812, '2025-10-17 07:01:00'),
(469208, 2, 1.255854, 1.256054, 1.255954, 1.255954, 1.255954, 390603.0000, 0.002935, 0.2342, '2025-10-17 07:01:00'),
(469209, 3, 151.575257, 151.590257, 151.582757, 151.582757, 151.582757, 666385.0000, 0.565451, 0.3744, '2025-10-17 07:01:00'),
(469210, 4, 0.920177, 0.920357, 0.920267, 0.920267, 0.920267, 290871.0000, 0.001944, 0.2117, '2025-10-17 07:01:00'),
(469211, 5, 1.359793, 1.359993, 1.359893, 1.359893, 1.359893, 696502.0000, 0.001737, 0.1279, '2025-10-17 07:01:00'),
(469212, 6, 0.676843, 0.677023, 0.676933, 0.676933, 0.676933, 553950.0000, 0.000492, 0.0728, '2025-10-17 07:01:00'),
(469213, 7, 0.615361, 0.615611, 0.615486, 0.615486, 0.615486, 285746.0000, -0.000036, -0.0058, '2025-10-17 07:01:00'),
(469214, 8, 0.849468, 0.849648, 0.849558, 0.849558, 0.849558, 747399.0000, -0.002788, -0.3270, '2025-10-17 07:01:00'),
(469215, 9, 163.010691, 163.035691, 163.023191, 163.023191, 163.023191, 839257.0000, -0.292261, -0.1790, '2025-10-17 07:01:00'),
(469216, 10, 1.004292, 1.004492, 1.004392, 1.004392, 1.004392, 980113.0000, 0.000597, 0.0595, '2025-10-17 07:01:00'),
(469217, 11, 1.004098, 1.004298, 1.004198, 1.004198, 1.004198, 954522.0000, 0.000478, 0.0477, '2025-10-17 07:01:00'),
(469218, 12, 1.003236, 1.003436, 1.003336, 1.003336, 1.003336, 608542.0000, 0.000068, 0.0067, '2025-10-17 07:01:00'),
(469219, 13, 1.005490, 1.005690, 1.005590, 1.005590, 1.005590, 380918.0000, -0.000841, -0.0836, '2025-10-17 07:01:00'),
(469220, 14, 189.352642, 189.382642, 189.367642, 189.367642, 189.367642, 456888.0000, -0.165844, -0.0875, '2025-10-17 07:01:00'),
(469221, 15, 0.995314, 0.995514, 0.995414, 0.995414, 0.995414, 586290.0000, 0.003187, 0.3212, '2025-10-17 07:01:00'),
(469222, 16, 1.005660, 1.005860, 1.005760, 1.005760, 1.005760, 312776.0000, -0.000940, -0.0934, '2025-10-17 07:01:00'),
(469223, 17, 0.997025, 0.997225, 0.997125, 0.997125, 0.997125, 596029.0000, 0.001834, 0.1843, '2025-10-17 07:01:00'),
(469224, 18, 0.995316, 0.995516, 0.995416, 0.995416, 0.995416, 816583.0000, 0.002236, 0.2252, '2025-10-17 07:01:00'),
(469225, 19, 0.999867, 1.000067, 0.999967, 0.999967, 0.999967, 520857.0000, -0.001251, -0.1250, '2025-10-17 07:01:00');
INSERT INTO `market_prices` (`id`, `symbol_id`, `bid`, `ask`, `last`, `high`, `low`, `volume`, `change_amount`, `change_percent`, `timestamp`) VALUES
(469226, 20, 0.999076, 0.999276, 0.999176, 0.999176, 0.999176, 381499.0000, 0.001238, 0.1240, '2025-10-17 07:01:00'),
(469227, 21, 0.994017, 0.994217, 0.994117, 0.994117, 0.994117, 833403.0000, 0.002109, 0.2126, '2025-10-17 07:01:00'),
(469228, 22, 1.002391, 1.002591, 1.002491, 1.002491, 1.002491, 796785.0000, 0.000077, 0.0077, '2025-10-17 07:01:00'),
(469229, 23, 0.997712, 0.997912, 0.997812, 0.997812, 0.997812, 921874.0000, -0.002092, -0.2092, '2025-10-17 07:01:00'),
(469230, 24, 1.009889, 1.010089, 1.009989, 1.009989, 1.009989, 720562.0000, 0.003960, 0.3936, '2025-10-17 07:01:00'),
(469231, 25, 1.001423, 1.001623, 1.001523, 1.001523, 1.001523, 834076.0000, 0.003086, 0.3091, '2025-10-17 07:01:00'),
(469232, 26, 1.003373, 1.003573, 1.003473, 1.003473, 1.003473, 387235.0000, 0.000368, 0.0367, '2025-10-17 07:01:00'),
(469233, 27, 0.998910, 0.999110, 0.999010, 0.999010, 0.999010, 914158.0000, -0.002077, -0.2075, '2025-10-17 07:01:00'),
(469234, 28, 0.997100, 0.997300, 0.997200, 0.997200, 0.997200, 397115.0000, 0.003409, 0.3430, '2025-10-17 07:01:00'),
(469235, 29, 1.007462, 1.007662, 1.007562, 1.007562, 1.007562, 761997.0000, -0.000949, -0.0941, '2025-10-17 07:01:00'),
(469236, 30, 0.999101, 0.999301, 0.999201, 0.999201, 0.999201, 2463.0000, 0.000341, 0.0342, '2025-10-17 07:01:00'),
(469237, 31, 1.002759, 1.002959, 1.002859, 1.002859, 1.002859, 198231.0000, -0.004356, -0.4325, '2025-10-17 07:01:00'),
(469238, 32, 1.004318, 1.004518, 1.004418, 1.004418, 1.004418, 534029.0000, 0.002626, 0.2621, '2025-10-17 07:01:00'),
(469239, 33, 0.995885, 0.996085, 0.995985, 0.995985, 0.995985, 908964.0000, 0.001733, 0.1743, '2025-10-17 07:01:00'),
(469240, 34, 1.009287, 1.009487, 1.009387, 1.009387, 1.009387, 612403.0000, 0.002874, 0.2856, '2025-10-17 07:01:00'),
(469241, 35, 1.009307, 1.009507, 1.009407, 1.009407, 1.009407, 455887.0000, 0.000007, 0.0007, '2025-10-17 07:01:00'),
(469242, 36, 1.006748, 1.006948, 1.006848, 1.006848, 1.006848, 882269.0000, -0.001215, -0.1205, '2025-10-17 07:01:00'),
(469243, 37, 0.999309, 0.999509, 0.999409, 0.999409, 0.999409, 949890.0000, -0.001664, -0.1663, '2025-10-17 07:01:00'),
(469244, 38, 0.994441, 0.994641, 0.994541, 0.994541, 0.994541, 940238.0000, 0.004057, 0.4096, '2025-10-17 07:01:00'),
(469245, 39, 1.009864, 1.010064, 1.009964, 1.009964, 1.009964, 747681.0000, 0.000603, 0.0597, '2025-10-17 07:01:00'),
(469246, 40, 1.000497, 1.000697, 1.000597, 1.000597, 1.000597, 135290.0000, -0.002273, -0.2267, '2025-10-17 07:01:00'),
(469247, 41, 1.007121, 1.007321, 1.007221, 1.007221, 1.007221, 506531.0000, -0.001902, -0.1884, '2025-10-17 07:01:00'),
(469248, 42, 0.994331, 0.994531, 0.994431, 0.994431, 0.994431, 882655.0000, -0.004668, -0.4672, '2025-10-17 07:01:00'),
(469249, 43, 0.994111, 0.994311, 0.994211, 0.994211, 0.994211, 430067.0000, 0.001717, 0.1730, '2025-10-17 07:01:00'),
(469250, 44, 0.994574, 0.994774, 0.994674, 0.994674, 0.994674, 10979.0000, -0.003577, -0.3583, '2025-10-17 07:01:00'),
(469251, 45, 0.991228, 0.991428, 0.991328, 0.991328, 0.991328, 167284.0000, -0.002227, -0.2242, '2025-10-17 07:01:00'),
(469252, 46, 0.996000, 0.996200, 0.996100, 0.996100, 0.996100, 136647.0000, -0.002195, -0.2199, '2025-10-17 07:01:00'),
(469253, 47, 1.013750, 1.013950, 1.013850, 1.013850, 1.013850, 496719.0000, 0.001664, 0.1644, '2025-10-17 07:01:00'),
(469254, 48, 0.995147, 0.995347, 0.995247, 0.995247, 0.995247, 702026.0000, 0.001616, 0.1627, '2025-10-17 07:01:00'),
(469255, 49, 0.985794, 0.985994, 0.985894, 0.985894, 0.985894, 747.0000, -0.001768, -0.1790, '2025-10-17 07:01:00'),
(469256, 50, 0.989756, 0.989956, 0.989856, 0.989856, 0.989856, 449708.0000, -0.000624, -0.0630, '2025-10-17 07:01:00'),
(469257, 51, 1.003652, 1.003852, 1.003752, 1.003752, 1.003752, 88224.0000, 0.002320, 0.2317, '2025-10-17 07:01:00'),
(469258, 52, 0.995150, 0.995350, 0.995250, 0.995250, 0.995250, 479893.0000, 0.003938, 0.3972, '2025-10-17 07:01:00'),
(469259, 53, 1.003377, 1.003577, 1.003477, 1.003477, 1.003477, 7277.0000, -0.000164, -0.0163, '2025-10-17 07:01:01'),
(469260, 54, 0.989691, 0.989891, 0.989791, 0.989791, 0.989791, 691114.0000, -0.001526, -0.1539, '2025-10-17 07:01:01'),
(469261, 55, 0.997137, 0.997337, 0.997237, 0.997237, 0.997237, 297290.0000, -0.003347, -0.3345, '2025-10-17 07:01:01'),
(469262, 56, 1.013019, 1.013219, 1.013119, 1.013119, 1.013119, 313568.0000, 0.000731, 0.0722, '2025-10-17 07:01:01'),
(469263, 57, 1.001729, 1.001929, 1.001829, 1.001829, 1.001829, 120033.0000, 0.002785, 0.2788, '2025-10-17 07:01:01'),
(469264, 58, 0.996662, 0.996862, 0.996762, 0.996762, 0.996762, 552475.0000, 0.004830, 0.4870, '2025-10-17 07:01:01'),
(469265, 1, 1.081659, 1.081809, 1.081734, 1.081734, 1.081734, 464922.0000, 0.004507, 0.4184, '2025-10-17 07:01:05'),
(469266, 2, 1.250397, 1.250597, 1.250497, 1.250497, 1.250497, 810760.0000, -0.005457, -0.4345, '2025-10-17 07:01:05'),
(469267, 3, 151.504164, 151.519164, 151.511664, 151.511664, 151.511664, 115916.0000, -0.071093, -0.0469, '2025-10-17 07:01:05'),
(469268, 4, 0.917050, 0.917230, 0.917140, 0.917140, 0.917140, 672489.0000, -0.003127, -0.3398, '2025-10-17 07:01:05'),
(469269, 5, 1.357903, 1.358103, 1.358003, 1.358003, 1.358003, 542140.0000, -0.001890, -0.1390, '2025-10-17 07:01:05'),
(469270, 6, 0.676854, 0.677034, 0.676944, 0.676944, 0.676944, 258976.0000, 0.000011, 0.0016, '2025-10-17 07:01:05'),
(469271, 7, 0.614953, 0.615203, 0.615078, 0.615078, 0.615078, 843234.0000, -0.000408, -0.0663, '2025-10-17 07:01:05'),
(469272, 8, 0.847817, 0.847997, 0.847907, 0.847907, 0.847907, 233799.0000, -0.001651, -0.1943, '2025-10-17 07:01:05'),
(469273, 9, 162.921308, 162.946308, 162.933808, 162.933808, 162.933808, 451548.0000, -0.089383, -0.0548, '2025-10-17 07:01:05'),
(469274, 10, 1.003607, 1.003807, 1.003707, 1.003707, 1.003707, 279063.0000, -0.000685, -0.0682, '2025-10-17 07:01:05'),
(469275, 11, 1.003466, 1.003666, 1.003566, 1.003566, 1.003566, 202710.0000, -0.000632, -0.0629, '2025-10-17 07:01:05'),
(469276, 12, 1.002452, 1.002652, 1.002552, 1.002552, 1.002552, 682703.0000, -0.000784, -0.0782, '2025-10-17 07:01:05'),
(469277, 13, 1.010247, 1.010447, 1.010347, 1.010347, 1.010347, 395257.0000, 0.004757, 0.4731, '2025-10-17 07:01:05'),
(469278, 14, 188.415641, 188.445641, 188.430641, 188.430641, 188.430641, 730315.0000, -0.937001, -0.4948, '2025-10-17 07:01:05'),
(469279, 15, 0.998762, 0.998962, 0.998862, 0.998862, 0.998862, 610239.0000, 0.003448, 0.3464, '2025-10-17 07:01:05'),
(469280, 16, 1.003194, 1.003394, 1.003294, 1.003294, 1.003294, 278641.0000, -0.002466, -0.2452, '2025-10-17 07:01:05'),
(469281, 17, 0.996636, 0.996836, 0.996736, 0.996736, 0.996736, 844876.0000, -0.000389, -0.0390, '2025-10-17 07:01:05'),
(469282, 18, 0.995852, 0.996052, 0.995952, 0.995952, 0.995952, 78424.0000, 0.000536, 0.0539, '2025-10-17 07:01:05'),
(469283, 19, 1.002029, 1.002229, 1.002129, 1.002129, 1.002129, 537645.0000, 0.002162, 0.2162, '2025-10-17 07:01:05'),
(469284, 20, 0.995698, 0.995898, 0.995798, 0.995798, 0.995798, 293031.0000, -0.003378, -0.3380, '2025-10-17 07:01:05'),
(469285, 21, 0.997676, 0.997876, 0.997776, 0.997776, 0.997776, 703514.0000, 0.003659, 0.3680, '2025-10-17 07:01:05'),
(469286, 22, 0.997958, 0.998158, 0.998058, 0.998058, 0.998058, 28709.0000, -0.004433, -0.4422, '2025-10-17 07:01:05'),
(469287, 23, 1.001479, 1.001679, 1.001579, 1.001579, 1.001579, 684239.0000, 0.003767, 0.3776, '2025-10-17 07:01:05'),
(469288, 24, 1.005949, 1.006149, 1.006049, 1.006049, 1.006049, 32421.0000, -0.003940, -0.3901, '2025-10-17 07:01:05'),
(469289, 25, 1.001991, 1.002191, 1.002091, 1.002091, 1.002091, 388283.0000, 0.000568, 0.0567, '2025-10-17 07:01:05'),
(469290, 26, 0.999376, 0.999576, 0.999476, 0.999476, 0.999476, 711848.0000, -0.003997, -0.3984, '2025-10-17 07:01:05'),
(469291, 27, 0.999105, 0.999305, 0.999205, 0.999205, 0.999205, 336006.0000, 0.000195, 0.0195, '2025-10-17 07:01:05'),
(469292, 28, 0.995862, 0.996062, 0.995962, 0.995962, 0.995962, 954066.0000, -0.001238, -0.1241, '2025-10-17 07:01:05'),
(469293, 29, 1.011946, 1.012146, 1.012046, 1.012046, 1.012046, 994649.0000, 0.004484, 0.4451, '2025-10-17 07:01:05'),
(469294, 30, 0.994775, 0.994975, 0.994875, 0.994875, 0.994875, 398006.0000, -0.004326, -0.4330, '2025-10-17 07:01:05'),
(469295, 31, 1.001173, 1.001373, 1.001273, 1.001273, 1.001273, 803947.0000, -0.001586, -0.1582, '2025-10-17 07:01:05'),
(469296, 32, 1.004106, 1.004306, 1.004206, 1.004206, 1.004206, 311052.0000, -0.000212, -0.0211, '2025-10-17 07:01:05'),
(469297, 33, 0.992002, 0.992202, 0.992102, 0.992102, 0.992102, 228106.0000, -0.003883, -0.3899, '2025-10-17 07:01:05'),
(469298, 34, 1.004890, 1.005090, 1.004990, 1.004990, 1.004990, 166878.0000, -0.004397, -0.4356, '2025-10-17 07:01:05'),
(469299, 35, 1.010286, 1.010486, 1.010386, 1.010386, 1.010386, 542863.0000, 0.000979, 0.0970, '2025-10-17 07:01:05'),
(469300, 36, 1.004000, 1.004200, 1.004100, 1.004100, 1.004100, 954890.0000, -0.002748, -0.2729, '2025-10-17 07:01:05'),
(469301, 37, 1.003201, 1.003401, 1.003301, 1.003301, 1.003301, 381318.0000, 0.003892, 0.3895, '2025-10-17 07:01:05'),
(469302, 38, 0.998310, 0.998510, 0.998410, 0.998410, 0.998410, 630880.0000, 0.003869, 0.3890, '2025-10-17 07:01:05'),
(469303, 39, 1.012352, 1.012552, 1.012452, 1.012452, 1.012452, 649481.0000, 0.002488, 0.2464, '2025-10-17 07:01:05'),
(469304, 40, 1.002502, 1.002702, 1.002602, 1.002602, 1.002602, 419850.0000, 0.002005, 0.2004, '2025-10-17 07:01:06'),
(469305, 41, 1.003285, 1.003485, 1.003385, 1.003385, 1.003385, 134474.0000, -0.003836, -0.3808, '2025-10-17 07:01:06'),
(469306, 42, 0.994058, 0.994258, 0.994158, 0.994158, 0.994158, 7127.0000, -0.000273, -0.0275, '2025-10-17 07:01:06'),
(469307, 43, 0.994075, 0.994275, 0.994175, 0.994175, 0.994175, 614089.0000, -0.000036, -0.0036, '2025-10-17 07:01:06'),
(469308, 44, 0.998479, 0.998679, 0.998579, 0.998579, 0.998579, 801068.0000, 0.003905, 0.3925, '2025-10-17 07:01:06'),
(469309, 45, 0.987895, 0.988095, 0.987995, 0.987995, 0.987995, 241533.0000, -0.003333, -0.3362, '2025-10-17 07:01:06'),
(469310, 46, 0.999913, 1.000113, 1.000013, 1.000013, 1.000013, 686507.0000, 0.003913, 0.3928, '2025-10-17 07:01:06'),
(469311, 47, 1.013947, 1.014147, 1.014047, 1.014047, 1.014047, 392414.0000, 0.000197, 0.0195, '2025-10-17 07:01:06'),
(469312, 48, 0.994102, 0.994302, 0.994202, 0.994202, 0.994202, 191721.0000, -0.001045, -0.1050, '2025-10-17 07:01:06'),
(469313, 49, 0.985850, 0.986050, 0.985950, 0.985950, 0.985950, 889212.0000, 0.000056, 0.0057, '2025-10-17 07:01:06'),
(469314, 50, 0.985553, 0.985753, 0.985653, 0.985653, 0.985653, 648265.0000, -0.004203, -0.4246, '2025-10-17 07:01:06'),
(469315, 51, 1.001770, 1.001970, 1.001870, 1.001870, 1.001870, 622501.0000, -0.001882, -0.1875, '2025-10-17 07:01:06'),
(469316, 52, 0.990182, 0.990382, 0.990282, 0.990282, 0.990282, 652705.0000, -0.004968, -0.4992, '2025-10-17 07:01:06'),
(469317, 53, 1.000256, 1.000456, 1.000356, 1.000356, 1.000356, 352103.0000, -0.003121, -0.3111, '2025-10-17 07:01:06'),
(469318, 54, 0.986766, 0.986966, 0.986866, 0.986866, 0.986866, 839090.0000, -0.002925, -0.2955, '2025-10-17 07:01:06'),
(469319, 55, 1.001340, 1.001540, 1.001440, 1.001440, 1.001440, 278969.0000, 0.004203, 0.4215, '2025-10-17 07:01:06'),
(469320, 56, 1.012637, 1.012837, 1.012737, 1.012737, 1.012737, 657459.0000, -0.000382, -0.0377, '2025-10-17 07:01:06'),
(469321, 57, 1.000380, 1.000580, 1.000480, 1.000480, 1.000480, 595739.0000, -0.001349, -0.1346, '2025-10-17 07:01:06'),
(469322, 58, 0.992091, 0.992291, 0.992191, 0.992191, 0.992191, 175039.0000, -0.004571, -0.4586, '2025-10-17 07:01:06'),
(469323, 1, 1.080506, 1.080656, 1.080581, 1.080581, 1.080581, 448895.0000, -0.001153, -0.1066, '2025-10-17 07:01:10'),
(469324, 2, 1.245331, 1.245531, 1.245431, 1.245431, 1.245431, 880122.0000, -0.005066, -0.4051, '2025-10-17 07:01:10'),
(469325, 3, 151.132073, 151.147073, 151.139573, 151.139573, 151.139573, 131549.0000, -0.372091, -0.2456, '2025-10-17 07:01:10'),
(469326, 4, 0.919803, 0.919983, 0.919893, 0.919893, 0.919893, 311170.0000, 0.002753, 0.3002, '2025-10-17 07:01:10'),
(469327, 5, 1.354137, 1.354337, 1.354237, 1.354237, 1.354237, 287147.0000, -0.003766, -0.2773, '2025-10-17 07:01:10'),
(469328, 6, 0.675037, 0.675217, 0.675127, 0.675127, 0.675127, 71496.0000, -0.001817, -0.2684, '2025-10-17 07:01:10'),
(469329, 7, 0.617232, 0.617482, 0.617357, 0.617357, 0.617357, 959478.0000, 0.002279, 0.3705, '2025-10-17 07:01:10'),
(469330, 8, 0.847325, 0.847505, 0.847415, 0.847415, 0.847415, 110924.0000, -0.000492, -0.0580, '2025-10-17 07:01:10'),
(469331, 9, 163.030778, 163.055778, 163.043278, 163.043278, 163.043278, 432172.0000, 0.109470, 0.0672, '2025-10-17 07:01:10'),
(469332, 10, 1.003045, 1.003245, 1.003145, 1.003145, 1.003145, 892428.0000, -0.000562, -0.0560, '2025-10-17 07:01:10'),
(469333, 11, 1.001089, 1.001289, 1.001189, 1.001189, 1.001189, 324293.0000, -0.002377, -0.2369, '2025-10-17 07:01:10'),
(469334, 12, 0.997998, 0.998198, 0.998098, 0.998098, 0.998098, 833008.0000, -0.004454, -0.4443, '2025-10-17 07:01:10'),
(469335, 13, 1.007960, 1.008160, 1.008060, 1.008060, 1.008060, 110302.0000, -0.002287, -0.2264, '2025-10-17 07:01:10'),
(469336, 14, 188.546279, 188.576279, 188.561279, 188.561279, 188.561279, 64819.0000, 0.130638, 0.0693, '2025-10-17 07:01:10'),
(469337, 15, 0.997829, 0.998029, 0.997929, 0.997929, 0.997929, 780517.0000, -0.000933, -0.0934, '2025-10-17 07:01:10'),
(469338, 16, 1.007925, 1.008125, 1.008025, 1.008025, 1.008025, 450903.0000, 0.004731, 0.4716, '2025-10-17 07:01:10'),
(469339, 17, 0.996939, 0.997139, 0.997039, 0.997039, 0.997039, 914997.0000, 0.000303, 0.0304, '2025-10-17 07:01:10'),
(469340, 18, 0.993513, 0.993713, 0.993613, 0.993613, 0.993613, 331707.0000, -0.002339, -0.2349, '2025-10-17 07:01:10'),
(469341, 19, 1.006974, 1.007174, 1.007074, 1.007074, 1.007074, 401332.0000, 0.004945, 0.4934, '2025-10-17 07:01:10'),
(469342, 20, 0.992914, 0.993114, 0.993014, 0.993014, 0.993014, 308236.0000, -0.002784, -0.2795, '2025-10-17 07:01:11'),
(469343, 21, 0.997439, 0.997639, 0.997539, 0.997539, 0.997539, 629776.0000, -0.000237, -0.0238, '2025-10-17 07:01:11'),
(469344, 22, 1.001352, 1.001552, 1.001452, 1.001452, 1.001452, 754843.0000, 0.003394, 0.3401, '2025-10-17 07:01:11'),
(469345, 23, 1.001085, 1.001285, 1.001185, 1.001185, 1.001185, 83813.0000, -0.000394, -0.0393, '2025-10-17 07:01:11'),
(469346, 24, 1.005490, 1.005690, 1.005590, 1.005590, 1.005590, 681135.0000, -0.000459, -0.0457, '2025-10-17 07:01:11'),
(469347, 25, 1.000870, 1.001070, 1.000970, 1.000970, 1.000970, 32996.0000, -0.001121, -0.1118, '2025-10-17 07:01:11'),
(469348, 26, 1.004080, 1.004280, 1.004180, 1.004180, 1.004180, 8105.0000, 0.004704, 0.4707, '2025-10-17 07:01:11'),
(469349, 27, 1.000916, 1.001116, 1.001016, 1.001016, 1.001016, 654196.0000, 0.001811, 0.1813, '2025-10-17 07:01:11'),
(469350, 28, 0.996924, 0.997124, 0.997024, 0.997024, 0.997024, 170112.0000, 0.001062, 0.1067, '2025-10-17 07:01:11'),
(469351, 29, 1.009594, 1.009794, 1.009694, 1.009694, 1.009694, 299029.0000, -0.002352, -0.2324, '2025-10-17 07:01:11'),
(469352, 30, 0.994086, 0.994286, 0.994186, 0.994186, 0.994186, 413499.0000, -0.000689, -0.0692, '2025-10-17 07:01:11'),
(469353, 31, 0.997021, 0.997221, 0.997121, 0.997121, 0.997121, 679293.0000, -0.004152, -0.4147, '2025-10-17 07:01:11'),
(469354, 32, 1.002897, 1.003097, 1.002997, 1.002997, 1.002997, 850862.0000, -0.001209, -0.1203, '2025-10-17 07:01:11'),
(469355, 33, 0.995424, 0.995624, 0.995524, 0.995524, 0.995524, 468365.0000, 0.003422, 0.3450, '2025-10-17 07:01:11'),
(469356, 34, 1.009413, 1.009613, 1.009513, 1.009513, 1.009513, 646328.0000, 0.004523, 0.4501, '2025-10-17 07:01:11'),
(469357, 35, 1.013326, 1.013526, 1.013426, 1.013426, 1.013426, 262657.0000, 0.003040, 0.3009, '2025-10-17 07:01:11'),
(469358, 36, 1.000530, 1.000730, 1.000630, 1.000630, 1.000630, 29496.0000, -0.003470, -0.3456, '2025-10-17 07:01:11'),
(469359, 37, 1.001385, 1.001585, 1.001485, 1.001485, 1.001485, 837701.0000, -0.001816, -0.1810, '2025-10-17 07:01:11'),
(469360, 38, 0.997268, 0.997468, 0.997368, 0.997368, 0.997368, 969382.0000, -0.001042, -0.1044, '2025-10-17 07:01:11'),
(469361, 39, 1.011144, 1.011344, 1.011244, 1.011244, 1.011244, 500193.0000, -0.001208, -0.1193, '2025-10-17 07:01:11'),
(469362, 40, 1.003459, 1.003659, 1.003559, 1.003559, 1.003559, 591666.0000, 0.000957, 0.0955, '2025-10-17 07:01:11'),
(469363, 41, 1.000245, 1.000445, 1.000345, 1.000345, 1.000345, 909462.0000, -0.003040, -0.3030, '2025-10-17 07:01:11'),
(469364, 42, 0.995802, 0.996002, 0.995902, 0.995902, 0.995902, 506704.0000, 0.001744, 0.1754, '2025-10-17 07:01:11'),
(469365, 43, 0.994944, 0.995144, 0.995044, 0.995044, 0.995044, 760165.0000, 0.000869, 0.0874, '2025-10-17 07:01:11'),
(469366, 44, 1.001815, 1.002015, 1.001915, 1.001915, 1.001915, 400806.0000, 0.003336, 0.3341, '2025-10-17 07:01:11'),
(469367, 45, 0.989317, 0.989517, 0.989417, 0.989417, 0.989417, 72076.0000, 0.001422, 0.1439, '2025-10-17 07:01:11'),
(469368, 46, 0.996494, 0.996694, 0.996594, 0.996594, 0.996594, 417834.0000, -0.003419, -0.3419, '2025-10-17 07:01:11'),
(469369, 47, 1.018052, 1.018252, 1.018152, 1.018152, 1.018152, 413544.0000, 0.004105, 0.4048, '2025-10-17 07:01:11'),
(469370, 48, 0.993494, 0.993694, 0.993594, 0.993594, 0.993594, 572352.0000, -0.000608, -0.0612, '2025-10-17 07:01:11'),
(469371, 49, 0.987561, 0.987761, 0.987661, 0.987661, 0.987661, 365558.0000, 0.001711, 0.1736, '2025-10-17 07:01:11'),
(469372, 50, 0.987178, 0.987378, 0.987278, 0.987278, 0.987278, 267694.0000, 0.001625, 0.1649, '2025-10-17 07:01:11'),
(469373, 51, 1.005357, 1.005557, 1.005457, 1.005457, 1.005457, 217719.0000, 0.003587, 0.3580, '2025-10-17 07:01:11'),
(469374, 52, 0.993579, 0.993779, 0.993679, 0.993679, 0.993679, 51766.0000, 0.003397, 0.3430, '2025-10-17 07:01:11'),
(469375, 53, 0.999716, 0.999916, 0.999816, 0.999816, 0.999816, 154401.0000, -0.000540, -0.0540, '2025-10-17 07:01:11'),
(469376, 54, 0.991528, 0.991728, 0.991628, 0.991628, 0.991628, 389169.0000, 0.004762, 0.4826, '2025-10-17 07:01:11'),
(469377, 55, 1.003227, 1.003427, 1.003327, 1.003327, 1.003327, 157683.0000, 0.001887, 0.1885, '2025-10-17 07:01:11'),
(469378, 56, 1.008501, 1.008701, 1.008601, 1.008601, 1.008601, 512785.0000, -0.004136, -0.4084, '2025-10-17 07:01:11'),
(469379, 57, 1.003489, 1.003689, 1.003589, 1.003589, 1.003589, 849673.0000, 0.003109, 0.3107, '2025-10-17 07:01:11'),
(469380, 58, 0.994545, 0.994745, 0.994645, 0.994645, 0.994645, 747308.0000, 0.002454, 0.2474, '2025-10-17 07:01:11'),
(469381, 1, 1.080308, 1.080458, 1.080383, 1.080383, 1.080383, 870236.0000, -0.000198, -0.0183, '2025-10-17 07:01:20'),
(469382, 2, 1.250580, 1.250780, 1.250680, 1.250680, 1.250680, 600450.0000, 0.005249, 0.4215, '2025-10-17 07:01:20'),
(469383, 3, 150.888181, 150.903181, 150.895681, 150.895681, 150.895681, 596340.0000, -0.243892, -0.1614, '2025-10-17 07:01:20'),
(469384, 4, 0.919627, 0.919807, 0.919717, 0.919717, 0.919717, 301597.0000, -0.000176, -0.0191, '2025-10-17 07:01:20'),
(469385, 5, 1.349825, 1.350025, 1.349925, 1.349925, 1.349925, 413779.0000, -0.004312, -0.3184, '2025-10-17 07:01:20'),
(469386, 6, 0.674308, 0.674488, 0.674398, 0.674398, 0.674398, 889454.0000, -0.000729, -0.1079, '2025-10-17 07:01:20'),
(469387, 7, 0.614507, 0.614757, 0.614632, 0.614632, 0.614632, 77517.0000, -0.002725, -0.4414, '2025-10-17 07:01:20'),
(469388, 8, 0.851226, 0.851406, 0.851316, 0.851316, 0.851316, 602190.0000, 0.003901, 0.4604, '2025-10-17 07:01:20'),
(469389, 9, 162.477226, 162.502226, 162.489726, 162.489726, 162.489726, 931287.0000, -0.553552, -0.3395, '2025-10-17 07:01:20'),
(469390, 10, 1.006268, 1.006468, 1.006368, 1.006368, 1.006368, 409153.0000, 0.003223, 0.3213, '2025-10-17 07:01:20'),
(469391, 11, 0.996249, 0.996449, 0.996349, 0.996349, 0.996349, 279875.0000, -0.004840, -0.4834, '2025-10-17 07:01:20'),
(469392, 12, 0.998492, 0.998692, 0.998592, 0.998592, 0.998592, 722628.0000, 0.000494, 0.0495, '2025-10-17 07:01:20'),
(469393, 13, 1.008635, 1.008835, 1.008735, 1.008735, 1.008735, 885587.0000, 0.000675, 0.0669, '2025-10-17 07:01:20'),
(469394, 14, 189.095153, 189.125153, 189.110153, 189.110153, 189.110153, 722967.0000, 0.548874, 0.2911, '2025-10-17 07:01:20'),
(469395, 15, 0.997966, 0.998166, 0.998066, 0.998066, 0.998066, 694697.0000, 0.000137, 0.0138, '2025-10-17 07:01:20'),
(469396, 16, 1.008159, 1.008359, 1.008259, 1.008259, 1.008259, 561988.0000, 0.000234, 0.0232, '2025-10-17 07:01:20'),
(469397, 17, 0.999465, 0.999665, 0.999565, 0.999565, 0.999565, 149350.0000, 0.002526, 0.2533, '2025-10-17 07:01:20'),
(469398, 18, 0.992682, 0.992882, 0.992782, 0.992782, 0.992782, 648252.0000, -0.000831, -0.0837, '2025-10-17 07:01:20'),
(469399, 19, 1.002464, 1.002664, 1.002564, 1.002564, 1.002564, 287772.0000, -0.004510, -0.4478, '2025-10-17 07:01:20'),
(469400, 20, 0.994220, 0.994420, 0.994320, 0.994320, 0.994320, 288662.0000, 0.001306, 0.1315, '2025-10-17 07:01:20'),
(469401, 21, 0.998026, 0.998226, 0.998126, 0.998126, 0.998126, 159896.0000, 0.000587, 0.0588, '2025-10-17 07:01:20'),
(469402, 22, 1.001517, 1.001717, 1.001617, 1.001617, 1.001617, 682424.0000, 0.000165, 0.0165, '2025-10-17 07:01:20'),
(469403, 23, 1.002761, 1.002961, 1.002861, 1.002861, 1.002861, 567125.0000, 0.001676, 0.1674, '2025-10-17 07:01:20'),
(469404, 24, 1.004052, 1.004252, 1.004152, 1.004152, 1.004152, 502070.0000, -0.001438, -0.1430, '2025-10-17 07:01:20'),
(469405, 25, 1.002820, 1.003020, 1.002920, 1.002920, 1.002920, 876550.0000, 0.001950, 0.1948, '2025-10-17 07:01:20'),
(469406, 26, 1.000148, 1.000348, 1.000248, 1.000248, 1.000248, 380505.0000, -0.003932, -0.3915, '2025-10-17 07:01:20'),
(469407, 27, 0.996612, 0.996812, 0.996712, 0.996712, 0.996712, 437221.0000, -0.004304, -0.4299, '2025-10-17 07:01:20'),
(469408, 28, 1.000843, 1.001043, 1.000943, 1.000943, 1.000943, 405348.0000, 0.003919, 0.3931, '2025-10-17 07:01:20'),
(469409, 29, 1.014455, 1.014655, 1.014555, 1.014555, 1.014555, 443871.0000, 0.004861, 0.4814, '2025-10-17 07:01:20'),
(469410, 30, 0.996221, 0.996421, 0.996321, 0.996321, 0.996321, 902985.0000, 0.002135, 0.2148, '2025-10-17 07:01:20'),
(469411, 31, 0.997323, 0.997523, 0.997423, 0.997423, 0.997423, 341320.0000, 0.000302, 0.0302, '2025-10-17 07:01:20'),
(469412, 32, 1.005994, 1.006194, 1.006094, 1.006094, 1.006094, 602959.0000, 0.003097, 0.3088, '2025-10-17 07:01:20'),
(469413, 33, 0.999854, 1.000054, 0.999954, 0.999954, 0.999954, 415763.0000, 0.004430, 0.4450, '2025-10-17 07:01:20'),
(469414, 34, 1.006911, 1.007111, 1.007011, 1.007011, 1.007011, 421017.0000, -0.002502, -0.2479, '2025-10-17 07:01:20'),
(469415, 35, 1.011072, 1.011272, 1.011172, 1.011172, 1.011172, 503173.0000, -0.002254, -0.2224, '2025-10-17 07:01:20'),
(469416, 36, 1.004520, 1.004720, 1.004620, 1.004620, 1.004620, 509131.0000, 0.003990, 0.3987, '2025-10-17 07:01:20'),
(469417, 37, 1.004947, 1.005147, 1.005047, 1.005047, 1.005047, 661964.0000, 0.003562, 0.3557, '2025-10-17 07:01:20'),
(469418, 38, 0.995058, 0.995258, 0.995158, 0.995158, 0.995158, 926941.0000, -0.002210, -0.2216, '2025-10-17 07:01:20'),
(469419, 39, 1.006191, 1.006391, 1.006291, 1.006291, 1.006291, 680359.0000, -0.004953, -0.4898, '2025-10-17 07:01:20'),
(469420, 40, 1.006131, 1.006331, 1.006231, 1.006231, 1.006231, 465922.0000, 0.002672, 0.2663, '2025-10-17 07:01:20'),
(469421, 41, 0.998783, 0.998983, 0.998883, 0.998883, 0.998883, 565478.0000, -0.001462, -0.1461, '2025-10-17 07:01:20'),
(469422, 42, 0.991126, 0.991326, 0.991226, 0.991226, 0.991226, 930783.0000, -0.004676, -0.4695, '2025-10-17 07:01:20'),
(469423, 43, 0.996973, 0.997173, 0.997073, 0.997073, 0.997073, 369274.0000, 0.002029, 0.2039, '2025-10-17 07:01:20'),
(469424, 44, 1.005352, 1.005552, 1.005452, 1.005452, 1.005452, 690169.0000, 0.003537, 0.3530, '2025-10-17 07:01:20'),
(469425, 45, 0.991685, 0.991885, 0.991785, 0.991785, 0.991785, 17348.0000, 0.002368, 0.2393, '2025-10-17 07:01:20'),
(469426, 46, 0.991955, 0.992155, 0.992055, 0.992055, 0.992055, 103601.0000, -0.004539, -0.4554, '2025-10-17 07:01:20'),
(469427, 47, 1.014436, 1.014636, 1.014536, 1.014536, 1.014536, 796126.0000, -0.003616, -0.3552, '2025-10-17 07:01:20'),
(469428, 48, 0.991300, 0.991500, 0.991400, 0.991400, 0.991400, 48481.0000, -0.002194, -0.2208, '2025-10-17 07:01:20'),
(469429, 49, 0.989547, 0.989747, 0.989647, 0.989647, 0.989647, 459700.0000, 0.001986, 0.2011, '2025-10-17 07:01:20'),
(469430, 50, 0.991141, 0.991341, 0.991241, 0.991241, 0.991241, 254139.0000, 0.003963, 0.4014, '2025-10-17 07:01:20'),
(469431, 51, 1.007988, 1.008188, 1.008088, 1.008088, 1.008088, 990243.0000, 0.002631, 0.2617, '2025-10-17 07:01:20'),
(469432, 52, 0.997281, 0.997481, 0.997381, 0.997381, 0.997381, 246678.0000, 0.003702, 0.3726, '2025-10-17 07:01:20'),
(469433, 53, 0.995888, 0.996088, 0.995988, 0.995988, 0.995988, 142190.0000, -0.003828, -0.3828, '2025-10-17 07:01:20'),
(469434, 54, 0.991562, 0.991762, 0.991662, 0.991662, 0.991662, 368432.0000, 0.000034, 0.0034, '2025-10-17 07:01:20'),
(469435, 55, 1.008090, 1.008290, 1.008190, 1.008190, 1.008190, 80210.0000, 0.004863, 0.4847, '2025-10-17 07:01:20'),
(469436, 56, 1.005214, 1.005414, 1.005314, 1.005314, 1.005314, 430897.0000, -0.003287, -0.3259, '2025-10-17 07:01:20'),
(469437, 57, 1.008041, 1.008241, 1.008141, 1.008141, 1.008141, 592685.0000, 0.004552, 0.4536, '2025-10-17 07:01:20'),
(469438, 58, 0.990604, 0.990804, 0.990704, 0.990704, 0.990704, 540212.0000, -0.003941, -0.3962, '2025-10-17 07:01:20'),
(469439, 1, 1.080914, 1.081064, 1.080989, 1.080989, 1.080989, 404265.0000, 0.000606, 0.0561, '2025-10-17 07:01:25'),
(469440, 2, 1.244648, 1.244848, 1.244748, 1.244748, 1.244748, 93515.0000, -0.005932, -0.4743, '2025-10-17 07:01:25'),
(469441, 3, 151.314556, 151.329556, 151.322056, 151.322056, 151.322056, 544761.0000, 0.426375, 0.2826, '2025-10-17 07:01:25'),
(469442, 4, 0.919198, 0.919378, 0.919288, 0.919288, 0.919288, 76229.0000, -0.000429, -0.0466, '2025-10-17 07:01:25'),
(469443, 5, 1.349232, 1.349432, 1.349332, 1.349332, 1.349332, 280575.0000, -0.000593, -0.0439, '2025-10-17 07:01:25'),
(469444, 6, 0.672315, 0.672495, 0.672405, 0.672405, 0.672405, 289050.0000, -0.001993, -0.2955, '2025-10-17 07:01:25'),
(469445, 7, 0.613652, 0.613902, 0.613777, 0.613777, 0.613777, 658915.0000, -0.000855, -0.1392, '2025-10-17 07:01:25'),
(469446, 8, 0.852755, 0.852935, 0.852845, 0.852845, 0.852845, 744623.0000, 0.001529, 0.1796, '2025-10-17 07:01:25'),
(469447, 9, 162.466168, 162.491168, 162.478668, 162.478668, 162.478668, 580384.0000, -0.011058, -0.0068, '2025-10-17 07:01:25'),
(469448, 10, 1.008890, 1.009090, 1.008990, 1.008990, 1.008990, 516697.0000, 0.002622, 0.2606, '2025-10-17 07:01:25'),
(469449, 11, 0.999255, 0.999455, 0.999355, 0.999355, 0.999355, 402887.0000, 0.003006, 0.3017, '2025-10-17 07:01:25'),
(469450, 12, 0.996429, 0.996629, 0.996529, 0.996529, 0.996529, 89639.0000, -0.002063, -0.2065, '2025-10-17 07:01:25'),
(469451, 13, 1.007893, 1.008093, 1.007993, 1.007993, 1.007993, 972562.0000, -0.000742, -0.0735, '2025-10-17 07:01:25'),
(469452, 14, 189.901660, 189.931660, 189.916660, 189.916660, 189.916660, 384593.0000, 0.806507, 0.4265, '2025-10-17 07:01:25'),
(469453, 15, 0.993017, 0.993217, 0.993117, 0.993117, 0.993117, 132486.0000, -0.004949, -0.4958, '2025-10-17 07:01:25'),
(469454, 16, 1.008317, 1.008517, 1.008417, 1.008417, 1.008417, 279355.0000, 0.000158, 0.0157, '2025-10-17 07:01:25'),
(469455, 17, 1.004087, 1.004287, 1.004187, 1.004187, 1.004187, 47644.0000, 0.004622, 0.4624, '2025-10-17 07:01:25'),
(469456, 18, 0.997543, 0.997743, 0.997643, 0.997643, 0.997643, 358602.0000, 0.004861, 0.4896, '2025-10-17 07:01:25'),
(469457, 19, 0.999003, 0.999203, 0.999103, 0.999103, 0.999103, 157548.0000, -0.003461, -0.3452, '2025-10-17 07:01:25'),
(469458, 20, 0.997401, 0.997601, 0.997501, 0.997501, 0.997501, 399696.0000, 0.003181, 0.3199, '2025-10-17 07:01:25'),
(469459, 21, 0.996798, 0.996998, 0.996898, 0.996898, 0.996898, 384070.0000, -0.001228, -0.1230, '2025-10-17 07:01:25'),
(469460, 22, 1.004765, 1.004965, 1.004865, 1.004865, 1.004865, 781738.0000, 0.003248, 0.3243, '2025-10-17 07:01:25'),
(469461, 23, 1.001705, 1.001905, 1.001805, 1.001805, 1.001805, 402324.0000, -0.001056, -0.1053, '2025-10-17 07:01:25'),
(469462, 24, 1.000731, 1.000931, 1.000831, 1.000831, 1.000831, 738268.0000, -0.003321, -0.3308, '2025-10-17 07:01:25'),
(469463, 25, 0.997817, 0.998017, 0.997917, 0.997917, 0.997917, 895601.0000, -0.005003, -0.4988, '2025-10-17 07:01:25'),
(469464, 26, 0.995297, 0.995497, 0.995397, 0.995397, 0.995397, 286448.0000, -0.004851, -0.4850, '2025-10-17 07:01:25'),
(469465, 27, 1.000580, 1.000780, 1.000680, 1.000680, 1.000680, 688469.0000, 0.003968, 0.3981, '2025-10-17 07:01:25'),
(469466, 28, 0.996378, 0.996578, 0.996478, 0.996478, 0.996478, 76755.0000, -0.004465, -0.4461, '2025-10-17 07:01:25'),
(469467, 29, 1.019473, 1.019673, 1.019573, 1.019573, 1.019573, 882228.0000, 0.005018, 0.4946, '2025-10-17 07:01:25'),
(469468, 30, 0.993522, 0.993722, 0.993622, 0.993622, 0.993622, 149600.0000, -0.002699, -0.2709, '2025-10-17 07:01:25'),
(469469, 31, 0.994806, 0.995006, 0.994906, 0.994906, 0.994906, 432500.0000, -0.002517, -0.2523, '2025-10-17 07:01:25'),
(469470, 32, 1.001022, 1.001222, 1.001122, 1.001122, 1.001122, 782176.0000, -0.004972, -0.4942, '2025-10-17 07:01:25'),
(469471, 33, 1.004242, 1.004442, 1.004342, 1.004342, 1.004342, 496611.0000, 0.004388, 0.4388, '2025-10-17 07:01:25'),
(469472, 34, 1.005498, 1.005698, 1.005598, 1.005598, 1.005598, 488342.0000, -0.001413, -0.1403, '2025-10-17 07:01:25'),
(469473, 35, 1.010815, 1.011015, 1.010915, 1.010915, 1.010915, 174455.0000, -0.000257, -0.0254, '2025-10-17 07:01:25'),
(469474, 36, 1.005235, 1.005435, 1.005335, 1.005335, 1.005335, 663257.0000, 0.000715, 0.0712, '2025-10-17 07:01:25'),
(469475, 37, 1.006019, 1.006219, 1.006119, 1.006119, 1.006119, 976188.0000, 0.001072, 0.1066, '2025-10-17 07:01:25'),
(469476, 38, 0.996509, 0.996709, 0.996609, 0.996609, 0.996609, 452686.0000, 0.001451, 0.1458, '2025-10-17 07:01:25'),
(469477, 39, 1.007114, 1.007314, 1.007214, 1.007214, 1.007214, 607218.0000, 0.000923, 0.0917, '2025-10-17 07:01:25'),
(469478, 40, 1.006688, 1.006888, 1.006788, 1.006788, 1.006788, 448844.0000, 0.000557, 0.0553, '2025-10-17 07:01:25'),
(469479, 41, 0.994623, 0.994823, 0.994723, 0.994723, 0.994723, 450200.0000, -0.004160, -0.4165, '2025-10-17 07:01:25'),
(469480, 42, 0.987561, 0.987761, 0.987661, 0.987661, 0.987661, 611014.0000, -0.003565, -0.3597, '2025-10-17 07:01:25'),
(469481, 43, 0.994710, 0.994910, 0.994810, 0.994810, 0.994810, 513811.0000, -0.002263, -0.2269, '2025-10-17 07:01:25'),
(469482, 44, 1.005899, 1.006099, 1.005999, 1.005999, 1.005999, 737433.0000, 0.000547, 0.0544, '2025-10-17 07:01:25'),
(469483, 45, 0.992642, 0.992842, 0.992742, 0.992742, 0.992742, 694083.0000, 0.000957, 0.0965, '2025-10-17 07:01:25'),
(469484, 46, 0.996269, 0.996469, 0.996369, 0.996369, 0.996369, 487691.0000, 0.004314, 0.4349, '2025-10-17 07:01:25'),
(469485, 47, 1.018316, 1.018516, 1.018416, 1.018416, 1.018416, 689434.0000, 0.003880, 0.3825, '2025-10-17 07:01:25'),
(469486, 48, 0.994263, 0.994463, 0.994363, 0.994363, 0.994363, 63237.0000, 0.002963, 0.2988, '2025-10-17 07:01:25'),
(469487, 49, 0.992994, 0.993194, 0.993094, 0.993094, 0.993094, 356098.0000, 0.003447, 0.3483, '2025-10-17 07:01:25'),
(469488, 50, 0.991531, 0.991731, 0.991631, 0.991631, 0.991631, 39351.0000, 0.000390, 0.0393, '2025-10-17 07:01:25'),
(469489, 51, 1.008680, 1.008880, 1.008780, 1.008780, 1.008780, 852669.0000, 0.000692, 0.0687, '2025-10-17 07:01:25'),
(469490, 52, 0.996210, 0.996410, 0.996310, 0.996310, 0.996310, 635278.0000, -0.001071, -0.1073, '2025-10-17 07:01:25'),
(469491, 53, 1.000864, 1.001064, 1.000964, 1.000964, 1.000964, 363783.0000, 0.004976, 0.4996, '2025-10-17 07:01:25'),
(469492, 54, 0.992036, 0.992236, 0.992136, 0.992136, 0.992136, 1901.0000, 0.000474, 0.0478, '2025-10-17 07:01:25'),
(469493, 55, 1.008821, 1.009021, 1.008921, 1.008921, 1.008921, 728410.0000, 0.000731, 0.0725, '2025-10-17 07:01:25'),
(469494, 56, 1.001155, 1.001355, 1.001255, 1.001255, 1.001255, 542441.0000, -0.004059, -0.4037, '2025-10-17 07:01:25'),
(469495, 57, 1.011543, 1.011743, 1.011643, 1.011643, 1.011643, 204068.0000, 0.003502, 0.3473, '2025-10-17 07:01:25'),
(469496, 58, 0.992799, 0.992999, 0.992899, 0.992899, 0.992899, 428097.0000, 0.002195, 0.2216, '2025-10-17 07:01:25');

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` int(11) NOT NULL,
  `migration_name` varchar(255) NOT NULL,
  `executed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `execution_time_ms` int(11) DEFAULT NULL,
  `executed_by` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Track executed database migrations';

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `migration_name`, `executed_at`, `execution_time_ms`, `executed_by`) VALUES
(1, '001_enhance_trading_accounts', '2025-10-16 19:04:04', 53, 'system'),
(2, '002_enhance_positions', '2025-10-16 19:06:50', 213, 'system'),
(3, '003_create_trading_charges', '2025-10-16 19:06:50', 47, 'system'),
(4, '004_enhance_ib_commission', '2025-10-16 19:11:33', 66, 'system'),
(5, '005_create_risk_management_logs', '2025-10-16 19:11:33', 74, 'system');

-- --------------------------------------------------------

--
-- Table structure for table `notification_templates`
--

CREATE TABLE `notification_templates` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `type` enum('email','sms','push','in_app') NOT NULL,
  `subject` varchar(500) DEFAULT NULL,
  `body` text NOT NULL,
  `variables` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`variables`)),
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notification_templates`
--

INSERT INTO `notification_templates` (`id`, `name`, `type`, `subject`, `body`, `variables`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'welcome_email', 'email', 'Welcome to {{platform_name}}!', 'Dear {{first_name}},\n\nWelcome to our trading platform! Your account has been successfully created.', '[\"platform_name\", \"first_name\"]', 1, '2025-10-08 05:17:58', '2025-10-08 05:17:58'),
(2, 'deposit_confirmed', 'email', 'Deposit Confirmed', 'Your deposit of {{amount}} {{currency}} has been confirmed and added to your account.', '[\"amount\", \"currency\"]', 1, '2025-10-08 05:17:58', '2025-10-08 05:17:58'),
(3, 'withdrawal_processed', 'email', 'Withdrawal Processed', 'Your withdrawal request of {{amount}} {{currency}} has been processed.', '[\"amount\", \"currency\"]', 1, '2025-10-08 05:17:58', '2025-10-08 05:17:58'),
(4, 'margin_call', 'email', 'Margin Call Alert', 'Your account margin level has fallen below the required threshold. Please add funds or close positions.', '[]', 1, '2025-10-08 05:17:58', '2025-10-08 05:17:58'),
(5, 'trade_executed', 'in_app', 'Trade Executed', 'Your {{side}} order for {{symbol}} has been executed at {{price}}.', '[\"side\", \"symbol\", \"price\"]', 1, '2025-10-08 05:17:58', '2025-10-08 05:17:58');

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `symbol_id` int(11) NOT NULL,
  `order_type` enum('market','limit','stop','stop_limit') NOT NULL,
  `side` enum('buy','sell') NOT NULL,
  `lot_size` decimal(8,4) NOT NULL,
  `price` decimal(12,6) DEFAULT NULL,
  `stop_loss` decimal(12,6) DEFAULT NULL,
  `take_profit` decimal(12,6) DEFAULT NULL,
  `expiry_date` timestamp NULL DEFAULT NULL,
  `status` enum('pending','filled','partially_filled','cancelled','rejected','expired') DEFAULT 'pending',
  `filled_lot_size` decimal(8,4) DEFAULT 0.0000,
  `average_fill_price` decimal(12,6) DEFAULT NULL,
  `commission` decimal(10,4) DEFAULT 0.0000,
  `swap` decimal(10,4) DEFAULT 0.0000,
  `comment` text DEFAULT NULL,
  `magic_number` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `filled_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `used` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_gateways`
--

CREATE TABLE `payment_gateways` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `type` enum('bank_transfer','credit_card','debit_card','crypto','e_wallet','wire_transfer') NOT NULL,
  `provider` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `min_amount` decimal(15,4) DEFAULT 0.0000,
  `max_amount` decimal(15,4) DEFAULT 999999.9999,
  `processing_fee_type` enum('fixed','percentage') DEFAULT 'percentage',
  `processing_fee_value` decimal(10,4) DEFAULT 0.0000,
  `processing_time_hours` int(11) DEFAULT 24,
  `supported_currencies` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`supported_currencies`)),
  `configuration` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`configuration`)),
  `sort_order` int(11) DEFAULT 0,
  `icon_url` varchar(500) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payment_gateways`
--

INSERT INTO `payment_gateways` (`id`, `name`, `display_name`, `type`, `provider`, `is_active`, `min_amount`, `max_amount`, `processing_fee_type`, `processing_fee_value`, `processing_time_hours`, `supported_currencies`, `configuration`, `sort_order`, `icon_url`, `description`, `created_at`, `updated_at`) VALUES
(1, 'bank_transfer', 'Bank Transfer', 'bank_transfer', NULL, 1, 100.0000, 50000.0000, 'fixed', 0.0000, 24, '[\"USD\", \"EUR\", \"GBP\"]', NULL, 0, NULL, 'Secure bank wire transfer', '2025-10-09 05:34:56', '2025-10-09 05:34:56'),
(2, 'credit_card', 'Credit Card', 'credit_card', NULL, 1, 50.0000, 5000.0000, 'percentage', 2.5000, 1, '[\"USD\", \"EUR\", \"GBP\"]', NULL, 0, NULL, 'Instant credit card deposits', '2025-10-09 05:34:56', '2025-10-09 05:34:56'),
(3, 'debit_card', 'Debit Card', 'debit_card', NULL, 1, 50.0000, 5000.0000, 'percentage', 2.0000, 1, '[\"USD\", \"EUR\", \"GBP\"]', NULL, 0, NULL, 'Instant debit card deposits', '2025-10-09 05:34:56', '2025-10-09 05:34:56'),
(4, 'crypto_btc', 'Bitcoin', 'crypto', NULL, 1, 100.0000, 10000.0000, 'percentage', 1.0000, 6, '[\"USD\", \"EUR\", \"GBP\"]', NULL, 0, NULL, 'Bitcoin cryptocurrency deposits', '2025-10-09 05:34:56', '2025-10-09 05:34:56'),
(5, 'paypal', 'PayPal', 'e_wallet', NULL, 1, 25.0000, 2500.0000, 'percentage', 3.0000, 2, '[\"USD\", \"EUR\", \"GBP\"]', NULL, 0, NULL, 'PayPal e-wallet transfers', '2025-10-09 05:34:56', '2025-10-09 05:34:56'),
(6, 'bank_transfer', 'Bank Transfer', 'bank_transfer', NULL, 1, 100.0000, 50000.0000, 'fixed', 0.0000, 24, '[\"USD\", \"EUR\", \"GBP\"]', NULL, 0, NULL, 'Secure bank wire transfer', '2025-10-09 05:35:08', '2025-10-09 05:35:08'),
(7, 'credit_card', 'Credit Card', 'credit_card', NULL, 1, 50.0000, 5000.0000, 'percentage', 2.5000, 1, '[\"USD\", \"EUR\", \"GBP\"]', NULL, 0, NULL, 'Instant credit card deposits', '2025-10-09 05:35:08', '2025-10-09 05:35:08'),
(8, 'debit_card', 'Debit Card', 'debit_card', NULL, 1, 50.0000, 5000.0000, 'percentage', 2.0000, 1, '[\"USD\", \"EUR\", \"GBP\"]', NULL, 0, NULL, 'Instant debit card deposits', '2025-10-09 05:35:08', '2025-10-09 05:35:08'),
(9, 'crypto_btc', 'Bitcoin', 'crypto', NULL, 1, 100.0000, 10000.0000, 'percentage', 1.0000, 6, '[\"USD\", \"EUR\", \"GBP\"]', NULL, 0, NULL, 'Bitcoin cryptocurrency deposits', '2025-10-09 05:35:08', '2025-10-09 05:35:08'),
(10, 'paypal', 'PayPal', 'e_wallet', NULL, 1, 25.0000, 2500.0000, 'percentage', 3.0000, 2, '[\"USD\", \"EUR\", \"GBP\"]', NULL, 0, NULL, 'PayPal e-wallet transfers', '2025-10-09 05:35:08', '2025-10-09 05:35:08'),
(11, 'bank_transfer', 'Bank Transfer', 'bank_transfer', NULL, 1, 100.0000, 50000.0000, 'fixed', 0.0000, 24, '[\"USD\", \"EUR\", \"GBP\"]', NULL, 0, NULL, 'Secure bank wire transfer', '2025-10-09 05:35:56', '2025-10-09 05:35:56'),
(12, 'credit_card', 'Credit Card', 'credit_card', NULL, 1, 50.0000, 5000.0000, 'percentage', 2.5000, 1, '[\"USD\", \"EUR\", \"GBP\"]', NULL, 0, NULL, 'Instant credit card deposits', '2025-10-09 05:35:56', '2025-10-09 05:35:56'),
(13, 'debit_card', 'Debit Card', 'debit_card', NULL, 1, 50.0000, 5000.0000, 'percentage', 2.0000, 1, '[\"USD\", \"EUR\", \"GBP\"]', NULL, 0, NULL, 'Instant debit card deposits', '2025-10-09 05:35:56', '2025-10-09 05:35:56'),
(14, 'crypto_btc', 'Bitcoin', 'crypto', NULL, 1, 100.0000, 10000.0000, 'percentage', 1.0000, 6, '[\"USD\", \"EUR\", \"GBP\"]', NULL, 0, NULL, 'Bitcoin cryptocurrency deposits', '2025-10-09 05:35:56', '2025-10-09 05:35:56'),
(15, 'paypal', 'PayPal', 'e_wallet', NULL, 1, 25.0000, 2500.0000, 'percentage', 3.0000, 2, '[\"USD\", \"EUR\", \"GBP\"]', NULL, 0, NULL, 'PayPal e-wallet transfers', '2025-10-09 05:35:56', '2025-10-09 05:35:56');

-- --------------------------------------------------------

--
-- Table structure for table `payment_methods`
--

CREATE TABLE `payment_methods` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `type` enum('bank_transfer','credit_card','debit_card','ewallet','crypto','check') NOT NULL,
  `provider` varchar(100) DEFAULT NULL,
  `supported_currencies` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`supported_currencies`)),
  `min_amount` decimal(10,2) DEFAULT 0.00,
  `max_amount` decimal(15,2) DEFAULT NULL,
  `deposit_fee_type` enum('fixed','percentage') DEFAULT 'percentage',
  `deposit_fee_value` decimal(8,4) DEFAULT 0.0000,
  `withdrawal_fee_type` enum('fixed','percentage') DEFAULT 'percentage',
  `withdrawal_fee_value` decimal(8,4) DEFAULT 0.0000,
  `processing_time_hours` int(11) DEFAULT 24,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `pending_transactions`
-- (See below for the actual view)
--
CREATE TABLE `pending_transactions` (
`transaction_type` varchar(10)
,`id` int(11)
,`user_id` int(11)
,`first_name` varchar(100)
,`last_name` varchar(100)
,`amount` decimal(15,4)
,`currency` varchar(3)
,`status` varchar(10)
,`created_at` timestamp
,`payment_method` varchar(100)
);

-- --------------------------------------------------------

--
-- Table structure for table `positions`
--

CREATE TABLE `positions` (
  `id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  `symbol_id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `side` enum('buy','sell') NOT NULL,
  `lot_size` decimal(8,4) NOT NULL,
  `margin_required` decimal(15,4) DEFAULT 0.0000 COMMENT 'Margin locked for this position',
  `open_price` decimal(12,6) NOT NULL,
  `current_price` decimal(12,6) DEFAULT NULL,
  `stop_loss` decimal(12,6) DEFAULT NULL,
  `take_profit` decimal(12,6) DEFAULT NULL,
  `commission` decimal(10,4) DEFAULT 0.0000,
  `swap` decimal(10,4) DEFAULT 0.0000,
  `swap_long` decimal(10,4) DEFAULT 0.0000 COMMENT 'Swap rate for long positions',
  `swap_short` decimal(10,4) DEFAULT 0.0000 COMMENT 'Swap rate for short positions',
  `daily_swap_charge` decimal(10,4) DEFAULT 0.0000 COMMENT 'Last applied daily swap charge',
  `days_held` int(11) DEFAULT 0 COMMENT 'Number of days position has been held',
  `carry_forward_charge` decimal(10,4) DEFAULT 0.0000 COMMENT 'Total carry forward charges',
  `spread_charge` decimal(10,4) DEFAULT 0.0000 COMMENT 'Spread cost at position opening',
  `total_charges` decimal(10,4) DEFAULT 0.0000 COMMENT 'Sum of all charges',
  `profit` decimal(12,4) DEFAULT 0.0000,
  `net_profit` decimal(12,4) DEFAULT 0.0000 COMMENT 'Gross profit minus all charges',
  `status` enum('open','pending','closed','partially_closed') DEFAULT 'open',
  `comment` text DEFAULT NULL,
  `magic_number` int(11) DEFAULT NULL,
  `opened_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `closed_at` timestamp NULL DEFAULT NULL,
  `close_reason` enum('manual','stop_loss','take_profit','margin_call','system') DEFAULT 'manual',
  `close_price` decimal(12,6) DEFAULT NULL,
  `profit_loss` decimal(12,4) DEFAULT 0.0000,
  `close_time` timestamp NULL DEFAULT NULL,
  `order_type` enum('market','limit','stop','stop_limit') DEFAULT 'market' COMMENT 'Type of order',
  `trigger_price` decimal(12,6) DEFAULT NULL,
  `is_triggered` tinyint(1) DEFAULT 0 COMMENT 'Whether pending order has been triggered',
  `execution_price` decimal(12,6) DEFAULT NULL COMMENT 'Actual execution price',
  `slippage` decimal(10,4) DEFAULT 0.0000 COMMENT 'Difference between trigger and execution price'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `position_state_history`
--

CREATE TABLE `position_state_history` (
  `id` int(11) NOT NULL,
  `position_id` int(11) NOT NULL,
  `state_type` enum('opened','modified','sl_updated','tp_updated','closed','triggered','cancelled') NOT NULL,
  `old_value` text DEFAULT NULL COMMENT 'Previous value (JSON)',
  `new_value` text DEFAULT NULL COMMENT 'New value (JSON)',
  `changed_by` int(11) DEFAULT NULL COMMENT 'User who made the change',
  `reason` varchar(255) DEFAULT NULL COMMENT 'Reason for change',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Track all state changes for positions for audit trail';

-- --------------------------------------------------------

--
-- Table structure for table `price_alerts`
--

CREATE TABLE `price_alerts` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `symbol_id` int(11) NOT NULL,
  `alert_type` enum('price_above','price_below','price_change_percent') NOT NULL,
  `trigger_value` decimal(12,6) NOT NULL,
  `current_value` decimal(12,6) DEFAULT NULL,
  `is_triggered` tinyint(1) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `message` text DEFAULT NULL,
  `triggered_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `price_history`
--

CREATE TABLE `price_history` (
  `id` int(11) NOT NULL,
  `symbol_id` int(11) NOT NULL,
  `timeframe` enum('M1','M5','M15','M30','H1','H4','D1','W1','MN1') NOT NULL,
  `open_price` decimal(12,6) NOT NULL,
  `high_price` decimal(12,6) NOT NULL,
  `low_price` decimal(12,6) NOT NULL,
  `close_price` decimal(12,6) NOT NULL,
  `volume` decimal(15,4) DEFAULT 0.0000,
  `tick_volume` int(11) DEFAULT 0,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `referral_codes`
--

CREATE TABLE `referral_codes` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `code` varchar(20) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `usage_count` int(11) DEFAULT 0,
  `max_usage` int(11) DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `is_admin` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`id`, `name`, `description`, `is_admin`, `created_at`) VALUES
(1, 'Super Admin', 'Full system administrator with all permissions', 1, '2025-10-13 10:55:21'),
(2, 'Admin', 'Standard administrator with elevated permissions', 1, '2025-10-13 10:55:21'),
(3, 'Manager', 'Back-office manager level access', 0, '2025-10-13 10:55:21'),
(4, 'Trader', 'Regular trading user', 0, '2025-10-13 10:55:21'),
(5, 'IB', 'Introducing Broker', 0, '2025-10-14 10:16:22');

-- --------------------------------------------------------

--
-- Table structure for table `support_categories`
--

CREATE TABLE `support_categories` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `priority_level` enum('low','medium','high','urgent') DEFAULT 'medium',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `support_responses`
--

CREATE TABLE `support_responses` (
  `id` int(11) NOT NULL,
  `ticket_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `message` text NOT NULL,
  `is_internal` tinyint(1) DEFAULT 0,
  `attachments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attachments`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `support_tickets`
--

CREATE TABLE `support_tickets` (
  `id` int(11) NOT NULL,
  `ticket_number` varchar(20) NOT NULL,
  `user_id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `subject` varchar(500) NOT NULL,
  `description` text NOT NULL,
  `priority` enum('low','medium','high','urgent') DEFAULT 'medium',
  `status` enum('open','in_progress','waiting_user','resolved','closed') DEFAULT 'open',
  `assigned_to` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `resolved_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `support_ticket_messages`
--

CREATE TABLE `support_ticket_messages` (
  `id` int(11) NOT NULL,
  `ticket_id` int(11) NOT NULL,
  `sender_id` int(11) NOT NULL,
  `message` text NOT NULL,
  `is_internal` tinyint(1) DEFAULT 0,
  `attachments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attachments`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `swap_charges_log`
--

CREATE TABLE `swap_charges_log` (
  `id` int(11) NOT NULL,
  `position_id` int(11) NOT NULL,
  `charge_date` date NOT NULL COMMENT 'Date swap was applied',
  `swap_rate` decimal(10,4) NOT NULL COMMENT 'Swap rate used',
  `swap_amount` decimal(10,4) NOT NULL COMMENT 'Actual charge amount',
  `position_side` enum('buy','sell') NOT NULL COMMENT 'Position direction',
  `lot_size` decimal(8,4) NOT NULL COMMENT 'Position size',
  `is_triple_swap` tinyint(1) DEFAULT 0 COMMENT 'Whether this was triple swap (Wednesday)',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Daily log of swap charges applied to positions';

-- --------------------------------------------------------

--
-- Table structure for table `symbols`
--

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
  `spread_type` enum('fixed','floating') DEFAULT 'floating',
  `spread_markup` decimal(10,4) DEFAULT 0.0000,
  `commission_type` enum('per_lot','percentage','fixed') DEFAULT 'per_lot',
  `commission_value` decimal(10,4) DEFAULT 0.0000,
  `swap_long` decimal(10,4) DEFAULT 0.0000,
  `swap_short` decimal(10,4) DEFAULT 0.0000,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `symbols`
--

INSERT INTO `symbols` (`id`, `symbol`, `name`, `category_id`, `base_currency`, `quote_currency`, `pip_size`, `lot_size`, `min_lot`, `max_lot`, `lot_step`, `contract_size`, `margin_requirement`, `spread_type`, `spread_markup`, `commission_type`, `commission_value`, `swap_long`, `swap_short`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'EURUSD', 'Euro vs US Dollar', 1, 'EUR', 'USD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 0.8000, 'per_lot', 0.0000, -0.5000, -0.3000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(2, 'GBPUSD', 'British Pound vs US Dollar', 1, 'GBP', 'USD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.2000, 'per_lot', 0.0000, -0.6000, -0.4000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(3, 'USDJPY', 'US Dollar vs Japanese Yen', 1, 'USD', 'JPY', 0.01000000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 0.9000, 'per_lot', 0.0000, -0.4500, -0.3500, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(4, 'USDCHF', 'US Dollar vs Swiss Franc', 1, 'USD', 'CHF', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.0000, 'per_lot', 0.0000, -0.5500, -0.2500, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(5, 'USDCAD', 'US Dollar vs Canadian Dollar', 1, 'USD', 'CAD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.1000, 'per_lot', 0.0000, -0.5000, -0.3000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(6, 'AUDUSD', 'Australian Dollar vs US Dollar', 1, 'AUD', 'USD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.0000, 'per_lot', 0.0000, -0.5200, -0.2800, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(7, 'NZDUSD', 'New Zealand Dollar vs US Dollar', 1, 'NZD', 'USD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.3000, 'per_lot', 0.0000, -0.4800, -0.3200, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(8, 'EURGBP', 'Euro vs British Pound', 2, 'EUR', 'GBP', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.5000, 'per_lot', 0.0000, -0.6500, -0.4500, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(9, 'EURJPY', 'Euro vs Japanese Yen', 2, 'EUR', 'JPY', 0.01000000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.4000, 'per_lot', 0.0000, -0.6000, -0.4000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(10, 'EURCHF', 'Euro vs Swiss Franc', 2, 'EUR', 'CHF', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.6000, 'per_lot', 0.0000, -0.7000, -0.3000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(11, 'EURAUD', 'Euro vs Australian Dollar', 2, 'EUR', 'AUD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.8000, 'per_lot', 0.0000, -0.7500, -0.3500, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(12, 'EURCAD', 'Euro vs Canadian Dollar', 2, 'EUR', 'CAD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.7000, 'per_lot', 0.0000, -0.6800, -0.3800, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(13, 'EURNZD', 'Euro vs New Zealand Dollar', 2, 'EUR', 'NZD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 2.0000, 'per_lot', 0.0000, -0.8000, -0.4000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(14, 'GBPJPY', 'British Pound vs Japanese Yen', 2, 'GBP', 'JPY', 0.01000000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.9000, 'per_lot', 0.0000, -0.7500, -0.4500, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(15, 'GBPCHF', 'British Pound vs Swiss Franc', 2, 'GBP', 'CHF', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 2.1000, 'per_lot', 0.0000, -0.7800, -0.3800, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(16, 'GBPAUD', 'British Pound vs Australian Dollar', 2, 'GBP', 'AUD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 2.3000, 'per_lot', 0.0000, -0.8200, -0.4200, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(17, 'GBPCAD', 'British Pound vs Canadian Dollar', 2, 'GBP', 'CAD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 2.2000, 'per_lot', 0.0000, -0.8000, -0.4000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(18, 'GBPNZD', 'British Pound vs New Zealand Dollar', 2, 'GBP', 'NZD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 2.5000, 'per_lot', 0.0000, -0.8500, -0.4500, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(19, 'AUDJPY', 'Australian Dollar vs Japanese Yen', 2, 'AUD', 'JPY', 0.01000000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.6000, 'per_lot', 0.0000, -0.6200, -0.3800, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(20, 'AUDCHF', 'Australian Dollar vs Swiss Franc', 2, 'AUD', 'CHF', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.8000, 'per_lot', 0.0000, -0.6800, -0.3200, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(21, 'AUDCAD', 'Australian Dollar vs Canadian Dollar', 2, 'AUD', 'CAD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.7000, 'per_lot', 0.0000, -0.6500, -0.3500, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(22, 'AUDNZD', 'Australian Dollar vs New Zealand Dollar', 2, 'AUD', 'NZD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.9000, 'per_lot', 0.0000, -0.7000, -0.4000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(23, 'NZDJPY', 'New Zealand Dollar vs Japanese Yen', 2, 'NZD', 'JPY', 0.01000000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.7000, 'per_lot', 0.0000, -0.6400, -0.3600, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(24, 'NZDCHF', 'New Zealand Dollar vs Swiss Franc', 2, 'NZD', 'CHF', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 2.0000, 'per_lot', 0.0000, -0.7200, -0.3800, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(25, 'NZDCAD', 'New Zealand Dollar vs Canadian Dollar', 2, 'NZD', 'CAD', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.9000, 'per_lot', 0.0000, -0.6800, -0.3800, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(26, 'CADJPY', 'Canadian Dollar vs Japanese Yen', 2, 'CAD', 'JPY', 0.01000000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.6000, 'per_lot', 0.0000, -0.6000, -0.4000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(27, 'CADCHF', 'Canadian Dollar vs Swiss Franc', 2, 'CAD', 'CHF', 0.00010000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.8000, 'per_lot', 0.0000, -0.6600, -0.3600, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(28, 'CHFJPY', 'Swiss Franc vs Japanese Yen', 2, 'CHF', 'JPY', 0.01000000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.7000, 'per_lot', 0.0000, -0.6300, -0.3700, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(29, 'USDINR', 'US Dollar vs Indian Rupee', 3, 'USD', 'INR', 0.00010000, 100000.0000, 0.0100, 50.0000, 0.0100, 100000.0000, 2.0000, 'floating', 3.5000, 'per_lot', 0.0000, -1.2000, -0.8000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(30, 'USDTRY', 'US Dollar vs Turkish Lira', 3, 'USD', 'TRY', 0.00010000, 100000.0000, 0.0100, 50.0000, 0.0100, 100000.0000, 2.0000, 'floating', 4.0000, 'per_lot', 0.0000, -1.5000, -1.0000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(31, 'USDZAR', 'US Dollar vs South African Rand', 3, 'USD', 'ZAR', 0.00010000, 100000.0000, 0.0100, 50.0000, 0.0100, 100000.0000, 2.0000, 'floating', 3.8000, 'per_lot', 0.0000, -1.4000, -0.9000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(32, 'USDMXN', 'US Dollar vs Mexican Peso', 3, 'USD', 'MXN', 0.00010000, 100000.0000, 0.0100, 50.0000, 0.0100, 100000.0000, 2.0000, 'floating', 3.2000, 'per_lot', 0.0000, -1.1000, -0.7000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(33, 'USDTHB', 'US Dollar vs Thai Baht', 3, 'USD', 'THB', 0.01000000, 100000.0000, 0.0100, 50.0000, 0.0100, 100000.0000, 2.0000, 'floating', 3.6000, 'per_lot', 0.0000, -1.2500, -0.8500, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(34, 'USDSEK', 'US Dollar vs Swedish Krona', 3, 'USD', 'SEK', 0.00010000, 100000.0000, 0.0100, 50.0000, 0.0100, 100000.0000, 1.5000, 'floating', 2.8000, 'per_lot', 0.0000, -0.9500, -0.6500, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(35, 'USDNOK', 'US Dollar vs Norwegian Krone', 3, 'USD', 'NOK', 0.00010000, 100000.0000, 0.0100, 50.0000, 0.0100, 100000.0000, 1.5000, 'floating', 2.9000, 'per_lot', 0.0000, -1.0000, -0.7000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(36, 'EURSEK', 'Euro vs Swedish Krona', 3, 'EUR', 'SEK', 0.00010000, 100000.0000, 0.0100, 50.0000, 0.0100, 100000.0000, 1.5000, 'floating', 3.0000, 'per_lot', 0.0000, -1.0500, -0.7500, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(37, 'EURNOK', 'Euro vs Norwegian Krone', 3, 'EUR', 'NOK', 0.00010000, 100000.0000, 0.0100, 50.0000, 0.0100, 100000.0000, 1.5000, 'floating', 3.1000, 'per_lot', 0.0000, -1.0800, -0.7800, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(38, 'USDPLN', 'US Dollar vs Polish Zloty', 3, 'USD', 'PLN', 0.00010000, 100000.0000, 0.0100, 50.0000, 0.0100, 100000.0000, 1.5000, 'floating', 3.3000, 'per_lot', 0.0000, -1.1500, -0.7500, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(39, 'BTCUSD', 'Bitcoin vs US Dollar', 4, 'BTC', 'USD', 0.01000000, 100000.0000, 0.0100, 10.0000, 0.0100, 1.0000, 5.0000, 'floating', 25.0000, 'per_lot', 0.0000, -2.5000, -2.5000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(40, 'ETHUSD', 'Ethereum vs US Dollar', 4, 'ETH', 'USD', 0.01000000, 100000.0000, 0.0100, 50.0000, 0.0100, 1.0000, 5.0000, 'floating', 12.0000, 'per_lot', 0.0000, -1.8000, -1.8000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(41, 'BNBUSD', 'Binance Coin vs US Dollar', 4, 'BNB', 'USD', 0.01000000, 100000.0000, 0.0100, 50.0000, 0.0100, 1.0000, 5.0000, 'floating', 8.0000, 'per_lot', 0.0000, -1.5000, -1.5000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(42, 'SOLUSD', 'Solana vs US Dollar', 4, 'SOL', 'USD', 0.01000000, 100000.0000, 0.0100, 100.0000, 0.0100, 1.0000, 5.0000, 'floating', 6.0000, 'per_lot', 0.0000, -1.2000, -1.2000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(43, 'XRPUSD', 'Ripple vs US Dollar', 4, 'XRP', 'USD', 0.00010000, 100000.0000, 0.0100, 1000.0000, 0.0100, 1.0000, 5.0000, 'floating', 3.0000, 'per_lot', 0.0000, -0.8000, -0.8000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(44, 'ADAUSD', 'Cardano vs US Dollar', 4, 'ADA', 'USD', 0.00010000, 100000.0000, 0.0100, 1000.0000, 0.0100, 1.0000, 5.0000, 'floating', 2.5000, 'per_lot', 0.0000, -0.7000, -0.7000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(45, 'DOGEUSD', 'Dogecoin vs US Dollar', 4, 'DOGE', 'USD', 0.00010000, 100000.0000, 0.0100, 10000.0000, 0.0100, 1.0000, 5.0000, 'floating', 1.5000, 'per_lot', 0.0000, -0.5000, -0.5000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(46, 'LTCUSD', 'Litecoin vs US Dollar', 4, 'LTC', 'USD', 0.01000000, 100000.0000, 0.0100, 100.0000, 0.0100, 1.0000, 5.0000, 'floating', 5.0000, 'per_lot', 0.0000, -1.0000, -1.0000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(47, 'DOTUSD', 'Polkadot vs US Dollar', 4, 'DOT', 'USD', 0.01000000, 100000.0000, 0.0100, 500.0000, 0.0100, 1.0000, 5.0000, 'floating', 4.0000, 'per_lot', 0.0000, -0.9000, -0.9000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(48, 'AVAXUSD', 'Avalanche vs US Dollar', 4, 'AVAX', 'USD', 0.01000000, 100000.0000, 0.0100, 100.0000, 0.0100, 1.0000, 5.0000, 'floating', 5.5000, 'per_lot', 0.0000, -1.1000, -1.1000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(49, 'XAUUSD', 'Gold vs US Dollar', 5, 'XAU', 'USD', 0.01000000, 100000.0000, 0.0100, 50.0000, 0.0100, 100.0000, 1.0000, 'floating', 0.3000, 'per_lot', 0.0000, -0.4500, -0.2500, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(50, 'XAGUSD', 'Silver vs US Dollar', 5, 'XAG', 'USD', 0.00100000, 100000.0000, 0.0100, 50.0000, 0.0100, 5000.0000, 1.5000, 'floating', 0.0250, 'per_lot', 0.0000, -0.5000, -0.3000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(51, 'XPTUSD', 'Platinum vs US Dollar', 5, 'XPT', 'USD', 0.01000000, 100000.0000, 0.0100, 25.0000, 0.0100, 100.0000, 2.0000, 'floating', 0.5000, 'per_lot', 0.0000, -0.6000, -0.4000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(52, 'XPDUSD', 'Palladium vs US Dollar', 5, 'XPD', 'USD', 0.01000000, 100000.0000, 0.0100, 25.0000, 0.0100, 100.0000, 2.0000, 'floating', 0.6000, 'per_lot', 0.0000, -0.6500, -0.4500, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(53, 'WTIUSD', 'West Texas Oil vs US Dollar', 5, 'WTI', 'USD', 0.01000000, 100000.0000, 0.0100, 50.0000, 0.0100, 1000.0000, 2.0000, 'floating', 0.0500, 'per_lot', 0.0000, -0.8000, -0.5000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(54, 'BRENTUSD', 'Brent Oil vs US Dollar', 5, 'BRENT', 'USD', 0.01000000, 100000.0000, 0.0100, 50.0000, 0.0100, 1000.0000, 2.0000, 'floating', 0.0500, 'per_lot', 0.0000, -0.7500, -0.4800, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(55, 'NATGASUSD', 'Natural Gas vs US Dollar', 5, 'NATGAS', 'USD', 0.00100000, 100000.0000, 0.0100, 25.0000, 0.0100, 10000.0000, 3.0000, 'floating', 0.0080, 'per_lot', 0.0000, -1.0000, -0.6000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(56, 'COFFEEUSD', 'Coffee vs US Dollar', 5, 'COFFEE', 'USD', 0.01000000, 100000.0000, 0.0100, 20.0000, 0.0100, 37500.0000, 2.5000, 'floating', 0.1000, 'per_lot', 0.0000, -0.7000, -0.4000, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(57, 'CORNUSD', 'Corn vs US Dollar', 5, 'CORN', 'USD', 0.25000000, 100000.0000, 0.0100, 25.0000, 0.0100, 5000.0000, 2.5000, 'floating', 0.5000, 'per_lot', 0.0000, -0.6500, -0.3500, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30'),
(58, 'WHEATUSD', 'Wheat vs US Dollar', 5, 'WHEAT', 'USD', 0.25000000, 100000.0000, 0.0100, 25.0000, 0.0100, 5000.0000, 2.5000, 'floating', 0.5000, 'per_lot', 0.0000, -0.6800, -0.3800, 1, '2025-10-16 20:30:30', '2025-10-16 20:30:30');

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

CREATE TABLE `system_settings` (
  `id` int(11) NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `setting_type` enum('string','number','boolean','json') DEFAULT 'string',
  `description` text DEFAULT NULL,
  `is_public` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `category` varchar(50) DEFAULT 'general'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `system_settings`
--

INSERT INTO `system_settings` (`id`, `setting_key`, `setting_value`, `setting_type`, `description`, `is_public`, `created_at`, `updated_at`, `category`) VALUES
(1, 'platform_name', 'TradePro Platform', 'string', 'Name of the trading platform', 1, '2025-10-08 05:17:58', '2025-10-08 05:17:58', 'general'),
(2, 'default_leverage', '100', 'number', 'Default leverage for new accounts', 0, '2025-10-08 05:17:58', '2025-10-08 05:17:58', 'general'),
(3, 'max_leverage', '500', 'number', 'Maximum allowed leverage', 0, '2025-10-08 05:17:58', '2025-10-08 05:17:58', 'general'),
(4, 'margin_call_level', '50', 'number', 'Margin call level percentage', 0, '2025-10-08 05:17:58', '2025-10-08 05:17:58', 'general'),
(5, 'stop_out_level', '20', 'number', 'Stop out level percentage', 0, '2025-10-08 05:17:58', '2025-10-08 05:17:58', 'general'),
(6, 'min_deposit', '100', 'number', 'Minimum deposit amount in USD', 1, '2025-10-08 05:17:58', '2025-10-08 05:17:58', 'general'),
(7, 'maintenance_mode', 'false', 'boolean', 'Platform maintenance mode status', 1, '2025-10-08 05:17:58', '2025-10-08 05:17:58', 'general'),
(8, 'site_name', 'ForexTrade Pro', 'string', 'Website name', 1, '2025-10-09 05:35:56', '2025-10-09 05:35:56', 'general'),
(9, 'max_daily_withdrawal', '10000', 'number', 'Maximum daily withdrawal limit', 0, '2025-10-09 05:35:56', '2025-10-09 05:35:56', 'financial'),
(10, 'commission_rate_standard', '7.00', 'number', 'Standard commission rate per lot', 0, '2025-10-09 05:35:56', '2025-10-09 05:35:56', 'trading'),
(11, 'ib_default_commission', '0.70', 'number', 'Default IB commission rate', 0, '2025-10-09 05:35:56', '2025-10-09 05:35:56', 'ib');

-- --------------------------------------------------------

--
-- Table structure for table `trade_history`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `trading_accounts`
--

CREATE TABLE `trading_accounts` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `account_number` varchar(50) NOT NULL,
  `account_type` enum('live','islamic','professional') NOT NULL COMMENT 'Type of trading account',
  `is_demo` tinyint(1) DEFAULT 0 COMMENT 'Flag for demo vs live account',
  `currency` varchar(3) DEFAULT 'USD',
  `leverage` decimal(10,2) DEFAULT 1.00 COMMENT 'Current leverage ratio (e.g., 500 for 1:500)',
  `max_leverage` decimal(10,2) DEFAULT 100.00 COMMENT 'Maximum allowed leverage for this account',
  `trading_power` decimal(15,4) DEFAULT 0.0000 COMMENT 'Balance × Leverage = Available trading power',
  `balance` decimal(15,4) DEFAULT 0.0000 COMMENT 'Available cash balance',
  `equity` decimal(15,4) DEFAULT 0.0000 COMMENT 'Balance + Unrealized P&L',
  `used_margin` decimal(15,4) DEFAULT 0.0000,
  `free_margin` decimal(15,4) DEFAULT 0.0000 COMMENT 'Equity - Margin Used = Available for new positions',
  `margin_used` decimal(15,4) DEFAULT 0.0000 COMMENT 'Total margin currently used by open positions',
  `margin_level` decimal(8,2) DEFAULT 0.00 COMMENT '(Equity / Margin Used) × 100',
  `margin_call_level` decimal(5,2) DEFAULT 50.00 COMMENT 'Margin level % that triggers margin call warning',
  `stop_out_level` decimal(5,2) DEFAULT 20.00 COMMENT 'Margin level % that triggers automatic position closure',
  `status` enum('active','inactive','frozen','closed') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `min_margin_requirement` decimal(8,4) DEFAULT 1.0000 COMMENT 'Minimum margin requirement percentage'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `trading_accounts`
--

INSERT INTO `trading_accounts` (`id`, `user_id`, `account_number`, `account_type`, `is_demo`, `currency`, `leverage`, `max_leverage`, `trading_power`, `balance`, `equity`, `used_margin`, `free_margin`, `margin_used`, `margin_level`, `margin_call_level`, `stop_out_level`, `status`, `created_at`, `updated_at`, `min_margin_requirement`) VALUES
(8, 8, '1000000008', 'live', 0, 'USD', 500.00, 100.00, 0.0000, 0.0000, 0.0000, 0.0000, 0.0000, 0.0000, 0.00, 50.00, 20.00, 'active', '2025-10-17 06:31:18', '2025-10-17 06:31:18', 1.0000);

--
-- Triggers `trading_accounts`
--
DELIMITER $$
CREATE TRIGGER `account_balance_change_log` AFTER UPDATE ON `trading_accounts` FOR EACH ROW BEGIN
    IF OLD.balance != NEW.balance THEN
        INSERT INTO account_balance_history (
            account_id, previous_balance, new_balance, change_amount, 
            change_type, notes, created_at
        ) VALUES (
            NEW.id, OLD.balance, NEW.balance, NEW.balance - OLD.balance,
            'adjustment', 'Balance updated', NOW()
        );
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `trading_charges`
--

CREATE TABLE `trading_charges` (
  `id` int(11) NOT NULL,
  `symbol_id` int(11) DEFAULT NULL,
  `account_type` enum('demo','live','islamic') DEFAULT 'live',
  `charge_type` enum('commission','spread_markup','swap_long','swap_short') NOT NULL,
  `charge_value` decimal(10,4) NOT NULL,
  `charge_unit` enum('per_lot','percentage','fixed','pips') NOT NULL,
  `tier_level` enum('standard','gold','platinum','vip') DEFAULT 'standard',
  `is_active` tinyint(1) DEFAULT 1,
  `effective_from` timestamp NOT NULL DEFAULT current_timestamp(),
  `effective_until` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `trading_charges`
--

INSERT INTO `trading_charges` (`id`, `symbol_id`, `account_type`, `charge_type`, `charge_value`, `charge_unit`, `tier_level`, `is_active`, `effective_from`, `effective_until`, `created_at`, `updated_at`) VALUES
(1, NULL, NULL, 'commission', 7.0000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(2, NULL, NULL, 'commission', 5.0000, 'per_lot', '', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(3, NULL, NULL, 'commission', 3.0000, 'per_lot', 'vip', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(4, NULL, NULL, 'commission', 2.0000, 'per_lot', '', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(5, NULL, NULL, '', 2.5000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(6, NULL, NULL, '', 2.0000, 'per_lot', '', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(7, NULL, NULL, '', 1.5000, 'per_lot', 'vip', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(8, NULL, NULL, '', 1.0000, 'per_lot', '', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(9, NULL, NULL, '', 1.0000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(10, NULL, NULL, '', 0.7500, 'per_lot', '', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(11, NULL, NULL, '', 0.5000, 'per_lot', 'vip', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(12, NULL, NULL, '', 0.2500, 'per_lot', '', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(13, 1, NULL, 'swap_long', -0.8000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(14, 2, NULL, 'swap_long', -1.2000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(15, 3, NULL, 'swap_long', 0.2000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(16, 4, NULL, 'swap_long', -2.5000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(17, 7, NULL, 'swap_long', -0.5000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(18, 8, NULL, 'swap_long', -0.4000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(20, 1, NULL, 'swap_short', 0.1000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(21, 2, NULL, 'swap_short', 0.3000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(22, 3, NULL, 'swap_short', -0.9000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(23, 4, NULL, 'swap_short', -1.8000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(24, 7, NULL, 'swap_short', -0.5000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(25, 8, NULL, 'swap_short', -0.4000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(27, 1, NULL, 'commission', 7.0000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(28, 2, NULL, 'commission', 7.0000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(29, 3, NULL, 'commission', 7.0000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(30, 4, NULL, 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(31, 5, NULL, 'commission', 0.2500, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(32, 6, NULL, 'commission', 0.2500, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(33, 7, NULL, 'commission', 10.0000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(34, 8, NULL, 'commission', 8.0000, 'per_lot', 'standard', 1, '2025-10-16 19:06:50', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50'),
(42, NULL, 'live', 'commission', 7.0000, 'per_lot', 'standard', 1, '2025-10-16 20:25:13', NULL, '2025-10-16 20:25:13', '2025-10-16 20:25:13'),
(43, NULL, 'live', '', 2.5000, 'per_lot', 'standard', 1, '2025-10-16 20:25:13', NULL, '2025-10-16 20:25:13', '2025-10-16 20:25:13'),
(44, NULL, 'live', '', 1.0000, 'per_lot', 'standard', 1, '2025-10-16 20:25:13', NULL, '2025-10-16 20:25:13', '2025-10-16 20:25:13'),
(45, NULL, 'live', 'commission', 7.0000, 'per_lot', 'standard', 1, '2025-10-16 20:26:07', NULL, '2025-10-16 20:26:07', '2025-10-16 20:26:07'),
(46, NULL, 'live', '', 2.5000, 'per_lot', 'standard', 1, '2025-10-16 20:26:07', NULL, '2025-10-16 20:26:07', '2025-10-16 20:26:07'),
(47, NULL, 'live', '', 1.0000, 'per_lot', 'standard', 1, '2025-10-16 20:26:07', NULL, '2025-10-16 20:26:07', '2025-10-16 20:26:07');

-- --------------------------------------------------------

--
-- Stand-in structure for view `trading_performance`
-- (See below for the actual view)
--
CREATE TABLE `trading_performance` (
`account_id` int(11)
,`total_trades` bigint(21)
,`winning_trades` decimal(22,0)
,`losing_trades` decimal(22,0)
,`win_rate` decimal(28,2)
,`total_profit_loss` decimal(34,4)
,`average_profit_loss` decimal(16,8)
,`best_trade` decimal(12,4)
,`worst_trade` decimal(12,4)
,`total_commission` decimal(32,4)
,`total_swap` decimal(32,4)
);

-- --------------------------------------------------------

--
-- Table structure for table `trading_sessions`
--

CREATE TABLE `trading_sessions` (
  `id` int(11) NOT NULL,
  `symbol_id` int(11) NOT NULL,
  `session_name` varchar(50) NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `days_of_week` varchar(7) NOT NULL,
  `timezone` varchar(50) DEFAULT 'UTC',
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `transactions`
--

CREATE TABLE `transactions` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `account_id` int(11) DEFAULT NULL,
  `type` enum('deposit','withdrawal','transfer','commission','swap','profit','loss') NOT NULL,
  `amount` decimal(15,4) NOT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'USD',
  `status` enum('pending','completed','failed','cancelled') DEFAULT 'pending',
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `payment_gateway_id` int(11) DEFAULT NULL,
  `transaction_fee` decimal(15,4) DEFAULT 0.0000,
  `exchange_rate` decimal(12,6) DEFAULT 1.000000,
  `reference_number` varchar(100) DEFAULT NULL,
  `external_transaction_id` varchar(200) DEFAULT NULL,
  `admin_notes` text DEFAULT NULL,
  `processed_by` int(11) DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `batch_id` int(11) DEFAULT NULL,
  `priority` enum('low','normal','high','urgent') DEFAULT 'normal',
  `notification_sent` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `uuid` varchar(36) NOT NULL,
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
  `last_login` timestamp NULL DEFAULT NULL,
  `country` varchar(3) DEFAULT NULL,
  `preferred_currency` varchar(3) DEFAULT 'USD',
  `preferred_leverage` decimal(10,2) DEFAULT 100.00,
  `phone_country_code` varchar(5) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `gender` enum('male','female','other') DEFAULT NULL,
  `occupation` varchar(100) DEFAULT NULL,
  `experience_level` enum('beginner','intermediate','expert') DEFAULT 'beginner',
  `annual_income_range` enum('0-25k','25k-50k','50k-100k','100k-250k','250k+') DEFAULT NULL,
  `trading_experience_years` int(11) DEFAULT 0,
  `risk_tolerance` enum('low','medium','high') DEFAULT 'medium',
  `investment_goals` text DEFAULT NULL,
  `kyc_submitted_at` timestamp NULL DEFAULT NULL,
  `kyc_approved_at` timestamp NULL DEFAULT NULL,
  `kyc_rejection_reason` text DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `uuid`, `email`, `password_hash`, `first_name`, `last_name`, `phone`, `date_of_birth`, `avatar_url`, `bio`, `status`, `email_verified`, `phone_verified`, `kyc_status`, `created_at`, `updated_at`, `last_login`, `country`, `preferred_currency`, `preferred_leverage`, `phone_country_code`, `address`, `city`, `postal_code`, `gender`, `occupation`, `experience_level`, `annual_income_range`, `trading_experience_years`, `risk_tolerance`, `investment_goals`, `kyc_submitted_at`, `kyc_approved_at`, `kyc_rejection_reason`, `phone_number`, `state`) VALUES
(1, '1d6a5333-a823-11f0-94f1-346f24999f50', 'admin@tradingplatform.com', '$2a$10$zWQbYqHxLchM8D6Iw.dhfe8W96o4KAGHLKcJySq00O3hPKJGlPoMq', 'System', 'Administrator', NULL, NULL, NULL, NULL, 'active', 1, 1, 'approved', '2025-10-13 10:55:21', '2025-10-17 04:03:21', '2025-10-17 04:03:21', NULL, 'USD', 100.00, NULL, NULL, NULL, NULL, NULL, NULL, 'beginner', NULL, 0, 'medium', NULL, NULL, NULL, NULL, NULL, NULL),
(8, 'e3a7da0b-ab22-11f0-85be-346f24999f50', 'prabhat@ssipmt.com', '$2a$12$NNX/NdY0haolO/KYvDc/vuFUCiVQxo2ZdWsjqgiWa2Ry9etcrGVYC', 'Prabhat', 'chaubey', '+9707000901447', NULL, NULL, NULL, 'active', 0, 0, 'pending', '2025-10-17 06:31:18', '2025-10-17 06:58:32', '2025-10-17 06:58:32', NULL, 'USD', 500.00, NULL, NULL, NULL, NULL, NULL, NULL, 'beginner', NULL, 0, 'medium', NULL, NULL, NULL, NULL, NULL, NULL);

--
-- Triggers `users`
--
DELIMITER $$
CREATE TRIGGER `user_updated_timestamp` BEFORE UPDATE ON `users` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Stand-in structure for view `user_account_summary`
-- (See below for the actual view)
--
CREATE TABLE `user_account_summary` (
`user_id` int(11)
,`first_name` varchar(100)
,`last_name` varchar(100)
,`email` varchar(255)
,`user_status` enum('active','inactive','suspended','pending_verification')
,`account_id` int(11)
,`account_number` varchar(50)
,`account_type` enum('live','islamic','professional')
,`currency` varchar(3)
,`balance` decimal(15,4)
,`equity` decimal(15,4)
,`free_margin` decimal(15,4)
,`account_status` enum('active','inactive','frozen','closed')
,`open_positions` bigint(21)
,`total_unrealized_pnl` decimal(34,4)
);

-- --------------------------------------------------------

--
-- Table structure for table `user_activity_log`
--

CREATE TABLE `user_activity_log` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `action_type` enum('password_change','kyc_submit','kyc_update','bank_add','bank_update','bank_delete') NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_addresses`
--

CREATE TABLE `user_addresses` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `type` enum('billing','mailing','both') DEFAULT 'both',
  `address_line_1` varchar(255) NOT NULL,
  `address_line_2` varchar(255) DEFAULT NULL,
  `city` varchar(100) NOT NULL,
  `state_province` varchar(100) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `country_code` varchar(3) NOT NULL,
  `is_primary` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_notifications`
--

CREATE TABLE `user_notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `template_id` int(11) DEFAULT NULL,
  `type` enum('email','sms','push','in_app') NOT NULL,
  `title` varchar(500) DEFAULT NULL,
  `message` text NOT NULL,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`data`)),
  `status` enum('pending','sent','delivered','failed','read') DEFAULT 'pending',
  `sent_at` timestamp NULL DEFAULT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_roles`
--

CREATE TABLE `user_roles` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `assigned_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_roles`
--

INSERT INTO `user_roles` (`id`, `user_id`, `role_id`, `assigned_at`, `assigned_by`) VALUES
(1, 1, 1, '2025-10-13 10:55:21', 1),
(2, 1, 2, '2025-10-13 10:55:21', 1);

-- --------------------------------------------------------

--
-- Table structure for table `user_settings`
--

CREATE TABLE `user_settings` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_tier_assignments`
--

CREATE TABLE `user_tier_assignments` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `tier_level` enum('standard','premium','vip','professional') NOT NULL DEFAULT 'standard',
  `assigned_by` int(11) DEFAULT NULL COMMENT 'Admin user who assigned this tier',
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `effective_from` timestamp NOT NULL DEFAULT current_timestamp(),
  `effective_until` timestamp NULL DEFAULT NULL COMMENT 'Tier expiry date (NULL = permanent)',
  `reason` text DEFAULT NULL COMMENT 'Why this tier was assigned',
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Track user tier assignments for preferential pricing';

--
-- Dumping data for table `user_tier_assignments`
--

INSERT INTO `user_tier_assignments` (`id`, `user_id`, `tier_level`, `assigned_by`, `assigned_at`, `effective_from`, `effective_until`, `reason`, `is_active`) VALUES
(1, 1, 'standard', NULL, '2025-10-16 19:06:50', '2025-10-16 19:06:50', NULL, NULL, 1);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_daily_swap_summary`
-- (See below for the actual view)
--
CREATE TABLE `v_daily_swap_summary` (
`charge_date` date
,`positions_charged` bigint(21)
,`total_swap_charges` decimal(32,4)
,`avg_swap_charge` decimal(14,8)
,`triple_swap_total` decimal(32,4)
,`triple_swap_positions` bigint(21)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_effective_charges`
-- (See below for the actual view)
--
CREATE TABLE `v_effective_charges` (
`id` int(11)
,`symbol` varchar(20)
,`account_type` varchar(7)
,`tier_level` enum('standard','gold','platinum','vip')
,`charge_type` enum('commission','spread_markup','swap_long','swap_short')
,`charge_value` decimal(10,4)
,`charge_unit` enum('per_lot','percentage','fixed','pips')
,`is_active` tinyint(1)
,`effective_from` timestamp
,`effective_until` timestamp
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_ib_commission_summary`
-- (See below for the actual view)
--
CREATE TABLE `v_ib_commission_summary` (
`ib_id` int(11)
,`ib_user_id` int(11)
,`ib_email` varchar(255)
,`first_name` varchar(100)
,`last_name` varchar(100)
,`ib_share_percent` decimal(5,2)
,`total_trades` bigint(21)
,`total_volume` decimal(37,4)
,`total_commission` decimal(37,4)
,`total_ib_earnings` decimal(37,4)
,`total_admin_earnings` decimal(37,4)
,`ib_status` enum('active','inactive','suspended')
,`last_commission_date` timestamp
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_recent_margin_events`
-- (See below for the actual view)
--
CREATE TABLE `v_recent_margin_events` (
`id` int(11)
,`account_id` int(11)
,`account_number` varchar(50)
,`user_email` varchar(255)
,`first_name` varchar(100)
,`last_name` varchar(100)
,`event_type` enum('margin_call','stop_out','margin_warning')
,`margin_level` decimal(8,2)
,`equity` decimal(15,4)
,`margin_used` decimal(15,4)
,`free_margin` decimal(15,4)
,`positions_closed` int(11)
,`total_loss` decimal(15,4)
,`notification_sent` tinyint(1)
,`resolved` tinyint(1)
,`resolved_at` timestamp
,`created_at` timestamp
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_unresolved_margin_issues`
-- (See below for the actual view)
--
CREATE TABLE `v_unresolved_margin_issues` (
`id` int(11)
,`account_id` int(11)
,`account_number` varchar(50)
,`email` varchar(255)
,`event_type` enum('margin_call','stop_out','margin_warning')
,`margin_level` decimal(8,2)
,`created_at` timestamp
,`minutes_unresolved` bigint(21)
);

-- --------------------------------------------------------

--
-- Table structure for table `withdrawals`
--

CREATE TABLE `withdrawals` (
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

-- --------------------------------------------------------

--
-- Structure for view `daily_trading_volume`
--
DROP TABLE IF EXISTS `daily_trading_volume`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `daily_trading_volume`  AS SELECT cast(`th`.`closed_at` as date) AS `trade_date`, `s`.`symbol` AS `symbol`, count(0) AS `trades_count`, sum(`th`.`lot_size`) AS `total_volume`, sum(`th`.`profit`) AS `daily_pnl` FROM (`trade_history` `th` join `symbols` `s` on(`th`.`symbol_id` = `s`.`id`)) GROUP BY cast(`th`.`closed_at` as date), `s`.`symbol` ORDER BY cast(`th`.`closed_at` as date) DESC, sum(`th`.`lot_size`) DESC ;

-- --------------------------------------------------------

--
-- Structure for view `pending_transactions`
--
DROP TABLE IF EXISTS `pending_transactions`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `pending_transactions`  AS SELECT 'deposit' AS `transaction_type`, `d`.`id` AS `id`, `d`.`user_id` AS `user_id`, `u`.`first_name` AS `first_name`, `u`.`last_name` AS `last_name`, `d`.`amount` AS `amount`, `d`.`currency` AS `currency`, `d`.`status` AS `status`, `d`.`created_at` AS `created_at`, `pm`.`name` AS `payment_method` FROM ((`deposits` `d` join `users` `u` on(`d`.`user_id` = `u`.`id`)) join `payment_methods` `pm` on(`d`.`payment_method_id` = `pm`.`id`)) WHERE `d`.`status` in ('pending','processing')union all select 'withdrawal' AS `transaction_type`,`w`.`id` AS `id`,`w`.`user_id` AS `user_id`,`u`.`first_name` AS `first_name`,`u`.`last_name` AS `last_name`,`w`.`amount` AS `amount`,`w`.`currency` AS `currency`,`w`.`status` AS `status`,`w`.`created_at` AS `created_at`,`pm`.`name` AS `payment_method` from ((`withdrawals` `w` join `users` `u` on(`w`.`user_id` = `u`.`id`)) join `payment_methods` `pm` on(`w`.`payment_method_id` = `pm`.`id`)) where `w`.`status` in ('pending','processing') order by `created_at` desc  ;

-- --------------------------------------------------------

--
-- Structure for view `trading_performance`
--
DROP TABLE IF EXISTS `trading_performance`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `trading_performance`  AS SELECT `th`.`account_id` AS `account_id`, count(0) AS `total_trades`, sum(case when `th`.`profit` > 0 then 1 else 0 end) AS `winning_trades`, sum(case when `th`.`profit` < 0 then 1 else 0 end) AS `losing_trades`, round(sum(case when `th`.`profit` > 0 then 1 else 0 end) / count(0) * 100,2) AS `win_rate`, sum(`th`.`profit`) AS `total_profit_loss`, avg(`th`.`profit`) AS `average_profit_loss`, max(`th`.`profit`) AS `best_trade`, min(`th`.`profit`) AS `worst_trade`, sum(`th`.`commission`) AS `total_commission`, sum(`th`.`swap`) AS `total_swap` FROM `trade_history` AS `th` GROUP BY `th`.`account_id` ;

-- --------------------------------------------------------

--
-- Structure for view `user_account_summary`
--
DROP TABLE IF EXISTS `user_account_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `user_account_summary`  AS SELECT `u`.`id` AS `user_id`, `u`.`first_name` AS `first_name`, `u`.`last_name` AS `last_name`, `u`.`email` AS `email`, `u`.`status` AS `user_status`, `ta`.`id` AS `account_id`, `ta`.`account_number` AS `account_number`, `ta`.`account_type` AS `account_type`, `ta`.`currency` AS `currency`, `ta`.`balance` AS `balance`, `ta`.`equity` AS `equity`, `ta`.`free_margin` AS `free_margin`, `ta`.`status` AS `account_status`, count(`p`.`id`) AS `open_positions`, coalesce(sum(`p`.`profit`),0) AS `total_unrealized_pnl` FROM ((`users` `u` left join `trading_accounts` `ta` on(`u`.`id` = `ta`.`user_id`)) left join `positions` `p` on(`ta`.`id` = `p`.`account_id` and `p`.`status` = 'open')) GROUP BY `u`.`id`, `ta`.`id` ;

-- --------------------------------------------------------

--
-- Structure for view `v_daily_swap_summary`
--
DROP TABLE IF EXISTS `v_daily_swap_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_daily_swap_summary`  AS SELECT `scl`.`charge_date` AS `charge_date`, count(distinct `scl`.`position_id`) AS `positions_charged`, sum(`scl`.`swap_amount`) AS `total_swap_charges`, avg(`scl`.`swap_amount`) AS `avg_swap_charge`, sum(case when `scl`.`is_triple_swap` then `scl`.`swap_amount` else 0 end) AS `triple_swap_total`, count(case when `scl`.`is_triple_swap` then 1 end) AS `triple_swap_positions` FROM `swap_charges_log` AS `scl` GROUP BY `scl`.`charge_date` ORDER BY `scl`.`charge_date` DESC ;

-- --------------------------------------------------------

--
-- Structure for view `v_effective_charges`
--
DROP TABLE IF EXISTS `v_effective_charges`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_effective_charges`  AS SELECT `tc`.`id` AS `id`, coalesce(`s`.`symbol`,'GLOBAL') AS `symbol`, coalesce(`tc`.`account_type`,'ALL') AS `account_type`, `tc`.`tier_level` AS `tier_level`, `tc`.`charge_type` AS `charge_type`, `tc`.`charge_value` AS `charge_value`, `tc`.`charge_unit` AS `charge_unit`, `tc`.`is_active` AS `is_active`, `tc`.`effective_from` AS `effective_from`, `tc`.`effective_until` AS `effective_until` FROM (`trading_charges` `tc` left join `symbols` `s` on(`tc`.`symbol_id` = `s`.`id`)) WHERE `tc`.`is_active` = 1 AND (`tc`.`effective_from` is null OR `tc`.`effective_from` <= current_timestamp()) AND (`tc`.`effective_until` is null OR `tc`.`effective_until` >= current_timestamp()) ;

-- --------------------------------------------------------

--
-- Structure for view `v_ib_commission_summary`
--
DROP TABLE IF EXISTS `v_ib_commission_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_ib_commission_summary`  AS SELECT `ib`.`id` AS `ib_id`, `ib`.`ib_user_id` AS `ib_user_id`, `u`.`email` AS `ib_email`, `u`.`first_name` AS `first_name`, `u`.`last_name` AS `last_name`, `ib`.`ib_share_percent` AS `ib_share_percent`, count(`ic`.`id`) AS `total_trades`, sum(`ic`.`trade_volume`) AS `total_volume`, sum(`ic`.`total_commission`) AS `total_commission`, sum(`ic`.`ib_amount`) AS `total_ib_earnings`, sum(`ic`.`admin_amount`) AS `total_admin_earnings`, `ib`.`status` AS `ib_status`, `ib`.`last_commission_date` AS `last_commission_date` FROM ((`introducing_brokers` `ib` join `users` `u` on(`ib`.`ib_user_id` = `u`.`id`)) left join `ib_commissions` `ic` on(`ic`.`ib_relationship_id` = `ib`.`id`)) GROUP BY `ib`.`id`, `ib`.`ib_user_id`, `u`.`email`, `u`.`first_name`, `u`.`last_name`, `ib`.`ib_share_percent`, `ib`.`status`, `ib`.`last_commission_date` ;

-- --------------------------------------------------------

--
-- Structure for view `v_recent_margin_events`
--
DROP TABLE IF EXISTS `v_recent_margin_events`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_recent_margin_events`  AS SELECT `me`.`id` AS `id`, `me`.`account_id` AS `account_id`, `ta`.`account_number` AS `account_number`, `u`.`email` AS `user_email`, `u`.`first_name` AS `first_name`, `u`.`last_name` AS `last_name`, `me`.`event_type` AS `event_type`, `me`.`margin_level` AS `margin_level`, `me`.`equity` AS `equity`, `me`.`margin_used` AS `margin_used`, `me`.`free_margin` AS `free_margin`, `me`.`positions_closed` AS `positions_closed`, `me`.`total_loss` AS `total_loss`, `me`.`notification_sent` AS `notification_sent`, `me`.`resolved` AS `resolved`, `me`.`resolved_at` AS `resolved_at`, `me`.`created_at` AS `created_at` FROM ((`margin_events` `me` join `trading_accounts` `ta` on(`me`.`account_id` = `ta`.`id`)) join `users` `u` on(`ta`.`user_id` = `u`.`id`)) ORDER BY `me`.`created_at` DESC ;

-- --------------------------------------------------------

--
-- Structure for view `v_unresolved_margin_issues`
--
DROP TABLE IF EXISTS `v_unresolved_margin_issues`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_unresolved_margin_issues`  AS SELECT `me`.`id` AS `id`, `me`.`account_id` AS `account_id`, `ta`.`account_number` AS `account_number`, `u`.`email` AS `email`, `me`.`event_type` AS `event_type`, `me`.`margin_level` AS `margin_level`, `me`.`created_at` AS `created_at`, timestampdiff(MINUTE,`me`.`created_at`,current_timestamp()) AS `minutes_unresolved` FROM ((`margin_events` `me` join `trading_accounts` `ta` on(`me`.`account_id` = `ta`.`id`)) join `users` `u` on(`ta`.`user_id` = `u`.`id`)) WHERE `me`.`resolved` = 0 ORDER BY `me`.`created_at` ASC ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `account_balance_history`
--
ALTER TABLE `account_balance_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_account_id` (`account_id`),
  ADD KEY `idx_change_type` (`change_type`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `admin_actions`
--
ALTER TABLE `admin_actions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_admin_user` (`admin_user_id`),
  ADD KEY `idx_target_user` (`target_user_id`),
  ADD KEY `idx_action_type` (`action_type`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `api_keys`
--
ALTER TABLE `api_keys`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `api_key` (`api_key`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_api_key` (`api_key`),
  ADD KEY `idx_active` (`is_active`),
  ADD KEY `idx_expires_at` (`expires_at`);

--
-- Indexes for table `api_usage_logs`
--
ALTER TABLE `api_usage_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_api_key_id` (`api_key_id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_endpoint` (`endpoint`);

--
-- Indexes for table `asset_categories`
--
ALTER TABLE `asset_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_action` (`action`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_table_record` (`table_name`,`record_id`);

--
-- Indexes for table `bank_details`
--
ALTER TABLE `bank_details`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_account` (`user_id`,`account_number`),
  ADD KEY `verified_by` (`verified_by`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_is_primary` (`is_primary`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `deposits`
--
ALTER TABLE `deposits`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `transaction_id` (`transaction_id`),
  ADD KEY `payment_method_id` (`payment_method_id`),
  ADD KEY `processed_by` (`processed_by`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_account_id` (`account_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_transaction_id` (`transaction_id`),
  ADD KEY `idx_deposits_user_status` (`user_id`,`status`);

--
-- Indexes for table `ib_applications`
--
ALTER TABLE `ib_applications`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_user` (`user_id`);

--
-- Indexes for table `ib_commissions`
--
ALTER TABLE `ib_commissions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ib_relationship` (`ib_relationship_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_paid_at` (`paid_at`);

--
-- Indexes for table `ib_global_settings`
--
ALTER TABLE `ib_global_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `setting_key` (`setting_key`),
  ADD KEY `idx_setting_key` (`setting_key`),
  ADD KEY `idx_is_active` (`is_active`);

--
-- Indexes for table `introducing_brokers`
--
ALTER TABLE `introducing_brokers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `referral_code` (`referral_code`),
  ADD UNIQUE KEY `unique_ib_client` (`ib_user_id`,`client_user_id`),
  ADD KEY `idx_ib_user` (`ib_user_id`),
  ADD KEY `idx_client_user` (`client_user_id`),
  ADD KEY `idx_referral_code` (`referral_code`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `kyc_documents`
--
ALTER TABLE `kyc_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `verified_by` (`verified_by`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_document_type` (`document_type`);

--
-- Indexes for table `mam_pamm_investors`
--
ALTER TABLE `mam_pamm_investors`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_master_investor` (`master_id`,`account_id`),
  ADD KEY `account_id` (`account_id`),
  ADD KEY `idx_master_id` (`master_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `mam_pamm_masters`
--
ALTER TABLE `mam_pamm_masters`
  ADD PRIMARY KEY (`id`),
  ADD KEY `account_id` (`account_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_management_type` (`management_type`);

--
-- Indexes for table `mam_pamm_performance`
--
ALTER TABLE `mam_pamm_performance`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_master_period` (`master_id`,`period_start`,`period_end`),
  ADD KEY `idx_master_id` (`master_id`),
  ADD KEY `idx_period` (`period_start`,`period_end`);

--
-- Indexes for table `margin_events`
--
ALTER TABLE `margin_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_account_event` (`account_id`,`event_type`),
  ADD KEY `idx_resolved` (`resolved`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_event_type` (`event_type`);

--
-- Indexes for table `market_data`
--
ALTER TABLE `market_data`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_symbol_date` (`symbol_id`,`date`),
  ADD KEY `idx_symbol_id` (`symbol_id`),
  ADD KEY `idx_date` (`date`),
  ADD KEY `idx_symbol_date` (`symbol_id`,`date`);

--
-- Indexes for table `market_prices`
--
ALTER TABLE `market_prices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_symbol_id` (`symbol_id`),
  ADD KEY `idx_timestamp` (`timestamp`),
  ADD KEY `idx_symbol_timestamp` (`symbol_id`,`timestamp`),
  ADD KEY `idx_market_prices_symbol_timestamp` (`symbol_id`,`timestamp`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `migration_name` (`migration_name`),
  ADD KEY `idx_migration_name` (`migration_name`),
  ADD KEY `idx_executed_at` (`executed_at`);

--
-- Indexes for table `notification_templates`
--
ALTER TABLE `notification_templates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD KEY `idx_name` (`name`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_active` (`is_active`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_account_id` (`account_id`),
  ADD KEY `idx_symbol_id` (`symbol_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_token` (`token`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_expires_at` (`expires_at`);

--
-- Indexes for table `payment_gateways`
--
ALTER TABLE `payment_gateways`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_name` (`name`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_active` (`is_active`),
  ADD KEY `idx_sort_order` (`sort_order`);

--
-- Indexes for table `payment_methods`
--
ALTER TABLE `payment_methods`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_active` (`is_active`);

--
-- Indexes for table `positions`
--
ALTER TABLE `positions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `idx_account_id` (`account_id`),
  ADD KEY `idx_symbol_id` (`symbol_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_opened_at` (`opened_at`),
  ADD KEY `idx_position_account_status` (`account_id`,`status`),
  ADD KEY `idx_positions_account_status` (`account_id`,`status`),
  ADD KEY `idx_positions_closed_at` (`closed_at`),
  ADD KEY `idx_positions_close_reason` (`close_reason`),
  ADD KEY `idx_positions_close_time` (`close_time`),
  ADD KEY `idx_is_triggered` (`is_triggered`),
  ADD KEY `idx_days_held` (`days_held`),
  ADD KEY `idx_margin_required` (`margin_required`);

--
-- Indexes for table `position_state_history`
--
ALTER TABLE `position_state_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `changed_by` (`changed_by`),
  ADD KEY `idx_position` (`position_id`),
  ADD KEY `idx_state_type` (`state_type`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `price_alerts`
--
ALTER TABLE `price_alerts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_symbol_id` (`symbol_id`),
  ADD KEY `idx_active` (`is_active`),
  ADD KEY `idx_triggered` (`is_triggered`);

--
-- Indexes for table `price_history`
--
ALTER TABLE `price_history`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_symbol_timeframe_time` (`symbol_id`,`timeframe`,`timestamp`),
  ADD KEY `idx_symbol_timeframe` (`symbol_id`,`timeframe`),
  ADD KEY `idx_timestamp` (`timestamp`);

--
-- Indexes for table `referral_codes`
--
ALTER TABLE `referral_codes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_code` (`code`),
  ADD KEY `idx_active` (`is_active`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `support_categories`
--
ALTER TABLE `support_categories`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `support_responses`
--
ALTER TABLE `support_responses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_ticket_id` (`ticket_id`),
  ADD KEY `idx_created_at` (`created_at`);
ALTER TABLE `support_responses` ADD FULLTEXT KEY `message` (`message`);
ALTER TABLE `support_responses` ADD FULLTEXT KEY `message_2` (`message`);

--
-- Indexes for table `support_tickets`
--
ALTER TABLE `support_tickets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ticket_number` (`ticket_number`),
  ADD KEY `category_id` (`category_id`),
  ADD KEY `assigned_to` (`assigned_to`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_priority` (`priority`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_ticket_number` (`ticket_number`),
  ADD KEY `idx_support_tickets_user_status` (`user_id`,`status`);
ALTER TABLE `support_tickets` ADD FULLTEXT KEY `subject` (`subject`,`description`);

--
-- Indexes for table `support_ticket_messages`
--
ALTER TABLE `support_ticket_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ticket_id` (`ticket_id`),
  ADD KEY `idx_sender_id` (`sender_id`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `swap_charges_log`
--
ALTER TABLE `swap_charges_log`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_position_date` (`position_id`,`charge_date`),
  ADD KEY `idx_position` (`position_id`),
  ADD KEY `idx_charge_date` (`charge_date`),
  ADD KEY `idx_triple_swap` (`is_triple_swap`);

--
-- Indexes for table `symbols`
--
ALTER TABLE `symbols`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `symbol` (`symbol`),
  ADD KEY `idx_symbol` (`symbol`),
  ADD KEY `idx_category` (`category_id`),
  ADD KEY `idx_active` (`is_active`);

--
-- Indexes for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `setting_key` (`setting_key`),
  ADD KEY `idx_setting_key` (`setting_key`),
  ADD KEY `idx_is_public` (`is_public`);

--
-- Indexes for table `trade_history`
--
ALTER TABLE `trade_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `position_id` (`position_id`),
  ADD KEY `idx_account_id` (`account_id`),
  ADD KEY `idx_symbol_id` (`symbol_id`),
  ADD KEY `idx_profit` (`profit`),
  ADD KEY `idx_closed_at` (`closed_at`),
  ADD KEY `idx_opened_at` (`opened_at`),
  ADD KEY `idx_trade_history_account_date` (`account_id`,`closed_at`);

--
-- Indexes for table `trading_accounts`
--
ALTER TABLE `trading_accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `account_number` (`account_number`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_account_number` (`account_number`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_account_user_type` (`user_id`,`account_type`),
  ADD KEY `idx_trading_accounts_user_status` (`user_id`,`status`),
  ADD KEY `idx_margin_level` (`margin_level`) COMMENT 'Fast lookup for margin monitoring',
  ADD KEY `idx_is_demo` (`is_demo`) COMMENT 'Separate demo from live accounts',
  ADD KEY `idx_margin_used` (`margin_used`) COMMENT 'Quick access to accounts with used margin';

--
-- Indexes for table `trading_charges`
--
ALTER TABLE `trading_charges`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_symbol` (`symbol_id`),
  ADD KEY `idx_type` (`charge_type`),
  ADD KEY `idx_tier` (`tier_level`),
  ADD KEY `idx_active` (`is_active`),
  ADD KEY `idx_effective` (`effective_from`,`effective_until`);

--
-- Indexes for table `trading_sessions`
--
ALTER TABLE `trading_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_symbol_id` (`symbol_id`),
  ADD KEY `idx_active` (`is_active`);

--
-- Indexes for table `transactions`
--
ALTER TABLE `transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_account_id` (`account_id`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_transactions_user_status` (`user_id`,`status`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uuid` (`uuid`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_user_email_status` (`email`,`status`),
  ADD KEY `idx_users_status_created` (`status`,`created_at`);

--
-- Indexes for table `user_activity_log`
--
ALTER TABLE `user_activity_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_action_type` (`action_type`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `user_addresses`
--
ALTER TABLE `user_addresses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_country` (`country_code`);

--
-- Indexes for table `user_notifications`
--
ALTER TABLE `user_notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `template_id` (`template_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_role` (`user_id`,`role_id`),
  ADD KEY `assigned_by` (`assigned_by`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_role_id` (`role_id`);

--
-- Indexes for table `user_settings`
--
ALTER TABLE `user_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_setting` (`user_id`,`setting_key`),
  ADD KEY `idx_user_id` (`user_id`);

--
-- Indexes for table `user_tier_assignments`
--
ALTER TABLE `user_tier_assignments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_active_tier` (`user_id`,`is_active`),
  ADD KEY `assigned_by` (`assigned_by`),
  ADD KEY `idx_user_tier` (`user_id`,`tier_level`),
  ADD KEY `idx_active` (`is_active`),
  ADD KEY `idx_effective_dates` (`effective_from`,`effective_until`);

--
-- Indexes for table `withdrawals`
--
ALTER TABLE `withdrawals`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `transaction_id` (`transaction_id`),
  ADD KEY `payment_method_id` (`payment_method_id`),
  ADD KEY `processed_by` (`processed_by`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_account_id` (`account_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_transaction_id` (`transaction_id`),
  ADD KEY `idx_withdrawals_user_status` (`user_id`,`status`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `account_balance_history`
--
ALTER TABLE `account_balance_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=56;

--
-- AUTO_INCREMENT for table `admin_actions`
--
ALTER TABLE `admin_actions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `api_keys`
--
ALTER TABLE `api_keys`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `api_usage_logs`
--
ALTER TABLE `api_usage_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `asset_categories`
--
ALTER TABLE `asset_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `bank_details`
--
ALTER TABLE `bank_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `deposits`
--
ALTER TABLE `deposits`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ib_applications`
--
ALTER TABLE `ib_applications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `ib_commissions`
--
ALTER TABLE `ib_commissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `ib_global_settings`
--
ALTER TABLE `ib_global_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `introducing_brokers`
--
ALTER TABLE `introducing_brokers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `kyc_documents`
--
ALTER TABLE `kyc_documents`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `mam_pamm_investors`
--
ALTER TABLE `mam_pamm_investors`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `mam_pamm_masters`
--
ALTER TABLE `mam_pamm_masters`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `mam_pamm_performance`
--
ALTER TABLE `mam_pamm_performance`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `margin_events`
--
ALTER TABLE `margin_events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `market_data`
--
ALTER TABLE `market_data`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `market_prices`
--
ALTER TABLE `market_prices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=469497;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `notification_templates`
--
ALTER TABLE `notification_templates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payment_gateways`
--
ALTER TABLE `payment_gateways`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `payment_methods`
--
ALTER TABLE `payment_methods`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `positions`
--
ALTER TABLE `positions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `position_state_history`
--
ALTER TABLE `position_state_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `price_alerts`
--
ALTER TABLE `price_alerts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `price_history`
--
ALTER TABLE `price_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `referral_codes`
--
ALTER TABLE `referral_codes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `support_categories`
--
ALTER TABLE `support_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `support_responses`
--
ALTER TABLE `support_responses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `support_tickets`
--
ALTER TABLE `support_tickets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `support_ticket_messages`
--
ALTER TABLE `support_ticket_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `swap_charges_log`
--
ALTER TABLE `swap_charges_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `symbols`
--
ALTER TABLE `symbols`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=59;

--
-- AUTO_INCREMENT for table `system_settings`
--
ALTER TABLE `system_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `trade_history`
--
ALTER TABLE `trade_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `trading_accounts`
--
ALTER TABLE `trading_accounts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `trading_charges`
--
ALTER TABLE `trading_charges`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=48;

--
-- AUTO_INCREMENT for table `trading_sessions`
--
ALTER TABLE `trading_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `user_activity_log`
--
ALTER TABLE `user_activity_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_addresses`
--
ALTER TABLE `user_addresses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_notifications`
--
ALTER TABLE `user_notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `user_roles`
--
ALTER TABLE `user_roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `user_settings`
--
ALTER TABLE `user_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_tier_assignments`
--
ALTER TABLE `user_tier_assignments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `withdrawals`
--
ALTER TABLE `withdrawals`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `account_balance_history`
--
ALTER TABLE `account_balance_history`
  ADD CONSTRAINT `account_balance_history_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `trading_accounts` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `admin_actions`
--
ALTER TABLE `admin_actions`
  ADD CONSTRAINT `admin_actions_ibfk_1` FOREIGN KEY (`admin_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `admin_actions_ibfk_2` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `api_keys`
--
ALTER TABLE `api_keys`
  ADD CONSTRAINT `api_keys_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `api_usage_logs`
--
ALTER TABLE `api_usage_logs`
  ADD CONSTRAINT `api_usage_logs_ibfk_1` FOREIGN KEY (`api_key_id`) REFERENCES `api_keys` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `bank_details`
--
ALTER TABLE `bank_details`
  ADD CONSTRAINT `bank_details_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `bank_details_ibfk_2` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `deposits`
--
ALTER TABLE `deposits`
  ADD CONSTRAINT `deposits_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `deposits_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `trading_accounts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `deposits_ibfk_3` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`),
  ADD CONSTRAINT `deposits_ibfk_4` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `ib_applications`
--
ALTER TABLE `ib_applications`
  ADD CONSTRAINT `ib_applications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `ib_commissions`
--
ALTER TABLE `ib_commissions`
  ADD CONSTRAINT `ib_commissions_ibfk_1` FOREIGN KEY (`ib_relationship_id`) REFERENCES `introducing_brokers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `introducing_brokers`
--
ALTER TABLE `introducing_brokers`
  ADD CONSTRAINT `introducing_brokers_ibfk_1` FOREIGN KEY (`ib_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `introducing_brokers_ibfk_2` FOREIGN KEY (`client_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `kyc_documents`
--
ALTER TABLE `kyc_documents`
  ADD CONSTRAINT `kyc_documents_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `kyc_documents_ibfk_2` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `mam_pamm_investors`
--
ALTER TABLE `mam_pamm_investors`
  ADD CONSTRAINT `mam_pamm_investors_ibfk_1` FOREIGN KEY (`master_id`) REFERENCES `mam_pamm_masters` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `mam_pamm_investors_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `mam_pamm_investors_ibfk_3` FOREIGN KEY (`account_id`) REFERENCES `trading_accounts` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `mam_pamm_masters`
--
ALTER TABLE `mam_pamm_masters`
  ADD CONSTRAINT `mam_pamm_masters_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `mam_pamm_masters_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `trading_accounts` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `mam_pamm_performance`
--
ALTER TABLE `mam_pamm_performance`
  ADD CONSTRAINT `mam_pamm_performance_ibfk_1` FOREIGN KEY (`master_id`) REFERENCES `mam_pamm_masters` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `margin_events`
--
ALTER TABLE `margin_events`
  ADD CONSTRAINT `margin_events_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `trading_accounts` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `market_data`
--
ALTER TABLE `market_data`
  ADD CONSTRAINT `market_data_ibfk_1` FOREIGN KEY (`symbol_id`) REFERENCES `symbols` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `market_prices`
--
ALTER TABLE `market_prices`
  ADD CONSTRAINT `market_prices_ibfk_1` FOREIGN KEY (`symbol_id`) REFERENCES `symbols` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `trading_accounts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`symbol_id`) REFERENCES `symbols` (`id`);

--
-- Constraints for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD CONSTRAINT `password_reset_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `positions`
--
ALTER TABLE `positions`
  ADD CONSTRAINT `positions_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `trading_accounts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `positions_ibfk_2` FOREIGN KEY (`symbol_id`) REFERENCES `symbols` (`id`),
  ADD CONSTRAINT `positions_ibfk_3` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `position_state_history`
--
ALTER TABLE `position_state_history`
  ADD CONSTRAINT `position_state_history_ibfk_1` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `position_state_history_ibfk_2` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `price_alerts`
--
ALTER TABLE `price_alerts`
  ADD CONSTRAINT `price_alerts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `price_alerts_ibfk_2` FOREIGN KEY (`symbol_id`) REFERENCES `symbols` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `price_history`
--
ALTER TABLE `price_history`
  ADD CONSTRAINT `price_history_ibfk_1` FOREIGN KEY (`symbol_id`) REFERENCES `symbols` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `referral_codes`
--
ALTER TABLE `referral_codes`
  ADD CONSTRAINT `referral_codes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `support_responses`
--
ALTER TABLE `support_responses`
  ADD CONSTRAINT `support_responses_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `support_responses_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `support_tickets`
--
ALTER TABLE `support_tickets`
  ADD CONSTRAINT `support_tickets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `support_tickets_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `support_categories` (`id`),
  ADD CONSTRAINT `support_tickets_ibfk_3` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `support_ticket_messages`
--
ALTER TABLE `support_ticket_messages`
  ADD CONSTRAINT `support_ticket_messages_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `support_ticket_messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `swap_charges_log`
--
ALTER TABLE `swap_charges_log`
  ADD CONSTRAINT `swap_charges_log_ibfk_1` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `symbols`
--
ALTER TABLE `symbols`
  ADD CONSTRAINT `symbols_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `asset_categories` (`id`);

--
-- Constraints for table `trade_history`
--
ALTER TABLE `trade_history`
  ADD CONSTRAINT `trade_history_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `trading_accounts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `trade_history_ibfk_2` FOREIGN KEY (`symbol_id`) REFERENCES `symbols` (`id`),
  ADD CONSTRAINT `trade_history_ibfk_3` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `trading_accounts`
--
ALTER TABLE `trading_accounts`
  ADD CONSTRAINT `trading_accounts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `trading_charges`
--
ALTER TABLE `trading_charges`
  ADD CONSTRAINT `trading_charges_ibfk_1` FOREIGN KEY (`symbol_id`) REFERENCES `symbols` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `trading_sessions`
--
ALTER TABLE `trading_sessions`
  ADD CONSTRAINT `trading_sessions_ibfk_1` FOREIGN KEY (`symbol_id`) REFERENCES `symbols` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `transactions`
--
ALTER TABLE `transactions`
  ADD CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `transactions_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `trading_accounts` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `user_activity_log`
--
ALTER TABLE `user_activity_log`
  ADD CONSTRAINT `user_activity_log_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_addresses`
--
ALTER TABLE `user_addresses`
  ADD CONSTRAINT `user_addresses_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_notifications`
--
ALTER TABLE `user_notifications`
  ADD CONSTRAINT `user_notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_notifications_ibfk_2` FOREIGN KEY (`template_id`) REFERENCES `notification_templates` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD CONSTRAINT `user_roles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_roles_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_roles_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `user_settings`
--
ALTER TABLE `user_settings`
  ADD CONSTRAINT `user_settings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_tier_assignments`
--
ALTER TABLE `user_tier_assignments`
  ADD CONSTRAINT `user_tier_assignments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_tier_assignments_ibfk_2` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `withdrawals`
--
ALTER TABLE `withdrawals`
  ADD CONSTRAINT `withdrawals_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `withdrawals_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `trading_accounts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `withdrawals_ibfk_3` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`),
  ADD CONSTRAINT `withdrawals_ibfk_4` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
