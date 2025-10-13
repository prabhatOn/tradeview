/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const { executeQuery } = require('../config/database');

const DEFAULT_ACCOUNT_TYPE = 'live';
const DEFAULT_TIER_LEVEL = 'standard';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const normalizeChargeRow = (row) => ({
  id: row.id,
  symbolId: row.symbol_id,
  accountType: row.account_type,
  chargeType: row.charge_type,
  chargeValue: parseFloat(row.charge_value),
  chargeUnit: row.charge_unit,
  value: parseFloat(row.charge_value),
  unit: row.charge_unit,
  tierLevel: row.tier_level,
  isActive: Boolean(row.is_active),
  effectiveFrom: row.effective_from,
  effectiveUntil: row.effective_until,
  source: 'trading_charge'
});

const computeMatchScore = (row, symbolId, accountType, tierLevel) => {
  let score = 0;
  if (row.symbol_id === symbolId) {
    score += 8;
  } else if (row.symbol_id === null) {
    score += 2;
  }

  if (row.account_type === accountType) {
    score += 4;
  } else if (row.account_type === DEFAULT_ACCOUNT_TYPE) {
    score += 2;
  }

  if (row.tier_level === tierLevel) {
    score += 2;
  } else if (row.tier_level === DEFAULT_TIER_LEVEL) {
    score += 1;
  }

  if (row.symbol_id === null && row.account_type !== accountType) {
    score -= 1;
  }

  return score;
};

const selectBestCharge = (rows, type, symbolId, accountType, tierLevel) => {
  let best = null;
  let bestScore = -Infinity;

  for (const row of rows) {
    if (row.charge_type !== type) continue;
    const score = computeMatchScore(row, symbolId, accountType, tierLevel);
    if (score > bestScore) {
      bestScore = score;
      best = normalizeChargeRow(row);
    }
  }

  return best;
};

const inferUnitDefault = (chargeType) => {
  switch (chargeType) {
    case 'commission':
    case 'swap_long':
    case 'swap_short':
      return 'per_lot';
    case 'spread_markup':
      return 'pips';
    default:
      return 'per_lot';
  }
};

