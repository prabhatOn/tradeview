/**
 * Margin Service
 * Handles margin calculations, monitoring, and risk management
 */

const { executeQuery } = require('../config/database');
const NotificationService = require('./NotificationService');
const TradingService = require('./TradingService');

class MarginService {
  /**
   * Calculate required margin for opening a position
   * Formula: Margin = (Lot Size × Contract Size × Price) / Leverage
   * @param {number} lotSize - Position size in lots
   * @param {number} price - Market price
   * @param {number} contractSize - Contract size for the symbol
   * @param {number} leverage - Account leverage
   * @returns {number} Required margin
   */
  static calculateRequiredMargin(lotSize, price, contractSize, leverage) {
    const notionalValue = lotSize * contractSize * price;
    return notionalValue / leverage;
  }

  /**
   * Check if account has sufficient free margin
   * @param {number} accountId - Trading account ID
   * @param {number} requiredMargin - Margin needed for trade
   * @returns {Promise<boolean>} True if sufficient margin available
   */
  static async checkSufficientMargin(accountId, requiredMargin) {
    const [account] = await executeQuery(
      'SELECT balance, margin_used, equity FROM trading_accounts WHERE id = ?',
      [accountId]
    );

    if (!account) {
      throw new Error('Account not found');
    }

    const freeMargin = account.equity - account.margin_used;
    return freeMargin >= requiredMargin;
  }

  /**
   * Calculate margin level
   * Formula: Margin Level = (Equity / Margin Used) × 100
   * @param {number} equity - Account equity
   * @param {number} marginUsed - Total margin in use
   * @returns {number} Margin level percentage
   */
  static calculateMarginLevel(equity, marginUsed) {
    if (marginUsed === 0 || marginUsed === null) return 0;
    return (equity / marginUsed) * 100;
  }

  /**
   * Update account margin metrics
   * @param {number} accountId - Trading account ID
   * @returns {Promise<Object>} Updated margin metrics
   */
  static async updateAccountMarginMetrics(accountId) {
    // Get all open positions
    const openPositions = await executeQuery(`
      SELECT SUM(margin_required) as total_margin
      FROM positions
      WHERE account_id = ? AND status = 'open'
    `, [accountId]);

    const marginUsed = openPositions[0]?.total_margin || 0;

    // Get unrealized P&L
    const pnlResult = await executeQuery(`
      SELECT SUM(profit) as unrealized_pnl
      FROM positions
      WHERE account_id = ? AND status = 'open'
    `, [accountId]);

    const unrealizedPnL = pnlResult[0]?.unrealized_pnl || 0;

    // Get account balance
    const [account] = await executeQuery(
      'SELECT balance, leverage FROM trading_accounts WHERE id = ?',
      [accountId]
    );

    if (!account) {
      throw new Error('Account not found');
    }

    // Calculate metrics
    const equity = parseFloat(account.balance) + parseFloat(unrealizedPnL);
    const freeMargin = equity - marginUsed;
    const marginLevel = this.calculateMarginLevel(equity, marginUsed);
    const tradingPower = parseFloat(account.balance) * parseFloat(account.leverage);

    // Update database
    await executeQuery(`
      UPDATE trading_accounts
      SET margin_used = ?,
          used_margin = ?,
          equity = ?,
          free_margin = ?,
          margin_level = ?,
          trading_power = ?,
          updated_at = NOW()
      WHERE id = ?
    `, [marginUsed, marginUsed, equity, freeMargin, marginLevel, tradingPower, accountId]);

    return {
      marginUsed,
      equity,
      freeMargin,
      marginLevel,
      tradingPower
    };
  }

  /**
   * Check for auto square-off conditions only
   * @param {number} accountId - Trading account ID
   * @returns {Promise<Object>} Margin status and actions taken
   */
  static async checkMarginCall(accountId) {
    const metrics = await this.updateAccountMarginMetrics(accountId);

    // Fetch account settings for auto-square-off
    const [account] = await executeQuery(
      'SELECT user_id, balance, auto_square_percent FROM trading_accounts WHERE id = ?',
      [accountId]
    );

    if (!account) {
      throw new Error('Account not found');
    }

    const result = {
      marginLevel: metrics.marginLevel,
      status: 'safe',
      action: null
    };

    // Auto square-off: if account has auto_square_percent set, and equity falls to or below
    // (balance * auto_square_percent / 100), then attempt to automatically square off (close)
    // positions to protect remaining funds. This is a configurable admin-set percentage.
    if (account.auto_square_percent != null && Number.isFinite(account.balance)) {
      const threshold = parseFloat(account.balance) * (parseFloat(account.auto_square_percent) / 100);
      if (metrics.equity <= threshold && metrics.marginUsed > 0) {
        result.status = 'auto_square_off';
        result.action = await this.triggerAutoSquareOff(accountId, metrics, account);
        return result;
      }
    }

    return result;
  }

