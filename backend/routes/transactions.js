/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require('express');
const Joi = require('joi');
const { executeQuery } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Validation schemas
const depositSchema = Joi.object({
  accountId: Joi.number().integer().positive().required(),
  paymentMethodId: Joi.number().integer().positive().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().length(3).uppercase().default('USD'),
  paymentReference: Joi.string().max(255).optional(),
  userNotes: Joi.string().max(500).optional()
});

const withdrawalSchema = Joi.object({
  accountId: Joi.number().integer().positive().required(),
  paymentMethodId: Joi.number().integer().positive().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().length(3).uppercase().default('USD'),
  paymentReference: Joi.string().max(255).optional(),
  userNotes: Joi.string().max(500).optional()
});

// Get user's transaction history
router.get('/history', asyncHandler(async (req, res) => {
  const type = req.query.type; // 'deposit', 'withdrawal', or undefined for both
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  let sql = '';
  let params = [];

  if (type === 'deposit') {
    sql = `
      SELECT 
        'deposit' as type,
        d.id,
        d.transaction_id,
        d.amount,
        d.currency,
        d.fee,
        d.net_amount,
        d.status,
        pm.name as payment_method,
        d.payment_reference,
        d.user_notes,
        d.admin_notes,
        d.created_at,
        d.processed_at,
        ta.account_number
      FROM deposits d
      JOIN payment_methods pm ON d.payment_method_id = pm.id
      JOIN trading_accounts ta ON d.account_id = ta.id
      WHERE d.user_id = ?
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params = [req.user.id, limit, offset];
  } else if (type === 'withdrawal') {
    sql = `
      SELECT 
        'withdrawal' as type,
        w.id,
        w.transaction_id,
        w.amount,
        w.currency,
        w.fee,
        w.net_amount,
        w.status,
        pm.name as payment_method,
        w.payment_reference,
        w.user_notes,
        w.admin_notes,
        w.created_at,
        w.processed_at,
        ta.account_number
      FROM withdrawals w
      JOIN payment_methods pm ON w.payment_method_id = pm.id
      JOIN trading_accounts ta ON w.account_id = ta.id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params = [req.user.id, limit, offset];
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
        d.status,
        pm.name as payment_method,
        d.payment_reference,
        d.user_notes,
        d.admin_notes,
        d.created_at,
        d.processed_at,
        ta.account_number
      FROM deposits d
      JOIN payment_methods pm ON d.payment_method_id = pm.id
      JOIN trading_accounts ta ON d.account_id = ta.id
      WHERE d.user_id = ?
      
      UNION ALL
      
      SELECT 
        'withdrawal' as type,
        w.id,
        w.transaction_id,
        w.amount,
        w.currency,
        w.fee,
        w.net_amount,
        w.status,
        pm.name as payment_method,
        w.payment_reference,
        w.user_notes,
        w.admin_notes,
        w.created_at,
        w.processed_at,
        ta.account_number
      FROM withdrawals w
      JOIN payment_methods pm ON w.payment_method_id = pm.id
      JOIN trading_accounts ta ON w.account_id = ta.id
      WHERE w.user_id = ?
      
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    params = [req.user.id, req.user.id, limit, offset];
  }

  const transactions = await executeQuery(sql, params);

  // Get total count for pagination
  let countSql = '';
  let countParams = [];

  if (type === 'deposit') {
    countSql = 'SELECT COUNT(*) as count FROM deposits WHERE user_id = ?';
    countParams = [req.user.id];
  } else if (type === 'withdrawal') {
    countSql = 'SELECT COUNT(*) as count FROM withdrawals WHERE user_id = ?';
    countParams = [req.user.id];
  } else {
    countSql = `
      SELECT (
        (SELECT COUNT(*) FROM deposits WHERE user_id = ?) +
        (SELECT COUNT(*) FROM withdrawals WHERE user_id = ?)
      ) as count
    `;
    countParams = [req.user.id, req.user.id];
  }

  const totalCount = await executeQuery(countSql, countParams);

  res.json({
    transactions,
    pagination: {
      page,
      limit,
      total: totalCount[0].count,
      pages: Math.ceil(totalCount[0].count / limit)
    }
  });
}));

