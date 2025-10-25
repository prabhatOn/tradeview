/* eslint-disable @typescript-eslint/no-var-requires */
const { initializeDatabase, executeQuery, closeDatabase } = require('../config/database');

async function upsertGateway(gateway) {
  const exists = await executeQuery('SELECT id FROM payment_gateways WHERE name = ? LIMIT 1', [gateway.name]);
  if (exists && exists.length) {
    // update existing
    await executeQuery(
      `UPDATE payment_gateways SET display_name = ?, type = ?, provider = ?, is_active = ?, min_amount = ?, max_amount = ?, processing_fee_type = ?, processing_fee_value = ?, processing_time_hours = ?, supported_currencies = ?, configuration = ?, sort_order = ?, icon_url = ?, description = ? WHERE name = ?`,
      [
        gateway.display_name,
        gateway.type,
        gateway.provider,
        gateway.is_active ? 1 : 0,
        gateway.min_amount,
        gateway.max_amount,
        gateway.processing_fee_type,
        gateway.processing_fee_value,
        gateway.processing_time_hours,
        JSON.stringify(gateway.supported_currencies || []),
        JSON.stringify(gateway.configuration || {}),
        gateway.sort_order || 0,
        gateway.icon_url || null,
        gateway.description || null,
        gateway.name,
      ],
    );
    console.log(`Updated gateway ${gateway.name}`);
    const row = await executeQuery('SELECT id FROM payment_gateways WHERE name = ? LIMIT 1', [gateway.name]);
    return row[0].id;
  }

  const result = await executeQuery(
    `INSERT INTO payment_gateways (name, display_name, type, provider, is_active, min_amount, max_amount, processing_fee_type, processing_fee_value, processing_time_hours, supported_currencies, configuration, sort_order, icon_url, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      gateway.name,
      gateway.display_name,
      gateway.type,
      gateway.provider,
      gateway.is_active ? 1 : 0,
      gateway.min_amount,
      gateway.max_amount,
      gateway.processing_fee_type,
      gateway.processing_fee_value,
      gateway.processing_time_hours,
      JSON.stringify(gateway.supported_currencies || []),
      JSON.stringify(gateway.configuration || {}),
      gateway.sort_order || 0,
      gateway.icon_url || null,
      gateway.description || null,
    ],
  );

  console.log(`Inserted gateway ${gateway.name}`);
  return result.insertId || null;
}

async function upsertPaymentMethod(method) {
  const exists = await executeQuery('SELECT id FROM payment_methods WHERE name = ? LIMIT 1', [method.name]);
  if (exists && exists.length) {
    await executeQuery(
      `UPDATE payment_methods SET type = ?, provider = ?, supported_currencies = ?, min_amount = ?, max_amount = ?, deposit_fee_type = ?, deposit_fee_value = ?, withdrawal_fee_type = ?, withdrawal_fee_value = ?, processing_time_hours = ?, is_active = ? WHERE name = ?`,
      [
        method.type,
        method.provider,
        JSON.stringify(method.supported_currencies || []),
        method.min_amount,
        method.max_amount,
        method.deposit_fee_type,
        method.deposit_fee_value,
        method.withdrawal_fee_type,
        method.withdrawal_fee_value,
        method.processing_time_hours,
        method.is_active ? 1 : 0,
        method.name,
      ],
    );
    console.log(`Updated payment method ${method.name}`);
    const row = await executeQuery('SELECT id FROM payment_methods WHERE name = ? LIMIT 1', [method.name]);
    return row[0].id;
  }

  const result = await executeQuery(
    `INSERT INTO payment_methods (name, type, provider, supported_currencies, min_amount, max_amount, deposit_fee_type, deposit_fee_value, withdrawal_fee_type, withdrawal_fee_value, processing_time_hours, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      method.name,
      method.type,
      method.provider,
      JSON.stringify(method.supported_currencies || []),
      method.min_amount,
      method.max_amount,
      method.deposit_fee_type,
      method.deposit_fee_value,
      method.withdrawal_fee_type,
      method.withdrawal_fee_value,
      method.processing_time_hours,
      method.is_active ? 1 : 0,
    ],
  );

  console.log(`Inserted payment method ${method.name}`);
  return result.insertId || null;
}

