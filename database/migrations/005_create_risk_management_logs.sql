-- =====================================================
-- Migration: 005 - Create Risk Management Logs
-- Description: Track margin calls, stop outs, and swap charges
-- Date: 2025-10-17
-- =====================================================

-- =====================================================
-- Create Margin Events Table
-- =====================================================

CREATE TABLE IF NOT EXISTS margin_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    account_id INT NOT NULL,
    event_type ENUM('margin_call', 'stop_out', 'margin_warning') NOT NULL,
    margin_level DECIMAL(8,2) NOT NULL COMMENT 'Margin level when event occurred',
    equity DECIMAL(15,4) NOT NULL COMMENT 'Account equity at event time',
    margin_used DECIMAL(15,4) NOT NULL COMMENT 'Total margin in use',
    free_margin DECIMAL(15,4) NOT NULL COMMENT 'Available margin',
    positions_closed INT DEFAULT 0 COMMENT 'Number of positions auto-closed',
    total_loss DECIMAL(15,4) DEFAULT 0.0000 COMMENT 'Total loss from closed positions',
    notification_sent BOOLEAN DEFAULT FALSE COMMENT 'Whether user was notified',
    resolved BOOLEAN DEFAULT FALSE COMMENT 'Whether situation was resolved',
    resolved_at TIMESTAMP NULL COMMENT 'When margin level returned to safe',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE,
    INDEX idx_account_event (account_id, event_type),
    INDEX idx_resolved (resolved),
    INDEX idx_created_at (created_at),
    INDEX idx_event_type (event_type)
) COMMENT='Track margin calls, stop outs, and margin warnings for risk management';

-- =====================================================
-- Create Swap Charges Log Table
-- =====================================================

CREATE TABLE IF NOT EXISTS swap_charges_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    position_id INT NOT NULL,
    charge_date DATE NOT NULL COMMENT 'Date swap was applied',
    swap_rate DECIMAL(10,4) NOT NULL COMMENT 'Swap rate used',
    swap_amount DECIMAL(10,4) NOT NULL COMMENT 'Actual charge amount',
    position_side ENUM('buy', 'sell') NOT NULL COMMENT 'Position direction',
    lot_size DECIMAL(8,4) NOT NULL COMMENT 'Position size',
    is_triple_swap BOOLEAN DEFAULT FALSE COMMENT 'Whether this was triple swap (Wednesday)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_position_date (position_id, charge_date),
    INDEX idx_position (position_id),
    INDEX idx_charge_date (charge_date),
    INDEX idx_triple_swap (is_triple_swap)
) COMMENT='Daily log of swap charges applied to positions';

-- =====================================================
-- Create Position State History Table (Optional)
-- =====================================================

CREATE TABLE IF NOT EXISTS position_state_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    position_id INT NOT NULL,
    state_type ENUM('opened', 'modified', 'sl_updated', 'tp_updated', 'closed', 'triggered', 'cancelled') NOT NULL,
    old_value TEXT NULL COMMENT 'Previous value (JSON)',
    new_value TEXT NULL COMMENT 'New value (JSON)',
    changed_by INT NULL COMMENT 'User who made the change',
    reason VARCHAR(255) NULL COMMENT 'Reason for change',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_position (position_id),
    INDEX idx_state_type (state_type),
    INDEX idx_created_at (created_at)
) COMMENT='Track all state changes for positions for audit trail';

-- =====================================================
-- Create helper views for reporting
-- =====================================================

-- View for recent margin events
CREATE OR REPLACE VIEW v_recent_margin_events AS
SELECT 
    me.id,
    me.account_id,
    ta.account_number,
    u.email as user_email,
    u.first_name,
    u.last_name,
    me.event_type,
    me.margin_level,
    me.equity,
    me.margin_used,
    me.free_margin,
    me.positions_closed,
    me.total_loss,
    me.notification_sent,
    me.resolved,
    me.resolved_at,
    me.created_at
FROM margin_events me
JOIN trading_accounts ta ON me.account_id = ta.id
JOIN users u ON ta.user_id = u.id
ORDER BY me.created_at DESC;

-- View for daily swap summary
CREATE OR REPLACE VIEW v_daily_swap_summary AS
SELECT 
    scl.charge_date,
    COUNT(DISTINCT scl.position_id) as positions_charged,
    SUM(scl.swap_amount) as total_swap_charges,
    AVG(scl.swap_amount) as avg_swap_charge,
    SUM(CASE WHEN scl.is_triple_swap THEN scl.swap_amount ELSE 0 END) as triple_swap_total,
    COUNT(CASE WHEN scl.is_triple_swap THEN 1 END) as triple_swap_positions
FROM swap_charges_log scl
GROUP BY scl.charge_date
ORDER BY scl.charge_date DESC;

-- View for unresolved margin issues
CREATE OR REPLACE VIEW v_unresolved_margin_issues AS
SELECT 
    me.id,
    me.account_id,
    ta.account_number,
    u.email,
    me.event_type,
    me.margin_level,
    me.created_at,
    TIMESTAMPDIFF(MINUTE, me.created_at, NOW()) as minutes_unresolved
FROM margin_events me
JOIN trading_accounts ta ON me.account_id = ta.id
JOIN users u ON ta.user_id = u.id
WHERE me.resolved = FALSE
ORDER BY me.created_at ASC;

SELECT '✓ Migration 005 completed successfully - Risk management logs created' AS status;
