/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require('express');
const Joi = require('joi');
const { executeQuery } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { adminMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const Position = require('../models/Position');
const TradingAccount = require('../models/TradingAccount');
const FundManager = require('../services/FundManager');
const ChargeService = require('../services/ChargeService');

const ALLOWED_LEVERAGE_VALUES = [100, 200, 500, 1000, 2000];

const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(1).max(100).required(),
  lastName: Joi.string().min(1).max(100).required(),
  phone: Joi.string().allow(null, '').optional(),
  status: Joi.string()
    .valid('active', 'inactive', 'suspended', 'pending_verification')
    .default('active'),
  role: Joi.string().valid('user', 'admin', 'manager', 'support').default('user'),
  emailVerified: Joi.boolean().default(false),
  kycStatus: Joi.string().valid('pending', 'submitted', 'approved', 'rejected').default('pending'),
  preferredLeverage: Joi.number().valid(...ALLOWED_LEVERAGE_VALUES).default(100)
});

const updateVerificationSchema = Joi.object({
  verified: Joi.boolean().required(),
  reason: Joi.string().allow(null, '').max(500).optional(),
});

const adminTradingPositionsFilterSchema = Joi.object({
  status: Joi.string().valid('open', 'closed', 'all').default('open'),
  search: Joi.string().allow('', null).optional(),
  symbol: Joi.string().allow('', null).optional(),
  side: Joi.string().valid('buy', 'sell').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string()
    .valid('opened_at', 'closed_at', 'profit', 'lot_size', 'symbol', 'user', 'account', 'status')
    .default('opened_at'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const adminTradingAccountsFilterSchema = Joi.object({
  search: Joi.string().allow('', null).optional(),
  status: Joi.string().valid('active', 'inactive', 'frozen', 'closed').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

const adminTradingOpenPositionSchema = Joi.object({
  accountId: Joi.number().integer().positive().required(),
  symbolId: Joi.number().integer().positive().required(),
  side: Joi.string().valid('buy', 'sell').required(),
  lotSize: Joi.number().positive().max(100).required(),
  stopLoss: Joi.alternatives().try(Joi.number().positive(), Joi.allow(null)).optional(),
  takeProfit: Joi.alternatives().try(Joi.number().positive(), Joi.allow(null)).optional(),
  comment: Joi.string().allow('', null).optional()
});

const adminTradingUpdatePositionSchema = Joi.object({
  lotSize: Joi.number().positive().optional(),
  stopLoss: Joi.alternatives().try(Joi.number().positive(), Joi.allow(null)).optional(),
  takeProfit: Joi.alternatives().try(Joi.number().positive(), Joi.allow(null)).optional(),
  comment: Joi.string().allow('', null).optional()
}).min(1);

const adminTradingClosePositionSchema = Joi.object({
  closePrice: Joi.number().positive().optional(),
  closeReason: Joi.string().valid('manual', 'stop_loss', 'take_profit', 'system', 'margin_call').default('manual')
});

const adminTradingHistoryFilterSchema = Joi.object({
  search: Joi.string().allow('', null).optional(),
  symbol: Joi.string().allow('', null).optional(),
  side: Joi.string().valid('buy', 'sell').optional(),
  accountId: Joi.number().integer().positive().optional(),
  userId: Joi.number().integer().positive().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional(),
  sortBy: Joi.string().valid('closed_at', 'profit', 'lot_size', 'symbol', 'user', 'account').default('closed_at'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const router = express.Router();

// All routes require admin role
router.use(adminMiddleware);

const ADMIN_ROLE_NAME = 'admin';

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

const buildAdminExclusionCondition = (alias = 'u') => `NOT EXISTS (
  SELECT 1
  FROM user_roles ur
  INNER JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = ${alias}.id AND LOWER(r.name) = '${ADMIN_ROLE_NAME}'
)`;

// Get dashboard statistics
router.get('/dashboard', asyncHandler(async (req, res) => {
  const requestStarted = process.hrtime();
  const adminExclusionCondition = buildAdminExclusionCondition('u');

  await ensureIbApplicationsTable();

  const [
    userStatsResult,
    tradingStatsResult,
    transactionStatsResult,
    positionStatsResult,
    supportStatsResult,
    newUsers24hResult,
    completedTrades24hResult,
    withdrawalsProcessed24hResult,
    depositsProcessed24hResult,
    recentUsers,
    recentClosedTrades,
    recentSupportTickets,
    recentDeposits,
    recentWithdrawals,
    pendingIbApplicationsResult,
    pendingUserVerificationsResult
  ] = await Promise.all([
    // User statistics (exclude admin accounts)
    executeQuery(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_users_30d,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
        COUNT(CASE WHEN email_verified = 1 THEN 1 END) as verified_users
      FROM users u
      WHERE ${adminExclusionCondition}
    `),

    // Trading statistics
    executeQuery(`
      SELECT 
        COUNT(*) as total_accounts,
        COALESCE(SUM(balance), 0) as total_balance,
        COALESCE(SUM(equity), 0) as total_equity,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_accounts_30d
      FROM trading_accounts
    `),

    // Transaction statistics
    executeQuery(`
      SELECT 
        (SELECT COALESCE(SUM(net_amount), 0) FROM deposits WHERE status = 'completed') as total_deposits,
        (SELECT COALESCE(SUM(net_amount), 0) FROM withdrawals WHERE status = 'completed') as total_withdrawals,
        (SELECT COUNT(*) FROM deposits WHERE status = 'pending') as pending_deposits,
        (SELECT COUNT(*) FROM withdrawals WHERE status = 'pending') as pending_withdrawals
    `),

    // Position statistics
    executeQuery(`
      SELECT 
        COUNT(*) as total_positions,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_positions,
        COALESCE(SUM(CASE WHEN status = 'closed' AND profit > 0 THEN profit ELSE 0 END), 0) as total_profits,
        COALESCE(SUM(CASE WHEN status = 'closed' AND profit < 0 THEN ABS(profit) ELSE 0 END), 0) as total_losses
      FROM positions
    `),

    // Support ticket statistics
    executeQuery(`
      SELECT
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status IN ('open', 'in_progress', 'waiting_user') THEN 1 END) as open_tickets,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tickets,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as new_tickets_7d
      FROM support_tickets
    `),

    // Highlights - new registrations in last 24 hours
    executeQuery(`
      SELECT COUNT(*) as count
      FROM users u
      WHERE ${adminExclusionCondition}
        AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
    `),

    // Highlights - closed trades in last 24 hours
    executeQuery(`
      SELECT COUNT(*) as count
      FROM trade_history
      WHERE closed_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
    `),

    // Highlights - processed withdrawals in last 24 hours
    executeQuery(`
      SELECT COUNT(*) as count
      FROM withdrawals
      WHERE status = 'completed'
        AND (
          (processed_at IS NOT NULL AND processed_at >= DATE_SUB(NOW(), INTERVAL 1 DAY))
          OR (processed_at IS NULL AND updated_at >= DATE_SUB(NOW(), INTERVAL 1 DAY))
        )
    `),

    // Highlights - processed deposits in last 24 hours
    executeQuery(`
      SELECT COUNT(*) as count
      FROM deposits
      WHERE status = 'completed'
        AND (
          (processed_at IS NOT NULL AND processed_at >= DATE_SUB(NOW(), INTERVAL 1 DAY))
          OR (processed_at IS NULL AND updated_at >= DATE_SUB(NOW(), INTERVAL 1 DAY))
        )
    `),

    // Recent user registrations
    executeQuery(`
      SELECT id, email, created_at
      FROM users u
      WHERE ${adminExclusionCondition}
      ORDER BY created_at DESC
      LIMIT 10
    `),

    // Recent closed trades
    executeQuery(`
      SELECT th.id, th.side, th.profit, th.closed_at, s.symbol, ta.account_number, u.email
      FROM trade_history th
      INNER JOIN symbols s ON s.id = th.symbol_id
      INNER JOIN trading_accounts ta ON ta.id = th.account_id
      INNER JOIN users u ON u.id = ta.user_id
      ORDER BY th.closed_at DESC
      LIMIT 10
    `),

    // Recent support ticket updates
    executeQuery(`
      SELECT st.id, st.ticket_number, st.status, st.subject, st.updated_at, u.email
      FROM support_tickets st
      INNER JOIN users u ON u.id = st.user_id
      ORDER BY st.updated_at DESC
      LIMIT 10
    `),

    // Recent completed deposits
    executeQuery(`
      SELECT d.id, d.transaction_id, d.net_amount, d.status, COALESCE(d.processed_at, d.updated_at, d.created_at) as activity_at, u.email, ta.account_number
      FROM deposits d
      INNER JOIN trading_accounts ta ON ta.id = d.account_id
      INNER JOIN users u ON u.id = ta.user_id
      WHERE d.status IN ('completed', 'pending', 'processing')
      ORDER BY activity_at DESC
      LIMIT 10
    `),

    // Recent withdrawals
    executeQuery(`
      SELECT w.id, w.transaction_id, w.net_amount, w.status, COALESCE(w.processed_at, w.updated_at, w.created_at) as activity_at, u.email, ta.account_number
      FROM withdrawals w
      INNER JOIN trading_accounts ta ON ta.id = w.account_id
      INNER JOIN users u ON u.id = ta.user_id
      WHERE w.status IN ('completed', 'pending', 'processing')
      ORDER BY activity_at DESC
      LIMIT 10
    `),

    // Pending IB applications
    executeQuery(`
      SELECT COUNT(*) as count
      FROM ib_applications
      WHERE status = 'pending'
    `),

    // Users pending verification
    executeQuery(`
      SELECT COUNT(*) as count
      FROM users u
      WHERE ${adminExclusionCondition}
        AND (u.status = 'pending_verification' OR u.kyc_status = 'pending')
    `)
  ]);

  const toNumber = (value) => {
    if (value === null || value === undefined) return 0;
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const users = userStatsResult[0] || {};
  const trading = tradingStatsResult[0] || {};
  const transactions = transactionStatsResult[0] || {};
  const positions = positionStatsResult[0] || {};
  const support = supportStatsResult[0] || {};

  const highlights = {
    timeframe: '24h',
    newRegistrations: toNumber(newUsers24hResult?.[0]?.count),
    completedTrades: toNumber(completedTrades24hResult?.[0]?.count),
    withdrawalsProcessed: toNumber(withdrawalsProcessed24hResult?.[0]?.count),
    depositsProcessed: toNumber(depositsProcessed24hResult?.[0]?.count)
  };

  const alertItems = [];
  const pendingDeposits = toNumber(transactions?.pending_deposits);
  const pendingWithdrawals = toNumber(transactions?.pending_withdrawals);
  const pendingTransactions = pendingDeposits + pendingWithdrawals;
  const openTickets = toNumber(support?.open_tickets);
  const openPositions = toNumber(positions?.open_positions);
  const pendingIbApplications = toNumber(pendingIbApplicationsResult?.[0]?.count);
  const pendingVerifications = toNumber(pendingUserVerificationsResult?.[0]?.count);

  if (pendingDeposits > 0) {
    alertItems.push({
      type: 'warning',
      title: 'Pending deposits awaiting review',
      value: pendingDeposits,
      description: `${pendingDeposits} deposit${pendingDeposits === 1 ? '' : 's'} require attention`,
      timestamp: new Date().toISOString()
    });
  }

  if (pendingWithdrawals > 0) {
    alertItems.push({
      type: 'critical',
      title: 'Pending withdrawals queued',
      value: pendingWithdrawals,
      description: `${pendingWithdrawals} withdrawal${pendingWithdrawals === 1 ? '' : 's'} awaiting processing`,
      timestamp: new Date().toISOString()
    });
  }

  if (pendingIbApplications > 0) {
    alertItems.push({
      type: pendingIbApplications > 10 ? 'critical' : 'warning',
      title: 'IB applications pending approval',
      value: pendingIbApplications,
      description: `${pendingIbApplications} application${pendingIbApplications === 1 ? '' : 's'} awaiting review`,
      timestamp: new Date().toISOString()
    });
  }

  if (openTickets > 0) {
    alertItems.push({
      type: openTickets > 25 ? 'critical' : 'warning',
      title: 'Open support tickets',
      value: openTickets,
      description: `${openTickets} ticket${openTickets === 1 ? '' : 's'} currently open`,
      timestamp: new Date().toISOString()
    });
  }

  if (openPositions > 0) {
    alertItems.push({
      type: 'info',
      title: 'Active open positions',
      value: openPositions,
      description: `${openPositions} position${openPositions === 1 ? '' : 's'} currently open`,
      timestamp: new Date().toISOString()
    });
  }

  if (pendingVerifications > 0) {
    alertItems.push({
      type: pendingVerifications > 20 ? 'critical' : 'warning',
      title: 'Accounts pending verification',
      value: pendingVerifications,
      description: `${pendingVerifications} account${pendingVerifications === 1 ? '' : 's'} pending KYC`,
      timestamp: new Date().toISOString()
    });
  }

  const activityItems = [
    ...recentUsers.map((user) => ({
      type: 'user',
      action: 'New user registration',
      subject: user.email,
      status: 'success',
      metadata: { userId: user.id },
      timestamp: user.created_at
    })),
    ...recentClosedTrades.map((trade) => ({
      type: 'trade',
      action: `Trade closed (${trade.side?.toUpperCase?.() || 'TRADE'})`,
      subject: `${trade.symbol} • ${trade.account_number}`,
      status: trade.profit >= 0 ? 'success' : 'warning',
      metadata: {
        tradeId: trade.id,
        profit: toNumber(trade.profit),
        side: trade.side,
        email: trade.email
      },
      timestamp: trade.closed_at
    })),
    ...recentSupportTickets.map((ticket) => ({
      type: 'support',
      action: `Ticket ${ticket.status}`,
      subject: `${ticket.ticket_number} • ${ticket.email}`,
      status: ['resolved', 'closed'].includes((ticket.status || '').toLowerCase()) ? 'success' : 'warning',
      metadata: {
        ticketId: ticket.id,
        subject: ticket.subject
      },
      timestamp: ticket.updated_at
    })),
    ...recentDeposits.map((deposit) => ({
      type: 'deposit',
      action: deposit.status === 'completed' ? 'Deposit completed' : 'Deposit update',
      subject: `${deposit.transaction_id} • ${deposit.email}`,
      status: deposit.status === 'completed' ? 'success' : 'info',
      metadata: {
        transactionId: deposit.transaction_id,
        amount: toNumber(deposit.net_amount),
        accountNumber: deposit.account_number
      },
      timestamp: deposit.activity_at
    })),
    ...recentWithdrawals.map((withdrawal) => ({
      type: 'withdrawal',
      action: withdrawal.status === 'completed' ? 'Withdrawal processed' : 'Withdrawal update',
      subject: `${withdrawal.transaction_id} • ${withdrawal.email}`,
      status: withdrawal.status === 'completed' ? 'success' : 'warning',
      metadata: {
        transactionId: withdrawal.transaction_id,
        amount: toNumber(withdrawal.net_amount),
        accountNumber: withdrawal.account_number
      },
      timestamp: withdrawal.activity_at
    }))
  ]
    .filter((item) => item.timestamp)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);

  const [elapsedSeconds, elapsedNanoseconds] = process.hrtime(requestStarted);
  const apiLatencyMs = Number((elapsedSeconds * 1e3) + (elapsedNanoseconds / 1e6));
  const serverStatus = apiLatencyMs > 1200 ? 'critical' : apiLatencyMs > 800 ? 'warning' : 'online';
  const databaseStatus = openTickets > 50 || pendingVerifications > 50 ? 'warning' : 'healthy';

  res.json({
    success: true,
    data: {
      users,
      trading,
      transactions,
      positions,
      support,
      systemHealth: {
        serverStatus,
        databaseStatus,
        pendingTransactions,
        pendingDeposits,
        pendingWithdrawals,
        pendingIbApplications,
        pendingUserVerifications: pendingVerifications,
        openSupportTickets: openTickets,
        openPositions,
        activeUsers: toNumber(users?.active_users),
        activeAccounts: toNumber(trading?.total_accounts),
        totalProfitablePositions: toNumber(positions?.total_profits),
        totalLosingPositions: toNumber(positions?.total_losses),
        apiLatencyMs,
        generatedAt: new Date().toISOString()
      },
      highlights,
      alerts: alertItems,
      recentActivity: activityItems
    }
  });
}));

// Admin: set auto square-off percent for an account
router.put('/accounts/:id/auto-square', asyncHandler(async (req, res) => {
  const accountId = parseInt(req.params.id, 10);
  const schema = Joi.object({
    autoSquarePercent: Joi.number().min(0).max(100).required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) throw new AppError(error.details[0].message, 400);

  const { autoSquarePercent } = value;

  // Update account
  await executeQuery('UPDATE trading_accounts SET auto_square_percent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [autoSquarePercent, accountId]);

  res.json({ success: true, message: `auto_square_percent set to ${autoSquarePercent}% for account ${accountId}` });
}));

// Admin: update account leverage
router.put('/accounts/:id/leverage', asyncHandler(async (req, res) => {
  const accountId = parseInt(req.params.id, 10);
  const schema = Joi.object({
    leverage: Joi.number().integer().positive().required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) throw new AppError(error.details[0].message, 400);

  const { leverage } = value;

  // Check if account exists
  const [account] = await executeQuery('SELECT id, user_id, account_type FROM trading_accounts WHERE id = ?', [accountId]);
  if (!account) {
    throw new AppError('Trading account not found', 404);
  }

  // Validate leverage for account type (admin can still override)
  const LeverageService = require('../services/LeverageService');
  if (!LeverageService.validateLeverage(leverage, account.account_type)) {
    console.warn(`Admin setting leverage ${leverage} for ${account.account_type} account (normally not allowed)`);
  }

  // Update account leverage
  await executeQuery('UPDATE trading_accounts SET leverage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [leverage, accountId]);

  res.json({
    success: true,
    message: `Leverage updated to ${leverage}x for account ${accountId}`,
    data: { accountId, newLeverage: leverage }
  });
}));

// Admin: force-close all positions for an account immediately
router.put('/accounts/:id/force-close', asyncHandler(async (req, res) => {
  const accountId = parseInt(req.params.id, 10);
  const schema = Joi.object({
    reason: Joi.string().allow(null, '').optional()
  });

  const { error } = schema.validate(req.body || {});
  if (error) throw new AppError(error.details[0].message, 400);

  // Use MarginService to force close all positions
  const MarginService = require('../services/MarginService');

  const result = await MarginService.forceCloseAllPositions(accountId, req.user?.id || null);

  res.json({ success: true, message: `Force-closed ${result.positionsClosed} positions for account ${accountId}`, result });
}));

// --- Introducing Brokers management (admin) ---
router.get('/introducing-brokers', asyncHandler(async (req, res) => {
  // Make the query tolerant: some databases may not yet have the `ib_share_percent` column
  const colCheck = await executeQuery(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'introducing_brokers' AND COLUMN_NAME = 'ib_share_percent' AND TABLE_SCHEMA = DATABASE()
    LIMIT 1
  `);

  const hasShareColumn = Array.isArray(colCheck) && colCheck.length > 0;

  // Build SELECT fragments depending on whether ib_share_percent exists
  const ibRelationshipFields = [
    'ib.id',
    'ib.ib_user_id',
    'ib.client_user_id',
    'ib.referral_code',
    'ib.commission_rate',
    hasShareColumn ? 'ib.ib_share_percent' : 'NULL AS ib_share_percent',
    'ib.status',
    'ib.tier_level',
    'ib.total_commission_earned',
    'ib.total_client_volume',
    'ib.active_clients_count',
    'ib.created_at',
    'ib.updated_at',
    'u.email AS ib_email',
    'cu.email AS client_email',
    'FALSE AS is_profile_only'
  ].join(',\n      ');

  const profileFields = [
    'NULL AS id',
    'u.id AS ib_user_id',
    'NULL AS client_user_id',
    'NULL AS referral_code',
    'NULL AS commission_rate',
    'NULL AS ib_share_percent',
    "COALESCE(ib_app.status, CASE WHEN COALESCE(roles_data.has_ib,0)=1 THEN 'approved' ELSE 'approved' END) AS status",
    'NULL AS tier_level',
    '0.0000 AS total_commission_earned',
    '0.0000 AS total_client_volume',
    '0 AS active_clients_count',
    'u.created_at AS created_at',
    'NULL AS updated_at',
    'u.email AS ib_email',
    'NULL AS client_email',
    'TRUE AS is_profile_only'
  ].join(',\n      ');

  const sql = `
    SELECT * FROM (
      SELECT
        ${ibRelationshipFields}
      FROM introducing_brokers ib
      JOIN users u ON u.id = ib.ib_user_id
      JOIN users cu ON cu.id = ib.client_user_id

      UNION ALL

      SELECT
        ${profileFields}
      FROM users u
      LEFT JOIN (
        SELECT
          ur.user_id,
          MAX(CASE WHEN LOWER(r.name) = 'ib' THEN 1 ELSE 0 END) AS has_ib
        FROM user_roles ur
        INNER JOIN roles r ON r.id = ur.role_id
        GROUP BY ur.user_id
      ) AS roles_data ON roles_data.user_id = u.id
      LEFT JOIN ib_applications ib_app ON ib_app.user_id = u.id
      WHERE (COALESCE(roles_data.has_ib,0) = 1 OR ib_app.status = 'approved')
        AND NOT EXISTS (SELECT 1 FROM introducing_brokers ib2 WHERE ib2.ib_user_id = u.id)
    ) t
    ORDER BY created_at DESC
    LIMIT 1000
  `;

  const rows = await executeQuery(sql);
  res.json({ success: true, data: rows });
}));

const adminUpdateIbSchema = Joi.object({
  commissionRate: Joi.number().min(0).max(1).optional(),
  status: Joi.string().valid('active','inactive','suspended').optional(),
  tierLevel: Joi.string().valid('bronze','silver','gold','platinum').optional(),
  ibSharePercent: Joi.number().min(0).max(100).optional()
}).min(1);

router.patch('/introducing-brokers/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) throw new AppError('Invalid IB id', 400);

  const { error, value } = adminUpdateIbSchema.validate(req.body, { stripUnknown: true, abortEarly: false });
  if (error) throw new AppError(error.details.map(d => d.message).join(', '), 400);

  const ib = await executeQuery('SELECT * FROM introducing_brokers WHERE id = ?', [id]);
  if (!ib.length) throw new AppError('IB relationship not found', 404);

  const fields = [];
  const params = [];
  if (value.commissionRate !== undefined) { fields.push('commission_rate = ?'); params.push(value.commissionRate); }
  if (value.status !== undefined) { fields.push('status = ?'); params.push(value.status); }
  if (value.tierLevel !== undefined) { fields.push('tier_level = ?'); params.push(value.tierLevel); }
  if (value.ibSharePercent !== undefined) { fields.push('ib_share_percent = ?'); params.push(value.ibSharePercent); }

  if (!fields.length) throw new AppError('No valid fields to update', 400);

  params.push(id);
  await executeQuery(`UPDATE introducing_brokers SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);

  const updated = await executeQuery('SELECT * FROM introducing_brokers WHERE id = ?', [id]);
  res.json({ success: true, data: updated[0] });
}));

// Get all users with filtering and pagination
router.get('/users', asyncHandler(async (req, res) => {
  await ensureIbApplicationsTable();

  const rawPage = Number.parseInt(req.query.page, 10);
  const rawLimit = Number.parseInt(req.query.limit, 10);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const sortByParam = (req.query.sortBy || 'created_at').toString();
  const sortOrderParam = (req.query.sortOrder || 'desc').toString();
  const includeAdmins = String(req.query.includeAdmins || '').toLowerCase() === 'true';

  const limitValue = Number.isNaN(rawLimit)
    ? 20
    : Math.min(Math.max(rawLimit, 1), 100);
  const pageNumber = Number.isNaN(rawPage) ? 1 : Math.max(rawPage, 1);
  const offsetValue = (pageNumber - 1) * limitValue;
  const page = pageNumber;
  const limit = limitValue;

  const sortableFields = {
    created_at: 'u.created_at',
    email: 'u.email',
    status: 'u.status',
    last_login_at: 'u.last_login',
    first_name: 'u.first_name',
    trading_accounts_count: 'trading_accounts_count',
    total_balance: 'total_balance'
  };

  const sortBy = sortableFields[sortByParam] || 'u.created_at';
  const sortOrder = sortOrderParam.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const filters = [];
  const params = [];

  if (!includeAdmins) {
    filters.push(buildAdminExclusionCondition('u'));
  }

  if (search) {
    filters.push('(u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status) {
    filters.push('u.status = ?');
    params.push(status);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const users = await executeQuery(`
    SELECT
      u.id,
      u.email,
      u.first_name,
      u.last_name,
      u.phone,
      u.status,
      u.email_verified AS is_verified,
      u.created_at,
      u.last_login AS last_login_at,
      COALESCE(ta_stats.trading_accounts_count, 0) AS trading_accounts_count,
      COALESCE(ta_stats.total_balance, 0) AS total_balance,
      roles_data.roles,
      roles_data.primary_role AS role,
      CASE
        WHEN COALESCE(roles_data.has_ib, 0) = 1 THEN 1
        WHEN ib_app.status = 'approved' THEN 1
        WHEN EXISTS (
          SELECT 1
          FROM introducing_brokers ib_rel
          WHERE ib_rel.ib_user_id = u.id
          LIMIT 1
        ) THEN 1
        ELSE 0
      END AS has_ib,
      COALESCE(
        ib_app.status,
        CASE
          WHEN COALESCE(roles_data.has_ib, 0) = 1 THEN 'approved'
          WHEN EXISTS (
            SELECT 1
            FROM introducing_brokers ib_rel
            WHERE ib_rel.ib_user_id = u.id
            LIMIT 1
          ) THEN 'approved'
          ELSE 'not_applied'
        END
      ) AS ib_application_status,
      ib_app.updated_at AS ib_application_updated_at,
      ib_app.created_at AS ib_application_created_at
    FROM users u
    LEFT JOIN (
      SELECT 
        ta.user_id,
        COUNT(*) AS trading_accounts_count,
        COALESCE(SUM(ta.balance), 0) AS total_balance
      FROM trading_accounts ta
      GROUP BY ta.user_id
    ) AS ta_stats ON ta_stats.user_id = u.id
    LEFT JOIN (
      SELECT
        ur.user_id,
        GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ',') AS roles,
        SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ','), ',', 1) AS primary_role,
        MAX(CASE WHEN LOWER(r.name) = 'ib' THEN 1 ELSE 0 END) AS has_ib
      FROM user_roles ur
      INNER JOIN roles r ON r.id = ur.role_id
      GROUP BY ur.user_id
    ) AS roles_data ON roles_data.user_id = u.id
    LEFT JOIN ib_applications ib_app ON ib_app.user_id = u.id
  ${whereClause}
    GROUP BY u.id
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT ${limitValue} OFFSET ${offsetValue}
  `, params);

  // Get total count
  const totalCount = await executeQuery(`
    SELECT COUNT(*) as count
    FROM users u
    ${whereClause}
  `, params);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page,
        limit,
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / limit)
      }
    }
  });
}));

// Get user details
router.get('/users/:id', asyncHandler(async (req, res) => {
  await ensureIbApplicationsTable();

  const userId = parseInt(req.params.id);

  const users = await executeQuery(`
    SELECT 
      u.*,
  ua.country_code AS country,
  ua.state_province AS state,
      ua.city,
      ua.address_line_1,
      ua.address_line_2,
      ua.postal_code,
      roles_data.roles,
      roles_data.primary_role,
      CASE
        WHEN COALESCE(roles_data.has_ib, 0) = 1 THEN 1
        WHEN ib_app.status = 'approved' THEN 1
        WHEN EXISTS (
          SELECT 1
          FROM introducing_brokers ib_rel
          WHERE ib_rel.ib_user_id = u.id
          LIMIT 1
        ) THEN 1
        ELSE 0
      END AS has_ib,
      COALESCE(
        ib_app.status,
        CASE
          WHEN COALESCE(roles_data.has_ib, 0) = 1 THEN 'approved'
          WHEN EXISTS (
            SELECT 1
            FROM introducing_brokers ib_rel
            WHERE ib_rel.ib_user_id = u.id
            LIMIT 1
          ) THEN 'approved'
          ELSE 'not_applied'
        END
      ) AS ib_application_status,
      ib_app.notes AS ib_application_notes,
      ib_app.created_at AS ib_application_created_at,
      ib_app.updated_at AS ib_application_updated_at
    FROM users u
    LEFT JOIN user_addresses ua ON u.id = ua.user_id AND ua.is_primary = 1
    LEFT JOIN (
      SELECT
        ur.user_id,
        GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ',') AS roles,
        SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ','), ',', 1) AS primary_role,
        MAX(CASE WHEN LOWER(r.name) = 'ib' THEN 1 ELSE 0 END) AS has_ib
      FROM user_roles ur
      INNER JOIN roles r ON r.id = ur.role_id
      GROUP BY ur.user_id
    ) AS roles_data ON roles_data.user_id = u.id
    LEFT JOIN ib_applications ib_app ON ib_app.user_id = u.id
    WHERE u.id = ?
  `, [userId]);

  if (!users.length) {
    throw new AppError('User not found', 404);
  }

  const user = users[0];

  // Get user's trading accounts
  const accounts = await executeQuery(`
    SELECT
      id,
      account_number,
      account_type,
      balance,
      equity,
  (COALESCE(balance, 0) - COALESCE(free_margin, 0)) AS margin,
      free_margin,
      leverage,
      currency,
      status,
      auto_square_percent,
      created_at
    FROM trading_accounts
    WHERE user_id = ?
  `, [userId]);

  // Get user's recent activity
  const activity = await executeQuery(`
    SELECT 
      'position' AS type,
      'Position opened' AS action,
      COALESCE(symbols.symbol, CONCAT('Account ', ta.account_number)) AS symbol,
      p.opened_at AS created_at
    FROM positions p
    INNER JOIN trading_accounts ta ON ta.id = p.account_id
    LEFT JOIN symbols ON symbols.id = p.symbol_id
    WHERE ta.user_id = ?
    
    UNION ALL
    
    SELECT 
      'deposit' AS type,
      'Deposit request' AS action,
      CONCAT(d.amount, ' ', d.currency) AS symbol,
      d.created_at
    FROM deposits d
    WHERE d.user_id = ?
    
    UNION ALL
    
    SELECT 
      'withdrawal' AS type,
      'Withdrawal request' AS action,
      CONCAT(w.amount, ' ', w.currency) AS symbol,
      w.created_at
    FROM withdrawals w
    WHERE w.user_id = ?
    
    ORDER BY created_at DESC
    LIMIT 10
  `, [userId, userId, userId]);

  res.json({
    success: true,
    data: {
      user,
      accounts,
      activity
    }
  });
}));

// Create new user
router.post('/users', asyncHandler(async (req, res) => {
  const { error, value } = createUserSchema.validate(req.body, { abortEarly: false });
  if (error) {
    throw new AppError(error.details.map((detail) => detail.message).join(', '), 400);
  }

  const existingUsers = await executeQuery('SELECT id FROM users WHERE email = ?', [value.email]);
  if (existingUsers.length) {
    throw new AppError('A user with this email already exists.', 409);
  }

  const { role, emailVerified, status, kycStatus, ...userPayload } = value;

  const newUser = await User.create({
    ...userPayload,
    status,
    emailVerified,
    kycStatus,
  });

  if (role) {
    const roleRows = await executeQuery('SELECT id FROM roles WHERE LOWER(name) = LOWER(?) LIMIT 1', [role]);
    if (roleRows.length) {
      await executeQuery(`
        INSERT INTO user_roles (user_id, role_id)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE assigned_at = CURRENT_TIMESTAMP
      `, [newUser.id, roleRows[0].id]);
    }
  }

  await executeQuery(`
    INSERT INTO admin_actions (admin_user_id, action, target_type, target_id, details)
    VALUES (?, 'create_user', 'user', ?, ?)
  `, [
    req.user.id,
    newUser.id,
    JSON.stringify({ role, status, emailVerified, createdUserId: newUser.id }),
  ]);

  const hydratedUser = await User.findById(newUser.id);

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: { user: hydratedUser ? hydratedUser.toJSON() : newUser.toJSON() },
  });
}));

// Update user status
router.patch('/users/:id/status', asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { status, reason } = req.body;

  if (!['active', 'suspended', 'inactive'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  await executeQuery(`
    UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [status, userId]);

  // Log the action
  await executeQuery(`
    INSERT INTO admin_actions (admin_user_id, action, target_type, target_id, details)
    VALUES (?, 'status_change', 'user', ?, ?)
  `, [req.user.id, userId, JSON.stringify({ status, reason })]);

  res.json({ success: true, message: 'User status updated successfully' });
}));

// Update user email verification
router.patch('/users/:id/verification', asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    throw new AppError('Invalid user ID', 400);
  }

  const { error, value } = updateVerificationSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const updateResult = await executeQuery(`
    UPDATE users SET email_verified = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [value.verified ? 1 : 0, userId]);

  if (updateResult.affectedRows === 0) {
    throw new AppError('User not found', 404);
  }

  await executeQuery(`
    INSERT INTO admin_actions (admin_user_id, action, target_type, target_id, details)
    VALUES (?, ?, 'user', ?, ?)
  `, [
    req.user.id,
    value.verified ? 'user_verify' : 'user_unverify',
    userId,
    JSON.stringify({ verified: value.verified, reason: value.reason || null }),
  ]);

  res.json({
    success: true,
    message: value.verified ? 'User verified successfully' : 'User verification revoked',
  });
}));

// Delete user (with safeguards)
router.delete('/users/:id', asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    throw new AppError('Invalid user ID', 400);
  }

  if (userId === req.user.id) {
    throw new AppError('You cannot delete your own account.', 400);
  }

  const users = await executeQuery(`
    SELECT u.id, u.email, u.status
    FROM users u
    WHERE u.id = ?
  `, [userId]);

  if (!users.length) {
    throw new AppError('User not found', 404);
  }

  const adminRole = await executeQuery(`
    SELECT 1
    FROM user_roles ur
    INNER JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = ? AND LOWER(r.name) = ?
    LIMIT 1
  `, [userId, ADMIN_ROLE_NAME.toLowerCase()]);

  if (adminRole.length) {
    throw new AppError('Admin accounts cannot be deleted.', 400);
  }

  await executeQuery('DELETE FROM users WHERE id = ?', [userId]);

  await executeQuery(`
    INSERT INTO admin_actions (admin_user_id, action, target_type, target_id, details)
    VALUES (?, 'delete_user', 'user', ?, ?)
  `, [
    req.user.id,
    userId,
    JSON.stringify({ deletedUserId: userId, email: users[0].email }),
  ]);

  res.json({
    success: true,
    message: 'User deleted successfully',
  });
}));

// Get pending transactions
router.get('/transactions/pending', asyncHandler(async (req, res) => {
  const type = req.query.type; // 'deposits', 'withdrawals', or undefined for both
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  let sql = '';
  let params = [];

  if (type === 'deposits') {
    sql = `
      SELECT 
        'deposit' as type,
        d.id,
        d.transaction_id,
        d.amount,
        d.currency,
        d.fee,
        d.net_amount,
        d.payment_reference,
        d.user_notes,
        d.created_at,
        u.email as user_email,
        u.first_name,
        u.last_name,
        pm.name as payment_method,
        ta.account_number
      FROM deposits d
      JOIN users u ON d.user_id = u.id
      JOIN payment_methods pm ON d.payment_method_id = pm.id
      JOIN trading_accounts ta ON d.account_id = ta.id
      WHERE d.status = 'pending'
      ORDER BY d.created_at ASC
      LIMIT ? OFFSET ?
    `;
    params = [limit, offset];
  } else if (type === 'withdrawals') {
    sql = `
      SELECT 
        'withdrawal' as type,
        w.id,
        w.transaction_id,
        w.amount,
        w.currency,
        w.fee,
        w.net_amount,
        w.payment_reference,
        w.user_notes,
        w.created_at,
        u.email as user_email,
        u.first_name,
        u.last_name,
        pm.name as payment_method,
        ta.account_number
      FROM withdrawals w
      JOIN users u ON w.user_id = u.id
      JOIN payment_methods pm ON w.payment_method_id = pm.id
      JOIN trading_accounts ta ON w.account_id = ta.id
      WHERE w.status = 'pending'
      ORDER BY w.created_at ASC
      LIMIT ? OFFSET ?
    `;
    params = [limit, offset];
  } else {
    sql = `
      SELECT 
        'deposit' as type,
        d.id,
        d.transaction_id,
        d.amount,
        d.currency,
        d.fee,
        d.net_amount,
        d.payment_reference,
        d.user_notes,
        d.created_at,
        u.email as user_email,
        u.first_name,
        u.last_name,
        pm.name as payment_method,
        ta.account_number
      FROM deposits d
      JOIN users u ON d.user_id = u.id
      JOIN payment_methods pm ON d.payment_method_id = pm.id
      JOIN trading_accounts ta ON d.account_id = ta.id
      WHERE d.status = 'pending'
      
      UNION ALL
      
      SELECT 
        'withdrawal' as type,
        w.id,
        w.transaction_id,
        w.amount,
        w.currency,
        w.fee,
        w.net_amount,
        w.payment_reference,
        w.user_notes,
        w.created_at,
        u.email as user_email,
        u.first_name,
        u.last_name,
        pm.name as payment_method,
        ta.account_number
      FROM withdrawals w
      JOIN users u ON w.user_id = u.id
      JOIN payment_methods pm ON w.payment_method_id = pm.id
      JOIN trading_accounts ta ON w.account_id = ta.id
      WHERE w.status = 'pending'
      
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `;
    params = [limit, offset];
  }

  const transactions = await executeQuery(sql, params);

  res.json({ transactions });
}));

// Process deposit
router.patch('/deposits/:id/process', asyncHandler(async (req, res) => {
  const depositId = parseInt(req.params.id);
  const { action, adminNotes } = req.body; // action: 'approve' or 'reject'

  if (!['approve', 'reject'].includes(action)) {
    throw new AppError('Invalid action', 400);
  }

  // Get deposit details
  const deposits = await executeQuery(`
    SELECT * FROM deposits WHERE id = ? AND status = 'pending'
  `, [depositId]);

  if (!deposits.length) {
    throw new AppError('Deposit not found or already processed', 404);
  }

  const deposit = deposits[0];

  if (action === 'approve') {
    // Update account balance
    await executeQuery(`
      UPDATE trading_accounts 
      SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [deposit.net_amount, deposit.account_id]);

    // Update deposit status
    await executeQuery(`
      UPDATE deposits 
      SET status = 'completed', admin_notes = ?, processed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [adminNotes ?? null, depositId]);
  } else {
    // Update deposit status to rejected
    await executeQuery(`
      UPDATE deposits 
      SET status = 'rejected', admin_notes = ?, processed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [adminNotes ?? null, depositId]);
  }

  // Log admin action
  await executeQuery(`
    INSERT INTO admin_actions (admin_user_id, action, target_type, target_id, details)
    VALUES (?, ?, 'deposit', ?, ?)
  `, [req.user.id, `deposit_${action}`, depositId, JSON.stringify({ adminNotes })]);

  res.json({ message: `Deposit ${action}ed successfully` });
}));

