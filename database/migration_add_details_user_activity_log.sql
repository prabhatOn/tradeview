-- Idempotent migration to add details column to user_activity_log
USE pro2;

ALTER TABLE user_activity_log
  ADD COLUMN IF NOT EXISTS details JSON NULL AFTER action_type;

COMMIT;
