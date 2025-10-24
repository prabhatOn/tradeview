/* eslint-disable import/no-commonjs */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
const express = require('express');
const Joi = require('joi');
const { executeQuery, executeTransaction } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const Position = require('../models/Position');
const TradingAccount = require('../models/TradingAccount');
const TradeHistory = require('../models/TradeHistory');
const FundManager = require('../services/FundManager');
const PositionUpdateService = require('../services/PositionUpdateService');

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
  ,
  orderType: Joi.string().valid('market','limit').optional(),
  triggerPrice: Joi.alternatives().try(Joi.number().positive(), Joi.allow(null)).optional()
});

const closePositionSchema = Joi.object({
  closeReason: Joi.string().valid('manual', 'stop_loss', 'take_profit').default('manual')
});

const updatePositionSchema = Joi.object({
  stopLoss: Joi.alternatives().try(
    Joi.number().positive(),
    Joi.allow(null)
  ).optional(),
  takeProfit: Joi.alternatives().try(
    Joi.number().positive(),
    Joi.allow(null)
  ).optional()
});

// Get user's trading accounts
router.get('/accounts', asyncHandler(async (req, res) => {
  const accounts = await TradingAccount.findByUserId(req.user.id);
  
  // Return accounts with basic metrics
  const accountsWithMetrics = await Promise.all(
    accounts.map(async (account) => {
      // Get simple metrics
      const openPositionsCount = await account.getOpenPositionsCount();
      const unrealizedPnL = await account.getUnrealizedPnL();
      const equity = account.balance + unrealizedPnL;
      const usedMargin = await account.getUsedMargin();
      
      return {
        id: account.id,
        userId: account.userId,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        currency: account.currency,
        leverage: account.leverage,
        status: account.status,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        
        // Financial metrics
        balance: account.balance,
        equity: equity,
        usedMargin: usedMargin,
        freeMargin: Math.max(equity - usedMargin, 0),
        marginLevel: usedMargin > 0 ? (equity / usedMargin) * 100 : 0,
        
        // Position info
        openPositions: openPositionsCount,
        totalPositions: openPositionsCount,
        
        // P&L
        todayPnl: 0, // Will be calculated from trade_history if needed
        totalPnl: unrealizedPnL
      };
    })
  );

  res.json({
    success: true,
    data: accountsWithMetrics
  });
}));

// Get specific trading account details
router.get('/accounts/:accountId', asyncHandler(async (req, res) => {
  const accountId = parseInt(req.params.accountId);
  
  const account = await TradingAccount.findByIdAndUserId(accountId, req.user.id);
  if (!account) {
    throw new AppError('Trading account not found', 404);
  }

  // Get simple metrics
  const openPositionsCount = await account.getOpenPositionsCount();
  const unrealizedPnL = await account.getUnrealizedPnL();
  const equity = account.balance + unrealizedPnL;
  
  // Get used margin from the account
  const usedMargin = await account.getUsedMargin();
  
  // Flatten the structure to match AccountSummary interface
  const accountSummary = {
    // Account basic info
    id: account.id,
    accountNumber: account.accountNumber,
    accountType: account.accountType,
    currency: account.currency,
    leverage: account.leverage,
    status: account.status,
    
  // Financial metrics
  balance: account.balance,
  equity: equity,
  margin: usedMargin, // legacy alias used by some frontend components
  usedMargin: usedMargin,
  freeMargin: Math.max(equity - usedMargin, 0),
  marginLevel: usedMargin > 0 ? (equity / usedMargin) * 100 : 0,
    
    // Position info
    totalPositions: openPositionsCount,
    openPositions: openPositionsCount,
    
    // P&L
    todayPnl: 0, // Will be calculated from trade_history if needed
    totalPnl: unrealizedPnL
  };
  
  res.json({
    success: true,
    data: accountSummary
  });
}));

