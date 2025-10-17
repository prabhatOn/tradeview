// Test margin calculation with leverage
const testMarginCalculation = () => {
  console.log('=== Margin Calculation Test ===\n');

  const scenarios = [
    {
      balance: 500,
      leverage: 1000,
      lotSize: 40.33,
      contractSize: 100000,
      price: 1.08458,
    },
    {
      balance: 500,
      leverage: 100,
      lotSize: 1,
      contractSize: 100000,
      price: 1.08458,
    },
    {
      balance: 500,
      leverage: 1000,
      lotSize: 1,
      contractSize: 100000,
      price: 1.08458,
    },
  ];

  scenarios.forEach((scenario, index) => {
    console.log(`Scenario ${index + 1}:`);
    console.log(`  Balance: $${scenario.balance}`);
    console.log(`  Leverage: 1:${scenario.leverage}`);
    console.log(`  Lot Size: ${scenario.lotSize}`);
    console.log(`  Contract Size: ${scenario.contractSize}`);
    console.log(`  Price: ${scenario.price}`);
    
    // Correct calculation
    const requiredMargin = (scenario.lotSize * scenario.contractSize * scenario.price) / scenario.leverage;
    console.log(`  Required Margin: $${requiredMargin.toFixed(2)}`);
    console.log(`  Available: $${scenario.balance}`);
    console.log(`  Can Trade: ${scenario.balance >= requiredMargin ? 'YES ✅' : 'NO ❌'}`);
    console.log(`  Free Margin After: $${(scenario.balance - requiredMargin).toFixed(2)}`);
    console.log();
  });
};

testMarginCalculation();
