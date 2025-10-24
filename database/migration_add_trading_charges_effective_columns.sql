-- Migration: Add effective_from / effective_until columns to trading_charges
-- Idempotent: safe to run multiple times
-- Intended for environments where the running DB is missing the `effective_from`/`effective_until` columns

SET @schema := DATABASE();

-- Add effective_from if missing (some older installs may already have this)
SET @sql := CONCAT('ALTER TABLE `trading_charges` ADD COLUMN IF NOT EXISTS `effective_from` TIMESTAMP DEFAULT CURRENT_TIMESTAMP;');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add effective_until if missing (the running code expects `effective_until`)
SET @sql2 := CONCAT('ALTER TABLE `trading_charges` ADD COLUMN IF NOT EXISTS `effective_until` TIMESTAMP NULL;');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- Record migration (best-effort; if migrations table exists, insert a record so tooling can track it)
INSERT IGNORE INTO migrations (migration_name, executed_by) VALUES ('migration_add_trading_charges_effective_columns.sql', USER());

-- End migration
