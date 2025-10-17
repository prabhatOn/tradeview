const mysql = require('mysql2/promise');

async function checkTables() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'pro2'
    });
    
    console.log('Checking existing tables...\n');
    
    const [tables] = await connection.execute('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    
    console.log('📋 Tables in database:');
    tableNames.forEach(t => console.log(`  - ${t}`));
    
    console.log('\n🔍 Checking which cleanup tables exist:');
    const cleanupTables = [
        'positions',
        'trade_history',
        'introducing_brokers',
        'user_sessions',
        'trading_accounts',
        'user_roles',
        'user_settings',
        'user_addresses',
        'notifications',
        'fund_transactions',
        'ib_commissions',
        'swap_charges_log',
        'margin_events'
    ];
    
    const existing = [];
    const missing = [];
    
    for (const table of cleanupTables) {
        if (tableNames.includes(table)) {
            const [count] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
            existing.push(`  ✅ ${table} (${count[0].count} rows)`);
        } else {
            missing.push(`  ❌ ${table} (does not exist)`);
        }
    }
    
    console.log('\nExisting tables:');
    existing.forEach(e => console.log(e));
    
    console.log('\nMissing tables:');
    missing.forEach(m => console.log(m));
    
    await connection.end();
}

checkTables();
