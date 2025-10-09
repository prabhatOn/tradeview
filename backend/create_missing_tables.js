const mysql = require('mysql2/promise');
require('dotenv').config();

async function createMissingTables() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'pro2'
        });

        console.log('🔗 Connected to database successfully');

        // Create transactions table
        console.log('📝 Creating transactions table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS transactions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                account_id INT,
                type ENUM('deposit', 'withdrawal', 'transfer', 'commission', 'swap', 'profit', 'loss') NOT NULL,
                amount DECIMAL(15,4) NOT NULL,
                currency VARCHAR(3) NOT NULL DEFAULT 'USD',
                status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE SET NULL,
                INDEX idx_user_id (user_id),
                INDEX idx_account_id (account_id),
                INDEX idx_type (type),
                INDEX idx_status (status),
                INDEX idx_created_at (created_at)
            )
        `);
        console.log('  ✅ Created transactions table');

        // Create market_data table
        console.log('📝 Creating market_data table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS market_data (
                id INT PRIMARY KEY AUTO_INCREMENT,
                symbol_id INT NOT NULL,
                date DATE NOT NULL,
                open_price DECIMAL(12,6) NOT NULL,
                high_price DECIMAL(12,6) NOT NULL,
                low_price DECIMAL(12,6) NOT NULL,
                close_price DECIMAL(12,6) NOT NULL,
                current_price DECIMAL(12,6) NOT NULL,
                volume BIGINT DEFAULT 0,
                spread DECIMAL(8,4) DEFAULT 0.0000,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
                UNIQUE KEY unique_symbol_date (symbol_id, date),
                INDEX idx_symbol_id (symbol_id),
                INDEX idx_date (date),
                INDEX idx_symbol_date (symbol_id, date)
            )
        `);
        console.log('  ✅ Created market_data table');

        // Insert some sample market data to prevent errors
        console.log('📝 Inserting sample market data...');
        
        // Get some symbol IDs
        const [symbols] = await connection.execute('SELECT id, symbol FROM symbols LIMIT 10');
        
        const today = new Date().toISOString().split('T')[0];
        
        for (const symbolRow of symbols) {
            // Generate random but realistic prices for each symbol
            const basePrice = Math.random() * 100 + 1; // Random price between 1-101
            const variation = basePrice * 0.02; // 2% variation
            
            const openPrice = basePrice;
            const highPrice = basePrice + Math.random() * variation;
            const lowPrice = basePrice - Math.random() * variation;
            const closePrice = basePrice + (Math.random() - 0.5) * variation;
            const currentPrice = closePrice + (Math.random() - 0.5) * variation * 0.1;
            
            await connection.execute(`
                INSERT IGNORE INTO market_data (
                    symbol_id, date, open_price, high_price, low_price, 
                    close_price, current_price, volume, spread
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                symbolRow.id, today, 
                openPrice.toFixed(6), 
                highPrice.toFixed(6), 
                lowPrice.toFixed(6), 
                closePrice.toFixed(6), 
                currentPrice.toFixed(6),
                Math.floor(Math.random() * 1000000), // Random volume
                (Math.random() * 0.01).toFixed(4) // Random spread
            ]);
        }
        
        console.log(`  ✅ Added market data for ${symbols.length} symbols`);

        console.log('🎉 Missing tables created successfully!');

    } catch (error) {
        console.error('❌ Error creating missing tables:', error.message);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

createMissingTables();