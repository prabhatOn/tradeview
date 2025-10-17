/* eslint-disable import/no-commonjs */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
const { executeQuery } = require('../config/database');
const IntroducingBrokerService = require('../services/IntroducingBrokerService');
const TradeHistory = require('./TradeHistory');
const TradingAccount = require('./TradingAccount');
const ChargeService = require('../services/ChargeService');

class Position {
  constructor(data) {
    this.id = data.id;
    this.accountId = data.account_id;
    this.symbolId = data.symbol_id;
    this.orderId = data.order_id;
    this.userId = data.user_id;
    this.side = data.side; // 'buy' or 'sell'
    this.lotSize = parseFloat(data.lot_size);
    this.openPrice = parseFloat(data.open_price);
    this.currentPrice = parseFloat(data.current_price) || parseFloat(data.open_price);
    this.closePrice = data.close_price ? parseFloat(data.close_price) : null;
    this.stopLoss = data.stop_loss != null ? parseFloat(data.stop_loss) : null;
    this.takeProfit = data.take_profit != null ? parseFloat(data.take_profit) : null;
    this.commission = parseFloat(data.commission) || 0;
    this.swap = parseFloat(data.swap) || 0;
    this.profit = parseFloat(data.profit) || 0;
    this.status = data.status;
    this.comment = data.comment;
    this.magicNumber = data.magic_number;
    this.openedAt = data.opened_at;
    this.updatedAt = data.updated_at;
    this.closedAt = data.closed_at;
    this.closeTime = data.close_time || data.closed_at;
    this.closeReason = data.close_reason;
    this.contractSize = data.contract_size ? parseFloat(data.contract_size) : this.contractSize;
    this.pipSize = data.pip_size ? parseFloat(data.pip_size) : this.pipSize;
    
    // Additional fields from joins
    this.symbol = data.symbol;
    this.symbolName = data.symbol_name;
    this.accountNumber = data.account_number;
  this.orderType = data.order_type || data.orderType || 'market';
  this.triggerPrice = data.trigger_price != null ? parseFloat(data.trigger_price) : (data.triggerPrice != null ? parseFloat(data.triggerPrice) : null);
  }

  static async findById(positionId) {
    const positions = await executeQuery(
      `SELECT 
        p.*, 
        ta.user_id, 
        ta.account_number, 
        s.symbol, 
        s.name as symbol_name,
        s.contract_size,
        s.pip_size
      FROM positions p
      JOIN trading_accounts ta ON p.account_id = ta.id
      JOIN symbols s ON p.symbol_id = s.id
      WHERE p.id = ?`,
      [positionId]
    );

    if (!positions.length) return null;

    const position = new Position(positions[0]);
    position.contractSize = positions[0].contract_size ? parseFloat(positions[0].contract_size) : position.contractSize;
    position.pipSize = positions[0].pip_size ? parseFloat(positions[0].pip_size) : position.pipSize;
    position.userId = positions[0].user_id;
    return position;
  }

  // Find positions by account ID
  static async findByAccountId(accountId) {
    const positions = await executeQuery(
      `SELECT 
        p.*,
        s.symbol,
        s.name as symbol_name,
        ta.account_number
      FROM positions p
      JOIN symbols s ON p.symbol_id = s.id
      JOIN trading_accounts ta ON p.account_id = ta.id
      WHERE p.account_id = ? AND p.status IN ('open','pending')
      ORDER BY p.opened_at DESC`,
      [accountId]
    );

    return positions.map(position => new Position(position));
  }

  // Find positions by user ID
  static async findByUserId(userId, accountId = null) {
    let sql = `
      SELECT 
        p.*,
        s.symbol,
        s.name as symbol_name,
        ta.account_number
      FROM positions p
      JOIN symbols s ON p.symbol_id = s.id
      JOIN trading_accounts ta ON p.account_id = ta.id
      WHERE p.status IN ('open', 'closed', 'pending') AND ta.user_id = ?
    `;
    
    const params = [userId];
    
    if (accountId) {
      sql += ' AND p.account_id = ?';
      params.push(accountId);
    }
    
    sql += ' ORDER BY p.opened_at DESC';
    
    const positions = await executeQuery(sql, params);
    return positions.map(position => new Position(position));
  }

