-- Idempotent migration to add ifsc_code to bank_details
USE pro2;

-- Add ifsc_code column if missing
ALTER TABLE bank_details
  ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20) DEFAULT NULL AFTER account_number;

-- Optionally populate ifsc_code from routing_number for some regions (disabled by default)
-- UPDATE bank_details SET ifsc_code = routing_number WHERE (ifsc_code IS NULL OR TRIM(ifsc_code) = '') AND routing_number IS NOT NULL;

COMMIT;
