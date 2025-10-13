/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const { initializeDatabase, executeQuery, closeDatabase } = require('../config/database')

async function ensureSpreadMarkupColumn() {
  try {
    await initializeDatabase()

    const checkSql = `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'symbols' AND COLUMN_NAME = 'spread_markup'
    `

    const columns = await executeQuery(checkSql)

    if (Array.isArray(columns) && columns.length > 0) {
      console.log('✅ spread_markup column already exists on symbols table')
      return
    }

    console.log('🛠️ Adding spread_markup column to symbols table...')

    await executeQuery(`
      ALTER TABLE symbols
      ADD COLUMN spread_markup DECIMAL(10,4) DEFAULT 0.0000 AFTER spread_type
    `)

    console.log('✅ spread_markup column added successfully')
  } catch (error) {
    console.error('❌ Failed to ensure spread_markup column:', error.message)
    throw error
  } finally {
    await closeDatabase()
  }
}

ensureSpreadMarkupColumn()
  .then(() => {
    console.log('🎉 Database update completed. You can reload the Trades & Charges page.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('⚠️ Database update encountered an error:', error)
    process.exit(1)
  })
