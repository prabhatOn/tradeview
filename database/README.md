# Trading Platform Database Schema Documentation

## Overview

This database schema is designed for a comprehensive trading platform that supports:
- User management and authentication
- Multiple trading accounts per user
- Real-time trading with various financial instruments
- Deposit/withdrawal processing
- MAM/PAMM (Multi-Account Management/Percentage Allocation Management Module)
- Support ticket system
- Comprehensive audit logging and notifications

## Database Design Principles

The schema follows normalization principles (1NF, 2NF, 3NF) to ensure:
- **Data Integrity**: No data redundancy or inconsistency
- **Scalability**: Efficient queries and storage
- **Maintainability**: Easy to modify and extend
- **Performance**: Optimized with proper indexing

## Quick Reset Script

Use `cleanup_and_seed_admin.sql` whenever you need to wipe all user-generated data and reseed the platform with a default super admin account. The script:
- Truncates user/authentication, trading, transaction, IB, and support tables only if they exist
- Seeds core roles (`Super Admin`, `Admin`, `Manager`, `Trader`)
- Inserts an `admin@tradingplatform.com` user with password `admin123`
- Creates a live trading account with a \$100,000 balance and baseline balance history entry

> **How to run:**
> 1. Connect to the target database (e.g., `USE pro2;`).
> 2. Execute the script in a MySQL client (`SOURCE cleanup_and_seed_admin.sql;`).
> 3. Update the seeded admin password immediately after login.

## Table Structure Overview

### Core User Management
- `users` - Primary user information
- `roles` - User role definitions (Admin, VIP, Premium, etc.)
- `user_roles` - Many-to-many relationship between users and roles
- `user_addresses` - User billing/mailing addresses
- `user_settings` - User preferences and configuration

### Trading Account Management
- `trading_accounts` - Individual trading accounts (users can have multiple)
- `account_balance_history` - Audit trail for balance changes
- `symbols` - Financial instruments (EURUSD, BTCUSD, etc.)
- `asset_categories` - Grouping of symbols (Forex, Crypto, etc.)
- `market_prices` - Real-time price data
- `price_history` - Historical OHLC data

### Trading Operations
- `orders` - Pending orders (buy/sell requests)
- `positions` - Open trades/positions
- `trade_history` - Closed positions and completed trades
- `trading_sessions` - Market hours and trading sessions

### Financial Transactions
- `payment_methods` - Available payment processors
- `deposits` - Incoming funds transactions
- `withdrawals` - Outgoing funds transactions

### MAM/PAMM System
- `mam_pamm_masters` - Master trader accounts
- `mam_pamm_investors` - Investor accounts following masters
- `mam_pamm_performance` - Performance tracking

### Support & Communication
- `support_categories` - Ticket categorization
- `support_tickets` - Customer support requests
- `support_responses` - Ticket conversation history
- `notification_templates` - Email/SMS templates
- `user_notifications` - Individual user notifications
- `price_alerts` - User-defined price alerts

### System Management
- `system_settings` - Platform configuration
- `audit_logs` - System event logging

## Key Features

### 1. Normalized Data Structure
```sql
-- Users table (1NF) - Each field contains atomic values
-- User roles separated (2NF) - Eliminates partial dependencies
-- Address information separated (3NF) - Eliminates transitive dependencies
```

### 2. Comprehensive Indexing
```sql
-- Primary keys for all tables
-- Foreign key indexes for joins
-- Composite indexes for common query patterns
-- Full-text search for support tickets
```

### 3. Data Integrity
```sql
-- Foreign key constraints
-- Check constraints via triggers
-- Audit trail for sensitive operations
-- Balance validation triggers
```

### 4. Scalability Features
```sql
-- Partitioning-ready timestamp fields
-- JSON fields for flexible data storage
-- Separate historical data tables
-- Efficient view definitions
```

## Common Queries and Usage Examples

### 1. Get User Dashboard Data