// Get user's open positions
router.get('/positions', asyncHandler(async (req, res) => {
  const accountId = req.query.accountId;
  const status = req.query.status; // 'open', 'closed', or 'all'
  
  const positions = await Position.findByUserId(req.user.id, accountId);
  
  // Filter by status if specified
  let filteredPositions = positions;
  if (status && status !== 'all') {
    filteredPositions = positions.filter(pos => pos.status === status);
  }
  
  // Add cache control headers to prevent caching issues
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  res.json({ 
    success: true,
    data: filteredPositions.map(pos => pos.toJSON())
  });
}));

// Get enhanced position summary with real-time updates
router.get('/positions/:accountId/summary', asyncHandler(async (req, res) => {
  const accountId = parseInt(req.params.accountId);
  
  // Verify account belongs to user
  const tradingAccount = await TradingAccount.findByIdAndUserId(accountId, req.user.id);
  if (!tradingAccount) {
    throw new AppError('Trading account not found', 404);
  }

  try {
    const summary = await PositionUpdateService.getAccountPositionSummary(accountId);
    
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      data: summary.positions,
      statistics: summary.statistics,
      meta: {
        accountId: accountId,
        lastUpdated: summary.lastUpdated,
        dataCount: summary.positions.length
      }
    });
    
  } catch (error) {
    console.error('Error getting position summary:', error);
    throw new AppError('Failed to get position summary', 500);
  }
}));

// Get positions for specific account with enhanced data
router.get('/positions/:accountId', asyncHandler(async (req, res) => {
  const accountId = parseInt(req.params.accountId);
  
  // Verify account belongs to user
  const tradingAccount = await TradingAccount.findByIdAndUserId(accountId, req.user.id);
  if (!tradingAccount) {
    throw new AppError('Trading account not found', 404);
  }

  // Get positions with enhanced information including current prices and symbols
  const query = `
    SELECT 
      p.id,
      p.symbol_id,
      s.symbol,
      s.name as symbol_name,
      p.side,
      p.lot_size,
      p.open_price,
      p.stop_loss,
      p.take_profit,
      p.commission,
      p.swap,
      p.profit,
      p.status,
      p.opened_at,
      p.updated_at,
      mp.bid,
      mp.ask,
      s.pip_size,
      s.contract_size
    FROM positions p
    JOIN symbols s ON p.symbol_id = s.id
    LEFT JOIN market_prices mp ON s.id = mp.symbol_id
    WHERE p.account_id = ? AND p.status IN ('open', 'closed')
    ORDER BY p.opened_at DESC
  `;

  const positionsData = await executeQuery(query, [accountId]);

  // Transform positions data to include calculated P&L with proper field mapping
  const enhancedPositions = positionsData.map(pos => {
    const currentPrice = pos.side === 'buy' ? pos.bid : pos.ask;
    
    // Calculate P&L for open positions or use stored profit
    let profit = 0;
    if (pos.status === 'open' && currentPrice) {
      const symbolInfo = {
        pip_size: pos.pip_size,
        contract_size: pos.contract_size
      };
      
      profit = FundManager.calculatePositionPnL(
        {
          open_price: pos.open_price,
          lot_size: pos.lot_size,
          side: pos.side
        },
        currentPrice,
        symbolInfo
      );
    } else {
      // For closed positions, profit is already stored
      profit = pos.profit || 0;
    }

    // Calculate net profit
    const netProfit = FundManager.calculateNetPositionPnL(
      {
        open_price: pos.open_price,
        lot_size: pos.lot_size,
        side: pos.side,
        commission: pos.commission || 0,
        swap: pos.swap || 0
      },
      currentPrice,
      { contract_size: pos.contract_size, pip_size: pos.pip_size }
    );

    // Return data with both backend and frontend field names for compatibility
    return {
      id: pos.id,
      symbol: pos.symbol,
      symbolName: pos.symbol_name,
      side: pos.side,
      
      // Backend field names
      lotSize: pos.lot_size,
      openPrice: pos.open_price,
      currentPrice: currentPrice,
      stopLoss: pos.stop_loss,
      takeProfit: pos.take_profit,
      profit: profit,
      
      // Frontend compatible field names
      volume: pos.lot_size,
      unrealizedPnl: profit,
      profitLoss: profit,
      openTime: pos.opened_at,
      
      commission: pos.commission || 0,
      swap: pos.swap || 0,
      status: pos.status,
      openedAt: pos.opened_at,
      updatedAt: pos.updated_at,
      closedAt: pos.closed_at,
      closeTime: pos.closed_at,
      
      // Additional calculated fields
      netProfit: netProfit,
      grossProfit: profit > 0 ? profit : 0,
      grossLoss: profit < 0 ? Math.abs(profit) : 0
    };
  });

  // Use FundManager to calculate comprehensive statistics
  const statistics = FundManager.calculatePositionStatistics(accountId, enhancedPositions);

  // Add cache control headers to prevent caching issues
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  res.json({
    success: true,
    data: enhancedPositions,
    statistics: statistics,
    meta: {
      accountId: accountId,
      timestamp: new Date().toISOString(),
      dataCount: enhancedPositions.length
    }
  });
}));

