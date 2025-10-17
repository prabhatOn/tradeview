const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runSQL() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'pro2',
        multipleStatements: true
    });
    
    console.log('Connected to database');
    
    // Read and execute the entire SQL file at once
    const sqlContent = fs.readFileSync(
        path.join(__dirname, '../database/cleanup_final.sql'),
        'utf8'
    );
    
    try {
        await connection.query(sqlContent);
        console.log('✅ SQL executed successfully!');
        
        // Verify results
        const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
        console.log(`\nUsers: ${users[0].count}`);
        
        const [symbols] = await connection.execute('SELECT COUNT(*) as count FROM symbols');
        console.log(`Symbols: ${symbols[0].count}`);
        
        const [categories] = await connection.execute(`
            SELECT ac.name as category, COUNT(*) as count 
            FROM symbols s
            JOIN asset_categories ac ON s.category_id = ac.id
            GROUP BY ac.name
        `);
        
        console.log('\nSymbols by Category:');
        categories.forEach(cat => {
            console.log(`  ${cat.category}: ${cat.count}`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    
    await connection.end();
}

runSQL();
