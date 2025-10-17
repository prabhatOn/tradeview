# Database Migrations - Production Trading System

## Overview
This directory contains all database migration scripts for implementing the production-ready trading system with proper margin management, leverage calculations, IB commissions, and advanced position management.

## Migration Order

**IMPORTANT:** Migrations must be run in numerical order!

### Phase 1: Core Schema Enhancements

1. **001_enhance_trading_accounts.sql**
   - Adds margin tracking fields
   - Adds leverage and trading power calculations
   - Adds risk management levels (margin call, stop out)
   - Status: ✅ Ready to run

2. **002_enhance_positions.sql**
   - Adds advanced position management fields
   - Adds swap charge tracking
   - Adds order types (market, limit, stop)
   - Adds margin requirement per position
   - Status: ✅ Ready to run

3. **003_create_trading_charges.sql**
   - Creates flexible charges system
   - Adds tier-based pricing
   - Adds user tier assignments
   - Status: ✅ Ready to run

4. **004_enhance_ib_commission.sql**
   - Enhances IB commission system
   - Adds admin-configurable settings
   - Adds commission distribution tracking
   - Status: 🔄 To be created

5. **005_create_risk_management_logs.sql**
   - Creates margin event tracking
   - Creates swap charge logs
   - Adds audit trail for risk events
   - Status: 🔄 To be created

## How to Run Migrations

### Option 1: MySQL Command Line
```bash
# Connect to database
mysql -u your_username -p your_database_name

# Run migrations in order
source 001_enhance_trading_accounts.sql;
source 002_enhance_positions.sql;
source 003_create_trading_charges.sql;
source 004_enhance_ib_commission.sql;
source 005_create_risk_management_logs.sql;
```

### Option 2: MySQL Workbench
1. Open MySQL Workbench
2. Connect to your database
3. File → Open SQL Script
4. Select migration file
5. Execute (⚡ icon)
6. Verify success
7. Repeat for next migration

### Option 3: Node.js Script
```bash
# Create and run migration script
node backend/scripts/run-migrations.js
```

### Option 4: Using DBeaver/phpMyAdmin
1. Connect to database
2. Open SQL Editor
3. Copy migration content
4. Execute
5. Verify results

## Pre-Migration Checklist

Before running any migration:

- [ ] **Backup Database**: `mysqldump -u user -p database > backup_$(date +%Y%m%d).sql`
- [ ] **Test on Staging**: Run on staging environment first
- [ ] **Check Dependencies**: Ensure previous migrations completed
- [ ] **Verify Permissions**: User has ALTER, CREATE, INDEX privileges
- [ ] **Check Disk Space**: Ensure sufficient space for new columns/indexes
- [ ] **Plan Downtime**: Notify users if system needs to be offline
- [ ] **Review Rollback**: Understand rollback procedure for each migration

## Post-Migration Verification

After each migration:

```sql
-- 1. Check new columns exist
DESCRIBE trading_accounts;
DESCRIBE positions;
DESCRIBE trading_charges;

-- 2. Verify indexes were created
SHOW INDEX FROM trading_accounts;
SHOW INDEX FROM positions;

-- 3. Check data integrity
SELECT COUNT(*) FROM trading_accounts WHERE margin_used IS NULL;
SELECT COUNT(*) FROM positions WHERE margin_required IS NULL;

-- 4. Test calculations
SELECT 
    account_number,
    balance,
    leverage,
    trading_power,
    (balance * leverage) as calculated_trading_power
FROM trading_accounts
LIMIT 5;
```

## Migration Status Tracking

| Migration | Status | Date Run | Run By | Duration | Issues |
|-----------|--------|----------|--------|----------|--------|
| 001 | 🔄 Pending | - | - | - | - |
| 002 | 🔄 Pending | - | - | - | - |
| 003 | 🔄 Pending | - | - | - | - |
| 004 | ⏳ Not Created | - | - | - | - |
| 005 | ⏳ Not Created | - | - | - | - |

