/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require('express');
const { executeQuery } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get market overview (public endpoint with optional auth for watchlist)
router.get('/overview', optionalAuth, asyncHandler(async (req, res) => {
  const category = req.query.category;
  const search = req.query.search;
  
  let sql = `
    SELECT 
      s.id,
      s.symbol,
      s.name,
      ac.name as category,
      mp.bid,
      mp.ask,
      mp.last,
      mp.high,
      mp.low,
      mp.volume,
      mp.change_amount,
      mp.change_percent,
      mp.timestamp
    FROM symbols s
    JOIN asset_categories ac ON s.category_id = ac.id
    LEFT JOIN market_prices mp ON s.id = mp.symbol_id
    WHERE s.is_active = 1
    AND (mp.timestamp IS NULL OR mp.timestamp = (
      SELECT MAX(timestamp) 
      FROM market_prices mp2 
      WHERE mp2.symbol_id = s.id
    ))
  `;
  
  const params = [];
  const conditions = [];
  
  if (category && category !== 'all') {
    conditions.push('ac.name = ?');
    params.push(category);
  }
  
  if (search) {
    conditions.push('(s.symbol LIKE ? OR s.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  
  if (conditions.length > 0) {
    sql += ' AND ' + conditions.join(' AND ');
  }
  
  sql += ' ORDER BY mp.volume DESC, s.symbol ASC';
  
  const symbols = await executeQuery(sql, params);
  
  res.json({ symbols });
}));

// Get asset categories
router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await executeQuery(
    'SELECT id, name, description FROM asset_categories WHERE is_active = 1 ORDER BY name'
  );
  
  res.json({ categories });
}));

// Get symbol details
router.get('/symbols/:id', asyncHandler(async (req, res) => {
  const symbolId = parseInt(req.params.id);
  
  const symbols = await executeQuery(
    `SELECT 
       s.*,
       ac.name as category_name,
       mp.bid,
       mp.ask,
       mp.last,
       mp.high,
       mp.low,
       mp.volume,
       mp.change_amount,
       mp.change_percent,
       mp.timestamp as last_update
     FROM symbols s
     JOIN asset_categories ac ON s.category_id = ac.id
     LEFT JOIN market_prices mp ON s.id = mp.symbol_id
     WHERE s.id = ? AND s.is_active = 1
     AND (mp.timestamp IS NULL OR mp.timestamp = (
       SELECT MAX(timestamp) 
       FROM market_prices mp2 
       WHERE mp2.symbol_id = s.id
     ))`,
    [symbolId]
  );
  
  if (!symbols.length) {
    throw new AppError('Symbol not found', 404);
  }
  
  res.json({ symbol: symbols[0] });
}));

// Get symbol by symbol name
router.get('/symbols/by-name/:symbol', asyncHandler(async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  
  const symbols = await executeQuery(
    `SELECT 
       s.*,
       ac.name as category_name,
       mp.bid,
       mp.ask,
       mp.last,
       mp.high,
       mp.low,
       mp.volume,
       mp.change_amount,
       mp.change_percent,
       mp.timestamp as last_update
     FROM symbols s
     JOIN asset_categories ac ON s.category_id = ac.id
     LEFT JOIN market_prices mp ON s.id = mp.symbol_id
     WHERE s.symbol = ? AND s.is_active = 1
     AND (mp.timestamp IS NULL OR mp.timestamp = (
       SELECT MAX(timestamp) 
       FROM market_prices mp2 
       WHERE mp2.symbol_id = s.id
     ))`,
    [symbol]
  );
  
  if (!symbols.length) {
    throw new AppError('Symbol not found', 404);
  }
  
  res.json({ symbol: symbols[0] });
}));

