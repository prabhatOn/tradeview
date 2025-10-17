/**
 * Swap Service
 * Handles overnight swap charges for positions
 */

const { executeQuery } = require('../config/database');

class SwapService {
  /**
   * Apply daily swap to all open positions
   * Should be run at market close time (typically 5 PM EST)
   * @returns {Promise<Object>} Summary of swap charges applied
   */
  static async applyDailySwap() {
    // Get all open positions with their swap rates
    const openPositions = await executeQuery(`
      SELECT 
        p.*,
        s.swap_long,
        s.swap_short,
        s.symbol,
        ta.user_id
      FROM positions p
      JOIN symbols s ON p.symbol_id = s.id
      JOIN trading_accounts ta ON p.account_id = ta.id
      WHERE p.status = 'open'
    `);

    const isTripleSwap = this.isTripleSwapDay();
    let totalSwapCharged = 0;
    let positionsCharged = 0;

    for (const position of openPositions) {
      try {
        const swapRate = position.side === 'buy' ? position.swap_long : position.swap_short;
        const swapCharge = this.calculateSwapWithMultiplier(
          parseFloat(position.lot_size),
          parseFloat(swapRate),
          isTripleSwap
        );

        // Update position with swap charge
        await executeQuery(`
          UPDATE positions
          SET swap = swap + ?,
              daily_swap_charge = ?,
              days_held = days_held + 1,
              total_charges = total_charges + ?,
              updated_at = NOW()
          WHERE id = ?
        `, [swapCharge, swapCharge, swapCharge, position.id]);

        // Log swap charge
        await executeQuery(`
          INSERT INTO swap_charges_log
          (position_id, charge_date, swap_rate, swap_amount, position_side, lot_size, is_triple_swap)
          VALUES (?, CURDATE(), ?, ?, ?, ?, ?)
        `, [position.id, swapRate, swapCharge, position.side, position.lot_size, isTripleSwap]);

        // Update account balance (deduct swap charge)
        await executeQuery(`
          UPDATE trading_accounts
          SET balance = balance - ?,
              updated_at = NOW()
          WHERE id = ?
        `, [swapCharge, position.account_id]);

        // Log transaction
        await executeQuery(`
          INSERT INTO fund_transactions
          (user_id, account_id, type, amount, status, description, reference_type, reference_id)
          VALUES (?, ?, 'swap', ?, 'completed', ?, 'position', ?)
        `, [
          position.user_id,
          position.account_id,
          -swapCharge,
          `Daily swap charge for ${position.symbol} position #${position.id}${isTripleSwap ? ' (Triple Swap)' : ''}`,
          position.id
        ]);

        totalSwapCharged += swapCharge;
        positionsCharged++;

      } catch (error) {
        console.error(`Error applying swap to position ${position.id}:`, error);
        // Continue with next position even if one fails
      }
    }

    return {
      positionsCharged,
      totalSwapCharged,
      isTripleSwap,
      date: new Date().toISOString().split('T')[0]
    };
  }

  /**
   * Calculate swap charge for a position
   * @param {number} lotSize - Position size in lots
   * @param {number} swapRate - Swap rate from symbol
   * @returns {number} Swap charge amount
   */
  static calculateSwap(lotSize, swapRate) {
    return lotSize * swapRate;
  }

  /**
   * Get swap rates for a symbol
   * @param {number} symbolId - Symbol ID
   * @returns {Promise<Object>} {swap_long, swap_short}
   */
  static async getSwapRates(symbolId) {
    const [result] = await executeQuery(
      'SELECT swap_long, swap_short FROM symbols WHERE id = ?',
      [symbolId]
    );
    return result || { swap_long: 0, swap_short: 0 };
  }

  /**
   * Check if today is triple swap day (Wednesday)
   * Wednesday rollover includes weekend charges
   * @returns {boolean} True if today is Wednesday
   */
  static isTripleSwapDay() {
    const today = new Date().getDay();
    return today === 3; // Wednesday = 3
  }

