/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const { executeQuery } = require('../config/database');
const FundManager = require('./FundManager');
const Position = require('../models/Position');

class PositionUpdateService {
  
  /**
   * Update all open positions with current market prices
   * @returns {Object} Update results
   */
  static async updateAllOpenPositions() {
    try {
      console.log('Starting position P&L updates...');
      
      // Get all open positions with their symbols and current market prices
      const query = `
        SELECT 
          p.id,
          p.account_id,
          p.symbol_id,
          p.side,
          p.lot_size,
          p.open_price,
          p.commission,
          p.swap,
          s.symbol,
          s.contract_size,
          s.pip_size,
          mp.bid,
          mp.ask,
          mp.timestamp as price_timestamp
        FROM positions p
        JOIN symbols s ON p.symbol_id = s.id
        LEFT JOIN market_prices mp ON s.id = mp.symbol_id
        WHERE p.status = 'open'
        ORDER BY mp.timestamp DESC
      `;
      
      const positions = await executeQuery(query);
      
      if (!positions.length) {
        console.log('No open positions found');
        return {
          updatedPositions: 0,
          errors: 0,
          message: 'No open positions to update'
        };
      }
      
      console.log(`Found ${positions.length} open positions to update`);
      
      let updatedCount = 0;
      let errorCount = 0;
      const updates = [];
      
      for (const positionData of positions) {
        try {
          // Skip if no market price available
          if (!positionData.bid || !positionData.ask) {
            console.log(`No market price for position ${positionData.id} (${positionData.symbol})`);
            continue;
          }
          
          // Get current price based on position side
          const currentPrice = positionData.side === 'buy' ? positionData.bid : positionData.ask;
          
          // Calculate P&L using FundManager
          const symbolInfo = {
            contract_size: positionData.contract_size,
            pip_size: positionData.pip_size
          };
          
          const calculatedPnL = FundManager.calculatePositionPnL(
            {
              open_price: positionData.open_price,
              lot_size: positionData.lot_size,
              side: positionData.side
            },
            currentPrice,
            symbolInfo
          );
          
          // Store update for batch processing
          updates.push({
            id: positionData.id,
            currentPrice: currentPrice,
            profit: calculatedPnL
          });
          
          updatedCount++;
          
        } catch (error) {
          console.error(`Error calculating P&L for position ${positionData.id}:`, error);
          errorCount++;
        }
      }
      
      // Batch update positions
      if (updates.length > 0) {
        console.log(`Batch updating ${updates.length} positions...`);
        
        for (const update of updates) {
          try {
            await executeQuery(
              `UPDATE positions 
               SET current_price = ?, profit = ?, updated_at = NOW() 
               WHERE id = ? AND status = 'open'`,
              [update.currentPrice, update.profit, update.id]
            );
          } catch (error) {
            console.error(`Error updating position ${update.id}:`, error);
            errorCount++;
          }
        }
      }
      
      console.log(`Position update completed: ${updatedCount} updated, ${errorCount} errors`);
      
      return {
        updatedPositions: updatedCount,
        errors: errorCount,
        totalPositions: positions.length,
        message: `Updated ${updatedCount} positions with current market prices`
      };
      
    } catch (error) {
      console.error('Error in updateAllOpenPositions:', error);
      throw error;
    }
  }
  
