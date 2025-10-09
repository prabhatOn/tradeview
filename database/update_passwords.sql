-- Update user passwords with proper bcrypt hashes
USE pro2;

-- All users will have password: password123
-- Hash: $2a$10$bXU7.Kj6yi.snl0gSlHPMOMviZLOo4w9z0iXh3Gn.V9FIaAwQEFJO

UPDATE users SET password_hash = '$2a$10$bXU7.Kj6yi.snl0gSlHPMOMviZLOo4w9z0iXh3Gn.V9FIaAwQEFJO';

SELECT 'Password update completed' as status;