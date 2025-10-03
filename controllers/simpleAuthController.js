// controllers/simpleAuthController.js - Simple Phone Auth (No Widget)
const { supabase } = require('../supabase');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

/**
 * Simple Phone Login - After MSG91 OTP verified in Flutter
 * POST /api/auth/phone/simple-login
 */
exports.simplePhoneLogin = async (req, res) => {
  try {
    const { phone, fullName } = req.body;

    console.log('\n==============================================');
    console.log('📱 SIMPLE PHONE LOGIN');
    console.log('==============================================');
    console.log('Phone:', phone);
    console.log('Full Name:', fullName || 'Not provided');

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
      });
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users_app')
      .select('*')
      .eq('phone', phone)
      .single();

    let user;
    let isNewUser = false;

    if (existingUser) {
      // Existing user
      user = existingUser;
      console.log('✅ Existing user found');
      
      // Update last login
      await supabase
        .from('users_app')
        .update({
          phone_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

    } else {
      // New user
      console.log('🆕 New user - name required');
      
      if (!fullName) {
        return res.status(400).json({
          success: false,
          error: 'Full name is required for new users',
          isNewUser: true,
        });
      }

      console.log('Creating new user...');
      
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
        return res.status(500).json({
          success: false,
          error: 'Failed to create user',
        });
      }

      user = newUser;
      isNewUser = true;
      console.log('✅ New user created');

      // Create wallet
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
        console.warn('⚠️ Wallet creation failed:', walletError.message);
      }
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        phone: user.phone,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    console.log('✅ JWT generated');
    console.log('==============================================');
    console.log('🎉 LOGIN SUCCESSFUL');
    console.log('User Type:', isNewUser ? 'NEW' : 'EXISTING');
    console.log('User ID:', user.id);
    console.log('==============================================\n');

    return res.status(200).json({
      success: true,
      message: isNewUser ? 'Account created' : 'Login successful',
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
    });

  } catch (error) {
    console.error('\n❌ SIMPLE PHONE LOGIN ERROR');
    console.error(error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

module.exports = exports;
