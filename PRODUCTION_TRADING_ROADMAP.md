# Production-Ready Trading System Implementation Roadmap

## Overview
This roadmap outlines the complete implementation of a production-ready trading platform with proper position management, leverage calculations, fund management, IB commission system, and real trading mechanics.

**Timeline:** 6-8 weeks for complete implementation
**Priority:** HIGH - Critical for production deployment

---

## 🎯 Core Requirements Summary

### 1. Real Trading Account System (No Demo)
- Remove demo trading functionality
- Implement live account types with proper risk management
- Real fund management with actual money tracking
- Proper leverage system (1:50, 1:100, 1:200, 1:500, etc.)

### 2. Advanced Position Management
- Stop Loss & Take Profit automation
- Limit Orders & Stop Orders
- Long/Short positions with proper spread calculation
- Swap charges (overnight holding fees)
- Carry forward charges for multi-day trades
- Margin calculations based on leverage
- Position partial closing

### 3. Fund & Margin System
- Proper leverage-based trading power calculation
- Margin requirement calculation
- Free margin tracking
- Margin call and stop-out levels
- Fund segregation (available vs. used margin)

### 4. IB Commission System
- Admin-configurable global commission rate
- IB-specific share percentage (e.g., 50% of commission)
- Automatic commission calculation on trades
- Commission distribution (IB share vs. Admin share)
- Real-time commission tracking
- Historical commission reports

### 5. Brokerage & Charges
- Spread markup (bid-ask spread)
- Commission per lot
- Swap charges (long/short)
- Overnight rollover fees
- Currency conversion fees
- Withdrawal/deposit fees

---

## 📋 Phase 1: Database Schema Enhancements (Week 1)

### 1.1 Update Trading Accounts Table
**File:** `database/migrations/001_enhance_trading_accounts.sql`

```sql
-- Add new columns to trading_accounts
ALTER TABLE trading_accounts
ADD COLUMN margin_used DECIMAL(15,4) DEFAULT 0.0000 AFTER free_margin,
ADD COLUMN margin_call_level DECIMAL(5,2) DEFAULT 50.00 AFTER margin_level,
ADD COLUMN stop_out_level DECIMAL(5,2) DEFAULT 20.00 AFTER margin_call_level,
ADD COLUMN trading_power DECIMAL(15,4) DEFAULT 0.0000 AFTER leverage,
ADD COLUMN is_demo BOOLEAN DEFAULT FALSE AFTER account_type,
ADD COLUMN max_leverage DECIMAL(10,2) DEFAULT 100.00 AFTER leverage,
ADD COLUMN min_margin_requirement DECIMAL(8,4) DEFAULT 1.0000,
MODIFY COLUMN account_type ENUM('live', 'islamic', 'professional') NOT NULL;

-- Add index for performance
CREATE INDEX idx_margin_level ON trading_accounts(margin_level);
CREATE INDEX idx_is_demo ON trading_accounts(is_demo);
```

### 1.2 Enhance Positions Table
**File:** `database/migrations/002_enhance_positions.sql`

```sql
-- Add advanced position fields
ALTER TABLE positions
ADD COLUMN margin_required DECIMAL(15,4) DEFAULT 0.0000 AFTER lot_size,
ADD COLUMN swap_long DECIMAL(10,4) DEFAULT 0.0000 AFTER swap,
ADD COLUMN swap_short DECIMAL(10,4) DEFAULT 0.0000 AFTER swap_long,
ADD COLUMN daily_swap_charge DECIMAL(10,4) DEFAULT 0.0000 AFTER swap_short,
ADD COLUMN days_held INT DEFAULT 0 AFTER daily_swap_charge,
ADD COLUMN carry_forward_charge DECIMAL(10,4) DEFAULT 0.0000 AFTER days_held,
ADD COLUMN spread_charge DECIMAL(10,4) DEFAULT 0.0000 AFTER carry_forward_charge,
ADD COLUMN total_charges DECIMAL(10,4) DEFAULT 0.0000 AFTER spread_charge,
ADD COLUMN net_profit DECIMAL(12,4) DEFAULT 0.0000 AFTER profit,
ADD COLUMN order_type ENUM('market', 'limit', 'stop', 'stop_limit') DEFAULT 'market' AFTER side,
ADD COLUMN trigger_price DECIMAL(12,6) NULL AFTER open_price,
ADD COLUMN is_triggered BOOLEAN DEFAULT FALSE AFTER trigger_price,
ADD COLUMN execution_price DECIMAL(12,6) NULL AFTER is_triggered,
ADD COLUMN slippage DECIMAL(10,4) DEFAULT 0.0000 AFTER execution_price,
MODIFY COLUMN status ENUM('pending', 'open', 'closed', 'partially_closed', 'cancelled', 'expired') DEFAULT 'pending';

-- Add indexes
CREATE INDEX idx_order_type ON positions(order_type);
CREATE INDEX idx_is_triggered ON positions(is_triggered);
CREATE INDEX idx_days_held ON positions(days_held);
```

### 1.3 Create Trading Charges Table
**File:** `database/migrations/003_create_trading_charges.sql`

