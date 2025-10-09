// Debug script to check balance discrepancy
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';

async function debugBalance() {
  try {
    // You'll need to replace these with actual values
    const userId = 1; // Replace with your user ID
    const accountId = 1; // Replace with your account ID
    const authToken = 'your-auth-token'; // Replace with your actual token

    console.log('🔍 Debugging balance discrepancy...\n');

    // Get the debug balance check
    const response = await axios.get(
      `${API_BASE_URL}/funds/debug/account/${accountId}/balance-check`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    const debug = response.data.debug;
    
    console.log('📊 Account Data from Database:');
    console.log(`   Balance: $${debug.accountData.balance}`);
    console.log(`   Equity: $${debug.accountData.equity}`);
    console.log(`   Free Margin: $${debug.accountData.free_margin}`);
    console.log(`   Margin Level: ${debug.accountData.margin_level}%\n`);

    console.log('📈 Balance History Breakdown:');
    debug.historyBreakdown.forEach(item => {
      console.log(`   ${item.changeType}: $${item.totalAmount} (${item.count} entries)`);
    });

    console.log(`\n🧮 Calculated Balance from History: $${debug.calculatedBalance}`);
    
    if (debug.discrepancy.exists) {
      console.log(`\n⚠️  DISCREPANCY DETECTED!`);
      console.log(`   Difference: $${debug.discrepancy.difference}`);
      console.log(`   Database Balance: $${debug.accountData.balance}`);
      console.log(`   History Sum: $${debug.calculatedBalance}`);
    } else {
      console.log(`\n✅ No discrepancy found - balance matches history`);
    }

    console.log('\n📋 Recent Balance Changes:');
    debug.recentEntries.forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.changeType}: ${entry.amount >= 0 ? '+' : ''}$${entry.amount}`);
      console.log(`      ${entry.previousBalance} → ${entry.newBalance}`);
      console.log(`      ${entry.notes}`);
      console.log(`      ${entry.date}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error.response?.data?.message || error.message);
    console.log('\n💡 To use this script:');
    console.log('1. Make sure the backend server is running');
    console.log('2. Get your auth token from the browser (login first)');
    console.log('3. Update userId, accountId, and authToken in this script');
    console.log('4. Run: node debug-balance.js');
  }
}

debugBalance();