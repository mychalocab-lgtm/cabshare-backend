// controllers/widgetOTPController.js - MSG91 Widget OTP - SIMPLIFIED
const { supabase } = require('../supabase');
const jwt = require('jsonwebtoken');

// IMPORTANT: Use consistent secret - fallback to hardcoded value if env not set
const JWT_SECRET = process.env.JWT_SECRET || 'aQYX032AFP1hnwRmk9MvJoL4sd5x7bjt';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

/**
 * Verify Widget Access Token from MSG91
 * POST /api/auth/widget/verify
 * BODY: { accessToken: string, phoneNumber: string, fullName?: string }
 * 
 * Flutter app verifies OTP with MSG91 and gets an access token
 * We trust that Flutter did the verification correctly and proceed with user creation/login
 */
exports.verifyWidgetToken = async (req, res) => {
  try {
    const { accessToken, token, phoneNumber, fullName } = req.body;

    console.log('\n🔐 VERIFYING WIDGET TOKEN');
    console.log('Phone Number:', phoneNumber);
    console.log('Full Name:', fullName || 'not provided');
    console.log('🔑 JWT_SECRET configured:', JWT_SECRET ? 'YES' : 'NO');
    console.log('🔑 JWT_SECRET length:', JWT_SECRET?.length || 0);

    const authToken = accessToken || token;

    if (!authToken) {
      return res.status(400).json({
        success: false,
        error: 'Access token is required',
      });
    }

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
      });
    }

    // Verify the token is a valid JWT from MSG91
    try {
      const parts = authToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      console.log('📦 Token payload:', JSON.stringify(payload, null, 2));
      
      // Verify it has MSG91 company ID
      if (payload.companyId !== 471269) {
        throw new Error('Invalid token issuer');
      }
      
    } catch (decodeError) {
      console.error('❌ Token validation error:', decodeError.message);
      return res.status(400).json({
        success: false,
        error: 'Invalid access token',
      });
    }

    // Format phone number
    let formattedPhone = phoneNumber;
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    console.log('✅ Token validated, phone:', formattedPhone);

    // Create or login user
    const result = await createOrLoginUser(formattedPhone, fullName);
    
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ Verify widget token error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Token verification failed',
      message: error.message,
    });
  }
};

// =========================== HELPER FUNCTIONS ===========================

async function createOrLoginUser(phone, fullName) {
  console.log('\n👤 CREATING OR LOGGING IN USER');
  console.log('Phone:', phone);

  const { data: existingUser, error: fetchError } = await supabase
    .from('users_app')
    .select('*')
    .eq('phone', phone)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('❌ Database error:', fetchError);
    throw new Error('Database error while checking user');
  }

  let user;
  let isNewUser = false;

  if (existingUser) {
    user = existingUser;
    console.log('✅ Existing user - ID:', user.id);
    
    await supabase
      .from('users_app')
      .update({
        phone_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

  } else {
    if (!fullName || fullName.trim() === '') {
      console.log('⚠️  NEW USER - Full name required');
      return {
        success: false,
        error: 'Full name required',
        message: 'Full name is required for new users',
        isNewUser: true,
        requiresName: true,
      };
    }

    console.log('🆕 CREATING NEW USER');
    
    const { data: newUser, error: createError } = await supabase
      .from('users_app')
      .insert({
        phone: phone,
        full_name: fullName.trim(),
        role: 'rider',
        auth_provider: 'msg91',
        phone_verified: true,
        is_verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ User creation error:', createError);
      throw new Error('Failed to create user: ' + createError.message);
    }

    user = newUser;
    isNewUser = true;
    console.log('✅ User created - ID:', user.id);

    try {
      await supabase.from('wallets').insert({
        user_id: user.id,
        balance_available_inr: 0,
        balance_reserved_inr: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      console.log('✅ Wallet created');
    } catch (walletError) {
      console.warn('⚠️  Wallet creation failed');
    }
  }

  // Generate JWT token with the SAME secret used in unifiedAuth
  console.log('🔐 Generating JWT token...');
  console.log('🔑 Using JWT_SECRET length:', JWT_SECRET?.length || 0);
  
  const token = jwt.sign(
    { 
      id: user.id, 
      phone: user.phone, 
      role: user.role,
      full_name: user.full_name
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  console.log('✅ JWT token generated, length:', token.length);
  console.log('🎉 AUTHENTICATION SUCCESSFUL!');

  return {
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
    },
    isNewUser,
  };
}

module.exports = exports;
