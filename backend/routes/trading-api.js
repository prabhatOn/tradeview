/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require('express');
const crypto = require('crypto');
const { executeQuery } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Middleware to authenticate API key
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const apiSecret = req.headers['x-api-secret'];

    if (!apiKey || !apiSecret) {
      return res.status(401).json({
        error: 'API_AUTH_REQUIRED',
        message: 'API key and secret are required in headers'
      });
    }

    // Hash the provided secret to compare with stored hash
    const hashedSecret = crypto.createHash('sha256').update(apiSecret).digest('hex');

    // Find the API key and verify it belongs to an active user
    const [apiKeyRecord] = await executeQuery(`
      SELECT ak.user_id, ak.is_active, ak.rate_limit_per_hour, ak.ip_whitelist, ak.permissions,
             u.status as user_active
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.api_key = ? AND ak.api_secret = ?
    `, [apiKey, hashedSecret]);

    if (!apiKeyRecord) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid API key or secret'
      });
    }

    if (!apiKeyRecord.is_active) {
      return res.status(401).json({
        error: 'API_KEY_DISABLED',
        message: 'API key is disabled'
      });
    }

    if (!apiKeyRecord.user_active || apiKeyRecord.user_active !== 'active') {
      return res.status(401).json({
        error: 'USER_DISABLED',
        message: 'User account is disabled'
      });
    }

    // Check IP whitelist if configured
    let ipWhitelist = [];
    try {
      ipWhitelist = apiKeyRecord.ip_whitelist ? JSON.parse(apiKeyRecord.ip_whitelist) : [];
      if (!Array.isArray(ipWhitelist)) ipWhitelist = [];
    } catch {
      ipWhitelist = [];
    }
    if (ipWhitelist.length > 0) {
      const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
      if (!ipWhitelist.includes(clientIP)) {
        return res.status(403).json({
          error: 'IP_NOT_ALLOWED',
          message: 'Your IP address is not whitelisted for this API key'
        });
      }
    }

    // TODO: Check rate limiting here
    // You would implement rate limiting logic based on rate_limit_per_hour

    // Update last used timestamp
    await executeQuery(
      'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP, usage_count = usage_count + 1 WHERE api_key = ?',
      [apiKey]
    );

    // Attach user info to request
    let permissions = [];
    try {
      if (apiKeyRecord.permissions) {
        if (apiKeyRecord.permissions.trim().startsWith('[')) {
          permissions = JSON.parse(apiKeyRecord.permissions);
        } else {
          permissions = apiKeyRecord.permissions.split(',').map(p => p.trim()).filter(Boolean);
        }
      }
    } catch {
      permissions = [];
    }
    req.apiUser = {
      id: apiKeyRecord.user_id,
      permissions
    };

    next();
  } catch (error) {
    console.error('API authentication error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authentication failed'
    });
  }
};

// Apply authentication middleware to all routes
router.use(authenticateApiKey);

// Get user's account information
router.get('/account', asyncHandler(async (req, res) => {
  // Get user's first trading account
  const [account] = await executeQuery(`
    SELECT ta.id, ta.balance, ta.currency, ta.leverage, ta.created_at, ta.status
    FROM trading_accounts ta
    WHERE ta.user_id = ?
    ORDER BY ta.created_at ASC
    LIMIT 1
  `, [req.apiUser.id]);

  if (!account) {
    throw new AppError('Trading account not found', 404);
  }

  res.json({
    success: true,
    data: {
      account_id: account.id,
      balance: parseFloat(account.balance || 0),
      currency: account.currency || 'USD',
      leverage: account.leverage || '1.00',
      account_created: account.created_at,
      status: account.status
    }
  });
}));

// Get user's current positions
router.get('/positions', asyncHandler(async (req, res) => {
  const positions = await executeQuery(`
    SELECT 
      p.id,
      s.symbol,
      p.side,
      p.lot_size,
      p.open_price,
      p.current_price,
      p.stop_loss,
      p.take_profit,
      p.profit,
      p.status,
      p.opened_at,
      p.closed_at
    FROM positions p
    JOIN trading_accounts ta ON p.account_id = ta.id
    JOIN symbols s ON p.symbol_id = s.id
    WHERE ta.user_id = ? AND p.status IN ('open', 'pending')
    ORDER BY p.opened_at DESC
  `, [req.apiUser.id]);

  res.json({
    success: true,
    data: positions.map(position => ({
      id: position.id,
      symbol: position.symbol,
      side: position.side,
      lot_size: parseFloat(position.lot_size),
      open_price: parseFloat(position.open_price),
      current_price: parseFloat(position.current_price || 0),
      stop_loss: parseFloat(position.stop_loss || 0),
      take_profit: parseFloat(position.take_profit || 0),
      profit: parseFloat(position.profit || 0),
      status: position.status,
      opened_at: position.opened_at,
      closed_at: position.closed_at
    }))
  });
}));

