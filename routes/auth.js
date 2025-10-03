// routes/auth.js - Authentication routes with MSG91 Widget OTP
const express = require('express');
const router = express.Router();
const widgetOTPController = require('../controllers/widgetOTPController');
const { authenticateToken } = require('../middleware/auth');

// ==================== MSG91 WIDGET OTP ROUTES ====================

/**
 * Verify Widget Token
 * POST /api/auth/widget/verify
 * Public route
 * 
 * After MSG91 widget verifies OTP on client side (Flutter app), it returns a JWT token
 * Send that token here to complete authentication and get your backend JWT
 * Body: { accessToken: string, fullName?: string }
 * Response: { success, token (JWT), user, isNewUser }
 */
router.post('/widget/verify', widgetOTPController.verifyWidgetToken);

// ==================== PROTECTED ROUTES ====================

/**
 * Get Current User
 * GET /api/auth/me
 * Protected route - requires JWT token
 * 
 * Headers: { Authorization: "Bearer <JWT_TOKEN>" }
 * Response: { success, user }
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // User data is attached to req.user by authMiddleware
    res.json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user data',
    });
  }
});

module.exports = router;
