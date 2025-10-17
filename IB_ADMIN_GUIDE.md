# IB Commission Management - Admin Panel Guide

## 📍 Location
**Admin Panel → Introducing Brokers**

URL: `http://localhost:3000/admin/introducing-brokers`

## ✨ Features Available

### 1️⃣ **IB Statistics Dashboard**
View all introducing brokers with key metrics:
- IB Name & Email
- Commission Share Percentage
- Tier Level
- Total Clients
- Total Trades
- Total Commission Earned
- IB Share Amount
- Admin Share Amount
- Status (Active/Inactive)

### 2️⃣ **Commission Management**
- View pending commissions
- See commission breakdown per IB
- Mark commissions as paid
- Filter by date range

### 3️⃣ **Edit IB Share Percentage**
- Click "Edit" button next to any IB
- Update share percentage (between min-max configured)
- Save changes instantly
- Percentage must be within global min/max limits

### 4️⃣ **Global IB Settings**
Configure global commission parameters:
- **Default Commission Rate**: Default percentage rate (e.g., 0.70%)
- **Default IB Share %**: Default share IBs receive (e.g., 50%)
- **Min IB Share %**: Minimum allowed share (e.g., 10%)
- **Max IB Share %**: Maximum allowed share (e.g., 90%)

## 🔧 How to Access

1. **Login as Admin**
   - Go to `http://localhost:3000/login`
   - Use admin credentials

2. **Navigate to IB Management**
   - Click "Introducing Brokers" in the admin sidebar
   - Or go directly to `/admin/introducing-brokers`

## 📊 Available Tabs

### Tab 1: IB List
- Shows all IBs with comprehensive stats
- Edit share percentage per IB
- View performance metrics

### Tab 2: Pending Commissions
- View all pending commission payments
- Commission details per trade
- Mark as paid functionality

### Tab 3: Global Settings
- Configure system-wide IB settings
- Update default rates
- Set min/max limits

## 🛠️ Backend API Endpoints

All available at: `http://localhost:3001/api/admin/ib/`

```
GET    /admin/ib/all                      - Get all IBs with stats
GET    /admin/ib/commissions/breakdown    - Get commission breakdown
GET    /admin/ib/commissions/pending      - Get pending commissions
GET    /admin/ib/global-settings          - Get global settings
PUT    /admin/ib/:id/share-percent        - Update IB share %
PUT    /admin/ib/global-settings          - Update global settings
PUT    /admin/ib/commissions/:id/mark-paid - Mark commission as paid
```

## 📋 Database Tables

### `introducing_brokers`
Stores IB relationships and configurations

### `ib_commissions`
Tracks individual commission transactions

### `ib_global_settings`
Stores global IB configuration:
- default_commission_rate
- default_ib_share_percent
- min_ib_share_percent
- max_ib_share_percent

## 🎯 Commission Calculation

```
Trade Volume = Lot Size × Contract Size × Close Price
Total Commission = Trade Volume × Commission Rate
IB Amount = Total Commission × (IB Share % / 100)
Admin Amount = Total Commission - IB Amount
```

### Example:
- Trade Volume: $100,000
- Commission Rate: 0.70% (0.0070)
- IB Share: 50%

```
Total Commission = $100,000 × 0.0070 = $700
IB Amount = $700 × 0.50 = $350
Admin Amount = $700 - $350 = $350
```

## ⚙️ Configuration Steps

1. **Set Global Defaults**
   - Go to "Global Settings" tab
   - Set default commission rate (e.g., 0.0070 for 0.70%)
   - Set default IB share (e.g., 50 for 50%)
   - Set min/max limits

2. **Customize Individual IBs**
   - Go to "IB List" tab
   - Click "Edit" on any IB
   - Adjust their specific share percentage
   - Must be within min/max limits

3. **Monitor Commissions**
   - Check "Pending Commissions" tab
   - Review commission details
   - Mark as paid when processed

## 🔍 Troubleshooting

### Can't see IB tab?
1. Make sure you're logged in as admin
2. Check user has admin role in database
3. Clear browser cache and refresh

### API errors?
1. Ensure backend is running on `http://localhost:3001`
2. Check backend console for errors
3. Verify database connection

### No data showing?
1. Check if there are any IBs in the database
2. Run: `SELECT * FROM introducing_brokers`
3. Create test IB relationships if needed

## 📝 Notes

- Only admins can access this panel
- All changes are logged in audit_logs table
- Commission rates are stored as decimals (0.0070 = 0.70%)
- Share percentages are stored as whole numbers (50 = 50%)

---

**Status**: ✅ Feature is implemented and ready to use
**Last Updated**: October 17, 2025
