const mysql = require('mysql2/promise');

async function checkData() {
  let connection;
  try {
    // Create direct connection
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'pro2'
    });
    
    console.log('Connected to database\n');
    
    // Check symbols
    console.log('=== SYMBOLS ===');
    const [symbols] = await connection.execute('SELECT id, symbol, name, is_active FROM symbols ORDER BY symbol LIMIT 20');
    console.log(`Total symbols found: ${symbols.length}`);
    symbols.forEach(s => {
      console.log(`  - ${s.symbol} (${s.name}) - Active: ${s.is_active ? 'YES' : 'NO'}`);
    });
    
    console.log('\n=== INTRODUCING BROKERS ===');
    const [ibs] = await connection.execute(`
      SELECT DISTINCT
        ib.ib_user_id,
        u.first_name,
        u.last_name,
        u.email
      FROM introducing_brokers ib
      JOIN users u ON ib.ib_user_id = u.id
    `);
    console.log(`Total IB users found: ${ibs.length}`);
    ibs.forEach(ib => {
      console.log(`  - ${ib.first_name} ${ib.last_name} (${ib.email})`);
    });
    
    console.log('\n=== IB RELATIONSHIPS ===');
    const [ibRels] = await connection.execute(`
      SELECT 
        ib.id,
        ib.ib_user_id,
        ib.client_user_id,
        ib.status,
        u1.email as ib_email,
        u2.email as client_email
      FROM introducing_brokers ib
      JOIN users u1 ON ib.ib_user_id = u1.id
      JOIN users u2 ON ib.client_user_id = u2.id
    `);
    console.log(`Total IB relationships: ${ibRels.length}`);
    ibRels.forEach(rel => {
      console.log(`  - IB: ${rel.ib_email} -> Client: ${rel.client_email} (Status: ${rel.status})`);
    });
    
    console.log('\n=== ASSET CATEGORIES ===');
    const [categories] = await connection.execute('SELECT id, name FROM asset_categories');
    console.log(`Total categories: ${categories.length}`);
    categories.forEach(cat => {
      console.log(`  - ${cat.name} (ID: ${cat.id})`);
    });
    
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

checkData();
