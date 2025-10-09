const axios = require('axios');

async function testTradingFlow() {
  const baseURL = 'http://localhost:3001/api';
  
  try {
    console.log('🧪 Testing Complete Trading Flow...\n');

    // Step 1: Login as user 8
    console.log('1️⃣ Logging in as user 8...');
    const loginResponse = await axios.post(`${baseURL}/auth/login`, {
      email: 'techxavvy8@gmail.com',
      password: '123456' // Assuming this is the password
    });

    if (!loginResponse.data.success) {
      throw new Error('Login failed');
    }

    const token = loginResponse.data.data.token;
    console.log('✅ Login successful');

    // Step 2: Get user's trading accounts
    console.log('\n2️⃣ Getting trading accounts...');
    const accountsResponse = await axios.get(`${baseURL}/trading/accounts`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Accounts API response:', accountsResponse.data);
    
    if (!accountsResponse.data.success || !accountsResponse.data.data.length) {
      throw new Error('No trading accounts found');
    }

    const account = accountsResponse.data.data[0];
    console.log(`✅ Found trading account: ID ${account.id}, Balance: $${account.balance}`);

    // Step 3: Get available symbols
    console.log('\n3️⃣ Getting available symbols...');
    const symbolsResponse = await axios.get(`${baseURL}/market/overview`);
    
    if (!symbolsResponse.data.success || !symbolsResponse.data.data.length) {
      throw new Error('No symbols available');
    }

    const symbol = symbolsResponse.data.data[0]; // EURUSD
    console.log(`✅ Found symbol: ${symbol.symbol} (ID: ${symbol.symbolId})`);

    // Step 4: Create a buy position
    console.log('\n4️⃣ Creating BUY position...');
    const positionData = {
      accountId: account.id,
      symbolId: symbol.symbolId,
      side: 'buy',
      lotSize: 0.1,
      stopLoss: null,
      takeProfit: null,
      comment: 'Test BUY position'
    };

    console.log('Position data to send:', positionData);

    const positionResponse = await axios.post(`${baseURL}/trading/positions`, positionData, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Position API response:', positionResponse.data);

    if (positionResponse.data.success) {
      console.log('✅ Position created successfully!');
      console.log('Position details:', {
        id: positionResponse.data.data.id,
        symbol: positionResponse.data.data.symbol,
        side: positionResponse.data.data.side,
        lotSize: positionResponse.data.data.lotSize,
        openPrice: positionResponse.data.data.openPrice
      });
    } else {
      console.log('❌ Position creation failed:', positionResponse.data);
    }

    // Step 5: Get positions to verify
    console.log('\n5️⃣ Verifying positions...');
    const positionsResponse = await axios.get(`${baseURL}/trading/positions?accountId=${account.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Positions response:', positionsResponse.data);

    if (positionsResponse.data.success && positionsResponse.data.data.length > 0) {
      console.log(`✅ Found ${positionsResponse.data.data.length} open position(s)`);
    }

    console.log('\n🎉 Trading flow test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

testTradingFlow();