```sql
-- Comprehensive trading charges configuration
CREATE TABLE IF NOT EXISTS trading_charges (
    id INT PRIMARY KEY AUTO_INCREMENT,
    symbol_id INT NULL,
    account_type ENUM('live', 'islamic', 'professional') NULL,
    tier_level ENUM('standard', 'premium', 'vip', 'professional') DEFAULT 'standard',
    charge_type ENUM('commission', 'spread', 'swap_long', 'swap_short', 'carry_forward', 'overnight_fee') NOT NULL,
    charge_value DECIMAL(10,4) NOT NULL,
    charge_unit ENUM('per_lot', 'percentage', 'fixed', 'pips') DEFAULT 'per_lot',
    is_active BOOLEAN DEFAULT TRUE,
    effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    effective_until TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
    INDEX idx_symbol_charge (symbol_id, charge_type),
    INDEX idx_account_type (account_type),
    INDEX idx_tier_level (tier_level),
    INDEX idx_active (is_active)
);

-- Insert default charges
INSERT INTO trading_charges (symbol_id, charge_type, charge_value, charge_unit) VALUES
(NULL, 'commission', 7.00, 'per_lot'),
(NULL, 'carry_forward', 2.50, 'per_lot'),
(NULL, 'overnight_fee', 1.00, 'per_lot');
```

### 1.4 Enhance IB Commission System
**File:** `database/migrations/004_enhance_ib_commission.sql`

```sql
-- Add admin-configurable IB settings
CREATE TABLE IF NOT EXISTS ib_global_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value DECIMAL(10,4) NOT NULL,
    setting_description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_setting_key (setting_key)
);

-- Insert default IB settings
INSERT INTO ib_global_settings (setting_key, setting_value, setting_description) VALUES
('default_commission_rate', 0.0070, 'Default commission rate as percentage (0.70%)'),
('default_ib_share_percent', 50.00, 'Default percentage of commission that IBs receive'),
('min_ib_share_percent', 10.00, 'Minimum IB share percentage'),
('max_ib_share_percent', 90.00, 'Maximum IB share percentage');

-- Update introducing_brokers table
ALTER TABLE introducing_brokers
ADD COLUMN custom_commission_rate DECIMAL(10,4) NULL AFTER commission_rate,
ADD COLUMN use_custom_rate BOOLEAN DEFAULT FALSE AFTER custom_commission_rate,
ADD COLUMN total_admin_share DECIMAL(15,4) DEFAULT 0.0000 AFTER total_commission_earned,
ADD COLUMN total_ib_share DECIMAL(15,4) DEFAULT 0.0000 AFTER total_admin_share,
ADD COLUMN last_commission_date TIMESTAMP NULL AFTER total_ib_share,
MODIFY COLUMN ib_share_percent DECIMAL(5,2) DEFAULT 50.00 NOT NULL;

-- Enhance IB commissions table
CREATE TABLE IF NOT EXISTS ib_commissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ib_relationship_id INT NOT NULL,
    trade_id INT NULL,
    position_id INT NULL,
    trade_volume DECIMAL(15,4) NOT NULL,
    commission_rate DECIMAL(10,4) NOT NULL,
    total_commission DECIMAL(15,4) NOT NULL,
    ib_share_percent DECIMAL(5,2) NOT NULL,
    ib_amount DECIMAL(15,4) NOT NULL,
    admin_amount DECIMAL(15,4) NOT NULL,
    client_commission DECIMAL(15,4) DEFAULT 0.0000,
    status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (ib_relationship_id) REFERENCES introducing_brokers(id) ON DELETE CASCADE,
    FOREIGN KEY (trade_id) REFERENCES trade_history(id) ON DELETE SET NULL,
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL,
    INDEX idx_ib_relationship (ib_relationship_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);
```

### 1.5 Create Margin Call & Stop Out Logs
**File:** `database/migrations/005_create_risk_management_logs.sql`

```sql
-- Track margin calls and stop outs
CREATE TABLE IF NOT EXISTS margin_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    account_id INT NOT NULL,
    event_type ENUM('margin_call', 'stop_out', 'margin_warning') NOT NULL,
    margin_level DECIMAL(8,2) NOT NULL,
    equity DECIMAL(15,4) NOT NULL,
    margin_used DECIMAL(15,4) NOT NULL,
    free_margin DECIMAL(15,4) NOT NULL,
    positions_closed INT DEFAULT 0,
    total_loss DECIMAL(15,4) DEFAULT 0.0000,
    notification_sent BOOLEAN DEFAULT FALSE,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE,
    INDEX idx_account_event (account_id, event_type),
    INDEX idx_resolved (resolved),
    INDEX idx_created_at (created_at)
);

-- Track swap charges applied
CREATE TABLE IF NOT EXISTS swap_charges_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    position_id INT NOT NULL,
    charge_date DATE NOT NULL,
    swap_rate DECIMAL(10,4) NOT NULL,
    swap_amount DECIMAL(10,4) NOT NULL,
    position_side ENUM('buy', 'sell') NOT NULL,
    lot_size DECIMAL(8,4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_position_date (position_id, charge_date),
    INDEX idx_position (position_id),
    INDEX idx_charge_date (charge_date)
);
```

---

## 📋 Phase 2: Backend Models & Services (Week 2-3)

### 2.1 Enhanced TradingAccount Model
**File:** `backend/models/TradingAccount.js`

**Key Methods to Add:**
```javascript
// Calculate trading power based on leverage
calculateTradingPower() {
    return this.balance * this.leverage;
}

// Calculate margin requirement for a position
calculateMarginRequired(lotSize, price, contractSize, leverage) {
    const positionValue = lotSize * contractSize * price;
    return positionValue / leverage;
}

// Update margin metrics
async updateMarginMetrics() {
    const openPositions = await this.getOpenPositions();
    const marginUsed = openPositions.reduce((sum, pos) => sum + pos.marginRequired, 0);
    const equity = this.balance + await this.getUnrealizedPnL();
    const freeMargin = equity - marginUsed;
    const marginLevel = marginUsed > 0 ? (equity / marginUsed) * 100 : 0;
    
    // Update in database
}

// Check for margin call
async checkMarginCall() {
    await this.updateMarginMetrics();
    if (this.marginLevel < this.marginCallLevel) {
        // Trigger margin call warning
    }
}

// Execute stop out
async executeStopOut() {
    if (this.marginLevel < this.stopOutLevel) {
        // Close positions starting with biggest loss
    }
}
```

