-- Idempotent migration to add KYC-related columns referenced by backend
USE pro2;

-- Users table: add KYC timestamp and reason columns if missing
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMP NULL AFTER kyc_status,
  ADD COLUMN IF NOT EXISTS kyc_approved_at TIMESTAMP NULL AFTER kyc_submitted_at,
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason VARCHAR(500) NULL AFTER kyc_approved_at;

-- KYC documents table: add file path columns, status, reasons, and timestamps if missing
ALTER TABLE kyc_documents
  ADD COLUMN IF NOT EXISTS document_front_url VARCHAR(255) NULL AFTER document_number,
  ADD COLUMN IF NOT EXISTS document_back_url VARCHAR(255) NULL AFTER document_front_url,
  ADD COLUMN IF NOT EXISTS status ENUM('submitted','verified','rejected') DEFAULT 'submitted' AFTER document_back_url,
  ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500) NULL AFTER status,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP NULL AFTER rejection_reason,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP NULL AFTER submitted_at;

COMMIT;
