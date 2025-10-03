// controllers/authController.js - MSG91 Widget Authentication
const { supabase } = require('../supabase');
const jwt = require('jsonwebtoken');
const msg91Service = require('../services/msg91Service');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

/**
 * MSG91 WIDGET AUTHENTICATION FLOW:
 * 1. Flutter displays MSG91 widget
 * 2. User enters phone and OTP in widget
 * 3. MSG91 widget verifies OTP and returns access token
 * 4. Flutter sends access token to this endpoint
 * 5. Backend verifies token with MSG91 and creates/logs in user
 */

/**
 * Verify MSG91 Widget Token and Authenticate User
 * POST /api/auth/widget/verify
 * 
 * @body {
 *   accessToken: string,  // Required: Access token from MSG91 widget
 *   fullName?: string     // Optional: Required for new users only
 * }
 */
exports.verifyWidgetToken = async (req, res) => {
  try {
    const { accessToken, fullName } = req.body;

    console.log('\n==============================================');
    console.log('🔐 WIDGET TOKEN VERIFICATION REQUEST');
    console.log('==============================================');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Access Token Received:', accessToken ? 'YES' : 'NO');
    console.log('Access Token Length:', accessToken ? accessToken.length : 0);
    console.log('Full Name Provided:', fullName || 'NO');

    // Validate input
    if (!accessToken) {
      console.log('❌ Validation Failed: Missing access token');
      console.log('==============================================\n');
      return res.status(400).json({
        success: false,
        error: 'Access token is required',
        message: 'Please provide the MSG91 widget access token',
      });
    }

    // Check for test/dummy tokens
    if (accessToken === 'test' || accessToken.length < 10) {
      console.log('❌ Validation Failed: Invalid test token');
      console.log('==============================================\n');
      return res.status(400).json({
        success: false,
        error: 'Invalid access token',
        message: 'Test tokens are not allowed. Please use MSG91 widget properly.',
      });
    }

    console.log('✅ Input Validation Passed');
    console.log('▶️  Verifying token with MSG91...');

    // Verify token with MSG91
    const verification = await msg91Service.verifyWidgetToken(accessToken);

    console.log('◀️  MSG91 Verification Result:', verification.success ? 'SUCCESS' : 'FAILED');

    if (!verification.success) {
      console.log('❌ MSG91 Verification Failed');
      console.log('Reason:', verification.message);
      console.log('==============================================\n');
      
      return res.status(400).json({
        success: false,
        error: 'Token verification failed',
        message: verification.message || 'Invalid or expired token',
        details: process.env.NODE_ENV === 'development' ? verification : undefined,
      });
    }

    const phoneNumber = verification.phone;
    console.log('✅ Token Verified');
    console.log('📱 Phone Number:', phoneNumber);
    console.log('▶️  Checking user database...');

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users_app')
      .select('*')
      .eq('phone', phoneNumber)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is OK
      console.error('❌ Database Error:', fetchError);
      console.log('==============================================\n');
      
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Failed to check user account',
      });
    }

    let user;
    let isNewUser = false;

    if (existingUser) {
      // ========== EXISTING USER - LOGIN ==========
      user = existingUser;
      console.log('✅ Existing User Found');
      console.log('User ID:', user.id);
      console.log('User Name:', user.full_name);
      console.log('User Role:', user.role);

      // Update phone_verified status and last login
      const { error: updateError } = await supabase
        .from('users_app')
        .update({
          phone_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.warn('⚠️  Failed to update user status:', updateError.message);
      }

    } else {
      // ========== NEW USER - SIGNUP ==========
      console.log('🆕 New User Registration');

      if (!fullName || fullName.trim().length === 0) {
        console.log('❌ Registration Failed: Missing full name');
        console.log('==============================================\n');
        
        return res.status(400).json({
          success: false,
          error: 'Full name required',
          message: 'Full name is required for new users',
          isNewUser: true,
        });
      }

      console.log('Creating new user...');
      console.log('Phone:', phoneNumber);
      console.log('Name:', fullName);

      const { data: newUser, error: createError } = await supabase
        .from('users_app')
        .insert({
          phone: phoneNumber,
          full_name: fullName.trim(),
          role: 'rider', // Default role
          auth_provider: 'msg91',
          phone_verified: true,
          is_verified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ User Creation Failed:', createError);
        console.log('==============================================\n');
        
        return res.status(500).json({
          success: false,
          error: 'Failed to create account',
          message: createError.message || 'Could not create user account',
        });
      }

      user = newUser;
      isNewUser = true;

      console.log('✅ New User Created');
      console.log('User ID:', user.id);

      // Create wallet for new user
      try {
        const { error: walletError } = await supabase
          .from('wallets')
          .insert({
            user_id: user.id,
            balance_available_inr: 0,
            balance_reserved_inr: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (walletError) {
          console.warn('⚠️  Wallet creation failed (non-critical):', walletError.message);
        } else {
          console.log('✅ Wallet Created');
        }
      } catch (walletErr) {
        console.warn('⚠️  Wallet creation error (non-critical):', walletErr.message);
      }
    }

    // Generate JWT token
    console.log('▶️  Generating JWT token...');
    
    const token = jwt.sign(
      {
        id: user.id,
        phone: user.phone,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    console.log('✅ JWT Token Generated');
    console.log('==============================================');
    console.log('🎉 AUTHENTICATION SUCCESSFUL');
    console.log('==============================================');
    console.log('User Type:', isNewUser ? 'NEW USER' : 'EXISTING USER');
    console.log('User ID:', user.id);
    console.log('Phone:', user.phone);
    console.log('Name:', user.full_name);
    console.log('Role:', user.role);
    console.log('Verified:', user.is_verified);
    console.log('==============================================\n');

    return res.status(200).json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      token,
      user: {
        id: user.id,
        phone: user.phone,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        is_verified: user.is_verified,
        phone_verified: user.phone_verified,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      },
      isNewUser,
    });

  } catch (error) {
    console.error('\n==============================================');
    console.error('❌ AUTHENTICATION ERROR');
    console.error('==============================================');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('==============================================\n');

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred during authentication',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get Current Authenticated User
 * GET /api/auth/me
 * 
 * @headers Authorization: Bearer <token>
 */
exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`Getting current user data for: ${userId}`);

    const { data: user, error } = await supabase
      .from('users_app')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !user) {
      console.error('User not found:', error);
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        is_verified: user.is_verified,
        phone_verified: user.phone_verified,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

module.exports = exports;
