/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { executeQuery } = require('../config/database');

const router = express.Router();

// System status endpoint
router.get('/status', asyncHandler(async (req, res) => {
  const [symbolsCount] = await executeQuery('SELECT COUNT(*) as count FROM symbols WHERE is_active = TRUE');
  const [pricesCount] = await executeQuery('SELECT COUNT(*) as count FROM market_prices');
  const [accountsCount] = await executeQuery('SELECT COUNT(*) as count FROM trading_accounts WHERE status = "active"');
  const [usersCount] = await executeQuery('SELECT COUNT(*) as count FROM users WHERE status = "active"');
  
  // Get current user's accounts if authenticated
  let userAccounts = [];
  if (req.user) {
    userAccounts = await executeQuery('SELECT id, account_number, balance, status FROM trading_accounts WHERE user_id = ?', [req.user.id]);
  }

  res.json({
    success: true,
    data: {
      system: {
        activeSymbols: symbolsCount[0].count,
        marketPrices: pricesCount[0].count,
        activeAccounts: accountsCount[0].count,
        activeUsers: usersCount[0].count,
        status: 'operational'
      },
      user: req.user ? {
        id: req.user.id,
        email: req.user.email,
        tradingAccounts: userAccounts
      } : null,
      timestamp: new Date().toISOString()
    }
  });
}));

module.exports = router;