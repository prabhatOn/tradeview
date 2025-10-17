const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupKycAndBank() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'pro2',
    multipleStatements: true
  });

  try {
    console.log('Setting up KYC and Bank Details schema...\n');
    
    const sqlFile = fs.readFileSync(
      path.join(__dirname, '../database/kyc_and_bank_schema.sql'),
      'utf8'
    );
    
    await connection.query(sqlFile);
    
    console.log('✅ Successfully created KYC and Bank Details tables!');
    console.log('\nTables created:');
    console.log('  - kyc_documents');
    console.log('  - bank_details');
    console.log('  - password_reset_tokens');
    console.log('  - user_activity_log');
    console.log('\nUsers table updated with KYC fields');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

setupKycAndBank();
