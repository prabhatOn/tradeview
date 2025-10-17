/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const { executeQuery } = require('../config/database');
const bcrypt = require('bcryptjs');
const TradingAccount = require('./TradingAccount');

class User {
  constructor(data) {
    this.id = data.id;
    this.uuid = data.uuid;
    this.email = data.email;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.phone = data.phone;
    this.status = data.status;
    this.emailVerified = data.email_verified;
    this.kycStatus = data.kyc_status;
    this.preferredLeverage = data.preferred_leverage;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.lastLogin = data.last_login;
  }

  // Create a new user with default trading account
  static async create(userData) {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      preferredLeverage = 100,
      status = 'active',
      emailVerified = false,
      kycStatus = 'pending'
    } = userData;

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const userResult = await executeQuery(
      `INSERT INTO users (
        email,
        password_hash,
        first_name,
        last_name,
        phone,
        status,
        email_verified,
        kyc_status,
        preferred_leverage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        email,
        hashedPassword,
        firstName,
        lastName,
        phone || null,
        status,
        emailVerified ? 1 : 0,
        kycStatus,
        preferredLeverage
      ]
    );

    const userId = userResult.insertId;

    // Get the created user data
    const [userRows] = await executeQuery('SELECT * FROM users WHERE id = ?', [userId]);
    const user = new User(userRows);

    // Create default trading account with zero balance
    const accountNumber = `100${String(userId).padStart(7, '0')}`;
    await executeQuery(
      `INSERT INTO trading_accounts (
        user_id, account_number, account_type, currency, leverage, 
        balance, equity, free_margin, status
      ) VALUES (?, ?, 'live', 'USD', ?, 0.00, 0.00, 0.00, 'active')`,
      [userId, accountNumber, preferredLeverage]
    );

    return user;
  }

  // Find user by ID
  static async findById(id) {
    const users = await executeQuery(
      `SELECT u.*, 
              GROUP_CONCAT(DISTINCT r.name) as roles,
              COUNT(DISTINCT ta.id) as trading_accounts_count
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       LEFT JOIN trading_accounts ta ON u.id = ta.user_id AND ta.status = 'active'
       WHERE u.id = ?
       GROUP BY u.id`,
      [id]
    );

    if (!users.length) return null;
    
    const userData = users[0];
    const user = new User(userData);
    user.roles = userData.roles ? userData.roles.split(',') : [];
    user.tradingAccountsCount = userData.trading_accounts_count || 0;
    
    return user;
  }

  // Find user by email
  static async findByEmail(email) {
    const users = await executeQuery(
      `SELECT u.*, 
              GROUP_CONCAT(DISTINCT r.name) as roles
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.email = ?
       GROUP BY u.id`,
      [email]
    );

    if (!users.length) return null;
    
    const userData = users[0];
    const user = new User(userData);
    user.roles = userData.roles ? userData.roles.split(',') : [];
    user.passwordHash = userData.password_hash; // Include for authentication
    
    return user;
  }

  // Update user's last login
  async updateLastLogin() {
    await executeQuery(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [this.id]
    );
    this.lastLogin = new Date();
  }

  // Get user's trading accounts
  async getTradingAccounts() {
    return await TradingAccount.findByUserId(this.id);
  }

  // Verify password
  async verifyPassword(password) {
    if (!this.passwordHash) {
      // Fetch password hash if not loaded
      const result = await executeQuery(
        'SELECT password_hash FROM users WHERE id = ?',
        [this.id]
      );
      if (!result.length) return false;
      this.passwordHash = result[0].password_hash;
    }
    
    return await bcrypt.compare(password, this.passwordHash);
  }

  // Update user profile
  async update(updateData) {
    const allowedFields = ['first_name', 'last_name', 'phone'];
    const updates = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });

    if (updates.length === 0) return this;

    values.push(this.id);
    await executeQuery(
      `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    // Refresh user data
    return await User.findById(this.id);
  }

  // Convert to JSON for API responses
  toJSON() {
    const roles = this.roles || [];
    return {
      id: this.id,
      uuid: this.uuid,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      phone: this.phone,
      status: this.status,
      emailVerified: this.emailVerified,
      kycStatus: this.kycStatus,
      preferredLeverage: this.preferredLeverage,
      roles: roles,
      role: roles.length > 0 ? roles[0] : 'user', // Primary role for frontend compatibility
      tradingAccountsCount: this.tradingAccountsCount || 0,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLogin: this.lastLogin
    };
  }
}

module.exports = User;