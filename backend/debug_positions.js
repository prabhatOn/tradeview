const { executeQuery, initializeDatabase } = require('./config/database');

async function debugPositions() {
  try {
    console.log('Initializing database...');
    await initializeDatabase();
    
    console.log('=== CHECKING OPEN POSITIONS AND USER ASSOCIATIONS ===');
    const query = `
      SELECT 
        p.id, 
        p.account_id, 
        p.status, 
        p.symbol_id, 
        s.symbol, 
        ta.user_id, 
        ta.account_number 
      FROM positions p 
      JOIN symbols s ON p.symbol_id = s.id 
      JOIN trading_accounts ta ON p.account_id = ta.id 
      WHERE p.status = 'open' 
      ORDER BY p.id
    `;
    
    const openPositions = await executeQuery(query);
    console.log('Open positions with user associations:', JSON.stringify(openPositions, null, 2));
    
    console.log('\n=== CHECKING ALL POSITIONS FOR ACCOUNT 1 ===');
    const account1Query = `
      SELECT 
        p.id, 
        p.account_id, 
        p.status, 
        p.symbol_id, 
        s.symbol,
        p.profit,
        p.opened_at
      FROM positions p 
      JOIN symbols s ON p.symbol_id = s.id 
      WHERE p.account_id = 1 
      ORDER BY p.opened_at DESC
    `;
    
    const account1Positions = await executeQuery(account1Query);
    console.log('All positions for account 1:', JSON.stringify(account1Positions, null, 2));
    
    console.log('\n=== TESTING NEW API ENDPOINT QUERY ===');
    const newApiQuery = `
      SELECT 
        p.id,
        p.symbol_id,
        s.symbol,
        s.name as symbol_name,
        p.side,
        p.lot_size,
        p.open_price,
        p.stop_loss,
        p.take_profit,
        p.commission,
        p.swap,
        p.profit,
        p.status,
        p.opened_at,
        p.updated_at,
        mp.bid,
        mp.ask,
        s.pip_size,
        s.contract_size
      FROM positions p
      JOIN symbols s ON p.symbol_id = s.id
      LEFT JOIN market_prices mp ON s.id = mp.symbol_id
      WHERE p.account_id = ? AND p.status IN ('open', 'closed')
      ORDER BY p.opened_at DESC
    `;
    
    const newApiResult = await executeQuery(newApiQuery, [1]);
    console.log('New API endpoint result for account 1:', JSON.stringify(newApiResult, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugPositions();