const mysql = require('mysql2/promise');

async function addUsedMarginColumn() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'pro2'
  });

  try {
    console.log('Adding used_margin column to trading_accounts table...');
    
    await connection.execute(`
      ALTER TABLE trading_accounts
      ADD COLUMN used_margin DECIMAL(15,4) DEFAULT 0.0000 AFTER equity
    `);
    
    console.log('✅ Successfully added used_margin column!');
    
    // Update existing records to calculate used margin
    console.log('Calculating used margin for existing accounts...');
    
    const [accounts] = await connection.execute('SELECT id FROM trading_accounts');
    
    for (const account of accounts) {
      const [marginResult] = await connection.execute(`
        SELECT 
          COALESCE(SUM((p.lot_size * s.contract_size * p.open_price) / ta.leverage), 0) as used_margin
        FROM positions p
        JOIN symbols s ON p.symbol_id = s.id
        JOIN trading_accounts ta ON p.account_id = ta.id
        WHERE p.account_id = ? AND p.status = 'open'
      `, [account.id]);
      
      const usedMargin = parseFloat(marginResult[0]?.used_margin || 0);
      
      await connection.execute(`
        UPDATE trading_accounts
        SET used_margin = ?
        WHERE id = ?
      `, [usedMargin, account.id]);
    }
    
    console.log(`✅ Updated used margin for ${accounts.length} accounts!`);
    
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ Column used_margin already exists');
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    await connection.end();
  }
}

addUsedMarginColumn();
