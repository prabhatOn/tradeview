/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const { executeQuery, executeTransaction } = require('../config/database');
const { getTableColumns } = require('../utils/schemaUtils');

let accountBalanceHistoryColumnsPromise;

async function getAccountBalanceHistoryColumns() {
  if (!accountBalanceHistoryColumnsPromise) {
    accountBalanceHistoryColumnsPromise = getTableColumns('account_balance_history');
  }
  return accountBalanceHistoryColumnsPromise;
}

async function insertAccountBalanceHistory(connection, data) {
  const columnsSet = await getAccountBalanceHistoryColumns();

  const requiredColumns = [
    'account_id',
    'previous_balance',
    'new_balance',
    'change_amount',
    'change_type'
  ];

  const optionalColumns = [
    'change_context',
    'reference_id',
    'reference_type',
    'performed_by_type',
    'performed_by_id',
    'metadata',
    'notes'
  ];

  const columns = [];
  const placeholders = [];
  const values = [];

  for (const column of requiredColumns) {
    if (!columnsSet.has(column)) {
      throw new Error(`Required column ${column} missing in account_balance_history table`);
    }
    columns.push(column);
    placeholders.push('?');
    values.push(Object.prototype.hasOwnProperty.call(data, column) ? data[column] : null);
  }

  for (const column of optionalColumns) {
    if (!columnsSet.has(column)) {
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(data, column)) {
      continue;
    }

    let value = data[column];

    if (column === 'metadata' && value != null) {
      value = typeof value === 'string' ? value : JSON.stringify(value);
    }

    columns.push(column);
    placeholders.push('?');
    values.push(value);
  }

  const sql = `INSERT INTO account_balance_history (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
  await connection.execute(sql, values);
}

class FundManager {
  
  /**
   * Calculate real-time P&L for a position
   * @param {Object} position - Position object with open_price, lot_size, side
   * @param {number} currentPrice - Current market price
   * @param {Object} symbolInfo - Symbol information with contract_size, pip_size
   * @returns {number} Profit/Loss amount (gross, before commission/swap)
   */
  static calculatePositionPnL(position, currentPrice, symbolInfo) {
    const { open_price, lot_size, side } = position;
    const contractSize = symbolInfo?.contract_size || 100000; // Standard lot size
    
    if (!currentPrice || currentPrice <= 0 || !open_price || open_price <= 0) {
      return 0;
    }
    
    let pnl = 0;
    if (side === 'buy') {
      pnl = (currentPrice - open_price) * lot_size * contractSize;
    } else {
      pnl = (open_price - currentPrice) * lot_size * contractSize;
    }
    
    return Math.round(pnl * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate net P&L including commission and swap
   * @param {Object} position - Position object
   * @param {number} currentPrice - Current market price
   * @param {Object} symbolInfo - Symbol information
   * @returns {number} Net profit/loss
   */
  static calculateNetPositionPnL(position, currentPrice, symbolInfo) {
    const grossPnL = this.calculatePositionPnL(position, currentPrice, symbolInfo);
    const commission = position.commission || 0;
    const swap = position.swap || 0;
    
    return grossPnL - commission - swap;
  }

  /**
   * Update account balance when closing a position
   * @param {number} accountId - Trading account ID
   * @param {number} profit - Profit/Loss amount
   * @param {number} positionId - Position ID for reference
   * @param {string} changeType - Type of balance change
   * @returns {Object} Updated account balance info
   */
  static async updateAccountBalance(accountId, profit, positionId, options = {}) {
    const {
      performedByType = 'system',
      performedById = null,
      metadata = {},
      notes
    } = options;

    return executeTransaction(async (connection) => {
      // Get current account balance
      const [accountRows] = await connection.execute(
        'SELECT user_id, balance, equity, free_margin FROM trading_accounts WHERE id = ?',
        [accountId]
      );
      
      if (accountRows.length === 0) {
        throw new Error('Trading account not found');
      }
      
      const currentBalance = parseFloat(accountRows[0].balance);
      const newBalance = currentBalance + profit;
      
      // Update account balance
      await connection.execute(
        `UPDATE trading_accounts 
         SET balance = ?, equity = ?, free_margin = ?, updated_at = NOW() 
         WHERE id = ?`,
        [newBalance, newBalance, newBalance, accountId]
      );
      
      // Record balance history
      await connection.execute(
        `INSERT INTO account_balance_history 
         (account_id, previous_balance, new_balance, change_amount, change_type, change_context, reference_id, reference_type, performed_by_type, performed_by_id, metadata, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          accountId,
          currentBalance,
          newBalance,
          profit,
          profit >= 0 ? 'trade_profit' : 'trade_loss',
          'trade',
          positionId,
          'position',
          performedByType,
          performedById,
          JSON.stringify({ ...metadata, positionId }),
          notes || `Position ${profit >= 0 ? 'profit' : 'loss'}: ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`
        ]
      );
      
      return {
        previousBalance: currentBalance,
        newBalance: newBalance,
        change: profit,
        changeType: profit >= 0 ? 'profit' : 'loss'
      };
    });
  }

  /**
   * Calculate comprehensive position statistics for an account
   * @param {number} accountId - Trading account ID
   * @param {Array} positions - Array of position objects with current prices
   * @returns {Object} Position statistics
   */
  static calculatePositionStatistics(accountId, positions = []) {
    const openPositions = positions.filter(p => p.status === 'open');
    const closedPositions = positions.filter(p => p.status === 'closed');
    
    // Calculate totals
    const totalPositions = positions.length;
    const totalPnL = positions.reduce((sum, p) => sum + (p.profit || 0), 0);
    const totalProfit = positions.filter(p => (p.profit || 0) > 0)
                              .reduce((sum, p) => sum + p.profit, 0);
    const totalLoss = Math.abs(positions.filter(p => (p.profit || 0) < 0)
                                       .reduce((sum, p) => sum + p.profit, 0));
    
    // Calculate performance metrics
    const winningTrades = closedPositions.filter(p => (p.profit || 0) > 0);
    const losingTrades = closedPositions.filter(p => (p.profit || 0) <= 0);
    const winRate = closedPositions.length > 0 ? (winningTrades.length / closedPositions.length) * 100 : 0;
    
    // Calculate averages
    const avgWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;
    const avgTrade = closedPositions.length > 0 ? (totalProfit - totalLoss) / closedPositions.length : 0;
    
    // Calculate costs
    const totalCommission = positions.reduce((sum, p) => sum + (p.commission || 0), 0);
    const totalSwap = positions.reduce((sum, p) => sum + (p.swap || 0), 0);
    
    // Calculate exposure
    const currentExposure = openPositions.reduce((sum, p) => {
      return sum + ((p.lotSize || 0) * (p.currentPrice || p.openPrice || 0));
    }, 0);
    
    const unrealizedPnL = openPositions.reduce((sum, p) => sum + (p.profit || 0), 0);
    
    return {
      totalPositions,
      openPositions: openPositions.length,
      closedPositions: closedPositions.length,
      
      // P&L Statistics
      totalPnL,
      totalProfit,
      totalLoss,
      netProfit: totalPnL - totalCommission - totalSwap,
      
      // Performance Metrics
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      
      // Averages
      avgWin,
      avgLoss,
      avgTrade,
      
      // Risk Metrics
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : (totalProfit > 0 ? 999 : 0),
      
      // Costs
      totalCommission,
      totalSwap,
      
      // Current Exposure
      currentExposure,
      unrealizedPnL
    };
  }

  /**
   * Process deposit transaction
   * @param {number} accountId - Trading account ID
   * @param {number} amount - Deposit amount
   * @param {string} method - Payment method
   * @param {string} transactionId - External transaction ID
   * @returns {Object} Transaction result
   */
  static async processDeposit(accountId, amount, method = 'bank_transfer', transactionId = null, options = {}) {
    const {
      performedByType = 'system',
      performedById = null,
      metadata = {}
    } = options;

    return executeTransaction(async (connection) => {
      // Get current balance
      const [accountRows] = await connection.execute(
        'SELECT balance, equity, free_margin FROM trading_accounts WHERE id = ?',
        [accountId]
      );
      
      if (accountRows.length === 0) {
        throw new Error('Trading account not found');
      }
      
      const currentBalance = parseFloat(accountRows[0].balance);
      const newBalance = currentBalance + amount;
      
      // Update account balance
      await connection.execute(
        `UPDATE trading_accounts 
         SET balance = ?, equity = ?, free_margin = ?, updated_at = NOW() 
         WHERE id = ?`,
        [newBalance, newBalance, newBalance, accountId]
      );
      
      // Record balance history
      await insertAccountBalanceHistory(connection, {
        account_id: accountId,
        previous_balance: currentBalance,
        new_balance: newBalance,
        change_amount: amount,
        change_type: 'deposit',
        change_context: 'deposit',
        reference_id: transactionId,
        reference_type: 'deposit_transaction',
        performed_by_type: performedByType,
        performed_by_id: performedById,
        metadata: { ...metadata, method, transactionId },
        notes: `Deposit via ${method}: +$${amount.toFixed(2)}`
      });
      
      return {
        success: true,
        previousBalance: currentBalance,
        newBalance: newBalance,
        depositAmount: amount,
        method: method,
        transactionId: transactionId
      };
    });
  }

  /**
   * Process withdrawal transaction
   * @param {number} accountId - Trading account ID
   * @param {number} amount - Withdrawal amount
   * @param {string} method - Payment method
   * @param {string} transactionId - External transaction ID
   * @returns {Object} Transaction result
   */
  static async processWithdrawal(accountId, amount, method = 'bank_transfer', transactionId = null, options = {}) {
    const {
      performedByType = 'system',
      performedById = null,
      metadata = {}
    } = options;

    return executeTransaction(async (connection) => {
      // Get current balance
      const [accountRows] = await connection.execute(
        'SELECT balance, equity, free_margin FROM trading_accounts WHERE id = ? AND status = "active"',
        [accountId]
      );
      
      if (accountRows.length === 0) {
        throw new Error('Trading account not found or inactive');
      }
      
      const currentBalance = parseFloat(accountRows[0].balance);
      
      // Check if sufficient funds
      if (currentBalance < amount) {
        throw new Error('Insufficient funds for withdrawal');
      }
      
      const newBalance = currentBalance - amount;
      
      // Update account balance
      await connection.execute(
        `UPDATE trading_accounts 
         SET balance = ?, equity = ?, free_margin = ?, updated_at = NOW() 
         WHERE id = ?`,
        [newBalance, newBalance, newBalance, accountId]
      );
      
      // Record balance history
      await insertAccountBalanceHistory(connection, {
        account_id: accountId,
        previous_balance: currentBalance,
        new_balance: newBalance,
        change_amount: -amount,
        change_type: 'withdrawal',
        change_context: 'withdrawal',
        reference_id: transactionId,
        reference_type: 'withdrawal_transaction',
        performed_by_type: performedByType,
        performed_by_id: performedById,
        metadata: { ...metadata, method, transactionId },
        notes: `Withdrawal via ${method}: -$${amount.toFixed(2)}`
      });
      
      return {
        success: true,
        previousBalance: currentBalance,
        newBalance: newBalance,
        withdrawalAmount: amount,
        method: method,
        transactionId: transactionId
      };
    });
  }

  /**
   * Apply a manual adjustment (credit or debit) initiated by admin/system
   * @param {number} accountId
   * @param {number} amount Positive amount to adjust
   * @param {'credit'|'debit'} type
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  static async applyManualAdjustment(accountId, amount, type = 'credit', options = {}) {
    const {
      performedById = null,
      reasonCode = 'adjustment',
      notes = '',
      metadata = {}
    } = options;

    const signedAmount = type === 'credit' ? Math.abs(amount) : -Math.abs(amount);

    return executeTransaction(async (connection) => {
      const [accountRows] = await connection.execute(
        `SELECT 
           user_id, account_number, account_type, currency,
           balance, equity, free_margin, margin_level
         FROM trading_accounts 
         WHERE id = ?
         FOR UPDATE`,
        [accountId]
      );

      if (accountRows.length === 0) {
        throw new Error('Trading account not found');
      }

      const accountRow = accountRows[0];
      const accountOwnerId = accountRow.user_id;

      const parseWithFallback = (value, fallback) => {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };

      const currentBalance = parseWithFallback(accountRow.balance, 0);
      const currentEquity = parseWithFallback(accountRow.equity, currentBalance);
      const currentFreeMargin = parseWithFallback(accountRow.free_margin, currentBalance);
      const newBalance = currentBalance + signedAmount;

      if (Number.isNaN(currentBalance)) {
        throw new Error('Unable to determine current balance for trading account');
      }

      if (newBalance < 0) {
        throw new Error('Manual adjustment would result in negative balance');
      }

      // Get account leverage for margin calculation
      const [leverageRows] = await connection.execute(
        `SELECT leverage FROM trading_accounts WHERE id = ?`,
        [accountId]
      );
      const accountLeverage = parseFloat(leverageRows[0]?.leverage) || 100;

      const [positionMetricsRows] = await connection.execute(
        `SELECT 
           COALESCE(SUM(p.profit), 0) AS unrealizedPnL,
           COALESCE(SUM((p.lot_size * s.contract_size * p.open_price) / ?), 0) AS marginUsed
         FROM positions p
         LEFT JOIN symbols s ON s.id = p.symbol_id
         WHERE p.account_id = ? AND p.status = 'open'`,
        [accountLeverage, accountId]
      );

      const unrealizedPnL = parseWithFallback(positionMetricsRows[0]?.unrealizedPnL, 0);
      const marginUsedRaw = parseWithFallback(positionMetricsRows[0]?.marginUsed, 0);
      const recalculatedEquity = newBalance + unrealizedPnL;
      const recalculatedFreeMargin = Math.max(recalculatedEquity - marginUsedRaw, 0);
      const marginLevel = marginUsedRaw > 0
        ? (recalculatedEquity / marginUsedRaw) * 100
        : recalculatedEquity > 0
          ? 9999
          : 0;

      await connection.execute(
        `UPDATE trading_accounts 
         SET balance = ?, equity = ?, free_margin = ?, margin_level = ?, updated_at = NOW() 
         WHERE id = ?`,
        [newBalance, recalculatedEquity, recalculatedFreeMargin, marginLevel, accountId]
      );

      const recalculatedAccount = {
        id: accountId,
        user_id: accountOwnerId,
        account_number: accountRow.account_number,
        account_type: accountRow.account_type,
        currency: accountRow.currency,
        balance: newBalance,
        equity: recalculatedEquity,
        free_margin: recalculatedFreeMargin,
        margin_level: marginLevel
      };

      const parsedBalance = newBalance;
      const parsedEquity = recalculatedEquity;
      const parsedFreeMargin = recalculatedFreeMargin;

      const changeType = type === 'credit' ? 'manual_credit' : 'manual_debit';

      const enrichedMetadata = {
        ...metadata,
        reasonCode,
        previousBalance: currentBalance,
        newBalance,
        previousEquity: currentEquity,
        previousFreeMargin: currentFreeMargin,
        updatedEquity: parsedEquity,
        updatedFreeMargin: parsedFreeMargin,
        updatedUnrealizedPnL: unrealizedPnL,
        updatedMarginUsed: marginUsedRaw
      };

      await insertAccountBalanceHistory(connection, {
        account_id: accountId,
        previous_balance: currentBalance,
        new_balance: newBalance,
        change_amount: signedAmount,
        change_type: changeType,
        change_context: 'adjustment',
        reference_id: null,
        reference_type: 'manual_adjustment',
        performed_by_type: 'admin',
        performed_by_id: performedById,
        metadata: enrichedMetadata,
        notes: notes || `Manual ${type === 'credit' ? 'credit' : 'debit'} (${reasonCode})`
      });

      await connection.execute(
        'UPDATE users SET updated_at = NOW() WHERE id = ?',
        [accountOwnerId]
      );

      const [aggregateRows] = await connection.execute(
        `SELECT 
           COUNT(*) AS accountCount,
           COALESCE(SUM(balance), 0) AS totalBalance,
           COALESCE(SUM(equity), 0) AS totalEquity
         FROM trading_accounts
         WHERE user_id = ?`,
        [accountOwnerId]
      );

      const aggregate = aggregateRows.length ? aggregateRows[0] : { accountCount: 0, totalBalance: 0, totalEquity: 0 };

      return {
        success: true,
        accountId,
        userId: accountOwnerId,
        previousBalance: currentBalance,
        newBalance,
        change: signedAmount,
        changeType,
        reasonCode,
        updatedAccount: {
          id: recalculatedAccount.id,
          accountNumber: recalculatedAccount.account_number,
          accountType: recalculatedAccount.account_type,
          currency: recalculatedAccount.currency,
          balance: parsedBalance,
          equity: parsedEquity,
          freeMargin: parsedFreeMargin,
          marginLevel: marginLevel
        },
        aggregate: {
          accountCount: Number(aggregate.accountCount) || 0,
          totalBalance: parseFloat(aggregate.totalBalance) || 0,
          totalEquity: parseFloat(aggregate.totalEquity) || 0
        }
      };
    });
  }

  /**
   * Get account balance history with pagination
   * @param {number} accountId - Trading account ID
   * @param {number} limit - Number of records to fetch
   * @param {number} offset - Offset for pagination
   * @returns {Array} Balance history records
   */
  static async getBalanceHistory(accountId, limit = 50, offset = 0) {
    // Use string interpolation for LIMIT and OFFSET since MySQL doesn't support them as parameters
    const query = `
      SELECT 
        abh.*,
        DATE_FORMAT(abh.created_at, '%Y-%m-%d %H:%i:%s') as formatted_date
      FROM account_balance_history abh
      WHERE abh.account_id = ?
      ORDER BY abh.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    
    const rows = await executeQuery(query, [accountId]);
    
    return rows.map(row => {
      let parsedMetadata = null;
      if (row.metadata) {
        try {
          parsedMetadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
        } catch {
          parsedMetadata = row.metadata;
        }
      }

      return {
        ...row,
        change_amount: parseFloat(row.change_amount),
        previous_balance: parseFloat(row.previous_balance),
        new_balance: parseFloat(row.new_balance),
        metadata: parsedMetadata
      };
    });
  }

  /**
   * Calculate account statistics
   * @param {number} accountId - Trading account ID
   * @returns {Object} Account statistics
   */
  static async getAccountStatistics(accountId) {
    // Get total deposits
    const [depositResult] = await executeQuery(
      `SELECT COALESCE(SUM(change_amount), 0) as total_deposits 
       FROM account_balance_history 
       WHERE account_id = ? AND change_type IN ('deposit', 'manual_credit', 'bonus')`,
      [accountId]
    );
    
    // Get total withdrawals
    const [withdrawalResult] = await executeQuery(
      `SELECT COALESCE(SUM(ABS(change_amount)), 0) as total_withdrawals 
       FROM account_balance_history 
       WHERE account_id = ? AND change_type IN ('withdrawal', 'manual_debit')`,
      [accountId]
    );
    
    // Get trading P&L
    const [pnlResult] = await executeQuery(
      `SELECT 
        COALESCE(SUM(CASE WHEN change_type = 'trade_profit' THEN change_amount ELSE 0 END), 0) as total_profit,
        COALESCE(SUM(CASE WHEN change_type = 'trade_loss' THEN ABS(change_amount) ELSE 0 END), 0) as total_loss
       FROM account_balance_history 
       WHERE account_id = ? AND change_type IN ('trade_profit', 'trade_loss')`,
      [accountId]
    );
    
    // Get current balance
    const [balanceResult] = await executeQuery(
      'SELECT balance FROM trading_accounts WHERE id = ?',
      [accountId]
    );
    
    const totalDeposits = parseFloat(depositResult.total_deposits);
    const totalWithdrawals = parseFloat(withdrawalResult.total_withdrawals);
    const totalProfit = parseFloat(pnlResult.total_profit);
    const totalLoss = parseFloat(pnlResult.total_loss);
    const currentBalance = parseFloat(balanceResult?.balance || 0);
    
    const netDeposits = totalDeposits - totalWithdrawals;
    const tradingPnL = totalProfit - totalLoss;
    const totalReturn = netDeposits > 0 ? ((currentBalance - netDeposits) / netDeposits) * 100 : 0;
    
    return {
      currentBalance,
      totalDeposits,
      totalWithdrawals,
      netDeposits,
      totalProfit,
      totalLoss,
      tradingPnL,
      totalReturn: Math.round(totalReturn * 100) / 100,
      profitFactor: totalLoss > 0 ? Math.round((totalProfit / totalLoss) * 100) / 100 : totalProfit > 0 ? 999 : 0
    };
  }

  /**
   * Calculate net P&L including commission and swap
   * @param {Object} position - Position object
   * @param {number} currentPrice - Current market price
   * @param {Object} symbolInfo - Symbol information
   * @returns {number} Net profit/loss
   */
  static calculateNetPositionPnL(position, currentPrice, symbolInfo) {
    const grossPnL = this.calculatePositionPnL(position, currentPrice, symbolInfo);
    const commission = position.commission || 0;
    const swap = position.swap || 0;
    
    return grossPnL - commission - swap;
  }

  /**
   * Calculate comprehensive position statistics for an account
   * @param {number} accountId - Trading account ID
   * @param {Array} positions - Array of position objects with current prices
   * @returns {Object} Position statistics
   */
  static calculatePositionStatistics(accountId, positions = []) {
    const openPositions = positions.filter(p => p.status === 'open');
    const closedPositions = positions.filter(p => p.status === 'closed');
    
    // Calculate totals
    const totalPositions = positions.length;
    const totalPnL = positions.reduce((sum, p) => sum + (p.profit || 0), 0);
    const totalProfit = positions.filter(p => (p.profit || 0) > 0)
                              .reduce((sum, p) => sum + p.profit, 0);
    const totalLoss = Math.abs(positions.filter(p => (p.profit || 0) < 0)
                                       .reduce((sum, p) => sum + p.profit, 0));
    
    // Calculate performance metrics
    const winningTrades = closedPositions.filter(p => (p.profit || 0) > 0);
    const losingTrades = closedPositions.filter(p => (p.profit || 0) <= 0);
    const winRate = closedPositions.length > 0 ? (winningTrades.length / closedPositions.length) * 100 : 0;
    
    // Calculate averages
    const avgWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;
    const avgTrade = closedPositions.length > 0 ? (totalProfit - totalLoss) / closedPositions.length : 0;
    
    // Calculate costs
    const totalCommission = positions.reduce((sum, p) => sum + (p.commission || 0), 0);
    const totalSwap = positions.reduce((sum, p) => sum + (p.swap || 0), 0);
    
    // Calculate exposure
    const currentExposure = openPositions.reduce((sum, p) => {
      return sum + ((p.lotSize || 0) * (p.currentPrice || p.openPrice || 0));
    }, 0);
    
    const unrealizedPnL = openPositions.reduce((sum, p) => sum + (p.profit || 0), 0);
    
    return {
      totalPositions,
      openPositions: openPositions.length,
      closedPositions: closedPositions.length,
      
      // P&L Statistics
      totalPnL,
      totalProfit,
      totalLoss,
      netProfit: totalPnL - totalCommission - totalSwap,
      
      // Performance Metrics
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      
      // Averages
      avgWin,
      avgLoss,
      avgTrade,
      
      // Risk Metrics
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : (totalProfit > 0 ? 999 : 0),
      
      // Costs
      totalCommission,
      totalSwap,
      
      // Current Exposure
      currentExposure,
      unrealizedPnL
    };
  }

  /**
   * Update position P&L with current market price
   * @param {number} positionId - Position ID
   * @param {number} currentPrice - Current market price
   * @param {number} calculatedPnL - Calculated P&L
   * @returns {Object} Update result
   */
  static async updatePositionPnL(positionId, currentPrice, calculatedPnL) {
    try {
      await executeQuery(
        `UPDATE positions 
         SET current_price = ?, profit = ?, updated_at = NOW() 
         WHERE id = ? AND status = 'open'`,
        [currentPrice, calculatedPnL, positionId]
      );
      
      return {
        success: true,
        positionId,
        currentPrice,
        profit: calculatedPnL
      };
    } catch (error) {
      console.error('Error updating position P&L:', error);
      throw error;
    }
  }
}

module.exports = FundManager;