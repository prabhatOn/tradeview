require('dotenv').config({ path: './.env' });
const { executeQuery } = require('./config/database');

async function checkApiKeys() {
  try {
    console.log('Checking API keys data...');
    
    const apiKeys = await executeQuery('SELECT * FROM api_keys');
    console.log('Found API keys:', apiKeys.length);
    
    if (apiKeys.length > 0) {
      for (const key of apiKeys) {
        console.log('\n--- API Key ---');
        console.log('ID:', key.id);
        console.log('User ID:', key.user_id);
        console.log('Key name:', key.key_name);
        console.log('IP Whitelist raw:', JSON.stringify(key.ip_whitelist));
        console.log('IP Whitelist type:', typeof key.ip_whitelist);
        
        // Try to parse the ip_whitelist
        try {
          const parsed = JSON.parse(key.ip_whitelist || '[]');
          console.log('IP Whitelist parsed:', parsed);
        } catch (error) {
          console.log('ERROR parsing IP whitelist:', error.message);
          console.log('Will fix this data...');
          
          // Fix the corrupted data
          await executeQuery('UPDATE api_keys SET ip_whitelist = ? WHERE id = ?', ['[]', key.id]);
          console.log('Fixed IP whitelist for key ID:', key.id);
        }
      }
    } else {
      console.log('No API keys found in database');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkApiKeys();