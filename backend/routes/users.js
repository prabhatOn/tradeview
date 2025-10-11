/* eslint-disable import/no-commonjs */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
const express = require('express');
const Joi = require('joi');
const { executeQuery } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const NotificationService = require('../services/NotificationService');
const User = require('../models/User');
const TradingAccount = require('../models/TradingAccount');

const router = express.Router();

// Validation schemas
const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  phone: Joi.string().optional(),
  bio: Joi.string().max(500).optional().allow('')
});

const updateSettingSchema = Joi.object({
  key: Joi.string().required(),
  value: Joi.string().required()
});

// Get user profile
router.get('/profile', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Get user's trading accounts
  const tradingAccounts = await user.getTradingAccounts();

  res.json({ 
    success: true,
    data: {
      ...user.toJSON(),
      tradingAccounts: tradingAccounts.map(acc => acc.toJSON())
    }
  });
}));

// Update user profile
router.put('/profile', asyncHandler(async (req, res) => {
  const { error, value } = updateProfileSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const updateFields = [];
  const updateValues = [];

  Object.entries(value).forEach(([key, val]) => {
    if (val !== undefined) {
      updateFields.push(`${key === 'firstName' ? 'first_name' : key === 'lastName' ? 'last_name' : key} = ?`);
      updateValues.push(val);
    }
  });

  if (updateFields.length === 0) {
    throw new AppError('No fields to update', 400);
  }

  updateValues.push(req.user.id);

  await executeQuery(
    `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    updateValues
  );

  res.json({ message: 'Profile updated successfully' });
}));

// Get user accounts
router.get('/accounts', asyncHandler(async (req, res) => {
  const accounts = await TradingAccount.findByUserId(req.user.id);
  
  // Return accounts with basic metrics
  const accountsWithMetrics = await Promise.all(
    accounts.map(async (account) => {
      const openPositionsCount = await account.getOpenPositionsCount();
      const unrealizedPnL = await account.getUnrealizedPnL();
      const equity = account.balance + unrealizedPnL;
      
      return {
        id: account.id,
        userId: account.userId,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        currency: account.currency,
        leverage: account.leverage,
        status: account.status,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        balance: account.balance,
        equity: equity,
        freeMargin: equity,
        margin: 0,
        marginLevel: 0,
        openPositions: openPositionsCount,
        totalPnl: unrealizedPnL
      };
    })
  );

  res.json({ 
    success: true,
    data: accountsWithMetrics 
  });
}));

// Get user settings
router.get('/settings', asyncHandler(async (req, res) => {
  const settings = await executeQuery(
    'SELECT setting_key, setting_value FROM user_settings WHERE user_id = ?',
    [req.user.id]
  );

  const settingsObject = settings.reduce((acc, setting) => {
    acc[setting.setting_key] = setting.setting_value;
    return acc;
  }, {});

  res.json({ settings: settingsObject });
}));

// Update user setting
router.put('/settings', asyncHandler(async (req, res) => {
  const { error, value } = updateSettingSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { key, value: settingValue } = value;

  await executeQuery(
    `INSERT INTO user_settings (user_id, setting_key, setting_value)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
    [req.user.id, key, settingValue]
  );

  res.json({ message: 'Setting updated successfully' });
}));

// Get user addresses
router.get('/addresses', asyncHandler(async (req, res) => {
  const addresses = await executeQuery(
    `SELECT id, type, address_line_1, address_line_2, city, state_province, 
            postal_code, country_code, is_primary, created_at
     FROM user_addresses 
     WHERE user_id = ?
     ORDER BY is_primary DESC, created_at DESC`,
    [req.user.id]
  );

  res.json({ addresses });
}));

