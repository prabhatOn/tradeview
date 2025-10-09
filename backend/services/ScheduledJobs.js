const cron = require('node-cron');
const PositionUpdateService = require('../services/PositionUpdateService');

class ScheduledJobs {
  
  static init() {
    console.log('Initializing scheduled jobs...');
    
    // Update position P&L every 30 seconds
    cron.schedule('*/30 * * * * *', async () => {
      try {
        await PositionUpdateService.updateAllOpenPositions();
      } catch (error) {
        console.error('Scheduled position update failed:', error);
      }
    });
    
    // More frequent updates during market hours (every 5 seconds)
    cron.schedule('*/5 * * * * *', async () => {
      try {
        const now = new Date();
        const hour = now.getHours();
        
        // Market hours: 9 AM to 5 PM (adjust for your timezone)
        if (hour >= 9 && hour < 17) {
          await PositionUpdateService.updateAllOpenPositions();
        }
      } catch (error) {
        console.error('High-frequency position update failed:', error);
      }
    });
    
    console.log('Scheduled jobs initialized successfully');
  }
  
  static stop() {
    console.log('Stopping all scheduled jobs...');
    cron.destroy();
  }
}

module.exports = ScheduledJobs;