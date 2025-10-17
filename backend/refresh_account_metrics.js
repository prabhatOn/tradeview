const mysql = require('mysql2/promise');

async function refreshAccountMetrics() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'pro2'
  });

  try {
    console.log('Refreshing account metrics for all accounts...\n');
    
    // Get all active accounts
    const [accounts] = await connection.execute(
      'SELECT id, account_number, balance FROM trading_accounts WHERE status = "active"'
    );
    
    console.log(`Found ${accounts.length} active accounts\n`);
    
    for (const account of accounts) {
      console.log(`Processing account ${account.account_number} (ID: ${account.id})...`);
      
      const balance = parseFloat(account.balance || 0);
      
      // Get unrealized P&L from open positions
      const [pnlResult] = await connection.execute(`
        SELECT COALESCE(SUM(profit), 0) as unrealized_pnl
        FROM positions 
        WHERE account_id = ? AND status = 'open'
      `, [account.id]);
      
      const unrealizedPnL = parseFloat(pnlResult[0]?.unrealized_pnl || 0);
      const equity = balance + unrealizedPnL;
      
      // Calculate used margin from all open positions
      const [marginResult] = await connection.execute(`
        SELECT 
          COALESCE(SUM((p.lot_size * s.contract_size * p.open_price) / ta.leverage), 0) as used_margin,
          COUNT(*) as position_count
        FROM positions p
        JOIN symbols s ON p.symbol_id = s.id
        JOIN trading_accounts ta ON p.account_id = ta.id
        WHERE p.account_id = ? AND p.status = 'open'
      `, [account.id]);
      
      const usedMargin = parseFloat(marginResult[0]?.used_margin || 0);
      const positionCount = parseInt(marginResult[0]?.position_count || 0);
      const freeMargin = Math.max(equity - usedMargin, 0);
      const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 0;
      
      // Update account metrics
      await connection.execute(`
        UPDATE trading_accounts 
        SET equity = ?, 
            used_margin = ?,
            free_margin = ?, 
            margin_level = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [equity, usedMargin, freeMargin, marginLevel, account.id]);
      
      console.log(`  ✓ Balance: $${balance.toFixed(2)}`);
      console.log(`  ✓ Equity: $${equity.toFixed(2)}`);
      console.log(`  ✓ Used Margin: $${usedMargin.toFixed(2)} (${positionCount} positions)`);
      console.log(`  ✓ Free Margin: $${freeMargin.toFixed(2)}`);
      console.log(`  ✓ Margin Level: ${marginLevel.toFixed(2)}%\n`);
    }
    
    console.log('✅ Successfully refreshed all account metrics!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

refreshAccountMetrics();
