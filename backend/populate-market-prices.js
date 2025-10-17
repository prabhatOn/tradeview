const mysql = require('mysql2/promise');

async function populateMarketPrices() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'pro2'
  });

  try {
    console.log('Fetching all active symbols...');
    
    // Get all active symbols
    const [symbols] = await connection.execute(`
      SELECT id, symbol, base_currency, quote_currency, category_id 
      FROM symbols 
      WHERE is_active = 1
      ORDER BY symbol
    `);

    console.log(`Found ${symbols.length} active symbols`);

    // Generate realistic market prices for each symbol
    const marketPrices = [];
    const now = new Date();

    for (const sym of symbols) {
      let basePrice;
      
      // Set base prices based on symbol type
      if (sym.symbol.includes('JPY')) {
        basePrice = 150 + (Math.random() * 10 - 5); // JPY pairs around 150
      } else if (sym.symbol.startsWith('XAU')) {
        basePrice = 2650 + (Math.random() * 50 - 25); // Gold around 2650
      } else if (sym.symbol.startsWith('XAG')) {
        basePrice = 31 + (Math.random() * 2 - 1); // Silver around 31
      } else if (sym.symbol.startsWith('BTC')) {
        basePrice = 67000 + (Math.random() * 2000 - 1000); // Bitcoin
      } else if (sym.symbol.startsWith('ETH')) {
        basePrice = 3200 + (Math.random() * 200 - 100); // Ethereum
      } else if (sym.symbol.includes('USD')) {
        basePrice = 1.0 + (Math.random() * 0.5 - 0.25); // Forex majors
      } else {
        basePrice = 1.2 + (Math.random() * 0.3 - 0.15); // Other forex
      }

      const spread = basePrice * 0.0002; // 2 pips spread
      const bid = basePrice - (spread / 2);
      const ask = basePrice + (spread / 2);
      const changePercent = (Math.random() * 2 - 1); // -1% to +1%
      const change = basePrice * (changePercent / 100);

      marketPrices.push([
        sym.id,
        bid,
        ask,
        basePrice,
        basePrice * 1.005, // high
        basePrice * 0.995, // low
        Math.floor(Math.random() * 100000) + 10000, // volume
        change,
        changePercent,
        now
      ]);
    }

    console.log('Inserting market prices...');

    // Clear old prices
    await connection.execute('DELETE FROM market_prices WHERE timestamp < DATE_SUB(NOW(), INTERVAL 1 DAY)');

    // Insert new prices
    const insertQuery = `
      INSERT INTO market_prices 
      (symbol_id, bid, ask, last, high, low, volume, change_amount, change_percent, timestamp)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        bid = VALUES(bid),
        ask = VALUES(ask),
        last = VALUES(last),
        high = VALUES(high),
        low = VALUES(low),
        volume = VALUES(volume),
        change_amount = VALUES(change_amount),
        change_percent = VALUES(change_percent),
        timestamp = VALUES(timestamp)
    `;

    await connection.query(insertQuery, [marketPrices]);

    console.log(`✅ Successfully populated market prices for ${marketPrices.length} symbols!`);

    // Show sample
    const [sample] = await connection.execute(`
      SELECT s.symbol, mp.bid, mp.ask, mp.last, mp.change_percent
      FROM market_prices mp
      JOIN symbols s ON mp.symbol_id = s.id
      LIMIT 10
    `);

    console.log('\nSample prices:');
    console.table(sample);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

populateMarketPrices();
