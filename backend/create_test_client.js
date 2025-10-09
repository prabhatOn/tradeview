require('dotenv').config({ path: '../.env' });
const { initializeDatabase, executeQuery } = require('./config/database');
const bcrypt = require('bcryptjs');

async function createTestClient() {
  try {
    console.log('Creating new test client...');

    // Hash password
    const hash = await bcrypt.hash('clientpass123', 12);

    // Initialize database
    await initializeDatabase();

    // Create user
    const result = await executeQuery(
      'INSERT INTO users (email, password_hash, first_name, last_name, phone, status) VALUES (?, ?, ?, ?, ?, ?)',
      ['frontendtest2@example.com', hash, 'Frontend', 'Test2', '1234567891', 'active']
    );

    console.log('Client created with ID:', result.insertId);
    const userId = result.insertId;

    // Create trading account
    const accountNumber = '100' + String(userId).padStart(7, '0');
    await executeQuery(
      'INSERT INTO trading_accounts (user_id, account_number, account_type, currency, leverage, balance, equity, free_margin, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, accountNumber, 'demo', 'USD', 100, 100000.00, 100000.00, 100000.00, 'active']
    );

    console.log('Trading account created successfully');
    console.log('Test client email: frontendtest2@example.com');

  } catch (err) {
    console.error('Error:', err);
  }
}

createTestClient();