// Get available payment methods
router.get('/payment-methods', asyncHandler(async (req, res) => {
  const paymentMethods = await executeQuery(`
    SELECT 
      id,
      name,
      type,
      provider,
      supported_currencies,
      min_amount,
      max_amount,
      deposit_fee_type,
      deposit_fee_value,
      withdrawal_fee_type,
      withdrawal_fee_value,
      processing_time_hours
    FROM payment_methods
    WHERE is_active = 1
    ORDER BY name
  `);

  res.json({ paymentMethods });
}));

// Create deposit request
router.post('/deposits', asyncHandler(async (req, res) => {
  const { error, value } = depositSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { accountId, paymentMethodId, amount, currency, paymentReference, userNotes } = value;

  // Verify account belongs to user
  const accounts = await executeQuery(
    'SELECT id FROM trading_accounts WHERE id = ? AND user_id = ?',
    [accountId, req.user.id]
  );

  if (!accounts.length) {
    throw new AppError('Trading account not found', 404);
  }

  // Get payment method details
  const paymentMethods = await executeQuery(
    'SELECT * FROM payment_methods WHERE id = ? AND is_active = 1',
    [paymentMethodId]
  );

  if (!paymentMethods.length) {
    throw new AppError('Payment method not found or not active', 404);
  }

  const paymentMethod = paymentMethods[0];

  // Validate amount limits
  if (amount < parseFloat(paymentMethod.min_amount)) {
    throw new AppError(`Minimum deposit amount is ${paymentMethod.min_amount}`, 400);
  }

  if (paymentMethod.max_amount && amount > parseFloat(paymentMethod.max_amount)) {
    throw new AppError(`Maximum deposit amount is ${paymentMethod.max_amount}`, 400);
  }

  // Check if currency is supported
  const supportedCurrencies = JSON.parse(paymentMethod.supported_currencies);
  if (!supportedCurrencies.includes(currency)) {
    throw new AppError(`Currency ${currency} is not supported for this payment method`, 400);
  }

  // Generate transaction ID
  const transactionId = `DEP-${new Date().getFullYear()}-${Date.now()}`;

  // Calculate fee
  let fee = 0;
  if (paymentMethod.deposit_fee_type === 'percentage') {
    fee = (amount * parseFloat(paymentMethod.deposit_fee_value)) / 100;
  } else {
    fee = parseFloat(paymentMethod.deposit_fee_value);
  }

  const netAmount = amount - fee;

  // Create deposit record
  const result = await executeQuery(`
    INSERT INTO deposits (
      user_id, account_id, transaction_id, payment_method_id,
      amount, currency, fee, net_amount, payment_reference, user_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    req.user.id, accountId, transactionId, paymentMethodId,
    amount, currency, fee, netAmount, paymentReference, userNotes
  ]);

  res.status(201).json({
    message: 'Deposit request created successfully',
    deposit: {
      id: result.insertId,
      transactionId,
      amount,
      fee,
      netAmount,
      status: 'pending'
    }
  });
}));

// Create withdrawal request
router.post('/withdrawals', asyncHandler(async (req, res) => {
  const { error, value } = withdrawalSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { accountId, paymentMethodId, amount, currency, paymentReference, userNotes } = value;

  // Verify account belongs to user and check balance
  const accounts = await executeQuery(
    'SELECT id, balance FROM trading_accounts WHERE id = ? AND user_id = ?',
    [accountId, req.user.id]
  );

  if (!accounts.length) {
    throw new AppError('Trading account not found', 404);
  }

  const account = accounts[0];

  // Get payment method details
  const paymentMethods = await executeQuery(
    'SELECT * FROM payment_methods WHERE id = ? AND is_active = 1',
    [paymentMethodId]
  );

  if (!paymentMethods.length) {
    throw new AppError('Payment method not found or not active', 404);
  }

  const paymentMethod = paymentMethods[0];

  // Calculate fee
  let fee = 0;
  if (paymentMethod.withdrawal_fee_type === 'percentage') {
    fee = (amount * parseFloat(paymentMethod.withdrawal_fee_value)) / 100;
  } else {
    fee = parseFloat(paymentMethod.withdrawal_fee_value);
  }

  const totalRequired = amount + fee;

  // Check if user has sufficient balance
  if (parseFloat(account.balance) < totalRequired) {
    throw new AppError('Insufficient balance for withdrawal', 400);
  }

  // Validate amount limits
  if (amount < parseFloat(paymentMethod.min_amount)) {
    throw new AppError(`Minimum withdrawal amount is ${paymentMethod.min_amount}`, 400);
  }

  if (paymentMethod.max_amount && amount > parseFloat(paymentMethod.max_amount)) {
    throw new AppError(`Maximum withdrawal amount is ${paymentMethod.max_amount}`, 400);
  }

  // Check if currency is supported
  const supportedCurrencies = JSON.parse(paymentMethod.supported_currencies);
  if (!supportedCurrencies.includes(currency)) {
    throw new AppError(`Currency ${currency} is not supported for this payment method`, 400);
  }

  // Generate transaction ID
  const transactionId = `WTH-${new Date().getFullYear()}-${Date.now()}`;

  const netAmount = amount - fee;

  // Create withdrawal record
  const result = await executeQuery(`
    INSERT INTO withdrawals (
      user_id, account_id, transaction_id, payment_method_id,
      amount, currency, fee, net_amount, payment_reference, user_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    req.user.id, accountId, transactionId, paymentMethodId,
    amount, currency, fee, netAmount, paymentReference, userNotes
  ]);

  res.status(201).json({
    message: 'Withdrawal request created successfully',
    withdrawal: {
      id: result.insertId,
      transactionId,
      amount,
      fee,
      netAmount,
      status: 'pending'
    }
  });
}));

