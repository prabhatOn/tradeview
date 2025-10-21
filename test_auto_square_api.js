const axios = require('axios');

// Test the admin trading accounts API to verify auto_square_percent is returned
async function testAutoSquarePercent() {
  try {
    // First, let's login as admin to get a token
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@trad.com',
      password: 'admin123'
    });

    const token = loginResponse.data.data.token;

    // Now call the admin trading accounts endpoint
    const accountsResponse = await axios.get('http://localhost:3001/api/admin/trading/accounts', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('API Response:');
    console.log(JSON.stringify(accountsResponse.data, null, 2));

    // Check if auto_square_percent is present
    if (accountsResponse.data.data.rows && accountsResponse.data.data.rows.length > 0) {
      const firstAccount = accountsResponse.data.data.rows[0];
      console.log('\nFirst account auto_square_percent:', firstAccount.auto_square_percent);
      console.log('Has auto_square_percent field:', 'auto_square_percent' in firstAccount);
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testAutoSquarePercent();