```sql
-- Get user account overview
SELECT 
    u.first_name,
    u.last_name,
    ta.account_number,
    ta.balance,
    ta.equity,
    ta.free_margin,
    (SELECT COUNT(*) FROM positions WHERE account_id = ta.id AND status = 'open') as open_positions,
    (SELECT COALESCE(SUM(profit), 0) FROM positions WHERE account_id = ta.id AND status = 'open') as unrealized_pnl
FROM users u
JOIN trading_accounts ta ON u.id = ta.user_id
WHERE u.id = ? AND ta.account_type = 'live';
```

### 2. Get Market Overview Data

```sql
-- Get latest market prices with 24h change
SELECT 
    s.symbol,
    s.name,
    ac.name as category,
    mp.bid,
    mp.ask,
    mp.last,
    mp.change_amount,
    mp.change_percent,
    mp.volume
FROM symbols s
JOIN asset_categories ac ON s.category_id = ac.id
JOIN market_prices mp ON s.id = mp.symbol_id
WHERE s.is_active = 1
AND mp.timestamp = (
    SELECT MAX(timestamp) 
    FROM market_prices mp2 
    WHERE mp2.symbol_id = s.id
)
ORDER BY mp.volume DESC;
```

### 3. Get Trading History

```sql
-- Get user's trading history with performance metrics
SELECT 
    th.id,
    s.symbol,
    th.side,
    th.lot_size,
    th.open_price,
    th.close_price,
    th.profit,
    th.commission,
    th.swap,
    th.duration_minutes,
    th.opened_at,
    th.closed_at,
    CASE WHEN th.profit > 0 THEN 'WIN' ELSE 'LOSS' END as result
FROM trade_history th
JOIN symbols s ON th.symbol_id = s.id
JOIN trading_accounts ta ON th.account_id = ta.id
WHERE ta.user_id = ?
ORDER BY th.closed_at DESC
LIMIT 50;
```

### 4. Get Account Performance Summary

```sql
-- Get trading performance statistics
SELECT 
    COUNT(*) as total_trades,
    SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END) as winning_trades,
    SUM(CASE WHEN profit < 0 THEN 1 ELSE 0 END) as losing_trades,
    ROUND((SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as win_rate,
    SUM(profit) as total_pnl,
    SUM(commission) as total_commission,
    AVG(profit) as avg_profit_per_trade,
    MAX(profit) as best_trade,
    MIN(profit) as worst_trade
FROM trade_history th
JOIN trading_accounts ta ON th.account_id = ta.id
WHERE ta.user_id = ?
AND th.closed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY);
```

### 5. Get Pending Transactions

```sql
-- Get all pending deposits and withdrawals for admin dashboard
SELECT 
    'deposit' as type,
    d.id,
    d.transaction_id,
    u.first_name,
    u.last_name,
    u.email,
    d.amount,
    d.currency,
    pm.name as payment_method,
    d.status,
    d.created_at
FROM deposits d
JOIN users u ON d.user_id = u.id
JOIN payment_methods pm ON d.payment_method_id = pm.id
WHERE d.status = 'pending'

UNION ALL

SELECT 
    'withdrawal' as type,
    w.id,
    w.transaction_id,
    u.first_name,
    u.last_name,
    u.email,
    w.amount,
    w.currency,
    pm.name as payment_method,
    w.status,
    w.created_at
FROM withdrawals w
JOIN users u ON w.user_id = u.id
JOIN payment_methods pm ON w.payment_method_id = pm.id
WHERE w.status = 'pending'
ORDER BY created_at ASC;
```

### 6. Real-time Position Updates