// Get historical price data
router.get('/symbols/:id/history', asyncHandler(async (req, res) => {
  const symbolId = parseInt(req.params.id);
  const timeframe = req.query.timeframe || 'H1';
  const limit = parseInt(req.query.limit) || 100;
  
  // Validate timeframe
  const validTimeframes = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'];
  if (!validTimeframes.includes(timeframe)) {
    throw new AppError('Invalid timeframe', 400);
  }
  
  // Verify symbol exists
  const symbols = await executeQuery(
    'SELECT id FROM symbols WHERE id = ? AND is_active = 1',
    [symbolId]
  );
  
  if (!symbols.length) {
    throw new AppError('Symbol not found', 404);
  }
  
  const history = await executeQuery(
    `SELECT 
       open_price,
       high_price,
       low_price,
       close_price,
       volume,
       tick_volume,
       timestamp
     FROM price_history
     WHERE symbol_id = ? AND timeframe = ?
     ORDER BY timestamp DESC
     LIMIT ?`,
    [symbolId, timeframe, limit]
  );
  
  res.json({ 
    history: history.reverse(), // Return in chronological order
    timeframe,
    symbol_id: symbolId
  });
}));

// Get real-time price updates for specific symbols
router.get('/prices', asyncHandler(async (req, res) => {
  const symbols = req.query.symbols; // Comma-separated symbol IDs or names
  
  if (!symbols) {
    throw new AppError('Symbols parameter is required', 400);
  }
  
  const symbolList = symbols.split(',').map(s => s.trim());
  
  // Check if symbols are IDs (numbers) or symbol names
  const isNumeric = symbolList.every(s => !isNaN(s));
  
  let sql, params;
  
  if (isNumeric) {
    // Symbol IDs provided
    sql = `
      SELECT 
        s.id,
        s.symbol,
        s.name,
        mp.bid,
        mp.ask,
        mp.last,
        mp.change_amount,
        mp.change_percent,
        mp.timestamp
      FROM symbols s
      LEFT JOIN market_prices mp ON s.id = mp.symbol_id
      WHERE s.id IN (${symbolList.map(() => '?').join(',')})
      AND s.is_active = 1
      AND (mp.timestamp IS NULL OR mp.timestamp = (
        SELECT MAX(timestamp) 
        FROM market_prices mp2 
        WHERE mp2.symbol_id = s.id
      ))
    `;
    params = symbolList.map(id => parseInt(id));
  } else {
    // Symbol names provided
    sql = `
      SELECT 
        s.id,
        s.symbol,
        s.name,
        mp.bid,
        mp.ask,
        mp.last,
        mp.change_amount,
        mp.change_percent,
        mp.timestamp
      FROM symbols s
      LEFT JOIN market_prices mp ON s.id = mp.symbol_id
      WHERE s.symbol IN (${symbolList.map(() => '?').join(',')})
      AND s.is_active = 1
      AND (mp.timestamp IS NULL OR mp.timestamp = (
        SELECT MAX(timestamp) 
        FROM market_prices mp2 
        WHERE mp2.symbol_id = s.id
      ))
    `;
    params = symbolList.map(name => name.toUpperCase());
  }
  
  const prices = await executeQuery(sql, params);
  
  res.json({ prices });
}));

// Get trading sessions for a symbol
router.get('/symbols/:id/sessions', asyncHandler(async (req, res) => {
  const symbolId = parseInt(req.params.id);
  
  // Verify symbol exists
  const symbols = await executeQuery(
    'SELECT id, symbol FROM symbols WHERE id = ? AND is_active = 1',
    [symbolId]
  );
  
  if (!symbols.length) {
    throw new AppError('Symbol not found', 404);
  }
  
  const sessions = await executeQuery(
    `SELECT 
       session_name,
       start_time,
       end_time,
       days_of_week,
       timezone,
       is_active
     FROM trading_sessions
     WHERE symbol_id = ? AND is_active = 1
     ORDER BY start_time`,
    [symbolId]
  );
  
  res.json({ 
    symbol: symbols[0],
    sessions 
  });
}));

