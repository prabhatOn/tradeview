-- Add missing columns to positions table for proper position closing
-- This will make the positions table consistent with what the trading routes expect

ALTER TABLE positions 
ADD COLUMN IF NOT EXISTS close_price DECIMAL(12,6) NULL,
ADD COLUMN IF NOT EXISTS profit_loss DECIMAL(12,4) DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS close_time TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS close_reason ENUM('manual', 'stop_loss', 'take_profit', 'margin_call', 'system') DEFAULT 'manual';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_positions_closed_at ON positions(closed_at);
CREATE INDEX IF NOT EXISTS idx_positions_close_time ON positions(close_time);
CREATE INDEX IF NOT EXISTS idx_positions_close_reason ON positions(close_reason);

-- Backfill existing closed rows with reasonable defaults
UPDATE positions 
SET close_price = COALESCE(close_price, current_price)
WHERE status = 'closed' AND close_price IS NULL;

UPDATE positions
SET profit_loss = COALESCE(profit_loss, profit)
WHERE status = 'closed' AND (profit_loss IS NULL OR profit_loss = 0);

-- Update existing closed positions to have a closed_at timestamp
UPDATE positions 
SET closed_at = updated_at 
WHERE status = 'closed' AND closed_at IS NULL;

UPDATE positions
SET close_time = COALESCE(close_time, closed_at, updated_at)
WHERE status = 'closed' AND close_time IS NULL;