```sql
-- Update position profit based on current market price
UPDATE positions p
JOIN symbols s ON p.symbol_id = s.id
JOIN market_prices mp ON s.id = mp.symbol_id
SET 
    p.current_price = CASE 
        WHEN p.side = 'buy' THEN mp.bid 
        ELSE mp.ask 
    END,
    p.profit = CASE 
        WHEN p.side = 'buy' THEN 
            (mp.bid - p.open_price) * p.lot_size * s.contract_size - p.commission + p.swap
        ELSE 
            (p.open_price - mp.ask) * p.lot_size * s.contract_size - p.commission + p.swap
    END,
    p.updated_at = CURRENT_TIMESTAMP
WHERE p.status = 'open'
AND mp.timestamp = (
    SELECT MAX(timestamp) 
    FROM market_prices mp2 
    WHERE mp2.symbol_id = s.id
);
```

## API Integration Patterns

### 1. User Dashboard API Response
```json
{
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "accounts": [
    {
      "id": 1,
      "accountNumber": "12345678",
      "type": "live",
      "balance": 15847.92,
      "equity": 16165.57,
      "freeMargin": 13397.92,
      "marginLevel": 659.2,
      "openPositions": 3,
      "unrealizedPnl": 317.65
    }
  ],
  "performance": {
    "totalTrades": 247,
    "winRate": 68.5,
    "totalPnl": 2847.65,
    "todayPnl": 317.65
  },
  "marketData": [
    {
      "symbol": "XAUUSD",
      "name": "Gold",
      "price": 3776.58,
      "change": 0.41,
      "changePercent": 0.41
    }
  ]
}
```

### 2. Trading Operations
```sql
-- Open new position
INSERT INTO positions (
    account_id, symbol_id, side, lot_size, open_price, 
    stop_loss, take_profit, commission, opened_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW());

-- Close position (use stored procedure)
CALL ClosePosition(position_id, close_price, 'manual');
```

## Performance Optimization

### 1. Indexing Strategy
- Primary keys on all tables
- Foreign key indexes for joins
- Composite indexes for common WHERE clauses
- Covering indexes for frequently selected columns

### 2. Query Optimization
- Use prepared statements to prevent SQL injection
- Implement query result caching for market data
- Use connection pooling for database connections
- Partition large tables by date ranges

### 3. Data Archiving
```sql
-- Archive old trade history (older than 2 years)
CREATE TABLE trade_history_archive LIKE trade_history;

INSERT INTO trade_history_archive 
SELECT * FROM trade_history 
WHERE closed_at < DATE_SUB(NOW(), INTERVAL 2 YEAR);

DELETE FROM trade_history 
WHERE closed_at < DATE_SUB(NOW(), INTERVAL 2 YEAR);
```

## Security Considerations

### 1. Data Protection
- Password hashing (use bcrypt in application)
- Sensitive data encryption at rest
- Audit logging for all critical operations
- Input validation and sanitization

### 2. Access Control
- Role-based permissions
- API rate limiting
- Session management
- Two-factor authentication support

### 3. Financial Data Integrity
- Transaction isolation levels
- Balance validation triggers
- Audit trails for all financial operations
- Backup and recovery procedures

## Deployment and Maintenance

### 1. Database Setup
```bash
# Create database
mysql -u root -p -e "CREATE DATABASE trading_platform;"

# Import schema
mysql -u root -p trading_platform < schema.sql

# Create application user
mysql -u root -p -e "
CREATE USER 'trading_app'@'localhost' IDENTIFIED BY 'secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON trading_platform.* TO 'trading_app'@'localhost';
FLUSH PRIVILEGES;"
```

### 2. Monitoring and Maintenance
```sql
-- Monitor table sizes
SELECT 
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.tables
WHERE table_schema = 'trading_platform'
ORDER BY (data_length + index_length) DESC;

-- Monitor slow queries
-- Enable slow query log in MySQL configuration
-- Analyze and optimize queries regularly
```

### 3. Backup Strategy
```bash
# Daily full backup
mysqldump --single-transaction --routines --triggers trading_platform > backup_$(date +%Y%m%d).sql

# Incremental backup using binary logs
# Point-in-time recovery capability
```

This schema provides a solid foundation for a trading platform with room for future enhancements and scalability requirements.