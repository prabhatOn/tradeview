const express = require('express');
const Joi = require('joi');
const { executeQuery } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { adminMiddleware } = require('../middleware/auth');
const User = require('../models/User');

const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(1).max(100).required(),
  lastName: Joi.string().min(1).max(100).required(),
  phone: Joi.string().allow(null, '').optional(),
  status: Joi.string()
    .valid('active', 'inactive', 'suspended', 'pending_verification')
    .default('active'),
  role: Joi.string().valid('user', 'admin', 'manager', 'support').default('user'),
  emailVerified: Joi.boolean().default(false),
  kycStatus: Joi.string().valid('pending', 'submitted', 'approved', 'rejected').default('pending'),
});

const updateVerificationSchema = Joi.object({
  verified: Joi.boolean().required(),
  reason: Joi.string().allow(null, '').max(500).optional(),
});

const router = express.Router();

// All routes require admin role
router.use(adminMiddleware);

const ADMIN_ROLE_NAME = 'admin';

const buildAdminExclusionCondition = (alias = 'u') => `NOT EXISTS (
  SELECT 1
  FROM user_roles ur
  INNER JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = ${alias}.id AND LOWER(r.name) = '${ADMIN_ROLE_NAME}'
)`;

// Get dashboard statistics
router.get('/dashboard', asyncHandler(async (req, res) => {
  const adminExclusionCondition = buildAdminExclusionCondition('u');

  const stats = await Promise.all([
    // User statistics (exclude admin accounts)
    executeQuery(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_users_30d,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
        COUNT(CASE WHEN email_verified = 1 THEN 1 END) as verified_users
      FROM users u
      WHERE ${adminExclusionCondition}
    `),

    // Trading statistics
    executeQuery(`
      SELECT 
        COUNT(*) as total_accounts,
        COALESCE(SUM(balance), 0) as total_balance,
        COALESCE(SUM(equity), 0) as total_equity,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_accounts_30d
      FROM trading_accounts
    `),

    // Transaction statistics
    executeQuery(`
      SELECT 
        (SELECT COALESCE(SUM(net_amount), 0) FROM deposits WHERE status = 'completed') as total_deposits,
        (SELECT COALESCE(SUM(net_amount), 0) FROM withdrawals WHERE status = 'completed') as total_withdrawals,
        (SELECT COUNT(*) FROM deposits WHERE status = 'pending') as pending_deposits,
        (SELECT COUNT(*) FROM withdrawals WHERE status = 'pending') as pending_withdrawals
    `),

    // Position statistics
    executeQuery(`
      SELECT 
        COUNT(*) as total_positions,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_positions,
        COALESCE(SUM(CASE WHEN status = 'closed' AND profit > 0 THEN profit ELSE 0 END), 0) as total_profits,
        COALESCE(SUM(CASE WHEN status = 'closed' AND profit < 0 THEN ABS(profit) ELSE 0 END), 0) as total_losses
      FROM positions
    `),

    // Support ticket statistics
    executeQuery(`
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tickets,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as new_tickets_7d
      FROM support_tickets
    `)
  ]);

  res.json({
    success: true,
    data: {
      users: stats[0][0],
      trading: stats[1][0],
      transactions: stats[2][0],
      positions: stats[3][0],
      support: stats[4][0]
    }
  });
}));

// Get all users with filtering and pagination
router.get('/users', asyncHandler(async (req, res) => {
  const rawPage = Number.parseInt(req.query.page, 10);
  const rawLimit = Number.parseInt(req.query.limit, 10);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const sortByParam = (req.query.sortBy || 'created_at').toString();
  const sortOrderParam = (req.query.sortOrder || 'desc').toString();
  const includeAdmins = String(req.query.includeAdmins || '').toLowerCase() === 'true';

  const limitValue = Number.isNaN(rawLimit)
    ? 20
    : Math.min(Math.max(rawLimit, 1), 100);
  const pageNumber = Number.isNaN(rawPage) ? 1 : Math.max(rawPage, 1);
  const offsetValue = (pageNumber - 1) * limitValue;
  const page = pageNumber;
  const limit = limitValue;

  const sortableFields = {
    created_at: 'u.created_at',
    email: 'u.email',
    status: 'u.status',
    last_login_at: 'u.last_login',
    first_name: 'u.first_name',
    trading_accounts_count: 'trading_accounts_count',
    total_balance: 'total_balance'
  };

  const sortBy = sortableFields[sortByParam] || 'u.created_at';
  const sortOrder = sortOrderParam.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const filters = [];
  const params = [];

  if (!includeAdmins) {
    filters.push(buildAdminExclusionCondition('u'));
  }

  if (search) {
    filters.push('(u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status) {
    filters.push('u.status = ?');
    params.push(status);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const users = await executeQuery(`
    SELECT
      u.id,
      u.email,
      u.first_name,
      u.last_name,
      u.phone,
      u.status,
      u.email_verified AS is_verified,
      u.created_at,
      u.last_login AS last_login_at,
      COALESCE(ta_stats.trading_accounts_count, 0) AS trading_accounts_count,
      COALESCE(ta_stats.total_balance, 0) AS total_balance,
      roles_data.roles,
      roles_data.primary_role AS role
    FROM users u
    LEFT JOIN (
      SELECT 
        ta.user_id,
        COUNT(*) AS trading_accounts_count,
        COALESCE(SUM(ta.balance), 0) AS total_balance
      FROM trading_accounts ta
      GROUP BY ta.user_id
    ) AS ta_stats ON ta_stats.user_id = u.id
    LEFT JOIN (
      SELECT
        ur.user_id,
        GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ',') AS roles,
        SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ','), ',', 1) AS primary_role
      FROM user_roles ur
      INNER JOIN roles r ON r.id = ur.role_id
      GROUP BY ur.user_id
    ) AS roles_data ON roles_data.user_id = u.id
  ${whereClause}
    GROUP BY u.id
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT ${limitValue} OFFSET ${offsetValue}
  `, params);

  // Get total count
  const totalCount = await executeQuery(`
    SELECT COUNT(*) as count
    FROM users u
    ${whereClause}
  `, params);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page,
        limit,
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / limit)
      }
    }
  });
}));

// Get user details
router.get('/users/:id', asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id);

  const users = await executeQuery(`
    SELECT 
      u.*,
      ua.country,
      ua.state,
      ua.city,
      ua.address_line_1,
      ua.address_line_2,
      ua.postal_code,
      roles_data.roles,
      roles_data.primary_role,
      roles_data.has_ib
    FROM users u
    LEFT JOIN user_addresses ua ON u.id = ua.user_id AND ua.is_primary = 1
    LEFT JOIN (
      SELECT
        ur.user_id,
        GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ',') AS roles,
        SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ','), ',', 1) AS primary_role,
        MAX(CASE WHEN LOWER(r.name) = 'ib' THEN 1 ELSE 0 END) AS has_ib
      FROM user_roles ur
      INNER JOIN roles r ON r.id = ur.role_id
      GROUP BY ur.user_id
    ) AS roles_data ON roles_data.user_id = u.id
    WHERE u.id = ?
  `, [userId]);

  if (!users.length) {
    throw new AppError('User not found', 404);
  }

  const user = users[0];

  // Get user's trading accounts
  const accounts = await executeQuery(`
    SELECT 
      id,
      account_number,
      account_type,
      balance,
      equity,
      margin,
      free_margin,
      leverage,
      currency,
      status,
      created_at
    FROM trading_accounts
    WHERE user_id = ?
  `, [userId]);

  // Get user's recent activity
  const activity = await executeQuery(`
    SELECT 
      'position' as type,
      'Position opened' as action,
      symbol,
      created_at
    FROM positions
    WHERE user_id = ?
    
    UNION ALL
    
    SELECT 
      'deposit' as type,
      'Deposit request' as action,
      CONCAT(amount, ' ', currency) as symbol,
      created_at
    FROM deposits
    WHERE user_id = ?
    
    UNION ALL
    
    SELECT 
      'withdrawal' as type,
      'Withdrawal request' as action,
      CONCAT(amount, ' ', currency) as symbol,
      created_at
    FROM withdrawals
    WHERE user_id = ?
    
    ORDER BY created_at DESC
    LIMIT 10
  `, [userId, userId, userId]);

  res.json({
    success: true,
    data: {
      user,
      accounts,
      activity
    }
  });
}));

// Create new user
router.post('/users', asyncHandler(async (req, res) => {
  const { error, value } = createUserSchema.validate(req.body, { abortEarly: false });
  if (error) {
    throw new AppError(error.details.map((detail) => detail.message).join(', '), 400);
  }

  const existingUsers = await executeQuery('SELECT id FROM users WHERE email = ?', [value.email]);
  if (existingUsers.length) {
    throw new AppError('A user with this email already exists.', 409);
  }

  const { role, emailVerified, status, kycStatus, ...userPayload } = value;

  const newUser = await User.create({
    ...userPayload,
    status,
    emailVerified,
    kycStatus,
  });

  if (role) {
    const roleRows = await executeQuery('SELECT id FROM roles WHERE LOWER(name) = LOWER(?) LIMIT 1', [role]);
    if (roleRows.length) {
      await executeQuery(`
        INSERT INTO user_roles (user_id, role_id)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE assigned_at = CURRENT_TIMESTAMP
      `, [newUser.id, roleRows[0].id]);
    }
  }

  await executeQuery(`
    INSERT INTO admin_actions (admin_user_id, action, target_type, target_id, details)
    VALUES (?, 'create_user', 'user', ?, ?)
  `, [
    req.user.id,
    newUser.id,
    JSON.stringify({ role, status, emailVerified, createdUserId: newUser.id }),
  ]);

  const hydratedUser = await User.findById(newUser.id);

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: { user: hydratedUser ? hydratedUser.toJSON() : newUser.toJSON() },
  });
}));

// Update user status
router.patch('/users/:id/status', asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { status, reason } = req.body;

  if (!['active', 'suspended', 'inactive'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  await executeQuery(`
    UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [status, userId]);

  // Log the action
  await executeQuery(`
    INSERT INTO admin_actions (admin_user_id, action, target_type, target_id, details)
    VALUES (?, 'status_change', 'user', ?, ?)
  `, [req.user.id, userId, JSON.stringify({ status, reason })]);

  res.json({ success: true, message: 'User status updated successfully' });
}));

