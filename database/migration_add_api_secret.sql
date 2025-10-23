-- Migration: Add api_secret column to api_keys table
-- Run this if you've already imported the schema and need to add the missing column

USE pro2;

-- Add the api_secret column to store actual API secrets
ALTER TABLE api_keys ADD COLUMN api_secret VARCHAR(128) NOT NULL AFTER api_key;

-- Optional: Update existing records with a placeholder (if any exist)
-- UPDATE api_keys SET api_secret = 'migrated_key_' + CAST(id AS CHAR) WHERE api_secret = '';

COMMIT;