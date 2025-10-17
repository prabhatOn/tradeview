const axios = require('axios');

async function testEndpoints() {
  const baseURL = 'http://localhost:3001/api';
  
  // Get admin token first (you'll need to update with your admin credentials)
  console.log('Testing backend endpoints...\n');
  
  try {
    // Test 1: Check if backend is running
    console.log('1. Testing backend health...');
    try {
      const healthCheck = await axios.get('http://localhost:3001/');
      console.log('✅ Backend is running');
    } catch (err) {
      console.log('❌ Backend is NOT running or not accessible');
      console.log('   Please start the backend server: cd backend && node server.js');
      process.exit(1);
    }

    // Test 2: Login as admin
    console.log('\n2. Testing admin login...');
    const loginRes = await axios.post(`${baseURL}/auth/login`, {
      email: 'admin@tradingplatform.com',
      password: 'Admin@123'
    });
    
    if (loginRes.data.success) {
      console.log('✅ Admin login successful');
      const token = loginRes.data.data.token;
      
      // Test 3: Get symbols
      console.log('\n3. Testing GET /admin/symbols...');
      const symbolsRes = await axios.get(`${baseURL}/admin/symbols`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Response status:', symbolsRes.status);
      console.log('Response data:', JSON.stringify(symbolsRes.data, null, 2));
      
      if (symbolsRes.data.success && symbolsRes.data.data.symbols) {
        console.log(`✅ Symbols endpoint working: ${symbolsRes.data.data.symbols.length} symbols found`);
        console.log('\nFirst 5 symbols:');
        symbolsRes.data.data.symbols.slice(0, 5).forEach(s => {
          console.log(`  - ${s.symbol} (${s.name})`);
        });
      } else {
        console.log('❌ Symbols endpoint returned unexpected format');
      }
      
      // Test 4: Get IB stats
      console.log('\n4. Testing GET /admin/ib/all...');
      const ibRes = await axios.get(`${baseURL}/admin/ib/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Response status:', ibRes.status);
      console.log('Response data:', JSON.stringify(ibRes.data, null, 2));
      
      if (ibRes.data.success && ibRes.data.data) {
        console.log(`✅ IB endpoint working: ${ibRes.data.data.length} IBs found`);
        ibRes.data.data.forEach(ib => {
          console.log(`  - ${ib.ibName} (${ib.ibEmail}) - Clients: ${ib.totalClients}`);
        });
      } else {
        console.log('❌ IB endpoint returned unexpected format');
      }
      
    } else {
      console.log('❌ Admin login failed');
      console.log('Response:', loginRes.data);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testEndpoints();
