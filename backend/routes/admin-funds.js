/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require('express');
const Joi = require('joi');
const { executeQuery, executeTransaction } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const { adminMiddleware } = require('../middleware/auth');
const FundManager = require('../services/FundManager');
const { selectColumnOrNull } = require('../utils/schemaUtils');

const router = express.Router();
router.use(adminMiddleware);

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().trim().optional(),
  search: Joi.string().trim().allow('').optional(),
  type: Joi.string().valid('deposits', 'withdrawals').default('deposits'),
  sortBy: Joi.string().valid('created_at', 'amount', 'net_amount', 'status').default('created_at'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const approvalSchema = Joi.object({
  notes: Joi.string().allow('').max(1000).optional(),
  adminNotes: Joi.string().allow('').max(1000).optional()
});

const batchSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject').required(),
  type: Joi.string().valid('deposits', 'withdrawals').required(),
  ids: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
  notes: Joi.string().allow('').max(1000).optional()
});

const adjustmentSchema = Joi.object({
  accountId: Joi.number().integer().positive().required(),
  amount: Joi.number().positive().required(),
  direction: Joi.string().valid('credit', 'debit').default('credit'),
  reasonCode: Joi.string().max(100).default('manual_adjustment'),
  notes: Joi.string().allow('').max(1000).optional(),
  metadata: Joi.object().unknown(true).optional()
});

const chartSchema = Joi.object({
  range: Joi.string().valid('7d', '14d', '30d', '90d').default('30d')
});

async function getTransactionSummary() {
  const [summary] = await executeQuery(`
    SELECT 
      (SELECT COUNT(*) FROM deposits WHERE status = 'pending') AS pendingDeposits,
      (SELECT COUNT(*) FROM withdrawals WHERE status = 'pending') AS pendingWithdrawals,
      (SELECT COALESCE(SUM(net_amount),0) FROM deposits WHERE status = 'completed') AS totalDeposits,
      (SELECT COALESCE(SUM(amount + fee),0) FROM withdrawals WHERE status = 'completed') AS totalWithdrawals,
      (SELECT COALESCE(SUM(balance),0) FROM trading_accounts) AS totalBalances,
      (SELECT COUNT(*) FROM users) AS totalUsers
  `);

  return summary;
}

router.get('/overview', asyncHandler(async (req, res) => {
  const summary = await getTransactionSummary();

  const recentActivity = await executeQuery(`
    SELECT * FROM (
      SELECT 
        d.id,
        'deposit' AS type,
        d.transaction_id,
        u.email,
        ta.account_number,
        d.amount,
        d.net_amount,
        d.status,
        d.created_at
      FROM deposits d
      INNER JOIN users u ON u.id = d.user_id
      INNER JOIN trading_accounts ta ON ta.id = d.account_id
      ORDER BY d.created_at DESC
      LIMIT 5
    ) AS latestDeposits
    UNION ALL
    SELECT 
      w.id,
      'withdrawal' AS type,
      w.transaction_id,
      u.email,
      ta.account_number,
      w.amount,
      w.net_amount,
      w.status,
      w.created_at
    FROM withdrawals w
    INNER JOIN users u ON u.id = w.user_id
    INNER JOIN trading_accounts ta ON ta.id = w.account_id
    ORDER BY created_at DESC
    LIMIT 10
  `);

  res.json({
    success: true,
    data: {
      summary,
      recentActivity
    }
  });
}));

router.get('/chart', asyncHandler(async (req, res) => {
  const { value, error } = chartSchema.validate(req.query);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const rangeMap = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 };
  const days = rangeMap[value.range];

  const chartRows = await executeQuery(`
    SELECT 
      DATE(created_at) AS activityDate,
      SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END) AS totalDeposits,
      SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END) AS totalWithdrawals
    FROM (
      SELECT created_at, net_amount AS amount, 'deposit' AS type
      FROM deposits
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND status = 'completed'
      UNION ALL
      SELECT created_at, amount + fee AS amount, 'withdrawal' AS type
      FROM withdrawals
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND status = 'completed'
    ) AS t
    GROUP BY activityDate
    ORDER BY activityDate ASC
  `, [days, days]);

  res.json({
    success: true,
    data: chartRows
  });
}));

