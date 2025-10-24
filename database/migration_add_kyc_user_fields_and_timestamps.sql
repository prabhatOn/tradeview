-- Idempotent migration to add missing KYC user fields and timestamps for kyc_documents
USE pro2;

-- Add personal info fields to users if missing
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50) NULL AFTER kyc_rejection_reason,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE NULL AFTER phone_number,
  ADD COLUMN IF NOT EXISTS address VARCHAR(500) NULL AFTER date_of_birth,
  ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL AFTER address,
  ADD COLUMN IF NOT EXISTS state VARCHAR(100) NULL AFTER city,
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20) NULL AFTER state,
  ADD COLUMN IF NOT EXISTS country VARCHAR(100) NULL AFTER postal_code;

-- Add created_at/updated_at to kyc_documents if missing
ALTER TABLE kyc_documents
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER verified_at,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

COMMIT;
