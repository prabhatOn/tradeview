const { executeQuery } = require('../config/database');

async function checkDatabaseData() {
    try {
        console.log('🔍 Checking database data...');
        
        // Check users
        const users = await executeQuery('SELECT COUNT(*) as count FROM users');
        console.log(`Users: ${users[0].count}`);
        
        // Check trading accounts
        const accounts = await executeQuery('SELECT COUNT(*) as count FROM trading_accounts');
        console.log(`Trading accounts: ${accounts[0].count}`);
        
        // Check symbols
        const symbols = await executeQuery('SELECT COUNT(*) as count FROM symbols');
        console.log(`Symbols: ${symbols[0].count}`);
        
        // Check trade history
        const tradeHistory = await executeQuery('SELECT COUNT(*) as count FROM trade_history');
        console.log(`Trade history records: ${tradeHistory[0].count}`);
        
        // Show some sample trade history if it exists
        if (tradeHistory[0].count > 0) {
            const sampleTrades = await executeQuery('SELECT * FROM trade_history LIMIT 3');
            console.log('Sample trade history:');
            console.log(sampleTrades);
        }
        
        // Check table structure
        const columns = await executeQuery('DESCRIBE trade_history');
        console.log('Trade history table structure:');
        console.log(columns);
        
        process.exit(0);
    } catch (error) {
        console.error('Error checking database:', error);
        process.exit(1);
    }
}

checkDatabaseData();