-- Idempotent migration to add verified_at to bank_details
USE pro2;

-- Add verified_at column if missing
ALTER TABLE bank_details
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP NULL AFTER verification_date;

-- Populate from verification_date if present
UPDATE bank_details SET verified_at = verification_date WHERE (verified_at IS NULL OR verified_at = '0000-00-00 00:00:00') AND verification_date IS NOT NULL;

COMMIT;