  /**
   * Trigger margin call warning
   * @param {number} accountId - Trading account ID
   * @param {Object} metrics - Current margin metrics
   * @param {Object} account - Account details
   * @returns {Promise<Object>} Margin call event details
   */
  static async triggerMarginCall(accountId, metrics, account) {
    // Log margin call event
    const [result] = await executeQuery(`
      INSERT INTO margin_events 
      (account_id, event_type, margin_level, equity, margin_used, free_margin)
      VALUES (?, 'margin_call', ?, ?, ?, ?)
    `, [accountId, metrics.marginLevel, metrics.equity, metrics.marginUsed, metrics.freeMargin]);

    // Send notification (if NotificationService exists)
    try {
      if (NotificationService && NotificationService.sendMarginCallWarning) {
        await NotificationService.sendMarginCallWarning(account.user_id, {
          accountId,
          marginLevel: metrics.marginLevel,
          equity: metrics.equity,
          marginUsed: metrics.marginUsed
        });
      }
    } catch (error) {
      console.error('Failed to send margin call notification:', error);
    }

    return {
      eventId: result.insertId,
      type: 'margin_call',
      marginLevel: metrics.marginLevel
    };
  }

  /**
   * Execute stop out - close positions automatically
   * @param {number} accountId - Trading account ID
   * @param {Object} metrics - Current margin metrics
   * @param {Object} account - Account details
   * @returns {Promise<Object>} Stop out event details
   */
  static async triggerStopOut(accountId, metrics, account) {
    // Get all open positions sorted by loss (biggest loss first)
    const positions = await executeQuery(`
      SELECT id, profit, symbol_id
      FROM positions
      WHERE account_id = ? AND status = 'open'
      ORDER BY profit ASC
    `, [accountId]);

    let closedPositions = 0;
    let totalLoss = 0;
    const closedPositionIds = [];

    // Close positions until margin level is above stop out level
    for (const position of positions) {
      if (metrics.marginLevel >= account.stop_out_level) break;

      // Close position
      await executeQuery(`
        UPDATE positions
        SET status = 'closed',
            close_reason = 'margin_call',
            closed_at = NOW(),
            close_time = NOW()
        WHERE id = ?
      `, [position.id]);

      closedPositions++;
      totalLoss += parseFloat(position.profit);
      closedPositionIds.push(position.id);

      // Recalculate margin metrics after closing position
      metrics = await this.updateAccountMarginMetrics(accountId);
    }

    // Log stop out event
    const [result] = await executeQuery(`
      INSERT INTO margin_events 
      (account_id, event_type, margin_level, equity, margin_used, free_margin, positions_closed, total_loss)
      VALUES (?, 'stop_out', ?, ?, ?, ?, ?, ?)
    `, [accountId, metrics.marginLevel, metrics.equity, metrics.marginUsed, metrics.freeMargin, closedPositions, totalLoss]);

    // Send notification
    try {
      if (NotificationService && NotificationService.sendStopOutNotification) {
        await NotificationService.sendStopOutNotification(account.user_id, {
          accountId,
          marginLevel: metrics.marginLevel,
          positionsClosed: closedPositions,
          totalLoss
        });
      }
    } catch (error) {
      console.error('Failed to send stop out notification:', error);
    }

    return {
      eventId: result.insertId,
      type: 'stop_out',
      marginLevel: metrics.marginLevel,
      positionsClosed: closedPositions,
      totalLoss,
      closedPositionIds
    };
  }

  /**
   * Trigger automatic square-off based on admin-configured percentage
   * Closes losing positions first until equity is above the configured threshold
   */
  static async triggerAutoSquareOff(accountId, metrics, account) {

    // New behavior: immediately close ALL open positions for the account (regardless of profit/loss)
    // Fetch all open positions
    const positions = await executeQuery(`
      SELECT id, profit, symbol_id
      FROM positions
      WHERE account_id = ? AND status = 'open'
    `, [accountId]);

    let closedPositions = 0;
    let totalLoss = 0;
    const closedPositionIds = [];

    // Close every position using TradingService.closePosition to ensure history/balance updates
    const [acctInfo] = await executeQuery('SELECT user_id FROM trading_accounts WHERE id = ?', [accountId]);
    const accountUserId = acctInfo?.user_id || account.user_id || account.userId || null;

    for (const position of positions) {
      try {
        await TradingService.closePosition(accountUserId, position.id);
        closedPositions++;
        totalLoss += parseFloat(position.profit || 0);
        closedPositionIds.push(position.id);
      } catch (error) {
        console.error(`Failed to auto-close position ${position.id} during auto-square-off:`, error);
      }
    }

    // Recalculate metrics one final time after all closes
    metrics = await this.updateAccountMarginMetrics(accountId);

    // Log auto square-off event with final metrics
    const [result] = await executeQuery(`
      INSERT INTO margin_events 
      (account_id, event_type, margin_level, equity, margin_used, free_margin, positions_closed, total_loss)
      VALUES (?, 'auto_square_off', ?, ?, ?, ?, ?, ?)
    `, [accountId, metrics.marginLevel, metrics.equity, metrics.marginUsed, metrics.freeMargin, closedPositions, totalLoss]);

    // Optionally notify user
    try {
      if (NotificationService && NotificationService.sendStopOutNotification) {
        await NotificationService.sendStopOutNotification(account.user_id, {
          accountId,
          marginLevel: metrics.marginLevel,
          positionsClosed: closedPositions,
          totalLoss
        });
      }
    } catch (error) {
      console.error('Failed to send auto-square-off notification:', error);
    }

    return {
      eventId: result.insertId,
      type: 'auto_square_off',
      marginLevel: metrics.marginLevel,
      positionsClosed: closedPositions,
      totalLoss,
      closedPositionIds
    };
  }

