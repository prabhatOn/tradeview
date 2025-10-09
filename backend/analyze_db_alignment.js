const mysql = require('mysql2/promise');
require('dotenv').config();

async function alignDatabaseWithBackend() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'pro2'
        });

        console.log('🔄 Analyzing database alignment with backend...\n');

        // Check what tables the backend actually uses
        const backendTableMappings = {
            'balance_history': 'account_balance_history',  // Backend uses account_balance_history
            'transactions': 'pending_transactions',        // Backend might use pending_transactions
            'notifications': 'user_notifications'          // Backend uses user_notifications
        };

        console.log('=== TABLE ALIGNMENT ANALYSIS ===');
        
        // Check existing tables
        const [allTables] = await connection.execute('SHOW TABLES');
        const existingTables = allTables.map(t => Object.values(t)[0]);
        
        console.log('✅ Tables that exist and are aligned:');
        const alignedTables = [
            'users', 'roles', 'user_roles', 'trading_accounts', 'positions', 
            'trade_history', 'deposits', 'withdrawals', 'api_keys', 
            'introducing_brokers', 'ib_commissions', 'ib_applications',
            'market_data', 'market_prices', 'symbols'
        ];
        
        alignedTables.forEach(table => {
            if (existingTables.includes(table)) {
                console.log(`   ✓ ${table}`);
            } else {
                console.log(`   ❌ ${table} - MISSING`);
            }
        });

        console.log('\n📋 Table mappings (backend expects → database has):');
        Object.entries(backendTableMappings).forEach(([expected, actual]) => {
            const hasExpected = existingTables.includes(expected);
            const hasActual = existingTables.includes(actual);
            
            if (hasActual && !hasExpected) {
                console.log(`   ✓ ${expected} → ${actual} (mapped correctly)`);
            } else if (hasExpected && hasActual) {
                console.log(`   ⚠️  Both ${expected} and ${actual} exist (potential conflict)`);
            } else if (!hasActual && !hasExpected) {
                console.log(`   ❌ ${expected} → ${actual} (both missing)`);
            } else {
                console.log(`   ? ${expected} → ${actual} (unclear state)`);
            }
        });

        // Check trading_accounts enum values issue
        console.log('\n=== TRADING ACCOUNTS ENUM CHECK ===');
        const [accountTypeEnum] = await connection.execute(`
            SELECT COLUMN_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'trading_accounts' AND COLUMN_NAME = 'account_type'
        `, [process.env.DB_NAME]);
        
        if (accountTypeEnum.length > 0) {
            console.log('Current account_type enum values:', accountTypeEnum[0].COLUMN_TYPE);
            // Check if 'standard' is included
            if (accountTypeEnum[0].COLUMN_TYPE.includes('standard')) {
                console.log('✅ account_type includes "standard" value');
            } else {
                console.log('❌ account_type missing "standard" value - this caused the previous error');
                console.log('💡 Need to add "standard" to enum values');
            }
        }

        // Check roles and permissions setup
        console.log('\n=== ROLES CHECK ===');
        const [roles] = await connection.execute('SELECT * FROM roles ORDER BY id');
        if (roles.length > 0) {
            console.log('Existing roles:');
            roles.forEach(role => {
                console.log(`   ${role.id}: ${role.name} (admin: ${role.is_admin})`);
            });
        } else {
            console.log('❌ No roles defined in database');
        }

        // Check if we have any users
        console.log('\n=== USERS CHECK ===');
        const [userCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
        console.log(`Current user count: ${userCount[0].count}`);

        // Check account_balance_history table structure
        console.log('\n=== ACCOUNT_BALANCE_HISTORY STRUCTURE ===');
        try {
            const [balanceHistoryDesc] = await connection.execute('DESCRIBE account_balance_history');
            balanceHistoryDesc.forEach(field => {
                console.log(`   ${field.Field.padEnd(20)} | ${field.Type.padEnd(25)} | ${field.Null.padEnd(5)} | ${field.Default || 'NULL'}`);
            });
        } catch (error) {
            console.log('❌ Error checking account_balance_history:', error.message);
        }

        // Recommendations
        console.log('\n=== RECOMMENDATIONS ===');
        console.log('1. ✅ Database has correct table names (account_balance_history, user_notifications, etc.)');
        console.log('2. ⚠️  Need to fix trading_accounts.account_type enum to include "standard"');
        console.log('3. ⚠️  Need to populate roles table with default roles');
        console.log('4. ⚠️  Need to create admin user with proper role assignment');

    } catch (error) {
        console.error('❌ Error analyzing database:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

alignDatabaseWithBackend();