# Phase 2 Backend Services - Implementation Summary

## ✅ Completed Services

### 1. LeverageService.js
**Location:** `backend/services/LeverageService.js`

**Key Features:**
- Get available leverage options by account type (live: 1:500, professional: 1:1000, islamic: 1:200)
- Calculate maximum position size based on leverage and balance
- Validate leverage for account type
- Calculate margin percentage (e.g., 0.20% for 1:500)
- Calculate trading power (Balance × Leverage)
- Check if leverage change is safe for existing positions

**Main Methods:**
```javascript
getAvailableLeverages(accountType)
calculateMaxPositionSize(balance, leverage, price, contractSize)
validateLeverage(leverage, accountType)
calculateMarginPercentage(leverage)
calculateTradingPower(balance, leverage)
canChangeLeverage(currentLeverage, newLeverage, marginUsed, balance)
```

---

### 2. MarginService.js
**Location:** `backend/services/MarginService.js`

**Key Features:**
- Calculate required margin: `(Lot Size × Contract Size × Price) / Leverage`
- Check sufficient margin before opening positions
- Calculate margin level: `(Equity / Margin Used) × 100`
- Update account margin metrics automatically
- Trigger margin call warnings at 50%
- Execute stop out at 20% (closes positions automatically)
- Monitor free margin and equity

**Main Methods:**
```javascript
calculateRequiredMargin(lotSize, price, contractSize, leverage)
checkSufficientMargin(accountId, requiredMargin)
calculateMarginLevel(equity, marginUsed)
updateAccountMarginMetrics(accountId)
checkMarginCall(accountId)
triggerMarginCall(accountId, metrics, account)
triggerStopOut(accountId, metrics, account)
canOpenPosition(accountId, requiredMargin)
```

---

### 3. SwapService.js
**Location:** `backend/services/SwapService.js`

**Key Features:**
- Apply daily swap to all open positions at market close (5 PM EST)
- Triple swap on Wednesdays (includes weekend charges)
- Calculate swap based on position side (buy/sell) and lot size
- Log all swap charges to `swap_charges_log` table
- Deduct swap charges from account balance
- Get swap history and summaries

**Main Methods:**
```javascript
applyDailySwap() // Scheduled job function
calculateSwap(lotSize, swapRate)
getSwapRates(symbolId)
isTripleSwapDay() // Returns true on Wednesday
calculateSwapWithMultiplier(lotSize, swapRate, isTripleSwap)
getPositionSwapHistory(positionId)
getSwapSummary(dateFrom, dateTo)
calculateEstimatedSwap(symbolId, side, lotSize)
```

---

### 4. IBCommissionService.js
**Location:** `backend/services/IBCommissionService.js`

**Key Features:**
- Admin-configurable global commission rate (default: 0.70%)
- Individual IB share percentage (default: 50%, range: 10-90%)
- Automatic commission calculation on position close
- Split commission between IB and Admin
- Track commission history and pending payouts
- Support custom commission rates per IB

**Admin Controls:**
- Update global commission rate
- Set IB share percentage (10-90%)
- View all IBs with commission stats
- Mark commissions as paid
- Get pending commissions report

**Main Methods:**
```javascript
getGlobalSettings()
calculateCommission(position, tradeVolume)
recordCommission(position, tradeVolume)
getIBCommissionSummary(ibUserId, dateFrom, dateTo)
getIBCommissionList(ibUserId, limit, offset)
updateIBSharePercent(ibRelationshipId, newSharePercent, adminUserId)
updateGlobalSetting(settingKey, settingValue, adminUserId)
getAllIBsWithStats(dateFrom, dateTo)
markAsPaid(commissionId, paymentMethod, adminUserId)
getPendingCommissions()
calculateEstimatedCommission(accountId, tradeVolume)
```

**Commission Calculation Example:**
```
Trade Volume: $100,000
Commission Rate: 0.70% (0.0070)
IB Share: 50%

Total Commission = $100,000 × 0.0070 = $700
IB Amount = $700 × 0.50 = $350
Admin Amount = $700 - $350 = $350
```

---

## 📊 How Services Work Together

### Opening a Position:
1. **LeverageService** - Validates leverage for account type
2. **MarginService** - Calculates required margin
3. **MarginService** - Checks if sufficient free margin available
4. **ChargeService** - Calculates commission and spread charges
5. Position opens with all metrics tracked

### Daily Operations:
1. **SwapService** (5 PM EST) - Applies swap charges to all open positions
2. **MarginService** (every 30s) - Monitors margin levels
3. **ScheduledJobs** (every 5s) - Checks stop loss/take profit triggers
4. **ScheduledJobs** (every 10s) - Checks pending order triggers

### Closing a Position:
1. Position closes at current market price
2. Calculate gross profit and net profit (after charges)
3. **IBCommissionService** - Records commission split (IB vs Admin)
4. **MarginService** - Updates account margin metrics
5. **MarginService** - Checks if margin level is now safe

### Risk Management:
1. **MarginService** monitors margin level continuously
2. Margin Level < 50% → Trigger **Margin Call** (warning + log event)
3. Margin Level < 20% → Execute **Stop Out** (auto-close positions)
4. Log all events to `margin_events` table

---

## 🎯 Next Steps (Phase 3 - Trading Logic)

Now that all core services are ready, Phase 3 will implement:

1. **TradingService.js** - Main coordinator
   - `openPosition()` - Full validation and position creation
   - `closePosition()` - Close with commission calculation
   - `updateStopLoss()` - Modify SL
   - `updateTakeProfit()` - Modify TP

2. **Enhanced Position Model**
   - `calculateMargin()` - Calculate required margin
   - `calculateNetProfit()` - Gross profit minus all charges
   - `checkTriggers()` - Check SL/TP conditions

3. **Enhanced TradingAccount Model**
   - `calculateTradingPower()` - Balance × Leverage
   - `updateMarginMetrics()` - Update all margin fields
   - `checkMarginCall()` - Risk management

---

## 📁 Files Created in Phase 2

✅ `backend/services/LeverageService.js` (141 lines)
✅ `backend/services/MarginService.js` (354 lines)
✅ `backend/services/SwapService.js` (268 lines)
✅ `backend/services/IBCommissionService.js` (411 lines)

**Total:** ~1,174 lines of production-ready service code

---

## 🔧 Configuration Values

### Default Settings:
- **Margin Call Level:** 50%
- **Stop Out Level:** 20%
- **Default Commission Rate:** 0.70%
- **Default IB Share:** 50%
- **Min IB Share:** 10%
- **Max IB Share:** 90%

### Leverage Limits:
- **Live Accounts:** 1:1 to 1:500
- **Professional:** 1:1 to 1:1000
- **Islamic:** 1:1 to 1:200

### Swap Schedule:
- **Daily:** 5 PM EST (market close)
- **Triple Swap:** Wednesday (includes weekend)

---

## ✅ Phase 1 + Phase 2 Status

**Phase 1 (Database):** ✅ **100% Complete** - All 5 migrations executed successfully
**Phase 2 (Backend Services):** ✅ **~60% Complete** - Core services ready

**Ready to move to Phase 3: Trading Logic Implementation**
