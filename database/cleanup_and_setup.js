const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: '../.env' });

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pro2',
  multipleStatements: true
};

async function cleanupAndSeedDatabase() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    console.log('⚠️  WARNING: This will DELETE ALL user data permanently!');
    console.log('⚠️  Database:', dbConfig.database);
    console.log('⚠️  Host:', dbConfig.host);
    
    // In a real scenario, you might want to add a confirmation prompt
    // For automation purposes, we'll proceed directly
    
    console.log('🔄 Reading cleanup and seed script...');
    const sqlScript = await fs.readFile(path.join(__dirname, 'cleanup_and_seed_admin.sql'), 'utf8');
    
    console.log('🔄 Executing database cleanup and admin seeding...');
    const results = await connection.query(sqlScript);
    
    console.log('✅ Database cleanup and admin seeding completed successfully!');
    console.log('');
    console.log('🔐 Admin Login Credentials:');
    console.log('   Email: admin@tradingplatform.com');
    console.log('   Password: admin123');
    console.log('');
    console.log('⚠️  IMPORTANT: Please change the admin password after first login!');
    console.log('');
    
    // Verify the admin user was created
    console.log('🔍 Verifying admin user creation...');
    const [adminUser] = await connection.execute(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.status,
        u.email_verified,
        u.kyc_status,
        r.name as role_name,
        ta.account_number,
        ta.balance
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      LEFT JOIN trading_accounts ta ON u.id = ta.user_id
      WHERE u.email = 'admin@tradingplatform.com'
    `);
    
    if (adminUser.length > 0) {
      console.log('✅ Admin user verified:');
      console.log('   ID:', adminUser[0].id);
      console.log('   Email:', adminUser[0].email);
      console.log('   Name:', adminUser[0].first_name, adminUser[0].last_name);
      console.log('   Role:', adminUser[0].role_name);
      console.log('   Account:', adminUser[0].account_number);
      console.log('   Balance: $' + adminUser[0].balance);
      console.log('   Status:', adminUser[0].status);
    } else {
      console.log('❌ Admin user verification failed!');
    }
    
    // Check total user count
    const [userCount] = await connection.execute('SELECT COUNT(*) as total FROM users');
    console.log('📊 Total users in database:', userCount[0].total);
    
  } catch (error) {
    console.error('❌ Error during database cleanup and seeding:', error);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('   Make sure MySQL server is running');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   Check database credentials in .env file');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('   Database does not exist. Please create it first.');
    }
    
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Execute the cleanup and seeding
if (require.main === module) {
  cleanupAndSeedDatabase()
    .then(() => {
      console.log('🎉 Database cleanup and admin seeding process completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database cleanup and seeding process failed:', error.message);
      process.exit(1);
    });
}

module.exports = { cleanupAndSeedDatabase };