### 2.2 Enhanced Position Model
**File:** `backend/models/Position.js`

**Key Methods to Add:**
```javascript
// Calculate margin required for position
calculateMargin(accountLeverage) {
    const positionValue = this.lotSize * this.contractSize * this.openPrice;
    this.marginRequired = positionValue / accountLeverage;
    return this.marginRequired;
}

// Calculate swap charge
calculateSwapCharge(swapRate, isLong) {
    const rate = isLong ? swapRate.long : swapRate.short;
    return (this.lotSize * rate);
}

// Apply daily swap
async applyDailySwap() {
    const swapCharge = this.calculateSwapCharge();
    this.swap += swapCharge;
    this.totalCharges += swapCharge;
    // Log to swap_charges_log
}

// Calculate spread charge
calculateSpreadCharge(bid, ask) {
    const spreadPips = (ask - bid) / this.pipSize;
    this.spreadCharge = spreadPips * this.lotSize * (this.contractSize / 100);
    return this.spreadCharge;
}

// Calculate net profit including all charges
calculateNetProfit() {
    const grossProfit = this.calculateProfit();
    this.netProfit = grossProfit - this.commission - this.swap - this.carryForwardCharge - this.spreadCharge;
    return this.netProfit;
}

// Check and trigger stop loss/take profit
async checkTriggers(currentPrice) {
    if (this.stopLoss && this.shouldTriggerStopLoss(currentPrice)) {
        await this.close('stop_loss', currentPrice);
    }
    if (this.takeProfit && this.shouldTriggerTakeProfit(currentPrice)) {
        await this.close('take_profit', currentPrice);
    }
}

// Check if limit/stop order should be triggered
async checkPendingOrderTrigger(currentPrice) {
    if (this.status === 'pending' && !this.isTriggered) {
        if (this.shouldTriggerOrder(currentPrice)) {
            await this.triggerOrder(currentPrice);
        }
    }
}
```

### 2.3 Create LeverageService
**File:** `backend/services/LeverageService.js`

```javascript
class LeverageService {
    // Get available leverage options based on account type
    static getAvailableLeverages(accountType) {
        const leverageOptions = {
            live: [1, 10, 20, 25, 50, 100, 200, 500],
            professional: [1, 10, 20, 25, 50, 100, 200, 500, 1000],
            islamic: [1, 10, 20, 25, 50, 100, 200]
        };
        return leverageOptions[accountType] || [1, 10, 50, 100];
    }

    // Calculate maximum position size based on leverage and balance
    static calculateMaxPositionSize(balance, leverage, price, contractSize) {
        const tradingPower = balance * leverage;
        const maxLots = tradingPower / (price * contractSize);
        return maxLots;
    }

    // Validate leverage for account
    static validateLeverage(leverage, accountType) {
        const available = this.getAvailableLeverages(accountType);
        return available.includes(leverage);
    }

    // Calculate margin requirement percentage
    static calculateMarginPercentage(leverage) {
        return (100 / leverage).toFixed(2);
    }
}
```

### 2.4 Create MarginService
**File:** `backend/services/MarginService.js`

```javascript
class MarginService {
    // Calculate required margin for opening position
    static calculateRequiredMargin(lotSize, price, contractSize, leverage) {
        const notionalValue = lotSize * contractSize * price;
        return notionalValue / leverage;
    }

    // Check if account has sufficient margin
    static async checkSufficientMargin(accountId, requiredMargin) {
        const account = await TradingAccount.findById(accountId);
        await account.updateMarginMetrics();
        return account.freeMargin >= requiredMargin;
    }

    // Calculate margin level
    static calculateMarginLevel(equity, marginUsed) {
        if (marginUsed === 0) return 0;
        return (equity / marginUsed) * 100;
    }

    // Check for margin call conditions
    static async checkMarginCall(accountId) {
        const account = await TradingAccount.findById(accountId);
        const marginLevel = await account.calculateMarginLevel();
        
        if (marginLevel < account.marginCallLevel && marginLevel >= account.stopOutLevel) {
            await this.triggerMarginCall(account);
        } else if (marginLevel < account.stopOutLevel) {
            await this.triggerStopOut(account);
        }
    }

    // Trigger margin call warning
    static async triggerMarginCall(account) {
        // Log event
        await executeQuery(`
            INSERT INTO margin_events (account_id, event_type, margin_level, equity, margin_used, free_margin)
            VALUES (?, 'margin_call', ?, ?, ?, ?)
        `, [account.id, account.marginLevel, account.equity, account.marginUsed, account.freeMargin]);
        
        // Send notification
        await NotificationService.sendMarginCallWarning(account.userId, account);
    }

    // Execute stop out
    static async triggerStopOut(account) {
        const positions = await Position.findByAccountId(account.id);
        // Sort by loss (biggest loss first)
        positions.sort((a, b) => a.profit - b.profit);
        
        let closedPositions = 0;
        let totalLoss = 0;
        
        for (const position of positions) {
            if (account.marginLevel >= account.stopOutLevel) break;
            
            await position.close('margin_call');
            closedPositions++;
            totalLoss += position.profit;
            
            await account.updateMarginMetrics();
        }
        
        // Log event
        await executeQuery(`
            INSERT INTO margin_events 
            (account_id, event_type, margin_level, equity, margin_used, free_margin, positions_closed, total_loss)
            VALUES (?, 'stop_out', ?, ?, ?, ?, ?, ?)
        `, [account.id, account.marginLevel, account.equity, account.marginUsed, account.freeMargin, closedPositions, totalLoss]);
        
        // Send notification
        await NotificationService.sendStopOutNotification(account.userId, account, closedPositions, totalLoss);
    }
}
```