  /**
   * Update positions for a specific symbol with new market price
   * @param {number} symbolId - Symbol ID
   * @param {number} bid - Current bid price
   * @param {number} ask - Current ask price
   * @returns {Object} Update results
   */
  static async updatePositionsForSymbol(symbolId, bid, ask) {
    try {
      // Get all open positions for this symbol
      const positions = await executeQuery(
        `SELECT 
          p.id,
          p.account_id,
          p.side,
          p.lot_size,
          p.open_price,
          p.stop_loss,
          p.take_profit,
          s.contract_size,
          s.pip_size,
          s.symbol
        FROM positions p
        JOIN symbols s ON p.symbol_id = s.id
        WHERE p.symbol_id = ? AND p.status = 'open'`,
        [symbolId]
      );
      
      if (!positions.length) {
        return { updatedPositions: 0, message: 'No positions for this symbol' };
      }
      
      const updates = [];
      const autoCloseList = [];
      
      for (const positionData of positions) {
        const currentPrice = positionData.side === 'buy' ? bid : ask;
        
        // Calculate P&L
        const symbolInfo = {
          contract_size: positionData.contract_size,
          pip_size: positionData.pip_size
        };
        
        const calculatedPnL = FundManager.calculatePositionPnL(
          {
            open_price: positionData.open_price,
            lot_size: positionData.lot_size,
            side: positionData.side
          },
          currentPrice,
          symbolInfo
        );
        
        // Check for auto-close conditions
        let shouldClose = false;
        let closeReason = null;
        
        // Check stop loss
        if (positionData.stop_loss) {
          if ((positionData.side === 'buy' && currentPrice <= positionData.stop_loss) ||
              (positionData.side === 'sell' && currentPrice >= positionData.stop_loss)) {
            shouldClose = true;
            closeReason = 'stop_loss';
          }
        }
        
        // Check take profit
        if (!shouldClose && positionData.take_profit) {
          if ((positionData.side === 'buy' && currentPrice >= positionData.take_profit) ||
              (positionData.side === 'sell' && currentPrice <= positionData.take_profit)) {
            shouldClose = true;
            closeReason = 'take_profit';
          }
        }
        
        if (shouldClose) {
          autoCloseList.push({
            id: positionData.id,
            closePrice: currentPrice,
            closeReason: closeReason,
            profit: calculatedPnL
          });
        } else {
          updates.push({
            id: positionData.id,
            currentPrice: currentPrice,
            profit: calculatedPnL
          });
        }
      }
      
      // Batch update positions
      for (const update of updates) {
        await executeQuery(
          `UPDATE positions 
           SET current_price = ?, profit = ?, updated_at = NOW() 
           WHERE id = ?`,
          [update.currentPrice, update.profit, update.id]
        );
      }
      
      // Auto-close positions that hit stop loss or take profit
      for (const closeData of autoCloseList) {
        try {
          const position = await Position.findById(closeData.id);
          if (position) {
            await position.close(closeData.closePrice, closeData.closeReason);
          }
          console.log(`Auto-closed position ${closeData.id} due to ${closeData.closeReason}`);
        } catch (error) {
          console.error(`Error auto-closing position ${closeData.id}:`, error);
        }
      }
      
      return {
        updatedPositions: updates.length,
        autoClosedPositions: autoCloseList.length,
        totalProcessed: positions.length,
        message: `Updated ${updates.length} positions, auto-closed ${autoCloseList.length} positions`
      };
      
    } catch (error) {
      console.error('Error updating positions for symbol:', error);
      throw error;
    }
  }
  
  /**
   * Get comprehensive position summary with real-time data
   * @param {number} accountId - Trading account ID
   * @returns {Object} Position summary with statistics
   */
  static async getAccountPositionSummary(accountId) {
    try {
      // First update positions to ensure current data
      await this.updateAllOpenPositions();
      
      // Get enhanced positions data
      const query = `
        SELECT 
          p.*,
          s.symbol,
          s.name as symbol_name,
          s.contract_size,
          s.pip_size,
          mp.bid,
          mp.ask
        FROM positions p
        JOIN symbols s ON p.symbol_id = s.id
        LEFT JOIN market_prices mp ON s.id = mp.symbol_id
        WHERE p.account_id = ? AND p.status IN ('open', 'closed')
        ORDER BY p.opened_at DESC
      `;
      
      const positions = await executeQuery(query, [accountId]);
      
      // Calculate statistics using FundManager
      const statistics = FundManager.calculatePositionStatistics(accountId, positions);
      
      return {
        positions: positions,
        statistics: statistics,
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error getting account position summary:', error);
      throw error;
    }
  }
}

module.exports = PositionUpdateService;