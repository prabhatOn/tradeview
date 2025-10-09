const express = require('express');
const router = express.Router();

const { executeQuery } = require('../config/database');

// Simple debug endpoint to check what users exist in database
router.get('/users', async (req, res) => {
  try {
    const users = await executeQuery('SELECT id, email, first_name, last_name, phone, bio, status FROM users LIMIT 5');
    
    return res.json({ 
      success: true, 
      message: 'Users from database',
      data: users
    });
  } catch (error) {
    console.error('Debug users error:', error);
    res.json({ success: false, message: 'Debug error', error: error.message });
  }
});

// Simple debug endpoint to return user data
router.get('/debug-user', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.json({ success: false, message: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.json({ success: false, message: 'No token provided' });
    }

    // Decode token (without verification for debugging)
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.decode(token);
      console.log('Decoded token:', decoded);
    } catch (err) {
      return res.json({ success: false, message: 'Token decode error', error: err.message });
    }

    return res.json({ 
      success: true, 
      message: 'Token decoded successfully',
      data: {
        tokenExists: !!token,
        tokenLength: token.length,
        decoded: decoded
      }
    });
  } catch (error) {
    res.json({ success: false, message: 'Debug error', error: error.message });
  }
});

module.exports = router;