// Process withdrawal
router.patch('/withdrawals/:id/process', asyncHandler(async (req, res) => {
  const withdrawalId = parseInt(req.params.id);
  const { action, adminNotes } = req.body; // action: 'approve' or 'reject'

  if (!['approve', 'reject'].includes(action)) {
    throw new AppError('Invalid action', 400);
  }

  // Get withdrawal details
  const withdrawals = await executeQuery(`
    SELECT * FROM withdrawals WHERE id = ? AND status = 'pending'
  `, [withdrawalId]);

  if (!withdrawals.length) {
    throw new AppError('Withdrawal not found or already processed', 404);
  }

  const withdrawal = withdrawals[0];

  if (action === 'approve') {
    // Deduct from account balance (fee + amount)
    const totalDeduction = parseFloat(withdrawal.amount) + parseFloat(withdrawal.fee);
    
    await executeQuery(`
      UPDATE trading_accounts 
      SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [totalDeduction, withdrawal.account_id]);

    // Update withdrawal status
    await executeQuery(`
      UPDATE withdrawals 
      SET status = 'completed', admin_notes = ?, processed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [adminNotes ?? null, withdrawalId]);
  } else {
    // Update withdrawal status to rejected
    await executeQuery(`
      UPDATE withdrawals 
      SET status = 'rejected', admin_notes = ?, processed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [adminNotes ?? null, withdrawalId]);
  }

  // Log admin action
  await executeQuery(`
    INSERT INTO admin_actions (admin_user_id, action, target_type, target_id, details)
    VALUES (?, ?, 'withdrawal', ?, ?)
  `, [req.user.id, `withdrawal_${action}`, withdrawalId, JSON.stringify({ adminNotes })]);

  res.json({ message: `Withdrawal ${action}ed successfully` });
}));

// ------------------------------------------------------------------
// Payment Gateways admin endpoints
// ------------------------------------------------------------------
// List payment gateways (admin)
router.get('/payment-gateways/admin', asyncHandler(async (req, res) => {
  const rows = await executeQuery(`
    SELECT id, name, display_name, type, provider, is_active, min_amount, max_amount, processing_fee_type, processing_fee_value, processing_time_hours, supported_currencies, configuration, icon_url, description, sort_order
    FROM payment_gateways
    ORDER BY sort_order ASC, display_name ASC
  `);

  res.json({ success: true, data: rows });
}));

// Toggle gateway active state
router.patch('/payment-gateways/admin/:id/toggle', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) throw new AppError('Invalid gateway id', 400);

  const current = await executeQuery('SELECT id, is_active FROM payment_gateways WHERE id = ? LIMIT 1', [id]);
  if (!current || !current.length) throw new AppError('Gateway not found', 404);

  const newState = current[0].is_active ? 0 : 1;
  await executeQuery('UPDATE payment_gateways SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newState, id]);

  // Log admin action (best-effort; don't fail the toggle if logging isn't available)
  try {
    await executeQuery(`
      INSERT INTO admin_actions (admin_user_id, action, target_type, target_id, details)
      VALUES (?, ?, 'payment_gateway', ?, ?)
    `, [req.user && req.user.id ? req.user.id : null, `gateway_${newState ? 'enable' : 'disable'}`, id, JSON.stringify({ gatewayId: id, enabled: Boolean(newState) })]);
  } catch (err) {
    // ignore logging errors
    console.warn('admin action log failed', err && err.message);
  }

  res.json({ success: true, message: `Gateway ${newState ? 'enabled' : 'disabled'}`, data: { id, is_active: Boolean(newState) } });
}));

// Get support tickets
router.get('/support', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const status = req.query.status || '';
  const priority = req.query.priority || '';

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (status) {
    whereClause += ' AND st.status = ?';
    params.push(status);
  }

  if (priority) {
    whereClause += ' AND st.priority = ?';
    params.push(priority);
  }

  const tickets = await executeQuery(`
    SELECT 
      st.id,
      st.ticket_number,
      st.subject,
      st.category,
      st.priority,
      st.status,
      st.created_at,
      st.updated_at,
      u.email as user_email,
      u.first_name,
      u.last_name,
      admin.first_name as assigned_admin_name,
      (SELECT COUNT(*) FROM support_messages WHERE ticket_id = st.id) as message_count
    FROM support_tickets st
    JOIN users u ON st.user_id = u.id
    LEFT JOIN users admin ON st.assigned_admin_id = admin.id
    ${whereClause}
    ORDER BY st.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  const totalCount = await executeQuery(`
    SELECT COUNT(*) as count FROM support_tickets st ${whereClause}
  `, params);

  res.json({
    tickets,
    pagination: {
      page,
      limit,
      total: totalCount[0].count,
      pages: Math.ceil(totalCount[0].count / limit)
    }
  });
}));

// Assign support ticket
router.patch('/support/:id/assign', asyncHandler(async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const { adminId } = req.body;

  // Verify admin user exists
  if (adminId) {
    const admins = await executeQuery(`
      SELECT id FROM users WHERE id = ? AND role = 'admin'
    `, [adminId]);

    if (!admins.length) {
      throw new AppError('Invalid admin user', 400);
    }
  }

  await executeQuery(`
    UPDATE support_tickets 
    SET assigned_admin_id = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `, [adminId || null, ticketId]);

  res.json({ message: 'Ticket assigned successfully' });
}));

// Update support ticket status
router.patch('/support/:id/status', asyncHandler(async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const { status } = req.body;

  if (!['open', 'pending', 'resolved', 'closed'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  await executeQuery(`
    UPDATE support_tickets 
    SET status = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `, [status, ticketId]);

  res.json({ message: 'Ticket status updated successfully' });
}));

// Get trading statistics
router.get('/trading/stats', asyncHandler(async (req, res) => {
  const rangeParam = Number.parseInt(req.query.range, 10);
  const rangeDays = Number.isNaN(rangeParam) ? 30 : Math.min(Math.max(rangeParam, 1), 365);

  const stats = await Promise.all([
    // Position statistics
    executeQuery(`
      SELECT 
        COUNT(*) as total_positions,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_positions,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_positions,
        COUNT(CASE WHEN opened_at >= DATE_SUB(NOW(), INTERVAL ${rangeDays} DAY) THEN 1 END) as new_positions
      FROM positions
    `),

    // Volume statistics
    executeQuery(`
      SELECT 
        COALESCE(SUM(p.lot_size), 0) as total_volume,
        COALESCE(SUM(CASE WHEN p.opened_at >= DATE_SUB(NOW(), INTERVAL ${rangeDays} DAY) THEN p.lot_size ELSE 0 END), 0) as recent_volume,
        COUNT(DISTINCT ta.user_id) as active_traders
      FROM positions p
      INNER JOIN trading_accounts ta ON ta.id = p.account_id
      WHERE p.status = 'closed'
    `),

    // P&L statistics
    executeQuery(`
      SELECT 
        COALESCE(SUM(CASE WHEN profit > 0 THEN profit ELSE 0 END), 0) as total_profits,
        COALESCE(SUM(CASE WHEN profit < 0 THEN ABS(profit) ELSE 0 END), 0) as total_losses,
        COALESCE(SUM(profit), 0) as net_pnl
      FROM positions
      WHERE status = 'closed'
    `),

    // Top symbols
    executeQuery(`
      SELECT 
        s.symbol,
        COUNT(*) as position_count,
        COALESCE(SUM(p.lot_size), 0) as total_volume
      FROM positions p
      INNER JOIN symbols s ON s.id = p.symbol_id
      WHERE p.opened_at >= DATE_SUB(NOW(), INTERVAL ${rangeDays} DAY)
      GROUP BY s.symbol
      ORDER BY position_count DESC
      LIMIT 10
    `)
  ]);

  res.json({
    positions: stats[0][0],
    volume: stats[1][0],
    profitLoss: stats[2][0],
    topSymbols: stats[3]
  });
}));

// Get high-level trading overview for dashboard cards
router.get('/trading/overview', asyncHandler(async (req, res) => {
  const [openStats] = await executeQuery(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(lot_size), 0) as total_volume,
      COALESCE(SUM(profit), 0) as total_pnl,
      COALESCE(SUM(commission), 0) as total_commission,
      COALESCE(SUM(swap), 0) as total_swap
    FROM positions
    WHERE status = 'open'
  `);

  const [closedStats] = await executeQuery(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(lot_size), 0) as total_volume,
      COALESCE(SUM(profit), 0) as total_pnl,
      COALESCE(SUM(commission), 0) as total_commission,
      COALESCE(SUM(swap), 0) as total_swap
    FROM trade_history
  `);

  res.json({
    success: true,
    data: {
      openPositions: parseInt(openStats.count, 10) || 0,
      openPnL: parseFloat(openStats.total_pnl) || 0,
      openVolume: parseFloat(openStats.total_volume) || 0,
      closedPositions: parseInt(closedStats.count, 10) || 0,
      closedPnL: parseFloat(closedStats.total_pnl) || 0,
      closedVolume: parseFloat(closedStats.total_volume) || 0,
      totalVolume: (parseFloat(openStats.total_volume) || 0) + (parseFloat(closedStats.total_volume) || 0),
      totalCommission: (parseFloat(openStats.total_commission) || 0) + (parseFloat(closedStats.total_commission) || 0),
      totalSwap: (parseFloat(openStats.total_swap) || 0) + (parseFloat(closedStats.total_swap) || 0),
      netPnL: (parseFloat(openStats.total_pnl) || 0) + (parseFloat(closedStats.total_pnl) || 0)
    }
  });
}));

// List trading positions with filtering and pagination
router.get('/trading/positions', asyncHandler(async (req, res) => {
  const { error, value } = adminTradingPositionsFilterSchema.validate(req.query, { abortEarly: false });
  if (error) {
    throw new AppError(error.details.map((detail) => detail.message).join(', '), 400);
  }

  const { status, search, symbol, side, page, limit, sortBy, sortOrder } = value;

  const filters = [];
  const params = [];

  if (status && status !== 'all') {
    filters.push('p.status = ?');
    params.push(status);
  }

  if (symbol) {
    filters.push('s.symbol = ?');
    params.push(symbol.toUpperCase());
  }

  if (side) {
    filters.push('p.side = ?');
    params.push(side);
  }

  if (search) {
    const like = `%${search}%`;
    filters.push(`(
      u.email LIKE ?
      OR u.first_name LIKE ?
      OR u.last_name LIKE ?
      OR ta.account_number LIKE ?
      OR CAST(p.id AS CHAR) LIKE ?
      OR s.symbol LIKE ?
    )`);
    params.push(like, like, like, like, like, like);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const sortableColumns = {
    opened_at: 'p.opened_at',
    closed_at: 'p.closed_at',
    profit: 'p.profit',
    lot_size: 'p.lot_size',
    symbol: 's.symbol',
    user: 'u.email',
    account: 'ta.account_number',
    status: 'p.status'
  };

  const orderColumn = sortableColumns[sortBy] || 'p.opened_at';
  const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const filterParams = [...params];

  const positions = await executeQuery(`
    SELECT
      p.*, 
      ta.account_number,
      ta.user_id,
      u.email AS user_email,
      CONCAT_WS(' ', u.first_name, u.last_name) AS user_name,
      s.symbol,
      s.name AS symbol_name,
      s.contract_size,
      s.pip_size
    FROM positions p
    JOIN trading_accounts ta ON p.account_id = ta.id
    JOIN users u ON ta.user_id = u.id
    JOIN symbols s ON p.symbol_id = s.id
    ${whereClause}
    ORDER BY ${orderColumn} ${orderDirection}
    LIMIT ? OFFSET ?
  `, [...filterParams, limit, offset]);

  const totalResult = await executeQuery(`
    SELECT COUNT(*) as count
    FROM positions p
    JOIN trading_accounts ta ON p.account_id = ta.id
    JOIN users u ON ta.user_id = u.id
    JOIN symbols s ON p.symbol_id = s.id
    ${whereClause}
  `, filterParams);

  const summaryResult = await executeQuery(`
    SELECT 
      COALESCE(SUM(p.lot_size), 0) as total_volume,
      COALESCE(SUM(p.profit), 0) as total_profit,
      COALESCE(SUM(p.commission), 0) as total_commission
    FROM positions p
    JOIN trading_accounts ta ON p.account_id = ta.id
    JOIN users u ON ta.user_id = u.id
    JOIN symbols s ON p.symbol_id = s.id
    ${whereClause}
  `, filterParams);

  const summary = summaryResult.length ? summaryResult[0] : { total_volume: 0, total_profit: 0, total_commission: 0 };

  const formatNumber = (value) => (value === null || value === undefined ? 0 : parseFloat(value));

  const rows = positions.map((row) => {
    const lotSize = formatNumber(row.lot_size);
    const openPrice = formatNumber(row.open_price);
    const currentPrice = row.status === 'open' ? formatNumber(row.current_price) : formatNumber(row.close_price);
    const profit = formatNumber(row.profit);
    const commission = formatNumber(row.commission);
    const swap = formatNumber(row.swap);
    const symbolInfo = {
      contract_size: formatNumber(row.contract_size) || 100000,
      pip_size: formatNumber(row.pip_size) || 0.0001
    };

    const netPnL = FundManager.calculateNetPositionPnL({
      open_price: openPrice,
      lot_size: lotSize,
      side: row.side,
      commission,
      swap
    }, currentPrice || openPrice, symbolInfo);

    const grossPnL = FundManager.calculatePositionPnL({
      open_price: openPrice,
      lot_size: lotSize,
      side: row.side
    }, currentPrice || openPrice, symbolInfo);

    const fullName = (row.user_name || '').trim();

    return {
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: fullName.length ? fullName : row.user_email,
      accountId: row.account_id,
      accountNumber: row.account_number,
      symbolId: row.symbol_id,
      symbol: row.symbol,
      symbolName: row.symbol_name,
      side: row.side,
      lotSize,
      openPrice,
      currentPrice: currentPrice || null,
      closePrice: row.close_price ? formatNumber(row.close_price) : null,
      stopLoss: row.stop_loss !== null ? formatNumber(row.stop_loss) : null,
      takeProfit: row.take_profit !== null ? formatNumber(row.take_profit) : null,
      commission,
      swap,
      profit,
      netProfit: netPnL,
      unrealizedPnl: row.status === 'open' ? netPnL : 0,
  grossProfit: grossPnL > 0 ? grossPnL : 0,
  grossLoss: grossPnL < 0 ? Math.abs(grossPnL) : 0,
      status: row.status,
      comment: row.comment,
      openedAt: row.opened_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at,
      closeReason: row.close_reason
    };
  });

  res.json({
    success: true,
    data: {
      rows,
      pagination: {
        page,
        limit,
        total: totalResult.length ? parseInt(totalResult[0].count, 10) : rows.length,
        pages: totalResult.length ? Math.ceil(parseInt(totalResult[0].count, 10) / limit) : 1
      },
      summary: {
        totalVolume: formatNumber(summary.total_volume),
        totalProfit: formatNumber(summary.total_profit),
        totalCommission: formatNumber(summary.total_commission),
        netProfit: formatNumber(summary.total_profit) - formatNumber(summary.total_commission)
      }
    }
  });
}));

// Get single position details
router.get('/trading/positions/:id', asyncHandler(async (req, res) => {
  const positionId = parseInt(req.params.id, 10);

  const position = await Position.findById(positionId);
  if (!position) {
    throw new AppError('Position not found', 404);
  }

  const userRows = await executeQuery(
    'SELECT id, email, first_name, last_name FROM users WHERE id = ? LIMIT 1',
    [position.userId]
  );

  const payload = position.toJSON();

  if (userRows.length) {
    payload.user = {
      id: userRows[0].id,
      email: userRows[0].email,
      firstName: userRows[0].first_name,
      lastName: userRows[0].last_name
    };
  }

  res.json({ success: true, data: payload });
}));

// Update an open position (lot size, SL/TP, comment)
router.patch('/trading/positions/:id', asyncHandler(async (req, res) => {
  const positionId = parseInt(req.params.id, 10);

  const { error, value } = adminTradingUpdatePositionSchema.validate(req.body, { abortEarly: false });
  if (error) {
    throw new AppError(error.details.map((detail) => detail.message).join(', '), 400);
  }

  const position = await Position.findById(positionId);
  if (!position) {
    throw new AppError('Position not found', 404);
  }

  if (position.status !== 'open') {
    throw new AppError('Only open positions can be modified', 400);
  }

  const updates = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(value, 'lotSize')) {
    updates.push('lot_size = ?');
    params.push(value.lotSize);

    const symbolInfo = await executeQuery(
      'SELECT commission_value FROM symbols WHERE id = ? LIMIT 1',
      [position.symbolId]
    );

    if (symbolInfo.length) {
      const commissionValue = parseFloat(symbolInfo[0].commission_value) || 0;
      updates.push('commission = ?');
      params.push(commissionValue * value.lotSize);
    }
  }

  if (Object.prototype.hasOwnProperty.call(value, 'stopLoss')) {
    updates.push('stop_loss = ?');
    params.push(value.stopLoss === null ? null : value.stopLoss);
  }

  if (Object.prototype.hasOwnProperty.call(value, 'takeProfit')) {
    updates.push('take_profit = ?');
    params.push(value.takeProfit === null ? null : value.takeProfit);
  }

  if (Object.prototype.hasOwnProperty.call(value, 'comment')) {
    updates.push('comment = ?');
    params.push(value.comment);
  }

  if (!updates.length) {
    throw new AppError('No changes provided', 400);
  }

  params.push(positionId);

  await executeQuery(
    `UPDATE positions SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    params
  );

  const account = await TradingAccount.findById(position.accountId);
  if (account) {
    await account.refreshAccountMetrics();
  }

  await executeQuery(`
    INSERT INTO admin_actions (admin_user_id, action, target_type, target_id, details)
    VALUES (?, 'update_position', 'position', ?, ?)
  `, [
    req.user.id,
    positionId,
    JSON.stringify({ updates: value })
  ]);

  const updatedPosition = await Position.findById(positionId);

  res.json({
    success: true,
    message: 'Position updated successfully',
    data: updatedPosition ? updatedPosition.toJSON() : null
  });
}));

// Open a new position on behalf of a user
router.post('/trading/positions', asyncHandler(async (req, res) => {
  const { error, value } = adminTradingOpenPositionSchema.validate(req.body, { abortEarly: false });
  if (error) {
    throw new AppError(error.details.map((detail) => detail.message).join(', '), 400);
  }

  const { accountId, symbolId, side, lotSize, stopLoss, takeProfit, comment } = value;

  const account = await TradingAccount.findById(accountId);
  if (!account) {
    throw new AppError('Trading account not found', 404);
  }

  if (account.status !== 'active') {
    throw new AppError('Trading account is not active', 400);
  }

  const symbols = await executeQuery(
    'SELECT * FROM symbols WHERE id = ? AND is_active = 1',
    [symbolId]
  );

  if (!symbols.length) {
    throw new AppError('Symbol not found or inactive', 404);
  }

  const symbol = symbols[0];

  const prices = await executeQuery(
    `SELECT bid, ask FROM market_prices 
     WHERE symbol_id = ? 
     ORDER BY timestamp DESC 
     LIMIT 1`,
    [symbolId]
  );

  if (!prices.length) {
    throw new AppError('No market price available for this symbol', 400);
  }

  const currentPrice = prices[0];
  const openPrice = side === 'buy' ? parseFloat(currentPrice.ask) : parseFloat(currentPrice.bid);

  if (!openPrice || Number.isNaN(openPrice)) {
    throw new AppError('Invalid market price received', 400);
  }

  const contractSize = parseFloat(symbol.contract_size) || 100000;
  const accountLeverage = parseFloat(account.leverage) || 100; // Get leverage from account
  const requiredMargin = (lotSize * contractSize * openPrice) / accountLeverage;

  const hasSufficientMargin = await account.hasSufficientMargin(requiredMargin);
  if (!hasSufficientMargin) {
    throw new AppError(`Insufficient margin to open position. Required: $${requiredMargin.toFixed(2)}, Available: $${account.freeMargin.toFixed(2)}`, 400);
  }

  const position = await Position.create({
    accountId,
    symbolId,
    side,
    lotSize,
    openPrice,
    stopLoss,
    takeProfit,
    comment
  });

  if (!position) {
    throw new AppError('Failed to create position', 500);
  }

  await executeQuery(`
    INSERT INTO admin_actions (admin_user_id, action, target_type, target_id, details)
    VALUES (?, 'open_position', 'position', ?, ?)
  `, [
    req.user.id,
    position.id,
    JSON.stringify({ accountId, symbolId, side, lotSize })
  ]);

  if (global.broadcast) {
    global.broadcast({
      type: 'position_opened',
      userId: account.userId,
      accountId,
      data: position.toJSON()
    });
  }

  res.status(201).json({
    success: true,
    message: 'Position opened successfully',
    data: position.toJSON()
  });
}));

// Close an open position
router.post('/trading/positions/:id/close', asyncHandler(async (req, res) => {
  const positionId = parseInt(req.params.id, 10);

  const { error, value } = adminTradingClosePositionSchema.validate(req.body || {}, { abortEarly: false });
  if (error) {
    throw new AppError(error.details.map((detail) => detail.message).join(', '), 400);
  }

  const position = await Position.findById(positionId);
  if (!position) {
    throw new AppError('Position not found', 404);
  }

  if (position.status !== 'open') {
    throw new AppError('Position is not open', 400);
  }

  const account = await TradingAccount.findById(position.accountId);

  let closePrice = value.closePrice || null;

  if (!closePrice) {
    const prices = await executeQuery(
      `SELECT bid, ask FROM market_prices 
       WHERE symbol_id = ? 
       ORDER BY timestamp DESC 
       LIMIT 1`,
      [position.symbolId]
    );

    if (!prices.length) {
      throw new AppError('No market price available for closing position', 400);
    }

    const currentPrice = prices[0];
    closePrice = position.side === 'buy' ? parseFloat(currentPrice.bid) : parseFloat(currentPrice.ask);
  }

  if (!closePrice || Number.isNaN(closePrice)) {
    throw new AppError('Invalid close price', 400);
  }

  const closeSummary = await position.close(closePrice, value.closeReason || 'manual');

  await executeQuery(`
    INSERT INTO admin_actions (admin_user_id, action, target_type, target_id, details)
    VALUES (?, 'close_position', 'position', ?, ?)
  `, [
    req.user.id,
    positionId,
    JSON.stringify({ closeReason: value.closeReason || 'manual', closePrice })
  ]);

  if (account && global.broadcast) {
    const refreshedAccount = await TradingAccount.findById(account.id);
    global.broadcast({
      type: 'balance_update',
      userId: account.userId,
      accountId: account.id,
      data: {
        previousBalance: account.balance,
        newBalance: refreshedAccount ? refreshedAccount.balance : account.balance,
        change: closeSummary.finalProfit,
        changeType: closeSummary.finalProfit >= 0 ? 'profit' : 'loss',
        reason: 'admin_position_close',
        positionId,
        symbol: position.symbol,
        side: position.side,
        lotSize: position.lotSize,
        profit: closeSummary.finalProfit,
        timestamp: new Date().toISOString()
      }
    });
  }

  res.json({
    success: true,
    message: 'Position closed successfully',
    data: closeSummary
  });
}));

// Get trade history with filters
router.get('/trading/history', asyncHandler(async (req, res) => {
  const { error, value } = adminTradingHistoryFilterSchema.validate(req.query, { abortEarly: false });
  if (error) {
    throw new AppError(error.details.map((detail) => detail.message).join(', '), 400);
  }

  const { search, symbol, side, accountId, userId, page, limit, dateFrom, dateTo, sortBy, sortOrder } = value;

  const filters = [];
  const params = [];

  if (symbol) {
    filters.push('s.symbol = ?');
    params.push(symbol.toUpperCase());
  }

  if (side) {
    filters.push('th.side = ?');
    params.push(side);
  }

  if (accountId) {
    filters.push('th.account_id = ?');
    params.push(accountId);
  }

  if (userId) {
    filters.push('ta.user_id = ?');
    params.push(userId);
  }

  if (dateFrom) {
    filters.push('th.closed_at >= ?');
    params.push(new Date(dateFrom));
  }

  if (dateTo) {
    filters.push('th.closed_at <= ?');
    params.push(new Date(dateTo));
  }

  if (search) {
    const like = `%${search}%`;
    filters.push(`(
      u.email LIKE ?
      OR u.first_name LIKE ?
      OR u.last_name LIKE ?
      OR ta.account_number LIKE ?
      OR CAST(th.id AS CHAR) LIKE ?
      OR s.symbol LIKE ?
    )`);
    params.push(like, like, like, like, like, like);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const sortableColumns = {
    closed_at: 'th.closed_at',
    profit: 'th.profit',
    lot_size: 'th.lot_size',
    symbol: 's.symbol',
    user: 'u.email',
    account: 'ta.account_number'
  };

  const orderColumn = sortableColumns[sortBy] || 'th.closed_at';
  const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const filterParams = [...params];

  const trades = await executeQuery(`
    SELECT 
      th.*,
      ta.account_number,
      ta.user_id,
      u.email AS user_email,
      CONCAT_WS(' ', u.first_name, u.last_name) AS user_name,
      s.symbol,
      s.name AS symbol_name,
      TIMESTAMPDIFF(MINUTE, th.opened_at, th.closed_at) as duration_minutes
    FROM trade_history th
    JOIN trading_accounts ta ON th.account_id = ta.id
    JOIN users u ON ta.user_id = u.id
    JOIN symbols s ON th.symbol_id = s.id
    ${whereClause}
    ORDER BY ${orderColumn} ${orderDirection}
    LIMIT ? OFFSET ?
  `, [...filterParams, limit, offset]);

  const totalResult = await executeQuery(`
    SELECT COUNT(*) as count
    FROM trade_history th
    JOIN trading_accounts ta ON th.account_id = ta.id
    JOIN users u ON ta.user_id = u.id
    JOIN symbols s ON th.symbol_id = s.id
    ${whereClause}
  `, filterParams);

  const summaryResult = await executeQuery(`
    SELECT 
      COALESCE(SUM(th.lot_size), 0) as total_volume,
      COALESCE(SUM(th.profit), 0) as total_profit,
      COALESCE(SUM(th.commission), 0) as total_commission,
      COALESCE(SUM(th.swap), 0) as total_swap
    FROM trade_history th
    JOIN trading_accounts ta ON th.account_id = ta.id
    JOIN users u ON ta.user_id = u.id
    JOIN symbols s ON th.symbol_id = s.id
    ${whereClause}
  `, filterParams);

  const summary = summaryResult.length ? summaryResult[0] : { total_volume: 0, total_profit: 0, total_commission: 0, total_swap: 0 };

  const formatNumber = (value) => (value === null || value === undefined ? 0 : parseFloat(value));

  const rows = trades.map((row) => {
    const lotSize = formatNumber(row.lot_size);
    const openPrice = formatNumber(row.open_price);
    const closePrice = formatNumber(row.close_price);
    const profit = formatNumber(row.profit);
    const commission = formatNumber(row.commission);
    const swap = formatNumber(row.swap);
    const fullName = (row.user_name || '').trim();

    return {
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: fullName.length ? fullName : row.user_email,
      accountId: row.account_id,
      accountNumber: row.account_number,
      symbolId: row.symbol_id,
      symbol: row.symbol,
      symbolName: row.symbol_name,
      side: row.side,
      lotSize,
      openPrice,
      closePrice,
      stopLoss: row.stop_loss !== null ? formatNumber(row.stop_loss) : null,
      takeProfit: row.take_profit !== null ? formatNumber(row.take_profit) : null,
      commission,
      swap,
      profit,
      netProfit: profit - commission - swap,
      closeReason: row.close_reason,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      durationMinutes: row.duration_minutes
    };
  });

  res.json({
    success: true,
    data: {
      rows,
      pagination: {
        page,
        limit,
        total: totalResult.length ? parseInt(totalResult[0].count, 10) : rows.length,
        pages: totalResult.length ? Math.ceil(parseInt(totalResult[0].count, 10) / limit) : 1
      },
      summary: {
        totalVolume: formatNumber(summary.total_volume),
        totalProfit: formatNumber(summary.total_profit),
        totalCommission: formatNumber(summary.total_commission),
        totalSwap: formatNumber(summary.total_swap),
        netProfit: formatNumber(summary.total_profit) - formatNumber(summary.total_commission) - formatNumber(summary.total_swap)
      }
    }
  });
}));

// List trading accounts for admin selection
router.get('/trading/accounts', asyncHandler(async (req, res) => {
  const { error, value } = adminTradingAccountsFilterSchema.validate(req.query, { abortEarly: false });
  if (error) {
    throw new AppError(error.details.map((detail) => detail.message).join(', '), 400);
  }

  const { search, status, page, limit } = value;

  const filters = [];
  const params = [];

  if (status) {
    filters.push('ta.status = ?');
    params.push(status);
  }

  if (search) {
    const like = `%${search}%`;
    filters.push(`(
      ta.account_number LIKE ?
      OR u.email LIKE ?
      OR u.first_name LIKE ?
      OR u.last_name LIKE ?
    )`);
    params.push(like, like, like, like);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const filterParams = [...params];

  const accounts = await executeQuery(`
    SELECT 
      ta.*,
      u.id as user_id,
      u.email as user_email,
      u.first_name,
      u.last_name
    FROM trading_accounts ta
    JOIN users u ON ta.user_id = u.id
    ${whereClause}
    ORDER BY ta.created_at DESC
    LIMIT ? OFFSET ?
  `, [...filterParams, limit, offset]);

  const totalResult = await executeQuery(`
    SELECT COUNT(*) as count
    FROM trading_accounts ta
    JOIN users u ON ta.user_id = u.id
    ${whereClause}
  `, filterParams);

  const rows = accounts.map((row) => {
    const formatNumber = (value) => (value === null || value === undefined ? 0 : parseFloat(value));
    const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();

    return {
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: fullName.length ? fullName : row.user_email,
      accountNumber: row.account_number,
      accountType: row.account_type,
      status: row.status,
      currency: row.currency,
      leverage: formatNumber(row.leverage),
      balance: formatNumber(row.balance),
      equity: formatNumber(row.equity),
      freeMargin: formatNumber(row.free_margin),
      marginLevel: formatNumber(row.margin_level),
      auto_square_percent: row.auto_square_percent,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });

  res.json({
    success: true,
    data: {
      rows,
      pagination: {
        page,
        limit,
        total: totalResult.length ? parseInt(totalResult[0].count, 10) : rows.length,
        pages: totalResult.length ? Math.ceil(parseInt(totalResult[0].count, 10) / limit) : 1
      }
    }
  });
}));

// Trading charges overview
router.get('/trading/charges', asyncHandler(async (req, res) => {
  const [symbolCharges, brokerageRates, leverageSettings] = await Promise.all([
    ChargeService.listSymbolCharges(),
    ChargeService.getBrokerageRates(),
    executeQuery(
      `SELECT setting_key, setting_value
       FROM system_settings
       WHERE setting_key IN ('default_leverage', 'max_leverage')`
    )
  ]);

  const leverage = {
    defaultLeverage: 0,
    maxLeverage: 0
  };

  leverageSettings.forEach((row) => {
    const numericValue = Number(row.setting_value);
    if (row.setting_key === 'default_leverage') {
      leverage.defaultLeverage = Number.isFinite(numericValue) ? numericValue : 0;
    }
    if (row.setting_key === 'max_leverage') {
      leverage.maxLeverage = Number.isFinite(numericValue) ? numericValue : 0;
    }
  });

  res.json({
    success: true,
    data: {
      symbols: symbolCharges,
      brokerage: brokerageRates,
      leverage
    }
  });
}));

const symbolChargeSchema = Joi.object({
  commissionPerLot: Joi.number().optional(),
  swapLong: Joi.number().optional(),
  swapShort: Joi.number().optional(),
  spreadMarkup: Joi.number().optional(),
  marginRequirement: Joi.number().optional(),
  status: Joi.string().valid('active', 'inactive').optional()
}).min(1);

router.patch('/trading/charges/symbols/:symbolId', asyncHandler(async (req, res) => {
  const symbolId = Number.parseInt(req.params.symbolId, 10);
  if (Number.isNaN(symbolId)) {
    throw new AppError('Invalid symbol id', 400);
  }

  const { error, value } = symbolChargeSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new AppError(error.details.map((detail) => detail.message).join(', '), 400);
  }

  // Log incoming update for debugging — helps verify payload from frontend
  console.log('[admin] PATCH /trading/charges/symbols/%d payload:', symbolId, JSON.stringify(value));

  await ChargeService.updateSymbolCharges(symbolId, value);

  const updatedSymbols = await ChargeService.listSymbolCharges();
  const updatedSymbol = updatedSymbols.find((row) => row.id === symbolId);

  if (!updatedSymbol) {
    throw new AppError('Symbol not found after update', 404);
  }

  // Log result for debugging
  console.log('[admin] updated symbol charges for id=%d ->', symbolId, JSON.stringify(updatedSymbol));

  res.json({
    success: true,
    data: updatedSymbol
  });
}));

const brokerageSchema = Joi.object({
  accountType: Joi.string().max(50).default('live'),
  standard: Joi.object({
    commission: Joi.number().required(),
    spreadMarkup: Joi.number().required(),
    commissionUnit: Joi.string().valid('per_lot', 'percentage', 'fixed').optional(),
    spreadUnit: Joi.string().valid('pips', 'per_lot', 'fixed', 'percentage').optional()
  }).optional(),
  vip: Joi.object({
    commission: Joi.number().required(),
    spreadMarkup: Joi.number().required(),
    commissionUnit: Joi.string().valid('per_lot', 'percentage', 'fixed').optional(),
    spreadUnit: Joi.string().valid('pips', 'per_lot', 'fixed', 'percentage').optional()
  }).optional()
}).or('standard', 'vip');

router.put('/trading/charges/brokerage', asyncHandler(async (req, res) => {
  const { error, value } = brokerageSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new AppError(error.details.map((detail) => detail.message).join(', '), 400);
  }

  const { accountType, standard, vip } = value;

  const promises = [];
  if (standard) {
    promises.push(ChargeService.upsertBrokerageRate({
      accountType,
      tierLevel: 'standard',
      commission: standard.commission,
      spreadMarkup: standard.spreadMarkup,
      commissionUnit: standard.commissionUnit || 'per_lot',
      spreadUnit: standard.spreadUnit || 'pips'
    }));
  }
  if (vip) {
    promises.push(ChargeService.upsertBrokerageRate({
      accountType,
      tierLevel: 'vip',
      commission: vip.commission,
      spreadMarkup: vip.spreadMarkup,
      commissionUnit: vip.commissionUnit || 'per_lot',
      spreadUnit: vip.spreadUnit || 'pips'
    }));
  }

  await Promise.all(promises);

  const updatedRates = await ChargeService.getBrokerageRates();

  res.json({
    success: true,
    data: updatedRates
  });
}));

const leverageSchema = Joi.object({
  defaultLeverage: Joi.number().positive().optional(),
  maxLeverage: Joi.number().positive().optional()
}).min(1);

router.patch('/trading/charges/leverage', asyncHandler(async (req, res) => {
  const { error, value } = leverageSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new AppError(error.details.map((detail) => detail.message).join(', '), 400);
  }

  const updates = [];

  if (value.defaultLeverage !== undefined) {
    updates.push(executeQuery(
      `UPDATE system_settings
       SET setting_value = ?, updated_at = CURRENT_TIMESTAMP
       WHERE setting_key = 'default_leverage'`,
      [value.defaultLeverage]
    ));
  }

  if (value.maxLeverage !== undefined) {
    updates.push(executeQuery(
      `UPDATE system_settings
       SET setting_value = ?, updated_at = CURRENT_TIMESTAMP
       WHERE setting_key = 'max_leverage'`,
      [value.maxLeverage]
    ));
  }

  await Promise.all(updates);

  const leverageSettings = await executeQuery(
    `SELECT setting_key, setting_value
     FROM system_settings
     WHERE setting_key IN ('default_leverage', 'max_leverage')`
  );

  const leverage = {
    defaultLeverage: 0,
    maxLeverage: 0
  };

  leverageSettings.forEach((row) => {
    const numericValue = Number(row.setting_value);
    if (row.setting_key === 'default_leverage') {
      leverage.defaultLeverage = Number.isFinite(numericValue) ? numericValue : 0;
    }
    if (row.setting_key === 'max_leverage') {
      leverage.maxLeverage = Number.isFinite(numericValue) ? numericValue : 0;
    }
  });

  res.json({
    success: true,
    data: leverage
  });
}));

const adminTradingUserLeverageFilterSchema = Joi.object({
  leverage: Joi.number().valid(...ALLOWED_LEVERAGE_VALUES).optional(),
  search: Joi.string().trim().allow('', null).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25)
});

const adminUpdateUserLeverageSchema = Joi.object({
  preferredLeverage: Joi.number().valid(...ALLOWED_LEVERAGE_VALUES).required()
});

const normalizePreferredLeverage = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const mapAccountRowToSummary = (row) => ({
  accountId: row.id,
  accountNumber: row.account_number,
  accountType: row.account_type,
  leverage: normalizePreferredLeverage(row.leverage),
  status: row.status,
  updatedAt: row.updated_at
});

const buildUserLeverageDataset = async ({ leverage, search, page, limit }) => {
  const filters = [];
  const params = [];

  if (typeof search === 'string' && search.trim().length) {
    const like = `%${search.trim()}%`;
    filters.push(`(u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)`);
    params.push(like, like, like);
  }

  if (leverage !== undefined) {
    filters.push('u.preferred_leverage = ?');
    params.push(leverage);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const users = await executeQuery(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.preferred_leverage, u.updated_at, u.created_at
     FROM users u
     ${whereClause}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const totalRows = await executeQuery(
    `SELECT COUNT(*) as count FROM users u ${whereClause}`,
    params
  );

  let accountRows = [];
  const userIds = users.map((row) => row.id);
  if (userIds.length) {
    const placeholders = userIds.map(() => '?').join(',');
    accountRows = await executeQuery(
      `SELECT id, user_id, account_number, account_type, leverage, status, updated_at
       FROM trading_accounts
       WHERE user_id IN (${placeholders})`,
      userIds
    );
  }

  const accountMap = new Map();
  accountRows.forEach((row) => {
    if (!accountMap.has(row.user_id)) {
      accountMap.set(row.user_id, []);
    }
    accountMap.get(row.user_id).push(mapAccountRowToSummary(row));
  });

  const rows = users.map((row) => {
    const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();

    return {
      userId: row.id,
      email: row.email,
      name: fullName.length ? fullName : row.email,
      preferredLeverage: normalizePreferredLeverage(row.preferred_leverage),
      updatedAt: row.updated_at,
      accounts: accountMap.get(row.id) || []
    };
  });

  return {
    rows,
    pagination: {
      page,
      limit,
      total: totalRows.length ? Number(totalRows[0].count) : rows.length,
      pages: totalRows.length ? Math.ceil(Number(totalRows[0].count) / limit) : 1
    }
  };
};

const updateUserPreferredLeverage = async (userId, preferredLeverage) => {
  const userRows = await executeQuery('SELECT id, email, first_name, last_name FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!userRows.length) {
    throw new AppError('User not found', 404);
  }

  await executeQuery(
    `UPDATE users
     SET preferred_leverage = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [preferredLeverage, userId]
  );

  await executeQuery(
    `UPDATE trading_accounts
     SET leverage = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [preferredLeverage, userId]
  );

  const [userRow] = await executeQuery(
    `SELECT id, email, first_name, last_name, preferred_leverage, updated_at
     FROM users
     WHERE id = ?`,
    [userId]
  );

  if (!userRow) {
    throw new AppError('User not found after update', 404);
  }

  const accounts = await executeQuery(
    `SELECT id, user_id, account_number, account_type, leverage, status, updated_at
     FROM trading_accounts
     WHERE user_id = ?`,
    [userId]
  );

  const fullName = [userRow.first_name, userRow.last_name].filter(Boolean).join(' ').trim();

  return {
    userId: userRow.id,
    email: userRow.email,
    name: fullName.length ? fullName : userRow.email,
    preferredLeverage: normalizePreferredLeverage(userRow.preferred_leverage),
    updatedAt: userRow.updated_at,
    accounts: accounts.map(mapAccountRowToSummary)
  };
};

router.get('/trading/charges/users', asyncHandler(async (req, res) => {
  const { error, value } = adminTradingUserLeverageFilterSchema.validate(req.query, { convert: true, stripUnknown: true });
  if (error) {
    throw new AppError(error.details.map((detail) => detail.message).join(', '), 400);
  }

  const data = await buildUserLeverageDataset(value);

  res.json({
    success: true,
    data
  });
}));

router.get('/trading/users/leverage', asyncHandler(async (req, res) => {
  const { error, value } = adminTradingUserLeverageFilterSchema.validate(req.query, { convert: true, stripUnknown: true });
  if (error) {
    throw new AppError(error.details.map((detail) => detail.message).join(', '), 400);
  }

  const data = await buildUserLeverageDataset(value);

  res.json({
    success: true,
    data
  });
}));

router.patch('/trading/charges/users/:userId/leverage', asyncHandler(async (req, res) => {
  const userId = Number.parseInt(req.params.userId, 10);
  if (Number.isNaN(userId)) {
    throw new AppError('Invalid user id', 400);
  }

  const { error, value } = adminUpdateUserLeverageSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new AppError(error.details.map((detail) => detail.message).join(', '), 400);
  }

  const data = await updateUserPreferredLeverage(userId, value.preferredLeverage);

  res.json({
    success: true,
    data
  });
}));

router.patch('/users/:userId/leverage', asyncHandler(async (req, res) => {
  const userId = Number.parseInt(req.params.userId, 10);
  if (Number.isNaN(userId)) {
    throw new AppError('Invalid user id', 400);
  }

  const { error, value } = adminUpdateUserLeverageSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new AppError(error.details.map((detail) => detail.message).join(', '), 400);
  }

  const data = await updateUserPreferredLeverage(userId, value.preferredLeverage);

  res.json({
    success: true,
    data
  });
}));

// Search symbols for admin trade management
router.get('/trading/symbols', asyncHandler(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const rawLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isNaN(rawLimit) ? 25 : Math.min(Math.max(rawLimit, 1), 100);

  const filters = ['s.is_active = 1'];
  const params = [];

  if (search) {
    filters.push('(s.symbol LIKE ? OR s.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const symbols = await executeQuery(`
    SELECT s.id, s.symbol, s.name
    FROM symbols s
    WHERE ${filters.join(' AND ')}
    ORDER BY s.symbol ASC
    LIMIT ?
  `, [...params, limit]);

  res.json({
    success: true,
    data: {
      rows: symbols
    }
  });
}));

// Get system settings
router.get('/settings', asyncHandler(async (req, res) => {
  const settings = await executeQuery(`
    SELECT setting_key, setting_value, description
    FROM system_settings
    ORDER BY setting_key
  `);

  const settingsObj = {};
  settings.forEach(setting => {
    settingsObj[setting.setting_key] = {
      value: setting.setting_value,
      description: setting.description
    };
  });

  res.json({ settings: settingsObj });
}));

// Update system settings
router.patch('/settings', asyncHandler(async (req, res) => {
  const { settings } = req.body;

  if (!settings || typeof settings !== 'object') {
    throw new AppError('Invalid settings format', 400);
  }

  for (const [key, value] of Object.entries(settings)) {
    await executeQuery(`
      UPDATE system_settings 
      SET setting_value = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE setting_key = ?
    `, [value, key]);
  }

  res.json({ message: 'Settings updated successfully' });
}));

// ===== PHASE 4: ADMIN IB MANAGEMENT ROUTES =====

const IntroducingBrokerService = require('../services/IntroducingBrokerService');

// Update IB share percentage (Admin only) - using USER ID not relationship ID
router.put('/ib/:ibId/share-percent', adminMiddleware, asyncHandler(async (req, res) => {
  const { ibId } = req.params;
  const { sharePercent } = req.body;

  if (!sharePercent || sharePercent < 0 || sharePercent > 100) {
    throw new AppError('Invalid share percentage (must be 0-100)', 400);
  }

  await IntroducingBrokerService.updateIBSharePercentByUserId(
    parseInt(ibId),
    parseFloat(sharePercent),
    req.user.id
  );

  res.json({
    success: true,
    message: 'IB share percentage updated successfully',
    data: {
      ibId: parseInt(ibId),
      sharePercent: parseFloat(sharePercent)
    }
  });
}));

// Update global IB commission settings (Admin only)
router.put('/ib/global-settings', adminMiddleware, asyncHandler(async (req, res) => {
  const { settingKey, settingValue } = req.body;

  if (!settingKey || settingValue === undefined) {
    throw new AppError('Setting key and value are required', 400);
  }

  const validKeys = ['default_commission_rate', 'default_ib_share_percent', 'min_ib_share_percent', 'max_ib_share_percent'];
  if (!validKeys.includes(settingKey)) {
    throw new AppError(`Invalid setting key. Must be one of: ${validKeys.join(', ')}`, 400);
  }

  await IntroducingBrokerService.updateGlobalSetting(
    settingKey,
    parseFloat(settingValue),
    req.user.id
  );

  res.json({
    success: true,
    message: 'Global IB setting updated successfully',
    data: {
      settingKey,
      settingValue: parseFloat(settingValue)
    }
  });
}));

// Get all IBs with commission stats (Admin only)
router.get('/ib/all', adminMiddleware, asyncHandler(async (req, res) => {
  const ibs = await IntroducingBrokerService.getAllIBsWithStats();

  res.json({
    success: true,
    data: ibs
  });
}));

// Get IB commission breakdown (Admin only)
router.get('/ib/commissions/breakdown', adminMiddleware, asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;

  const breakdown = await executeQuery(`
    SELECT 
      ib.id,
      u.first_name,
      u.last_name,
      u.email,
      ib.ib_share_percent,
      ib.commission_rate,
      ib.tier_level,
      COUNT(DISTINCT ic.id) as total_trades,
      SUM(COALESCE(ic.total_commission, 0)) as total_commission,
      SUM(COALESCE(ic.ib_amount, 0)) as total_ib_amount,
      SUM(COALESCE(ic.admin_amount, 0)) as total_admin_amount,
      COUNT(DISTINCT ib2.client_user_id) as total_clients
    FROM introducing_brokers ib
    JOIN users u ON ib.ib_user_id = u.id
    LEFT JOIN ib_commissions ic ON ic.ib_relationship_id = ib.id
      ${dateFrom && dateTo ? 'AND ic.created_at BETWEEN ? AND ?' : ''}
    LEFT JOIN introducing_brokers ib2 ON ib2.ib_user_id = ib.ib_user_id
    GROUP BY ib.id, u.first_name, u.last_name, u.email, ib.ib_share_percent, 
             ib.commission_rate, ib.tier_level
    ORDER BY total_commission DESC
  `, dateFrom && dateTo ? [dateFrom, dateTo] : []);

  res.json({
    success: true,
    data: breakdown.map(row => ({
      id: row.id,
      ibName: `${row.first_name} ${row.last_name}`,
      ibEmail: row.email,
      ibSharePercent: parseFloat(row.ib_share_percent || 50),
      commissionRate: parseFloat(row.commission_rate || 0),
      tierLevel: row.tier_level || 'bronze',
      totalTrades: parseInt(row.total_trades || 0),
      totalCommission: parseFloat(row.total_commission || 0),
      totalIBAmount: parseFloat(row.total_ib_amount || 0),
      totalAdminAmount: parseFloat(row.total_admin_amount || 0),
      totalClients: parseInt(row.total_clients || 0)
    }))
  });
}));

// Get all pending commissions (Admin only)
router.get('/ib/commissions/pending', adminMiddleware, asyncHandler(async (req, res) => {
  const pendingCommissions = await IntroducingBrokerService.getPendingCommissions();

  res.json({
    success: true,
    data: pendingCommissions
  });
}));

// Mark commission as paid (Admin only)
router.put('/ib/commissions/:commissionId/mark-paid', adminMiddleware, asyncHandler(async (req, res) => {
  const { commissionId } = req.params;

  await IntroducingBrokerService.markAsPaid(
    parseInt(commissionId),
    req.user.id
  );

  res.json({
    success: true,
    message: 'Commission marked as paid successfully',
    data: {
      commissionId: parseInt(commissionId)
    }
  });
}));

// Get IB global settings (Admin only)
router.get('/ib/global-settings', adminMiddleware, asyncHandler(async (req, res) => {
  const settings = await IntroducingBrokerService.getGlobalSettings();

  res.json({
    success: true,
    data: settings
  });
}));

// ==================== SYMBOL MANAGEMENT ROUTES ====================

// Get all symbols with filtering and pagination
router.get('/symbols', adminMiddleware, asyncHandler(async (req, res) => {
  const { category, search, status = 'all', page = 1, limit = 50 } = req.query;
  
  let sql = `
    SELECT 
      s.*,
      ac.name as category_name,
      ac.description as category_description
    FROM symbols s
    LEFT JOIN asset_categories ac ON s.category_id = ac.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (status !== 'all') {
    sql += ' AND s.is_active = ?';
    params.push(status === 'active' ? 1 : 0);
  }
  
  if (category && category !== 'all') {
    sql += ' AND ac.name = ?';
    params.push(category);
  }
  
  if (search) {
    sql += ' AND (s.symbol LIKE ? OR s.name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  // Get total count
  const countSql = `SELECT COUNT(*) as total FROM (${sql}) as counted`;
  const [countResult] = await executeQuery(countSql, params);
  const total = countResult.total;
  
  // Add pagination
  const offset = (parseInt(page) - 1) * parseInt(limit);
  sql += ' ORDER BY s.symbol ASC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  
  const symbols = await executeQuery(sql, params);
  
  res.json({
    success: true,
    data: {
      symbols,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    }
  });
}));

// Get single symbol details
router.get('/symbols/:id', adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const symbols = await executeQuery(
    `SELECT 
      s.*,
      ac.name as category_name
    FROM symbols s
    LEFT JOIN asset_categories ac ON s.category_id = ac.id
    WHERE s.id = ?`,
    [id]
  );
  
  if (symbols.length === 0) {
    throw new AppError('Symbol not found', 404);
  }
  
  res.json({
    success: true,
    data: symbols[0]
  });
}));

// Create new symbol
router.post('/symbols', adminMiddleware, asyncHandler(async (req, res) => {
  const symbolSchema = Joi.object({
    symbol: Joi.string().required().max(20),
    name: Joi.string().required().max(200),
    category_id: Joi.number().integer().required(),
    base_currency: Joi.string().max(10).optional().allow(null),
    quote_currency: Joi.string().max(10).optional().allow(null),
    pip_size: Joi.number().positive().default(0.0001),
    lot_size: Joi.number().positive().default(100000),
    min_lot: Joi.number().positive().default(0.01),
    max_lot: Joi.number().positive().default(100),
    lot_step: Joi.number().positive().default(0.01),
    contract_size: Joi.number().positive().default(100000),
    margin_requirement: Joi.number().positive().default(1.0),
    spread_type: Joi.string().valid('fixed', 'floating').default('floating'),
    spread_markup: Joi.number().default(0),
    commission_type: Joi.string().valid('per_lot', 'percentage', 'fixed').default('per_lot'),
    commission_value: Joi.number().default(0),
    swap_long: Joi.number().default(0),
    swap_short: Joi.number().default(0),
    is_active: Joi.boolean().default(true)
  });
  
  const { error, value } = symbolSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }
  
  // Check if symbol already exists
  const existing = await executeQuery(
    'SELECT id FROM symbols WHERE symbol = ?',
    [value.symbol.toUpperCase()]
  );
  
  if (existing.length > 0) {
    throw new AppError('Symbol already exists', 400);
  }
  
  // Check if category exists
  const category = await executeQuery(
    'SELECT id FROM asset_categories WHERE id = ?',
    [value.category_id]
  );
  
  if (category.length === 0) {
    throw new AppError('Invalid category', 400);
  }
  
  const result = await executeQuery(
    `INSERT INTO symbols (
      symbol, name, category_id, base_currency, quote_currency,
      pip_size, lot_size, min_lot, max_lot, lot_step,
      contract_size, margin_requirement, spread_type, spread_markup,
      commission_type, commission_value, swap_long, swap_short, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      value.symbol.toUpperCase(), value.name, value.category_id,
      value.base_currency, value.quote_currency, value.pip_size,
      value.lot_size, value.min_lot, value.max_lot, value.lot_step,
      value.contract_size, value.margin_requirement, value.spread_type,
      value.spread_markup, value.commission_type, value.commission_value,
      value.swap_long, value.swap_short, value.is_active
    ]
  );
  
  const newSymbol = await executeQuery(
    'SELECT s.*, ac.name as category_name FROM symbols s LEFT JOIN asset_categories ac ON s.category_id = ac.id WHERE s.id = ?',
    [result.insertId]
  );
  
  res.status(201).json({
    success: true,
    message: 'Symbol created successfully',
    data: newSymbol[0]
  });
}));

// Update symbol
router.put('/symbols/:id', adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const symbolSchema = Joi.object({
    symbol: Joi.string().max(20).optional(),
    name: Joi.string().max(200).optional(),
    category_id: Joi.number().integer().optional(),
    base_currency: Joi.string().max(10).optional().allow(null),
    quote_currency: Joi.string().max(10).optional().allow(null),
    pip_size: Joi.number().positive().optional(),
    lot_size: Joi.number().positive().optional(),
    min_lot: Joi.number().positive().optional(),
    max_lot: Joi.number().positive().optional(),
    lot_step: Joi.number().positive().optional(),
    contract_size: Joi.number().positive().optional(),
    margin_requirement: Joi.number().positive().optional(),
    spread_type: Joi.string().valid('fixed', 'floating').optional(),
    spread_markup: Joi.number().optional(),
    commission_type: Joi.string().valid('per_lot', 'percentage', 'fixed').optional(),
    commission_value: Joi.number().optional(),
    swap_long: Joi.number().optional(),
    swap_short: Joi.number().optional(),
    is_active: Joi.boolean().optional()
  });
  
  const { error, value } = symbolSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }
  
  // Check if symbol exists
  const existing = await executeQuery('SELECT id FROM symbols WHERE id = ?', [id]);
  if (existing.length === 0) {
    throw new AppError('Symbol not found', 404);
  }
  
  // Check if new symbol name conflicts
  if (value.symbol) {
    const conflict = await executeQuery(
      'SELECT id FROM symbols WHERE symbol = ? AND id != ?',
      [value.symbol.toUpperCase(), id]
    );
    if (conflict.length > 0) {
      throw new AppError('Symbol name already exists', 400);
    }
    value.symbol = value.symbol.toUpperCase();
  }
  
  // Check if category exists
  if (value.category_id) {
    const category = await executeQuery(
      'SELECT id FROM asset_categories WHERE id = ?',
      [value.category_id]
    );
    if (category.length === 0) {
      throw new AppError('Invalid category', 400);
    }
  }
  
  // Build update query dynamically
  const updateFields = [];
  const updateValues = [];
  
  Object.keys(value).forEach(key => {
    updateFields.push(`${key} = ?`);
    updateValues.push(value[key]);
  });
  
  if (updateFields.length === 0) {
    throw new AppError('No fields to update', 400);
  }
  
  updateValues.push(id);
  
  await executeQuery(
    `UPDATE symbols SET ${updateFields.join(', ')} WHERE id = ?`,
    updateValues
  );
  
  const updated = await executeQuery(
    'SELECT s.*, ac.name as category_name FROM symbols s LEFT JOIN asset_categories ac ON s.category_id = ac.id WHERE s.id = ?',
    [id]
  );
  
  res.json({
    success: true,
    message: 'Symbol updated successfully',
    data: updated[0]
  });
}));

// Delete symbol
router.delete('/symbols/:id', adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Check if symbol exists
  const symbol = await executeQuery('SELECT id, symbol FROM symbols WHERE id = ?', [id]);
  if (symbol.length === 0) {
    throw new AppError('Symbol not found', 404);
  }
  
  // Check if symbol has open positions
  const openPositions = await executeQuery(
    'SELECT COUNT(*) as count FROM positions WHERE symbol_id = ? AND status = ?',
    [id, 'open']
  );
  
  if (openPositions[0].count > 0) {
    throw new AppError('Cannot delete symbol with open positions. Please close all positions first.', 400);
  }
  
  // Soft delete - just set is_active to false
  await executeQuery(
    'UPDATE symbols SET is_active = 0 WHERE id = ?',
    [id]
  );
  
  res.json({
    success: true,
    message: 'Symbol deactivated successfully',
    data: { id, symbol: symbol[0].symbol }
  });
}));

// Permanently delete symbol (use with caution)
router.delete('/symbols/:id/permanent', adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Check if symbol exists
  const symbol = await executeQuery('SELECT id, symbol FROM symbols WHERE id = ?', [id]);
  if (symbol.length === 0) {
    throw new AppError('Symbol not found', 404);
  }
  
  // Check if symbol has any positions (open or closed)
  const positions = await executeQuery(
    'SELECT COUNT(*) as count FROM positions WHERE symbol_id = ?',
    [id]
  );
  
  if (positions[0].count > 0) {
    throw new AppError('Cannot permanently delete symbol with position history', 400);
  }
  
  // Delete market prices first (due to foreign key)
  await executeQuery('DELETE FROM market_prices WHERE symbol_id = ?', [id]);
  
  // Delete the symbol
  await executeQuery('DELETE FROM symbols WHERE id = ?', [id]);
  
  res.json({
    success: true,
    message: 'Symbol permanently deleted',
    data: { id, symbol: symbol[0].symbol }
  });
}));

// Toggle symbol active status
router.patch('/symbols/:id/toggle-status', adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const symbol = await executeQuery('SELECT id, symbol, is_active FROM symbols WHERE id = ?', [id]);
  if (symbol.length === 0) {
    throw new AppError('Symbol not found', 404);
  }
  
  const newStatus = !symbol[0].is_active;
  
  await executeQuery('UPDATE symbols SET is_active = ? WHERE id = ?', [newStatus, id]);
  
  res.json({
    success: true,
    message: `Symbol ${newStatus ? 'activated' : 'deactivated'} successfully`,
    data: {
      id,
      symbol: symbol[0].symbol,
      is_active: newStatus
    }
  });
}));

module.exports = router;