  /**
   * Calculate free margin
   * @param {number} equity - Account equity
   * @param {number} marginUsed - Margin in use
   * @returns {number} Free margin available
   */
  static calculateFreeMargin(equity, marginUsed) {
    return equity - marginUsed;
  }

  /**
   * Check if account can open new position
   * @param {number} accountId - Trading account ID
   * @param {number} requiredMargin - Margin needed for new position
   * @returns {Promise<Object>} {allowed: boolean, reason: string}
   */
  static async canOpenPosition(accountId, requiredMargin) {
    const metrics = await this.updateAccountMarginMetrics(accountId);

    if (metrics.freeMargin < requiredMargin) {
      return {
        allowed: false,
        reason: `Insufficient free margin. Required: $${requiredMargin.toFixed(2)}, Available: $${metrics.freeMargin.toFixed(2)}`
      };
    }

    // Check if margin level would remain safe
    const newMarginUsed = metrics.marginUsed + requiredMargin;
    const newMarginLevel = this.calculateMarginLevel(metrics.equity, newMarginUsed);

    if (newMarginLevel < 100) {
      return {
        allowed: false,
        reason: `Opening this position would bring margin level to ${newMarginLevel.toFixed(2)}% which is below 100%`
      };
    }

    return {
      allowed: true,
      reason: 'Sufficient margin available'
    };
  }

  /**
   * Force close all open positions for an account (regardless of profit or loss)
   * Intended for admin immediate action. Records a margin_event 'force_close_all'.
   * @param {number} accountId
   * @param {number} initiatedBy - optional user/admin id who initiated
   */
  static async forceCloseAllPositions(accountId, initiatedBy = null) {
    // Get all open positions for account
    const positions = await executeQuery(`
      SELECT id, profit, symbol_id
      FROM positions
      WHERE account_id = ? AND status = 'open'
      ORDER BY opened_at ASC
    `, [accountId]);

    let closedPositions = 0;
    let totalPnl = 0;
    const closedPositionIds = [];

    // fetch account user id for close operations
    const [acctInfo] = await executeQuery('SELECT user_id FROM trading_accounts WHERE id = ?', [accountId]);
    const accountUserId = acctInfo?.user_id || null;

    for (const position of positions) {
      try {
        // Use TradingService.closePosition to ensure trade history and balance updates occur
        await TradingService.closePosition(accountUserId, position.id);

        closedPositions++;
        totalPnl += parseFloat(position.profit || 0);
        closedPositionIds.push(position.id);

        // Recalculate metrics after each close to keep trading account consistent
        await this.updateAccountMarginMetrics(accountId);
      } catch (error) {
        console.error(`Failed to force-close position ${position.id}:`, error);
        // continue with other positions
      }
    }

    // Log force-close event
    const [result] = await executeQuery(`
      INSERT INTO margin_events
      (account_id, event_type, margin_level, equity, margin_used, free_margin, positions_closed, total_loss, initiated_by)
      VALUES (?, 'force_close_all', ?, ?, ?, ?, ?, ?, ?)
    `, [accountId, 0, 0, 0, 0, closedPositions, totalPnl, initiatedBy]);

    try {
      const [acct] = await executeQuery('SELECT user_id FROM trading_accounts WHERE id = ?', [accountId]);
      if (acct && NotificationService && NotificationService.sendStopOutNotification) {
        await NotificationService.sendStopOutNotification(acct.user_id, {
          accountId,
          positionsClosed: closedPositions,
          totalPnl
        });
      }
    } catch (err) {
      console.error('Failed to notify user for forceCloseAllPositions:', err);
    }

    return {
      eventId: result?.insertId || null,
      positionsClosed: closedPositions,
      totalPnl,
      closedPositionIds
    };
  }
}

module.exports = MarginService;

