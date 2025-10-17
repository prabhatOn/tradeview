# Phase 1 Implementation Guide - Database Migrations

## ✅ Status: READY TO RUN

The calculation in your image **perfectly aligns** with our roadmap formulas!

### Calculation Verification ✅

| Calculation | Image | Roadmap | Status |
|-------------|-------|---------|--------|
| Margin Required | $110,000 / 500 = $220 | (Lot × Contract × Price) / Leverage | ✅ MATCH |
| Position Value | 100,000 × 1.1 = $110,000 | Lot × Contract × Price | ✅ MATCH |
| Trading Power | Balance × 500 | Balance × Leverage | ✅ MATCH |
| Pip Value | $9.09 per pip | (Contract × Pip) / Price | ✅ MATCH |

---

## 🚀 Step 1: Database Migrations

### Files Created:

1. ✅ `database/migrations/001_enhance_trading_accounts.sql`
   - Adds `margin_used`, `margin_call_level`, `stop_out_level`
   - Adds `trading_power` (Balance × Leverage)
   - Adds `max_leverage`, `min_margin_requirement`
   - Adds indexes for performance

2. ✅ `database/migrations/002_enhance_positions.sql`
   - Adds `margin_required` (per position)
   - Adds `swap_long`, `swap_short`, `daily_swap_charge`
   - Adds `order_type` (market, limit, stop, stop_limit)
   - Adds `trigger_price`, `execution_price`, `slippage`
   - Adds `total_charges`, `net_profit`

3. ✅ `database/migrations/003_create_trading_charges.sql`
   - Creates flexible charges system
   - Adds tier-based pricing (standard, premium, vip, professional)
   - Creates commission structure
   - Creates user tier assignments

4. ✅ `backend/scripts/run-migrations.js`
   - Automated migration runner
   - Tracks migration history
   - Handles errors gracefully
   - Prevents duplicate runs

5. ✅ `database/migrations/README.md`
   - Complete migration guide
   - Troubleshooting section
   - Verification queries
   - Rollback procedures

---

## 📋 How to Run Migrations

### Prerequisites Check:

```bash
# 1. Check database connection
node -e "require('mysql2').createConnection({host:'localhost',user:'root',password:'your_pass',database:'your_db'}).connect(err=>console.log(err||'Connected!'))"

# 2. Verify mysql2 is installed
npm list mysql2
# If not installed: npm install mysql2
```

### Option 1: Automated Script (RECOMMENDED)

```bash
# Run all migrations automatically
node backend/scripts/run-migrations.js
```

**This will:**
- ✅ Connect to database
- ✅ Create migrations tracking table
- ✅ Run migrations in order (001, 002, 003)
- ✅ Skip already-run migrations
- ✅ Show progress with colors
- ✅ Stop on errors
- ✅ Display summary

### Option 2: Manual Execution

```bash
# Connect to MySQL
mysql -u root -p your_database_name

# Run each migration
source database/migrations/001_enhance_trading_accounts.sql;
source database/migrations/002_enhance_positions.sql;
source database/migrations/003_create_trading_charges.sql;
```

### Option 3: MySQL Workbench

1. Open MySQL Workbench
2. Connect to your database
3. File → Open SQL Script
4. Select `001_enhance_trading_accounts.sql`
5. Click Execute (⚡)
6. Repeat for 002 and 003

---

## ✅ Post-Migration Verification

After running migrations, verify everything worked:

```sql
-- 1. Check new columns in trading_accounts
DESCRIBE trading_accounts;
-- Should see: margin_used, margin_call_level, stop_out_level, trading_power

-- 2. Check new columns in positions
DESCRIBE positions;
-- Should see: margin_required, order_type, trigger_price, net_profit

-- 3. Check trading_charges table exists
SHOW TABLES LIKE 'trading_charges';

-- 4. Verify default charges inserted
SELECT 
    tier_level,
    charge_type,
    charge_value,
    charge_unit
FROM trading_charges
WHERE is_active = TRUE
ORDER BY tier_level, charge_type;

-- 5. Test margin calculation (using your example)
-- Expected: 1 lot EUR/USD @ 1.1000 with 1:500 leverage = $220 margin
SELECT 
    (1.0 * 100000 * 1.1000) / 500 as calculated_margin;
-- Should return: 220.0000

-- 6. Test trading power calculation
-- Expected: $1000 balance × 500 leverage = $500,000 trading power
SELECT 
    account_number,
    balance,
    leverage,
    trading_power,
    (balance * leverage) as calculated_trading_power
FROM trading_accounts
LIMIT 5;
```

---

## 🔍 Expected Results

