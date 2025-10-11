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
        COUNT(CASE WHEN status IN ('open', 'in_progress', 'waiting_user', 'pending') THEN 1 END) as open_tickets,
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
    `, [adminNotes, depositId]);
  } else {
    // Update deposit status to rejected
    await executeQuery(`
      UPDATE deposits 
      SET status = 'rejected', admin_notes = ?, processed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [adminNotes, depositId]);
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
    `, [adminNotes, withdrawalId]);
  } else {
    // Update withdrawal status to rejected
    await executeQuery(`
      UPDATE withdrawals 
      SET status = 'rejected', admin_notes = ?, processed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [adminNotes, withdrawalId]);
  }

  // Log admin action
  await executeQuery(`
    INSERT INTO admin_actions (admin_user_id, action, target_type, target_id, details)
    VALUES (?, ?, 'withdrawal', ?, ?)
  `, [req.user.id, `withdrawal_${action}`, withdrawalId, JSON.stringify({ adminNotes })]);

  res.json({ message: `Withdrawal ${action}ed successfully` });
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
  const marginRequirement = parseFloat(symbol.margin_requirement) || 1;
  const requiredMargin = (lotSize * contractSize * openPrice * marginRequirement) / 100;

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

module.exports = router;