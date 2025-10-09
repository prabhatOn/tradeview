const express = require('express');
const Joi = require('joi');
const { executeQuery } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const createGatewaySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  displayName: Joi.string().min(1).max(100).required(),
  type: Joi.string().valid('bank_transfer', 'credit_card', 'debit_card', 'crypto', 'e_wallet', 'wire_transfer').required(),
  provider: Joi.string().max(50).optional(),
  minAmount: Joi.number().min(0).default(0),
  maxAmount: Joi.number().min(0).default(999999.99),
  processingFeeType: Joi.string().valid('fixed', 'percentage').default('percentage'),
  processingFeeValue: Joi.number().min(0).default(0),
  processingTimeHours: Joi.number().integer().min(0).default(24),
  supportedCurrencies: Joi.array().items(Joi.string().length(3)).default(['USD']),
  description: Joi.string().max(500).optional(),
  iconUrl: Joi.string().uri().optional(),
  configuration: Joi.object().optional()
});

const updateGatewaySchema = Joi.object({
  displayName: Joi.string().min(1).max(100).optional(),
  isActive: Joi.boolean().optional(),
  minAmount: Joi.number().min(0).optional(),
  maxAmount: Joi.number().min(0).optional(),
  processingFeeType: Joi.string().valid('fixed', 'percentage').optional(),
  processingFeeValue: Joi.number().min(0).optional(),
  processingTimeHours: Joi.number().integer().min(0).optional(),
  supportedCurrencies: Joi.array().items(Joi.string().length(3)).optional(),
  description: Joi.string().max(500).optional(),
  iconUrl: Joi.string().uri().optional(),
  configuration: Joi.object().optional(),
  sortOrder: Joi.number().integer().optional()
});

// Get all payment gateways (public - for user selection)
router.get('/', asyncHandler(async (req, res) => {
  const { currency } = req.query;
  
  let whereClause = 'WHERE is_active = 1';
  let queryParams = [];
  
  if (currency) {
    whereClause += ' AND JSON_CONTAINS(supported_currencies, ?)';
    queryParams.push(`"${currency}"`);
  }
  
  const gateways = await executeQuery(`
    SELECT 
      id,
      name,
      display_name,
      type,
      min_amount,
      max_amount,
      processing_fee_type,
      processing_fee_value,
      processing_time_hours,
      supported_currencies,
      description,
      icon_url,
      sort_order
    FROM payment_gateways 
    ${whereClause}
    ORDER BY sort_order ASC, display_name ASC
  `, queryParams);

  // Parse JSON fields
  const formattedGateways = gateways.map(gateway => ({
    ...gateway,
    supported_currencies: JSON.parse(gateway.supported_currencies || '[]')
  }));

  res.json({
    success: true,
    data: formattedGateways
  });
}));

// Admin: Get all payment gateways with full details
router.get('/admin', adminMiddleware, asyncHandler(async (req, res) => {
  const gateways = await executeQuery(`
    SELECT 
      *,
      (SELECT COUNT(*) FROM deposits WHERE payment_gateway_id = pg.id) as total_deposits,
      (SELECT COUNT(*) FROM withdrawals WHERE payment_gateway_id = pg.id) as total_withdrawals,
      (SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE payment_gateway_id = pg.id AND status = 'completed') as total_deposit_volume,
      (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE payment_gateway_id = pg.id AND status = 'completed') as total_withdrawal_volume
    FROM payment_gateways pg
    ORDER BY sort_order ASC, display_name ASC
  `);

  // Parse JSON fields
  const formattedGateways = gateways.map(gateway => ({
    ...gateway,
    supported_currencies: JSON.parse(gateway.supported_currencies || '[]'),
    configuration: JSON.parse(gateway.configuration || '{}')
  }));

  res.json({
    success: true,
    data: formattedGateways
  });
}));

