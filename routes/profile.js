// routes/profile.js - FIXED PROFILE ROUTES
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const profileController = require('../controllers/profileController');

/**
 * @route GET /api/profile/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', authenticateToken, profileController.getProfile);

/**
 * @route POST /api/profile/ensure
 * @desc Ensure user profile exists (create if missing)
 * @access Public (needs user data in body)
 */
router.post('/ensure', profileController.ensureProfile);

/**
 * @route PUT /api/profile/update
 * @desc Update user profile
 * @access Private
 */
router.put('/update', authenticateToken, profileController.updateProfile);

/**
 * @route GET /api/profile/vehicles
 * @desc Get user vehicles
 * @access Private
 */
router.get('/vehicles', authenticateToken, profileController.getVehicles);

/**
 * @route POST /api/profile/vehicles
 * @desc Add vehicle
 * @access Private
 */
router.post('/vehicles', authenticateToken, profileController.addVehicle);

/**
 * @route GET /api/profile/kyc
 * @desc Get KYC documents
 * @access Private
 */
router.get('/kyc', authenticateToken, profileController.getKycDocuments);

/**
 * @route POST /api/profile/kyc
 * @desc Upload KYC document
 * @access Private
 */
router.post('/kyc', authenticateToken, profileController.uploadKycDocument);

module.exports = router;