  // Find position by ID and user ID
  static async findByIdAndUserId(positionId, userId, statusFilter = null) {
    let sql = `SELECT 
        p.*,
        s.symbol,
        s.name as symbol_name,
        s.contract_size,
        s.pip_size,
        ta.account_number
      FROM positions p
      JOIN symbols s ON p.symbol_id = s.id
      JOIN trading_accounts ta ON p.account_id = ta.id
      WHERE p.id = ? AND ta.user_id = ?`;
    
    const params = [positionId, userId];
    
    if (statusFilter) {
      sql += ' AND p.status = ?';
      params.push(statusFilter);
    }

    const positions = await executeQuery(sql, params);

    if (!positions.length) return null;
    
    const position = new Position(positions[0]);
    position.contractSize = parseFloat(positions[0].contract_size);
    position.pipSize = parseFloat(positions[0].pip_size);
    
    return position;
  }

  // Create a new position (open trade)
  static async create(positionData) {
    const {
      accountId,
      symbolId,
      orderId = null,
      side,
      lotSize,
      openPrice,
      stopLoss = null,
      takeProfit = null,
      comment = null,
      magicNumber = null
    } = positionData;

    // Get symbol information for calculations
    const symbolInfo = await executeQuery(
      'SELECT contract_size, pip_size, commission_value FROM symbols WHERE id = ?',
      [symbolId]
    );

    if (!symbolInfo.length) {
      throw new Error('Symbol not found');
    }

    const account = await TradingAccount.findById(accountId);
    if (!account) {
      throw new Error('Trading account not found');
    }

    const chargeProfile = await ChargeService.getChargeProfile({
      symbolId,
      accountType: account.accountType || 'live'
    });

    const computedCommission = ChargeService.calculateCommission(lotSize, chargeProfile);
    const commission = Number(parseFloat(computedCommission.toFixed(4)));

    const result = await executeQuery(
      `INSERT INTO positions (
        account_id, symbol_id, order_id, side, lot_size, open_price,
        stop_loss, take_profit, commission, comment, magic_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [accountId, symbolId, orderId, side, lotSize, openPrice, stopLoss, takeProfit, commission, comment, magicNumber]
    );

    // Note: Trade history recording moved to position closing
    // Position openings are not recorded in trade_history

    // Update account metrics after opening position
    if (commission > 0) {
      const newBalance = account.balance - commission;
      await account.updateBalance(
        newBalance,
        'commission',
        -commission,
        result.insertId,
        'position_open',
        `Commission charged for opening position ${symbolId}`
      );
    }

    await account.refreshAccountMetrics();

    // Get the created position with symbol info
    const createdPosition = await executeQuery(
      `SELECT 
        p.*,
        s.symbol,
        s.name as symbol_name,
        s.contract_size,
        s.pip_size,
        ta.account_number
      FROM positions p
      JOIN symbols s ON p.symbol_id = s.id
      JOIN trading_accounts ta ON p.account_id = ta.id
      WHERE p.id = ?`,
      [result.insertId]
    );

    if (!createdPosition.length) return null;
    
    const position = new Position(createdPosition[0]);
    position.contractSize = parseFloat(createdPosition[0].contract_size);
    position.pipSize = parseFloat(createdPosition[0].pip_size);
    
    return position;
  }

  // Update position's current price and profit
  async updatePrice(newPrice) {
    const profit = this.calculateProfit(newPrice);
    
    await executeQuery(
      `UPDATE positions 
       SET current_price = ?, profit = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newPrice, profit, this.id]
    );

    this.currentPrice = newPrice;
    this.profit = profit;
    this.updatedAt = new Date();

