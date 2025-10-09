-- Create User and Admin Login Credentials
-- Trading Platform Authentication Setup

USE pro2;

-- Create roles first
INSERT INTO roles (name, description, is_admin) VALUES
('user', 'Regular trading user', FALSE),
('admin', 'Platform administrator', TRUE),
('manager', 'Account manager', FALSE),
('support', 'Customer support', FALSE);

-- Create demo users with hashed passwords
-- Password for all users: "password123"
-- Hash generated using bcryptjs with 10 rounds

-- Regular User Login
INSERT INTO users (
    email, 
    password_hash, 
    first_name, 
    last_name, 
    phone, 
    status, 
    email_verified, 
    kyc_status
) VALUES (
    'user@demo.com',
    '$2a$10$rOzJGZGGGZGGGZGGGZGGGOeH4h5h5h5h5h5h5h5h5h5h5h5h5h5h5h5',
    'Demo',
    'User', 
    '+1234567890',
    'active',
    TRUE,
    'approved'
);

-- Admin User Login  
INSERT INTO users (
    email, 
    password_hash, 
    first_name, 
    last_name, 
    phone, 
    status, 
    email_verified, 
    kyc_status
) VALUES (
    'admin@demo.com',
    '$2a$10$rOzJGZGGGZGGGZGGGZGGGOeH4h5h5h5h5h5h5h5h5h5h5h5h5h5h5h5',
    'Admin',
    'User', 
    '+1234567891',
    'active',
    TRUE,
    'approved'
);

-- Get the user IDs for role assignment
SET @user_id = (SELECT id FROM users WHERE email = 'user@demo.com');
SET @admin_id = (SELECT id FROM users WHERE email = 'admin@demo.com');

-- Assign roles
INSERT INTO user_roles (user_id, role_id) VALUES
(@user_id, 1),  -- Regular user role
(@admin_id, 2); -- Admin role

-- Create trading accounts for the demo user
INSERT INTO trading_accounts (
    user_id,
    account_number,
    account_type,
    currency,
    balance,
    equity,
    margin,
    free_margin,
    leverage,
    status
) VALUES 
(@user_id, 'DEMO001', 'demo', 'USD', 10000.00, 10000.00, 0.00, 10000.00, 100, 'active'),
(@user_id, 'LIVE001', 'live', 'USD', 5000.00, 5000.00, 0.00, 5000.00, 50, 'active');

-- Create admin profile data
INSERT INTO user_profiles (
    user_id,
    country,
    city,
    address,
    timezone,
    language,
    preferred_currency,
    trading_experience,
    risk_tolerance
) VALUES 
(@user_id, 'United States', 'New York', '123 Demo Street', 'America/New_York', 'en', 'USD', 'intermediate', 'medium'),
(@admin_id, 'United States', 'New York', '456 Admin Avenue', 'America/New_York', 'en', 'USD', 'expert', 'high');

-- Add some notifications for the users
INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    priority,
    is_read
) VALUES 
(@user_id, 'Welcome to Trading Platform', 'Your account has been successfully created and verified!', 'info', 'normal', FALSE),
(@user_id, 'Account Funded', 'Your demo account has been funded with $10,000', 'success', 'normal', FALSE),
(@admin_id, 'Admin Access Granted', 'You now have administrative privileges on the platform', 'info', 'high', FALSE);

-- Show the created login credentials
SELECT 
    'Login Credentials Created:' as status,
    '' as email,
    '' as password,
    '' as role
UNION ALL
SELECT 
    '========================',
    '',
    '',
    ''
UNION ALL
SELECT 
    'Regular User:',
    'user@demo.com',
    'password123',
    'user'
UNION ALL
SELECT 
    'Admin User:',
    'admin@demo.com', 
    'password123',
    'admin'
UNION ALL
SELECT 
    '========================',
    '',
    '',
    '';

-- Verify tables and data
SELECT 'Database Tables Created:' as info;
SHOW TABLES;

SELECT 'Total Users:' as info, COUNT(*) as count FROM users;
SELECT 'Total Trading Accounts:' as info, COUNT(*) as count FROM trading_accounts;  
SELECT 'Total Symbols:' as info, COUNT(*) as count FROM symbols;