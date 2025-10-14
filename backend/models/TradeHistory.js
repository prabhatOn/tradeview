/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const { executeQuery } = require('../config/database');

class TradeHistory {
  constructor(data) {
    this.id = data.id;
    this.accountId = data.account_id;
    this.symbolId = data.symbol_id;
    this.positionId = data.position_id;
    this.side = data.side;
    this.lotSize = parseFloat(data.lot_size);
    this.openPrice = parseFloat(data.open_price);
    this.closePrice = parseFloat(data.close_price);
    this.stopLoss = data.stop_loss ? parseFloat(data.stop_loss) : null;
    this.takeProfit = data.take_profit ? parseFloat(data.take_profit) : null;
    this.commission = parseFloat(data.commission) || 0;
    this.swap = parseFloat(data.swap) || 0;
    this.profit = parseFloat(data.profit);
    this.closeReason = data.close_reason;
    this.openedAt = data.opened_at;
    this.closedAt = data.closed_at;
    
    // Additional fields from joins
    this.symbol = data.symbol;
    this.symbolName = data.symbol_name;
    this.accountNumber = data.account_number;
    
    // Calculated fields
    this.durationMinutes = data.duration_minutes;
    this.pips = this.calculatePips();
  }

  // Find trade history by account ID
  static async findByAccountId(accountId, limit = 50, offset = 0) {
    const trades = await executeQuery(
      `SELECT 
        th.*,
        s.symbol,
        s.name as symbol_name,
        s.pip_size,
        ta.account_number,
        TIMESTAMPDIFF(MINUTE, th.opened_at, th.closed_at) as duration_minutes
      FROM trade_history th
      JOIN symbols s ON th.symbol_id = s.id
      JOIN trading_accounts ta ON th.account_id = ta.id
      WHERE th.account_id = ?
      ORDER BY th.closed_at DESC
      LIMIT ? OFFSET ?`,
      [accountId, limit, offset]
    );

    return trades.map(trade => {
      const tradeHistory = new TradeHistory(trade);
      tradeHistory.pipSize = parseFloat(trade.pip_size);
      return tradeHistory;
    });
  }

  // Find trade history by user ID
  static async findByUserId(userId, accountId = null, limit = 50, offset = 0) {
    let sql = `
      SELECT 
        th.*,
        s.symbol,
        s.name as symbol_name,
        s.pip_size,
        ta.account_number,
        TIMESTAMPDIFF(MINUTE, th.opened_at, th.closed_at) as duration_minutes
      FROM trade_history th
      JOIN symbols s ON th.symbol_id = s.id
      JOIN trading_accounts ta ON th.account_id = ta.id
      WHERE ta.user_id = ?
    `;
    
    const params = [userId];
    
    if (accountId) {
      sql += ' AND th.account_id = ?';
      params.push(accountId);
    }
    
    sql += ' ORDER BY COALESCE(th.closed_at, th.created_at) DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const trades = await executeQuery(sql, params);
    
    return trades.map(trade => {
      const tradeHistory = new TradeHistory(trade);
      tradeHistory.pipSize = parseFloat(trade.pip_size);
      return tradeHistory;
    });
  }

  // Get trade statistics for an account
  static async getStatistics(accountId, period = '30 DAYS') {
    const stats = await executeQuery(
      `SELECT 
        COUNT(*) as total_trades,
        COUNT(CASE WHEN profit > 0 THEN 1 END) as winning_trades,
        COUNT(CASE WHEN profit < 0 THEN 1 END) as losing_trades,
        SUM(profit) as total_profit,
        AVG(profit) as average_profit,
        MAX(profit) as best_trade,
        MIN(profit) as worst_trade,
        SUM(CASE WHEN profit > 0 THEN profit ELSE 0 END) as gross_profit,
        SUM(CASE WHEN profit < 0 THEN ABS(profit) ELSE 0 END) as gross_loss,
        AVG(TIMESTAMPDIFF(MINUTE, opened_at, closed_at)) as average_duration_minutes
      FROM trade_history 
      WHERE account_id = ? 
      AND closed_at >= DATE_SUB(NOW(), INTERVAL ${period})`,
      [accountId]
    );

    const result = stats[0];
    const winRate = result.total_trades > 0 ? (result.winning_trades / result.total_trades) * 100 : 0;
    const profitFactor = result.gross_loss > 0 ? result.gross_profit / result.gross_loss : 0;

    return {
      totalTrades: parseInt(result.total_trades),
      winningTrades: parseInt(result.winning_trades),
      losingTrades: parseInt(result.losing_trades),
      winRate: parseFloat(winRate.toFixed(2)),
      totalProfit: parseFloat(result.total_profit) || 0,
      averageProfit: parseFloat(result.average_profit) || 0,
      bestTrade: parseFloat(result.best_trade) || 0,
      worstTrade: parseFloat(result.worst_trade) || 0,
      grossProfit: parseFloat(result.gross_profit) || 0,
      grossLoss: parseFloat(result.gross_loss) || 0,
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      averageDurationMinutes: parseFloat(result.average_duration_minutes) || 0
    };
  }

