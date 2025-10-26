/* eslint-disable import/no-commonjs */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
const express = require('express');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { executeQuery } = require('../config/database');
const { generateAccessToken, generateRefreshToken, authMiddleware } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const User = require('../models/User');
const IntroducingBrokerService = require('../services/IntroducingBrokerService');

const router = express.Router();

// Validation schemas
const ALLOWED_LEVERAGE_VALUES = [100, 200, 500, 1000, 2000];

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  phone: Joi.string().optional(),
  phoneCountryCode: Joi.string().max(5).optional(),
  country: Joi.string().length(3).optional(), // ISO 3-letter country code
  preferredCurrency: Joi.string().length(3).default('USD'), // ISO currency code
  preferredLeverage: Joi.number().valid(...ALLOWED_LEVERAGE_VALUES).default(100),
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

  const { email, password, firstName, lastName, phone, referralCode, preferredLeverage } = value;

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
      email, password_hash, first_name, last_name, phone, status, preferred_leverage
    ) VALUES (?, ?, ?, ?, ?, 'active', ?)`
    ,
    [email, hashedPassword, firstName, lastName, phone || null, preferredLeverage]
  );

  const userId = userResult.insertId;

  // Get the created user data
  const [userRows] = await executeQuery('SELECT * FROM users WHERE id = ?', [userId]);
  const user = new User(userRows);

  // Create default trading account with zero balance
  const accountNumber = `100${String(userId).padStart(7, '0')}`;
  await executeQuery(
    `INSERT INTO trading_accounts (
      user_id, account_number, account_type, currency, leverage, 
      balance, equity, free_margin, status
    ) VALUES (?, ?, 'live', 'USD', ?, 0.00, 0.00, 0.00, 'active')`,
    [userId, accountNumber, preferredLeverage]
  );

  // Handle referral code if provided
  if (referralCode && referralCode.trim().length > 0) {
    const normalizedCode = referralCode.trim().toUpperCase();
    try {
      const [referralRows] = await executeQuery(
        `SELECT id, user_id, is_active, usage_count, max_usage, expires_at
         FROM referral_codes
         WHERE code = ?
         LIMIT 1`,
        [normalizedCode]
      );

      if (referralRows && referralRows.is_active) {
        const isExpired = referralRows.expires_at && new Date(referralRows.expires_at) < new Date();
        if (!isExpired) {
          const ibUserId = referralRows.user_id;
          if (ibUserId !== userId) {
            try {
              await IntroducingBrokerService.createIbRelationship(ibUserId, email);

              await executeQuery(
                `UPDATE referral_codes
                 SET usage_count = usage_count + 1,
                     is_active = CASE
                       WHEN max_usage IS NOT NULL AND usage_count + 1 >= max_usage THEN 0
                       ELSE is_active
                     END
                 WHERE id = ?`,
                [referralRows.id]
              );
            } catch (referralError) {
              console.warn('Failed to create IB relationship from referral code:', referralError.message);
            }
          }
        }
      }
    } catch (referralLookupError) {
      console.warn('Referral code lookup failed:', referralLookupError.message);
    }
  }

  // Generate access and refresh tokens
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: user.toJSON(),
      tokens: {
        accessToken,
        refreshToken,
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

  // Generate access and refresh tokens
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: user.toJSON(),
      tokens: {
        accessToken,
        refreshToken,
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

  const { verifyAccessToken } = require('../middleware/auth');

  try {
    const decoded = verifyAccessToken(token);
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
router.post('/change-password', authMiddleware, asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = changePasswordSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { currentPassword, newPassword } = value;
  const userId = req.user.id; // Get from authenticated user

  // Get current user
  const users = await executeQuery(
    'SELECT id, password_hash FROM users WHERE id = ?',
    [userId]
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
    'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
    [hashedNewPassword, user.id]
  );

  res.json({ 
    success: true,
    message: 'Password changed successfully' 
  });
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

  const { email, password, firstName, lastName, phone, preferredLeverage } = value;

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
      email, password_hash, first_name, last_name, phone, status, preferred_leverage
    ) VALUES (?, ?, ?, ?, ?, 'active', ?)`,
    [email, hashedPassword, firstName, lastName, phone || null, preferredLeverage]
  );

  const userId = userResult.insertId;

  // Create default trading account with zero balance
  const accountNumber = `100${String(userId).padStart(7, '0')}`;
  await executeQuery(
    `INSERT INTO trading_accounts (
      user_id, account_number, account_type, currency, leverage, 
      balance, equity, free_margin, status
    ) VALUES (?, ?, 'live', 'USD', ?, 0.00, 0.00, 0.00, 'active')`,
    [userId, accountNumber, preferredLeverage]
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