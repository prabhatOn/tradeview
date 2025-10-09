const express = require('express');
const Joi = require('joi');
const { executeQuery, executeTransaction } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const Position = require('../models/Position');
const TradingAccount = require('../models/TradingAccount');
const TradeHistory = require('../models/TradeHistory');

const router = express.Router();

// Validation schemas
const openPositionSchema = Joi.object({
  accountId: Joi.number().integer().positive().required(),
  symbolId: Joi.number().integer().positive().required(),
  side: Joi.string().valid('buy', 'sell').required(),
  lotSize: Joi.number().positive().max(100).required(),
  stopLoss: Joi.alternatives().try(
    Joi.number().positive(),
    Joi.string().allow('').empty('').default(null),
    Joi.allow(null)
  ).optional(),
  takeProfit: Joi.alternatives().try(
    Joi.number().positive(),
    Joi.string().allow('').empty('').default(null),
    Joi.allow(null)
  ).optional(),
  comment: Joi.string().max(255).allow(null, '').optional()
});

const closePositionSchema = Joi.object({
  closeReason: Joi.string().valid('manual', 'stop_loss', 'take_profit').default('manual')
});

// Get user's open positions
router.get('/positions', asyncHandler(async (req, res) => {
  const accountId = req.query.accountId;
  
  const positions = await Position.findByUserId(req.user.id, accountId);
  
  res.json({ 
    success: true,
    data: positions.map(pos => pos.toJSON())
  });
}));

// Get user's trading history
router.get('/history', asyncHandler(async (req, res) => {
  const accountId = req.query.accountId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  
  const tradeHistory = await TradeHistory.findByUserId(req.user.id, accountId, limit, offset);
  
  res.json({
    success: true,
    data: tradeHistory.map(trade => trade.toJSON()),
    pagination: {
      page,
      limit,
      total: tradeHistory.length
    }
  });
}));
  
  const params = [req.user.id];
  
  if (accountId) {
    sql += ' AND th.account_id = ?';
    params.push(accountId);
  }
  
  sql += ' ORDER BY th.closed_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const trades = await executeQuery(sql, params);
  
  // Get total count for pagination
  let countSql = `
    SELECT COUNT(*) as count
    FROM trade_history th
    JOIN trading_accounts ta ON th.account_id = ta.id
    WHERE ta.user_id = ?
  `;
  
  const countParams = [req.user.id];
  if (accountId) {
    countSql += ' AND th.account_id = ?';
    countParams.push(accountId);
  }
  
  const totalCount = await executeQuery(countSql, countParams);
  
  res.json({
    trades,
    pagination: {
      page,
      limit,
      total: totalCount[0].count,
      pages: Math.ceil(totalCount[0].count / limit)
    }
  });
}));

// Get trading performance statistics
router.get('/performance', asyncHandler(async (req, res) => {
  const accountId = req.query.accountId;
  const days = parseInt(req.query.days) || 30;
  
  let sql = `
    SELECT 
      COUNT(*) as total_trades,
      SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END) as winning_trades,
      SUM(CASE WHEN profit < 0 THEN 1 ELSE 0 END) as losing_trades,
      ROUND((SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as win_rate,
      SUM(profit) as total_pnl,
      SUM(commission) as total_commission,
      AVG(profit) as avg_profit_per_trade,
      MAX(profit) as best_trade,
      MIN(profit) as worst_trade,
      SUM(CASE WHEN profit > 0 THEN profit ELSE 0 END) as gross_profit,
      ABS(SUM(CASE WHEN profit < 0 THEN profit ELSE 0 END)) as gross_loss
    FROM trade_history th
    JOIN trading_accounts ta ON th.account_id = ta.id
    WHERE ta.user_id = ?
    AND th.closed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
  `;
  
  const params = [req.user.id, days];
  
  if (accountId) {
    sql += ' AND th.account_id = ?';
    params.push(accountId);
  }
  
  const result = await executeQuery(sql, params);
  const stats = result[0];
  
  // Calculate profit factor
  if (stats.gross_loss > 0) {
    stats.profit_factor = (stats.gross_profit / stats.gross_loss).toFixed(2);
  } else {
    stats.profit_factor = stats.gross_profit > 0 ? 'Infinite' : '0.00';
  }
  
  // Get daily P&L for chart
  let dailySql = `
    SELECT 
      DATE(closed_at) as date,
      SUM(profit) as daily_pnl,
      COUNT(*) as daily_trades
    FROM trade_history th
    JOIN trading_accounts ta ON th.account_id = ta.id
    WHERE ta.user_id = ?
    AND th.closed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
  `;
  
  const dailyParams = [req.user.id, days];
  
  if (accountId) {
    dailySql += ' AND th.account_id = ?';
    dailyParams.push(accountId);
  }
  
  dailySql += ' GROUP BY DATE(closed_at) ORDER BY date DESC';
  
  const dailyStats = await executeQuery(dailySql, dailyParams);
  
  res.json({
    performance: stats,
    dailyStats
  });
}));