### 2.5 Create SwapService
**File:** `backend/services/SwapService.js`

```javascript
class SwapService {
    // Apply daily swap to all open positions
    static async applyDailySwap() {
        const openPositions = await executeQuery(`
            SELECT p.*, s.swap_long, s.swap_short
            FROM positions p
            JOIN symbols s ON p.symbol_id = s.id
            WHERE p.status = 'open'
        `);
        
        for (const posData of openPositions) {
            const position = new Position(posData);
            const swapRate = position.side === 'buy' ? posData.swap_long : posData.swap_short;
            const swapCharge = position.lotSize * swapRate;
            
            // Update position
            await executeQuery(`
                UPDATE positions
                SET swap = swap + ?,
                    daily_swap_charge = ?,
                    days_held = days_held + 1,
                    total_charges = total_charges + ?
                WHERE id = ?
            `, [swapCharge, swapCharge, swapCharge, position.id]);
            
            // Log swap charge
            await executeQuery(`
                INSERT INTO swap_charges_log
                (position_id, charge_date, swap_rate, swap_amount, position_side, lot_size)
                VALUES (?, CURDATE(), ?, ?, ?, ?)
            `, [position.id, swapRate, swapCharge, position.side, position.lotSize]);
            
            // Update account balance
            const account = await TradingAccount.findById(position.accountId);
            await account.updateBalance(
                account.balance - swapCharge,
                'swap',
                -swapCharge,
                position.id,
                'position',
                `Daily swap charge for position #${position.id}`
            );
        }
    }

    // Calculate swap for specific position
    static calculateSwap(lotSize, swapRate) {
        return lotSize * swapRate;
    }

    // Get swap rates for symbol
    static async getSwapRates(symbolId) {
        const result = await executeQuery(
            'SELECT swap_long, swap_short FROM symbols WHERE id = ?',
            [symbolId]
        );
        return result[0] || { swap_long: 0, swap_short: 0 };
    }

    // Check if today is swap triple day (Wednesday)
    static isTripleSwapDay() {
        const today = new Date().getDay();
        return today === 3; // Wednesday
    }

    // Calculate swap with triple consideration
    static calculateSwapWithMultiplier(lotSize, swapRate) {
        const multiplier = this.isTripleSwapDay() ? 3 : 1;
        return lotSize * swapRate * multiplier;
    }
}
```

### 2.6 Enhanced IBCommissionService
**File:** `backend/services/IBCommissionService.js`

```javascript
class IBCommissionService {
    // Get global IB settings
    static async getGlobalSettings() {
        const settings = await executeQuery('SELECT * FROM ib_global_settings WHERE is_active = TRUE');
        return settings.reduce((acc, setting) => {
            acc[setting.setting_key] = parseFloat(setting.setting_value);
            return acc;
        }, {});
    }

    // Calculate commission for a trade
    static async calculateCommission(position, tradeVolume) {
        const globalSettings = await this.getGlobalSettings();
        
        // Get IB relationship
        const ibRelationship = await executeQuery(`
            SELECT ib.*, u.id as client_user_id
            FROM introducing_brokers ib
            JOIN trading_accounts ta ON ta.user_id = ib.client_user_id
            WHERE ta.id = ? AND ib.status = 'active'
            LIMIT 1
        `, [position.accountId]);
        
        if (!ibRelationship.length) return null;
        
        const ib = ibRelationship[0];
        
        // Determine commission rate
        const commissionRate = ib.use_custom_rate && ib.custom_commission_rate
            ? ib.custom_commission_rate
            : (ib.commission_rate || globalSettings.default_commission_rate);
        
        // Calculate total commission
        const totalCommission = tradeVolume * commissionRate;
        
        // Calculate IB share
        const ibSharePercent = ib.ib_share_percent || globalSettings.default_ib_share_percent;
        const ibAmount = totalCommission * (ibSharePercent / 100);
        const adminAmount = totalCommission - ibAmount;
        
        return {
            ibRelationshipId: ib.id,
            commissionRate,
            totalCommission,
            ibSharePercent,
            ibAmount,
            adminAmount,
            tradeVolume
        };
    }

    // Record commission after trade closes
    static async recordCommission(position, tradeVolume) {
        const commissionData = await this.calculateCommission(position, tradeVolume);
        
        if (!commissionData) return null;
        
        // Insert commission record
        const result = await executeQuery(`
            INSERT INTO ib_commissions
            (ib_relationship_id, position_id, trade_volume, commission_rate, 
             total_commission, ib_share_percent, ib_amount, admin_amount, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `, [
            commissionData.ibRelationshipId,
            position.id,
            commissionData.tradeVolume,
            commissionData.commissionRate,
            commissionData.totalCommission,
            commissionData.ibSharePercent,
            commissionData.ibAmount,
            commissionData.adminAmount
        ]);
        
        // Update IB totals
        await executeQuery(`
            UPDATE introducing_brokers
            SET total_commission_earned = total_commission_earned + ?,
                total_ib_share = total_ib_share + ?,
                total_admin_share = total_admin_share + ?,
                last_commission_date = NOW()
            WHERE id = ?
        `, [
            commissionData.totalCommission,
            commissionData.ibAmount,
            commissionData.adminAmount,
            commissionData.ibRelationshipId
        ]);
        
        return result.insertId;
    }