// Update user email verification
router.patch('/users/:id/verification', asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    throw new AppError('Invalid user ID', 400);
  }

  const { error, value } = updateVerificationSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const updateResult = await executeQuery(`
    UPDATE users SET email_verified = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [value.verified ? 1 : 0, userId]);

  if (updateResult.affectedRows === 0) {
    throw new AppError('User not found', 404);
  }

  await executeQuery(`
    INSERT INTO admin_actions (admin_user_id, action, target_type, target_id, details)
    VALUES (?, ?, 'user', ?, ?)
  `, [
    req.user.id,
    value.verified ? 'user_verify' : 'user_unverify',
    userId,
    JSON.stringify({ verified: value.verified, reason: value.reason || null }),
  ]);

  res.json({
    success: true,
    message: value.verified ? 'User verified successfully' : 'User verification revoked',
  });
}));

// Delete user (with safeguards)
router.delete('/users/:id', asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (Number.isNaN(userId)) {
    throw new AppError('Invalid user ID', 400);
  }

  if (userId === req.user.id) {
    throw new AppError('You cannot delete your own account.', 400);
  }

  const users = await executeQuery(`
    SELECT u.id, u.email, u.status
    FROM users u
    WHERE u.id = ?
  `, [userId]);

  if (!users.length) {
    throw new AppError('User not found', 404);
  }

  const adminRole = await executeQuery(`
    SELECT 1
    FROM user_roles ur
    INNER JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = ? AND LOWER(r.name) = ?
    LIMIT 1
  `, [userId, ADMIN_ROLE_NAME.toLowerCase()]);

  if (adminRole.length) {
    throw new AppError('Admin accounts cannot be deleted.', 400);
  }

  await executeQuery('DELETE FROM users WHERE id = ?', [userId]);

  await executeQuery(`
    INSERT INTO admin_actions (admin_user_id, action, target_type, target_id, details)
    VALUES (?, 'delete_user', 'user', ?, ?)
  `, [
    req.user.id,
    userId,
    JSON.stringify({ deletedUserId: userId, email: users[0].email }),
  ]);

  res.json({
    success: true,
    message: 'User deleted successfully',
  });
}));

// Get pending transactions
router.get('/transactions/pending', asyncHandler(async (req, res) => {
  const type = req.query.type; // 'deposits', 'withdrawals', or undefined for both
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  let sql = '';
  let params = [];

  if (type === 'deposits') {
    sql = `
      SELECT 
        'deposit' as type,
        d.id,
        d.transaction_id,
        d.amount,
        d.currency,
        d.fee,
        d.net_amount,
        d.payment_reference,
        d.user_notes,
        d.created_at,
        u.email as user_email,
        u.first_name,
        u.last_name,
        pm.name as payment_method,
        ta.account_number
      FROM deposits d
      JOIN users u ON d.user_id = u.id
      JOIN payment_methods pm ON d.payment_method_id = pm.id
      JOIN trading_accounts ta ON d.account_id = ta.id
      WHERE d.status = 'pending'
      ORDER BY d.created_at ASC
      LIMIT ? OFFSET ?
    `;
    params = [limit, offset];
  } else if (type === 'withdrawals') {
    sql = `
      SELECT 
        'withdrawal' as type,
        w.id,
        w.transaction_id,
        w.amount,
        w.currency,
        w.fee,
        w.net_amount,
        w.payment_reference,
        w.user_notes,
        w.created_at,
        u.email as user_email,
        u.first_name,
        u.last_name,
        pm.name as payment_method,
        ta.account_number
      FROM withdrawals w
      JOIN users u ON w.user_id = u.id
      JOIN payment_methods pm ON w.payment_method_id = pm.id
      JOIN trading_accounts ta ON w.account_id = ta.id
      WHERE w.status = 'pending'
      ORDER BY w.created_at ASC
      LIMIT ? OFFSET ?
    `;
    params = [limit, offset];
  } else {
    sql = `
      SELECT 
        'deposit' as type,
        d.id,
        d.transaction_id,
        d.amount,
        d.currency,
        d.fee,
        d.net_amount,
        d.payment_reference,
        d.user_notes,
        d.created_at,
        u.email as user_email,
        u.first_name,
        u.last_name,
        pm.name as payment_method,
        ta.account_number
      FROM deposits d
      JOIN users u ON d.user_id = u.id
      JOIN payment_methods pm ON d.payment_method_id = pm.id
      JOIN trading_accounts ta ON d.account_id = ta.id
      WHERE d.status = 'pending'
      
      UNION ALL
      
      SELECT 
        'withdrawal' as type,
        w.id,
        w.transaction_id,
        w.amount,
        w.currency,
        w.fee,
        w.net_amount,
        w.payment_reference,
        w.user_notes,
        w.created_at,
        u.email as user_email,
        u.first_name,
        u.last_name,
        pm.name as payment_method,
        ta.account_number
      FROM withdrawals w
      JOIN users u ON w.user_id = u.id
      JOIN payment_methods pm ON w.payment_method_id = pm.id
      JOIN trading_accounts ta ON w.account_id = ta.id
      WHERE w.status = 'pending'
      
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `;
    params = [limit, offset];
  }

  const transactions = await executeQuery(sql, params);

  res.json({ transactions });
}));

// Process deposit
router.patch('/deposits/:id/process', asyncHandler(async (req, res) => {
  const depositId = parseInt(req.params.id);
  const { action, adminNotes } = req.body; // action: 'approve' or 'reject'

  if (!['approve', 'reject'].includes(action)) {
    throw new AppError('Invalid action', 400);
  }

  // Get deposit details
  const deposits = await executeQuery(`
    SELECT * FROM deposits WHERE id = ? AND status = 'pending'
  `, [depositId]);

  if (!deposits.length) {
    throw new AppError('Deposit not found or already processed', 404);
  }

  const deposit = deposits[0];

  if (action === 'approve') {
    // Update account balance
    await executeQuery(`
      UPDATE trading_accounts 
      SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [deposit.net_amount, deposit.account_id]);

    // Update deposit status
    await executeQuery(`
      UPDATE deposits 
      SET status = 'completed', admin_notes = ?, processed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [adminNotes, depositId]);
  } else {
    // Update deposit status to rejected
    await executeQuery(`
      UPDATE deposits 
      SET status = 'rejected', admin_notes = ?, processed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [adminNotes, depositId]);
  }

  // Log admin action
  await executeQuery(`
    INSERT INTO admin_actions (admin_user_id, action, target_type, target_id, details)
    VALUES (?, ?, 'deposit', ?, ?)
  `, [req.user.id, `deposit_${action}`, depositId, JSON.stringify({ adminNotes })]);

  res.json({ message: `Deposit ${action}ed successfully` });
}));

