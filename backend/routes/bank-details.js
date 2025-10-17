/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const { asyncHandler } = require('../middleware/async-handler');
const { authMiddleware } = require('../middleware/auth');
const AppError = require('../utils/app-error');
const Joi = require('joi');

// Apply authentication to all routes
router.use(authMiddleware);

// Validation schema
const bankDetailsSchema = Joi.object({
  bankName: Joi.string().required().max(100),
  accountHolderName: Joi.string().required().max(100),
  accountNumber: Joi.string().required().max(50),
  ifscCode: Joi.string().required().max(20).pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/),
  accountType: Joi.string().valid('savings', 'current').default('savings'),
  branchName: Joi.string().max(100).allow('', null),
  isPrimary: Joi.boolean().default(false)
});

/**
 * GET /api/bank-details
 * Get all bank details for the logged-in user
 */
router.get('/', asyncHandler(async (req, res) => {
  const bankDetails = await executeQuery(`
    SELECT 
      id,
      bank_name as bankName,
      account_holder_name as accountHolderName,
      account_number as accountNumber,
      ifsc_code as ifscCode,
      account_type as accountType,
      branch_name as branchName,
      is_primary as isPrimary,
      is_verified as isVerified,
      status,
      verified_at as verifiedAt,
      created_at as createdAt,
      updated_at as updatedAt
    FROM bank_details
    WHERE user_id = ?
    ORDER BY is_primary DESC, created_at DESC
  `, [req.user.id]);

  res.json({
    success: true,
    data: bankDetails
  });
}));

/**
 * GET /api/bank-details/:id
 * Get a specific bank detail
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const bankId = parseInt(req.params.id);

  const [bankDetail] = await executeQuery(`
    SELECT 
      id,
      bank_name as bankName,
      account_holder_name as accountHolderName,
      account_number as accountNumber,
      ifsc_code as ifscCode,
      account_type as accountType,
      branch_name as branchName,
      is_primary as isPrimary,
      is_verified as isVerified,
      status,
      verified_at as verifiedAt,
      created_at as createdAt,
      updated_at as updatedAt
    FROM bank_details
    WHERE id = ? AND user_id = ?
  `, [bankId, req.user.id]);

  if (!bankDetail) {
    throw new AppError('Bank details not found', 404);
  }

  res.json({
    success: true,
    data: bankDetail
  });
}));

/**
 * POST /api/bank-details
 * Add new bank details
 */
router.post('/', asyncHandler(async (req, res) => {
  const { error, value } = bankDetailsSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { bankName, accountHolderName, accountNumber, ifscCode, accountType, branchName, isPrimary } = value;

  // Check for duplicate account number
  const [existing] = await executeQuery(`
    SELECT id FROM bank_details
    WHERE user_id = ? AND account_number = ?
  `, [req.user.id, accountNumber]);

  if (existing) {
    throw new AppError('Bank account already exists', 400);
  }

  // If setting as primary, unset other primary accounts
  if (isPrimary) {
    await executeQuery(`
      UPDATE bank_details
      SET is_primary = FALSE
      WHERE user_id = ?
    `, [req.user.id]);
  }

  // If this is the first bank account, make it primary
  const [count] = await executeQuery(`
    SELECT COUNT(*) as count FROM bank_details WHERE user_id = ?
  `, [req.user.id]);

  const shouldBePrimary = count.count === 0 || isPrimary;

  const result = await executeQuery(`
    INSERT INTO bank_details (
      user_id, bank_name, account_holder_name, account_number,
      ifsc_code, account_type, branch_name, is_primary, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_verification')
  `, [req.user.id, bankName, accountHolderName, accountNumber, ifscCode, accountType, branchName || null, shouldBePrimary]);

  // Log activity
  await executeQuery(`
    INSERT INTO user_activity_log (user_id, action_type, ip_address, details)
    VALUES (?, 'bank_add', ?, ?)
  `, [req.user.id, req.ip, JSON.stringify({ bankId: result.insertId, bankName })]);

  res.json({
    success: true,
    message: 'Bank details added successfully',
    data: { id: result.insertId }
  });
}));

