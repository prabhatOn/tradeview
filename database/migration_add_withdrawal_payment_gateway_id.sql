-- Idempotent migration to add payment_gateway_id to withdrawals
USE pro2;

-- Add column if missing
ALTER TABLE withdrawals
  ADD COLUMN IF NOT EXISTS payment_gateway_id INT NULL AFTER payment_method_id;

-- Create index if missing (MySQL 8+ supports IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_withdrawal_gateway ON withdrawals(payment_gateway_id);

-- Optionally add foreign key (commented out to avoid errors if key already exists)
-- ALTER TABLE withdrawals
--   ADD CONSTRAINT fk_withdrawals_payment_gateway FOREIGN KEY (payment_gateway_id) REFERENCES payment_gateways(id) ON DELETE SET NULL;

COMMIT;