    // Get IB commission summary
    static async getIBCommissionSummary(ibUserId, dateFrom = null, dateTo = null) {
        let dateFilter = '';
        const params = [ibUserId];
        
        if (dateFrom && dateTo) {
            dateFilter = 'AND ic.created_at BETWEEN ? AND ?';
            params.push(dateFrom, dateTo);
        }
        
        const summary = await executeQuery(`
            SELECT 
                COUNT(ic.id) as total_trades,
                SUM(ic.trade_volume) as total_volume,
                SUM(ic.total_commission) as total_commission,
                SUM(ic.ib_amount) as total_ib_amount,
                SUM(ic.admin_amount) as total_admin_amount,
                AVG(ic.commission_rate) as avg_commission_rate,
                AVG(ic.ib_share_percent) as avg_ib_share
            FROM ib_commissions ic
            JOIN introducing_brokers ib ON ic.ib_relationship_id = ib.id
            WHERE ib.ib_user_id = ? ${dateFilter}
        `, params);
        
        return summary[0];
    }

    // Update IB share percentage (Admin only)
    static async updateIBSharePercent(ibRelationshipId, newSharePercent, adminUserId) {
        const globalSettings = await this.getGlobalSettings();
        
        // Validate percentage
        if (newSharePercent < globalSettings.min_ib_share_percent || 
            newSharePercent > globalSettings.max_ib_share_percent) {
            throw new Error(`IB share must be between ${globalSettings.min_ib_share_percent}% and ${globalSettings.max_ib_share_percent}%`);
        }
        
        await executeQuery(`
            UPDATE introducing_brokers
            SET ib_share_percent = ?,
                updated_at = NOW()
            WHERE id = ?
        `, [newSharePercent, ibRelationshipId]);
        
        // Log audit
        await executeQuery(`
            INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
            VALUES (?, 'update_ib_share', 'introducing_brokers', ?, ?)
        `, [adminUserId, ibRelationshipId, JSON.stringify({ ib_share_percent: newSharePercent })]);
    }

    // Update global commission settings (Admin only)
    static async updateGlobalSetting(settingKey, settingValue, adminUserId) {
        await executeQuery(`
            UPDATE ib_global_settings
            SET setting_value = ?,
                updated_at = NOW()
            WHERE setting_key = ?
        `, [settingValue, settingKey]);
        
        // Log audit
        await executeQuery(`
            INSERT INTO audit_logs (user_id, action, table_name, new_values)
            VALUES (?, 'update_ib_global_setting', 'ib_global_settings', ?)
        `, [adminUserId, JSON.stringify({ [settingKey]: settingValue })]);
    }
}
```

---

## 📋 Phase 3: Trading Logic Implementation (Week 3-4)

### 3.1 Enhanced Position Opening Logic
**File:** `backend/services/TradingService.js`

```javascript
// Open position with full validation and calculations
static async openPosition(userId, accountId, positionData) {
    const account = await TradingAccount.findByIdAndUserId(accountId, userId);
    if (!account) throw new AppError('Account not found', 404);
    
    // Get symbol data
    const symbolData = await this.getSymbolData(positionData.symbolId);
    
    // Get current market price
    const currentPrice = await MarketService.getCurrentPrice(positionData.symbolId);
    const executionPrice = positionData.side === 'buy' ? currentPrice.ask : currentPrice.bid;
    
    // Calculate margin required
    const marginRequired = MarginService.calculateRequiredMargin(
        positionData.lotSize,
        executionPrice,
        symbolData.contract_size,
        account.leverage
    );
    
    // Check if account has sufficient margin
    if (!await MarginService.checkSufficientMargin(accountId, marginRequired)) {
        throw new AppError('Insufficient margin', 400);
    }
    
    // Calculate charges
    const commission = ChargeService.calculateCommission(positionData.lotSize, symbolData);
    const spreadCharge = this.calculateSpread(currentPrice.bid, currentPrice.ask, positionData.lotSize, symbolData);
    
    // Validate stop loss and take profit
    this.validateStopLossAndTakeProfit(positionData, executionPrice, positionData.side);
    
    // Create position
    const position = await Position.create({
        accountId,
        symbolId: positionData.symbolId,
        side: positionData.side,
        lotSize: positionData.lotSize,
        openPrice: executionPrice,
        stopLoss: positionData.stopLoss,
        takeProfit: positionData.takeProfit,
        commission,
        spreadCharge,
        marginRequired,
        orderType: positionData.orderType || 'market',
        triggerPrice: positionData.triggerPrice,
        status: positionData.orderType === 'market' ? 'open' : 'pending'
    });
    
    // Update account margin
    await account.updateMarginMetrics();
    
    // Check margin level
    await MarginService.checkMarginCall(accountId);
    
    return position;
}
```

### 3.2 Enhanced Position Closing Logic

```javascript
// Close position with commission calculation
static async closePosition(userId, positionId, closeReason = 'manual') {
    const position = await Position.findById(positionId);
    if (!position) throw new AppError('Position not found', 404);
    
    // Verify ownership
    if (position.userId !== userId) throw new AppError('Unauthorized', 403);
    
    // Get current price
    const currentPrice = await MarketService.getCurrentPrice(position.symbolId);
    const closePrice = position.side === 'buy' ? currentPrice.bid : currentPrice.ask;
    
    // Calculate final profit
    const grossProfit = position.calculateProfit(closePrice);
    const netProfit = position.calculateNetProfit();
    
    // Calculate trade volume for commission
    const tradeVolume = position.lotSize * position.contractSize * closePrice;
    
    // Close position in database
    await executeQuery(`
        UPDATE positions
        SET status = 'closed',
            close_price = ?,
            current_price = ?,
            profit = ?,
            net_profit = ?,
            close_reason = ?,
            closed_at = NOW(),
            close_time = NOW()
        WHERE id = ?
    `, [closePrice, closePrice, grossProfit, netProfit, closeReason, position.id]);
    
    // Update account balance
    const account = await TradingAccount.findById(position.accountId);
    await account.updateBalance(
        account.balance + netProfit,
        netProfit >= 0 ? 'trade_profit' : 'trade_loss',
        netProfit,
        position.id,
        'position',
        `Closed position #${position.id}`
    );
    
    // Record in trade history
    await TradeHistory.createFromPosition(position, closePrice, netProfit);
    
    // Update account margin
    await account.updateMarginMetrics();
    
    // Calculate and record IB commission
    await IBCommissionService.recordCommission(position, tradeVolume);
    
    return { position, netProfit, closePrice };
}
```

### 3.3 Pending Order Management

```javascript
// Check and trigger pending orders
static async checkPendingOrders() {
    const pendingPositions = await executeQuery(`
        SELECT p.*, s.symbol
        FROM positions p
        JOIN symbols s ON p.symbol_id = s.id
        WHERE p.status = 'pending' AND p.is_triggered = FALSE
    `);
    
    for (const posData of pendingPositions) {
        const position = new Position(posData);
        const currentPrice = await MarketService.getCurrentPrice(position.symbolId);
        
        let shouldTrigger = false;
        let executionPrice = null;
        
        if (position.orderType === 'limit') {
            // Buy limit: trigger when price drops to or below trigger price
            // Sell limit: trigger when price rises to or above trigger price
            if (position.side === 'buy' && currentPrice.ask <= position.triggerPrice) {
                shouldTrigger = true;
                executionPrice = currentPrice.ask;
            } else if (position.side === 'sell' && currentPrice.bid >= position.triggerPrice) {
                shouldTrigger = true;
                executionPrice = currentPrice.bid;
            }
        } else if (position.orderType === 'stop') {
            // Buy stop: trigger when price rises to or above trigger price
            // Sell stop: trigger when price drops to or below trigger price
            if (position.side === 'buy' && currentPrice.ask >= position.triggerPrice) {
                shouldTrigger = true;
                executionPrice = currentPrice.ask;
            } else if (position.side === 'sell' && currentPrice.bid <= position.triggerPrice) {
                shouldTrigger = true;
                executionPrice = currentPrice.bid;
            }
        }
        
        if (shouldTrigger) {
            await this.triggerPendingOrder(position, executionPrice);
        }
    }
}