    // Update account metrics
    const account = await TradingAccount.findById(this.accountId);
    if (account) {
      await account.refreshAccountMetrics();
    }
  }

  // Calculate current profit/loss with proper contract size and pip calculations
  calculateProfit(currentPrice = null, symbolInfo = null) {
    const price = currentPrice || this.currentPrice;
    if (!price || price <= 0) return 0;

    const contractSize = symbolInfo?.contract_size || this.contractSize || 100000;
    let pnl = 0;

    if (this.side === 'buy') {
      pnl = (price - this.openPrice) * this.lotSize * contractSize;
    } else {
      pnl = (this.openPrice - price) * this.lotSize * contractSize;
    }

    // Return gross profit (commission and swap handled separately)
    return pnl;
  }

  // Calculate net profit including all costs
  calculateNetProfit(currentPrice = null, symbolInfo = null) {
    const grossProfit = this.calculateProfit(currentPrice, symbolInfo);
    return grossProfit - (this.commission || 0) - (this.swap || 0);
  }

  // Calculate additional position metrics
  calculateMetrics(currentPrice, symbolInfo) {
    const profit = this.calculateProfit(currentPrice);
    const netProfit = profit - (this.commission || 0) - (this.swap || 0);
    const pips = Math.abs((currentPrice - this.openPrice) / (symbolInfo?.pip_size || 0.0001));
    
    return {
      profit,
      netProfit,
      grossProfit: profit > 0 ? profit : 0,
      grossLoss: profit < 0 ? Math.abs(profit) : 0,
      pips,
      pipValue: pips > 0 ? profit / pips : 0
    };
  }

  // Get enhanced position data with real-time calculations
  async getEnhanced() {
    try {
      // Get current market price
      const prices = await executeQuery(
        `SELECT bid, ask FROM market_prices 
         WHERE symbol_id = ? 
         ORDER BY timestamp DESC 
         LIMIT 1`,
        [this.symbolId]
      );

      // Get symbol info
      const symbols = await executeQuery(
        'SELECT symbol, pip_size, contract_size FROM symbols WHERE id = ?',
        [this.symbolId]
      );

      if (prices.length && symbols.length) {
        const currentPrice = this.side === 'buy' ? prices[0].bid : prices[0].ask;
        const metrics = this.calculateMetrics(currentPrice, symbols[0]);
        
        return {
          ...this.toJSON(),
          currentPrice,
          ...metrics
        };
      }

      return this.toJSON();
    } catch (error) {
      console.error('Error getting enhanced position data:', error);
      return this.toJSON();
    }
  }

  // Close position
  async close(closePrice, closeReason = 'manual') {
    const finalProfit = this.calculateProfit(closePrice);
    const commissionCharge = this.commission || 0;
    let ibCommissionResult = null;
    const closedAtDate = new Date();

    const account = await TradingAccount.findById(this.accountId);
    const chargeProfile = await ChargeService.getChargeProfile({
      symbolId: this.symbolId,
      accountType: account?.accountType || 'live'
    });

    const swapComputed = ChargeService.calculateSwap({
      lotSize: this.lotSize,
      side: this.side,
      openedAt: this.openedAt,
      closedAt: closedAtDate,
      profile: chargeProfile
    });

    const swapCharge = Number(parseFloat(swapComputed.toFixed(4)));
    const netProfit = finalProfit - commissionCharge - swapCharge;

    await executeQuery(
      `UPDATE positions 
       SET status = 'closed', current_price = ?, close_price = ?, profit = ?, profit_loss = ?, 
           commission = ?, swap = ?, closed_at = ?, close_time = ?, close_reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [closePrice, closePrice, finalProfit, netProfit, commissionCharge, swapCharge, closedAtDate, closedAtDate, closeReason, this.id]
    );

    let tradeHistoryId = null;
    try {
      tradeHistoryId = await TradeHistory.recordPositionClose({
        accountId: this.accountId,
        symbolId: this.symbolId,
        positionId: this.id,
        side: this.side,
        lotSize: this.lotSize,
        openPrice: this.openPrice,
        closePrice,
        stopLoss: this.stopLoss,
        takeProfit: this.takeProfit,
        commission: commissionCharge,
        swap: swapCharge,
        profit: netProfit,
        closeReason,
        comment: this.comment,
        magicNumber: this.magicNumber,
        openedAt: this.openedAt,
        closedAt: closedAtDate.toISOString()
      });
    } catch (error) {
      console.error('Failed to record trade history for closed position:', error);
    }

    if (account) {
      const newBalance = account.balance + netProfit;
      await account.updateBalance(
        newBalance,
        netProfit >= 0 ? 'trade_profit' : 'trade_loss',
        netProfit,
        this.id,
        'position_close',
        `Position closed: ${this.symbol || this.symbolId} ${this.side} ${this.lotSize} lots`
      );

      try {
        if (tradeHistoryId) {
          ibCommissionResult = await IntroducingBrokerService.processTradeCommission(
            account.userId,
            tradeHistoryId,
            this.id,
            Math.abs(this.lotSize),
            netProfit
          );

          if (ibCommissionResult && global.broadcast) {
            global.broadcast({
              type: 'ib_commission_recorded',
              userId: ibCommissionResult.ibUserId,
              data: {
                commissionId: ibCommissionResult.commissionId,
                tradeId: tradeHistoryId,
                positionId: this.id,
                clientUserId: account.userId,
                commissionAmount: ibCommissionResult.commissionAmount,
                commissionRate: ibCommissionResult.commissionRate,
                tradeVolume: ibCommissionResult.tradeVolume,
                profit: netProfit,
                symbol: this.symbol,
                side: this.side,
                lotSize: this.lotSize,
                closedAt: closedAtDate.toISOString()
              }
            });
          }
        }
      } catch (error) {
        console.error('Failed to process IB commission:', error);
      }

      await account.refreshAccountMetrics();
    }

    this.status = 'closed';
    this.currentPrice = closePrice;
    this.closePrice = closePrice;
    this.profit = finalProfit;
    this.swap = swapCharge;
    this.closedAt = closedAtDate.toISOString();
    this.closeTime = this.closedAt;
    this.closeReason = closeReason;

    return {
      positionId: this.id,
      closePrice,
      finalProfit,
      netProfit,
      commission: commissionCharge,
      swap: swapCharge,
      closeReason,
      tradeHistoryId,
      ibCommission: ibCommissionResult
    };
  }

  // Update stop loss
  async updateStopLoss(newStopLoss) {
    await executeQuery(
      'UPDATE positions SET stop_loss = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStopLoss, this.id]
    );
    
    this.stopLoss = newStopLoss;
    this.updatedAt = new Date();
  }

  // Update take profit
  async updateTakeProfit(newTakeProfit) {
    await executeQuery(
      'UPDATE positions SET take_profit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newTakeProfit, this.id]
    );
    
    this.takeProfit = newTakeProfit;
    this.updatedAt = new Date();
  }

  // Check if position should be closed due to stop loss or take profit
  shouldAutoClose(currentPrice) {
    if (this.stopLoss && 
        ((this.side === 'buy' && currentPrice <= this.stopLoss) ||
         (this.side === 'sell' && currentPrice >= this.stopLoss))) {
      return 'stop_loss';
    }

    if (this.takeProfit && 
        ((this.side === 'buy' && currentPrice >= this.takeProfit) ||
         (this.side === 'sell' && currentPrice <= this.takeProfit))) {
      return 'take_profit';
    }

    return null;
  }

  // Convert to JSON for API responses with both backend and frontend field compatibility
  toJSON() {
    return {
      // Core identification
      id: this.id,
      accountId: this.accountId,
      symbolId: this.symbolId,
      orderId: this.orderId,
  userId: this.userId,
      
      // Symbol information
      symbol: this.symbol,
      symbolName: this.symbolName,
      
      // Position details
      side: this.side,
      positionType: this.side, // Frontend compatibility
      
      // Volume/Lot size (both names for compatibility)
      lotSize: this.lotSize,
      volume: this.lotSize, // Frontend compatibility
      
      // Pricing
      openPrice: this.openPrice,
      currentPrice: this.currentPrice,
      closePrice: this.closePrice,
      stopLoss: this.stopLoss,
      takeProfit: this.takeProfit,
      
      // P&L and costs
      profit: this.profit,
      unrealizedPnl: this.profit, // Frontend compatibility
      profitLoss: this.profit, // Legacy compatibility
      commission: this.commission || 0,
      swap: this.swap || 0,
      
  // Status and metadata
      status: this.status,
  orderType: this.orderType,
  triggerPrice: this.triggerPrice,
      comment: this.comment,
      magicNumber: this.magicNumber,
      accountNumber: this.accountNumber,
      
      // Timestamps (both formats for compatibility)
      openedAt: this.openedAt,
      updatedAt: this.updatedAt,
      closedAt: this.closedAt,
      closeReason: this.closeReason,
      openTime: this.openedAt, // Frontend compatibility
  closeTime: this.closeTime || this.closedAt, // Frontend compatibility
      
      // Additional calculated fields
      netProfit: this.calculateNetProfit(),
      grossProfit: this.profit > 0 ? this.profit : 0,
      grossLoss: this.profit < 0 ? Math.abs(this.profit) : 0
    };
  }
}

module.exports = Position;