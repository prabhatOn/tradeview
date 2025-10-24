-- Idempotent migration to add status column to bank_details
USE pro2;

ALTER TABLE bank_details
  ADD COLUMN IF NOT EXISTS status ENUM('pending_verification','verified','rejected','disabled') DEFAULT 'pending_verification' AFTER is_primary;

COMMIT;
