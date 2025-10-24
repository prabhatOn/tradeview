-- Idempotent migration to add usage_count to referral_codes
USE pro2;

ALTER TABLE referral_codes
  ADD COLUMN IF NOT EXISTS usage_count INT DEFAULT 0 AFTER is_active;

COMMIT;
