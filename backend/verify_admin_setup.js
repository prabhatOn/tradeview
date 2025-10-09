const mysql = require('mysql2/promise');
require('dotenv').config();

async function verifyAdminSetup() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'pro2'
        });

        console.log('🔗 Connected to database successfully');

        // Check admin user details
        const [adminUser] = await connection.execute(`
            SELECT 
                u.id, u.email, u.first_name, u.last_name, u.status,
                r.name as role_name, r.is_admin,
                ta.account_number, ta.account_type, ta.balance
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN trading_accounts ta ON u.id = ta.user_id
            WHERE u.email = 'admin@tradingplatform.com'
        `);

        if (adminUser.length > 0) {
            const admin = adminUser[0];
            console.log('✅ Admin user verification:');
            console.log(`   👤 User: ${admin.first_name} ${admin.last_name} (ID: ${admin.id})`);
            console.log(`   📧 Email: ${admin.email}`);
            console.log(`   🔐 Role: ${admin.role_name || 'No role assigned'}`);
            console.log(`   🛡️ Is Admin: ${admin.is_admin ? 'Yes' : 'No'}`);
            console.log(`   💳 Account: ${admin.account_number || 'No account'}`);
            console.log(`   💰 Balance: $${admin.balance || '0'}`);
            console.log(`   📊 Status: ${admin.status}`);
        } else {
            console.log('❌ No admin user found!');
        }

        // Check if Super Admin role exists
        const [roles] = await connection.execute('SELECT * FROM roles WHERE is_admin = TRUE');
        console.log(`\n🎭 Admin roles found: ${roles.length}`);
        roles.forEach(role => {
            console.log(`   • ${role.name} (ID: ${role.id})`);
        });

        // Check total users
        const [userCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
        console.log(`\n👥 Total users in database: ${userCount[0].count}`);

        console.log('\n🔐 Current Admin Login Credentials:');
        console.log('   📧 Email: admin@tradingplatform.com');
        console.log('   🔑 Password: admin123');

    } catch (error) {
        console.error('❌ Error verifying admin setup:', error.message);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

verifyAdminSetup();