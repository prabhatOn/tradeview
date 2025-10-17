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

    // Compute IB share based on stored percentage
    const sharePercent = ibRelationship.ib_share_percent != null ? parseFloat(ibRelationship.ib_share_percent) : 50.0;
    const ibAmount = Math.round((commissionAmount * (sharePercent / 100)) * 100) / 100;
    const clientCommission = Math.round((commissionAmount) * 100) / 100;

    // Record the commission (store both total commission and IB amount)
    const commissionId = await IntroducingBroker.recordCommission(
      ibRelationship.id,
      tradeId,
      positionId,
      commissionAmount,
      ibRelationship.commission_rate,
      tradeVolume,
      ibAmount,
      clientCommission
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

  // ===== ADMIN FUNCTIONS =====

  // Get global IB settings
  static async getGlobalSettings() {
    const settings = await executeQuery('SELECT * FROM ib_global_settings WHERE is_active = TRUE');
    return settings.reduce((acc, setting) => {
      acc[setting.setting_key] = parseFloat(setting.setting_value);
      return acc;
    }, {});
  }

  // Update IB share percentage (Admin only)
  static async updateIBSharePercent(ibRelationshipId, newSharePercent, adminUserId) {
    const globalSettings = await this.getGlobalSettings();
    
    // Validate percentage
    const minShare = globalSettings.min_ib_share_percent || 10;
    const maxShare = globalSettings.max_ib_share_percent || 90;
    
    if (newSharePercent < minShare || newSharePercent > maxShare) {
      throw new Error(`IB share must be between ${minShare}% and ${maxShare}%`);
    }
    
    await executeQuery(`
      UPDATE introducing_brokers
      SET ib_share_percent = ?,
          updated_at = NOW()
      WHERE id = ?
    `, [newSharePercent, ibRelationshipId]);
    
    // Log audit if audit_logs table exists
    try {
      await executeQuery(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES (?, 'update_ib_share', 'introducing_brokers', ?, ?)
      `, [adminUserId, ibRelationshipId, JSON.stringify({ ib_share_percent: newSharePercent })]);
    } catch (error) {
      console.warn('Audit log failed (table may not exist):', error.message);
    }

    return { success: true, newSharePercent };
  }

  // Update IB share percentage by USER ID (for IBs without client relationships yet)
  static async updateIBSharePercentByUserId(ibUserId, newSharePercent, adminUserId) {
    const globalSettings = await this.getGlobalSettings();
    
    // Validate percentage
    const minShare = globalSettings.min_ib_share_percent || 10;
    const maxShare = globalSettings.max_ib_share_percent || 90;
    
    if (newSharePercent < minShare || newSharePercent > maxShare) {
      throw new Error(`IB share must be between ${minShare}% and ${maxShare}%`);
    }

    // Check if this user has the IB role
    const ibCheck = await executeQuery(`
      SELECT u.id 
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.id = ? AND r.name = 'IB'
    `, [ibUserId]);

    if (!ibCheck || ibCheck.length === 0) {
      throw new Error('User is not an IB');
    }

    // Update all existing IB relationships for this user
    const result = await executeQuery(`
      UPDATE introducing_brokers
      SET ib_share_percent = ?,
          updated_at = NOW()
      WHERE ib_user_id = ?
    `, [newSharePercent, ibUserId]);

    // If no relationships exist yet, that's OK - the share percent will be used when they get their first client
    // We could create a separate ib_user_settings table, but for now the default will be used

    // Log audit if audit_logs table exists
    try {
      await executeQuery(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES (?, 'update_ib_share_by_user', 'introducing_brokers', ?, ?)
      `, [adminUserId, ibUserId, JSON.stringify({ ib_share_percent: newSharePercent, updated_rows: result.affectedRows })]);
    } catch (error) {
      console.warn('Audit log failed (table may not exist):', error.message);
    }

    return { 
      success: true, 
      newSharePercent,
      updatedRelationships: result.affectedRows,
      message: result.affectedRows > 0 
        ? `Updated ${result.affectedRows} IB relationship(s)` 
        : 'No existing relationships - share will apply to future clients'
    };
  }


  // Update global commission settings (Admin only)
  static async updateGlobalSetting(settingKey, settingValue, adminUserId) {
    await executeQuery(`
      UPDATE ib_global_settings
      SET setting_value = ?,
          updated_at = NOW()
      WHERE setting_key = ?
    `, [settingValue, settingKey]);
    
    // Log audit if audit_logs table exists
    try {
      await executeQuery(`
        INSERT INTO audit_logs (user_id, action, table_name, new_values)
        VALUES (?, 'update_ib_global_setting', 'ib_global_settings', ?)
      `, [adminUserId, JSON.stringify({ [settingKey]: settingValue })]);
    } catch (error) {
      console.warn('Audit log failed (table may not exist):', error.message);
    }

    return { success: true, settingKey, settingValue };
  }

  // Get all IBs with stats (Admin only)
  static async getAllIBsWithStats() {
    // Get all users with IB role
    const ibs = await executeQuery(`
      SELECT DISTINCT
        u.id as ib_user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.status as user_status
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE r.name = 'IB'
      ORDER BY u.first_name, u.last_name
    `);

    // For each IB user, get their stats
    const ibsWithStats = await Promise.all(ibs.map(async (ib) => {
      // Get stats from introducing_brokers table if relationships exist
      const stats = await executeQuery(`
        SELECT 
          COUNT(DISTINCT ib.client_user_id) as total_clients,
          COUNT(DISTINCT ic.id) as total_trades,
          COALESCE(SUM(ic.commission_amount), 0) as total_commission,
          COALESCE(SUM(ic.ib_amount), 0) as total_ib_amount,
          COALESCE(SUM(ic.admin_amount), 0) as total_admin_amount,
          MAX(ib.ib_share_percent) as ib_share_percent,
          MAX(ib.commission_rate) as commission_rate,
          MAX(ib.tier_level) as tier_level,
          MAX(ib.status) as status
        FROM introducing_brokers ib
        LEFT JOIN ib_commissions ic ON ic.ib_relationship_id = ib.id
        WHERE ib.ib_user_id = ?
        GROUP BY ib.ib_user_id
      `, [ib.ib_user_id]);

      const stat = stats[0] || {};
      
      // Get default settings for IB share if no relationships exist
      const defaultSettings = await executeQuery(`
        SELECT setting_value 
        FROM ib_global_settings 
        WHERE setting_key = 'default_ib_share_percent'
      `);
      const defaultSharePercent = defaultSettings[0] ? parseFloat(defaultSettings[0].setting_value) : 50;

      return {
        id: ib.ib_user_id,
        ibUserId: ib.ib_user_id,
        ibName: `${ib.first_name || ''} ${ib.last_name || ''}`.trim() || ib.email,
        ibEmail: ib.email,
        ibSharePercent: stat.ib_share_percent ? parseFloat(stat.ib_share_percent) : defaultSharePercent,
        commissionRate: stat.commission_rate ? parseFloat(stat.commission_rate) : 0.007,
        tierLevel: stat.tier_level || 'bronze',
        status: stat.status || 'approved', // Default to approved for IB role users
        totalClients: parseInt(stat.total_clients || 0),
        totalTrades: parseInt(stat.total_trades || 0),
        totalCommission: parseFloat(stat.total_commission || 0),
        totalIBAmount: parseFloat(stat.total_ib_amount || 0),
        totalAdminAmount: parseFloat(stat.total_admin_amount || 0),
        userStatus: ib.user_status
      };
    }));

    return ibsWithStats;
  }

  // Mark commission as paid (Admin only)
  static async markAsPaid(commissionId, adminUserId) {
    await executeQuery(`
      UPDATE ib_commissions
      SET status = 'paid',
          paid_at = NOW()
      WHERE id = ?
    `, [commissionId]);

    // Log audit if audit_logs table exists
    try {
      await executeQuery(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES (?, 'mark_commission_paid', 'ib_commissions', ?, ?)
      `, [adminUserId, commissionId, JSON.stringify({ status: 'paid' })]);
    } catch (error) {
      console.warn('Audit log failed (table may not exist):', error.message);
    }

    return { success: true, commissionId };
  }

  // Get pending commissions (Admin only)
  static async getPendingCommissions(ibUserId = null) {
    let query = `
      SELECT 
        ic.id,
        ic.ib_relationship_id,
        ic.trade_id,
        ic.position_id,
        ic.trade_volume,
        ic.commission_rate,
        ic.total_commission,
        ic.ib_share_percent,
        ic.ib_amount,
        ic.admin_amount,
        ic.created_at,
        ib.ib_user_id,
        u.first_name,
        u.last_name,
        u.email
      FROM ib_commissions ic
      JOIN introducing_brokers ib ON ic.ib_relationship_id = ib.id
      JOIN users u ON ib.ib_user_id = u.id
      WHERE ic.status = 'pending'
    `;
    
    const params = [];
    if (ibUserId) {
      query += ' AND ib.ib_user_id = ?';
      params.push(ibUserId);
    }
    
    query += ' ORDER BY ic.created_at DESC';
    
    const commissions = await executeQuery(query, params);
    
    return commissions.map(comm => ({
      id: comm.id,
      ibRelationshipId: comm.ib_relationship_id,
      tradeId: comm.trade_id,
      positionId: comm.position_id,
      tradeVolume: parseFloat(comm.trade_volume || 0),
      commissionRate: parseFloat(comm.commission_rate || 0),
      totalCommission: parseFloat(comm.total_commission || 0),
      ibSharePercent: parseFloat(comm.ib_share_percent || 50),
      ibAmount: parseFloat(comm.ib_amount || 0),
      adminAmount: parseFloat(comm.admin_amount || 0),
      createdAt: comm.created_at,
      ibUserId: comm.ib_user_id,
      ibName: `${comm.first_name} ${comm.last_name}`,
      ibEmail: comm.email
    }));
  }
}

module.exports = IntroducingBrokerService;