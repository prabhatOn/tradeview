const { executeQuery } = require('./config/database');

async function testMarketData() {
  try {
    console.log('Testing market data...');
    
    // Check if market prices exist
    const prices = await executeQuery(`
      SELECT 
        s.symbol,
        mp.bid,
        mp.ask,
        mp.last,
        mp.timestamp
      FROM symbols s
      LEFT JOIN market_prices mp ON s.id = mp.symbol_id
      WHERE s.is_active = 1
      ORDER BY s.symbol
    `);
    
    console.log('\nCurrent Market Prices:');
    console.log('Symbol\t\tBid\t\tAsk\t\tLast\t\tUpdated');
    console.log('─'.repeat(80));
    
    for (const price of prices) {
      const bid = price.bid ? Number(price.bid).toFixed(5) : 'N/A';
      const ask = price.ask ? Number(price.ask).toFixed(5) : 'N/A';
      const last = price.last ? Number(price.last).toFixed(5) : 'N/A';
      const updated = price.timestamp ? new Date(price.timestamp).toLocaleString() : 'Never';
      
      console.log(`${price.symbol.padEnd(12)}\t${bid}\t${ask}\t${last}\t${updated}`);
    }
    
    // Check positions that might be affected
    const positions = await executeQuery(`
      SELECT 
        p.id,
        s.symbol,
        p.side,
        p.lot_size,
        p.open_price,
        p.current_price,
        p.profit,
        p.status
      FROM positions p
      JOIN symbols s ON p.symbol_id = s.id
      WHERE p.status = 'open'
      ORDER BY p.opened_at DESC
    `);
    
    if (positions.length > 0) {
      console.log('\nOpen Positions:');
      console.log('ID\tSymbol\t\tSide\tSize\tOpen Price\tCurrent Price\tProfit\t\tStatus');
      console.log('─'.repeat(90));
      
      for (const pos of positions) {
        const profit = Number(pos.profit || 0).toFixed(2);
        const currentPrice = pos.current_price ? Number(pos.current_price).toFixed(5) : 'N/A';
        
        console.log(`${pos.id}\t${pos.symbol.padEnd(12)}\t${pos.side}\t${pos.lot_size}\t${Number(pos.open_price).toFixed(5)}\t\t${currentPrice}\t\t$${profit}\t\t${pos.status}`);
      }
    } else {
      console.log('\nNo open positions found.');
    }
    
  } catch (error) {
    console.error('Error testing market data:', error);
  }
}

// Run if called directly
if (require.main === module) {
  testMarketData()
    .then(() => {
      console.log('\nMarket data test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Market data test failed:', error);
      process.exit(1);
    });
}

module.exports = { testMarketData };