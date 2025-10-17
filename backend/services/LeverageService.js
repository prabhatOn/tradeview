/**
 * Leverage Service
 * Handles leverage calculations, validations, and management
 */

class LeverageService {
  /**
   * Get available leverage options based on account type
   * @param {string} accountType - 'live', 'islamic', or 'professional'
   * @returns {number[]} Array of available leverage multipliers
   */
  static getAvailableLeverages(accountType) {
    const leverageOptions = {
      live: [1, 10, 20, 25, 50, 100, 200, 500],
      professional: [1, 10, 20, 25, 50, 100, 200, 500, 1000],
      islamic: [1, 10, 20, 25, 50, 100, 200]
    };
    return leverageOptions[accountType] || [1, 10, 50, 100];
  }

  /**
   * Calculate maximum position size based on leverage and balance
   * @param {number} balance - Account balance
   * @param {number} leverage - Leverage multiplier
   * @param {number} price - Current market price
   * @param {number} contractSize - Contract size for the symbol
   * @returns {number} Maximum lot size that can be traded
   */
  static calculateMaxPositionSize(balance, leverage, price, contractSize) {
    const tradingPower = balance * leverage;
    const maxLots = tradingPower / (price * contractSize);
    return Math.floor(maxLots * 100) / 100; // Round down to 2 decimals
  }

  /**
   * Validate leverage for account type
   * @param {number} leverage - Leverage to validate
   * @param {string} accountType - Account type
   * @returns {boolean} True if leverage is valid for account type
   */
  static validateLeverage(leverage, accountType) {
    const available = this.getAvailableLeverages(accountType);
    return available.includes(leverage);
  }

  /**
   * Calculate margin requirement percentage
   * @param {number} leverage - Leverage multiplier
   * @returns {string} Margin percentage (e.g., "0.20%" for 1:500)
   */
  static calculateMarginPercentage(leverage) {
    return ((100 / leverage).toFixed(2)) + '%';
  }

  /**
   * Calculate trading power
   * Trading Power = Balance × Leverage
   * @param {number} balance - Account balance
   * @param {number} leverage - Leverage multiplier
   * @returns {number} Total trading power
   */
  static calculateTradingPower(balance, leverage) {
    return balance * leverage;
  }

  /**
   * Get recommended leverage for balance amount
   * @param {number} balance - Account balance
   * @returns {number} Recommended leverage
   */
  static getRecommendedLeverage(balance) {
    if (balance < 100) return 50;
    if (balance < 500) return 100;
    if (balance < 1000) return 200;
    if (balance < 5000) return 500;
    return 500; // Max recommended for standard accounts
  }

  /**
   * Calculate position value
   * @param {number} lotSize - Position size in lots
   * @param {number} contractSize - Contract size
   * @param {number} price - Market price
   * @returns {number} Total position value
   */
  static calculatePositionValue(lotSize, contractSize, price) {
    return lotSize * contractSize * price;
  }

  /**
   * Check if leverage change is safe for existing positions
   * @param {number} currentLeverage - Current account leverage
   * @param {number} newLeverage - Proposed new leverage
   * @param {number} marginUsed - Currently used margin
   * @param {number} balance - Account balance
   * @returns {Object} {safe: boolean, reason: string}
   */
  static canChangeLeverage(currentLeverage, newLeverage, marginUsed, balance) {
    if (marginUsed === 0) {
      return { safe: true, reason: 'No open positions' };
    }

    // Calculate new margin required with new leverage
    const currentPositionValue = marginUsed * currentLeverage;
    const newMarginRequired = currentPositionValue / newLeverage;
    const freeMargin = balance - marginUsed;

    if (newMarginRequired > (balance - freeMargin)) {
      return {
        safe: false,
        reason: `Insufficient margin. New leverage would require $${newMarginRequired.toFixed(2)} but only $${(balance - freeMargin).toFixed(2)} available`
      };
    }

    // Check if margin level would be safe (>100%)
    const newMarginLevel = (balance / newMarginRequired) * 100;
    if (newMarginLevel < 100) {
      return {
        safe: false,
        reason: `Margin level would drop to ${newMarginLevel.toFixed(2)}% which is unsafe`
      };
    }

    return { safe: true, reason: 'Leverage change is safe' };
  }
}

module.exports = LeverageService;