## Common Issues & Solutions

### Issue 1: Demo Account Type Error
**Error:** `Data truncated for column 'account_type'`
**Solution:** 
```sql
-- First mark demo accounts
UPDATE trading_accounts SET is_demo = TRUE WHERE account_type = 'demo';
-- Then change to 'live'
UPDATE trading_accounts SET account_type = 'live' WHERE account_type = 'demo';
-- Then run migration
```

### Issue 2: Foreign Key Constraint Failure
**Error:** `Cannot add foreign key constraint`
**Solution:** Check if referenced table/column exists and has matching data type

### Issue 3: Duplicate Index Name
**Error:** `Duplicate key name 'idx_margin_level'`
**Solution:** Index already exists, safe to skip or drop first:
```sql
DROP INDEX idx_margin_level ON trading_accounts;
```

### Issue 4: Column Already Exists
**Error:** `Duplicate column name 'margin_used'`
**Solution:** Migration already partially run. Check if can be skipped or needs cleanup.

## Rollback Procedures

Each migration includes a rollback script in comments at the bottom. To rollback:

```sql
-- Example: Rollback migration 001
ALTER TABLE trading_accounts
DROP COLUMN margin_used,
DROP COLUMN margin_call_level,
-- ... etc
```

**WARNING:** Rollback will lose data! Only use in emergencies.

## Performance Considerations

### Migration 001: ~5-30 seconds
- Adds columns (fast)
- Creates indexes (may be slow on large tables)
- Updates existing rows (depends on row count)

### Migration 002: ~10-60 seconds
- Adds many columns
- Creates multiple indexes
- Calculates margin for existing positions (slow if many positions)

### Migration 003: ~5-10 seconds
- Creates new tables (fast)
- Inserts default data (fast)

**Tip:** Run during low-traffic hours to minimize impact.

## Testing After Migrations

Run these tests after all migrations:

```sql
-- Test 1: Margin calculation
SELECT 
    p.id,
    p.lot_size,
    p.open_price,
    s.contract_size,
    ta.leverage,
    p.margin_required,
    (p.lot_size * s.contract_size * p.open_price / ta.leverage) as calculated_margin,
    CASE 
        WHEN ABS(p.margin_required - (p.lot_size * s.contract_size * p.open_price / ta.leverage)) < 0.01 
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as test_result
FROM positions p
JOIN symbols s ON p.symbol_id = s.id
JOIN trading_accounts ta ON p.account_id = ta.id
WHERE p.status = 'open'
LIMIT 10;

-- Test 2: Trading power
SELECT 
    account_number,
    balance,
    leverage,
    trading_power,
    (balance * leverage) as calculated_trading_power,
    CASE 
        WHEN ABS(trading_power - (balance * leverage)) < 0.01 
        THEN '✅ PASS' 
        ELSE '❌ FAIL' 
    END as test_result
FROM trading_accounts
LIMIT 10;

-- Test 3: Charges lookup
SELECT 
    tier_level,
    charge_type,
    charge_value,
    charge_unit
FROM trading_charges
WHERE is_active = TRUE
ORDER BY tier_level, charge_type;
```

## Support & Documentation

- **Full Roadmap**: `../PRODUCTION_TRADING_ROADMAP.md`
- **Calculation Examples**: See roadmap "Key Calculations Reference" section
- **Issues**: Create GitHub issue with `[Migration]` tag
- **Questions**: Contact dev team

## Next Steps After Phase 1 Migrations

After successfully running migrations 001-005:

1. ✅ Update backend models (TradingAccount.js, Position.js)
2. ✅ Create new services (LeverageService, MarginService, SwapService)
3. ✅ Implement trading logic with new calculations
4. ✅ Update API routes
5. ✅ Update frontend components
6. ✅ Set up scheduled jobs for swap charges
7. ✅ Test everything thoroughly

---

**Last Updated:** 2025-10-17
**Migration Phase:** 1 of 8
**Status:** In Progress 🔄