// Trigger pending order
static async triggerPendingOrder(position, executionPrice) {
    const slippage = Math.abs(executionPrice - position.triggerPrice);
    
    await executeQuery(`
        UPDATE positions
        SET status = 'open',
            is_triggered = TRUE,
            open_price = ?,
            execution_price = ?,
            slippage = ?,
            opened_at = NOW()
        WHERE id = ?
    `, [executionPrice, executionPrice, slippage, position.id]);
    
    // Send notification
    await NotificationService.sendOrderTriggeredNotification(position.userId, position);
}
```

### 3.4 Stop Loss & Take Profit Automation

```javascript
// Check and execute stop loss/take profit
static async checkStopLossAndTakeProfit() {
    const openPositions = await executeQuery(`
        SELECT p.*, s.symbol
        FROM positions p
        JOIN symbols s ON p.symbol_id = s.id
        WHERE p.status = 'open'
        AND (p.stop_loss IS NOT NULL OR p.take_profit IS NOT NULL)
    `);
    
    for (const posData of openPositions) {
        const position = new Position(posData);
        const currentPrice = await MarketService.getCurrentPrice(position.symbolId);
        
        let shouldClose = false;
        let closeReason = 'manual';
        let closePrice = null;
        
        // Check stop loss
        if (position.stopLoss) {
            if (position.side === 'buy' && currentPrice.bid <= position.stopLoss) {
                shouldClose = true;
                closeReason = 'stop_loss';
                closePrice = currentPrice.bid;
            } else if (position.side === 'sell' && currentPrice.ask >= position.stopLoss) {
                shouldClose = true;
                closeReason = 'stop_loss';
                closePrice = currentPrice.ask;
            }
        }
        
        // Check take profit
        if (!shouldClose && position.takeProfit) {
            if (position.side === 'buy' && currentPrice.bid >= position.takeProfit) {
                shouldClose = true;
                closeReason = 'take_profit';
                closePrice = currentPrice.bid;
            } else if (position.side === 'sell' && currentPrice.ask <= position.takeProfit) {
                shouldClose = true;
                closeReason = 'take_profit';
                closePrice = currentPrice.ask;
            }
        }
        
        if (shouldClose) {
            await this.closePosition(position.userId, position.id, closeReason);
            await NotificationService.sendPositionClosedNotification(
                position.userId,
                position,
                closeReason
            );
        }
    }
}
```

---

## 📋 Phase 4: API Routes Enhancement (Week 4-5)

### 4.1 Enhanced Trading Routes
**File:** `backend/routes/trading.js`

Add new endpoints:
- `POST /api/trading/positions/open` - Open position with full validation
- `POST /api/trading/positions/:id/close` - Close position
- `PUT /api/trading/positions/:id/stop-loss` - Update stop loss
- `PUT /api/trading/positions/:id/take-profit` - Update take profit
- `POST /api/trading/positions/pending` - Create pending order
- `DELETE /api/trading/positions/:id/cancel` - Cancel pending order
- `GET /api/trading/margin-info` - Get margin information
- `GET /api/trading/leverage-options` - Get available leverage options
- `PUT /api/trading/accounts/:id/leverage` - Update account leverage

### 4.2 IB Commission Routes
**File:** `backend/routes/introducing-broker.js`

Add new endpoints:
- `GET /api/ib/commissions` - Get IB commissions list
- `GET /api/ib/commissions/summary` - Get commission summary
- `GET /api/ib/settings` - Get IB settings
- `PUT /api/admin/ib/:id/share-percent` - Update IB share % (Admin only)
- `PUT /api/admin/ib/global-settings` - Update global IB settings (Admin only)
- `GET /api/admin/ib/commissions/all` - Get all IB commissions (Admin)

### 4.3 Admin IB Management Routes
**File:** `backend/routes/admin.js`

```javascript
// Update IB share percentage
router.put('/ib/:ibId/share-percent', requireAdmin, asyncHandler(async (req, res) => {
    const { sharePercent } = req.body;
    
    await IBCommissionService.updateIBSharePercent(
        parseInt(req.params.ibId),
        parseFloat(sharePercent),
        req.user.id
    );
    
    res.json({
        success: true,
        message: 'IB share percentage updated successfully'
    });
}));

