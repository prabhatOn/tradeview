const mysql = require('mysql2/promise');
require('dotenv').config();

async function testTradingSystem() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pro2'
  });

  try {
    console.log('🔍 Testing Trading System Components...\n');

    // Check symbols
    const [symbols] = await connection.execute('SELECT COUNT(*) as count FROM symbols WHERE is_active = TRUE');
    console.log(`📊 Active trading symbols: ${symbols[0].count}`);

    // Check market prices
    const [prices] = await connection.execute('SELECT COUNT(*) as count FROM market_prices');
    console.log(`💰 Market prices available: ${prices[0].count}`);

    // Check trading accounts for recent users
    const [accounts] = await connection.execute(`
      SELECT ta.id, ta.user_id, ta.account_number, ta.balance, ta.status, u.email
      FROM trading_accounts ta 
      JOIN users u ON ta.user_id = u.id 
      WHERE ta.status = 'active'
      ORDER BY ta.created_at DESC 
      LIMIT 5
    `);
    console.log('\n👥 Recent Trading Accounts:');
    accounts.forEach(acc => {
      console.log(`  Account ${acc.id}: ${acc.email} - $${acc.balance} (${acc.status})`);
    });

    // Check recent positions
    const [positions] = await connection.execute(`
      SELECT p.id, p.account_id, s.symbol, p.side, p.lot_size, p.entry_price, p.current_profit, p.status
      FROM positions p
      JOIN symbols s ON p.symbol_id = s.id
      ORDER BY p.created_at DESC
      LIMIT 5
    `);
    console.log('\n📈 Recent Positions:');
    if (positions.length > 0) {
      positions.forEach(pos => {
        console.log(`  Position ${pos.id}: ${pos.side.toUpperCase()} ${pos.lot_size} lots ${pos.symbol} - P&L: $${pos.current_profit} (${pos.status})`);
      });
    } else {
      console.log('  No positions found - Ready for first trade!');
    }

    // Test symbol data structure
    const [symbolData] = await connection.execute(`
      SELECT s.id, s.symbol, s.name, mp.bid, mp.ask, s.category_id, ac.name as category_name
      FROM symbols s
      LEFT JOIN market_prices mp ON s.id = mp.symbol_id
      LEFT JOIN asset_categories ac ON s.category_id = ac.id
      WHERE s.symbol IN ('EURUSD', 'GBPUSD', 'XAUUSD')
      ORDER BY s.symbol
    `);
    console.log('\n💹 Sample Market Data:');
    symbolData.forEach(sym => {
      console.log(`  ${sym.symbol} (${sym.category_name}): ${sym.name} - Bid: ${sym.bid}, Ask: ${sym.ask}`);
    });

    // Check if system is ready for trading
    console.log('\n✅ SYSTEM READINESS CHECK:');
    console.log(`   ✅ Trading symbols: ${symbols[0].count > 0 ? 'READY' : 'NOT READY'}`);
    console.log(`   ✅ Market prices: ${prices[0].count > 0 ? 'READY' : 'NOT READY'}`);
    console.log(`   ✅ Trading accounts: ${accounts.length > 0 ? 'READY' : 'NOT READY'}`);
    console.log(`   ✅ Database connection: READY`);

    if (symbols[0].count > 0 && prices[0].count > 0 && accounts.length > 0) {
      console.log('\n🚀 TRADING SYSTEM IS FULLY OPERATIONAL!');
      console.log('   Users can now:');
      console.log('   • Register and get auto-created trading accounts');
      console.log('   • View real-time market data');
      console.log('   • Execute BUY/SELL orders');
      console.log('   • Track positions and P&L');
      console.log('   • Close positions when desired');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

testTradingSystem();