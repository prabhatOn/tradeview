const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateAdminPassword() {
    let connection;
    
    try {
        // Generate hash for "admin123"
        const password = 'admin123';
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        console.log('🔐 Generated password hash for "admin123":', hashedPassword);
        
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'pro2'
        });

        console.log('🔗 Connected to database successfully');

        // Update the admin user password
        const [result] = await connection.execute(`
            UPDATE users 
            SET password_hash = ? 
            WHERE email = 'admin@tradingplatform.com'
        `, [hashedPassword]);

        if (result.affectedRows > 0) {
            console.log('✅ Admin password updated successfully!');
            
            // Verify the password works
            const [admin] = await connection.execute(`
                SELECT id, email, password_hash, first_name, last_name 
                FROM users 
                WHERE email = 'admin@tradingplatform.com'
            `);
            
            if (admin.length > 0) {
                const isPasswordCorrect = await bcrypt.compare('admin123', admin[0].password_hash);
                console.log('🧪 Password verification:', isPasswordCorrect ? '✅ CORRECT' : '❌ INCORRECT');
                
                console.log('\n🔐 Updated Admin Login Credentials:');
                console.log('   📧 Email: admin@tradingplatform.com');
                console.log('   🔑 Password: admin123');
                console.log('\n✅ The password should now work correctly!');
            }
        } else {
            console.log('❌ No admin user found to update');
        }

    } catch (error) {
        console.error('❌ Error updating admin password:', error.message);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

updateAdminPassword();