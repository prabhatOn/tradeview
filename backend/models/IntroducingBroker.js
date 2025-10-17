/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const { executeQuery } = require('../config/database');

class IntroducingBroker {
  constructor(data) {
    this.id = data.id;
    this.ibUserId = data.ib_user_id;
    this.clientUserId = data.client_user_id;
    this.referralCode = data.referral_code;
    this.commissionRate = data.commission_rate;
    this.ibSharePercent = data.ib_share_percent != null ? parseFloat(data.ib_share_percent) : null;
    this.status = data.status;
    this.tierLevel = data.tier_level;
    this.totalCommissionEarned = data.total_commission_earned;
    this.totalClientVolume = data.total_client_volume;
    this.activeClientsCount = data.active_clients_count;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Find IB relationship by ID
  static async findById(id) {
    const rows = await executeQuery(
      'SELECT * FROM introducing_brokers WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? new IntroducingBroker(rows[0]) : null;
  }

  // Find IB relationship by IB user and client
  static async findByIbAndClient(ibUserId, clientUserId) {
    const rows = await executeQuery(
      'SELECT * FROM introducing_brokers WHERE ib_user_id = ? AND client_user_id = ?',
      [ibUserId, clientUserId]
    );
    return rows.length > 0 ? new IntroducingBroker(rows[0]) : null;
  }

  // Find all clients for an IB
  static async findClientsByIb(ibUserId) {
    const rows = await executeQuery(`
      SELECT
        ib.*,
        u.first_name,
        u.last_name,
        u.email,
        u.created_at as user_created_at
      FROM introducing_brokers ib
      JOIN users u ON ib.client_user_id = u.id
      WHERE ib.ib_user_id = ?
      ORDER BY ib.created_at DESC
    `, [ibUserId]);

    return rows.map(row => ({
      ...new IntroducingBroker(row),
      clientName: `${row.first_name} ${row.last_name}`,
      clientEmail: row.email,
      clientJoined: row.user_created_at
    }));
  }

  // Create new IB relationship
  static async create(ibUserId, clientUserId, referralCode, commissionRate = 0.0070) {
    if (!ibUserId || !clientUserId) {
      throw new Error('Invalid IB or client user ID');
    }
    if (ibUserId === clientUserId) {
      throw new Error('You cannot add yourself as a client');
    }

    // Ensure both users exist
    const users = await executeQuery('SELECT id FROM users WHERE id IN (?, ?)', [ibUserId, clientUserId]);
    if (users.length < 2) {
      throw new Error('IB or client user not found');
    }

    const defaultShare = 50.00;
    const result = await executeQuery(`
      INSERT INTO introducing_brokers
      (ib_user_id, client_user_id, referral_code, commission_rate, ib_share_percent, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `, [ibUserId, clientUserId, referralCode, commissionRate, defaultShare]);

    return this.findById(result.insertId);
  }

  // Update IB relationship
  async update(updates) {
    const fields = [];
    const values = [];

    if (updates.commissionRate !== undefined) {
      fields.push('commission_rate = ?');
      values.push(updates.commissionRate);
    }

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    if (updates.tierLevel !== undefined) {
      fields.push('tier_level = ?');
      values.push(updates.tierLevel);
    }

    if (updates.totalCommissionEarned !== undefined) {
      fields.push('total_commission_earned = ?');
      values.push(updates.totalCommissionEarned);
    }

    if (updates.totalClientVolume !== undefined) {
      fields.push('total_client_volume = ?');
      values.push(updates.totalClientVolume);
    }
    if (updates.ibSharePercent !== undefined) {
      fields.push('ib_share_percent = ?');
      values.push(updates.ibSharePercent);
    }

    if (fields.length === 0) return this;

    values.push(this.id);
    await executeQuery(
      `UPDATE introducing_brokers SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.constructor.findById(this.id);
  }

  // Calculate commission for a trade
  static calculateCommission(tradeVolume, commissionRate) {
    return Math.round((tradeVolume * commissionRate) * 100) / 100;
  }

  // Record commission for a trade
  static async recordCommission(ibRelationshipId, tradeId, positionId, commissionAmount, commissionRate, tradeVolume, ibAmount = null, clientCommission = null) {
    const result = await executeQuery(`
      INSERT INTO ib_commissions
      (ib_relationship_id, trade_id, position_id, commission_amount, commission_rate, trade_volume, ib_amount, client_commission)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [ibRelationshipId, tradeId, positionId, commissionAmount, commissionRate, tradeVolume, ibAmount, clientCommission]);

    // Update IB totals
    await executeQuery(`
      UPDATE introducing_brokers
      SET
        total_commission_earned = total_commission_earned + ?,
        total_client_volume = total_client_volume + ?
      WHERE id = ?
    `, [commissionAmount, tradeVolume, ibRelationshipId]);

    return result.insertId;
  }

  // Get commission history for IB
  static async getCommissionHistory(ibUserId, limit = 50, offset = 0) {
    // Note: MySQL doesn't support placeholders for LIMIT/OFFSET, so we use string interpolation
    // Make sure to validate/sanitize the inputs to prevent SQL injection
    const safeLimit = Math.min(parseInt(limit) || 50, 1000); // Max 1000 records
    const safeOffset = Math.max(parseInt(offset) || 0, 0);
    
    const rows = await executeQuery(`
      SELECT
        ic.*,
        u.first_name,
        u.last_name,
        u.email,
        s.symbol,
        th.side,
        th.lot_size,
        th.profit
      FROM ib_commissions ic
      JOIN introducing_brokers ib ON ic.ib_relationship_id = ib.id
      JOIN users u ON ib.client_user_id = u.id
      LEFT JOIN trade_history th ON ic.trade_id = th.id
      LEFT JOIN symbols s ON th.symbol_id = s.id
      WHERE ib.ib_user_id = ?
      ORDER BY ic.created_at DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `, [ibUserId]);

    return rows;
  }

  // Get IB statistics
  static async getIbStatistics(ibUserId) {
    const [stats] = await executeQuery(`
      SELECT
        COUNT(DISTINCT client_user_id) as total_clients,
        COUNT(DISTINCT CASE WHEN status = 'active' THEN client_user_id END) as active_clients,
        COALESCE(SUM(total_commission_earned), 0) as total_commission_earned,
        COALESCE(SUM(total_client_volume), 0) as total_client_volume,
        COALESCE(AVG(commission_rate), 0) as avg_commission_rate
      FROM introducing_brokers
      WHERE ib_user_id = ?
    `, [ibUserId]);

    return stats;
  }
}

module.exports = IntroducingBroker;