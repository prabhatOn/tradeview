const { executeQuery } = require('./config/database.js');
const MarketDataService = require('./services/MarketDataService.js');

async function initializeMarketData() {
  try {
    console.log('Initializing market data...');

    // First, clear existing market prices
    await executeQuery('DELETE FROM market_prices');
    console.log('Cleared existing market prices');

    // Get all symbols
    const symbols = await executeQuery('SELECT id, symbol FROM symbols WHERE is_active = 1');

    if (symbols.length === 0) {
      console.log('No active symbols found. Please ensure symbols are created first.');
      return;
    }

    // Initialize market prices for each symbol
    for (const symbol of symbols) {
      try {
        const basePrice = MarketDataService.getDefaultPrice(symbol.symbol);
        const spread = MarketDataService.getDefaultSpread(symbol.symbol);

        const bid = basePrice;
        const ask = basePrice + spread;
        const last = basePrice + (spread / 2);

        await executeQuery(
          `INSERT INTO market_prices 
           (symbol_id, bid, ask, last, high, low, volume, change_amount, change_percent) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            symbol.id,
            bid.toFixed(6),
            ask.toFixed(6),
            last.toFixed(6),
            last.toFixed(6),
            last.toFixed(6),
            Math.floor(Math.random() * 1000000),
            0.000000,
            0.0000
          ]
        );

        console.log(`Initialized prices for ${symbol.symbol}: BID=${bid.toFixed(6)}, ASK=${ask.toFixed(6)}`);

      } catch (error) {
        console.error(`Error initializing price for ${symbol.symbol}:`, error);
      }
    }

    console.log('Market data initialization completed');

  } catch (error) {
    console.error('Error in initializeMarketData:', error);
  }
}

// Run if called directly
if (require.main === module) {
  initializeMarketData()
    .then(() => {
      console.log('Market data initialization finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Market data initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeMarketData };