const { executeQuery } = require('../config/database');

class MarketService {
  // Get real-time market data
  static async getMarketOverview() {
    try {
      const marketData = await executeQuery(`
        SELECT 
          md.*,
          s.name as symbol_name,
          s.category,
          ROUND(((md.current_price - md.open_price) / md.open_price) * 100, 2) as change_percent
        FROM market_data md
        JOIN symbols s ON md.symbol_id = s.id
        WHERE md.date = CURDATE()
        ORDER BY md.volume DESC
        LIMIT 50
      `);

      return marketData;
    } catch (error) {
      console.error('Error fetching market overview:', error);
      throw error;
    }
  }

  // Get symbol price history
  static async getPriceHistory(symbolId, timeframe = '1D', limit = 100) {
    try {
      let interval = '';
      switch (timeframe) {
        case '1M':
          interval = 'INTERVAL 1 MINUTE';
          break;
        case '5M':
          interval = 'INTERVAL 5 MINUTE';
          break;
        case '15M':
          interval = 'INTERVAL 15 MINUTE';
          break;
        case '1H':
          interval = 'INTERVAL 1 HOUR';
          break;
        case '4H':
          interval = 'INTERVAL 4 HOUR';
          break;
        case '1D':
        default:
          interval = 'INTERVAL 1 DAY';
          break;
      }

      const priceHistory = await executeQuery(`
        SELECT 
          date,
          open_price,
          high_price,
          low_price,
          close_price,
          volume
        FROM market_data
        WHERE symbol_id = ? 
        AND date >= DATE_SUB(NOW(), ${interval})
        ORDER BY date DESC
        LIMIT ?
      `, [symbolId, limit]);

      return priceHistory.reverse(); // Return chronological order
    } catch (error) {
      console.error('Error fetching price history:', error);
      throw error;
    }
  }

  // Update market data (called by scheduled job)
  static async updateMarketData(symbolId, priceData) {
    try {
      const { open, high, low, close, volume } = priceData;
      
      await executeQuery(`
        INSERT INTO market_data (symbol_id, date, open_price, high_price, low_price, close_price, current_price, volume)
        VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        high_price = GREATEST(high_price, VALUES(high_price)),
        low_price = LEAST(low_price, VALUES(low_price)),
        close_price = VALUES(close_price),
        current_price = VALUES(current_price),
        volume = volume + VALUES(volume)
      `, [symbolId, open, high, low, close, close, volume]);

      return true;
    } catch (error) {
      console.error('Error updating market data:', error);
      throw error;
    }
  }

  // Get top gainers and losers
  static async getTopMovers() {
    try {
      const [gainers, losers] = await Promise.all([
        executeQuery(`
          SELECT 
            s.id,
            s.symbol,
            s.name,
            md.current_price,
            md.open_price,
            ROUND(((md.current_price - md.open_price) / md.open_price) * 100, 2) as change_percent
          FROM market_data md
          JOIN symbols s ON md.symbol_id = s.id
          WHERE md.date = CURDATE()
          AND md.current_price > md.open_price
          ORDER BY change_percent DESC
          LIMIT 10
        `),
        executeQuery(`
          SELECT 
            s.id,
            s.symbol,
            s.name,
            md.current_price,
            md.open_price,
            ROUND(((md.current_price - md.open_price) / md.open_price) * 100, 2) as change_percent
          FROM market_data md
          JOIN symbols s ON md.symbol_id = s.id
          WHERE md.date = CURDATE()
          AND md.current_price < md.open_price
          ORDER BY change_percent ASC
          LIMIT 10
        `)
      ]);

      return { gainers, losers };
    } catch (error) {
      console.error('Error fetching top movers:', error);
      throw error;
    }
  }

  // Search symbols
  static async searchSymbols(query) {
    try {
      const symbols = await executeQuery(`
        SELECT 
          s.*,
          md.current_price,
          ROUND(((md.current_price - md.open_price) / md.open_price) * 100, 2) as change_percent
        FROM symbols s
        LEFT JOIN market_data md ON s.id = md.symbol_id AND md.date = CURDATE()
        WHERE s.symbol LIKE ? OR s.name LIKE ?
        AND s.is_active = 1
        ORDER BY s.symbol
        LIMIT 20
      `, [`%${query}%`, `%${query}%`]);

      return symbols;
    } catch (error) {
      console.error('Error searching symbols:', error);
      throw error;
    }
  }

  // Get market statistics
  static async getMarketStats() {
    try {
      const stats = await executeQuery(`
        SELECT 
          COUNT(*) as total_symbols,
          COUNT(CASE WHEN md.current_price > md.open_price THEN 1 END) as gainers,
          COUNT(CASE WHEN md.current_price < md.open_price THEN 1 END) as losers,
          COUNT(CASE WHEN md.current_price = md.open_price THEN 1 END) as unchanged,
          COALESCE(SUM(md.volume), 0) as total_volume,
          COALESCE(AVG(md.volume), 0) as avg_volume
        FROM symbols s
        LEFT JOIN market_data md ON s.id = md.symbol_id AND md.date = CURDATE()
        WHERE s.is_active = 1
      `);

      return stats[0];
    } catch (error) {
      console.error('Error fetching market statistics:', error);
      throw error;
    }
  }

  // Check if market is open
  static async isMarketOpen() {
    try {
      const sessions = await executeQuery(`
        SELECT *
        FROM trading_sessions
        WHERE is_active = 1
        AND CURTIME() BETWEEN open_time AND close_time
        AND FIND_IN_SET(DAYNAME(NOW()), trading_days) > 0
      `);

      return sessions.length > 0;
    } catch (error) {
      console.error('Error checking market status:', error);
      return false;
    }
  }
}

module.exports = MarketService;