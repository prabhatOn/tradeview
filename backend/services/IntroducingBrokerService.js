/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const { executeQuery, executeTransaction } = require('../config/database');
const IntroducingBroker = require('../models/IntroducingBroker');
const User = require('../models/User');

class IntroducingBrokerService {
  // Generate unique referral code
  static generateReferralCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Create IB relationship
  static async createIbRelationship(ibUserId, clientEmail, commissionRate = 0.0070) {
    return executeTransaction(async (connection) => {
      // Check that ibUserId has IB role
      const roleRows = await executeQuery(`
        SELECT r.name FROM roles r
        JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = ? AND r.name IN ('IB','Admin','Manager')
      `, [ibUserId]);
      if (!roleRows.length) {
        const err = new Error('IB access required');
        err.status = 403;
        throw err;
      }

      // Check if client exists
      const client = await User.findByEmail(clientEmail);
      if (!client) {
        throw new Error('Client user not found');
      }

      // Check if relationship already exists
      const existingRelationship = await IntroducingBroker.findByIbAndClient(ibUserId, client.id);
      if (existingRelationship) {
        // Return existing relationship instead of throwing error
        return {
          ...existingRelationship,
          clientName: `${client.firstName} ${client.lastName}`,
          clientEmail: client.email,
          alreadyExists: true
        };
      }

      // Generate unique referral code
      let referralCode;
      let attempts = 0;
      do {
        referralCode = this.generateReferralCode();
        attempts++;
        if (attempts > 10) {
          throw new Error('Failed to generate unique referral code');
        }
      } while (await this.referralCodeExists(referralCode));

      // Create IB relationship
      const ibRelationship = await IntroducingBroker.create(ibUserId, client.id, referralCode, commissionRate);

      return {
        ...ibRelationship,
        clientName: `${client.firstName} ${client.lastName}`,
        clientEmail: client.email,
        alreadyExists: false
      };
    });
  }

  // Check if referral code exists
  static async referralCodeExists(code) {
    const rows = await executeQuery(
      'SELECT id FROM introducing_brokers WHERE referral_code = ?',
      [code]
    );
    return rows.length > 0;
  }

  // Get IB dashboard data
  static async getIbDashboard(ibUserId) {
    const statistics = await IntroducingBroker.getIbStatistics(ibUserId);
    const clients = await this.getIbClientsWithPerformance(ibUserId);
    
    // Get commission history with error handling
    let commissionHistory = [];
    try {
      commissionHistory = await IntroducingBroker.getCommissionHistory(ibUserId, 20);
    } catch (error) {
      console.warn('Failed to load commission history, using empty array:', error.message);
      commissionHistory = [];
    }

    // Get monthly commission trend with error handling
    let monthlyCommissions = [];
    try {
      monthlyCommissions = await executeQuery(`
        SELECT
          DATE_FORMAT(ic.created_at, '%Y-%m') as month,
          COALESCE(SUM(ic.commission_amount), 0) as total_commission,
          COUNT(*) as commission_count
        FROM ib_commissions ic
        JOIN introducing_brokers ib ON ic.ib_relationship_id = ib.id
        WHERE ib.ib_user_id = ?
          AND ic.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(ic.created_at, '%Y-%m')
        ORDER BY month DESC
      `, [ibUserId]);
    } catch (error) {
      console.warn('Failed to load monthly commissions, using empty array:', error.message);
      monthlyCommissions = [];
    }

    return {
      statistics,
      clients,
      commissionHistory,
      monthlyCommissions
    };
  }

  // Process commission for a trade
  static async processTradeCommission(clientUserId, tradeId, positionId, tradeVolume, tradeProfit) {
    // Find IB relationship for this client
    const rows = await executeQuery(`
      SELECT ib.*, u.email as ib_email
      FROM introducing_brokers ib
      JOIN users u ON ib.ib_user_id = u.id
      WHERE ib.client_user_id = ? AND ib.status = 'active'
    `, [clientUserId]);

    if (rows.length === 0) {
      return null; // No active IB relationship
    }

    const ibRelationship = rows[0];
    const commissionAmount = IntroducingBroker.calculateCommission(tradeVolume, ibRelationship.commission_rate);

    // Record the commission
    const commissionId = await IntroducingBroker.recordCommission(
      ibRelationship.id,
      tradeId,
      positionId,
      commissionAmount,
      ibRelationship.commission_rate,
      tradeVolume
    );

    // Credit commission to IB's account (if they have one)
    // This would typically go to their trading account balance
    // For now, we'll just record it

    return {
      commissionId,
      ibUserId: ibRelationship.ib_user_id,
      clientUserId,
      commissionAmount,
      commissionRate: ibRelationship.commission_rate,
      tradeVolume
    };
  }