// Update global commission settings
router.put('/ib/global-settings', requireAdmin, asyncHandler(async (req, res) => {
    const { settingKey, settingValue } = req.body;
    
    await IBCommissionService.updateGlobalSetting(
        settingKey,
        parseFloat(settingValue),
        req.user.id
    );
    
    res.json({
        success: true,
        message: 'Global IB setting updated successfully'
    });
}));

// Get IB commission breakdown
router.get('/ib/commissions/breakdown', requireAdmin, asyncHandler(async (req, res) => {
    const { dateFrom, dateTo } = req.query;
    
    const breakdown = await executeQuery(`
        SELECT 
            ib.id,
            u.first_name,
            u.last_name,
            u.email,
            ib.ib_share_percent,
            COUNT(ic.id) as total_trades,
            SUM(ic.total_commission) as total_commission,
            SUM(ic.ib_amount) as total_ib_amount,
            SUM(ic.admin_amount) as total_admin_amount
        FROM introducing_brokers ib
        JOIN users u ON ib.ib_user_id = u.id
        LEFT JOIN ib_commissions ic ON ic.ib_relationship_id = ib.id
            ${dateFrom && dateTo ? 'AND ic.created_at BETWEEN ? AND ?' : ''}
        GROUP BY ib.id
        ORDER BY total_commission DESC
    `, dateFrom && dateTo ? [dateFrom, dateTo] : []);
    
    res.json({
        success: true,
        data: breakdown
    });
}));
```

---

## 📋 Phase 5: Frontend Implementation (Week 5-6)

### 5.1 Enhanced Trading Interface
**File:** `components/trading/EnhancedTradeDialog.tsx`

Features to add:
- Leverage selector
- Margin calculator in real-time
- Stop loss/take profit visual calculator
- Order type selector (Market/Limit/Stop)
- Position size calculator based on risk
- Commission preview
- Spread display
- Swap charges preview

### 5.2 IB Commission Dashboard
**File:** `app/introducing-broker/page.tsx`

Features to add:
- Real-time commission earnings
- Commission breakdown (IB share vs Admin share)
- Historical commission chart
- Client trading volume
- Commission per client
- Downloadable commission reports

### 5.3 Admin IB Management Panel
**File:** `components/admin/IBManagementPanel.tsx`

Features to add:
- List all IBs with commission stats
- Edit IB share percentage
- View commission breakdown
- Global commission settings
- IB performance analytics
- Commission payment management

### 5.4 Position Management UI
**File:** `components/trading/PositionsTable.tsx`

Enhancements:
- Real-time P&L updates
- Margin usage per position
- Swap charges display
- One-click SL/TP modification
- Partial close option
- Position history modal

---

## 📋 Phase 6: Scheduled Jobs & Automation (Week 6)

### 6.1 Daily Swap Charge Job
**File:** `backend/services/ScheduledJobs.js`

```javascript
// Run daily at market close (typically 5 PM EST)
const swapChargeJob = cron.schedule('0 17 * * *', async () => {
    console.log('Running daily swap charge job...');
    try {
        await SwapService.applyDailySwap();
        console.log('Daily swap charges applied successfully');
    } catch (error) {
        console.error('Error applying daily swap charges:', error);
    }
}, {
    timezone: "America/New_York"
});
```

### 6.2 Position Monitor Job

```javascript
// Run every 5 seconds to check stop loss/take profit
const positionMonitorJob = cron.schedule('*/5 * * * * *', async () => {
    try {
        await TradingService.checkStopLossAndTakeProfit();
        await TradingService.checkPendingOrders();
    } catch (error) {
        console.error('Error in position monitor job:', error);
    }
});
```

### 6.3 Margin Monitor Job

```javascript
// Run every 30 seconds to check margin levels
const marginMonitorJob = cron.schedule('*/30 * * * * *', async () => {
    try {
        const activeAccounts = await executeQuery(
            'SELECT id FROM trading_accounts WHERE status = "active"'
        );
        
        for (const account of activeAccounts) {
            await MarginService.checkMarginCall(account.id);
        }
    } catch (error) {
        console.error('Error in margin monitor job:', error);
    }
});
```

---

## 📋 Phase 7: Testing & Validation (Week 7)

### 7.1 Unit Tests
- Test leverage calculations
- Test margin calculations
- Test swap calculations
- Test commission calculations
- Test IB share distribution
- Test stop loss/take profit triggers
- Test pending order triggers

### 7.2 Integration Tests
- Test complete trade flow
- Test margin call scenario
- Test stop out scenario
- Test multi-day position with swaps
- Test IB commission distribution
- Test position closing with commissions

### 7.3 Load Testing
- Test with 1000+ concurrent positions
- Test margin monitoring under load
- Test position triggers under load
- Test database performance

---

## 📋 Phase 8: Documentation & Deployment (Week 8)

### 8.1 API Documentation
- Document all new endpoints
- Add request/response examples
- Document error codes
- Add calculation formulas

### 8.2 User Documentation
- Trading guide
- Leverage explanation
- Margin requirements guide
- Commission structure guide
- IB program guide

### 8.3 Admin Documentation
- IB management guide
- Commission configuration guide
- Risk management settings
- System monitoring guide

### 8.4 Deployment Checklist
- [ ] Database migrations tested
- [ ] All scheduled jobs configured
- [ ] Real-time price feeds connected
- [ ] Notification system tested
- [ ] Backup procedures in place
- [ ] Monitoring and alerting configured
- [ ] Load balancing configured
- [ ] SSL certificates updated
- [ ] Environment variables set
- [ ] Admin accounts created

---

## 🔧 Configuration Files

### Admin IB Settings Interface
**File:** `app/admin/ib-settings/page.tsx`

```typescript
interface IBGlobalSettings {
    defaultCommissionRate: number; // 0.0070 = 0.70%
    defaultIBSharePercent: number; // 50 = 50%
    minIBSharePercent: number; // 10 = 10%
    maxIBSharePercent: number; // 90 = 90%
}
```

### Leverage Configuration
**File:** `config/trading-config.ts`

```typescript
export const LEVERAGE_OPTIONS = {
    live: [1, 10, 20, 25, 50, 100, 200, 500],
    professional: [1, 10, 20, 25, 50, 100, 200, 500, 1000],
    islamic: [1, 10, 20, 25, 50, 100, 200]
};

