const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function importBaseSchema() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'pro2'
        });

        console.log('🔗 Connected to database successfully');

        // Read the schema.sql file
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('📄 Reading base schema file...');
        
        // Split SQL by semicolon to execute statements separately
        const statements = schemaSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        console.log(`🔧 Executing ${statements.length} SQL statements...`);

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.length > 10) { // Skip very short statements
                try {
                    await connection.execute(statement);
                    if (statement.toLowerCase().includes('create table')) {
                        const tableName = statement.match(/create table\s+(\w+)/i)?.[1];
                        console.log(`  ✅ Created table: ${tableName}`);
                    }
                } catch (error) {
                    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
                        const tableName = statement.match(/create table\s+(\w+)/i)?.[1];
                        console.log(`  ⏭️ Table already exists: ${tableName}`);
                    } else {
                        console.error(`❌ Error executing statement ${i + 1}:`, error.message);
                        console.error('Statement:', statement.substring(0, 100) + '...');
                    }
                }
            }
        }

        console.log('🎉 Base schema import completed!');
        
        // Verify tables were created
        const [tables] = await connection.execute('SHOW TABLES');
        console.log(`📊 Database now contains ${tables.length} tables:`);
        tables.forEach(table => {
            console.log(`  • ${Object.values(table)[0]}`);
        });

    } catch (error) {
        console.error('❌ Error importing base schema:', error.message);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

importBaseSchema();