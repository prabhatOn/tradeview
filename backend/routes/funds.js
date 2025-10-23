/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require('express');
const Joi = require('joi');
const { executeQuery } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const TradingAccount = require('../models/TradingAccount');
const FundManager = require('../services/FundManager');

const router = express.Router();

// Validation schemas
const depositSchema = Joi.object({
  accountId: Joi.number().integer().positive().required(),
  amount: Joi.number().positive().min(10).max(100000).required(),
  method: Joi.string().valid('bank_transfer', 'credit_card', 'debit_card', 'crypto', 'e_wallet').default('bank_transfer'),
  transactionId: Joi.string().max(100).optional()
});

const withdrawalSchema = Joi.object({
  accountId: Joi.number().integer().positive().required(),
  amount: Joi.number().positive().min(10).max(100000).required(),
  method: Joi.string().valid('bank_transfer', 'credit_card', 'debit_card', 'crypto', 'e_wallet').default('bank_transfer'),
  bankAccount: Joi.string().max(100).optional(),
  cryptoAddress: Joi.string().max(200).optional(),
  notes: Joi.string().max(500).optional()
});

// ============================================================================
// ACCOUNT BALANCE & STATISTICS
// ============================================================================

/**
 * Get account balance and statistics
 * GET /funds/account/:accountId/balance
 */
router.get('/account/:accountId/balance', asyncHandler(async (req, res) => {
  const accountId = parseInt(req.params.accountId);
  
  // Verify account belongs to user
  const account = await TradingAccount.findByUserIdAndAccountId(req.user.id, accountId);
  if (!account) {
    throw new AppError('Trading account not found', 404);
  }

  // Get fund statistics (deposits, withdrawals, P&L)
  const fundStats = await FundManager.getAccountStatistics(accountId);
  
  // Get position metrics
  const openPositionsCount = await account.getOpenPositionsCount();
  const unrealizedPnL = await account.getUnrealizedPnL();
  
  // Calculate current equity and margin metrics
  const equity = account.balance + unrealizedPnL;
  const usedMargin = await account.getUsedMargin();
  const freeMargin = Math.max(equity - usedMargin, 0);
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 0;
  
  res.json({
    success: true,
    data: {
      accountId: accountId,
      accountNumber: account.accountNumber,
      
      // Current balances
      balance: account.balance,
      equity: equity,
      usedMargin: usedMargin,
      freeMargin: freeMargin,
      marginLevel: marginLevel,
      
      // Position metrics
      openPositions: openPositionsCount,
      unrealizedPnL: unrealizedPnL,
      availableForTrading: equity,
      
      // Fund statistics from history
      currentBalance: account.balance,
      totalDeposits: fundStats.totalDeposits,
      totalWithdrawals: fundStats.totalWithdrawals,
      netDeposits: fundStats.netDeposits,
      totalProfit: fundStats.totalProfit,
      totalLoss: fundStats.totalLoss,
      tradingPnL: fundStats.tradingPnL,
      totalReturn: fundStats.totalReturn,
      profitFactor: fundStats.profitFactor
    }
  });
}));

/**
 * Get balance history
 * GET /funds/account/:accountId/history
 */
