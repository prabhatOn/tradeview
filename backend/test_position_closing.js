// Test script to verify position closing functionality
const { executeQuery, initializeDatabase } = require('./config/database');

async function testPositionClosing() {
  try {
    await initializeDatabase();
    console.log('Testing position closing functionality...');
    
    // Check if the new columns exist
    const result = await executeQuery(`
      DESCRIBE positions
    `);
    
    console.log('Positions table structure:');
    result.forEach(column => {
      console.log(`- ${column.Field}: ${column.Type}`);
    });
    
    // Check if there are any positions to test with
    const positions = await executeQuery(`
      SELECT id, status, symbol_id, account_id, side, lot_size, open_price 
      FROM positions 
      LIMIT 10
    `);
    
    console.log(`\nFound ${positions.length} positions in database`);
    positions.forEach(pos => {
      console.log(`- Position ${pos.id}: ${pos.status} ${pos.side} (Account: ${pos.account_id})`);
    });
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    process.exit(0);
  }
}

testPositionClosing();