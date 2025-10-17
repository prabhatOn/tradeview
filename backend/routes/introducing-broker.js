/* eslint-disable import/no-commonjs */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
const express = require('express');
const Joi = require('joi');
const { executeQuery } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const IntroducingBrokerService = require('../services/IntroducingBrokerService');
const { adminMiddleware } = require('../middleware/auth');
const NotificationService = require('../services/NotificationService');

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

const IB_APPLICATIONS_TABLE_SQL = `
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
  `;

const ensureIbApplicationsTable = () => executeQuery(IB_APPLICATIONS_TABLE_SQL);

const ADMIN_NOTIFICATION_ROLES = ['admin', 'manager', 'super_admin'];

const getAdminUserIds = async (excludeUserId) => {
  const rows = await executeQuery(
    `SELECT DISTINCT ur.user_id
     FROM user_roles ur
     INNER JOIN roles r ON r.id = ur.role_id
     WHERE LOWER(r.name) IN (${ADMIN_NOTIFICATION_ROLES.map(() => '?').join(', ')})` ,
    ADMIN_NOTIFICATION_ROLES
  );

  return rows
    .map((row) => row.user_id)
    .filter((userId) => typeof userId === 'number' && userId !== excludeUserId);
};

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

  const maxUsage = value.maxUsage ?? null;
  const expiresAt = value.expiresAt ?? null;
  let { code } = value;

  // Generate code if not provided
  if (!code) {
    code = IntroducingBrokerService.generateReferralCode();
    
    // Ensure uniqueness
    let attempts = 0;
    while (attempts < 10) {
      const existingRows = await executeQuery(
        'SELECT id FROM referral_codes WHERE code = ?',
        [code]
      );
      
      if (existingRows.length === 0) break;

      code = IntroducingBrokerService.generateReferralCode();
      attempts++;
    }
    
    if (attempts >= 10) {
      throw new AppError('Unable to generate unique referral code. Please try again.', 500);
    }
  } else {
    // Check if custom code is unique
    const existingRows = await executeQuery(
      'SELECT id FROM referral_codes WHERE code = ?',
      [code]
    );
    
    if (existingRows.length > 0) {
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
  const existingCodeRows = await executeQuery(
    'SELECT id, is_active FROM referral_codes WHERE id = ? AND user_id = ?',
    [codeId, req.user.id]
  );

  if (existingCodeRows.length === 0) {
    throw new AppError('Referral code not found', 404);
  }

  const newStatus = !existingCodeRows[0].is_active;

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
  const clientId = parseInt(req.params.clientId, 10);
  const rawPage = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
  const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;

  const pageNumber = Math.max(parseInt(rawPage, 10) || 1, 1);
  const limitNumber = Math.min(Math.max(parseInt(rawLimit, 10) || 20, 1), 100);
  const offset = (pageNumber - 1) * limitNumber;

  // Verify client belongs to this IB
  const ibRelations = await executeQuery(
    'SELECT id FROM introducing_brokers WHERE ib_user_id = ? AND client_user_id = ?',
    [req.user.id, clientId]
  );

  if (!ibRelations.length) {
    throw new AppError('Client not found or not associated with your IB account', 404);
  }

  // Get client's trading history
  const tradesRaw = await executeQuery(`
    SELECT 
      th.id,
      s.symbol,
      th.side,
      th.lot_size,
      th.open_price,
      th.close_price,
  COALESCE(th.profit, 0) AS profit_loss,
      th.commission,
      th.swap,
      th.opened_at,
      th.closed_at,
      ic.commission_amount AS ib_commission
    FROM trade_history th
    JOIN trading_accounts ta ON th.account_id = ta.id
    LEFT JOIN symbols s ON th.symbol_id = s.id
    LEFT JOIN ib_commissions ic ON th.id = ic.trade_id
    WHERE ta.user_id = ?
      AND th.side IS NOT NULL
    ORDER BY COALESCE(th.closed_at, th.opened_at) DESC
    LIMIT ? OFFSET ?
  `, [clientId, limitNumber, offset]);

  const normalizeNumber = (value, fallback = null) => {
    if (value === null || value === undefined) {
      return fallback;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : fallback;
    }

    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const normalizeDate = (value) => {
    if (!value) {
      return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };

  const trades = tradesRaw.map((trade) => ({
    id: Number(trade.id),
    symbol: trade.symbol || null,
    side: trade.side || null,
    lot_size: normalizeNumber(trade.lot_size, 0),
    open_price: normalizeNumber(trade.open_price),
    close_price: normalizeNumber(trade.close_price),
    profit_loss: normalizeNumber(trade.profit_loss, 0),
    commission: normalizeNumber(trade.commission, 0),
    swap: normalizeNumber(trade.swap, 0),
    opened_at: normalizeDate(trade.opened_at),
    closed_at: normalizeDate(trade.closed_at),
    ib_commission: normalizeNumber(trade.ib_commission),
  }));

  // Get total count
  const [totalCountRow] = await executeQuery(`
    SELECT COUNT(*) as count
    FROM trade_history th
    JOIN trading_accounts ta ON th.account_id = ta.id
    WHERE ta.user_id = ?
  `, [clientId]);

  const openPositionsRaw = await executeQuery(`
    SELECT 
      p.id,
      s.symbol,
      p.side,
      p.lot_size,
      p.open_price,
      p.current_price,
      p.commission,
      p.swap,
      p.opened_at,
      p.updated_at,
      p.status,
      p.profit AS unrealized_profit,
      COALESCE(SUM(ic.commission_amount), 0) AS accrued_ib_commission
    FROM positions p
    JOIN trading_accounts ta ON p.account_id = ta.id
    LEFT JOIN symbols s ON p.symbol_id = s.id
    LEFT JOIN ib_commissions ic ON ic.position_id = p.id
    WHERE ta.user_id = ?
      AND p.status IN ('open', 'partially_closed')
    GROUP BY p.id, s.symbol, p.side, p.lot_size, p.open_price, p.current_price, p.commission,
             p.swap, p.opened_at, p.updated_at, p.status, p.profit
    ORDER BY p.opened_at DESC
  `, [clientId]);

  const openPositions = openPositionsRaw.map((position) => ({
    id: position.id,
    symbol: position.symbol || null,
    side: position.side || null,
    status: position.status || 'open',
    lot_size: normalizeNumber(position.lot_size, 0),
    open_price: normalizeNumber(position.open_price),
    current_price: normalizeNumber(position.current_price),
    commission: normalizeNumber(position.commission, 0),
    swap: normalizeNumber(position.swap, 0),
    opened_at: normalizeDate(position.opened_at),
    updated_at: normalizeDate(position.updated_at),
    unrealized_profit: normalizeNumber(position.unrealized_profit, 0),
    accrued_ib_commission: normalizeNumber(position.accrued_ib_commission, 0)
  }));

  const totalCount = normalizeNumber(totalCountRow?.count, 0);

  res.json({
    success: true,
    data: {
      trades,
      openPositions,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: totalCount,
        totalPages: Math.max(Math.ceil(totalCount / limitNumber), 1)
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
  COALESCE(th.profit, 0) as trade_profit
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

  await ensureIbApplicationsTable();

  await executeQuery(`
    INSERT INTO ib_applications (user_id, status) VALUES (?, 'pending')
    ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = CURRENT_TIMESTAMP
  `, [req.user.id]);

  const adminIds = await getAdminUserIds(req.user.id);
  if (adminIds.length) {
    const applicantName = [
      req.user.first_name || req.user.firstName || '',
      req.user.last_name || req.user.lastName || '',
    ]
      .filter(Boolean)
      .join(' ')
      || req.user.email;

    await NotificationService.sendBulkNotifications(
      adminIds,
      'New IB application',
      `${applicantName} has applied to become an Introducing Broker.`,
      'info',
      {
        applicantId: req.user.id,
        applicantEmail: req.user.email,
        applicantName,
        reviewUrl: `/admin/users?userId=${req.user.id}`,
      }
    );
  }

  res.json({ success: true, message: 'IB application submitted. An admin will review your request.' });
}));

// Admin: approve IB
router.post('/admin/approve', adminMiddleware, asyncHandler(async (req, res) => {
  const userId = Number.parseInt(req.body?.userId, 10);
  if (!Number.isInteger(userId)) {
    throw new AppError('userId is required', 400);
  }

  await ensureIbApplicationsTable();

  // Ensure IB role exists
  await executeQuery(`INSERT IGNORE INTO roles (name, description, is_admin) VALUES ('IB', 'Introducing Broker', FALSE)`);
  const roles = await executeQuery(`SELECT id FROM roles WHERE name='IB' LIMIT 1`);
  const roleId = roles[0]?.id;
  if (!roleId) {
    throw new AppError('Failed to resolve IB role', 500);
  }

  // Assign role to user
  await executeQuery(`INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`, [userId, roleId]);

  // Mark application approved or create a new record
  await executeQuery(`
    INSERT INTO ib_applications (user_id, status, notes)
    VALUES (?, 'approved', 'Approved by admin')
    ON DUPLICATE KEY UPDATE status = 'approved', updated_at = CURRENT_TIMESTAMP
  `, [userId]);

  // Notify the user
  const [targetUser] = await executeQuery(`
    SELECT email, COALESCE(NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), ''), email) AS display_name
    FROM users
    WHERE id = ?
    LIMIT 1
  `, [userId]);

  if (targetUser) {
    await NotificationService.sendNotification(
      userId,
      'IB access approved',
      'Congratulations! Your account has been approved as an Introducing Broker. You can now access IB features.',
      'success',
      {
        category: 'introducing_broker',
        status: 'approved',
      }
    );
  }

  res.json({
    success: true,
    message: 'User approved as IB',
    data: {
      ibStatus: 'approved',
    },
  });
}));

// Admin: revoke IB
router.post('/admin/revoke', adminMiddleware, asyncHandler(async (req, res) => {
  const userId = Number.parseInt(req.body?.userId, 10);
  if (!Number.isInteger(userId)) {
    throw new AppError('userId is required', 400);
  }

  await ensureIbApplicationsTable();

  const roles = await executeQuery(`SELECT id FROM roles WHERE name='IB' LIMIT 1`);
  const roleId = roles[0]?.id;

  if (roleId) {
    await executeQuery(`DELETE FROM user_roles WHERE user_id = ? AND role_id = ?`, [userId, roleId]);
  }

  await executeQuery(`
    INSERT INTO ib_applications (user_id, status, notes)
    VALUES (?, 'rejected', 'Revoked by admin')
    ON DUPLICATE KEY UPDATE status = 'rejected', updated_at = CURRENT_TIMESTAMP
  `, [userId]);

  const [targetUser] = await executeQuery(`
    SELECT email FROM users WHERE id = ? LIMIT 1
  `, [userId]);

  if (targetUser) {
    await NotificationService.sendNotification(
      userId,
      'IB access revoked',
      'Your Introducing Broker access has been revoked by the administration team. Please contact support for details.',
      'warning',
      {
        category: 'introducing_broker',
        status: 'rejected',
      }
    );
  }

  res.json({
    success: true,
    message: 'IB role revoked for user',
    data: {
      ibStatus: 'rejected',
    },
  });
}));

// Get my IB status
router.get('/status', asyncHandler(async (req, res) => {
  // Ensure applications table exists defensively
  await ensureIbApplicationsTable();

  const roles = req.user.roles || [];
  const isIB = roles.includes('IB');
  const apps = await executeQuery(`SELECT status FROM ib_applications WHERE user_id = ?`, [req.user.id]);
  const applicationStatus = apps[0]?.status || (isIB ? 'approved' : 'not_applied');
  res.json({ success: true, data: { isIB, applicationStatus } });
}));

// ===== PHASE 4: NEW IB COMMISSION ROUTES =====

// Get commission summary for IB
router.get('/commissions/summary', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { dateFrom, dateTo } = req.query;

  const summary = await IntroducingBrokerService.getIBCommissionSummary(
    userId,
    dateFrom || null,
    dateTo || null
  );

  res.json({
    success: true,
    data: summary
  });
}));

// Get IB settings (global)
router.get('/settings', asyncHandler(async (req, res) => {
  const settings = await IntroducingBrokerService.getGlobalSettings();

  res.json({
    success: true,
    data: settings
  });
}));

// Get pending commissions for IB
router.get('/commissions/pending', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const pendingCommissions = await IntroducingBrokerService.getPendingCommissions(userId);

  res.json({
    success: true,
    data: pendingCommissions
  });
}));

module.exports = router;