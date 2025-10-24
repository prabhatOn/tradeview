/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Script to create an Oxapay payment gateway record in the database.
 * Usage: node backend/scripts/create_oxapay_gateway.js
 *
 * This uses the project's existing database configuration in backend/config/database.js
 * Make sure the database config is correct and the DB is reachable.
 */

const path = require('path');
const { executeQuery, initializeDatabase } = require(path.join(__dirname, '../config/database'));

async function createGateway() {
  try {
    await initializeDatabase();

    // Check if a gateway with name 'oxapay' already exists
    const [existing] = await executeQuery('SELECT id FROM payment_gateways WHERE name = ?', ['oxapay']);
    if (existing && existing.length > 0) {
      console.log('A gateway with name "oxapay" already exists. Aborting.');
      return;
    }

    // Determine next sort order
    const [maxSort] = await executeQuery('SELECT COALESCE(MAX(sort_order), 0) + 1 as next_sort FROM payment_gateways');
    const sortOrder = (maxSort && maxSort.next_sort) ? maxSort.next_sort : 1;

    const configuration = {
      baseUrl: 'https://api.oxapay.com/v1',
      endpoints: {
        createPayment: '/payment/white-label'
      },
      headers: {
        merchant_api_key: '1LUTWK-PBD5Q5-E6FRLV-PGQCOK',
        'Content-Type': 'application/json'
      }
    };

    const supportedCurrencies = ['USD'];

    const insertSql = `
      INSERT INTO payment_gateways (
        name, display_name, type, provider, min_amount, max_amount,
        processing_fee_type, processing_fee_value, processing_time_hours,
        supported_currencies, description, icon_url, configuration, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      'oxapay',
      'Oxapay',
      'crypto', // mark as crypto - change to 'e_wallet' if you prefer
      'oxapay',
      0.1,
      10000,
      'percentage',
      0,
      24,
      JSON.stringify(supportedCurrencies),
      'Oxapay integration (white-label) - configured via API',
      null,
      JSON.stringify(configuration),
      sortOrder
    ];

    const result = await executeQuery(insertSql, params);

    console.log('Gateway created with id:', result.insertId);
    console.log('Configuration:', JSON.stringify(configuration, null, 2));
  } catch (error) {
    console.error('Failed to create gateway:', error);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  createGateway().then(() => process.exit());
}

module.exports = { createGateway };
