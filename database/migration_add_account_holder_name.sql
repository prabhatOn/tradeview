-- Idempotent migration to add account_holder_name to bank_details
USE pro2;

-- Add column if missing
ALTER TABLE bank_details
  ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(150) AFTER bank_name;

-- If account_holder_name is empty, populate from existing account_name
UPDATE bank_details SET account_holder_name = account_name WHERE (account_holder_name IS NULL OR TRIM(account_holder_name) = '');

COMMIT;