const parseNumeric = (value, fallback = 0) => {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const calculateSwapNights = (openedAt, closedAt) => {
  if (!openedAt || !closedAt) return 0;
  const openDate = new Date(openedAt);
  const closeDate = new Date(closedAt);
  if (Number.isNaN(openDate.getTime()) || Number.isNaN(closeDate.getTime())) {
    return 0;
  }
  if (closeDate <= openDate) return 0;

  const durationMs = closeDate - openDate;
  let nights = Math.floor(durationMs / MS_PER_DAY);

  const openUTC = Date.UTC(openDate.getUTCFullYear(), openDate.getUTCMonth(), openDate.getUTCDate());
  const closeUTC = Date.UTC(closeDate.getUTCFullYear(), closeDate.getUTCMonth(), closeDate.getUTCDate());
  if (closeUTC > openUTC) {
    nights = Math.max(nights, 1);
  }

  return nights;
};

class ChargeService {
  static async getChargeProfile({ symbolId, accountType = DEFAULT_ACCOUNT_TYPE, tierLevel = DEFAULT_TIER_LEVEL } = {}) {
    const symbolRows = await executeQuery(
      `SELECT id, symbol, name, commission_value, swap_long, swap_short, spread_markup,
              contract_size, pip_size, margin_requirement
       FROM symbols WHERE id = ? LIMIT 1`,
      [symbolId]
    );

    if (!symbolRows || !symbolRows.length) {
      throw new Error('Symbol not found');
    }

    const symbol = symbolRows[0];

    const chargeRows = await executeQuery(
      `SELECT id, symbol_id, account_type, charge_type, charge_value, charge_unit, tier_level,
              is_active, effective_from, effective_until
       FROM trading_charges
       WHERE is_active = 1
         AND (symbol_id = ? OR symbol_id IS NULL)
         AND (account_type = ? OR account_type = ?)
         AND (tier_level = ? OR tier_level = ?)
         AND (effective_from IS NULL OR effective_from <= NOW())
         AND (effective_until IS NULL OR effective_until >= NOW())`,
      [symbolId, accountType, DEFAULT_ACCOUNT_TYPE, tierLevel, DEFAULT_TIER_LEVEL]
    );

  const charges = Array.isArray(chargeRows) ? chargeRows : [];

    const commissionCharge = selectBestCharge(charges, 'commission', symbolId, accountType, tierLevel);
    const spreadCharge = selectBestCharge(charges, 'spread_markup', symbolId, accountType, tierLevel);
    const swapLongCharge = selectBestCharge(charges, 'swap_long', symbolId, accountType, tierLevel);
    const swapShortCharge = selectBestCharge(charges, 'swap_short', symbolId, accountType, tierLevel);

    return {
      symbolId: symbol.id,
      symbol: symbol.symbol,
      name: symbol.name,
      commission: commissionCharge || {
        value: parseNumeric(symbol.commission_value, 0),
        unit: 'per_lot',
        source: 'symbol_default'
      },
      spreadMarkup: spreadCharge || {
        value: parseNumeric(symbol.spread_markup, 0),
        unit: 'pips',
        source: 'symbol_default'
      },
      swapLong: swapLongCharge || {
        value: parseNumeric(symbol.swap_long, 0),
        unit: 'per_lot',
        source: 'symbol_default'
      },
      swapShort: swapShortCharge || {
        value: parseNumeric(symbol.swap_short, 0),
        unit: 'per_lot',
        source: 'symbol_default'
      },
      contractSize: parseNumeric(symbol.contract_size, 100000),
      pipSize: parseNumeric(symbol.pip_size, 0.0001),
      marginRequirement: parseNumeric(symbol.margin_requirement, 1)
    };
  }

  static calculateCommission(lotSize, profile) {
    if (!profile || !profile.commission) return 0;
    const value = parseNumeric(profile.commission.chargeValue ?? profile.commission.value, 0);
    const unit = profile.commission.chargeUnit || profile.commission.unit || inferUnitDefault('commission');

    switch (unit) {
      case 'per_lot':
        return value * parseNumeric(lotSize, 0);
      case 'percentage':
        return (value / 100) * parseNumeric(lotSize, 0) * parseNumeric(profile.contractSize, 1);
      case 'fixed':
        return value;
      default:
        return value * parseNumeric(lotSize, 0);
    }
  }

  static calculateSpreadMarkup(pips, profile) {
    if (!profile || !profile.spreadMarkup) return 0;
    const value = parseNumeric(profile.spreadMarkup.chargeValue ?? profile.spreadMarkup.value, 0);
    const unit = profile.spreadMarkup.chargeUnit || profile.spreadMarkup.unit || inferUnitDefault('spread_markup');

    if (unit === 'pips') {
      return value;
    }

    if (unit === 'per_lot') {
      return value * parseNumeric(pips, 0);
    }

    return value;
  }

  static calculateSwap({ lotSize, side, openedAt, closedAt, profile }) {
    if (!profile) return 0;
    const nights = calculateSwapNights(openedAt, closedAt);
    if (nights <= 0) return 0;

    const chargeDef = side === 'buy' ? profile.swapLong : profile.swapShort;
    if (!chargeDef) return 0;

    const value = parseNumeric(chargeDef.chargeValue ?? chargeDef.value, 0);
    const unit = chargeDef.chargeUnit || chargeDef.unit || inferUnitDefault('swap_long');
    const lots = parseNumeric(lotSize, 0);

    let swap = value * nights;

    switch (unit) {
      case 'per_lot':
        swap *= lots;
        break;
      case 'fixed':
        break;
      case 'percentage':
        swap = (value / 100) * nights * lots * parseNumeric(profile.contractSize, 1);
        break;
      default:
        swap *= lots;
        break;
    }

    return swap;
  }

  static async listSymbolCharges() {
    const symbols = await executeQuery(`
      SELECT id, symbol, name, commission_value, swap_long, swap_short, spread_markup,
             contract_size, pip_size, margin_requirement, is_active
      FROM symbols
      ORDER BY symbol ASC
    `);

    return symbols.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      commissionPerLot: parseNumeric(row.commission_value, 0),
      swapLong: parseNumeric(row.swap_long, 0),
      swapShort: parseNumeric(row.swap_short, 0),
      spreadMarkup: parseNumeric(row.spread_markup, 0),
      contractSize: parseNumeric(row.contract_size, 100000),
      pipSize: parseNumeric(row.pip_size, 0.0001),
      marginRequirement: parseNumeric(row.margin_requirement, 1),
      status: row.is_active ? 'active' : 'inactive'
    }));
  }

  static async updateSymbolCharges(symbolId, { commissionPerLot, swapLong, swapShort, spreadMarkup, marginRequirement, status }) {
    const updates = [];
    const params = [];

    if (commissionPerLot !== undefined) {
      updates.push('commission_value = ?');
      params.push(parseNumeric(commissionPerLot, 0));
    }
    if (swapLong !== undefined) {
      updates.push('swap_long = ?');
      params.push(parseNumeric(swapLong, 0));
    }
    if (swapShort !== undefined) {
      updates.push('swap_short = ?');
      params.push(parseNumeric(swapShort, 0));
    }
    if (spreadMarkup !== undefined) {
      updates.push('spread_markup = ?');
      params.push(parseNumeric(spreadMarkup, 0));
    }
    if (marginRequirement !== undefined) {
      updates.push('margin_requirement = ?');
      params.push(parseNumeric(marginRequirement, 1));
    }
    if (status !== undefined) {
      updates.push('is_active = ?');
      params.push(status === 'active' ? 1 : 0);
    }

    if (!updates.length) {
      return { updated: false };
    }

    params.push(symbolId);

    await executeQuery(
      `UPDATE symbols SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );

    return { updated: true };
  }

  static async getBrokerageRates() {
    const rows = await executeQuery(`
      SELECT charge_type, charge_value, charge_unit, account_type, tier_level
      FROM trading_charges
      WHERE is_active = 1 AND charge_type IN ('commission', 'spread_markup')
    `);

    const result = {
      standard: { commission: 0, spreadMarkup: 0, unit: 'per_lot' },
      vip: { commission: 0, spreadMarkup: 0, unit: 'per_lot' }
    };

    for (const row of rows) {
      const target = row.tier_level === 'vip' ? result.vip : result.standard;
      if (row.charge_type === 'commission') {
        target.commission = parseNumeric(row.charge_value, target.commission);
        target.unit = row.charge_unit || target.unit;
      } else if (row.charge_type === 'spread_markup') {
        target.spreadMarkup = parseNumeric(row.charge_value, target.spreadMarkup);
      }
    }

    return result;
  }

  static async upsertBrokerageRate({ accountType = DEFAULT_ACCOUNT_TYPE, tierLevel = DEFAULT_TIER_LEVEL, commission, spreadMarkup, commissionUnit = 'per_lot', spreadUnit = 'pips' }) {
    const ensureRow = async (chargeType, value, unit) => {
      if (value === undefined || value === null) return;
      const existingRows = await executeQuery(
        `SELECT id FROM trading_charges
         WHERE charge_type = ? AND account_type = ? AND tier_level = ? AND symbol_id IS NULL LIMIT 1`,
        [chargeType, accountType, tierLevel]
      );

      const existing = Array.isArray(existingRows) ? existingRows[0] : null;

      if (existing && existing.id) {
        await executeQuery(
          `UPDATE trading_charges
           SET charge_value = ?, charge_unit = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [parseNumeric(value, 0), unit || inferUnitDefault(chargeType), existing.id]
        );
      } else {
        await executeQuery(
          `INSERT INTO trading_charges (symbol_id, account_type, charge_type, charge_value, charge_unit, tier_level, is_active)
           VALUES (NULL, ?, ?, ?, ?, ?, 1)` ,
          [accountType, chargeType, parseNumeric(value, 0), unit || inferUnitDefault(chargeType), tierLevel]
        );
      }
    };

    await ensureRow('commission', commission, commissionUnit);
    await ensureRow('spread_markup', spreadMarkup, spreadUnit);
  }
}

module.exports = ChargeService;
