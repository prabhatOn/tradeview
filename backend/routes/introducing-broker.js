const express = require('express');
const crypto = require('crypto');
const Joi = require('joi');
const { executeQuery } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const IntroducingBrokerService = require('../services/IntroducingBrokerService');
const IntroducingBroker = require('../models/IntroducingBroker');
const { adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const createReferralCodeSchema = Joi.object({
  code: Joi.string().alphanum().min(6).max(20).optional(),
  maxUsage: Joi.number().integer().min(1).optional(),
  expiresAt: Joi.date().optional()
});

const addClientSchema = Joi.object({
  clientEmail: Joi.string().email().required(),
  commissionRate: Joi.number().min(0).max(1).default(0.0070) // 70 cents per lot default
});

// Helper to require IB role
function requireIbRole(req) {
  const roles = req.user?.roles || [];
  if (!roles.includes('IB') && !roles.includes('Admin') && !roles.includes('Manager')) {
    throw new AppError('IB access required. Your account must be approved as an IB.', 403);
  }
}

// Get IB dashboard statistics
router.get('/dashboard', asyncHandler(async (req, res) => {
  requireIbRole(req);
  const userId = req.user.id;

  const dashboardData = await IntroducingBrokerService.getIbDashboard(userId);

  res.json({
    success: true,
    data: dashboardData
  });
}));

// Get user's referral codes
router.get('/referral-codes', asyncHandler(async (req, res) => {
  const referralCodes = await executeQuery(`
    SELECT 
      id,
      code,
      is_active,
      usage_count,
      max_usage,
      expires_at,
      created_at
    FROM referral_codes 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `, [req.user.id]);

  res.json({
    success: true,
    data: referralCodes
  });
}));

// Create new referral code
router.post('/referral-codes', asyncHandler(async (req, res) => {
  requireIbRole(req);
  // Validate input
  const { error, value } = createReferralCodeSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { maxUsage, expiresAt } = value;
  let { code } = value;

  // Generate code if not provided
  if (!code) {
    code = generateReferralCode();
    
    // Ensure uniqueness
    let attempts = 0;
    while (attempts < 10) {
      const [existing] = await executeQuery(
        'SELECT id FROM referral_codes WHERE code = ?',
        [code]
      );
      
      if (existing.length === 0) break;
      
      code = generateReferralCode();
      attempts++;
    }
    
    if (attempts >= 10) {
      throw new AppError('Unable to generate unique referral code. Please try again.', 500);
    }
  } else {
    // Check if custom code is unique
    const [existing] = await executeQuery(
      'SELECT id FROM referral_codes WHERE code = ?',
      [code]
    );
    
    if (existing.length > 0) {
      throw new AppError('Referral code already exists. Please choose a different code.', 400);
    }
  }

  // Check user limit (max 3 active referral codes)
  const [activeCount] = await executeQuery(
    'SELECT COUNT(*) as count FROM referral_codes WHERE user_id = ? AND is_active = 1',
    [req.user.id]
  );

  if (activeCount.count >= 3) {
    throw new AppError('Maximum of 3 active referral codes allowed', 400);
  }

  // Create referral code
  const result = await executeQuery(`
    INSERT INTO referral_codes (user_id, code, max_usage, expires_at)
    VALUES (?, ?, ?, ?)
  `, [req.user.id, code, maxUsage, expiresAt]);

  res.status(201).json({
    success: true,
    data: {
      id: result.insertId,
      code,
      maxUsage,
      expiresAt,
      referralLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?ref=${code}`
    }
  });
}));

// Toggle referral code active status
router.patch('/referral-codes/:codeId/toggle', asyncHandler(async (req, res) => {
  requireIbRole(req);
  const codeId = parseInt(req.params.codeId);

  // Check if code exists and belongs to user
  const [existingCode] = await executeQuery(
    'SELECT id, is_active FROM referral_codes WHERE id = ? AND user_id = ?',
    [codeId, req.user.id]
  );

  if (existingCode.length === 0) {
    throw new AppError('Referral code not found', 404);
  }

  const newStatus = !existingCode[0].is_active;

  await executeQuery(
    'UPDATE referral_codes SET is_active = ? WHERE id = ?',
    [newStatus, codeId]
  );

  res.json({
    success: true,
    message: `Referral code ${newStatus ? 'activated' : 'deactivated'} successfully`
  });
}));

// Add a new client to IB program
router.post('/clients', asyncHandler(async (req, res) => {
  requireIbRole(req);
  // Validate input
  const { error, value } = addClientSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { clientEmail, commissionRate } = value;
  const ibUserId = req.user.id;

  // Prevent adding self
  if (req.user.email && req.user.email.toLowerCase() === clientEmail.toLowerCase()) {
    throw new AppError('You cannot add yourself as a client', 400);
  }

  const result = await IntroducingBrokerService.createIbRelationship(ibUserId, clientEmail, commissionRate);

  const message = result.alreadyExists
    ? 'Client is already in your IB program'
    : 'Client added to IB program successfully';

  res.json({
    success: true,
    message: message,
    data: result,
    alreadyExists: result.alreadyExists
  });
}));
router.get('/clients', asyncHandler(async (req, res) => {
  requireIbRole(req);
  const ibUserId = req.user.id;

  const clients = await IntroducingBrokerService.getIbClientsWithPerformance(ibUserId);

  res.json({
    success: true,
    data: clients
  });
}));

// Get client trading history
router.get('/clients/:clientId/trades', asyncHandler(async (req, res) => {
  requireIbRole(req);
  const clientId = parseInt(req.params.clientId);
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  // Verify client belongs to this IB
  const [ibRelation] = await executeQuery(
    'SELECT id FROM introducing_brokers WHERE ib_user_id = ? AND client_user_id = ?',
    [req.user.id, clientId]
  );

  if (ibRelation.length === 0) {
    throw new AppError('Client not found or not associated with your IB account', 404);
  }

  // Get client's trading history
  const trades = await executeQuery(`
    SELECT 
      th.id,
      th.symbol,
      th.side,
      th.lot_size,
      th.open_price,
      th.close_price,
      th.profit_loss,
      th.commission,
      th.swap,
      th.opened_at,
      th.closed_at,
      ic.commission_amount as ib_commission
    FROM trade_history th
    JOIN trading_accounts ta ON th.account_id = ta.id
    LEFT JOIN ib_commissions ic ON th.id = ic.trade_id
    WHERE ta.user_id = ?
    ORDER BY th.closed_at DESC
    LIMIT ? OFFSET ?
  `, [clientId, parseInt(limit), offset]);

  // Get total count
  const [totalCount] = await executeQuery(`
    SELECT COUNT(*) as count
    FROM trade_history th
    JOIN trading_accounts ta ON th.account_id = ta.id
    WHERE ta.user_id = ?
  `, [clientId]);

  res.json({
    success: true,
    data: {
      trades,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount.count,
        totalPages: Math.ceil(totalCount.count / limit)
      }
    }
  });
}));

// Get commission history
router.get('/commissions', asyncHandler(async (req, res) => {
  requireIbRole(req);
  const { page = 1, limit = 20, status, clientId } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE ib.ib_user_id = ?';
  let queryParams = [req.user.id];

  if (status) {
    whereClause += ' AND ic.status = ?';
    queryParams.push(status);
  }

  if (clientId) {
    whereClause += ' AND ib.client_user_id = ?';
    queryParams.push(parseInt(clientId));
  }

  // Get commissions with client info
  const commissions = await executeQuery(`
    SELECT 
      ic.id,
      ic.commission_amount,
      ic.commission_rate,
      ic.trade_volume,
      ic.currency,
      ic.status,
      ic.paid_at,
      ic.created_at,
      ic.notes,
      u.first_name,
      u.last_name,
      u.email,
      th.symbol,
      th.side,
      th.profit_loss as trade_profit
    FROM ib_commissions ic
    JOIN introducing_brokers ib ON ic.ib_relationship_id = ib.id
    JOIN users u ON ib.client_user_id = u.id
    LEFT JOIN trade_history th ON ic.trade_id = th.id
    ${whereClause}
    ORDER BY ic.created_at DESC
    LIMIT ? OFFSET ?
  `, [...queryParams, parseInt(limit), offset]);

  // Get total count and summary
  const [summary] = await executeQuery(`
    SELECT 
      COUNT(*) as total_commissions,
      COALESCE(SUM(ic.commission_amount), 0) as total_amount,
      COALESCE(SUM(CASE WHEN ic.status = 'paid' THEN ic.commission_amount ELSE 0 END), 0) as paid_amount,
      COALESCE(SUM(CASE WHEN ic.status = 'pending' THEN ic.commission_amount ELSE 0 END), 0) as pending_amount
    FROM ib_commissions ic
    JOIN introducing_brokers ib ON ic.ib_relationship_id = ib.id
    ${whereClause}
  `, queryParams);

  res.json({
    success: true,
    data: {
      commissions,
      summary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: summary.total_commissions,
        totalPages: Math.ceil(summary.total_commissions / limit)
      }
    }
  });
}));

// Request commission payout
router.post('/commissions/request-payout', asyncHandler(async (req, res) => {
  requireIbRole(req);
  const { amount, currency = 'USD', notes } = req.body;

  if (!amount || amount <= 0) {
    throw new AppError('Invalid payout amount', 400);
  }

  // Check available commission balance
  const [balance] = await executeQuery(`
    SELECT COALESCE(SUM(ic.commission_amount), 0) as available_balance
    FROM ib_commissions ic
    JOIN introducing_brokers ib ON ic.ib_relationship_id = ib.id
    WHERE ib.ib_user_id = ? AND ic.status = 'pending'
  `, [req.user.id]);

  if (balance.available_balance < amount) {
    throw new AppError('Insufficient commission balance for payout request', 400);
  }

  // Create payout request (this would typically integrate with payment processing)
  // For now, we'll create a withdrawal record
  const result = await executeQuery(`
    INSERT INTO withdrawals (
      user_id, 
      amount, 
      currency, 
      transaction_type,
      status, 
      admin_notes,
      created_at
    ) VALUES (?, ?, ?, 'commission_payout', 'pending_approval', ?, NOW())
  `, [req.user.id, amount, currency, `IB Commission Payout Request: ${notes || ''}`]);

  res.json({
    success: true,
    message: 'Commission payout request submitted successfully',
    data: {
      requestId: result.insertId,
      amount,
      currency,
      status: 'pending_approval'
    }
  });
}));

// --- IB ROLE MANAGEMENT ---
// Public: apply to become IB (creates a pending request)
router.post('/apply', asyncHandler(async (req, res) => {
  // If already IB, short-circuit
  const roles = req.user.roles || [];
  if (roles.includes('IB')) {
    return res.json({ success: true, message: 'You are already approved as an IB' });
  }

  // Create or upsert application
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS ib_applications (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await executeQuery(`
    INSERT INTO ib_applications (user_id, status) VALUES (?, 'pending')
    ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = CURRENT_TIMESTAMP
  `, [req.user.id]);

  res.json({ success: true, message: 'IB application submitted. An admin will review your request.' });
}));

// Admin: approve IB
router.post('/admin/approve', adminMiddleware, asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) throw new AppError('userId is required', 400);

  // Ensure applications table exists
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS ib_applications (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Ensure IB role exists
  await executeQuery(`INSERT IGNORE INTO roles (name, description, is_admin) VALUES ('IB', 'Introducing Broker', FALSE)`);
  // Get role id
  const roles = await executeQuery(`SELECT id FROM roles WHERE name='IB' LIMIT 1`);
  const roleId = roles[0]?.id;
  if (!roleId) throw new AppError('Failed to resolve IB role', 500);

  // Assign role to user
  await executeQuery(`INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`, [parseInt(userId), roleId]);

  // Mark application approved if exists
  await executeQuery(`UPDATE ib_applications SET status='approved' WHERE user_id = ?`, [parseInt(userId)]);

  res.json({ success: true, message: 'User approved as IB' });
}));

// Admin: revoke IB
router.post('/admin/revoke', adminMiddleware, asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) throw new AppError('userId is required', 400);

  // Ensure applications table exists
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS ib_applications (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const roles = await executeQuery(`SELECT id FROM roles WHERE name='IB' LIMIT 1`);
  const roleId = roles[0]?.id;
  if (!roleId) return res.json({ success: true, message: 'IB role not found; nothing to revoke' });

  await executeQuery(`DELETE FROM user_roles WHERE user_id = ? AND role_id = ?`, [parseInt(userId), roleId]);
  await executeQuery(`UPDATE ib_applications SET status='rejected' WHERE user_id = ?`, [parseInt(userId)]);

  res.json({ success: true, message: 'IB role revoked for user' });
}));

// Get my IB status
router.get('/status', asyncHandler(async (req, res) => {
  // Ensure applications table exists defensively
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS ib_applications (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const roles = req.user.roles || [];
  const isIB = roles.includes('IB');
  const apps = await executeQuery(`SELECT status FROM ib_applications WHERE user_id = ?`, [req.user.id]);
  const applicationStatus = apps[0]?.status || (isIB ? 'approved' : 'not_applied');
  res.json({ success: true, data: { isIB, applicationStatus } });
}));

module.exports = router;