router.get('/transactions', asyncHandler(async (req, res) => {
  const { value, error } = paginationSchema.validate(req.query);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { page, limit, status, search, type, sortBy, sortOrder } = value;
  const offset = (page - 1) * limit;
  const table = type === 'deposits' ? 'deposits' : 'withdrawals';

  const reviewNotesSelect = await selectColumnOrNull(table, 'review_notes');

  const filters = [];
  const params = [];

  if (status && status !== 'all') {
    filters.push(`${table}.status = ?`);
    params.push(status);
  }

  if (search) {
    filters.push(`(u.email LIKE ? OR ta.account_number LIKE ? OR ${table}.transaction_id LIKE ?)`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const sortColumnMap = {
    created_at: `${table}.created_at`,
    amount: `${table}.amount`,
    net_amount: `${table}.net_amount`,
    status: `${table}.status`
  };

  const sortColumn = sortColumnMap[sortBy] || `${table}.created_at`;
  
  // Build the query with conditional joins for bank details (only for withdrawals)
  let selectFields = `
    ${table}.id,
    ${table}.transaction_id,
    ${table}.amount,
    ${table}.fee,
    ${table}.net_amount,
    ${table}.status,
    ${table}.payment_reference,
    ${table}.user_notes,
    ${table}.admin_notes,
${reviewNotesSelect},
    ${table}.created_at,
    ${table}.processed_at,
    ${table}.reviewed_at,
    ${table}.processed_by,
    ${table}.reviewed_by,
    ${table}.batch_reference,
    pm.name AS payment_method_name,
    pm.type AS payment_method_type,
    u.email,
    CONCAT(u.first_name, ' ', u.last_name) AS user_name,
    ta.account_number`;
  
  let joinClause = `
    FROM ${table}
    INNER JOIN users u ON u.id = ${table}.user_id
    INNER JOIN trading_accounts ta ON ta.id = ${table}.account_id
    INNER JOIN payment_methods pm ON pm.id = ${table}.payment_method_id`;
  
  // Add bank details for withdrawals
  if (type === 'withdrawals') {
    selectFields += `,
    ba.bank_name,
    ba.account_name AS bank_account_name,
    ba.account_number AS bank_account_number,
    ba.account_type,
    ba.iban,
    ba.swift_code,
    ba.routing_number,
    ba.branch_name`;
    
    joinClause += `
    LEFT JOIN payment_gateways pg ON pg.id = ${table}.payment_gateway_id
    LEFT JOIN bank_accounts ba ON ba.payment_gateway_id = pg.id`;
  }
  
  const rows = await executeQuery(`
    SELECT ${selectFields}
    ${joinClause}
    ${whereClause}
    ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  const countRows = await executeQuery(
    `SELECT COUNT(*) AS totalCount FROM ${table}
     INNER JOIN users u ON u.id = ${table}.user_id
     INNER JOIN trading_accounts ta ON ta.id = ${table}.account_id
     ${whereClause}`,
    params
  );

  res.json({
    success: true,
    data: {
      rows,
      pagination: {
        page,
        limit,
        total: countRows[0]?.totalCount || 0,
        pages: Math.ceil((countRows[0]?.totalCount || 0) / limit)
      }
    }
  });
}));

async function approveDepositById(id, adminId, notes) {
  return executeTransaction(async (connection) => {
    const [rows] = await connection.execute(`
      SELECT d.*, pm.type AS payment_method_type
      FROM deposits d
      INNER JOIN payment_methods pm ON pm.id = d.payment_method_id
      WHERE d.id = ? FOR UPDATE
    `, [id]);

    if (!rows.length) {
      throw new AppError('Deposit request not found', 404);
    }

    const deposit = rows[0];

    if (deposit.status !== 'pending') {
      throw new AppError('Only pending deposits can be approved', 400);
    }

    const result = await FundManager.processDeposit(
      deposit.account_id,
      parseFloat(deposit.net_amount),
      deposit.payment_method_type,
      deposit.transaction_id,
      {
        performedByType: 'admin',
        performedById: adminId,
        metadata: {
          requestId: deposit.id,
          fee: parseFloat(deposit.fee),
          grossAmount: parseFloat(deposit.amount)
        }
      }
    );

    await connection.execute(`
      UPDATE deposits 
      SET status = 'completed',
          processed_by = ?,
          processed_at = NOW(),
          reviewed_by = ?,
          reviewed_at = NOW(),
          review_notes = ?,
          admin_notes = COALESCE(?, admin_notes)
      WHERE id = ?
    `, [adminId, adminId, notes || null, notes || null, id]);

    return {
      result,
      deposit: {
        id: deposit.id,
        userId: deposit.user_id,
        accountId: deposit.account_id,
        amount: parseFloat(deposit.amount),
        netAmount: parseFloat(deposit.net_amount),
        fee: parseFloat(deposit.fee),
        method: deposit.payment_method_type,
        transactionId: deposit.transaction_id
      }
    };
  });
}

async function rejectDepositById(id, adminId, notes) {
  const updated = await executeQuery(`
    UPDATE deposits
    SET status = 'rejected',
        reviewed_by = ?,
        reviewed_at = NOW(),
        review_notes = ?,
        admin_notes = COALESCE(?, admin_notes)
    WHERE id = ? AND status = 'pending'
  `, [adminId, notes || null, notes || null, id]);

  if (updated.affectedRows === 0) {
    throw new AppError('Deposit could not be rejected (not pending)', 400);
  }
}

async function approveWithdrawalById(id, adminId, notes) {
  return executeTransaction(async (connection) => {
    const [rows] = await connection.execute(`
      SELECT w.*, pm.type AS payment_method_type
      FROM withdrawals w
      INNER JOIN payment_methods pm ON pm.id = w.payment_method_id
      WHERE w.id = ? FOR UPDATE
    `, [id]);

    if (!rows.length) {
      throw new AppError('Withdrawal request not found', 404);
    }

    const withdrawal = rows[0];

    if (withdrawal.status !== 'pending') {
      throw new AppError('Only pending withdrawals can be approved', 400);
    }

    const totalAmount = parseFloat(withdrawal.amount) + parseFloat(withdrawal.fee || 0);

    const result = await FundManager.processWithdrawal(
      withdrawal.account_id,
      totalAmount,
      withdrawal.payment_method_type,
      withdrawal.transaction_id,
      {
        performedByType: 'admin',
        performedById: adminId,
        metadata: {
          requestId: withdrawal.id,
          fee: parseFloat(withdrawal.fee),
          requestedAmount: parseFloat(withdrawal.amount)
        }
      }
    );

    await connection.execute(`
      UPDATE withdrawals 
      SET status = 'completed',
          processed_by = ?,
          processed_at = NOW(),
          reviewed_by = ?,
          reviewed_at = NOW(),
          review_notes = ?,
          admin_notes = COALESCE(?, admin_notes)
      WHERE id = ?
    `, [adminId, adminId, notes || null, notes || null, id]);

    return {
      result,
      withdrawal: {
        id: withdrawal.id,
        userId: withdrawal.user_id,
        accountId: withdrawal.account_id,
        amount: parseFloat(withdrawal.amount),
        netAmount: parseFloat(withdrawal.net_amount),
        fee: parseFloat(withdrawal.fee),
        method: withdrawal.payment_method_type,
        transactionId: withdrawal.transaction_id,
        totalAmount
      }
    };
  });
}

async function rejectWithdrawalById(id, adminId, notes) {
  const updated = await executeQuery(`
    UPDATE withdrawals
    SET status = 'rejected',
        reviewed_by = ?,
        reviewed_at = NOW(),
        review_notes = ?,
        admin_notes = COALESCE(?, admin_notes)
    WHERE id = ? AND status = 'pending'
  `, [adminId, notes || null, notes || null, id]);

  if (updated.affectedRows === 0) {
    throw new AppError('Withdrawal could not be rejected (not pending)', 400);
  }
}

router.post('/deposits/:id/approve', asyncHandler(async (req, res) => {
  const { value, error } = approvalSchema.validate(req.body || {});
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const approval = await approveDepositById(parseInt(req.params.id, 10), req.user.id, value.notes || value.adminNotes);

  if (global.broadcast && approval?.deposit && approval?.result) {
    global.broadcast({
      type: 'balance_update',
      userId: approval.deposit.userId,
      accountId: approval.deposit.accountId,
      data: {
        previousBalance: approval.result.previousBalance,
        newBalance: approval.result.newBalance,
        change: approval.deposit.netAmount,
        changeType: 'admin_deposit_approval',
        reason: 'deposit_approved',
        method: approval.deposit.method,
        transactionId: approval.deposit.transactionId,
        performedByType: 'admin',
        performedById: req.user.id,
        metadata: {
          depositId: approval.deposit.id,
          grossAmount: approval.deposit.amount,
          fee: approval.deposit.fee
        },
        timestamp: new Date().toISOString()
      }
    });
  }

  res.json({
    success: true,
    message: 'Deposit approved and funds credited',
    data: approval
  });
}));

router.post('/deposits/:id/reject', asyncHandler(async (req, res) => {
  const { value, error } = approvalSchema.validate(req.body || {});
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  await rejectDepositById(parseInt(req.params.id, 10), req.user.id, value.notes || value.adminNotes);

  res.json({
    success: true,
    message: 'Deposit request rejected'
  });
}));

router.post('/withdrawals/:id/approve', asyncHandler(async (req, res) => {
  const { value, error } = approvalSchema.validate(req.body || {});
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const approval = await approveWithdrawalById(parseInt(req.params.id, 10), req.user.id, value.notes || value.adminNotes);

  if (global.broadcast && approval?.withdrawal && approval?.result) {
    global.broadcast({
      type: 'balance_update',
      userId: approval.withdrawal.userId,
      accountId: approval.withdrawal.accountId,
      data: {
        previousBalance: approval.result.previousBalance,
        newBalance: approval.result.newBalance,
        change: -approval.withdrawal.totalAmount,
        changeType: 'admin_withdrawal_approval',
        reason: 'withdrawal_approved',
        method: approval.withdrawal.method,
        transactionId: approval.withdrawal.transactionId,
        performedByType: 'admin',
        performedById: req.user.id,
        metadata: {
          withdrawalId: approval.withdrawal.id,
          requestedAmount: approval.withdrawal.amount,
          fee: approval.withdrawal.fee
        },
        timestamp: new Date().toISOString()
      }
    });
  }

  res.json({
    success: true,
    message: 'Withdrawal approved and funds debited',
    data: approval
  });
}));

router.post('/withdrawals/:id/reject', asyncHandler(async (req, res) => {
  const { value, error } = approvalSchema.validate(req.body || {});
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  await rejectWithdrawalById(parseInt(req.params.id, 10), req.user.id, value.notes || value.adminNotes);

  res.json({
    success: true,
    message: 'Withdrawal request rejected'
  });
}));

router.post('/adjustments', asyncHandler(async (req, res) => {
  const { value, error } = adjustmentSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const result = await FundManager.applyManualAdjustment(
    value.accountId,
    value.amount,
    value.direction,
    {
      performedById: req.user.id,
      reasonCode: value.reasonCode,
      notes: value.notes,
      metadata: value.metadata
    }
  );

  if (global.broadcast && result?.accountId) {
    global.broadcast({
      type: 'balance_update',
      userId: result.userId || null,
      accountId: result.accountId,
      data: {
        previousBalance: result.previousBalance,
        newBalance: result.newBalance,
        change: result.change,
        changeType: result.changeType,
        reason: value.reasonCode,
        performedByType: 'admin',
        performedById: req.user.id,
        metadata: {
          notes: value.notes || null,
          reasonCode: value.reasonCode,
          adjustmentDirection: value.direction,
          manual: true
        },
        timestamp: new Date().toISOString()
      }
    });
  }

  res.status(201).json({
    success: true,
    message: `Manual ${value.direction} applied successfully`,
    data: result
  });
}));

router.post('/batch', asyncHandler(async (req, res) => {
  const { value, error } = batchSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const results = [];
  for (const id of value.ids) {
    try {
      if (value.type === 'deposits') {
        if (value.action === 'approve') {
          const approval = await approveDepositById(id, req.user.id, value.notes);

          if (global.broadcast && approval?.deposit && approval?.result) {
            global.broadcast({
              type: 'balance_update',
              userId: approval.deposit.userId,
              accountId: approval.deposit.accountId,
              data: {
                previousBalance: approval.result.previousBalance,
                newBalance: approval.result.newBalance,
                change: approval.deposit.netAmount,
                changeType: 'admin_deposit_approval',
                reason: 'deposit_approved',
                method: approval.deposit.method,
                transactionId: approval.deposit.transactionId,
                performedByType: 'admin',
                performedById: req.user.id,
                metadata: {
                  depositId: approval.deposit.id,
                  grossAmount: approval.deposit.amount,
                  fee: approval.deposit.fee,
                  batchReference: value.notes || null
                },
                timestamp: new Date().toISOString()
              }
            });
          }

          results.push({ id, status: 'success', message: 'Deposit approved', data: approval });
        } else {
          await rejectDepositById(id, req.user.id, value.notes);
          results.push({ id, status: 'success', message: 'Deposit rejected' });
        }
      } else {
        if (value.action === 'approve') {
          const approval = await approveWithdrawalById(id, req.user.id, value.notes);

          if (global.broadcast && approval?.withdrawal && approval?.result) {
            global.broadcast({
              type: 'balance_update',
              userId: approval.withdrawal.userId,
              accountId: approval.withdrawal.accountId,
              data: {
                previousBalance: approval.result.previousBalance,
                newBalance: approval.result.newBalance,
                change: -approval.withdrawal.totalAmount,
                changeType: 'admin_withdrawal_approval',
                reason: 'withdrawal_approved',
                method: approval.withdrawal.method,
                transactionId: approval.withdrawal.transactionId,
                performedByType: 'admin',
                performedById: req.user.id,
                metadata: {
                  withdrawalId: approval.withdrawal.id,
                  requestedAmount: approval.withdrawal.amount,
                  fee: approval.withdrawal.fee,
                  batchReference: value.notes || null
                },
                timestamp: new Date().toISOString()
              }
            });
          }

          results.push({ id, status: 'success', message: 'Withdrawal approved', data: approval });
        } else {
          await rejectWithdrawalById(id, req.user.id, value.notes);
          results.push({ id, status: 'success', message: 'Withdrawal rejected' });
        }
      }
    } catch (err) {
      results.push({ id, status: 'error', message: err.message || 'Failed to process record' });
    }
  }

  res.json({
    success: true,
    data: {
      processed: results
    }
  });
}));

router.get('/export', asyncHandler(async (req, res) => {
  const { value, error } = paginationSchema.validate(req.query);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { status, search, type } = value;
  const table = type === 'deposits' ? 'deposits' : 'withdrawals';

  const filters = [];
  const params = [];

  if (status && status !== 'all') {
    filters.push(`${table}.status = ?`);
    params.push(status);
  }

  if (search) {
    filters.push(`(u.email LIKE ? OR ta.account_number LIKE ? OR ${table}.transaction_id LIKE ?)`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const rows = await executeQuery(`
    SELECT 
      ${table}.transaction_id AS reference,
      u.email,
      ta.account_number,
      ${table}.amount,
      ${table}.fee,
      ${table}.net_amount,
      ${table}.status,
      ${table}.created_at,
      ${table}.processed_at,
      pm.name AS payment_method_name,
      pm.type AS payment_method_type
    FROM ${table}
    INNER JOIN users u ON u.id = ${table}.user_id
    INNER JOIN trading_accounts ta ON ta.id = ${table}.account_id
    INNER JOIN payment_methods pm ON pm.id = ${table}.payment_method_id
    ${whereClause}
    ORDER BY ${table}.created_at DESC
    LIMIT 1000
  `, params);

  res.json({
    success: true,
    data: {
      rows,
      generatedAt: new Date().toISOString()
    }
  });
}));

module.exports = router;
