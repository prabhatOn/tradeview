const { executeQuery, initializeDatabase } = require('./config/database');

async function addCloseColumns() {
  try {
    // Initialize database connection first
    await initializeDatabase();
    console.log('Adding close-related columns to positions table...');
    
    // Add columns
    await executeQuery(`
      ALTER TABLE positions 
      ADD COLUMN closed_at TIMESTAMP NULL,
      ADD COLUMN close_reason ENUM('manual', 'stop_loss', 'take_profit', 'margin_call', 'system') DEFAULT 'manual'
    `);
    
    console.log('Columns added successfully');
    
    // Add indexes
    await executeQuery('CREATE INDEX idx_positions_closed_at ON positions(closed_at)');
    await executeQuery('CREATE INDEX idx_positions_close_reason ON positions(close_reason)');
    
    console.log('Indexes created successfully');
    
    // Update existing closed positions
    const result = await executeQuery(`
      UPDATE positions 
      SET closed_at = updated_at 
      WHERE status = 'closed' AND closed_at IS NULL
    `);
    
    console.log(`Updated ${result.affectedRows} existing closed positions`);
    console.log('Migration completed successfully!');
    
  } catch (error) {
    if (error.message.includes('Duplicate column name')) {
      console.log('Columns already exist, skipping...');
    } else {
      console.error('Migration failed:', error);
    }
  } finally {
    process.exit(0);
  }
}

addCloseColumns();