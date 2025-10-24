/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const { asyncHandler } = require('../middleware/async-handler');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const AppError = require('../utils/app-error');
const Joi = require('joi');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/kyc');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `kyc-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG) and PDF files are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// Base URL where uploaded files are served from (backend host)
const UPLOADS_BASE = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`

// Apply authentication to all routes
router.use(authMiddleware);

// Validation schemas
const kycDocumentSchema = Joi.object({
  documentType: Joi.string().valid('aadhar', 'pancard', 'passport', 'driving_license', 'voter_id').required(),
  documentNumber: Joi.string().required().max(50)
});

const kycPersonalInfoSchema = Joi.object({
  phoneNumber: Joi.string().max(20).allow('', null),
  dateOfBirth: Joi.date().iso().allow(null),
  address: Joi.string().max(500).allow('', null),
  city: Joi.string().max(100).allow('', null),
  state: Joi.string().max(100).allow('', null),
  postalCode: Joi.string().max(20).allow('', null),
  country: Joi.string().max(100).default('India')
});

// ============================================================================
// KYC DOCUMENTS
// ============================================================================

/**
 * GET /api/kyc/documents
 * Get all KYC documents for the logged-in user
 */
router.get('/documents', asyncHandler(async (req, res) => {
  const documents = await executeQuery(`
    SELECT 
      id,
      document_type as documentType,
      document_number as documentNumber,
      document_front_url as documentFrontUrl,
      document_back_url as documentBackUrl,
      status,
      rejection_reason as rejectionReason,
      submitted_at as submittedAt,
      verified_at as verifiedAt,
      created_at as createdAt,
      updated_at as updatedAt
    FROM kyc_documents
    WHERE user_id = ?
    ORDER BY created_at DESC
  `, [req.user.id]);

  // Convert file paths to URLs
  const documentsWithUrls = documents.map(doc => ({
    ...doc,
    documentFrontUrl: doc.documentFrontUrl ? `${UPLOADS_BASE}/uploads/kyc/${path.basename(doc.documentFrontUrl)}` : null,
    documentBackUrl: doc.documentBackUrl ? `${UPLOADS_BASE}/uploads/kyc/${path.basename(doc.documentBackUrl)}` : null
  }));

  res.json({
    success: true,
    data: documentsWithUrls
  });
}));

/**
 * POST /api/kyc/documents
 * Upload a new KYC document
 */
router.post('/documents', upload.fields([
  { name: 'documentFront', maxCount: 1 },
  { name: 'documentBack', maxCount: 1 }
]), asyncHandler(async (req, res) => {
  const { error, value } = kycDocumentSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { documentType, documentNumber } = value;

  // Check if files were uploaded
  if (!req.files || !req.files.documentFront || req.files.documentFront.length === 0) {
    throw new AppError('Document front image is required', 400);
  }

  // Check if document type already exists
  const [existing] = await executeQuery(`
    SELECT id FROM kyc_documents
    WHERE user_id = ? AND document_type = ?
  `, [req.user.id, documentType]);

  if (existing) {
    throw new AppError(`${documentType} document already uploaded`, 400);
  }

  const documentFrontPath = req.files.documentFront[0].path;
  const documentBackPath = req.files.documentBack && req.files.documentBack.length > 0
    ? req.files.documentBack[0].path
    : null;

  const result = await executeQuery(`
    INSERT INTO kyc_documents (
      user_id, document_type, document_number,
      document_front_url, document_back_url, status, submitted_at
    ) VALUES (?, ?, ?, ?, ?, 'submitted', NOW())
  `, [req.user.id, documentType, documentNumber, documentFrontPath, documentBackPath]);

  // Update user KYC status
  await executeQuery(`
    UPDATE users
    SET kyc_status = 'submitted', kyc_submitted_at = NOW()
    WHERE id = ?
  `, [req.user.id]);

  // Log activity
  await executeQuery(`
    INSERT INTO user_activity_log (user_id, action_type, ip_address, details)
    VALUES (?, 'kyc_submit', ?, ?)
  `, [req.user.id, req.ip, JSON.stringify({ documentType })]);

  res.json({
    success: true,
    message: 'KYC document uploaded successfully',
    data: { id: result.insertId }
  });
}));

/**
 * PUT /api/kyc/documents/:id
 * Update a KYC document
 */
router.put('/documents/:id', asyncHandler(async (req, res) => {
  const documentId = parseInt(req.params.id);
  const { error, value } = kycDocumentSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { documentNumber, documentFrontUrl, documentBackUrl } = value;

  // Verify ownership
  const [document] = await executeQuery(`
    SELECT id, status FROM kyc_documents
    WHERE id = ? AND user_id = ?
  `, [documentId, req.user.id]);

  if (!document) {
    throw new AppError('Document not found', 404);
  }

  if (document.status === 'verified') {
    throw new AppError('Cannot update verified document', 400);
  }

  await executeQuery(`
    UPDATE kyc_documents
    SET document_number = ?,
        document_front_url = ?,
        document_back_url = ?,
        status = 'submitted',
        submitted_at = NOW(),
        updated_at = NOW()
    WHERE id = ?
  `, [documentNumber, documentFrontUrl, documentBackUrl || null, documentId]);

  // Log activity
  await executeQuery(`
    INSERT INTO user_activity_log (user_id, action_type, ip_address, details)
    VALUES (?, 'kyc_update', ?, ?)
  `, [req.user.id, req.ip, JSON.stringify({ documentId })]);

  res.json({
    success: true,
    message: 'KYC document updated successfully'
  });
}));

/**
 * DELETE /api/kyc/documents/:id
 * Delete a KYC document (only if not verified)
 */
router.delete('/documents/:id', asyncHandler(async (req, res) => {
  const documentId = parseInt(req.params.id);

  // Verify ownership and status
  const [document] = await executeQuery(`
    SELECT id, status FROM kyc_documents
    WHERE id = ? AND user_id = ?
  `, [documentId, req.user.id]);

  if (!document) {
    throw new AppError('Document not found', 404);
  }

  if (document.status === 'verified') {
    throw new AppError('Cannot delete verified document', 400);
  }

  await executeQuery('DELETE FROM kyc_documents WHERE id = ?', [documentId]);

  res.json({
    success: true,
    message: 'KYC document deleted successfully'
  });
}));

/**
 * GET /api/kyc/status
 * Get user's KYC status and personal information
 */
router.get('/status', asyncHandler(async (req, res) => {
  const [user] = await executeQuery(`
    SELECT 
      kyc_status as kycStatus,
      kyc_submitted_at as kycSubmittedAt,
      kyc_approved_at as kycApprovedAt,
      kyc_rejection_reason as kycRejectionReason,
      phone_number as phoneNumber,
      date_of_birth as dateOfBirth,
      address,
      city,
      state,
      postal_code as postalCode,
      country
    FROM users
    WHERE id = ?
  `, [req.user.id]);

  res.json({
    success: true,
    data: user || {}
  });
}));

// ============================================================================
// ADMIN KYC REVIEW (requires admin role)
// ============================================================================

// List pending KYC documents for admin review
router.get('/admin/pending', adminMiddleware, asyncHandler(async (req, res) => {
  const rows = await executeQuery(`
    SELECT kd.id, kd.user_id, kd.document_type AS documentType, kd.document_number AS documentNumber,
           kd.document_front_url AS documentFrontUrl, kd.document_back_url AS documentBackUrl,
           kd.status, kd.rejection_reason AS rejectionReason, kd.submitted_at AS submittedAt,
           u.email AS userEmail, u.first_name AS firstName, u.last_name AS lastName, u.phone_number AS phoneNumber
    FROM kyc_documents kd
    JOIN users u ON kd.user_id = u.id
    WHERE kd.status = 'submitted'
    ORDER BY kd.submitted_at ASC
  `);

  // convert paths to public urls
  const result = rows.map(r => ({
    ...r,
    documentFrontUrl: r.documentFrontUrl ? `${UPLOADS_BASE}/uploads/kyc/${path.basename(r.documentFrontUrl)}` : null,
    documentBackUrl: r.documentBackUrl ? `${UPLOADS_BASE}/uploads/kyc/${path.basename(r.documentBackUrl)}` : null
  }));

  res.json({ success: true, data: result });
}));

// Get KYC documents for a specific user (admin only)
router.get('/admin/user/:id/documents', adminMiddleware, asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (!userId) {
    throw new AppError('Invalid user id', 400);
  }

  const rows = await executeQuery(`
    SELECT id, document_type AS documentType, document_number AS documentNumber,
           document_front_url AS documentFrontUrl, document_back_url AS documentBackUrl,
           status, rejection_reason AS rejectionReason, submitted_at AS submittedAt, verified_at AS verifiedAt, created_at, updated_at
    FROM kyc_documents
    WHERE user_id = ?
    ORDER BY created_at DESC
  `, [userId]);

  const result = rows.map(r => ({
    ...r,
    documentFrontUrl: r.documentFrontUrl ? `${UPLOADS_BASE}/uploads/kyc/${path.basename(r.documentFrontUrl)}` : null,
    documentBackUrl: r.documentBackUrl ? `${UPLOADS_BASE}/uploads/kyc/${path.basename(r.documentBackUrl)}` : null,
  }));

  res.json({ success: true, data: result });
}));

// Approve or reject a KYC document
router.post('/admin/:id/review', adminMiddleware, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { action, reason } = req.body; // action: 'approve' | 'reject'

  const [doc] = await executeQuery('SELECT id, user_id, status FROM kyc_documents WHERE id = ?', [id]);
  if (!doc) throw new AppError('Document not found', 404);
  if (doc.status === 'verified' && action === 'approve') {
    throw new AppError('Document already verified', 400);
  }

  if (action === 'approve') {
    await executeQuery(`
      UPDATE kyc_documents SET status = 'verified', verified_at = NOW() WHERE id = ?
    `, [id]);

    // update user KYC status
    await executeQuery(`UPDATE users SET kyc_status = 'approved', kyc_approved_at = NOW() WHERE id = ?`, [doc.user_id]);

    await executeQuery(`INSERT INTO user_activity_log (user_id, action_type, ip_address, details) VALUES (?, 'kyc_approved', ?, ?)`,
      [doc.user_id, req.ip, JSON.stringify({ documentId: id })]);

    return res.json({ success: true, message: 'KYC approved' });
  }

  if (action === 'reject') {
    await executeQuery(`
      UPDATE kyc_documents SET status = 'rejected', rejection_reason = ?, updated_at = NOW() WHERE id = ?
    `, [reason || null, id]);

    await executeQuery(`UPDATE users SET kyc_status = 'rejected', kyc_rejection_reason = ? WHERE id = ?`, [reason || null, doc.user_id]);

    await executeQuery(`INSERT INTO user_activity_log (user_id, action_type, ip_address, details) VALUES (?, 'kyc_rejected', ?, ?)`,
      [doc.user_id, req.ip, JSON.stringify({ documentId: id, reason })]);

    return res.json({ success: true, message: 'KYC rejected' });
  }

  throw new AppError('Invalid action', 400);
}));

/**
 * PUT /api/kyc/personal-info
 * Update personal information for KYC
 */
router.put('/personal-info', asyncHandler(async (req, res) => {
  const { error, value } = kycPersonalInfoSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const { phoneNumber, dateOfBirth, address, city, state, postalCode, country } = value;

  await executeQuery(`
    UPDATE users
    SET phone_number = ?,
        date_of_birth = ?,
        address = ?,
        city = ?,
        state = ?,
        postal_code = ?,
        country = ?
    WHERE id = ?
  `, [phoneNumber, dateOfBirth, address, city, state, postalCode, country, req.user.id]);

  res.json({
    success: true,
    message: 'Personal information updated successfully'
  });
}));

module.exports = router;