// Open a new position
router.post('/positions', asyncHandler(async (req, res) => {
  if (!req.apiUser.permissions.includes('trade')) {
    return res.status(403).json({
      error: 'INSUFFICIENT_PERMISSIONS',
      message: 'Trade permission required to open positions'
    });
  }

  const { symbol, side, lot_size, stop_loss, take_profit } = req.body;

  // Validation
  if (!symbol || !side || !lot_size) {
    throw new AppError('Missing required fields: symbol, side, lot_size', 400);
  }

  if (!['buy', 'sell'].includes(side)) {
    throw new AppError('Side must be "buy" or "sell"', 400);
  }

  if (lot_size <= 0) {
    throw new AppError('Lot size must be greater than 0', 400);
  }

  // Get symbol_id
  const [symbolRow] = await executeQuery('SELECT id FROM symbols WHERE symbol = ?', [symbol.toUpperCase()]);
  if (!symbolRow) {
    throw new AppError('Symbol not found', 400);
  }

  // Get user's trading account (assume first account for now)
  const [account] = await executeQuery('SELECT id FROM trading_accounts WHERE user_id = ? LIMIT 1', [req.apiUser.id]);
  if (!account) {
    throw new AppError('Trading account not found', 400);
  }

  // Get current market price (in real implementation, this would come from price feed)
  const currentPrice = 1.1234; // Mock price - replace with real price feed

  // Create the position
  const result = await executeQuery(`
    INSERT INTO positions (
      account_id, symbol_id, side, lot_size, open_price, 
      stop_loss, take_profit, status, opened_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', CURRENT_TIMESTAMP)
  `, [
    account.id,
    symbolRow.id,
    side,
    lot_size,
    currentPrice,
    stop_loss || null,
    take_profit || null
  ]);

  res.status(201).json({
    success: true,
    data: {
      position_id: result.insertId,
      symbol: symbol.toUpperCase(),
      side,
      lot_size: parseFloat(lot_size),
      open_price: currentPrice,
      stop_loss: parseFloat(stop_loss || 0),
      take_profit: parseFloat(take_profit || 0),
      status: 'open',
      message: 'Position opened successfully'
    }
  });
}));

// Close a position
router.delete('/positions/:positionId', asyncHandler(async (req, res) => {
  if (!req.apiUser.permissions.includes('trade')) {
    return res.status(403).json({
      error: 'INSUFFICIENT_PERMISSIONS',
      message: 'Trade permission required to close positions'
    });
  }

  const positionId = parseInt(req.params.positionId);

  // Check if position exists and belongs to user
  const [position] = await executeQuery(`
    SELECT p.id, s.symbol, p.side, p.lot_size, p.open_price 
    FROM positions p
    JOIN trading_accounts ta ON p.account_id = ta.id
    JOIN symbols s ON p.symbol_id = s.id
    WHERE p.id = ? AND ta.user_id = ? AND p.status = 'open'
  `, [positionId, req.apiUser.id]);

  if (!position) {
    throw new AppError('Position not found or already closed', 404);
  }

  // Get current market price (mock)
  const closePrice = 1.1245; // Mock price - replace with real price feed

  // Calculate profit/loss (simplified calculation)
  const priceDiff = position.side === 'buy' 
    ? closePrice - position.open_price 
    : position.open_price - closePrice;
  const profitLoss = priceDiff * position.lot_size;

  // Close the position
  await executeQuery(`
    UPDATE positions 
    SET status = 'closed', current_price = ?, close_price = ?, profit = ?, profit_loss = ?, closed_at = CURRENT_TIMESTAMP, close_time = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [closePrice, closePrice, profitLoss, profitLoss, positionId]);

  // Update user balance (simplified)
  await executeQuery(`
    UPDATE users 
    SET balance = balance + ?
    WHERE id = ?
  `, [profitLoss, req.apiUser.id]);

  res.json({
    success: true,
    data: {
      position_id: positionId,
      close_price: closePrice,
      profit_loss: parseFloat(profitLoss.toFixed(2)),
      message: 'Position closed successfully'
    }
  });
}));

// Get trading history
router.get('/history', asyncHandler(async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;

  const history = await executeQuery(`
    SELECT 
      p.id,
      s.symbol,
      p.side,
      p.lot_size,
      p.open_price,
  COALESCE(p.close_price, p.current_price) as close_price,
      p.profit,
      p.opened_at,
      p.closed_at
    FROM positions p
    JOIN trading_accounts ta ON p.account_id = ta.id
    JOIN symbols s ON p.symbol_id = s.id
    WHERE ta.user_id = ? AND p.status = 'closed'
    ORDER BY p.closed_at DESC
    LIMIT ? OFFSET ?
  `, [req.apiUser.id, parseInt(limit), parseInt(offset)]);

  res.json({
    success: true,
    data: history.map(trade => ({
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      lot_size: parseFloat(trade.lot_size),
      open_price: parseFloat(trade.open_price),
      close_price: parseFloat(trade.close_price || 0),
      profit: parseFloat(trade.profit || 0),
      opened_at: trade.opened_at,
      closed_at: trade.closed_at
    }))
  });
}));

// Get market data (basic implementation)
router.get('/market/:symbol', asyncHandler(async (req, res) => {
  const { symbol } = req.params;

  // Mock market data - in real implementation, this would come from external data feed
  const mockData = {
    'EURUSD': { bid: 1.1234, ask: 1.1236, spread: 0.0002, last: 1.1235 },
    'GBPUSD': { bid: 1.2345, ask: 1.2347, spread: 0.0002, last: 1.2346 },
    'USDJPY': { bid: 110.45, ask: 110.47, spread: 0.02, last: 110.46 },
    'AUDUSD': { bid: 0.7123, ask: 0.7125, spread: 0.0002, last: 0.7124 }
  };

  const marketData = mockData[symbol.toUpperCase()];
  if (!marketData) {
    throw new AppError('Symbol not found', 404);
  }

  res.json({
    success: true,
    data: {
      symbol: symbol.toUpperCase(),
      ...marketData,
      timestamp: new Date().toISOString()
    }
  });
}));

// Error handling for API routes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
router.use((error, req, res, _next) => {
  console.error('Trading API Error:', error);
  
  res.status(error.statusCode || 500).json({
    error: error.code || 'INTERNAL_ERROR',
    message: error.message || 'An internal error occurred',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;