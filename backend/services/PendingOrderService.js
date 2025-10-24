/* eslint-disable @typescript-eslint/no-require-imports */
const { executeQuery } = require('../config/database');
const TradingAccount = require('../models/TradingAccount');

// Service to process pending limit orders and convert them to open positions when triggered
class PendingOrderService {
  // Find pending orders and attempt to fill them based on latest market price
  static async processPendingOrders() {
    try {
      // Get pending positions and the latest market price for each symbol
      // Only consider pending orders that were created at least 1 second ago to avoid
      // immediately filling an order at the exact moment it was placed (race condition)
      const pending = await executeQuery(
        `SELECT p.id, p.account_id, p.symbol_id, p.side, p.lot_size, p.trigger_price, p.order_type,
                (SELECT mp2.bid FROM market_prices mp2 WHERE mp2.symbol_id = p.symbol_id ORDER BY mp2.timestamp DESC LIMIT 1) AS bid,
                (SELECT mp3.ask FROM market_prices mp3 WHERE mp3.symbol_id = p.symbol_id ORDER BY mp3.timestamp DESC LIMIT 1) AS ask
         FROM positions p
        WHERE p.status = 'pending' AND p.opened_at < DATE_SUB(NOW(), INTERVAL 5 SECOND)
         ORDER BY p.opened_at ASC`
      );

      let filled = 0;
      for (const row of pending) {
  // Determine market and trigger prices
  const marketPrice = row.side === 'buy' ? parseFloat(row.ask) : parseFloat(row.bid);
  const triggerPrice = parseFloat(row.trigger_price);
  const orderType = row.order_type || 'limit';
        if (!marketPrice || !triggerPrice) continue;

  // Evaluate based on order_type semantics:
  // - limit orders: buy -> fill when ask <= triggerPrice, sell -> fill when bid >= triggerPrice
  // - stop orders:  buy -> fill when ask >= triggerPrice, sell -> fill when bid <= triggerPrice
  let shouldFill = false;
  if (orderType === 'limit') {
    if (row.side === 'buy' && marketPrice <= triggerPrice) shouldFill = true;
    if (row.side === 'sell' && marketPrice >= triggerPrice) shouldFill = true;
  } else if (orderType === 'stop') {
    if (row.side === 'buy' && marketPrice >= triggerPrice) shouldFill = true;
    if (row.side === 'sell' && marketPrice <= triggerPrice) shouldFill = true;
  }

        if (shouldFill) {
          try {
            // Convert pending to open: set open_price to marketPrice and status to 'open'
            await executeQuery(
              `UPDATE positions SET open_price = ?, status = 'open', trigger_price = NULL, order_type = 'market', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [marketPrice, row.id]
            );

            // Refresh account metrics
            const account = await TradingAccount.findById(row.account_id);
            if (account) await account.refreshAccountMetrics();

            filled++;

            // Broadcast via global ws if available
            if (global.broadcast) {
              global.broadcast({ type: 'pending_order_filled', data: { positionId: row.id, openPrice: marketPrice } });
            }
          } catch (err) {
            console.error('Failed to fill pending order', row.id, err);
          }
        }
      }

      return { processed: pending.length, filled };
    } catch (error) {
      console.error('Error processing pending orders:', error);
      return { processed: 0, filled: 0 };
    }
  }

  // Daily cleanup: remove pending orders older than N days and closed positions older than N days
  static async dailyCleanup({ pendingDays = 7, closedDays = 30 } = {}) {
    try {
      const pendingDelete = await executeQuery(
        `DELETE FROM positions WHERE status = 'pending' AND opened_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [pendingDays]
      );

      const closedDelete = await executeQuery(
        `DELETE FROM positions WHERE status = 'closed' AND closed_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [closedDays]
      );

      return { pendingDeleted: pendingDelete.affectedRows || 0, closedDeleted: closedDelete.affectedRows || 0 };
    } catch (error) {
      console.error('Daily cleanup error:', error);
      return { pendingDeleted: 0, closedDeleted: 0 };
    }
  }

  // Check and execute stop loss/take profit for open positions
  static async checkStopLossTakeProfit() {
    try {
      // Get all open positions with SL or TP set
      const positions = await executeQuery(
        `SELECT p.id, p.account_id, p.symbol_id, p.side, p.lot_size, p.open_price,
                p.stop_loss, p.take_profit,
                (SELECT mp2.bid FROM market_prices mp2 WHERE mp2.symbol_id = p.symbol_id ORDER BY mp2.timestamp DESC LIMIT 1) AS bid,
                (SELECT mp3.ask FROM market_prices mp3 WHERE mp3.symbol_id = p.symbol_id ORDER BY mp3.timestamp DESC LIMIT 1) AS ask
         FROM positions p
         WHERE p.status = 'open'
         AND (p.stop_loss IS NOT NULL OR p.take_profit IS NOT NULL)`
      );

      let closedCount = 0;
      for (const pos of positions) {
        const currentPrice = pos.side === 'buy' ? parseFloat(pos.bid) : parseFloat(pos.ask);
        if (!currentPrice) continue;

        let shouldClose = false;
        let closeReason = 'manual';

        // Check stop loss
        if (pos.stop_loss) {
          const stopLoss = parseFloat(pos.stop_loss);
          if (pos.side === 'buy' && currentPrice <= stopLoss) {
            shouldClose = true;
            closeReason = 'stop_loss';
          } else if (pos.side === 'sell' && currentPrice >= stopLoss) {
            shouldClose = true;
            closeReason = 'stop_loss';
          }
        }

        // Check take profit
        if (!shouldClose && pos.take_profit) {
          const takeProfit = parseFloat(pos.take_profit);
          if (pos.side === 'buy' && currentPrice >= takeProfit) {
            shouldClose = true;
            closeReason = 'take_profit';
          } else if (pos.side === 'sell' && currentPrice <= takeProfit) {
            shouldClose = true;
            closeReason = 'take_profit';
          }
        }

        if (shouldClose) {
          try {
            // Close position
            await executeQuery(
              `UPDATE positions 
               SET status = 'closed', 
                   close_price = ?, 
                   current_price = ?,
                   close_reason = ?,
                   closed_at = CURRENT_TIMESTAMP,
                   close_time = CURRENT_TIMESTAMP
               WHERE id = ?`,
              [currentPrice, currentPrice, closeReason, pos.id]
            );

            // Refresh account metrics
            const account = await TradingAccount.findById(pos.account_id);
            if (account) await account.refreshAccountMetrics();

            closedCount++;

            // Broadcast via global ws if available
            if (global.broadcast) {
              global.broadcast({ 
                type: 'position_closed', 
                data: { positionId: pos.id, closePrice: currentPrice, reason: closeReason } 
              });
            }
          } catch (err) {
            console.error('Failed to close position on SL/TP trigger', pos.id, err);
          }
        }
      }

      return { checked: positions.length, closed: closedCount };
    } catch (error) {
      console.error('Error checking stop loss/take profit:', error);
      return { checked: 0, closed: 0 };
    }
  }
}

module.exports = PendingOrderService;
