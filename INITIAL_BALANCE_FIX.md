# Initial Balance Fix - Summary

## Problem
When users registered or were created by admin, they automatically received $100,000 in their trading account. This was a demo account setup that should not be used for live accounts.

## Solution
Changed all user creation flows to create accounts with **zero balance**. Users must now:
- Deposit funds through bank/payment gateway, OR
- Have admin manually add funds

## Changes Made

### 1. User Registration (backend/routes/auth.js - Line ~94)
**Before:**
```javascript
VALUES (?, ?, 'demo', 'USD', ?, 100000.00, 100000.00, 100000.00, 'active')
```

**After:**
```javascript
VALUES (?, ?, 'live', 'USD', ?, 0.00, 0.00, 0.00, 'active')
```

### 2. Admin User Creation (backend/routes/auth.js - Line ~330)
**Before:**
```javascript
VALUES (?, ?, 'demo', 'USD', ?, 100000.00, 100000.00, 100000.00, 'active')
```

**After:**
```javascript
VALUES (?, ?, 'live', 'USD', ?, 0.00, 0.00, 0.00, 'active')
```

### 3. User Model (backend/models/User.js - Line ~80)
**Before:**
```javascript
VALUES (?, ?, 'demo', 'USD', ?, 100000.00, 100000.00, 100000.00, 'active')
```

**After:**
```javascript
VALUES (?, ?, 'live', 'USD', ?, 0.00, 0.00, 0.00, 'active')
```

## Important Changes

1. **Balance**: Changed from $100,000.00 to $0.00
2. **Equity**: Changed from $100,000.00 to $0.00
3. **Free Margin**: Changed from $100,000.00 to $0.00
4. **Account Type**: Changed from 'demo' to 'live'

## How Users Can Get Funds Now

### Option 1: User Deposits
Users can deposit funds through:
- Bank transfer
- Payment gateway
- Available payment methods configured in admin

### Option 2: Admin Manual Funding
Admin can manually add funds to user accounts through:
- Admin Portal → Deposits/Withdrawals
- Select user and add manual deposit
- Specify amount and reason

## Testing Checklist

- [ ] Create new user via registration
- [ ] Verify account balance is $0.00
- [ ] Test admin creating new user
- [ ] Verify account balance is $0.00
- [ ] Test admin manual funding
- [ ] Test user deposit through payment gateway
- [ ] Verify users cannot trade with zero balance

## Date Applied
October 17, 2025
