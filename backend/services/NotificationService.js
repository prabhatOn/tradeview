const { executeQuery } = require('../config/database');

class NotificationService {
  // Send notification to user
  static async sendNotification(userId, title, message, type = 'info', data = null) {
    try {
      const result = await executeQuery(`
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, title, message, type, JSON.stringify(data)]);

      // In a real application, you would also send push notifications,
      // emails, SMS, etc. based on user preferences
      const notification = {
        id: result.insertId,
        userId,
        title,
        message,
        type,
        data,
        isRead: false,
        createdAt: new Date()
      };

      // Emit to WebSocket if user is connected
      this.emitToUser(userId, 'notification', notification);

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  // Send price alert notification
  static async sendPriceAlert(userId, symbol, currentPrice, targetPrice, alertType) {
    const title = `Price Alert: ${symbol}`;
    const message = `${symbol} has ${alertType === 'above' ? 'reached above' : 'dropped below'} ${targetPrice}. Current price: ${currentPrice}`;
    
    return this.sendNotification(userId, title, message, 'price_alert', {
      symbol,
      currentPrice,
      targetPrice,
      alertType
    });
  }

  // Send position notification
  static async sendPositionNotification(userId, positionId, action, details) {
    const titles = {
      opened: 'Position Opened',
      closed: 'Position Closed',
      margin_call: 'Margin Call',
      stop_loss: 'Stop Loss Triggered',
      take_profit: 'Take Profit Triggered'
    };

    const title = titles[action] || 'Position Update';
    
    return this.sendNotification(userId, title, details.message, 'trading', {
      positionId,
      action,
      ...details
    });
  }

  // Send transaction notification
  static async sendTransactionNotification(userId, transactionType, transactionId, status, amount, currency) {
    const title = `${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} ${status.charAt(0).toUpperCase() + status.slice(1)}`;
    const message = `Your ${transactionType} of ${amount} ${currency} has been ${status}.`;
    
    return this.sendNotification(userId, title, message, 'transaction', {
      transactionType,
      transactionId,
      status,
      amount,
      currency
    });
  }

  // Send account notification
  static async sendAccountNotification(userId, message, type = 'account') {
    const title = 'Account Update';
    
    return this.sendNotification(userId, title, message, type);
  }

  // Get user notifications
  static async getUserNotifications(userId, page = 1, limit = 20, unreadOnly = false) {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE user_id = ?';
      let params = [userId];

      if (unreadOnly) {
        whereClause += ' AND is_read = 0';
      }

      const notifications = await executeQuery(`
        SELECT *
        FROM user_notifications
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      const totalCount = await executeQuery(`
        SELECT COUNT(*) as count
        FROM user_notifications
        ${whereClause}
      `, params);

      return {
        notifications,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          pages: Math.ceil(totalCount[0].count / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId, userId) {
    try {
      await executeQuery(`
        UPDATE notifications
        SET is_read = 1, read_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `, [notificationId, userId]);

      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(userId) {
    try {
      await executeQuery(`
        UPDATE notifications
        SET is_read = 1, read_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND is_read = 0
      `, [userId]);

      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Delete notification
  static async deleteNotification(notificationId, userId) {
    try {
      await executeQuery(`
        DELETE FROM user_notifications
        WHERE id = ? AND user_id = ?
      `, [notificationId, userId]);

      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  // Get unread count
  static async getUnreadCount(userId) {
    try {
      const result = await executeQuery(`
        SELECT COUNT(*) as count
        FROM user_notifications
        WHERE user_id = ? AND is_read = 0
      `, [userId]);

      return result[0].count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Check price alerts
  static async checkPriceAlerts() {
    try {
      // Get all active price alerts
      const alerts = await executeQuery(`
        SELECT 
          pa.*,
          s.symbol,
          md.current_price
        FROM price_alerts pa
        JOIN symbols s ON pa.symbol_id = s.id
        JOIN market_data md ON s.id = md.symbol_id AND md.date = CURDATE()
        WHERE pa.is_active = 1
      `);

      const triggeredAlerts = [];

      for (const alert of alerts) {
        const { current_price, target_price, alert_type } = alert;
        let triggered = false;

        if (alert_type === 'above' && current_price >= target_price) {
          triggered = true;
        } else if (alert_type === 'below' && current_price <= target_price) {
          triggered = true;
        }

        if (triggered) {
          // Send notification
          await this.sendPriceAlert(
            alert.user_id,
            alert.symbol,
            current_price,
            target_price,
            alert_type
          );

          // Deactivate alert
          await executeQuery(`
            UPDATE price_alerts
            SET is_active = 0, triggered_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [alert.id]);

          triggeredAlerts.push(alert);
        }
      }

      return triggeredAlerts;
    } catch (error) {
      console.error('Error checking price alerts:', error);
      return [];
    }
  }

  // Emit notification to user via WebSocket
  static emitToUser(userId, event, data) {
    // This would integrate with your WebSocket server
    // For now, it's a placeholder
    const { io } = require('../server');
    if (io && io.to) {
      io.to(`user_${userId}`).emit(event, data);
    }
  }

  // Send bulk notifications
  static async sendBulkNotifications(userIds, title, message, type = 'info', data = null) {
    try {
      const values = userIds.map(userId => [userId, title, message, type, JSON.stringify(data)]);
      
      await executeQuery(`
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES ?
      `, [values]);

      // Emit to all users via WebSocket
      userIds.forEach(userId => {
        this.emitToUser(userId, 'notification', {
          title,
          message,
          type,
          data,
          isRead: false,
          createdAt: new Date()
        });
      });

      return true;
    } catch (error) {
      console.error('Error sending bulk notifications:', error);
      throw error;
    }
  }

  // Clean old notifications
  static async cleanOldNotifications(daysToKeep = 30) {
    try {
      const result = await executeQuery(`
        DELETE FROM user_notifications
        WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
      `, [daysToKeep]);

      return result.affectedRows;
    } catch (error) {
      console.error('Error cleaning old notifications:', error);
      return 0;
    }
  }
}

module.exports = NotificationService;