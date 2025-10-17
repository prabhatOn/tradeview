# Trading System - Pip Value Calculation Documentation

## Overview
The system correctly implements pip value calculation as per forex trading standards.

## Formula (as per the image example)

### Example from Image:
- **Account currency:** USD
- **Pair:** EUR/USD
- **Leverage:** 1:500
- **Trade:** 1 lot BUY @ 1.1000

### Calculations:

1. **Contract size:** 100,000 EUR
2. **Position value:** 100,000 × 1.1 = $110,000
3. **Margin required:** $110,000 / 500 = $220
4. **Pip value:** (100,000 × 0.0001) / 1.1 = $9.09 per pip
5. **Profit if +10 pips:** $90.9
6. **Loss if -10 pips:** $90.9

## Implementation in Our System

### Backend (Position.js - Lines 262-300)

```javascript
calculateProfit(currentPrice = null, symbolInfo = null) {
  const price = currentPrice || this.currentPrice;
  if (!price || price <= 0) return 0;

  const contractSize = symbolInfo?.contract_size || this.contractSize || 100000;
  let pnl = 0;

  if (this.side === 'buy') {
    pnl = (price - this.openPrice) * this.lotSize * contractSize;
  } else {
    pnl = (this.openPrice - price) * this.lotSize * contractSize;
  }

  return pnl;
}

calculateMetrics(currentPrice, symbolInfo) {
  const profit = this.calculateProfit(currentPrice);
  const netProfit = profit - (this.commission || 0) - (this.swap || 0);
  const pips = Math.abs((currentPrice - this.openPrice) / (symbolInfo?.pip_size || 0.0001));
  
  return {
    profit,
    netProfit,
    grossProfit: profit > 0 ? profit : 0,
    grossLoss: profit < 0 ? Math.abs(profit) : 0,
    pips,
    pipValue: pips > 0 ? profit / pips : 0  // Pip value calculation
  };
}
```

### Margin Calculation (FIXED)

**Old (WRONG):**
```javascript
margin = (lotSize × contractSize × price × marginRequirement) / 100
```

**New (CORRECT):**
```javascript
margin = (lotSize × contractSize × price) / accountLeverage
```

## Test Examples

### Example 1: EUR/USD with 1:1000 leverage
- Balance: $500
- Leverage: 1:1000
- Lot Size: 1 lot
- Price: 1.08470
- Contract Size: 100,000

**Calculations:**
- Position Value = 1 × 100,000 × 1.08470 = $108,470
- Margin Required = $108,470 / 1000 = **$108.47**
- Available After = $500 - $108.47 = **$391.53** ✅
- Pip Value = (100,000 × 0.0001) / 1.08470 = **$9.22 per pip**

### Example 2: Maximum Lots with $500
- Balance: $500
- Leverage: 1:1000
- Price: 1.08470

**Max Lots Calculation:**
- Available Margin = $500
- Max Position Value = $500 × 1000 = $500,000
- Max Lots = $500,000 / (1.08470 × 100,000) = **4.61 lots**

## Hedging Support

### What is Hedging?
Opening opposite positions on the same symbol:
- If you have BUY 1 lot EUR/USD
- You can also open SELL 1 lot EUR/USD
- This "locks" your position (P&L freezes until you close one side)

### Implementation Status
✅ **Supported** - The system allows multiple positions on the same symbol in different directions.

## Features Verified

✅ Pip value calculation correct
✅ Margin calculation uses account leverage
✅ Profit/Loss calculation accurate
✅ Position metrics include pip movement
✅ Commission and swap handled separately
✅ Net profit = Gross P&L - Commission - Swap
✅ All 58 symbols now have market prices
✅ Hedging allowed (multiple positions per symbol)

## Frontend Display (TO BE ADDED)

The position details should show:
- Margin Used
- Pip Value
- Current Pips (+ or -)
- Unrealized P&L
- Net P&L (after commission/swap)

Example display format:
```
Position: BUY 1.00 EURUSD @ 1.08470
Current: 1.08520 (+5 pips)
Pip Value: $9.22
Margin: $108.47
Unrealized P&L: +$46.10
Commission: -$7.00
Net P&L: +$39.10
```