// Add user address
router.post('/addresses', asyncHandler(async (req, res) => {
  const addressSchema = Joi.object({
    type: Joi.string().valid('billing', 'mailing', 'both').default('both'),
    addressLine1: Joi.string().required(),
    addressLine2: Joi.string().optional().allow(''),
    city: Joi.string().required(),
    stateProvince: Joi.string().optional().allow(''),
    postalCode: Joi.string().required(),
    countryCode: Joi.string().length(3).required(),
    isPrimary: Joi.boolean().default(false)
  });

  const { error, value } = addressSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const {
    type, addressLine1, addressLine2, city, stateProvince,
    postalCode, countryCode, isPrimary
  } = value;

  // If setting as primary, unset other primary addresses
  if (isPrimary) {
    await executeQuery(
      'UPDATE user_addresses SET is_primary = FALSE WHERE user_id = ?',
      [req.user.id]
    );
  }

  const result = await executeQuery(
    `INSERT INTO user_addresses (
       user_id, type, address_line_1, address_line_2, city, 
       state_province, postal_code, country_code, is_primary
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, type, addressLine1, addressLine2, city, stateProvince, postalCode, countryCode, isPrimary]
  );

  res.status(201).json({
    message: 'Address added successfully',
    addressId: result.insertId
  });
}));

// Update user address
router.put('/addresses/:id', asyncHandler(async (req, res) => {
  const addressId = parseInt(req.params.id);
  
  const addressSchema = Joi.object({
    type: Joi.string().valid('billing', 'mailing', 'both').optional(),
    addressLine1: Joi.string().optional(),
    addressLine2: Joi.string().optional().allow(''),
    city: Joi.string().optional(),
    stateProvince: Joi.string().optional().allow(''),
    postalCode: Joi.string().optional(),
    countryCode: Joi.string().length(3).optional(),
    isPrimary: Joi.boolean().optional()
  });

  const { error, value } = addressSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  // Check if address belongs to user
  const existingAddress = await executeQuery(
    'SELECT id FROM user_addresses WHERE id = ? AND user_id = ?',
    [addressId, req.user.id]
  );

  if (!existingAddress.length) {
    throw new AppError('Address not found', 404);
  }

  // If setting as primary, unset other primary addresses
  if (value.isPrimary) {
    await executeQuery(
      'UPDATE user_addresses SET is_primary = FALSE WHERE user_id = ? AND id != ?',
      [req.user.id, addressId]
    );
  }

  const updateFields = [];
  const updateValues = [];

  Object.entries(value).forEach(([key, val]) => {
    if (val !== undefined) {
      const dbField = key === 'addressLine1' ? 'address_line_1' :
                     key === 'addressLine2' ? 'address_line_2' :
                     key === 'stateProvince' ? 'state_province' :
                     key === 'postalCode' ? 'postal_code' :
                     key === 'countryCode' ? 'country_code' :
                     key === 'isPrimary' ? 'is_primary' : key;
      updateFields.push(`${dbField} = ?`);
      updateValues.push(val);
    }
  });

  if (updateFields.length === 0) {
    throw new AppError('No fields to update', 400);
  }

  updateValues.push(addressId, req.user.id);

  await executeQuery(
    `UPDATE user_addresses SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ? AND user_id = ?`,
    updateValues
  );

  res.json({ message: 'Address updated successfully' });
}));

// Delete user address
router.delete('/addresses/:id', asyncHandler(async (req, res) => {
  const addressId = parseInt(req.params.id);

  const result = await executeQuery(
    'DELETE FROM user_addresses WHERE id = ? AND user_id = ?',
    [addressId, req.user.id]
  );

  if (result.affectedRows === 0) {
    throw new AppError('Address not found', 404);
  }

  res.json({ message: 'Address deleted successfully' });
}));

// Get user notifications
router.get('/notifications', asyncHandler(async (req, res) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 20;
  const unreadOnly = String(req.query.unreadOnly || '').toLowerCase() === 'true';

  const result = await NotificationService.getUserNotifications(req.user.id, page, limit, unreadOnly);

  res.json({
    success: true,
    data: {
      data: result.notifications,
      pagination: result.pagination,
    },
  });
}));

// Mark notification as read
router.put('/notifications/:id/read', asyncHandler(async (req, res) => {
  const notificationId = Number.parseInt(req.params.id, 10);

  const updated = await NotificationService.markAsRead(notificationId, req.user.id);
  if (!updated) {
    throw new AppError('Notification not found', 404);
  }

  res.json({ success: true, message: 'Notification marked as read' });
}));

// Get user price alerts
router.get('/price-alerts', asyncHandler(async (req, res) => {
  const alerts = await executeQuery(
    `SELECT pa.id, s.symbol, s.name, pa.alert_type, pa.trigger_value, 
            pa.current_value, pa.message, pa.is_triggered, pa.is_active, 
            pa.triggered_at, pa.created_at
     FROM price_alerts pa
     JOIN symbols s ON pa.symbol_id = s.id
     WHERE pa.user_id = ?
     ORDER BY pa.created_at DESC`,
    [req.user.id]
  );

  res.json({ alerts });
}));

// Create price alert
router.post('/price-alerts', asyncHandler(async (req, res) => {
  const alertSchema = Joi.object({
    symbolId: Joi.number().integer().positive().required(),
    alertType: Joi.string().valid('price_above', 'price_below', 'price_change_percent').required(),
    triggerValue: Joi.number().positive().required(),
    message: Joi.string().max(255).optional()
  });

  const { error, value } = alertSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { symbolId, alertType, triggerValue, message } = value;

  // Verify symbol exists
  const symbols = await executeQuery(
    'SELECT id FROM symbols WHERE id = ? AND is_active = 1',
    [symbolId]
  );

  if (!symbols.length) {
    throw new AppError('Symbol not found or not active', 404);
  }

  const result = await executeQuery(
    `INSERT INTO price_alerts (user_id, symbol_id, alert_type, trigger_value, message)
     VALUES (?, ?, ?, ?, ?)`,
    [req.user.id, symbolId, alertType, triggerValue, message]
  );

  res.status(201).json({
    message: 'Price alert created successfully',
    alertId: result.insertId
  });
}));

// Delete price alert
router.delete('/price-alerts/:id', asyncHandler(async (req, res) => {
  const alertId = parseInt(req.params.id);

  const result = await executeQuery(
    'DELETE FROM price_alerts WHERE id = ? AND user_id = ?',
    [alertId, req.user.id]
  );

  if (result.affectedRows === 0) {
    throw new AppError('Price alert not found', 404);
  }

  res.json({ message: 'Price alert deleted successfully' });
}));

module.exports = router;