// Open new position
router.post('/positions', asyncHandler(async (req, res) => {
  console.log('Received position request:', req.body);
  console.log('Request body types:', {
    accountId: typeof req.body.accountId,
    symbolId: typeof req.body.symbolId,
    side: typeof req.body.side,
    lotSize: typeof req.body.lotSize,
    stopLoss: typeof req.body.stopLoss,
    takeProfit: typeof req.body.takeProfit,
    comment: typeof req.body.comment
  });
  console.log('Request body values:', {
    accountId: req.body.accountId,
    symbolId: req.body.symbolId,
    side: req.body.side,
    lotSize: req.body.lotSize,
    stopLoss: req.body.stopLoss,
    takeProfit: req.body.takeProfit,
    comment: req.body.comment
  });
  
  // Preprocess: convert empty strings to null
  const preprocessedBody = {
    ...req.body,
    stopLoss: req.body.stopLoss === '' ? null : req.body.stopLoss,
    takeProfit: req.body.takeProfit === '' ? null : req.body.takeProfit,
    comment: req.body.comment === '' ? null : req.body.comment
  };
  
  console.log('Preprocessed body:', preprocessedBody);
  
  const { error, value } = openPositionSchema.validate(preprocessedBody);
  if (error) {
    console.log('Validation error:', error.details[0].message);
    console.log('Validation error details:', error.details);
    throw new AppError(error.details[0].message, 400);
  }
  
  console.log('Validated data:', value);

  let { accountId, symbolId, side, lotSize, stopLoss, takeProfit, comment } = value;

  console.log('Extracted values:', {
    accountId, symbolId, side, lotSize, stopLoss, takeProfit, comment
  });

  console.log('Value types:', {
    accountId: typeof accountId,
    symbolId: typeof symbolId,
    side: typeof side,
    lotSize: typeof lotSize,
    stopLoss: typeof stopLoss,
    takeProfit: typeof takeProfit,
    comment: typeof comment
  });

  // Ensure undefined values are converted to null for SQL
  stopLoss = stopLoss === undefined ? null : stopLoss;
  takeProfit = takeProfit === undefined ? null : takeProfit;
  comment = comment === undefined ? null : comment;

  console.log('After null conversion:', {
    accountId, symbolId, side, lotSize, stopLoss, takeProfit, comment
  });

  // Verify account belongs to user
  const accounts = await executeQuery(
    'SELECT id, balance, equity, status FROM trading_accounts WHERE id = ? AND user_id = ?',
    [accountId, req.user.id]
  );

  if (!accounts.length) {
    throw new AppError('Trading account not found', 404);
  }

  const account = accounts[0];

  if (account.status !== 'active') {
    throw new AppError('Trading account is not active', 400);
  }

  // Get symbol information
  const symbols = await executeQuery(
    'SELECT * FROM symbols WHERE id = ? AND is_active = 1',
    [symbolId]
  );

  if (!symbols.length) {
    throw new AppError('Symbol not found or not active', 404);
  }

  const symbol = symbols[0];

  // Get current market price
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
  const openPrice = side === 'buy' ? currentPrice.ask : currentPrice.bid;

  // Calculate required margin
  const contractSize = parseFloat(symbol.contract_size);
  const marginRequirement = parseFloat(symbol.margin_requirement);
  const requiredMargin = (lotSize * contractSize * openPrice * marginRequirement) / 100;

  // Check if user has sufficient free margin
  if (account.equity < requiredMargin) {
    throw new AppError('Insufficient margin to open position', 400);
  }

  // Calculate commission
  const commission = lotSize * parseFloat(symbol.commission_value);

  // Open position - handle null values for SQL
  const result = await executeQuery(
    `INSERT INTO positions (
       account_id, symbol_id, side, lot_size, open_price,
       stop_loss, take_profit, commission, comment, opened_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      accountId, 
      symbolId, 
      side, 
      lotSize, 
      openPrice, 
      stopLoss || null, 
      takeProfit || null, 
      commission, 
      comment || null
    ]
  );

  // Update account balance (deduct commission)
  await executeQuery(
    'UPDATE trading_accounts SET balance = balance - ? WHERE id = ?',
    [commission, accountId]
  );

  // Recalculate account equity
  await executeQuery('CALL CalculateAccountEquity(?)', [accountId]);

  res.status(201).json({
    success: true,
    message: 'Position opened successfully',
    data: {
      positionId: result.insertId,
      openPrice,
      commission,
      requiredMargin
    }
  });
}));

// Close position
router.delete('/positions/:id', asyncHandler(async (req, res) => {
  const positionId = parseInt(req.params.id);
  const { error, value } = closePositionSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { closeReason } = value;

  // Verify position belongs to user
  const positions = await executeQuery(
    `SELECT p.*, ta.user_id, s.symbol
     FROM positions p
     JOIN trading_accounts ta ON p.account_id = ta.id
     JOIN symbols s ON p.symbol_id = s.id
     WHERE p.id = ? AND p.status = 'open'`,
    [positionId]
  );

  if (!positions.length) {
    throw new AppError('Position not found or already closed', 404);
  }

  const position = positions[0];

  if (position.user_id !== req.user.id) {
    throw new AppError('Position does not belong to you', 403);
  }

  // Get current market price
  const prices = await executeQuery(
    `SELECT bid, ask FROM market_prices 
     WHERE symbol_id = ? 
     ORDER BY timestamp DESC 
     LIMIT 1`,
    [position.symbol_id]
  );

  if (!prices.length) {
    throw new AppError('No current market price available', 400);
  }

  const currentPrice = prices[0];
  const closePrice = position.side === 'buy' ? currentPrice.bid : currentPrice.ask;

  // Close position using stored procedure
  await executeQuery(
    'CALL ClosePosition(?, ?, ?)',
    [positionId, closePrice, closeReason]
  );

  res.json({
    message: 'Position closed successfully',
    closePrice,
    closeReason
  });
}));

// Update position (modify SL/TP)
router.put('/positions/:id', asyncHandler(async (req, res) => {
  const positionId = parseInt(req.params.id);
  
  const updateSchema = Joi.object({
    stopLoss: Joi.number().positive().optional().allow(null),
    takeProfit: Joi.number().positive().optional().allow(null)
  });

  const { error, value } = updateSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { stopLoss, takeProfit } = value;

  // Verify position belongs to user
  const positions = await executeQuery(
    `SELECT p.id
     FROM positions p
     JOIN trading_accounts ta ON p.account_id = ta.id
     WHERE p.id = ? AND p.status = 'open' AND ta.user_id = ?`,
    [positionId, req.user.id]
  );

  if (!positions.length) {
    throw new AppError('Position not found or already closed', 404);
  }

  const updateFields = [];
  const updateValues = [];

  if (stopLoss !== undefined) {
    updateFields.push('stop_loss = ?');
    updateValues.push(stopLoss);
  }

  if (takeProfit !== undefined) {
    updateFields.push('take_profit = ?');
    updateValues.push(takeProfit);
  }

  if (updateFields.length === 0) {
    throw new AppError('No fields to update', 400);
  }

  updateValues.push(positionId);

  await executeQuery(
    `UPDATE positions SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    updateValues
  );

  res.json({ message: 'Position updated successfully' });
}));

