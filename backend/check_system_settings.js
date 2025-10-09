const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSystemSettingsTable() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'pro2'
        });

        console.log('🔗 Connected to database successfully');

        // Check if system_settings table exists and its structure
        const [result] = await connection.execute('DESCRIBE system_settings');
        
        console.log('📋 system_settings table structure:');
        result.forEach(column => {
            console.log(`  ${column.Field}: ${column.Type} ${column.Null} ${column.Key} ${column.Default || ''}`);
        });
        
        // Check if category column exists
        const hasCategory = result.some(column => column.Field === 'category');
        
        if (!hasCategory) {
            console.log('\n⚠️ Missing category column! Adding it...');
            await connection.execute('ALTER TABLE system_settings ADD COLUMN category VARCHAR(50) DEFAULT "general"');
            console.log('✅ Added category column');
        } else {
            console.log('\n✅ Category column exists');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

checkSystemSettingsTable();