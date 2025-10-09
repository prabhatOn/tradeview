const mysql = require('mysql2/promise');
require('dotenv').config();

async function populateMarketData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'pro2'
  });

  try {
    console.log('🔌 Connected to database');

    // Check if we have asset categories
    const [categories] = await connection.execute('SELECT COUNT(*) as count FROM asset_categories');
    console.log(`📊 Asset categories count: ${categories[0].count}`);

    // Check if we have symbols
    const [symbols] = await connection.execute('SELECT COUNT(*) as count FROM symbols');
    console.log(`🔤 Symbols count: ${symbols[0].count}`);

    // Check trading accounts
    const [accounts] = await connection.execute('SELECT id, user_id, account_number, status, balance FROM trading_accounts LIMIT 5');
    console.log('💰 Trading accounts:', accounts);

    // Check users
    const [users] = await connection.execute('SELECT id, email, created_at FROM users LIMIT 5');
    console.log('👥 Users:', users);

    // If no symbols, let's add them
    if (symbols[0].count === 0) {
      console.log('📝 Adding market data...');
      
      // Add asset categories first
      await connection.execute(`
        INSERT IGNORE INTO asset_categories (name, description, is_active) VALUES
        ('Forex', 'Foreign Exchange Currency Pairs', TRUE),
        ('Commodities', 'Precious Metals and Energy', TRUE),
        ('Indices', 'Stock Market Indices', TRUE),
        ('Crypto', 'Cryptocurrencies', TRUE)
      `);

      // Add popular symbols
      await connection.execute(`
        INSERT IGNORE INTO symbols (symbol, name, category_id, base_currency, quote_currency, pip_size, lot_size, min_lot, max_lot, lot_step, contract_size, margin_requirement, spread_type, commission_type, commission_value, swap_long, swap_short, is_active) VALUES
        ('EURUSD', 'Euro vs US Dollar', 1, 'EUR', 'USD', 0.0001, 1.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 3.3333, 'floating', 'per_lot', 7.0000, -8.5000, -3.2000, TRUE),
        ('GBPUSD', 'British Pound vs US Dollar', 1, 'GBP', 'USD', 0.0001, 1.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 3.3333, 'floating', 'per_lot', 7.0000, -7.8000, -2.1000, TRUE),
        ('USDJPY', 'US Dollar vs Japanese Yen', 1, 'USD', 'JPY', 0.0100, 1.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 3.3333, 'floating', 'per_lot', 7.0000, -5.2000, -8.7000, TRUE),
        ('USDCHF', 'US Dollar vs Swiss Franc', 1, 'USD', 'CHF', 0.0001, 1.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 3.3333, 'floating', 'per_lot', 7.0000, -3.1000, -6.4000, TRUE),
        ('AUDUSD', 'Australian Dollar vs US Dollar', 1, 'AUD', 'USD', 0.0001, 1.0000, 0.0100, 100.0000, 0.0100, 100000.0000, 3.3333, 'floating', 'per_lot', 7.0000, -4.5000, -2.8000, TRUE),
        ('XAUUSD', 'Gold vs US Dollar', 2, 'XAU', 'USD', 0.0100, 1.0000, 0.0100, 100.0000, 0.0100, 100.0000, 5.0000, 'floating', 'per_lot', 5.0000, -12.5000, -8.7000, TRUE),
        ('BTCUSD', 'Bitcoin vs US Dollar', 4, 'BTC', 'USD', 1.0000, 1.0000, 0.0100, 100.0000, 0.0100, 1.0000, 5.0000, 'floating', 'per_lot', 10.0000, -15.0000, -10.0000, TRUE)
      `);

      // Add current market prices
      await connection.execute(`
        INSERT IGNORE INTO market_prices (symbol_id, bid, ask, last, high, low, volume, change_amount, change_percent) VALUES
        (1, 1.09234, 1.09237, 1.09235, 1.09458, 1.09102, 125000.0000, 0.00123, 0.1127),
        (2, 1.26891, 1.26894, 1.26892, 1.27234, 1.26654, 98500.0000, -0.00087, -0.0687),
        (3, 149.567, 149.572, 149.569, 150.234, 149.123, 156000.0000, 0.234, 0.1564),
        (4, 0.91234, 0.91237, 0.91235, 0.91567, 0.90989, 87600.0000, -0.00156, -0.1705),
        (5, 0.67891, 0.67894, 0.67892, 0.68234, 0.67654, 76500.0000, 0.00089, 0.1312),
        (6, 2034.56, 2034.89, 2034.72, 2038.45, 2031.23, 23400.0000, 12.34, 0.6098),
        (7, 43567.89, 43568.45, 43568.17, 44123.45, 43234.56, 5600.0000, 567.89, 1.3204)
      `);

      console.log('✅ Market data added successfully');
    }

    // Check trading accounts again and create one if needed for user 8
    const [userAccounts] = await connection.execute('SELECT * FROM trading_accounts WHERE user_id = ?', [8]);
    console.log(`👤 User 8 trading accounts:`, userAccounts);

    if (userAccounts.length === 0) {
      console.log('📝 Creating trading account for user 8...');
      
      // Generate account number
      const accountNumber = `MT${Date.now()}`;
      
      await connection.execute(`
        INSERT INTO trading_accounts (user_id, account_number, account_type, status, balance, equity, margin, free_margin, margin_level, currency, leverage, server_name, group_name)
        VALUES (?, ?, 'standard', 'active', 10000.00, 10000.00, 0.00, 10000.00, 0.00, 'USD', 100, 'MetaTrader-Live', 'standard')
      `, [8, accountNumber]);

      console.log('✅ Trading account created for user 8');
    }

    // Final verification
    const [finalSymbols] = await connection.execute('SELECT COUNT(*) as count FROM symbols');
    const [finalAccounts] = await connection.execute('SELECT COUNT(*) as count FROM trading_accounts WHERE user_id = 8');
    
    console.log(`✅ Final symbols count: ${finalSymbols[0].count}`);
    console.log(`✅ Final trading accounts for user 8: ${finalAccounts[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

populateMarketData();