  // Get daily profit/loss for a period
  static async getDailyPnL(accountId, days = 30) {
    const dailyPnL = await executeQuery(
      `SELECT 
        DATE(closed_at) as trade_date,
        SUM(profit) as daily_profit,
        COUNT(*) as trades_count
      FROM trade_history 
      WHERE account_id = ? 
      AND closed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(closed_at)
      ORDER BY trade_date DESC`,
      [accountId, days]
    );

    return dailyPnL.map(day => ({
      date: day.trade_date,
      profit: parseFloat(day.daily_profit),
      tradesCount: parseInt(day.trades_count)
    }));
  }

  // Create trade history entry
  static async create(tradeData) {
    const {
      accountId,
      symbolId,
      positionId = null,
      side,
      lotSize,
      openPrice,
      closePrice,
      stopLoss = null,
      takeProfit = null,
      commission = 0,
      swap = 0,
      profit,
      closeReason = 'manual',
      comment = null,
      magicNumber = null,
      openedAt,
      closedAt = new Date()
    } = tradeData;

    const result = await executeQuery(
      `INSERT INTO trade_history (
        account_id, symbol_id, position_id,
        side, lot_size, open_price, close_price,
        stop_loss, take_profit, commission, swap, profit,
        close_reason, comment, magic_number, opened_at, closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        accountId, symbolId, positionId, side, lotSize,
        openPrice, closePrice, stopLoss, takeProfit,
        commission, swap, profit, closeReason, comment,
        magicNumber, openedAt, closedAt
      ]
    );

    console.log(`📝 Trade history recorded: ${side.toUpperCase()} ${lotSize} lots, P&L: $${profit}, Reason: ${closeReason}`);
    return result.insertId;
  }

  // Record position opening (buy/sell action)
  static async recordPositionOpen(positionData) {
    const {
      accountId,
      symbolId,
      positionId,
      side,
      lotSize,
      openPrice,
      stopLoss,
      takeProfit,
      commission,
      comment,
      magicNumber,
      openedAt
    } = positionData;

    // For position opening, we record it as "position_opened" 
    return await this.create({
      accountId,
      symbolId,
      positionId,
      side,
      lotSize,
      openPrice,
      closePrice: openPrice, // Same as open price initially
      stopLoss,
      takeProfit,
      commission,
      swap: 0,
      profit: -commission, // Initial loss due to commission
      closeReason: 'position_opened', // Special status for tracking opens
      comment: comment ? `OPENED: ${comment}` : `OPENED: ${side.toUpperCase()} position`,
      magicNumber,
      openedAt,
      closedAt: openedAt // Set same as opened for tracking
    });
  }

  // Record position closing
  static async recordPositionClose(closeData) {
    const {
      accountId,
      symbolId,
      positionId,
      side,
      lotSize,
      openPrice,
      closePrice,
      stopLoss,
      takeProfit,
      commission,
      swap,
      profit,
      closeReason,
      comment,
      magicNumber,
      openedAt,
      closedAt
    } = closeData;

    return await this.create({
      accountId,
      symbolId,
      positionId,
      side,
      lotSize,
      openPrice,
      closePrice,
      stopLoss,
      takeProfit,
      commission,
      swap,
      profit,
      closeReason,
      comment: comment ? `CLOSED: ${comment}` : `CLOSED: ${closeReason}`,
      magicNumber,
      openedAt,
      closedAt
    });
  }

  // Get all trading activities (including opens and closes)
  static async getAllActivities(accountId, limit = 100, offset = 0) {
    const activities = await executeQuery(
      `SELECT 
        th.*,
        s.symbol,
        s.name as symbol_name,
        s.pip_size,
        ta.account_number,
        TIMESTAMPDIFF(MINUTE, th.opened_at, th.closed_at) as duration_minutes,
        CASE 
          WHEN th.close_reason = 'position_opened' THEN 'OPEN'
          ELSE 'CLOSE'
        END as activity_type
      FROM trade_history th
      JOIN symbols s ON th.symbol_id = s.id
      JOIN trading_accounts ta ON th.account_id = ta.id
      WHERE th.account_id = ?
      ORDER BY th.closed_at DESC, th.id DESC
      LIMIT ? OFFSET ?`,
      [accountId, limit, offset]
    );

    return activities.map(activity => new TradeHistory(activity));
  }

  // Calculate pips gained/lost
  calculatePips() {
    if (!this.pipSize) return 0;
    
    const priceDiff = this.side === 'buy' 
      ? this.closePrice - this.openPrice
      : this.openPrice - this.closePrice;
    
    return parseFloat((priceDiff / this.pipSize).toFixed(1));
  }

  // Format duration as human readable
  getFormattedDuration() {
    if (!this.durationMinutes) return '0m';
    
    const hours = Math.floor(this.durationMinutes / 60);
    const minutes = this.durationMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // Convert to JSON for API responses
  toJSON() {
    return {
      id: this.id,
      accountId: this.accountId,
      symbolId: this.symbolId,
      positionId: this.positionId,
      symbol: this.symbol,
      symbolName: this.symbolName,
      side: this.side,
      lotSize: this.lotSize,
      openPrice: this.openPrice,
      closePrice: this.closePrice,
      stopLoss: this.stopLoss,
      takeProfit: this.takeProfit,
      commission: this.commission,
      swap: this.swap,
      profit: this.profit,
      pips: this.pips,
      closeReason: this.closeReason,
      durationMinutes: this.durationMinutes,
      formattedDuration: this.getFormattedDuration(),
      accountNumber: this.accountNumber,
      openedAt: this.openedAt,
      closedAt: this.closedAt
    };
  }

  // Get trade history by account ID with filtering and pagination
  static async getByAccountId(accountId, options = {}) {
    try {
      const { page = 1, limit = 50, type, symbol } = options;
      const offset = (page - 1) * limit;

      // Ensure accountId is an integer
      const intAccountId = parseInt(accountId);
      const intLimit = parseInt(limit);
      const intOffset = parseInt(offset);

      console.log('TradeHistory.getByAccountId - Input:', {
        accountId,
        intAccountId,
        page,
        limit: intLimit,
        offset: intOffset,
        type,
        symbol
      });

      // First, let's try a simple query to see if the table exists and has data
      const testQuery = 'SELECT COUNT(*) as count FROM trade_history WHERE account_id = ?';
      console.log('Testing simple query:', testQuery, 'with param:', intAccountId);
      
      const testResult = await executeQuery(testQuery, [intAccountId]);
      console.log('Test query result:', testResult);

      // If that works, let's try the more complex query
      let whereClause = 'WHERE th.account_id = ?';
      let params = [intAccountId];

      if (type) {
        if (type === 'open') {
          whereClause += ' AND th.close_price IS NULL';
        } else if (type === 'closed') {
          whereClause += ' AND th.close_price IS NOT NULL';
        }
      }

      if (symbol) {
        whereClause += ' AND s.symbol = ?';
        params.push(symbol);
      }

      // Use string interpolation for LIMIT and OFFSET as MySQL doesn't handle them well as parameters
      const simpleQuery = `
        SELECT 
          th.id,
          th.account_id,
          th.symbol_id,
          th.side,
          th.lot_size,
          th.open_price,
          th.close_price,
          th.profit,
          th.opened_at,
          th.closed_at,
          s.symbol,
          s.name as symbol_name,
          TIMESTAMPDIFF(MINUTE, th.opened_at, th.closed_at) as duration_minutes
        FROM trade_history th
        LEFT JOIN symbols s ON th.symbol_id = s.id
        ${whereClause}
        ORDER BY th.opened_at DESC
        LIMIT ${intLimit} OFFSET ${intOffset}
      `;
      
      console.log('TradeHistory.getByAccountId - Simple Query:', simpleQuery);
      console.log('TradeHistory.getByAccountId - Params:', params);
      
      const results = await executeQuery(simpleQuery, params);

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM trade_history th
        LEFT JOIN symbols s ON th.symbol_id = s.id
        ${whereClause}
      `;
      const countResult = await executeQuery(countQuery, params);
      const total = countResult[0].total;

      return {
        trades: results.map(row => ({
          id: row.id,
          symbol: row.symbol,
          side: row.side,
          lotSize: parseFloat(row.lot_size),
          openPrice: parseFloat(row.open_price),
          closePrice: row.close_price ? parseFloat(row.close_price) : null,
          profit: parseFloat(row.profit),
          openedAt: row.opened_at,
          closedAt: row.closed_at
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('TradeHistory.getByAccountId error:', error);
      throw error;
    }
  }

  // Get all trading activities (comprehensive view)
  static async getAllActivities(accountId, options = {}) {
    const { page = 1, limit = 100 } = options;
    const offset = (page - 1) * limit;

    // Combine trade history and account transactions for complete activity view
    const query = `
      (
        SELECT 
          'trade' as activity_type,
          th.id,
          th.created_at,
          s.symbol,
          CASE 
            WHEN th.close_price IS NULL THEN CONCAT('Opened ', th.side, ' position: ', th.lot_size, ' lots')
            ELSE CONCAT('Closed ', th.side, ' position: ', th.lot_size, ' lots')
          END as description,
          th.profit,
          th.side,
          th.lot_size,
          th.open_price,
          th.close_price,
          th.position_id
        FROM trade_history th
        LEFT JOIN symbols s ON th.symbol_id = s.id
        WHERE th.account_id = ?
      )
      UNION ALL
      (
        SELECT 
          'transaction' as activity_type,
          at.id,
          at.created_at,
          NULL as symbol,
          CONCAT(at.transaction_type, ': ', at.description) as description,
          at.amount as profit,
          NULL as side,
          NULL as lot_size,
          NULL as open_price,
          NULL as close_price,
          at.reference_id as position_id
        FROM account_transactions at
        WHERE at.account_id = ?
      )
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const results = await executeQuery(query, [accountId, accountId, limit, offset]);

    // Get total count
    const countQuery = `
      SELECT 
        (SELECT COUNT(*) FROM trade_history WHERE account_id = ?) +
        (SELECT COUNT(*) FROM account_transactions WHERE account_id = ?) as total
    `;
    const countResult = await executeQuery(countQuery, [accountId, accountId]);
    const total = countResult[0].total;

    return {
      activities: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Get trading statistics for account
  static async getStatistics(accountId) {
    const query = `
      SELECT 
        COUNT(*) as total_trades,
        COUNT(CASE WHEN close_price IS NOT NULL THEN 1 END) as closed_trades,
        COUNT(CASE WHEN close_price IS NULL THEN 1 END) as open_positions,
        COUNT(CASE WHEN profit > 0 THEN 1 END) as winning_trades,
        COUNT(CASE WHEN profit < 0 THEN 1 END) as losing_trades,
        COALESCE(SUM(profit), 0) as total_profit,
        COALESCE(AVG(profit), 0) as average_profit,
        COALESCE(MAX(profit), 0) as best_trade,
        COALESCE(MIN(profit), 0) as worst_trade,
        COALESCE(SUM(lot_size), 0) as total_volume,
        COUNT(DISTINCT symbol_id) as symbols_traded
      FROM trade_history 
      WHERE account_id = ?
    `;

    const results = await executeQuery(query, [accountId]);
    const stats = results[0];

    // Calculate additional metrics
    const winRate = stats.closed_trades > 0 ? (stats.winning_trades / stats.closed_trades) * 100 : 0;
    const profitFactor = stats.losing_trades > 0 ? Math.abs(stats.total_profit / (stats.worst_trade * stats.losing_trades)) : 0;

    return {
      totalTrades: stats.total_trades || 0,
      closedTrades: stats.closed_trades || 0,
      openPositions: stats.open_positions || 0,
      winningTrades: stats.winning_trades || 0,
      losingTrades: stats.losing_trades || 0,
      winRate: parseFloat(winRate.toFixed(2)),
      totalProfit: parseFloat((stats.total_profit || 0).toString()),
      averageProfit: parseFloat((stats.average_profit || 0).toString()),
      bestTrade: parseFloat((stats.best_trade || 0).toString()),
      worstTrade: parseFloat((stats.worst_trade || 0).toString()),
      totalVolume: parseFloat((stats.total_volume || 0).toString()),
      symbolsTraded: stats.symbols_traded || 0,
      profitFactor: parseFloat(profitFactor.toFixed(2))
    };
  }
}

module.exports = TradeHistory;