// Admin: Create new payment gateway
router.post('/admin', adminMiddleware, asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = createGatewaySchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const {
    name, displayName, type, provider, minAmount, maxAmount,
    processingFeeType, processingFeeValue, processingTimeHours,
    supportedCurrencies, description, iconUrl, configuration
  } = value;

  // Check for duplicate name
  const [existing] = await executeQuery(
    'SELECT id FROM payment_gateways WHERE name = ?',
    [name]
  );

  if (existing.length > 0) {
    throw new AppError('Payment gateway name must be unique', 400);
  }

  // Get next sort order
  const [maxSort] = await executeQuery('SELECT COALESCE(MAX(sort_order), 0) + 1 as next_sort FROM payment_gateways');
  const sortOrder = maxSort.next_sort;

  // Create payment gateway
  const result = await executeQuery(`
    INSERT INTO payment_gateways (
      name, display_name, type, provider, min_amount, max_amount,
      processing_fee_type, processing_fee_value, processing_time_hours,
      supported_currencies, description, icon_url, configuration, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    name, displayName, type, provider, minAmount, maxAmount,
    processingFeeType, processingFeeValue, processingTimeHours,
    JSON.stringify(supportedCurrencies), description, iconUrl,
    JSON.stringify(configuration || {}), sortOrder
  ]);

  res.status(201).json({
    success: true,
    data: {
      id: result.insertId,
      name,
      displayName,
      message: 'Payment gateway created successfully'
    }
  });
}));

// Admin: Update payment gateway
router.put('/admin/:gatewayId', adminMiddleware, asyncHandler(async (req, res) => {
  const gatewayId = parseInt(req.params.gatewayId);
  
  // Validate input
  const { error, value } = updateGatewaySchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  // Check if gateway exists
  const [existing] = await executeQuery(
    'SELECT id FROM payment_gateways WHERE id = ?',
    [gatewayId]
  );

  if (existing.length === 0) {
    throw new AppError('Payment gateway not found', 404);
  }

  // Build update query dynamically
  const updateFields = [];
  const updateValues = [];

  Object.entries(value).forEach(([key, val]) => {
    if (val !== undefined) {
      switch (key) {
        case 'displayName':
          updateFields.push('display_name = ?');
          updateValues.push(val);
          break;
        case 'isActive':
          updateFields.push('is_active = ?');
          updateValues.push(val);
          break;
        case 'minAmount':
          updateFields.push('min_amount = ?');
          updateValues.push(val);
          break;
        case 'maxAmount':
          updateFields.push('max_amount = ?');
          updateValues.push(val);
          break;
        case 'processingFeeType':
          updateFields.push('processing_fee_type = ?');
          updateValues.push(val);
          break;
        case 'processingFeeValue':
          updateFields.push('processing_fee_value = ?');
          updateValues.push(val);
          break;
        case 'processingTimeHours':
          updateFields.push('processing_time_hours = ?');
          updateValues.push(val);
          break;
        case 'supportedCurrencies':
          updateFields.push('supported_currencies = ?');
          updateValues.push(JSON.stringify(val));
          break;
        case 'description':
          updateFields.push('description = ?');
          updateValues.push(val);
          break;
        case 'iconUrl':
          updateFields.push('icon_url = ?');
          updateValues.push(val);
          break;
        case 'configuration':
          updateFields.push('configuration = ?');
          updateValues.push(JSON.stringify(val));
          break;
        case 'sortOrder':
          updateFields.push('sort_order = ?');
          updateValues.push(val);
          break;
      }
    }
  });

  if (updateFields.length === 0) {
    throw new AppError('No fields to update', 400);
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(gatewayId);

  await executeQuery(
    `UPDATE payment_gateways SET ${updateFields.join(', ')} WHERE id = ?`,
    updateValues
  );

  res.json({
    success: true,
    message: 'Payment gateway updated successfully'
  });
}));

// Admin: Delete payment gateway
router.delete('/admin/:gatewayId', adminMiddleware, asyncHandler(async (req, res) => {
  const gatewayId = parseInt(req.params.gatewayId);

  // Check if gateway exists
  const [existing] = await executeQuery(
    'SELECT id, name FROM payment_gateways WHERE id = ?',
    [gatewayId]
  );

  if (existing.length === 0) {
    throw new AppError('Payment gateway not found', 404);
  }

  // Check if gateway is being used
  const [usageCheck] = await executeQuery(`
    SELECT 
      (SELECT COUNT(*) FROM deposits WHERE payment_gateway_id = ?) as deposit_count,
      (SELECT COUNT(*) FROM withdrawals WHERE payment_gateway_id = ?) as withdrawal_count
  `, [gatewayId, gatewayId]);

  if (usageCheck.deposit_count > 0 || usageCheck.withdrawal_count > 0) {
    throw new AppError('Cannot delete payment gateway that has been used for transactions. Deactivate it instead.', 400);
  }

  // Delete the gateway
  await executeQuery('DELETE FROM payment_gateways WHERE id = ?', [gatewayId]);

  res.json({
    success: true,
    message: 'Payment gateway deleted successfully'
  });
}));

// Admin: Toggle payment gateway status
router.patch('/admin/:gatewayId/toggle', adminMiddleware, asyncHandler(async (req, res) => {
  const gatewayId = parseInt(req.params.gatewayId);

  // Check if gateway exists
  const [existing] = await executeQuery(
    'SELECT id, is_active, display_name FROM payment_gateways WHERE id = ?',
    [gatewayId]
  );

  if (existing.length === 0) {
    throw new AppError('Payment gateway not found', 404);
  }

  const newStatus = !existing[0].is_active;

  await executeQuery(
    'UPDATE payment_gateways SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newStatus, gatewayId]
  );

  res.json({
    success: true,
    message: `Payment gateway ${newStatus ? 'activated' : 'deactivated'} successfully`,
    data: {
      gatewayName: existing[0].display_name,
      isActive: newStatus
    }
  });
}));

// Admin: Reorder payment gateways
router.post('/admin/reorder', adminMiddleware, asyncHandler(async (req, res) => {
  const { gatewayIds } = req.body; // Array of gateway IDs in desired order

  if (!Array.isArray(gatewayIds)) {
    throw new AppError('gatewayIds must be an array', 400);
  }

  // Update sort order for each gateway
  const queries = gatewayIds.map((gatewayId, index) => ({
    sql: 'UPDATE payment_gateways SET sort_order = ? WHERE id = ?',
    params: [index + 1, gatewayId]
  }));

  if (queries.length > 0) {
    await Promise.all(queries.map(query => executeQuery(query.sql, query.params)));
  }

  res.json({
    success: true,
    message: 'Payment gateway order updated successfully'
  });
}));

// Admin: Get payment gateway statistics
router.get('/admin/:gatewayId/stats', adminMiddleware, asyncHandler(async (req, res) => {
  const gatewayId = parseInt(req.params.gatewayId);
  const { period = '30d' } = req.query;

  // Determine date filter based on period
  let dateFilter = '';
  switch (period) {
    case '7d':
      dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
      break;
    case '30d':
      dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
      break;
    case '90d':
      dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)';
      break;
    case '1y':
      dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
      break;
    default:
      dateFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
  }

  // Get gateway statistics
  const [stats] = await executeQuery(`
    SELECT 
      pg.display_name,
      (SELECT COUNT(*) FROM deposits WHERE payment_gateway_id = ? ${dateFilter}) as deposit_count,
      (SELECT COUNT(*) FROM withdrawals WHERE payment_gateway_id = ? ${dateFilter}) as withdrawal_count,
      (SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE payment_gateway_id = ? AND status = 'completed' ${dateFilter}) as total_deposits,
      (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE payment_gateway_id = ? AND status = 'completed' ${dateFilter}) as total_withdrawals,
      (SELECT COALESCE(SUM(transaction_fee), 0) FROM deposits WHERE payment_gateway_id = ? ${dateFilter}) as total_deposit_fees,
      (SELECT COALESCE(SUM(transaction_fee), 0) FROM withdrawals WHERE payment_gateway_id = ? ${dateFilter}) as total_withdrawal_fees
    FROM payment_gateways pg
    WHERE pg.id = ?
  `, [gatewayId, gatewayId, gatewayId, gatewayId, gatewayId, gatewayId, gatewayId]);

  // Get daily transaction volumes for chart
  const dailyVolumes = await executeQuery(`
    SELECT 
      DATE(created_at) as date,
      COUNT(CASE WHEN amount > 0 THEN 1 END) as deposit_count,
      COUNT(CASE WHEN amount < 0 THEN 1 END) as withdrawal_count,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as deposit_volume,
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as withdrawal_volume
    FROM (
      SELECT created_at, amount FROM deposits WHERE payment_gateway_id = ? ${dateFilter}
      UNION ALL
      SELECT created_at, -amount FROM withdrawals WHERE payment_gateway_id = ? ${dateFilter}
    ) as transactions
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30
  `, [gatewayId, gatewayId]);

  res.json({
    success: true,
    data: {
      statistics: stats,
      dailyVolumes,
      period
    }
  });
}));

module.exports = router;