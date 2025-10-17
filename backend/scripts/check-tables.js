const mysql = require('mysql2/promise');

async function checkTables() {
  const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'pro2'
  });

  console.log('\n=== NEW TABLES FROM PHASE 1 ===\n');
  
  const tables = ['trading_charges', 'user_tier_assignments', 'ib_global_settings', 'ib_commissions', 'margin_events', 'swap_charges_log', 'position_state_history'];
  
  for (const table of tables) {
    const [rows] = await db.query(`SHOW TABLES LIKE '${table}'`);
    if (rows.length > 0) {
      console.log(`✓ ${table}`);
      const [cols] = await db.query(`SHOW COLUMNS FROM ${table}`);
      cols.forEach(col => {
        console.log(`  - ${col.Field.padEnd(30)} ${col.Type}`);
      });
      console.log('');
    } else {
      console.log(`✗ ${table} - NOT FOUND`);
    }
  }

  await db.end();
}

checkTables().catch(console.error);