router.get('/account/:accountId/history', asyncHandler(async (req, res) => {
  const accountId = parseInt(req.params.accountId);
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  
  // Verify account belongs to user
  const account = await TradingAccount.findByUserIdAndAccountId(req.user.id, accountId);
  if (!account) {
    throw new AppError('Trading account not found', 404);
  }

  // Get balance history
  const history = await FundManager.getBalanceHistory(accountId, limit, offset);
  
  // Get total count for pagination
  const [countResult] = await executeQuery(
    'SELECT COUNT(*) as total FROM account_balance_history WHERE account_id = ?',
    [accountId]
  );
  
  const totalRecords = countResult.total;
  const totalPages = Math.ceil(totalRecords / limit);

  res.json({
    success: true,
    data: {
      history,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  });
}));

/**
 * Get account performance metrics
 * GET /funds/account/:accountId/performance
 */
router.get('/account/:accountId/performance', asyncHandler(async (req, res) => {
  const accountId = parseInt(req.params.accountId);
  
  // Verify account belongs to user
  const account = await TradingAccount.findByUserIdAndAccountId(req.user.id, accountId);
  if (!account) {
    throw new AppError('Trading account not found', 404);
  }

  // Get fund statistics
  const fundStats = await FundManager.getAccountStatistics(accountId);
  
  // Get trading metrics from trade_history
  const [tradeMetrics] = await executeQuery(`
    SELECT 
      COUNT(*) as total_trades,
      COUNT(CASE WHEN profit > 0 THEN 1 END) as winning_trades,
      COUNT(CASE WHEN profit < 0 THEN 1 END) as losing_trades,
      COALESCE(AVG(CASE WHEN profit > 0 THEN profit END), 0) as avg_win,
      COALESCE(AVG(CASE WHEN profit < 0 THEN ABS(profit) END), 0) as avg_loss,
      COALESCE(MAX(profit), 0) as best_trade,
      COALESCE(MIN(profit), 0) as worst_trade
    FROM trade_history
    WHERE account_id = ?
  `, [accountId]);

  const totalTrades = parseInt(tradeMetrics.total_trades) || 0;
  const winningTrades = parseInt(tradeMetrics.winning_trades) || 0;
  const losingTrades = parseInt(tradeMetrics.losing_trades) || 0;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const avgWin = parseFloat(tradeMetrics.avg_win) || 0;
  const avgLoss = parseFloat(tradeMetrics.avg_loss) || 0;
  const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

  res.json({
    success: true,
    data: {
      ...fundStats,
      tradingMetrics: {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate: Math.round(winRate * 100) / 100,
        averageWin: Math.round(avgWin * 100) / 100,
        averageLoss: Math.round(avgLoss * 100) / 100,
        bestTrade: Math.round(parseFloat(tradeMetrics.best_trade) * 100) / 100,
        worstTrade: Math.round(parseFloat(tradeMetrics.worst_trade) * 100) / 100,
        riskRewardRatio: Math.round(riskRewardRatio * 100) / 100
      }
    }
  });
}));

// ============================================================================
// DASHBOARD PERFORMANCE
// ============================================================================

/**
 * Get dashboard performance statistics
 * GET /funds/dashboard/performance/:accountId
 */
router.get('/dashboard/performance/:accountId', asyncHandler(async (req, res) => {
  const accountId = parseInt(req.params.accountId);
  
  console.log(`Dashboard performance requested for account ${accountId}`);
  
  // Verify account belongs to user
  const account = await TradingAccount.findByUserIdAndAccountId(req.user.id, accountId);
  if (!account) {
    console.log(`Account ${accountId} not found for user ${req.user.id}`);
    throw new AppError('Trading account not found', 404);
  }

  console.log(`Account found: ${account.accountNumber}`);
  console.log(`Account usedMargin: ${account.usedMargin}`);
  console.log(`Account freeMargin: ${account.freeMargin}`);
  console.log(`Account marginLevel: ${account.marginLevel}`);

  // Get realized P&L from trade history
  const [totalPnLResult] = await executeQuery(`
    SELECT 
      COALESCE(SUM(profit), 0) as total_pnl,
      COUNT(*) as total_trades,
      COUNT(CASE WHEN profit > 0 THEN 1 END) as winning_trades
    FROM trade_history 
    WHERE account_id = ?
  `, [accountId]);

  // Get today's P&L (realized + unrealized from positions opened today)
  const [todayRealizedResult] = await executeQuery(`
    SELECT COALESCE(SUM(profit), 0) as today_realized_pnl
    FROM trade_history 
    WHERE account_id = ? AND DATE(closed_at) = CURDATE()
  `, [accountId]);

  // Get unrealized P&L from positions opened today
  const [todayUnrealizedResult] = await executeQuery(`
    SELECT COALESCE(SUM(profit), 0) as today_unrealized_pnl
    FROM positions 
    WHERE account_id = ? AND status = 'open' AND DATE(opened_at) = CURDATE()
  `, [accountId]);

  // Get unrealized P&L from all open positions
  const [unrealizedResult] = await executeQuery(`
    SELECT 
      COALESCE(SUM(profit), 0) as unrealized_pnl,
      COUNT(*) as open_positions
    FROM positions 
    WHERE account_id = ? AND status = 'open'
  `, [accountId]);

  const totalPnL = parseFloat(totalPnLResult.total_pnl || 0);
  const todayRealizedPnL = parseFloat(todayRealizedResult.today_realized_pnl || 0);
  const todayUnrealizedPnL = parseFloat(todayUnrealizedResult.today_unrealized_pnl || 0);
  const todayPnL = todayRealizedPnL + todayUnrealizedPnL;
  const unrealizedPnL = parseFloat(unrealizedResult.unrealized_pnl || 0);
  const totalTrades = parseInt(totalPnLResult.total_trades || 0);
  const winningTrades = parseInt(totalPnLResult.winning_trades || 0);
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  // Calculate equity
  const equity = account.balance + unrealizedPnL;

  const responseData = {
    // Performance metrics
    totalPnL: totalPnL + unrealizedPnL, // Total = realized + unrealized
    realizedPnL: totalPnL,
    todayPnL,
    todayRealizedPnL,
    todayUnrealizedPnL,
    unrealizedPnL,
    winRate,
    totalTrades,
    
    // Account metrics
    balance: account.balance,
    equity: equity,
    usedMargin: usedMargin,
    freeMargin: freeMargin,
    marginLevel: marginLevel,
    openPositions: parseInt(unrealizedResult.open_positions || 0)
  };

  console.log(`Sending dashboard response:`, responseData);
  console.log(`  usedMargin: ${responseData.usedMargin}`);
  console.log(`  freeMargin: ${responseData.freeMargin}`);

  res.json({
    success: true,
    data: responseData
  });
}));

// ============================================================================
// DEPOSIT & WITHDRAWAL
// ============================================================================

/**
 * Process deposit
 * POST /funds/deposit
 */
router.post('/deposit', asyncHandler(async (req, res) => {
  const { error, value } = depositSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { accountId, amount, method, transactionId } = value;
  
  // Verify account belongs to user
  const account = await TradingAccount.findByUserIdAndAccountId(req.user.id, accountId);
  if (!account) {
    throw new AppError('Trading account not found', 404);
  }

  // Generate transaction ID if not provided
  const txId = transactionId || `DEP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Process deposit
  const result = await FundManager.processDeposit(accountId, amount, method, txId, {
    performedByType: 'user',
    performedById: req.user.id,
    metadata: { source: 'user_funds_deposit' }
  });

  // Broadcast balance update via WebSocket
  if (global.broadcast) {
    global.broadcast({
      type: 'balance_update',
      userId: req.user.id,
      accountId: accountId,
      data: {
        previousBalance: result.previousBalance,
        newBalance: result.newBalance,
        change: amount,
        changeType: 'deposit',
        reason: 'deposit',
        method: method,
        transactionId: txId,
        performedByType: 'user',
        performedById: req.user.id,
        timestamp: new Date().toISOString()
      }
    });
  }

  res.status(201).json({
    success: true,
    message: `Deposit of $${amount.toFixed(2)} processed successfully`,
    data: {
      transactionId: txId,
      ...result
    }
  });
}));

/**
 * Process withdrawal
 * POST /funds/withdrawal
 */
router.post('/withdrawal', asyncHandler(async (req, res) => {
  const { error, value } = withdrawalSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { accountId, amount, method, bankAccount, cryptoAddress, notes } = value;
  
  // Verify account belongs to user
  const account = await TradingAccount.findByUserIdAndAccountId(req.user.id, accountId);
  if (!account) {
    throw new AppError('Trading account not found', 404);
  }

  // Additional validation for withdrawal methods
  if (method === 'bank_transfer' && !bankAccount) {
    throw new AppError('Bank account details required for bank transfer', 400);
  }
  
  if (method === 'crypto' && !cryptoAddress) {
    throw new AppError('Crypto wallet address required for crypto withdrawal', 400);
  }

  // Generate transaction ID
  const txId = `WTH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Process withdrawal
    const result = await FundManager.processWithdrawal(accountId, amount, method, txId, {
      performedByType: 'user',
      performedById: req.user.id,
      metadata: { source: 'user_funds_withdrawal', notes }
    });

    // Broadcast balance update via WebSocket
    if (global.broadcast) {
      global.broadcast({
        type: 'balance_update',
        userId: req.user.id,
        accountId: accountId,
        data: {
          previousBalance: result.previousBalance,
          newBalance: result.newBalance,
          change: -amount,
          changeType: 'withdrawal',
          reason: 'withdrawal',
          method: method,
          transactionId: txId,
          performedByType: 'user',
          performedById: req.user.id,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(201).json({
      success: true,
      message: `Withdrawal of $${amount.toFixed(2)} processed successfully`,
      data: {
        transactionId: txId,
        processingTime: '1-3 business days',
        ...result
      }
    });
  } catch (error) {
    if (error.message === 'Insufficient funds for withdrawal') {
      throw new AppError(`Insufficient funds. Available balance: $${account.balance.toFixed(2)}`, 400);
    }
    throw error;
  }
}));

// ============================================================================
// FUNDING METHODS
// ============================================================================

/**
 * Get funding methods and limits
 * GET /funds/methods
 */
router.get('/methods', asyncHandler(async (req, res) => {
  const gateways = await executeQuery(`
    SELECT 
      id,
      name,
      display_name,
      type,
      provider,
      min_amount,
      max_amount,
      processing_fee_type,
      processing_fee_value,
      processing_time_hours,
      supported_currencies,
      description,
      icon_url,
      configuration
    FROM payment_gateways
    WHERE is_active = 1
    ORDER BY sort_order ASC, display_name ASC
  `);

  const bankAccounts = await executeQuery(`
    SELECT 
      ba.id,
      ba.label,
      ba.bank_name,
      ba.account_name,
      ba.account_number,
      ba.account_type,
      ba.iban,
      ba.swift_code,
      ba.routing_number,
      ba.branch_name,
      ba.branch_address,
      ba.country,
      ba.currency,
      ba.instructions,
      ba.current_balance,
      ba.metadata,
      pg.display_name as gateway_display_name,
      pg.type as gateway_type
    FROM bank_accounts ba
    LEFT JOIN payment_gateways pg ON ba.payment_gateway_id = pg.id
    WHERE ba.is_active = 1
    ORDER BY ba.sort_order ASC, ba.bank_name ASC
  `);

  const formatFee = (type, value) => {
    if (type === 'percentage') {
      return `${parseFloat(value).toFixed(2)}%`;
    }
    return `$${parseFloat(value).toFixed(2)}`;
  };

  const fundingMethods = gateways.map((gateway) => {
    const supportedCurrencies = gateway.supported_currencies ? JSON.parse(gateway.supported_currencies) : [];
    const configuration = gateway.configuration ? JSON.parse(gateway.configuration) : {};

    return {
      id: gateway.id,
      type: gateway.type,
      name: gateway.display_name,
      provider: gateway.provider,
      depositLimits: {
        min: parseFloat(gateway.min_amount),
        max: parseFloat(gateway.max_amount)
      },
      withdrawalLimits: {
        min: parseFloat(gateway.min_amount),
        max: parseFloat(gateway.max_amount)
      },
      processingTime: gateway.processing_time_hours ? `${gateway.processing_time_hours} hours` : 'Instant',
      processingTimeHours: gateway.processing_time_hours,
      fees: {
        deposit: formatFee(gateway.processing_fee_type, gateway.processing_fee_value),
        withdrawal: formatFee(gateway.processing_fee_type, gateway.processing_fee_value)
      },
      supportedCurrencies,
      configuration,
      description: gateway.description,
      iconUrl: gateway.icon_url,
      available: true
    };
  });

  const formattedBanks = bankAccounts.map((bank) => ({
    id: bank.id,
    label: bank.label,
    bankName: bank.bank_name,
    accountName: bank.account_name,
    accountNumber: bank.account_number,
    accountType: bank.account_type,
    iban: bank.iban,
    swiftCode: bank.swift_code,
    routingNumber: bank.routing_number,
    branchName: bank.branch_name,
    branchAddress: bank.branch_address,
    country: bank.country,
    currency: bank.currency,
    instructions: bank.instructions,
    currentBalance: bank.current_balance,
    metadata: bank.metadata ? JSON.parse(bank.metadata) : {},
    gatewayDisplayName: bank.gateway_display_name,
    gatewayType: bank.gateway_type
  }));

  res.json({
    success: true,
    data: {
      methods: fundingMethods,
      bankAccounts: formattedBanks
    }
  });
}));

module.exports = router;