export const DEFAULT_MARGIN_CALL_LEVEL = 50; // 50%
export const DEFAULT_STOP_OUT_LEVEL = 20; // 20%
```

---

## 📊 Key Calculations Reference

### Margin Calculation
```
Margin Required = (Lot Size × Contract Size × Price) / Leverage
```

Example:
- Lot Size: 1.0
- Contract Size: 100,000
- Price: 1.1000
- Leverage: 500

Margin = (1.0 × 100,000 × 1.1000) / 500 = $220

### Trading Power
```
Trading Power = Balance × Leverage
```

Example:
- Balance: $1,000
- Leverage: 500

Trading Power = $1,000 × 500 = $500,000

### Commission Calculation
```
Total Commission = Trade Volume × Commission Rate
IB Amount = Total Commission × (IB Share % / 100)
Admin Amount = Total Commission - IB Amount
```

Example:
- Trade Volume: $100,000
- Commission Rate: 0.70% (0.0070)
- IB Share: 50%

Total Commission = $100,000 × 0.0070 = $700
IB Amount = $700 × 0.50 = $350
Admin Amount = $700 - $350 = $350

### Swap Calculation
```
Daily Swap = Lot Size × Swap Rate
Wednesday Swap = Lot Size × Swap Rate × 3 (triple swap)
```

### Margin Level
```
Margin Level = (Equity / Margin Used) × 100
```

Example:
- Equity: $1,500
- Margin Used: $2,000

Margin Level = ($1,500 / $2,000) × 100 = 75%

---

## 🚨 Risk Management Rules

1. **Margin Call Trigger**: When Margin Level < 50%
   - Send warning notification
   - Disable opening new positions
   - Log event

2. **Stop Out Trigger**: When Margin Level < 20%
   - Automatically close positions (biggest loss first)
   - Continue until Margin Level > 20%
   - Send notification
   - Log event

3. **Maximum Leverage Limits**:
   - Live accounts: 1:500
   - Professional: 1:1000
   - Islamic: 1:200

4. **Position Limits**:
   - Max positions per account: 100
   - Max lot size per position: 100 lots
   - Min lot size: 0.01 lots

---

## 📈 Success Metrics

- [ ] All positions tracked with proper margin
- [ ] Leverage calculations 100% accurate
- [ ] Swap charges applied daily without errors
- [ ] Commission distribution working correctly
- [ ] Stop loss/take profit triggers < 1 second latency
- [ ] Margin call/stop out < 5 second response time
- [ ] IB commission calculations 100% accurate
- [ ] Zero fund calculation errors
- [ ] System handles 10,000+ concurrent positions

---

## 🔐 Security Considerations

1. **Fund Security**
   - Separate user funds from operational funds
   - Audit trail for all balance changes
   - Daily reconciliation reports

2. **Access Control**
   - Admin-only access to IB settings
   - Audit logs for all administrative actions
   - Two-factor authentication for admin accounts

3. **Data Validation**
   - Validate all trading parameters
   - Prevent negative balances
   - Validate leverage limits
   - Check margin requirements before opening positions

---

## 📝 Migration Notes

### Removing Demo Accounts
1. Mark all existing demo accounts as `is_demo = TRUE`
2. Prevent new demo account creation
3. Add warning to existing demo users
4. Set migration deadline
5. Archive demo data after deadline

### Data Migration
1. Backup existing database
2. Run migration scripts in order
3. Verify data integrity
4. Test on staging environment first
5. Schedule maintenance window for production

---

## 🎯 Implementation Priority

**Phase 1 (CRITICAL - Week 1):**
- Database migrations
- Remove demo account creation
- Basic leverage system

**Phase 2 (HIGH - Week 2-3):**
- Margin calculations
- Stop loss/take profit automation
- Position opening with validation

**Phase 3 (HIGH - Week 3-4):**
- Swap charges
- IB commission system
- Position closing logic

**Phase 4 (MEDIUM - Week 4-5):**
- API routes
- Frontend updates
- Admin panels

**Phase 5 (MEDIUM - Week 5-6):**
- Scheduled jobs
- Monitoring
- Notifications

**Phase 6 (LOW - Week 7-8):**
- Testing
- Documentation
- Deployment

---

This roadmap provides a comprehensive, step-by-step approach to implementing a production-ready trading system. Follow each phase carefully and test thoroughly before moving to the next phase.