async function seed() {
  try {
    await initializeDatabase();

    const gateways = [
      {
        name: 'oxapay',
        display_name: 'Oxapay',
        type: 'e_wallet',
        provider: 'oxapay',
        is_active: true,
        min_amount: 1.0,
        max_amount: 100000.0,
        processing_fee_type: 'fixed',
        processing_fee_value: 0.5,
        processing_time_hours: 1,
        supported_currencies: ['USD', 'INR'],
        configuration: { demo: true, apiKey: 'sk_test_oxapay_demo' },
        sort_order: 10,
        icon_url: null,
        description: 'Demo Oxapay e-wallet integration',
      },
      {
        name: 'stripe',
        display_name: 'Stripe (Demo)',
        type: 'credit_card',
        provider: 'stripe',
        is_active: true,
        min_amount: 1.0,
        max_amount: 100000.0,
        processing_fee_type: 'percentage',
        processing_fee_value: 1.5,
        processing_time_hours: 0,
        supported_currencies: ['USD', 'EUR', 'INR'],
        configuration: { demo: true, publicKey: 'pk_test_stripe_demo' },
        sort_order: 20,
        icon_url: null,
        description: 'Stripe test integration (demo)',
      },
      {
        name: 'razorpay',
        display_name: 'Razorpay (Demo)',
        type: 'e_wallet',
        provider: 'razorpay',
        is_active: true,
        min_amount: 10.0,
        max_amount: 500000.0,
        processing_fee_type: 'percentage',
        processing_fee_value: 1.2,
        processing_time_hours: 0,
        supported_currencies: ['INR', 'USD'],
        configuration: { demo: true, key_id: 'rzp_test_key' },
        sort_order: 30,
        icon_url: null,
        description: 'Razorpay demo gateway supporting UPI and cards',
      },
      {
        name: 'upi',
        display_name: 'UPI (Demo)',
        type: 'e_wallet',
        provider: 'upi',
        is_active: true,
        min_amount: 1.0,
        max_amount: 100000.0,
        processing_fee_type: 'fixed',
        processing_fee_value: 0.25,
        processing_time_hours: 0,
        supported_currencies: ['INR'],
        configuration: { demo: true },
        sort_order: 40,
        icon_url: null,
        description: 'Unified Payments Interface (demo)',
      },
    ];

    for (const g of gateways) {
      await upsertGateway(g);
    }

    const methods = [
      {
        name: 'Stripe (Card)',
        type: 'credit_card',
        provider: 'stripe',
        supported_currencies: ['USD', 'EUR', 'INR'],
        min_amount: 1.0,
        max_amount: 100000.0,
        deposit_fee_type: 'percentage',
        deposit_fee_value: 1.5,
        withdrawal_fee_type: 'fixed',
        withdrawal_fee_value: 0.5,
        processing_time_hours: 0,
        is_active: true,
      },
      {
        name: 'Razorpay (UPI/Card)',
        type: 'ewallet',
        provider: 'razorpay',
        supported_currencies: ['INR', 'USD'],
        min_amount: 10.0,
        max_amount: 500000.0,
        deposit_fee_type: 'percentage',
        deposit_fee_value: 1.2,
        withdrawal_fee_type: 'fixed',
        withdrawal_fee_value: 1.0,
        processing_time_hours: 0,
        is_active: true,
      },
      {
        name: 'Oxapay (Demo)',
        type: 'ewallet',
        provider: 'oxapay',
        supported_currencies: ['USD', 'INR'],
        min_amount: 1.0,
        max_amount: 100000.0,
        deposit_fee_type: 'fixed',
        deposit_fee_value: 0.5,
        withdrawal_fee_type: 'fixed',
        withdrawal_fee_value: 0.5,
        processing_time_hours: 1,
        is_active: true,
      },
      {
        name: 'UPI (Demo)',
        type: 'ewallet',
        provider: 'upi',
        supported_currencies: ['INR'],
        min_amount: 1.0,
        max_amount: 50000.0,
        deposit_fee_type: 'fixed',
        deposit_fee_value: 0.25,
        withdrawal_fee_type: 'fixed',
        withdrawal_fee_value: 0.25,
        processing_time_hours: 0,
        is_active: true,
      },
    ];

    for (const m of methods) {
      await upsertPaymentMethod(m);
    }

    console.log('Seeding complete.');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await closeDatabase();
  }
}

seed();