### Trading Accounts Table (after migration 001):
```
+----------------------+---------------+
| Column               | Type          |
+----------------------+---------------+
| margin_used          | decimal(15,4) |
| margin_call_level    | decimal(5,2)  | ← Default: 50.00
| stop_out_level       | decimal(5,2)  | ← Default: 20.00
| trading_power        | decimal(15,4) | ← Balance × Leverage
| is_demo              | tinyint(1)    |
| max_leverage         | decimal(10,2) |
+----------------------+---------------+
```

### Positions Table (after migration 002):
```
+----------------------+---------------+
| Column               | Type          |
+----------------------+---------------+
| margin_required      | decimal(15,4) | ← (Lot × Contract × Price) / Leverage
| swap_long            | decimal(10,4) |
| swap_short           | decimal(10,4) |
| daily_swap_charge    | decimal(10,4) |
| carry_forward_charge | decimal(10,4) |
| spread_charge        | decimal(10,4) |
| total_charges        | decimal(10,4) |
| net_profit           | decimal(12,4) | ← Profit - All Charges
| order_type           | enum          | ← market, limit, stop, stop_limit
| trigger_price        | decimal(12,6) |
+----------------------+---------------+
```

### Trading Charges Table (after migration 003):
```sql
-- Sample data inserted
tier_level   | charge_type    | charge_value | charge_unit
-------------|----------------|--------------|------------
standard     | commission     | 7.00         | per_lot
premium      | commission     | 5.00         | per_lot
vip          | commission     | 3.00         | per_lot
standard     | carry_forward  | 2.50         | per_lot
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "Table 'trading_accounts' doesn't exist"
**Solution:** You're using the wrong database. Check:
```sql
SELECT DATABASE();
USE your_correct_database_name;
```

### Issue 2: "Column 'margin_used' already exists"
**Solution:** Migration already ran. Check:
```sql
SELECT * FROM migrations WHERE migration_name LIKE '001%';
```
If it shows success, you're good! If failed, you may need to rollback first.

### Issue 3: "Cannot modify column 'account_type' - demo accounts exist"
**Solution:** First update demo accounts:
```sql
-- Mark demo accounts
UPDATE trading_accounts SET is_demo = TRUE WHERE account_type = 'demo';
-- Change to live
UPDATE trading_accounts SET account_type = 'live' WHERE account_type = 'demo';
-- Then re-run migration
```

### Issue 4: mysql2 module not found
**Solution:**
```bash
cd backend
npm install mysql2
```

---

## 📊 What Happens After Migration?

After successful migration, your database will support:

✅ **Margin Calculations**
```javascript
margin_required = (lotSize × contractSize × price) / leverage
// Example: (1.0 × 100,000 × 1.1000) / 500 = $220
```

✅ **Trading Power**
```javascript
trading_power = balance × leverage
// Example: $1,000 × 500 = $500,000
```

✅ **Margin Level Monitoring**
```javascript
margin_level = (equity / margin_used) × 100
// Margin call at < 50%
// Stop out at < 20%
```

✅ **Order Types**
- Market orders (instant execution)
- Limit orders (buy below / sell above)
- Stop orders (buy above / sell below)
- Stop-limit orders (combination)

✅ **Charge Tracking**
- Commission per lot
- Swap charges (overnight)
- Carry forward charges
- Spread costs
- Net profit calculations

---

## 🎯 Next Steps After Migration

1. ✅ **Run Migrations** ← YOU ARE HERE
2. ⏳ **Update Backend Models** (TradingAccount.js, Position.js)
3. ⏳ **Create Services** (MarginService, LeverageService, SwapService)
4. ⏳ **Update API Routes**
5. ⏳ **Update Frontend**
6. ⏳ **Set Up Scheduled Jobs**
7. ⏳ **Test Everything**

---

## 🆘 Need Help?

If you encounter any issues:

1. Check the error message carefully
2. Look in `database/migrations/README.md` for solutions
3. Check migration tracking:
   ```sql
   SELECT * FROM migrations ORDER BY executed_at DESC;
   ```
4. Review the rollback section in each migration file
5. Test on a backup database first if unsure

---

## 🎉 Ready to Start?

Run this command now:

```bash
node backend/scripts/run-migrations.js
```

You should see:
```
╔════════════════════════════════════════════════╗
║   Production Trading System - Migrations      ║
╚════════════════════════════════════════════════╝

→ Connecting to database: localhost/trading_platform
✓ Connected successfully

✓ Migrations tracking table ready
→ Found 3 migration file(s)

→ Running migration: 001_enhance_trading_accounts
✓ Migration completed in 234ms

→ Running migration: 002_enhance_positions
✓ Migration completed in 456ms

→ Running migration: 003_create_trading_charges
✓ Migration completed in 123ms

=== Migration Summary ===
✓ Successful: 3
⊙ Skipped: 0
✗ Failed: 0

✓ All migrations completed successfully!
```

---

**Ready?** Let me know when you've run the migrations and I'll help you with the next phase! 🚀
