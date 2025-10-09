const { executeQuery, executeTransaction } = require('../config/database');

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
    
    // Start transaction to update balance and record history
    const queries = [
      {
        sql: `UPDATE trading_accounts 
              SET balance = ?, equity = ?, free_margin = ?, updated_at = CURRENT_TIMESTAMP 
              WHERE id = ?`,
        params: [newBalance, newBalance, newBalance, this.id] // Simplified: assuming no open positions for now
      },
      {
        sql: `INSERT INTO account_balance_history 
              (account_id, previous_balance, new_balance, change_amount, change_type, reference_id, reference_type, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [this.id, previousBalance, newBalance, changeAmount, changeType, referenceId, referenceType, notes]
      }
    ];

    await executeTransaction(queries);
    
    // Update local values
    this.balance = newBalance;
    this.equity = newBalance;
    this.freeMargin = newBalance;
    this.updatedAt = new Date();
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
    const unrealizedPnL = await this.getUnrealizedPnL();
    const equity = this.balance + unrealizedPnL;
    const freeMargin = equity; // Simplified: free margin = equity (no margin calculation)
    const marginLevel = 0; // Simplified: not calculating margin level

    await executeQuery(
      'UPDATE trading_accounts SET equity = ?, free_margin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [equity, freeMargin, this.id]
    );

    this.equity = equity;
    this.freeMargin = freeMargin;
    this.updatedAt = new Date();
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
      freeMargin: this.freeMargin,
      marginLevel: this.marginLevel,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = TradingAccount;