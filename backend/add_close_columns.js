/* eslint-disable import/no-commonjs */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
const { executeQuery, initializeDatabase } = require('./config/database');

async function addCloseColumns() {
  try {
    // Initialize database connection first
    await initializeDatabase();
    console.log('Adding close-related columns to positions table...');
    
    // Add columns
    await executeQuery(`
      ALTER TABLE positions 
      ADD COLUMN IF NOT EXISTS close_price DECIMAL(12,6) NULL,
      ADD COLUMN IF NOT EXISTS profit_loss DECIMAL(12,4) DEFAULT 0.0000,
      ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS close_time TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS close_reason ENUM('manual', 'stop_loss', 'take_profit', 'margin_call', 'system') DEFAULT 'manual'
    `);
    
    console.log('Columns added successfully');
    
    // Add indexes
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_positions_closed_at ON positions(closed_at)');
  await executeQuery('CREATE INDEX IF NOT EXISTS idx_positions_close_time ON positions(close_time)');
  await executeQuery('CREATE INDEX IF NOT EXISTS idx_positions_close_reason ON positions(close_reason)');
    
    console.log('Indexes created successfully');
    
    // Backfill existing data
    await executeQuery(`
      UPDATE positions 
      SET close_price = COALESCE(close_price, current_price)
      WHERE status = 'closed' AND close_price IS NULL
    `);

    await executeQuery(`
      UPDATE positions 
      SET profit_loss = COALESCE(profit_loss, profit)
      WHERE status = 'closed' AND (profit_loss IS NULL OR profit_loss = 0)
    `);

    const result = await executeQuery(`
      UPDATE positions 
      SET closed_at = updated_at 
      WHERE status = 'closed' AND closed_at IS NULL
    `);

    await executeQuery(`
      UPDATE positions
      SET close_time = COALESCE(close_time, closed_at, updated_at)
      WHERE status = 'closed' AND close_time IS NULL
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