// Get market statistics
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await Promise.all([
    // Most active symbols by volume
    executeQuery(`
      SELECT s.symbol, s.name, mp.volume, mp.change_percent
      FROM symbols s
      JOIN market_prices mp ON s.id = mp.symbol_id
      WHERE s.is_active = 1
      AND mp.timestamp = (
        SELECT MAX(timestamp) 
        FROM market_prices mp2 
        WHERE mp2.symbol_id = s.id
      )
      ORDER BY mp.volume DESC
      LIMIT 10
    `),
    
    // Top gainers
    executeQuery(`
      SELECT s.symbol, s.name, mp.change_percent, mp.last
      FROM symbols s
      JOIN market_prices mp ON s.id = mp.symbol_id
      WHERE s.is_active = 1
      AND mp.timestamp = (
        SELECT MAX(timestamp) 
        FROM market_prices mp2 
        WHERE mp2.symbol_id = s.id
      )
      AND mp.change_percent IS NOT NULL
      ORDER BY mp.change_percent DESC
      LIMIT 10
    `),
    
    // Top losers
    executeQuery(`
      SELECT s.symbol, s.name, mp.change_percent, mp.last
      FROM symbols s
      JOIN market_prices mp ON s.id = mp.symbol_id
      WHERE s.is_active = 1
      AND mp.timestamp = (
        SELECT MAX(timestamp) 
        FROM market_prices mp2 
        WHERE mp2.symbol_id = s.id
      )
      AND mp.change_percent IS NOT NULL
      ORDER BY mp.change_percent ASC
      LIMIT 10
    `),
    
    // Market overview by category
    executeQuery(`
      SELECT 
        ac.name as category,
        COUNT(s.id) as symbol_count,
        AVG(mp.change_percent) as avg_change
      FROM asset_categories ac
      LEFT JOIN symbols s ON ac.id = s.category_id AND s.is_active = 1
      LEFT JOIN market_prices mp ON s.id = mp.symbol_id
      WHERE ac.is_active = 1
      AND (mp.timestamp IS NULL OR mp.timestamp = (
        SELECT MAX(timestamp) 
        FROM market_prices mp2 
        WHERE mp2.symbol_id = s.id
      ))
      GROUP BY ac.id, ac.name
      ORDER BY ac.name
    `)
  ]);
  
  res.json({
    mostActive: stats[0],
    topGainers: stats[1],
    topLosers: stats[2],
    categoryOverview: stats[3]
  });
}));

// Search symbols
router.get('/search', asyncHandler(async (req, res) => {
  const query = req.query.q;
  const limit = parseInt(req.query.limit) || 20;
  
  if (!query || query.length < 2) {
    throw new AppError('Search query must be at least 2 characters', 400);
  }
  
  const symbols = await executeQuery(
    `SELECT 
       s.id,
       s.symbol,
       s.name,
       ac.name as category,
       mp.last,
       mp.change_percent
     FROM symbols s
     JOIN asset_categories ac ON s.category_id = ac.id
     LEFT JOIN market_prices mp ON s.id = mp.symbol_id
     WHERE s.is_active = 1
     AND (s.symbol LIKE ? OR s.name LIKE ?)
     AND (mp.timestamp IS NULL OR mp.timestamp = (
       SELECT MAX(timestamp) 
       FROM market_prices mp2 
       WHERE mp2.symbol_id = s.id
     ))
     ORDER BY 
       CASE WHEN s.symbol LIKE ? THEN 1 ELSE 2 END,
       s.symbol
     LIMIT ?`,
    [`%${query}%`, `%${query}%`, `${query}%`, limit]
  );
  
  res.json({ symbols });
}));

// Manual market price update (for testing/admin)
router.post('/update-prices', asyncHandler(async (req, res) => {
  const MarketDataService = require('../services/MarketDataService');
  
  try {
    const results = await MarketDataService.updateMarketPrices();
    
    // Broadcast update to WebSocket clients if available
    if (global.broadcast) {
      global.broadcast({
        type: 'market_prices_update',
        timestamp: new Date().toISOString(),
        data: results,
        message: 'Manual market price update'
      });
    }
    
    res.json({
      success: true,
      message: 'Market prices updated successfully',
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update market prices',
      error: error.message
    });
  }
}));

module.exports = router;