/**
 * PUT /api/bank-details/:id
 * Update bank details
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const bankId = parseInt(req.params.id);
  const { error, value } = bankDetailsSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { bankName, accountHolderName, accountNumber, ifscCode, accountType, branchName, isPrimary } = value;

  // Verify ownership
  const [bankDetail] = await executeQuery(`
    SELECT id, is_verified as isVerified FROM bank_details
    WHERE id = ? AND user_id = ?
  `, [bankId, req.user.id]);

  if (!bankDetail) {
    throw new AppError('Bank details not found', 404);
  }

  if (bankDetail.isVerified) {
    throw new AppError('Cannot update verified bank details', 400);
  }

  // If setting as primary, unset other primary accounts
  if (isPrimary) {
    await executeQuery(`
      UPDATE bank_details
      SET is_primary = FALSE
      WHERE user_id = ? AND id != ?
    `, [req.user.id, bankId]);
  }

  await executeQuery(`
    UPDATE bank_details
    SET bank_name = ?,
        account_holder_name = ?,
        account_number = ?,
        ifsc_code = ?,
        account_type = ?,
        branch_name = ?,
        is_primary = ?,
        status = 'pending_verification',
        updated_at = NOW()
    WHERE id = ?
  `, [bankName, accountHolderName, accountNumber, ifscCode, accountType, branchName || null, isPrimary, bankId]);

  // Log activity
  await executeQuery(`
    INSERT INTO user_activity_log (user_id, action_type, ip_address, details)
    VALUES (?, 'bank_update', ?, ?)
  `, [req.user.id, req.ip, JSON.stringify({ bankId, bankName })]);

  res.json({
    success: true,
    message: 'Bank details updated successfully'
  });
}));

/**
 * DELETE /api/bank-details/:id
 * Delete bank details
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const bankId = parseInt(req.params.id);

  // Verify ownership
  const [bankDetail] = await executeQuery(`
    SELECT id, is_primary as isPrimary FROM bank_details
    WHERE id = ? AND user_id = ?
  `, [bankId, req.user.id]);

  if (!bankDetail) {
    throw new AppError('Bank details not found', 404);
  }

  await executeQuery('DELETE FROM bank_details WHERE id = ?', [bankId]);

  // If deleted bank was primary, set another as primary
  if (bankDetail.isPrimary) {
    const [firstBank] = await executeQuery(`
      SELECT id FROM bank_details
      WHERE user_id = ?
      ORDER BY created_at ASC
      LIMIT 1
    `, [req.user.id]);

    if (firstBank) {
      await executeQuery(`
        UPDATE bank_details SET is_primary = TRUE WHERE id = ?
      `, [firstBank.id]);
    }
  }

  // Log activity
  await executeQuery(`
    INSERT INTO user_activity_log (user_id, action_type, ip_address, details)
    VALUES (?, 'bank_delete', ?, ?)
  `, [req.user.id, req.ip, JSON.stringify({ bankId })]);

  res.json({
    success: true,
    message: 'Bank details deleted successfully'
  });
}));

/**
 * PUT /api/bank-details/:id/set-primary
 * Set a bank account as primary
 */
router.put('/:id/set-primary', asyncHandler(async (req, res) => {
  const bankId = parseInt(req.params.id);

  // Verify ownership
  const [bankDetail] = await executeQuery(`
    SELECT id FROM bank_details
    WHERE id = ? AND user_id = ?
  `, [bankId, req.user.id]);

  if (!bankDetail) {
    throw new AppError('Bank details not found', 404);
  }

  // Unset all primary
  await executeQuery(`
    UPDATE bank_details SET is_primary = FALSE WHERE user_id = ?
  `, [req.user.id]);

  // Set new primary
  await executeQuery(`
    UPDATE bank_details SET is_primary = TRUE WHERE id = ?
  `, [bankId]);

  res.json({
    success: true,
    message: 'Primary bank account updated successfully'
  });
}));

module.exports = router;
