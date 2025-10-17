const express = require('express');
const crypto = require('crypto');
const Joi = require('joi');
const { executeQuery } = require('../config/database.js');
const { asyncHandler, AppError } = require('../middleware/errorHandler.js');

const router = express.Router();

// Validation schemas
const createApiKeySchema = Joi.object({
  keyName: Joi.string().min(1).max(100).required(),
  permissions: Joi.array().items(Joi.string().valid('read', 'trade', 'admin')).min(1).required(),
  expiresAt: Joi.date().optional().allow(null),
  rateLimitPerHour: Joi.number().integer().min(100).max(10000).default(1000),
  ipWhitelist: Joi.array().items(Joi.string().ip()).optional()
});

const updateApiKeySchema = Joi.object({
  keyName: Joi.string().min(1).max(100).optional(),
  permissions: Joi.array().items(Joi.string().valid('read', 'trade', 'admin')).min(1).optional(),
  isActive: Joi.boolean().optional(),
  expiresAt: Joi.date().optional().allow(null),
  rateLimitPerHour: Joi.number().integer().min(100).max(10000).optional(),
  ipWhitelist: Joi.array().items(Joi.string().ip()).optional()
});

// Generate secure API key and secret
function generateApiCredentials() {
  const apiKey = 'tk_' + crypto.randomBytes(30).toString('hex'); // 64 chars total
  const apiSecret = crypto.randomBytes(64).toString('hex'); // 128 chars
  return { apiKey, apiSecret };
}

// Hash API secret for storage
function hashApiSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

// Get user's personal API key (one per user)
router.get('/', asyncHandler(async (req, res) => {
  const [apiKey] = await executeQuery(`
    SELECT 
      id,
      api_key,
      api_secret,
      is_active,
      last_used_at,
      expires_at,
      usage_count,
      rate_limit_per_hour,
      ip_whitelist,
      created_at,
      updated_at
    FROM api_keys 
    WHERE user_id = ?
  `, [req.user.id]);

  if (!apiKey) {
    return res.json({
      success: true,
      data: null,
      message: 'No API key found. Create your personal trading API key.'
    });
  }

  // Remove IP whitelist logic: always allow any IP
  const ipWhitelist = [];


  console.log('DEBUG: Returning API key details:', {
    key_id: apiKey.api_key,
    secret_key: apiKey.api_secret,
    status: apiKey.is_active ? 'active' : 'inactive',
    permissions: ['read', 'trade']
  });
  const formattedKey = {
    ...apiKey,
    key_id: apiKey.api_key,
    secret_key: apiKey.api_secret, // Show actual secret
    status: apiKey.is_active ? 'active' : 'inactive',
    permissions: ['read', 'trade']
  };

  res.json({
    success: true,
    data: formattedKey
  });
}));

