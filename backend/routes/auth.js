const express = require('express');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { executeQuery, executeTransaction } = require('../config/database');
const { generateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const User = require('../models/User');

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  phone: Joi.string().optional(),
  phoneCountryCode: Joi.string().max(5).optional(),
  country: Joi.string().length(3).optional(), // ISO 3-letter country code
  preferredCurrency: Joi.string().length(3).default('USD'), // ISO currency code
  preferredLeverage: Joi.number().min(1).max(1000).default(100),
  address: Joi.string().max(500).optional(),
  city: Joi.string().max(100).optional(),
  postalCode: Joi.string().max(20).optional(),
  dateOfBirth: Joi.date().max('now').optional(),
  gender: Joi.string().valid('male', 'female', 'other').optional(),
  occupation: Joi.string().max(100).optional(),
  experienceLevel: Joi.string().valid('beginner', 'intermediate', 'expert').default('beginner'),
  annualIncomeRange: Joi.string().valid('0-25k', '25k-50k', '50k-100k', '100k-250k', '250k+').optional(),
  tradingExperienceYears: Joi.number().min(0).max(50).default(0),
  riskTolerance: Joi.string().valid('low', 'medium', 'high').default('medium'),
  investmentGoals: Joi.string().max(1000).optional(),
  referralCode: Joi.string().alphanum().max(20).optional(),
  acceptTerms: Joi.boolean().valid(true).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required()
});

// Register new user
router.post('/register', asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = registerSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { email, password, firstName, lastName, phone } = value;

  // Check if user already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    throw new AppError('User with this email already exists', 409);
  }

  // Hash password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create user directly
  const userResult = await executeQuery(
    `INSERT INTO users (
      email, password_hash, first_name, last_name, phone, status
    ) VALUES (?, ?, ?, ?, ?, 'active')`,
    [email, hashedPassword, firstName, lastName, phone || null]
  );

  const userId = userResult.insertId;

  // Get the created user data
  const [userRows] = await executeQuery('SELECT * FROM users WHERE id = ?', [userId]);
  const user = new User(userRows);

  // Create default trading account
  const accountNumber = `100${String(userId).padStart(7, '0')}`;
  await executeQuery(
    `INSERT INTO trading_accounts (
      user_id, account_number, account_type, currency, leverage, 
      balance, equity, free_margin, status
    ) VALUES (?, ?, 'demo', 'USD', 100, 100000.00, 100000.00, 100000.00, 'active')`,
    [userId, accountNumber]
  );

  // Generate JWT token
  const token = generateToken(user.id);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: user.toJSON(),
      tokens: {
        accessToken: token,
        refreshToken: token, // For now, using same token - should be separate in production
        expiresIn: 24 * 60 * 60 // 24 hours in seconds
      }
    }
  });
}));

// Login user
router.post('/login', asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { email, password } = value;

  // Get user from database
  const user = await User.findByEmail(email);
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check if user is active
  if (user.status !== 'active') {
    throw new AppError('Account is not active. Please contact support.', 401);
  }

  // Verify password
  const isValidPassword = await user.verifyPassword(password);
  if (!isValidPassword) {
    throw new AppError('Invalid email or password', 401);
  }

  // Update last login
  await user.updateLastLogin();

  // Generate JWT token
  const token = generateToken(user.id);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: user.toJSON(),
      tokens: {
        accessToken: token,
        refreshToken: token, // For now, using same token - should be separate in production
        expiresIn: 24 * 60 * 60 // 24 hours in seconds
      }
    }
  });
}));

// Get current user profile
router.get('/me', asyncHandler(async (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    throw new AppError('Access denied. No token provided.', 401);
  }

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({ 
      success: true, 
      data: user.toJSON()
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid token', 401);
    }
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Token expired', 401);
    }
    throw error;
  }
}));

// Change password
router.post('/change-password', asyncHandler(async (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    throw new AppError('Access denied. No token provided.', 401);
  }

  // Validate input
  const { error, value } = changePasswordSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { currentPassword, newPassword } = value;

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
  
  const decoded = jwt.verify(token, JWT_SECRET);

  // Get current user
  const users = await executeQuery(
    'SELECT id, password_hash FROM users WHERE id = ?',
    [decoded.userId]
  );

  if (!users.length) {
    throw new AppError('User not found', 404);
  }

  const user = users[0];

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValidPassword) {
    throw new AppError('Current password is incorrect', 400);
  }

  // Hash new password
  const saltRounds = 12;
  const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await executeQuery(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [hashedNewPassword, user.id]
  );

  res.json({ message: 'Password changed successfully' });
}));

// Logout (client-side token removal)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Register new user (simple version for testing)
router.post('/register-simple', asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = registerSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { email, password, firstName, lastName, phone } = value;

  // Check if user already exists
  const existingUsers = await executeQuery('SELECT id FROM users WHERE email = ?', [email]);
  if (existingUsers.length > 0) {
    throw new AppError('User with this email already exists', 409);
  }

  // Hash password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create user
  const userResult = await executeQuery(
    `INSERT INTO users (
      email, password_hash, first_name, last_name, phone, status
    ) VALUES (?, ?, ?, ?, ?, 'active')`,
    [email, hashedPassword, firstName, lastName, phone || null]
  );

  const userId = userResult.insertId;

  // Create default trading account
  const accountNumber = `100${String(userId).padStart(7, '0')}`;
  await executeQuery(
    `INSERT INTO trading_accounts (
      user_id, account_number, account_type, currency, leverage, 
      balance, equity, free_margin, status
    ) VALUES (?, ?, 'demo', 'USD', 100, 100000.00, 100000.00, 100000.00, 'active')`,
    [userId, accountNumber]
  );

  // Get the created user data
  const [userRows] = await executeQuery('SELECT * FROM users WHERE id = ?', [userId]);

  // Generate JWT token
  const token = generateToken(userId);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: userRows.id,
        email: userRows.email,
        firstName: userRows.first_name,
        lastName: userRows.last_name,
        phone: userRows.phone,
        status: userRows.status
      },
      tokens: {
        accessToken: token,
        refreshToken: token,
        expiresIn: 24 * 60 * 60
      }
    }
  });
}));

module.exports = router;