  // Update IB tier based on performance
  static async updateIbTier(ibUserId) {
    const stats = await IntroducingBroker.getIbStatistics(ibUserId);

    let newTier = 'bronze';
    if (stats.total_commission_earned >= 10000) {
      newTier = 'platinum';
    } else if (stats.total_commission_earned >= 5000) {
      newTier = 'gold';
    } else if (stats.total_commission_earned >= 1000) {
      newTier = 'silver';
    }

    // Update all IB relationships for this user
    await executeQuery(
      'UPDATE introducing_brokers SET tier_level = ? WHERE ib_user_id = ?',
      [newTier, ibUserId]
    );

    return newTier;
  }

  // Get IB clients with performance data
  static async getIbClientsWithPerformance(ibUserId) {
    const clients = await executeQuery(`
      SELECT
        ib.id,
        ib.client_user_id,
        ib.commission_rate,
        ib.status,
        ib.tier_level,
        ib.total_commission_earned,
        ib.total_client_volume,
        u.first_name,
        u.last_name,
        u.email,
        u.created_at AS client_joined,
        COALESCE(SUM(th.lot_size), 0) AS total_volume_lots,
        COALESCE(SUM(ic.commission_amount), 0) AS total_commissions,
        COUNT(DISTINCT th.id) AS total_trades,
        COUNT(DISTINCT CASE WHEN COALESCE(th.profit, 0) > 0 THEN th.id END) AS winning_trades,
        MAX(th.closed_at) AS last_trade_at
      FROM introducing_brokers ib
      JOIN users u ON ib.client_user_id = u.id
      LEFT JOIN trading_accounts ta ON ta.user_id = ib.client_user_id
      LEFT JOIN trade_history th ON th.account_id = ta.id
      LEFT JOIN ib_commissions ic ON ic.trade_id = th.id AND ic.ib_relationship_id = ib.id
      WHERE ib.ib_user_id = ?
      GROUP BY ib.id, u.id, ib.commission_rate, ib.status, ib.tier_level, ib.total_commission_earned, ib.total_client_volume, u.first_name, u.last_name, u.email, u.created_at
      ORDER BY total_commissions DESC, total_volume_lots DESC, u.first_name ASC
    `, [ibUserId]);

    return clients.map(client => ({
      id: client.id,
      clientUserId: Number(client.client_user_id),
      clientName: `${client.first_name} ${client.last_name}`,
      clientEmail: client.email,
      clientJoined: new Date(client.client_joined).toLocaleDateString(),
      volume: (() => {
        const computedVolume = parseFloat(client.total_volume_lots ?? 0);
        if (computedVolume > 0) return computedVolume;
        const storedVolume = parseFloat(client.total_client_volume ?? 0);
        return Number.isFinite(storedVolume) ? storedVolume : 0;
      })(),
      commission: (() => {
        const computedCommission = parseFloat(client.total_commissions ?? 0);
        if (computedCommission > 0) return computedCommission;
        const storedCommission = parseFloat(client.total_commission_earned ?? 0);
        return Number.isFinite(storedCommission) ? storedCommission : 0;
      })(),
      commissionRate: client.commission_rate !== undefined && client.commission_rate !== null
        ? Number(client.commission_rate)
        : null,
      commissionTier: (client.tier_level || 'bronze').charAt(0).toUpperCase() + (client.tier_level || 'bronze').slice(1),
      status: client.status,
      totalTrades: Number(client.total_trades) || 0,
      winRate: (() => {
        const trades = Number(client.total_trades) || 0;
        if (trades > 0) {
          const wins = Number(client.winning_trades) || 0;
          return Math.round((wins / trades) * 100);
        }
        return 0;
      })(),
      lastTradeAt: client.last_trade_at ? new Date(client.last_trade_at).toISOString() : null
    }));
  }
}

module.exports = IntroducingBrokerService;