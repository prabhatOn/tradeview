/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const { executeQuery } = require('../config/database');

class TradingAccount {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.accountNumber = data.account_number;
    this.accountType = data.account_type;
    this.currency = data.currency;
    this.leverage = parseFloat(data.leverage);
    this.balance = parseFloat(data.balance);
    this.equity = parseFloat(data.equity);
    this.usedMargin = parseFloat(data.used_margin || 0);
    this.freeMargin = parseFloat(data.free_margin);
    this.marginLevel = parseFloat(data.margin_level);
    this.status = data.status;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Find trading accounts by user ID
  static async findByUserId(userId) {
    const accounts = await executeQuery(
      `SELECT * FROM trading_accounts 
       WHERE user_id = ? AND status = 'active'
       ORDER BY created_at DESC`,
      [userId]
    );

    return accounts.map(account => new TradingAccount(account));
  }

  // Find trading account by ID and user ID
  static async findByIdAndUserId(accountId, userId) {
    const accounts = await executeQuery(
      `SELECT * FROM trading_accounts 
       WHERE id = ? AND user_id = ? AND status = 'active'`,
      [accountId, userId]
    );

    if (!accounts.length) return null;
    return new TradingAccount(accounts[0]);
  }

  // Find trading account by user ID and account ID (alias for consistency)
  static async findByUserIdAndAccountId(userId, accountId) {
    return await this.findByIdAndUserId(accountId, userId);
  }

  // Find trading account by ID
  static async findById(accountId) {
    const accounts = await executeQuery(
      `SELECT * FROM trading_accounts WHERE id = ?`,
      [accountId]
    );

    if (!accounts.length) return null;
    return new TradingAccount(accounts[0]);
  }

  // Update account balance and related metrics
  async updateBalance(newBalance, changeType, changeAmount, referenceId = null, referenceType = null, notes = null) {
    const previousBalance = this.balance;
    
    // Update balance in database
    await executeQuery(
      'UPDATE trading_accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newBalance, this.id]
    );

    // Insert balance history record
    await executeQuery(
      `INSERT INTO account_balance_history 
       (account_id, previous_balance, new_balance, change_amount, change_type, reference_id, reference_type, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [this.id, previousBalance, newBalance, changeAmount, changeType, referenceId, referenceType, notes]
    );
    
    // Update local balance value
    this.balance = newBalance;
    
    // Refresh account metrics to properly calculate equity, used_margin, free_margin, and margin_level
    await this.refreshAccountMetrics();
  }

  // Get account's open positions count
  async getOpenPositionsCount() {
    const result = await executeQuery(
      'SELECT COUNT(*) as count FROM positions WHERE account_id = ? AND status = "open"',
      [this.id]
    );
    return parseInt(result[0].count) || 0;
  }

  // Get unrealized P&L from open positions
  async getUnrealizedPnL() {
    const result = await executeQuery(
      'SELECT COALESCE(SUM(profit), 0) as total FROM positions WHERE account_id = ? AND status = "open"',
      [this.id]
    );
    return parseFloat(result[0].total) || 0;
  }

  // Simple equity calculation: balance + unrealized P&L
  async calculateSimpleEquity() {
    const unrealizedPnL = await this.getUnrealizedPnL();
    return this.balance + unrealizedPnL;
  }

  // Check if account has sufficient margin for a position
  async hasSufficientMargin(requiredMargin) {
    // Refresh account metrics first to get current free margin
    await this.refreshAccountMetrics();
    
    console.log('Margin check:', {
      requiredMargin,
      freeMargin: this.freeMargin,
      hasSufficient: this.freeMargin >= requiredMargin
    });
    
    return this.freeMargin >= requiredMargin;
  }

  // Update account equity based on open positions
  async refreshAccountMetrics() {
    // Get unrealized P&L from open positions
    const unrealizedPnL = await this.getUnrealizedPnL();
    const equity = this.balance + unrealizedPnL;

    // Calculate used margin from all open positions
    const marginQuery = await executeQuery(`
      SELECT 
        COALESCE(SUM((p.lot_size * s.contract_size * p.open_price) / ta.leverage), 0) as used_margin
      FROM positions p
      JOIN symbols s ON p.symbol_id = s.id
      JOIN trading_accounts ta ON p.account_id = ta.id
      WHERE p.account_id = ? AND p.status = 'open'
    `, [this.id]);

    const usedMargin = parseFloat(marginQuery[0]?.used_margin || 0);
    const freeMargin = Math.max(equity - usedMargin, 0);
    const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 0;

    await executeQuery(
      'UPDATE trading_accounts SET equity = ?, used_margin = ?, free_margin = ?, margin_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [equity, usedMargin, freeMargin, marginLevel, this.id]
    );

    this.equity = equity;
    this.usedMargin = usedMargin;
    this.freeMargin = freeMargin;
    this.marginLevel = marginLevel;
    this.updatedAt = new Date();
  }

  // Get used margin from open positions
  async getUsedMargin() {
    const marginQuery = await executeQuery(`
      SELECT 
        COALESCE(SUM(
          CASE 
            WHEN mp.bid IS NOT NULL AND mp.ask IS NOT NULL THEN
              -- Use current market price for margin calculation
              CASE 
                WHEN p.side = 'buy' THEN (p.lot_size * s.contract_size * mp.ask) / ta.leverage
                WHEN p.side = 'sell' THEN (p.lot_size * s.contract_size * mp.bid) / ta.leverage
                ELSE 0
              END
            ELSE
              -- Fallback to open price if no market data available
              (p.lot_size * s.contract_size * p.open_price) / ta.leverage
          END
        ), 0) as used_margin
      FROM positions p
      JOIN symbols s ON p.symbol_id = s.id
      JOIN trading_accounts ta ON p.account_id = ta.id
      LEFT JOIN market_prices mp ON p.symbol_id = mp.symbol_id 
        AND mp.timestamp = (SELECT MAX(timestamp) FROM market_prices WHERE symbol_id = p.symbol_id)
      WHERE p.account_id = ? AND p.status = 'open'
    `, [this.id]);

    return parseFloat(marginQuery[0]?.used_margin || 0);
  }

  // Convert to JSON for API responses
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      accountNumber: this.accountNumber,
      accountType: this.accountType,
      currency: this.currency,
      leverage: this.leverage,
      balance: this.balance,
      equity: this.equity,
      usedMargin: this.usedMargin,
      freeMargin: this.freeMargin,
      marginLevel: this.marginLevel,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = TradingAccount;