// Get transaction details
router.get('/:type/:id', asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const transactionId = parseInt(id);

  if (!['deposits', 'withdrawals'].includes(type)) {
    throw new AppError('Invalid transaction type', 400);
  }

  const table = type === 'deposits' ? 'deposits' : 'withdrawals';

  const transactions = await executeQuery(`
    SELECT 
      t.*,
      pm.name as payment_method_name,
      pm.type as payment_method_type,
      ta.account_number
    FROM ${table} t
    JOIN payment_methods pm ON t.payment_method_id = pm.id
    JOIN trading_accounts ta ON t.account_id = ta.id
    WHERE t.id = ? AND t.user_id = ?
  `, [transactionId, req.user.id]);

  if (!transactions.length) {
    throw new AppError('Transaction not found', 404);
  }

  res.json({ transaction: transactions[0] });
}));

// Cancel pending transaction
router.delete('/:type/:id', asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const transactionId = parseInt(id);

  if (!['deposits', 'withdrawals'].includes(type)) {
    throw new AppError('Invalid transaction type', 400);
  }

  const table = type === 'deposits' ? 'deposits' : 'withdrawals';

  // Check if transaction exists and belongs to user
  const transactions = await executeQuery(`
    SELECT id, status FROM ${table} WHERE id = ? AND user_id = ?
  `, [transactionId, req.user.id]);

  if (!transactions.length) {
    throw new AppError('Transaction not found', 404);
  }

  const transaction = transactions[0];

  if (transaction.status !== 'pending') {
    throw new AppError('Only pending transactions can be cancelled', 400);
  }

  // Update transaction status
  await executeQuery(`
    UPDATE ${table} SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [transactionId]);

  res.json({ message: 'Transaction cancelled successfully' });
}));

// Get transaction summary
router.get('/summary', asyncHandler(async (req, res) => {
  const summary = await Promise.all([
    // Total deposits
    executeQuery(`
      SELECT 
        COUNT(*) as total_deposits,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN net_amount ELSE 0 END), 0) as total_deposited,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_deposits
      FROM deposits
      WHERE user_id = ?
    `, [req.user.id]),

    // Total withdrawals
    executeQuery(`
      SELECT 
        COUNT(*) as total_withdrawals,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN net_amount ELSE 0 END), 0) as total_withdrawn,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_withdrawals
      FROM withdrawals
      WHERE user_id = ?
    `, [req.user.id]),

    // Recent transactions (last 30 days)
    executeQuery(`
      SELECT 
        COUNT(*) as recent_transactions,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN net_amount ELSE 0 END), 0) as recent_volume
      FROM (
        SELECT net_amount, status FROM deposits WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        UNION ALL
        SELECT -net_amount, status FROM withdrawals WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ) as recent
    `, [req.user.id, req.user.id])
  ]);

  res.json({
    deposits: summary[0][0],
    withdrawals: summary[1][0],
    recent: summary[2][0]
  });
}));

module.exports = router;