// Get specific position details
router.get('/positions/:positionId', asyncHandler(async (req, res) => {
  const positionId = parseInt(req.params.positionId);
  
  const position = await Position.findByIdAndUserId(positionId, req.user.id);
  if (!position) {
    throw new AppError('Position not found', 404);
  }

  res.json({
    success: true,
    data: position.toJSON()
  });
}));

// Open new position
router.post('/positions', asyncHandler(async (req, res) => {
  console.log('Opening new position:', req.body);
  
  // Preprocess body to handle empty strings
  const preprocessedBody = {
    ...req.body,
    stopLoss: req.body.stopLoss === '' ? null : req.body.stopLoss,
    takeProfit: req.body.takeProfit === '' ? null : req.body.takeProfit,
    comment: req.body.comment === '' ? null : req.body.comment
  };
  
  const { error, value } = openPositionSchema.validate(preprocessedBody);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  // Accept optional orderType and triggerPrice for limit orders
  const { accountId, symbolId, side, lotSize, stopLoss, takeProfit, comment, orderType, triggerPrice } = value;

  // Verify account belongs to user
  const tradingAccount = await TradingAccount.findByIdAndUserId(accountId, req.user.id);
  if (!tradingAccount) {
    throw new AppError('Trading account not found', 404);
  }

  if (tradingAccount.status !== 'active') {
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

  // Calculate required margin using ACCOUNT LEVERAGE (not symbol margin_requirement)
  const contractSize = parseFloat(symbol.contract_size);
  const accountLeverage = parseFloat(tradingAccount.leverage) || 100; // Get leverage from account
  const requiredMargin = (lotSize * contractSize * openPrice) / accountLeverage;

  console.log('Margin calculation debug:', {
    symbol: symbol.symbol,
    lotSize,
    contractSize,
    openPrice,
    accountLeverage,
    requiredMargin,
    accountBalance: tradingAccount.balance,
    accountFreeMargin: tradingAccount.freeMargin
  });

  // Check if user has sufficient free margin
  const hasSufficientMargin = await tradingAccount.hasSufficientMargin(requiredMargin);
  
  console.log('Margin check result:', {
    hasSufficientMargin,
    requiredMargin,
    accountFreeMarginAfterUpdate: tradingAccount.freeMargin
  });
  
  if (!hasSufficientMargin) {
    throw new AppError(`Insufficient margin to open position. Required: $${requiredMargin.toFixed(2)}, Available: $${tradingAccount.freeMargin.toFixed(2)}`, 400);
  }

  // If this is a limit order, create a pending position with trigger_price
  let position = null;
  let createdOrderId = null;
  // If orderType is limit but no triggerPrice provided, reject the request
  if (orderType === 'limit' && (triggerPrice === undefined || triggerPrice === null)) {
    throw new AppError('triggerPrice is required for limit orders', 400);
  }

  // Normalize order type: if user selected 'limit' but the trigger is on the other side
  // of the current market price, treat it as a 'stop' order instead. This prevents
  // immediate fills when a user accidentally uses 'limit' with a trigger above/below
  // the market (common UX confusion).
  let normalizedOrderType = orderType;
  if (orderType === 'limit' && triggerPrice !== undefined && triggerPrice !== null) {
    // For buys: a triggerPrice > openPrice is a 'stop' (buy stop). For sells: triggerPrice < openPrice is a 'stop' (sell stop).
    if ((side === 'buy' && triggerPrice > openPrice) || (side === 'sell' && triggerPrice < openPrice)) {
      normalizedOrderType = 'stop';
    } else {
      normalizedOrderType = 'limit';
    }
  }

  if (normalizedOrderType === 'limit' && triggerPrice !== undefined && triggerPrice !== null ||
      normalizedOrderType === 'stop' && triggerPrice !== undefined && triggerPrice !== null) {
    // Create an order record first, then create the pending position referencing that order.
    // Use a transaction so both inserts succeed or both rollback.
    try {
  const result = await executeTransaction(async (connection) => {
        // Insert order
        const [orderInsert] = await connection.execute(
          `INSERT INTO orders (
            account_id, symbol_id, order_type, side, lot_size, price, stop_loss, take_profit, status, commission, swap, comment, magic_number
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, ?, NULL)`,
          [tradingAccount.id, symbolId, normalizedOrderType, side, lotSize, triggerPrice, stopLoss || null, takeProfit || null, comment]
        );

        const orderId = orderInsert.insertId;

        // Insert pending position referencing the newly created order
        const [posInsert] = await connection.execute(
          `INSERT INTO positions (
            account_id, symbol_id, order_id, side, lot_size, open_price, stop_loss, take_profit, commission, comment, order_type, trigger_price, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [tradingAccount.id, symbolId, orderId, side, lotSize, openPrice, stopLoss || null, takeProfit || null, 0, comment, normalizedOrderType, triggerPrice]
        );

        return { orderId, positionId: posInsert.insertId };
      });

      // capture order id for response
      createdOrderId = result.orderId;

      const created = await executeQuery(
        `SELECT p.*, s.contract_size, s.pip_size, ta.account_number, s.symbol FROM positions p JOIN symbols s ON p.symbol_id = s.id JOIN trading_accounts ta ON p.account_id = ta.id WHERE p.id = ?`,
        [result.positionId]
      );

      position = created.length ? new Position(created[0]) : null;
    } catch (err) {
      console.error('Failed to create pending limit order and position in transaction:', err);
      throw err;
    }
  } else {
    // Create immediate market position
    try {
      position = await Position.create({
        accountId,
        symbolId,
        side,
        lotSize,
        openPrice,
        stopLoss,
        takeProfit,
        comment
      });
    } catch (err) {
      // Log detailed SQL error info to help diagnose foreign-key / constraint failures
      console.error('Error while creating position (SQL/DB error):', {
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      // Re-throw so errorHandler formats and returns a proper response
      throw err;
    }
  }

  if (!position) {
    throw new AppError('Failed to create position', 500);
  }

  console.log('Position created successfully:', {
    id: position.id,
    symbol: position.symbol,
    side: position.side,
    lotSize: position.lotSize
  });

  res.status(201).json({
    success: true,
    message: 'Position opened successfully',
    data: position.toJSON(),
    meta: createdOrderId ? { orderId: createdOrderId } : undefined
  });
}));

// Update position (modify stop loss or take profit)
router.patch('/positions/:positionId', asyncHandler(async (req, res) => {
  const positionId = parseInt(req.params.positionId);
  
  const { error, value } = updatePositionSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const position = await Position.findByIdAndUserId(positionId, req.user.id, 'open');
  if (!position) {
    throw new AppError('Position not found or already closed', 404);
  }

  const { stopLoss, takeProfit } = value;

  // Update stop loss if provided
  if (stopLoss !== undefined) {
    await position.updateStopLoss(stopLoss);
  }

  // Update take profit if provided
  if (takeProfit !== undefined) {
    await position.updateTakeProfit(takeProfit);
  }

  res.json({
    success: true,
    message: 'Position updated successfully',
    data: position.toJSON()
  });
}));

// Close position
router.delete('/positions/:positionId', asyncHandler(async (req, res) => {
  const positionId = parseInt(req.params.positionId);
  
  console.log(`🔄 Attempting to close position ${positionId} for user ${req.user.id}`);
  
  const { error, value } = closePositionSchema.validate(req.body);
  if (error) {
    console.error('❌ Close position validation error:', error.details[0].message);
    throw new AppError(error.details[0].message, 400);
  }

  const position = await Position.findByIdAndUserId(positionId, req.user.id);
  if (!position) {
    console.error(`❌ Position ${positionId} not found for user ${req.user.id}`);
    throw new AppError('Position not found', 404);
  }

  console.log(`📊 Found position: ${position.id}, Status: ${position.status}, Symbol: ${position.symbol}`);

  // Check if position is already closed
  if (position.status === 'closed') {
    console.log(`⚠️ Position ${positionId} is already closed`);
    throw new AppError('Position is already closed', 400);
  }

  // Check if position is open and can be closed
  if (position.status !== 'open') {
    console.log(`⚠️ Position ${positionId} status is '${position.status}', cannot be closed`);
    throw new AppError('Position cannot be closed in its current state', 400);
  }

  // Get current market price for closing
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

  // Get symbol information for P&L calculation
  const symbols = await executeQuery(
    'SELECT symbol, pip_size, contract_size FROM symbols WHERE id = ?',
    [position.symbolId]
  );

  if (!symbols.length) {
    throw new AppError('Symbol information not found', 400);
  }

  const symbolInfo = symbols[0];
  const currentPrice = prices[0];
  const closePrice = position.side === 'buy' ? currentPrice.bid : currentPrice.ask;

  const closeReason = value.closeReason || 'manual';

  // Capture balance before closing for notifications
  const [accountSnapshot] = await executeQuery(
    'SELECT balance FROM trading_accounts WHERE id = ?',
    [position.accountId]
  );
  const previousBalance = accountSnapshot ? parseFloat(accountSnapshot.balance) : null;

  const closeSummary = await position.close(closePrice, closeReason);

  const finalProfit = closeSummary.finalProfit;
  const netProfit = finalProfit - (position.commission || 0) - (position.swap || 0);
  const pips = Math.abs((closePrice - position.openPrice) / symbolInfo.pip_size);
  const pipValue = position.lotSize * symbolInfo.contract_size * symbolInfo.pip_size;

  console.log(`✅ Position ${positionId} closed successfully. P&L: $${finalProfit.toFixed(2)}`);

  // Broadcast balance update via WebSocket
  if (global.broadcast) {
    const updatedAccountData = await executeQuery(
      'SELECT balance, equity, free_margin FROM trading_accounts WHERE id = ?',
      [position.accountId]
    );
    
    if (updatedAccountData.length > 0) {
      global.broadcast({
        type: 'balance_update',
        userId: req.user.id,
        accountId: position.accountId,
        data: {
          previousBalance: previousBalance,
          newBalance: updatedAccountData[0].balance,
          change: finalProfit,
          changeType: finalProfit >= 0 ? 'profit' : 'loss',
          reason: 'position_close',
          positionId: positionId,
          symbol: position.symbol,
          side: position.side,
          lotSize: position.lotSize,
          profit: finalProfit,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  res.json({
    success: true,
    message: `Position closed successfully. ${finalProfit >= 0 ? 'Profit' : 'Loss'}: $${Math.abs(finalProfit).toFixed(2)}`,
    data: {
      positionId,
      symbol: position.symbol,
      side: position.side,
      lotSize: position.lotSize,
      openPrice: position.openPrice,
      closePrice,
      finalProfit,
      netProfit,
      pips,
      pipValue,
      closeReason,
      tradeHistoryId: closeSummary.tradeHistoryId,
      ibCommission: closeSummary.ibCommission
    }
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
      hasMore: tradeHistory.length === limit
    }
  });
}));

// Get trading performance statistics
router.get('/performance', asyncHandler(async (req, res) => {
  const accountId = req.query.accountId;
  const period = req.query.period || '30 DAYS'; // 7 DAYS, 30 DAYS, 90 DAYS, 1 YEAR
  
  if (!accountId) {
    throw new AppError('Account ID is required', 400);
  }

  // Verify account belongs to user
  const account = await TradingAccount.findByIdAndUserId(accountId, req.user.id);
  if (!account) {
    throw new AppError('Trading account not found', 404);
  }

  // Get statistics
  const stats = await TradeHistory.getStatistics(accountId, period);
  
  // Get daily P&L data
  const days = period === '7 DAYS' ? 7 : period === '30 DAYS' ? 30 : period === '90 DAYS' ? 90 : 365;
  const dailyPnL = await TradeHistory.getDailyPnL(accountId, days);

  res.json({
    success: true,
    data: {
      statistics: stats,
      dailyPnL,
      period
    }
  });
}));

// Update position prices (called by market data service)
router.post('/positions/update-prices', asyncHandler(async (req, res) => {
  const { symbolId, bid, ask } = req.body;
  
  if (!symbolId || !bid || !ask) {
    throw new AppError('Symbol ID, bid, and ask prices are required', 400);
  }

  // Get all open positions for this symbol
  const positions = await executeQuery(
    `SELECT p.*, ta.user_id FROM positions p
     JOIN trading_accounts ta ON p.account_id = ta.id
     WHERE p.symbol_id = ? AND p.status = 'open'`,
    [symbolId]
  );

  const updatePromises = positions.map(async (positionData) => {
    const position = new Position(positionData);
    const currentPrice = position.side === 'buy' ? bid : ask;
    
    // Update position price and profit
    await position.updatePrice(currentPrice);
    
    // Check if position should be auto-closed due to stop loss or take profit
    const closeReason = position.shouldAutoClose(currentPrice);
    if (closeReason) {
      const closePrice = position.side === 'buy' ? bid : ask;
      await position.close(closePrice, closeReason);
    }
  });

  await Promise.all(updatePromises);

  res.json({
    success: true,
    message: `Updated ${positions.length} positions for symbol ${symbolId}`
  });
}));

// Get trade history for account
router.get('/accounts/:accountId/history', asyncHandler(async (req, res) => {
  const { accountId } = req.params;
  const { page = 1, limit = 50, type, symbol } = req.query;

  // Verify account belongs to user
  const account = await TradingAccount.findById(accountId);
  if (!account || account.userId !== req.user.id) {
    throw new AppError('Trading account not found', 404);
  }

  const history = await TradeHistory.getByAccountId(parseInt(accountId), {
    page: parseInt(page),
    limit: parseInt(limit),
    type,
    symbol
  });

  res.json({
    success: true,
    data: history
  });
}));

// Get all trading activities for account
router.get('/accounts/:accountId/activities', asyncHandler(async (req, res) => {
  const { accountId } = req.params;
  const { page = 1, limit = 100 } = req.query;

  // Verify account belongs to user
  const account = await TradingAccount.findById(accountId);
  if (!account || account.userId !== req.user.id) {
    throw new AppError('Trading account not found', 404);
  }

  const activities = await TradeHistory.getAllActivities(parseInt(accountId), {
    page: parseInt(page),
    limit: parseInt(limit)
  });

  res.json({
    success: true,
    data: activities
  });
}));

// Get trading statistics for account
router.get('/accounts/:accountId/stats', asyncHandler(async (req, res) => {
  const { accountId } = req.params;

  // Verify account belongs to user
  const account = await TradingAccount.findById(accountId);
  if (!account || account.userId !== req.user.id) {
    throw new AppError('Trading account not found', 404);
  }

  const stats = await TradeHistory.getStatistics(parseInt(accountId));

  res.json({
    success: true,
    data: stats
  });
}));

// Manual position update trigger (for testing/admin)
router.post('/positions/update-all', asyncHandler(async (req, res) => {
  try {
    const result = await PositionUpdateService.updateAllOpenPositions();
    
    res.json({
      success: true,
      message: 'Position updates completed',
      data: result
    });
  } catch (error) {
    console.error('Error updating positions:', error);
    throw new AppError('Failed to update positions', 500);
  }
}));

// ===== PHASE 4: NEW ENHANCED TRADING ROUTES =====

// Get margin information for account
router.get('/accounts/:accountId/margin-info', asyncHandler(async (req, res) => {
  const { accountId } = req.params;
  const userId = req.user.id;

  const account = await TradingAccount.findByIdAndUserId(parseInt(accountId), userId);
  if (!account) {
    throw new AppError('Trading account not found', 404);
  }

  // Refresh margin metrics
  await account.refreshAccountMetrics();

  res.json({
    success: true,
    data: {
      accountId: account.id,
      balance: Number.isFinite(account.balance) ? parseFloat(account.balance) : parseFloat(account.balance || 0),
      equity: Number.isFinite(account.equity) ? parseFloat(account.equity) : parseFloat(account.equity || 0),
      // use the TradingAccount instance properties (camelCase) populated by refreshAccountMetrics
      marginUsed: parseFloat(account.usedMargin || 0),
      freeMargin: parseFloat(account.freeMargin || 0),
      marginLevel: parseFloat(account.marginLevel || 0),
      // margin call / stop out levels are system-level settings; fallback to sensible defaults
      marginCallLevel: parseFloat(account.marginCallLevel || 50),
      stopOutLevel: parseFloat(account.stopOutLevel || 20),
      tradingPower: (parseFloat(account.balance || 0) * parseFloat(account.leverage || 1)),
      leverage: parseFloat(account.leverage || 1)
    }
  });
}));

// Get available leverage options based on account type
router.get('/leverage-options', asyncHandler(async (req, res) => {
  const { accountType } = req.query;
  const LeverageService = require('../services/LeverageService');

  const type = accountType || 'live';
  const options = LeverageService.getAvailableLeverages(type);

  res.json({
    success: true,
    data: {
      accountType: type,
      leverageOptions: options,
      descriptions: options.map(lev => ({
        leverage: lev,
        marginPercentage: (100 / lev).toFixed(2) + '%',
        description: `1:${lev} leverage requires ${(100 / lev).toFixed(2)}% margin`
      }))
    }
  });
}));

// Update stop loss for position
router.put('/positions/:positionId/stop-loss', asyncHandler(async (req, res) => {
  const { positionId } = req.params;
  let { stopLoss } = req.body;
  const userId = req.user.id;

  console.log('=== STOP LOSS UPDATE DEBUG ===');
  console.log('Position ID:', positionId);
  console.log('Request body:', JSON.stringify(req.body));
  console.log('stopLoss value:', stopLoss);
  console.log('stopLoss type:', typeof stopLoss);
  console.log('User ID:', userId);

  // Extra safety: convert any falsy value except 0 to null
  if (stopLoss === undefined || stopLoss === '' || stopLoss === 'undefined' || stopLoss === null) {
    console.log('Converting to null');
    stopLoss = null;
  }

  // Convert string numbers to actual numbers
  if (typeof stopLoss === 'string' && stopLoss !== null) {
    stopLoss = parseFloat(stopLoss);
    console.log('Converted string to number:', stopLoss);
    if (isNaN(stopLoss)) {
      console.log('NaN detected, setting to null');
      stopLoss = null;
    }
  }

  console.log('Final stopLoss value before SQL:', stopLoss, 'Type:', typeof stopLoss);

  const position = await Position.findById(parseInt(positionId));
  if (!position) {
    throw new AppError('Position not found', 404);
  }

  // Verify ownership
  const account = await TradingAccount.findById(position.accountId);
  if (account.userId !== userId) {
    throw new AppError('Unauthorized', 403);
  }

  // Validate stop loss
  if (stopLoss !== null && stopLoss <= 0) {
    throw new AppError('Invalid stop loss value', 400);
  }

  console.log(`Executing SQL UPDATE with stopLoss:`, stopLoss, 'positionId:', positionId);
  console.log(`SQL params:`, [stopLoss, positionId]);

  const result = await executeQuery(
    'UPDATE positions SET stop_loss = ? WHERE id = ?',
    [stopLoss, positionId]
  );

  console.log('SQL UPDATE result:', result);

  // Verify the update
  const verifyResult = await executeQuery(
    'SELECT id, stop_loss FROM positions WHERE id = ?',
    [positionId]
  );
  console.log('Verification query result:', verifyResult);

  // Fetch and return the updated position object for immediate UI update
  const updatedPosition = await Position.findById(parseInt(positionId));

  res.json({
    success: true,
    message: 'Stop loss updated successfully',
    data: updatedPosition ? updatedPosition.toJSON() : {
      positionId: parseInt(positionId),
      stopLoss: stopLoss
    }
  });
}));

// Update take profit for position
router.put('/positions/:positionId/take-profit', asyncHandler(async (req, res) => {
  const { positionId } = req.params;
  let { takeProfit } = req.body;
  const userId = req.user.id;

  // Extra safety: convert any falsy value except 0 to null
  if (takeProfit === undefined || takeProfit === '' || takeProfit === 'undefined') {
    takeProfit = null;
  }

  // Convert string numbers to actual numbers
  if (typeof takeProfit === 'string' && takeProfit !== null) {
    takeProfit = parseFloat(takeProfit);
    if (isNaN(takeProfit)) {
      takeProfit = null;
    }
  }

  const position = await Position.findById(parseInt(positionId));
  if (!position) {
    throw new AppError('Position not found', 404);
  }

  // Verify ownership
  const account = await TradingAccount.findById(position.accountId);
  if (account.userId !== userId) {
    throw new AppError('Unauthorized', 403);
  }

  // Validate take profit
  if (takeProfit !== null && takeProfit <= 0) {
    throw new AppError('Invalid take profit value', 400);
  }

  console.log(`Updating position ${positionId} take profit to:`, takeProfit);

  await executeQuery(
    'UPDATE positions SET take_profit = ? WHERE id = ?',
    [takeProfit, positionId]
  );

  // Fetch and return the updated position object for immediate UI update
  const updatedPos = await Position.findById(parseInt(positionId));

  res.json({
    success: true,
    message: 'Take profit updated successfully',
    data: updatedPos ? updatedPos.toJSON() : {
      positionId: parseInt(positionId),
      takeProfit: takeProfit
    }
  });
}));

// Cancel pending order
router.delete('/positions/:positionId/cancel', asyncHandler(async (req, res) => {
  const { positionId } = req.params;
  const userId = req.user.id;

  const position = await Position.findById(parseInt(positionId));
  if (!position) {
    throw new AppError('Position not found', 404);
  }

  // Verify ownership
  const account = await TradingAccount.findById(position.accountId);
  if (account.userId !== userId) {
    throw new AppError('Unauthorized', 403);
  }

  // Check if position is pending
  if (position.status !== 'pending') {
    throw new AppError('Only pending orders can be cancelled', 400);
  }

  await executeQuery(
    'UPDATE positions SET status = "cancelled", updated_at = NOW() WHERE id = ?',
    [positionId]
  );

  res.json({
    success: true,
    message: 'Pending order cancelled successfully',
    data: {
      positionId: parseInt(positionId)
    }
  });
}));

module.exports = router;