// Process withdrawal
router.patch('/withdrawals/:id/process', asyncHandler(async (req, res) => {
  const withdrawalId = parseInt(req.params.id);
  const { action, adminNotes } = req.body; // action: 'approve' or 'reject'

  if (!['approve', 'reject'].includes(action)) {
    throw new AppError('Invalid action', 400);
  }

  // Get withdrawal details
  const withdrawals = await executeQuery(`
    SELECT * FROM withdrawals WHERE id = ? AND status = 'pending'
  `, [withdrawalId]);

  if (!withdrawals.length) {
    throw new AppError('Withdrawal not found or already processed', 404);
  }

  const withdrawal = withdrawals[0];

  if (action === 'approve') {
    // Deduct from account balance (fee + amount)
    const totalDeduction = parseFloat(withdrawal.amount) + parseFloat(withdrawal.fee);
    
    await executeQuery(`
      UPDATE trading_accounts 
      SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [totalDeduction, withdrawal.account_id]);

    // Update withdrawal status
    await executeQuery(`
      UPDATE withdrawals 
      SET status = 'completed', admin_notes = ?, processed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [adminNotes, withdrawalId]);
  } else {
    // Update withdrawal status to rejected
    await executeQuery(`
      UPDATE withdrawals 
      SET status = 'rejected', admin_notes = ?, processed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [adminNotes, withdrawalId]);
  }

  // Log admin action
  await executeQuery(`
    INSERT INTO admin_actions (admin_user_id, action, target_type, target_id, details)
    VALUES (?, ?, 'withdrawal', ?, ?)
  `, [req.user.id, `withdrawal_${action}`, withdrawalId, JSON.stringify({ adminNotes })]);

  res.json({ message: `Withdrawal ${action}ed successfully` });
}));

// Get support tickets
router.get('/support', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const status = req.query.status || '';
  const priority = req.query.priority || '';

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (status) {
    whereClause += ' AND st.status = ?';
    params.push(status);
  }

  if (priority) {
    whereClause += ' AND st.priority = ?';
    params.push(priority);
  }

  const tickets = await executeQuery(`
    SELECT 
      st.id,
      st.ticket_number,
      st.subject,
      st.category,
      st.priority,
      st.status,
      st.created_at,
      st.updated_at,
      u.email as user_email,
      u.first_name,
      u.last_name,
      admin.first_name as assigned_admin_name,
      (SELECT COUNT(*) FROM support_messages WHERE ticket_id = st.id) as message_count
    FROM support_tickets st
    JOIN users u ON st.user_id = u.id
    LEFT JOIN users admin ON st.assigned_admin_id = admin.id
    ${whereClause}
    ORDER BY st.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  const totalCount = await executeQuery(`
    SELECT COUNT(*) as count FROM support_tickets st ${whereClause}
  `, params);

  res.json({
    tickets,
    pagination: {
      page,
      limit,
      total: totalCount[0].count,
      pages: Math.ceil(totalCount[0].count / limit)
    }
  });
}));

// Assign support ticket
router.patch('/support/:id/assign', asyncHandler(async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const { adminId } = req.body;

  // Verify admin user exists
  if (adminId) {
    const admins = await executeQuery(`
      SELECT id FROM users WHERE id = ? AND role = 'admin'
    `, [adminId]);

    if (!admins.length) {
      throw new AppError('Invalid admin user', 400);
    }
  }

  await executeQuery(`
    UPDATE support_tickets 
    SET assigned_admin_id = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `, [adminId || null, ticketId]);

  res.json({ message: 'Ticket assigned successfully' });
}));

// Update support ticket status
router.patch('/support/:id/status', asyncHandler(async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const { status } = req.body;

  if (!['open', 'pending', 'resolved', 'closed'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  await executeQuery(`
    UPDATE support_tickets 
    SET status = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `, [status, ticketId]);

  res.json({ message: 'Ticket status updated successfully' });
}));

// Get trading statistics
router.get('/trading/stats', asyncHandler(async (req, res) => {
  const rangeParam = Number.parseInt(req.query.range, 10);
  const rangeDays = Number.isNaN(rangeParam) ? 30 : Math.min(Math.max(rangeParam, 1), 365);

  const stats = await Promise.all([
    // Position statistics
    executeQuery(`
      SELECT 
        COUNT(*) as total_positions,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_positions,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_positions,
        COUNT(CASE WHEN opened_at >= DATE_SUB(NOW(), INTERVAL ${rangeDays} DAY) THEN 1 END) as new_positions
      FROM positions
    `),

    // Volume statistics
    executeQuery(`
      SELECT 
        COALESCE(SUM(p.lot_size), 0) as total_volume,
        COALESCE(SUM(CASE WHEN p.opened_at >= DATE_SUB(NOW(), INTERVAL ${rangeDays} DAY) THEN p.lot_size ELSE 0 END), 0) as recent_volume,
        COUNT(DISTINCT ta.user_id) as active_traders
      FROM positions p
      INNER JOIN trading_accounts ta ON ta.id = p.account_id
      WHERE p.status = 'closed'
    `),

    // P&L statistics
    executeQuery(`
      SELECT 
        COALESCE(SUM(CASE WHEN profit > 0 THEN profit ELSE 0 END), 0) as total_profits,
        COALESCE(SUM(CASE WHEN profit < 0 THEN ABS(profit) ELSE 0 END), 0) as total_losses,
        COALESCE(SUM(profit), 0) as net_pnl
      FROM positions
      WHERE status = 'closed'
    `),

    // Top symbols
    executeQuery(`
      SELECT 
        s.symbol,
        COUNT(*) as position_count,
        COALESCE(SUM(p.lot_size), 0) as total_volume
      FROM positions p
      INNER JOIN symbols s ON s.id = p.symbol_id
      WHERE p.opened_at >= DATE_SUB(NOW(), INTERVAL ${rangeDays} DAY)
      GROUP BY s.symbol
      ORDER BY position_count DESC
      LIMIT 10
    `)
  ]);

  res.json({
    positions: stats[0][0],
    volume: stats[1][0],
    profitLoss: stats[2][0],
    topSymbols: stats[3]
  });
}));

// Get system settings
router.get('/settings', asyncHandler(async (req, res) => {
  const settings = await executeQuery(`
    SELECT setting_key, setting_value, description
    FROM system_settings
    ORDER BY setting_key
  `);

  const settingsObj = {};
  settings.forEach(setting => {
    settingsObj[setting.setting_key] = {
      value: setting.setting_value,
      description: setting.description
    };
  });

  res.json({ settings: settingsObj });
}));

// Update system settings
router.patch('/settings', asyncHandler(async (req, res) => {
  const { settings } = req.body;

  if (!settings || typeof settings !== 'object') {
    throw new AppError('Invalid settings format', 400);
  }

  for (const [key, value] of Object.entries(settings)) {
    await executeQuery(`
      UPDATE system_settings 
      SET setting_value = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE setting_key = ?
    `, [value, key]);
  }

  res.json({ message: 'Settings updated successfully' });
}));

module.exports = router;