// Create user's personal API key (one per user)
router.post('/', asyncHandler(async (req, res) => {
  // Check if user already has an API key
  const [existingKey] = await executeQuery(
    'SELECT id FROM api_keys WHERE user_id = ?',
    [req.user.id]
  );

  if (existingKey) {
    throw new AppError('You already have a personal API key. Only one API key per user is allowed.', 400);
  }

  // Remove IP whitelist logic: always allow any IP
  const ipWhitelist = [];

  // Generate API credentials
  const { apiKey, apiSecret } = generateApiCredentials();
  console.log('DEBUG: Creating API key:', { apiKey, apiSecret });

  // Insert new personal API key with trading permissions
  const result = await executeQuery(`
    INSERT INTO api_keys (
      user_id, 
      key_name, 
      api_key, 
      api_secret, 
      permissions, 
      rate_limit_per_hour, 
      ip_whitelist
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    req.user.id,
    'Personal Trading API Key',
    apiKey,
    apiSecret, // Store plain secret instead of hash
    JSON.stringify(['read', 'trade']), // Personal API keys have read and trade permissions
    5000, // Higher rate limit for personal trading API
    JSON.stringify([])
  ]);

  // Return the new API key (including secret - this is the only time it's shown)
  res.status(201).json({
    success: true,
    data: {
      id: result.insertId,
      key_id: apiKey,
      secret_key: apiSecret, // IMPORTANT: This is shown only once
      status: 'active',
      permissions: ['read', 'trade'],
      rate_limit: 5000,
      message: 'IMPORTANT: Save your API secret now. You won\'t be able to see it again!'
    }
  });
}));

// Update personal API key
router.put('/', asyncHandler(async (req, res) => {
  // Check if user has an API key
  const [existingKey] = await executeQuery(
    'SELECT id FROM api_keys WHERE user_id = ?',
    [req.user.id]
  );

  if (!existingKey) {
    throw new AppError('No API key found. Create your personal API key first.', 404);
  }

  const { isActive, ipWhitelist } = req.body;

  // Build update query dynamically
  const updateFields = [];
  const updateValues = [];

  if (typeof isActive === 'boolean') {
    updateFields.push('is_active = ?');
    updateValues.push(isActive);
  }

  if (ipWhitelist && Array.isArray(ipWhitelist)) {
    updateFields.push('ip_whitelist = ?');
    updateValues.push(JSON.stringify(ipWhitelist));
  }

  if (updateFields.length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(req.user.id);

  await executeQuery(
    `UPDATE api_keys SET ${updateFields.join(', ')} WHERE user_id = ?`,
    updateValues
  );

  res.json({
    success: true,
    message: 'Personal API key updated successfully'
  });
}));

// Delete personal API key
router.delete('/', asyncHandler(async (req, res) => {
  // Check if user has an API key
  const [existingKey] = await executeQuery(
    'SELECT id FROM api_keys WHERE user_id = ?',
    [req.user.id]
  );

  if (!existingKey) {
    throw new AppError('No API key found to delete', 404);
  }

  // Delete the personal API key
  await executeQuery('DELETE FROM api_keys WHERE user_id = ?', [req.user.id]);

  res.json({
    success: true,
    message: 'Personal API key deleted successfully'
  });
}));

// Get personal API key usage statistics
router.get('/usage', asyncHandler(async (req, res) => {
  // Check if user has an API key
  const [existingKey] = await executeQuery(
    'SELECT id FROM api_keys WHERE user_id = ?',
    [req.user.id]
  );

  if (!existingKey) {
    throw new AppError('No API key found', 404);
  }

  const keyId = existingKey.id;

  // Get usage statistics
  const [usageStats] = await executeQuery(`
    SELECT 
      COUNT(*) as total_requests,
      COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) as requests_24h,
      COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as requests_7d,
      COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as requests_30d,
      AVG(response_time_ms) as avg_response_time,
      COUNT(CASE WHEN response_status >= 400 THEN 1 END) as error_requests
    FROM api_usage_logs 
    WHERE api_key_id = ?
  `, [keyId]);

  // Get recent usage by endpoint
  const recentUsage = await executeQuery(`
    SELECT 
      endpoint,
      method,
      COUNT(*) as request_count,
      AVG(response_time_ms) as avg_response_time,
      MAX(created_at) as last_used
    FROM api_usage_logs 
    WHERE api_key_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    GROUP BY endpoint, method
    ORDER BY request_count DESC
    LIMIT 10
  `, [keyId]);

  res.json({
    success: true,
    data: {
      statistics: usageStats,
      recentUsage
    }
  });
}));

// Regenerate API secret (invalidates old secret)
router.post('/:keyId/regenerate', asyncHandler(async (req, res) => {
  const keyId = parseInt(req.params.keyId);

  // Check if API key exists and belongs to user
  const [existingKey] = await executeQuery(
    'SELECT id, key_name FROM api_keys WHERE id = ? AND user_id = ?',
    [keyId, req.user.id]
  );

  if (existingKey.length === 0) {
    throw new AppError('API key not found', 404);
  }

  // Generate new secret
  const { apiSecret } = generateApiCredentials();
  const hashedSecret = hashApiSecret(apiSecret);

  // Update the API key with new secret
  await executeQuery(
    'UPDATE api_keys SET api_secret = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [hashedSecret, keyId]
  );

  res.json({
    success: true,
    data: {
      keyName: existingKey[0].key_name,
      newApiSecret: apiSecret,
      message: 'IMPORTANT: Save your new API secret now. You won\'t be able to see it again!'
    }
  });
}));

module.exports = router;