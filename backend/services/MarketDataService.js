/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const { executeQuery } = require('../config/database');

class MarketDataService {
  
  /**
   * Update market prices with simulated real-time data
   * This simulates TradingView-like price movements
   */
  static async updateMarketPrices() {
    try {
      console.log('Updating market prices...');
      
      // Get all active symbols
      const symbols = await executeQuery(
        'SELECT id, symbol, pip_size FROM symbols WHERE is_active = 1'
      );
      
      if (!symbols.length) {
        console.log('No active symbols found');
        return { updated: 0, message: 'No symbols to update' };
      }
      
      let updatedCount = 0;
      
      for (const symbol of symbols) {
        try {
          // Get the latest price for this symbol
          const latestPrices = await executeQuery(
            `SELECT bid, ask, last FROM market_prices 
             WHERE symbol_id = ? 
             ORDER BY timestamp DESC 
             LIMIT 1`,
            [symbol.id]
          );
          
          let newBid, newAsk, newLast;
          
          if (latestPrices.length > 0) {
            // Use existing prices as base and add realistic variations
            const currentBid = parseFloat(latestPrices[0].bid);
            const currentAsk = parseFloat(latestPrices[0].ask);
            const spread = currentAsk - currentBid;
            
            // Generate realistic price movement (-0.5% to +0.5%)
            const priceChangePercent = (Math.random() - 0.5) * 0.01; // -0.5% to +0.5%
            const priceChange = currentBid * priceChangePercent;
            
            newBid = Math.max(0.00001, currentBid + priceChange);
            newAsk = newBid + spread; // Maintain spread
            newLast = (newBid + newAsk) / 2;
            
          } else {
            // Initialize with default prices if no existing data
            const basePrice = this.getDefaultPrice(symbol.symbol);
            const spread = this.getDefaultSpread(symbol.symbol);
            
            newBid = basePrice;
            newAsk = basePrice + spread;
            newLast = basePrice + (spread / 2);
          }
          
          // Calculate additional market data
          const change = latestPrices.length > 0 
            ? newLast - parseFloat(latestPrices[0].last || newLast)
            : 0;
          const changePercent = latestPrices.length > 0 && parseFloat(latestPrices[0].last) > 0
            ? (change / parseFloat(latestPrices[0].last)) * 100
            : 0;
          
          // Insert new market price
          await executeQuery(
            `INSERT INTO market_prices 
             (symbol_id, bid, ask, last, high, low, volume, change_amount, change_percent) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              symbol.id,
              newBid.toFixed(6),
              newAsk.toFixed(6),
              newLast.toFixed(6),
              newLast.toFixed(6), // High (simplified)
              newLast.toFixed(6), // Low (simplified)
              Math.floor(Math.random() * 1000000), // Random volume
              change.toFixed(6),
              changePercent.toFixed(4)
            ]
          );
          
          updatedCount++;
          
        } catch (error) {
          console.error(`Error updating price for symbol ${symbol.symbol}:`, error);
        }
      }
      
      console.log(`Updated prices for ${updatedCount} symbols`);
      
      return {
        updated: updatedCount,
        message: `Successfully updated ${updatedCount} market prices`
      };
      
    } catch (error) {
      console.error('Error in updateMarketPrices:', error);
      return {
        updated: 0,
        error: error.message
      };
    }
  }
  
  /**
   * Get default price for a symbol (for initialization)
   */
  static getDefaultPrice(symbol) {
    const defaultPrices = {
      'EURUSD': 1.0850,
      'GBPUSD': 1.2650,
      'USDJPY': 149.50,
      'AUDUSD': 0.6720,
      'USDCAD': 1.3580,
      'USDCHF': 0.9125,
      'NZDUSD': 0.6180,
      'EURGBP': 0.8590,
      'EURJPY': 162.25,
      'GBPJPY': 189.10
    };
    
    return defaultPrices[symbol] || 1.0000;
  }
  
  /**
   * Get default spread for a symbol
   */
  static getDefaultSpread(symbol) {
    const defaultSpreads = {
      'EURUSD': 0.00015,
      'GBPUSD': 0.00020,
      'USDJPY': 0.015,
      'AUDUSD': 0.00018,
      'USDCAD': 0.00020,
      'USDCHF': 0.00018,
      'NZDUSD': 0.00025,
      'EURGBP': 0.00018,
      'EURJPY': 0.025,
      'GBPJPY': 0.030
    };
    
    return defaultSpreads[symbol] || 0.00020;
  }
  
  /**
   * Get current market price for a symbol
   */
  static async getCurrentPrice(symbolId) {
    try {
      const prices = await executeQuery(
        `SELECT bid, ask, last, timestamp FROM market_prices 
         WHERE symbol_id = ? 
         ORDER BY timestamp DESC 
         LIMIT 1`,
        [symbolId]
      );
      
      return prices.length > 0 ? prices[0] : null;
    } catch (error) {
      console.error('Error getting current price:', error);
      return null;
    }
  }
  
  /**
   * Clean old market prices (keep only last 1000 entries per symbol)
   */
  static async cleanOldPrices() {
    try {
      const symbols = await executeQuery('SELECT id FROM symbols WHERE is_active = 1');
      
      for (const symbol of symbols) {
        await executeQuery(
          `DELETE FROM market_prices 
           WHERE symbol_id = ? 
           AND id NOT IN (
             SELECT id FROM (
               SELECT id FROM market_prices 
               WHERE symbol_id = ? 
               ORDER BY timestamp DESC 
               LIMIT 1000
             ) AS temp
           )`,
          [symbol.id, symbol.id]
        );
      }
      
      console.log('Cleaned old market prices');
    } catch (error) {
      console.error('Error cleaning old prices:', error);
    }
  }
}

module.exports = MarketDataService;