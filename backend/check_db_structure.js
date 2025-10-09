const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabaseStructure() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'pro2'
        });

        console.log('🔍 Checking database structure...\n');

        // Check users table
        console.log('=== USERS TABLE ===');
        const [usersDesc] = await connection.execute('DESCRIBE users');
        usersDesc.forEach(u => {
            console.log(`${u.Field.padEnd(25)} | ${u.Type.padEnd(20)} | ${u.Null.padEnd(5)} | ${u.Default || 'NULL'}`);
        });

        console.log('\n=== TRADING_ACCOUNTS TABLE ===');
        const [accountsDesc] = await connection.execute('DESCRIBE trading_accounts');
        accountsDesc.forEach(a => {
            console.log(`${a.Field.padEnd(25)} | ${a.Type.padEnd(20)} | ${a.Null.padEnd(5)} | ${a.Default || 'NULL'}`);
        });

        console.log('\n=== ROLES TABLE ===');
        const [rolesDesc] = await connection.execute('DESCRIBE roles');
        rolesDesc.forEach(r => {
            console.log(`${r.Field.padEnd(25)} | ${r.Type.padEnd(20)} | ${r.Null.padEnd(5)} | ${r.Default || 'NULL'}`);
        });

        console.log('\n=== USER_ROLES TABLE ===');
        const [userRolesDesc] = await connection.execute('DESCRIBE user_roles');
        userRolesDesc.forEach(ur => {
            console.log(`${ur.Field.padEnd(25)} | ${ur.Type.padEnd(20)} | ${ur.Null.padEnd(5)} | ${ur.Default || 'NULL'}`);
        });

        console.log('\n=== POSITIONS TABLE ===');
        const [positionsDesc] = await connection.execute('DESCRIBE positions');
        positionsDesc.forEach(p => {
            console.log(`${p.Field.padEnd(25)} | ${p.Type.padEnd(20)} | ${p.Null.padEnd(5)} | ${p.Default || 'NULL'}`);
        });

        console.log('\n=== INTRODUCING_BROKERS TABLE ===');
        const [ibDesc] = await connection.execute('DESCRIBE introducing_brokers');
        ibDesc.forEach(ib => {
            console.log(`${ib.Field.padEnd(25)} | ${ib.Type.padEnd(20)} | ${ib.Null.padEnd(5)} | ${ib.Default || 'NULL'}`);
        });

        console.log('\n=== API_KEYS TABLE ===');
        const [apiDesc] = await connection.execute('DESCRIBE api_keys');
        apiDesc.forEach(api => {
            console.log(`${api.Field.padEnd(25)} | ${api.Type.padEnd(20)} | ${api.Null.padEnd(5)} | ${api.Default || 'NULL'}`);
        });

        // Check for missing tables that backend might expect
        console.log('\n=== CHECKING FOR MISSING TABLES ===');
        const expectedTables = [
            'users', 'roles', 'user_roles', 'trading_accounts', 'positions', 
            'trade_history', 'balance_history', 'transactions', 'deposits', 'withdrawals',
            'api_keys', 'introducing_brokers', 'ib_commissions', 'ib_applications',
            'market_data', 'market_prices', 'symbols', 'notifications'
        ];

        const [allTables] = await connection.execute('SHOW TABLES');
        const existingTables = allTables.map(t => Object.values(t)[0]);

        const missingTables = expectedTables.filter(table => !existingTables.includes(table));
        const extraTables = existingTables.filter(table => !expectedTables.includes(table));

        if (missingTables.length > 0) {
            console.log('\n❌ Missing tables that backend might expect:');
            missingTables.forEach(table => console.log(`   - ${table}`));
        }

        if (extraTables.length > 0) {
            console.log('\n➕ Extra tables in database:');
            extraTables.forEach(table => console.log(`   - ${table}`));
        }

        console.log(`\n📊 Total tables in database: ${existingTables.length}`);

    } catch (error) {
        console.error('❌ Error checking database structure:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkDatabaseStructure();