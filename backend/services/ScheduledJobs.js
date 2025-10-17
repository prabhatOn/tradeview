const cron = require('node-cron');
const PositionUpdateService = require('../services/PositionUpdateService');
const SwapService = require('../services/SwapService');
const PendingOrderService = require('../services/PendingOrderService');
const MarginService = require('../services/MarginService');
const { executeQuery } = require('../config/database');

class ScheduledJobs {
  
  static init() {
    console.log('Initializing scheduled jobs...');
    
    // ===== HIGH FREQUENCY JOBS =====
    
    // Update position prices - every 2 seconds
    cron.schedule('*/2 * * * * *', async () => {
      try {
        await PositionUpdateService.updateAllOpenPositions();
      } catch (error) {
        console.error('Position price update failed:', error);
      }
    });
    
    // Check stop loss and take profit - every 5 seconds
    cron.schedule('*/5 * * * * *', async () => {
      try {
        await PendingOrderService.checkStopLossTakeProfit();
      } catch (error) {
        console.error('SL/TP check failed:', error);
      }
    });
    
    // Check pending orders (limit/stop) - every 10 seconds
    cron.schedule('*/10 * * * * *', async () => {
      try {
        await PendingOrderService.processPendingOrders();
      } catch (error) {
        console.error('Pending orders check failed:', error);
      }
    });
    
    // ===== MEDIUM FREQUENCY JOBS =====
    
    // Monitor margin levels - every 30 seconds
    cron.schedule('*/30 * * * * *', async () => {
      try {
        const activeAccounts = await executeQuery(
          'SELECT id FROM trading_accounts WHERE status = "active"'
        );
        
        for (const account of activeAccounts) {
          await MarginService.checkMarginCall(account.id);
        }
      } catch (error) {
        console.error('Margin monitoring failed:', error);
      }
    });
    
    // ===== DAILY JOBS =====
    
    // Apply daily swap charges - 5:00 PM EST (22:00 UTC)
    cron.schedule('0 22 * * *', async () => {
      console.log('🕐 Running daily swap charge job...');
      try {
        await SwapService.applyDailySwap();
        console.log('✓ Daily swap charges applied successfully');
      } catch (error) {
        console.error('Daily swap charge failed:', error);
      }
    }, {
      timezone: 'UTC'
    });
    
    console.log('✓ Scheduled jobs initialized successfully');
    console.log('  - Position price updates: Every 2 seconds');
    console.log('  - SL/TP monitoring: Every 5 seconds');
    console.log('  - Pending orders: Every 10 seconds');
    console.log('  - Margin monitoring: Every 30 seconds');
    console.log('  - Daily swap charges: 5:00 PM EST (22:00 UTC)');
  }
  
  static stop() {
    console.log('Stopping all scheduled jobs...');
    cron.destroy();
  }
}

module.exports = ScheduledJobs;