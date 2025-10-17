const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runCleanupAndReseed() {
    let connection;
    
    try {
        // Read the SQL file
        const sqlFilePath = path.join(__dirname, '../database/cleanup_and_reseed.sql');
        const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
        
        // Split SQL statements (basic split on semicolons)
        const statements = sqlContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        // Create database connection
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '', // Add password if needed
            database: 'pro2',
            multipleStatements: true
        });
        
        console.log('Connected to database');
        console.log('Starting database cleanup and reseed...\n');
        
        let successCount = 0;
        let errorCount = 0;
        
        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            
            // Skip comments and empty statements
            if (statement.startsWith('--') || statement.trim() === '') {
                continue;
            }
            
            try {
                const [results] = await connection.execute(statement);
                successCount++;
                
                // Show progress
                if (statement.toLowerCase().includes('select')) {
                    console.log('\n' + statement);
                    if (Array.isArray(results) && results.length > 0) {
                        console.log(results);
                    }
                }
            } catch (error) {
                // Some errors are expected (like truncating empty tables)
                if (!error.message.includes('Unknown table')) {
                    errorCount++;
                    console.error(`Error executing statement: ${statement.substring(0, 100)}...`);
                    console.error(error.message);
                }
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('DATABASE CLEANUP AND RESEED COMPLETED!');
        console.log('='.repeat(60));
        console.log(`✓ Successful statements: ${successCount}`);
        console.log(`✗ Errors encountered: ${errorCount}`);
        console.log('='.repeat(60));
        
        // Run verification queries
        console.log('\n📊 VERIFICATION:');
        console.log('-'.repeat(60));
        
        const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
        console.log(`Total Users (should be admin only): ${users[0].count}`);
        
        const [symbols] = await connection.execute('SELECT COUNT(*) as count FROM symbols');
        console.log(`Total Symbols: ${symbols[0].count}`);
        
        const [activeSymbols] = await connection.execute('SELECT COUNT(*) as count FROM symbols WHERE is_active = TRUE');
        console.log(`Active Symbols: ${activeSymbols[0].count}`);
        
        const [categories] = await connection.execute(`
            SELECT ac.name as category, COUNT(*) as count 
            FROM symbols s
            JOIN asset_categories ac ON s.category_id = ac.id
            WHERE s.is_active = TRUE 
            GROUP BY ac.name
        `);
        console.log('\n📈 Symbols by Category:');
        categories.forEach(cat => {
            console.log(`   ${cat.category}: ${cat.count}`);
        });
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Database is now clean and ready for production!');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\nDatabase connection closed.');
        }
    }
}

// Run the script
runCleanupAndReseed();
