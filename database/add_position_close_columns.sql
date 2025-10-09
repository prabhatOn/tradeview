-- Add missing columns to positions table for proper position closing
-- This will make the positions table consistent with what the trading routes expect

ALTER TABLE positions 
ADD COLUMN closed_at TIMESTAMP NULL,
ADD COLUMN close_reason ENUM('manual', 'stop_loss', 'take_profit', 'margin_call', 'system') DEFAULT 'manual';

-- Add index for performance
CREATE INDEX idx_positions_closed_at ON positions(closed_at);
CREATE INDEX idx_positions_close_reason ON positions(close_reason);

-- Update existing closed positions to have a closed_at timestamp
UPDATE positions 
SET closed_at = updated_at 
WHERE status = 'closed' AND closed_at IS NULL;