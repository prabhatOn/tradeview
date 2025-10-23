-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 23, 2025 at 01:01 PM
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
-- Table structure for table `bank_accounts`
--

CREATE TABLE `bank_accounts` (
  `id` int(11) NOT NULL,
  `payment_gateway_id` int(11) DEFAULT NULL,
  `label` varchar(120) NOT NULL,
  `bank_name` varchar(150) NOT NULL,
  `account_name` varchar(150) NOT NULL,
  `account_number` varchar(120) NOT NULL,
  `account_type` enum('personal','business') DEFAULT 'business',
  `iban` varchar(60) DEFAULT NULL,
  `swift_code` varchar(60) DEFAULT NULL,
  `routing_number` varchar(60) DEFAULT NULL,
  `branch_name` varchar(150) DEFAULT NULL,
  `branch_address` varchar(255) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `currency` varchar(3) DEFAULT 'USD',
  `instructions` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `sort_order` int(11) DEFAULT 0,
  `current_balance` decimal(15,2) DEFAULT 0.00,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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

INSERT INTO `market_prices` 
(`id`, `symbol_id`, `bid`, `ask`, `last`, `high`, `low`, `volume`, `change_amount`, `change_percent`, `timestamp`) 
VALUES 
(1, 101, 100.00, 101.00, 100.50, 102.00, 99.50, 500, 0.50, 0.50, '2025-10-23 18:00:00');
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

--
-- Dumping data for table `support_categories`
--

INSERT INTO `support_categories` (`id`, `name`, `description`, `priority_level`, `is_active`, `created_at`) VALUES
(1, 'General Inquiry', 'General questions and information requests', 'low', 1, '2025-10-23 10:39:39'),
(2, 'Technical Support', 'Platform bugs, connection issues, technical problems', 'medium', 1, '2025-10-23 10:39:39'),
(3, 'Account Issues', 'Login problems, password reset, account access', 'high', 1, '2025-10-23 10:39:39'),
(4, 'Trading Questions', 'Questions about trading features and functionality', 'medium', 1, '2025-10-23 10:39:39'),
(5, 'Deposits & Withdrawals', 'Payment processing, deposits, withdrawals', 'high', 1, '2025-10-23 10:39:39'),
(6, 'KYC Verification', 'Identity verification and KYC process', 'urgent', 1, '2025-10-23 10:39:39');

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
(9, 'EURJPY', 'Euro vs Japanese Yen', 2, 'EUR', 'JPY', 0.01000000, 100000.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 1.0000, 'floating', 1.4000, 'per_lot', 0.0000, -0.6000, -0.4000, 0, '2025-10-16 20:30:30', '2025-10-20 11:16:36'),
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
(44, 'ADAUSD', 'Cardano vs US Dollar', 4, 'ADA', 'USD', 0.00010000, 100000.0000, 0.0100, 1000.0000, 0.0100, 1.0000, 5.0000, 'floating', 2.5000, 'per_lot', 0.0000, -0.7000, -0.7000, 1, '2025-10-16 20:30:30', '2025-10-23 10:54:20'),
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
  `auto_square_percent` decimal(5,2) DEFAULT NULL COMMENT 'Auto square-off threshold % of balance',
  `status` enum('active','inactive','frozen','closed') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `min_margin_requirement` decimal(8,4) DEFAULT 1.0000 COMMENT 'Minimum margin requirement percentage'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
(1, 1, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(2, 1, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(3, 1, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(4, 2, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(5, 2, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(6, 2, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(7, 3, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(8, 3, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(9, 3, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(10, 4, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(11, 4, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(12, 4, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(13, 5, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(14, 5, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(15, 5, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(16, 6, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(17, 6, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(18, 6, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(19, 7, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(20, 7, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(21, 7, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(22, 8, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(23, 8, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(24, 8, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(25, 9, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(26, 9, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(27, 9, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(28, 10, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(29, 10, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(30, 10, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(31, 11, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(32, 11, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(33, 11, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(34, 12, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(35, 12, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(36, 12, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(37, 13, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(38, 13, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(39, 13, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(40, 14, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(41, 14, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(42, 14, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(43, 15, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(44, 15, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(45, 15, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(46, 16, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(47, 16, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(48, 16, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(49, 17, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(50, 17, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(51, 17, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(52, 18, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(53, 18, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(54, 18, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(55, 19, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(56, 19, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(57, 19, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(58, 20, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(59, 20, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(60, 20, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(61, 21, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(62, 21, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(63, 21, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(64, 22, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(65, 22, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(66, 22, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(67, 23, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(68, 23, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(69, 23, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(70, 24, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(71, 24, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(72, 24, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(73, 25, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(74, 25, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(75, 25, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(76, 26, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(77, 26, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(78, 26, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(79, 27, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(80, 27, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(81, 27, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(82, 28, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(83, 28, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(84, 28, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(85, 29, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(86, 29, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(87, 29, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(88, 30, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(89, 30, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(90, 30, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(91, 31, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(92, 31, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(93, 31, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(94, 32, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(95, 32, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(96, 32, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(97, 33, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(98, 33, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(99, 33, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(100, 34, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(101, 34, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(102, 34, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(103, 35, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(104, 35, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(105, 35, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(106, 36, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(107, 36, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(108, 36, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(109, 37, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(110, 37, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(111, 37, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(112, 38, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(113, 38, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(114, 38, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(115, 39, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(116, 39, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(117, 39, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(118, 40, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(119, 40, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(120, 40, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(121, 41, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(122, 41, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(123, 41, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(124, 42, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(125, 42, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(126, 42, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(127, 43, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(128, 43, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(129, 43, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(130, 44, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(131, 44, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(132, 44, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(133, 45, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(134, 45, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(135, 45, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(136, 46, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(137, 46, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(138, 46, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(139, 47, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(140, 47, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(141, 47, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(142, 48, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(143, 48, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(144, 48, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(145, 49, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(146, 49, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(147, 49, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(148, 50, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(149, 50, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(150, 50, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(151, 51, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(152, 51, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(153, 51, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(154, 52, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(155, 52, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(156, 52, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(157, 53, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(158, 53, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(159, 53, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(160, 54, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(161, 54, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(162, 54, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(163, 55, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(164, 55, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(165, 55, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(166, 56, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(167, 56, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(168, 56, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(169, 57, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(170, 57, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(171, 57, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(172, 58, 'live', 'commission', 5.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(173, 58, 'live', 'swap_long', -1.0000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37'),
(174, 58, 'live', 'swap_short', 0.5000, 'per_lot', 'standard', 1, '2025-10-23 10:53:37', NULL, '2025-10-23 10:53:37', '2025-10-23 10:53:37');


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