// Get account summary
router.get('/accounts/:id/summary', asyncHandler(async (req, res) => {
  const accountId = parseInt(req.params.id);

  // Verify account belongs to user
  const accounts = await executeQuery(
    `SELECT * FROM trading_accounts WHERE id = ? AND user_id = ?`,
    [accountId, req.user.id]
  );

  if (!accounts.length) {
    throw new AppError('Trading account not found', 404);
  }

  const account = accounts[0];

  // Get open positions count and unrealized P&L
  const positionStats = await executeQuery(
    `SELECT 
       COUNT(*) as open_positions,
       COALESCE(SUM(profit), 0) as unrealized_pnl
     FROM positions
     WHERE account_id = ? AND status = 'open'`,
    [accountId]
  );

  // Get today's trading stats
  const todayStats = await executeQuery(
    `SELECT 
       COUNT(*) as today_trades,
       COALESCE(SUM(profit), 0) as today_pnl
     FROM trade_history
     WHERE account_id = ? AND DATE(closed_at) = CURDATE()`,
    [accountId]
  );

  // Get recent performance (last 30 days)
  const performanceStats = await executeQuery(
    `SELECT 
       COUNT(*) as total_trades,
       SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END) as winning_trades,
       ROUND((SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as win_rate,
       SUM(profit) as total_pnl
     FROM trade_history
     WHERE account_id = ? AND closed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    [accountId]
  );

  res.json({
    account: {
      ...account,
      open_positions: positionStats[0].open_positions,
      unrealized_pnl: positionStats[0].unrealized_pnl,
      today_trades: todayStats[0].today_trades,
      today_pnl: todayStats[0].today_pnl,
      performance: performanceStats[0]
    }
  });
}));

module.exports = router;