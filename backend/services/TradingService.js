/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const { executeQuery } = require('../config/database');
const NotificationService = require('./NotificationService');
const Position = require('../models/Position');
const TradingAccount = require('../models/TradingAccount');
const TradeHistory = require('../models/TradeHistory');
const IntroducingBrokerService = require('./IntroducingBrokerService');

class TradingService {
  // Update all positions for a symbol with new market prices
  static async updatePositionPrices(symbolId, bid, ask) {
    try {
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
          
          // Send notification about auto-close
          await NotificationService.sendPositionNotification(
            positionData.user_id,
            position.id,
            'closed',
            {
              message: `Position auto-closed due to ${closeReason.replace('_', ' ')}`,
              symbol: position.symbol,
              closePrice,
              profit: position.profit,
              closeReason
            }
          );
        }
      });

      await Promise.all(updatePromises);
      
      return {
        updatedPositions: positions.length,
        symbolId
      };
    } catch (error) {
      console.error('Error updating position prices:', error);
      throw error;
    }
  }

  // Calculate position metrics
  static calculatePositionMetrics(position, currentPrice) {
    const { side, open_price, lot_size } = position;
    const isLong = side === 'buy';
    
    // Calculate P&L (simplified calculation)
    let pnl = 0;
    if (isLong) {
      pnl = (currentPrice - open_price) * lot_size * 10000; // Using pip value approximation
    } else {
      pnl = (open_price - currentPrice) * lot_size * 10000;
    }
    
    // Calculate percentage return
    const pnlPercentage = (pnl / (open_price * lot_size * 10000)) * 100;
    
    return {
      unrealizedPnl: pnl,
      pnlPercentage,
      currentPrice
    };
  }

  // Open new position
  static async openPosition(userId, accountId, symbolId, positionType, volume, leverage, stopLoss = null, takeProfit = null) {
    try {
      // Get current market price
      const marketData = await executeQuery(`
        SELECT current_price FROM market_data WHERE symbol_id = ? AND date = CURDATE()
      `, [symbolId]);

      if (!marketData.length) {
        throw new Error('Market data not available');
      }

      const openPrice = marketData[0].current_price;
      
      // Calculate margin required
      const marginRequired = (openPrice * volume) / leverage;
      
      // Check available margin (use used_margin as the canonical column)
      const account = await executeQuery(`
        SELECT balance, margin_used FROM trading_accounts WHERE id = ? AND user_id = ?
      `, [accountId, userId]);

      if (!account.length) {
        throw new Error('Trading account not found');
      }

  const availableMargin = account[0].balance - (account[0].margin_used || 0);
      if (availableMargin < marginRequired) {
        throw new Error('Insufficient margin');
      }

      // Create position
      const side = positionType === 'sell' ? 'sell' : 'buy';

      const result = await executeQuery(`
        INSERT INTO positions (
          account_id, symbol_id, side, lot_size, open_price, current_price, stop_loss, take_profit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [accountId, symbolId, side, volume, openPrice, openPrice, stopLoss, takeProfit]);

      // Update account used_margin (increase by required margin)
      await executeQuery(`
        UPDATE trading_accounts 
        SET margin_used = margin_used + ?, used_margin = COALESCE(used_margin, 0) + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [marginRequired, marginRequired, accountId]);

      // Send notification
      const symbol = await executeQuery('SELECT symbol FROM symbols WHERE id = ?', [symbolId]);
      await NotificationService.sendPositionNotification(userId, result.insertId, 'opened', {
        message: `Position opened for ${symbol[0].symbol} - ${positionType.toUpperCase()} ${volume} lots at ${openPrice}`,
        symbol: symbol[0].symbol,
        volume,
        openPrice
      });

      return {
        positionId: result.insertId,
        openPrice,
        marginRequired
      };
    } catch (error) {
      console.error('Error opening position:', error);
      throw error;
    }
  }

  // Close position
  static async closePosition(userId, positionId, closePrice = null) {
    try {
      // Get position details
      const positions = await executeQuery(`
        SELECT 
          p.*,
          ta.user_id AS account_user_id,
          s.symbol,
          md.current_price
        FROM positions p
        JOIN trading_accounts ta ON p.account_id = ta.id
        JOIN symbols s ON p.symbol_id = s.id
        LEFT JOIN market_data md ON s.id = md.symbol_id AND md.date = CURDATE()
        WHERE p.id = ? AND ta.user_id = ? AND p.status IN ('open', 'partially_closed')
      `, [positionId, userId]);

      if (!positions.length) {
        throw new Error('Position not found or already closed');
      }

      const position = positions[0];
      const accountUserId = position.account_user_id || userId;
      const finalClosePrice = closePrice ?? position.current_price ?? position.open_price;

      // Calculate P&L
      const metrics = this.calculatePositionMetrics(position, finalClosePrice);
      const closeReason = 'manual';
      
      // Close position
      await executeQuery(`
        UPDATE positions 
        SET 
          status = 'closed',
          current_price = ?,
          close_price = ?,
          profit = ?,
          profit_loss = ?,
          closed_at = NOW(),
          close_time = NOW(),
          close_reason = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [finalClosePrice, finalClosePrice, metrics.unrealizedPnl, metrics.unrealizedPnl, closeReason, positionId]);

      // Update account balance and margin
      const rawMarginUsed = Number(position.margin_used);
      const marginUsed = Number.isFinite(rawMarginUsed) ? rawMarginUsed : 0;

      // Apply realized P&L once, decrement margin used and keep legacy used_margin in sync.
      await executeQuery(`
        UPDATE trading_accounts
        SET balance = balance + ?,
            margin_used = GREATEST(COALESCE(margin_used, 0) - ?, 0),
            used_margin = GREATEST(COALESCE(used_margin, 0) - ?, 0),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [metrics.unrealizedPnl, marginUsed, marginUsed, position.account_id]);

      let tradeHistoryId = null;
      let ibCommissionResult = null;

      try {
        tradeHistoryId = await TradeHistory.recordPositionClose({
          accountId: position.account_id,
          symbolId: position.symbol_id,
          positionId: position.id,
          side: position.side || position.position_type,
          lotSize: position.lot_size,
          openPrice: position.open_price,
          closePrice: finalClosePrice,
          stopLoss: position.stop_loss,
          takeProfit: position.take_profit,
          commission: position.commission || 0,
          swap: position.swap || 0,
          profit: metrics.unrealizedPnl,
          closeReason,
          comment: position.comment,
          magicNumber: position.magic_number,
          openedAt: position.opened_at,
          closedAt: new Date().toISOString()
        });
      } catch (historyError) {
        console.error('Failed to record trade history for closed position:', historyError);
      }

      if (tradeHistoryId) {
        try {
          ibCommissionResult = await IntroducingBrokerService.processTradeCommission(
            accountUserId,
            tradeHistoryId,
            position.id,
            Math.abs(position.lot_size),
            metrics.unrealizedPnl
          );

          if (ibCommissionResult && global.broadcast) {
            global.broadcast({
              type: 'ib_commission_recorded',
              userId: ibCommissionResult.ibUserId,
              data: {
                commissionId: ibCommissionResult.commissionId,
                tradeId: tradeHistoryId,
                positionId: position.id,
                clientUserId: accountUserId,
                commissionAmount: ibCommissionResult.commissionAmount,
                commissionRate: ibCommissionResult.commissionRate,
                tradeVolume: ibCommissionResult.tradeVolume,
                profit: metrics.unrealizedPnl,
                symbol: position.symbol,
                side: position.side || position.position_type,
                lotSize: position.lot_size,
                closedAt: new Date().toISOString()
              }
            });
          }
        } catch (ibError) {
          console.error('Failed to process IB commission on manual close:', ibError);
        }
      }

      // Send notification
      const pnlStatus = metrics.unrealizedPnl >= 0 ? 'profit' : 'loss';
      await NotificationService.sendPositionNotification(userId, positionId, 'closed', {
        message: `Position closed for ${position.symbol} with ${pnlStatus} of ${Math.abs(metrics.unrealizedPnl).toFixed(2)}`,
        symbol: position.symbol,
        pnl: metrics.unrealizedPnl,
        closePrice: finalClosePrice
      });

      return {
        pnl: metrics.unrealizedPnl,
        closePrice: finalClosePrice,
        tradeHistoryId,
        ibCommission: ibCommissionResult
      };
    } catch (error) {
      console.error('Error closing position:', error);
      throw error;
    }
  }

  // Update positions with current market prices
  static async updatePositionPnL() {
    try {
      const openPositions = await executeQuery(`
        SELECT 
          p.id,
          p.account_id,
          p.symbol_id,
          p.side as position_type,
          p.lot_size as volume,
          p.open_price,
          p.stop_loss,
          p.take_profit,
          p.current_price,
          md.current_price as market_price,
          s.symbol
        FROM positions p
        JOIN market_data md ON p.symbol_id = md.symbol_id AND md.date = CURDATE()
        JOIN symbols s ON p.symbol_id = s.id
        WHERE p.status = 'open'
      `);

      const updates = [];
      const marginCalls = [];
      const stopLossHits = [];
      const takeProfitHits = [];

      for (const position of openPositions) {
        // Skip detailed calculations for now due to schema mismatch
        // const metrics = this.calculatePositionMetrics(position, position.market_price);
        
        // Comment out margin calls since we don't have the required columns
        // const equityRatio = (position.margin_used + metrics.unrealizedPnl) / position.margin_used;
        // if (equityRatio < 0.5) {
        //   marginCalls.push({
        //     userId: position.user_id,
        //     positionId: position.id,
        //     symbol: position.symbol,
        //     equityRatio
        //   });
        // }

        // Check stop loss using market_price
        if (position.stop_loss && position.market_price) {
          const isLong = position.position_type === 'buy';
          if ((isLong && position.market_price <= position.stop_loss) ||
              (!isLong && position.market_price >= position.stop_loss)) {
            stopLossHits.push(position);
          }
        }

        // Check take profit using market_price
        if (position.take_profit && position.market_price) {
          const isLong = position.position_type === 'buy';
          if ((isLong && position.market_price >= position.take_profit) ||
              (!isLong && position.market_price <= position.take_profit)) {
            takeProfitHits.push(position);
          }
        }

        // Skip P&L updates for now
        // updates.push([metrics.unrealizedPnl, position.id]);
      }

      // Skip batch updates for now due to schema mismatch
      // if (updates.length > 0) {
      //   for (const [pnl, positionId] of updates) {
      //     await executeQuery(`
      //       UPDATE positions SET unrealized_pnl = ? WHERE id = ?
      //     `, [pnl, positionId]);
      //   }
      // }

      // Skip margin calls since we commented them out
      // for (const mc of marginCalls) {
      //   await NotificationService.sendPositionNotification(mc.userId, mc.positionId, 'margin_call', {
      //     message: `Margin call for ${mc.symbol}. Please add funds or close position to avoid auto-closure.`,
      //     symbol: mc.symbol,
      //     equityRatio: mc.equityRatio
      //   });
      // }

      // Skip auto-closing for now since we don't have user_id
      // for (const position of stopLossHits) {
      //   await this.closePosition(position.user_id, position.id, position.stop_loss);
      //   await NotificationService.sendPositionNotification(position.user_id, position.id, 'stop_loss', {
      //     message: `Stop loss triggered for ${position.symbol} at ${position.stop_loss}`,
      //     symbol: position.symbol,
      //     stopLoss: position.stop_loss
      //   });
      // }

      // for (const position of takeProfitHits) {
      //   await this.closePosition(position.user_id, position.id, position.take_profit);
      //   await NotificationService.sendPositionNotification(position.user_id, position.id, 'take_profit', {
      //     message: `Take profit triggered for ${position.symbol} at ${position.take_profit}`,
      //     symbol: position.symbol,
      //     takeProfit: position.take_profit
      //   });
      // }

      return {
        updatedPositions: updates.length,
        marginCalls: marginCalls.length,
        stopLossHits: stopLossHits.length,
        takeProfitHits: takeProfitHits.length
      };
    } catch (error) {
      console.error('Error updating position P&L:', error);
      throw error;
    }
  }

  // Get position history
  static async getPositionHistory(userId, page = 1, limit = 20, status = null) {
    try {
      const offset = (page - 1) * limit;
      const whereParts = ['ta.user_id = ?'];
      const params = [userId];

      if (status) {
        whereParts.push('p.status = ?');
        params.push(status);
      }

      const whereClause = `WHERE ${whereParts.join(' AND ')}`;

      const positions = await executeQuery(`
        SELECT 
          p.*,
          s.symbol,
          s.name as symbol_name,
          ta.account_number
        FROM positions p
        JOIN symbols s ON p.symbol_id = s.id
        JOIN trading_accounts ta ON p.account_id = ta.id
        ${whereClause}
        ORDER BY p.opened_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      const totalCount = await executeQuery(`
        SELECT COUNT(*) as count
        FROM positions p
        JOIN trading_accounts ta ON p.account_id = ta.id
        ${whereClause}
      `, params);

      return {
        positions,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          pages: Math.ceil(totalCount[0].count / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching position history:', error);
      throw error;
    }
  }

  // Get trading statistics
  static async getTradingStats(userId, accountId = null) {
    try {
      const whereParts = ['ta.user_id = ?'];
      const params = [userId];

      if (accountId) {
        whereParts.push('p.account_id = ?');
        params.push(accountId);
      }

      const whereClause = `WHERE ${whereParts.join(' AND ')}`;

      const stats = await executeQuery(`
        SELECT 
          COUNT(*) as total_positions,
          COUNT(CASE WHEN p.status = 'open' THEN 1 END) as open_positions,
          COUNT(CASE WHEN p.status = 'closed' THEN 1 END) as closed_positions,
          COUNT(CASE WHEN p.status = 'closed' AND p.profit_loss > 0 THEN 1 END) as winning_trades,
          COUNT(CASE WHEN p.status = 'closed' AND p.profit_loss < 0 THEN 1 END) as losing_trades,
          COALESCE(SUM(CASE WHEN p.status = 'closed' THEN p.profit_loss ELSE 0 END), 0) as total_pnl,
          COALESCE(MAX(CASE WHEN p.status = 'closed' THEN p.profit_loss ELSE NULL END), 0) as best_trade,
          COALESCE(MIN(CASE WHEN p.status = 'closed' THEN p.profit_loss ELSE NULL END), 0) as worst_trade,
          COALESCE(AVG(CASE WHEN p.status = 'closed' THEN p.profit_loss ELSE NULL END), 0) as avg_pnl,
          COALESCE(SUM(p.lot_size), 0) as total_volume
        FROM positions p
        JOIN trading_accounts ta ON p.account_id = ta.id
        ${whereClause}
      `, params);

      const result = stats[0];
      
      // Calculate win rate
      const closedTrades = result.closed_positions;
      result.win_rate = closedTrades > 0 ? (result.winning_trades / closedTrades) * 100 : 0;

      return result;
    } catch (error) {
      console.error('Error fetching trading statistics:', error);
      throw error;
    }
  }

  // Validate trading parameters
  static validateTradingParams(symbolId, volume, leverage, stopLoss, takeProfit, openPrice, positionType) {
    const errors = [];

    // Volume validation
    if (!volume || volume <= 0) {
      errors.push('Volume must be greater than 0');
    }

    // Leverage validation
    if (!leverage || leverage < 1 || leverage > 500) {
      errors.push('Leverage must be between 1 and 500');
    }

    // Stop loss validation
    if (stopLoss) {
      if (positionType === 'buy' && stopLoss >= openPrice) {
        errors.push('Stop loss for buy position must be below open price');
      }
      if (positionType === 'sell' && stopLoss <= openPrice) {
        errors.push('Stop loss for sell position must be above open price');
      }
    }

    // Take profit validation
    if (takeProfit) {
      if (positionType === 'buy' && takeProfit <= openPrice) {
        errors.push('Take profit for buy position must be above open price');
      }
      if (positionType === 'sell' && takeProfit >= openPrice) {
        errors.push('Take profit for sell position must be below open price');
      }
    }

    return errors;
  }
}

module.exports = TradingService;