  /**
   * Calculate swap with triple consideration
   * @param {number} lotSize - Position size in lots
   * @param {number} swapRate - Swap rate
   * @param {boolean} isTripleSwap - Whether to apply triple swap
   * @returns {number} Swap charge amount
   */
  static calculateSwapWithMultiplier(lotSize, swapRate, isTripleSwap = null) {
    if (isTripleSwap === null) {
      isTripleSwap = this.isTripleSwapDay();
    }
    const multiplier = isTripleSwap ? 3 : 1;
    return lotSize * swapRate * multiplier;
  }

  /**
   * Get swap history for a position
   * @param {number} positionId - Position ID
   * @returns {Promise<Array>} Array of swap charge records
   */
  static async getPositionSwapHistory(positionId) {
    const swapHistory = await executeQuery(`
      SELECT *
      FROM swap_charges_log
      WHERE position_id = ?
      ORDER BY charge_date DESC
    `, [positionId]);

    return swapHistory;
  }

  /**
   * Get total swap charges for date range
   * @param {string} dateFrom - Start date (YYYY-MM-DD)
   * @param {string} dateTo - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Swap charges summary
   */
  static async getSwapSummary(dateFrom, dateTo) {
    const [summary] = await executeQuery(`
      SELECT 
        COUNT(DISTINCT position_id) as positions_charged,
        SUM(swap_amount) as total_swap,
        AVG(swap_amount) as avg_swap,
        SUM(CASE WHEN is_triple_swap THEN swap_amount ELSE 0 END) as triple_swap_total
      FROM swap_charges_log
      WHERE charge_date BETWEEN ? AND ?
    `, [dateFrom, dateTo]);

    return summary || {
      positions_charged: 0,
      total_swap: 0,
      avg_swap: 0,
      triple_swap_total: 0
    };
  }

  /**
   * Calculate estimated daily swap for a potential position
   * @param {number} symbolId - Symbol ID
   * @param {string} side - 'buy' or 'sell'
   * @param {number} lotSize - Position size
   * @returns {Promise<number>} Estimated daily swap charge
   */
  static async calculateEstimatedSwap(symbolId, side, lotSize) {
    const rates = await this.getSwapRates(symbolId);
    const swapRate = side === 'buy' ? rates.swap_long : rates.swap_short;
    return this.calculateSwap(lotSize, swapRate);
  }

  /**
   * Get accounts with highest swap charges
   * @param {number} limit - Number of accounts to return
   * @param {string} dateFrom - Start date
   * @param {string} dateTo - End date
   * @returns {Promise<Array>} Top accounts by swap charges
   */
  static async getTopSwapAccounts(limit = 10, dateFrom = null, dateTo = null) {
    let dateFilter = '';
    const params = [];

    if (dateFrom && dateTo) {
      dateFilter = 'WHERE scl.charge_date BETWEEN ? AND ?';
      params.push(dateFrom, dateTo);
    }

    params.push(limit);

    const topAccounts = await executeQuery(`
      SELECT 
        ta.id as account_id,
        ta.account_number,
        u.email,
        COUNT(DISTINCT scl.position_id) as positions_count,
        SUM(scl.swap_amount) as total_swap,
        AVG(scl.swap_amount) as avg_swap
      FROM swap_charges_log scl
      JOIN positions p ON scl.position_id = p.id
      JOIN trading_accounts ta ON p.account_id = ta.id
      JOIN users u ON ta.user_id = u.id
      ${dateFilter}
      GROUP BY ta.id, ta.account_number, u.email
      ORDER BY total_swap DESC
      LIMIT ?
    `, params);

    return topAccounts;
  }

  /**
   * Check if swap should be applied (market hours validation)
   * @returns {boolean} True if within swap application hours
   */
  static isSwapApplicationTime() {
    const now = new Date();
    const hour = now.getHours();
    // Swap is typically applied at 5 PM EST (17:00)
    // Allow application between 5 PM and 6 PM
    return hour >= 17 && hour < 18;
  }
}

module.exports = SwapService;
