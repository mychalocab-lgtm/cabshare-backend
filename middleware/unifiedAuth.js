// middleware/unifiedAuth.js - ENHANCED AUTHENTICATION WITH FLUTTER SUPPORT
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// IMPORTANT: Use the same secret as widgetOTPController
const JWT_SECRET = process.env.JWT_SECRET || 'aQYX032AFP1hnwRmk9MvJoL4sd5x7bjt';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Enhanced unified authentication middleware with comprehensive fallback mechanisms
 * Specifically designed to work with Flutter app authentication
 */
async function unifiedAuthMiddleware(req, res, next) {
  try {
    console.log('🔐 Auth Middleware - Processing request:', req.method, req.path);
    
    // Extract authentication info from various sources
    const authHeader = req.headers.authorization;
    const userIdHeader = req.headers['x-user-id'];
    const userEmailHeader = req.headers['x-user-email'];
    const userPhoneHeader = req.headers['x-user-phone'];
    const userNameHeader = req.headers['x-user-name'];
    const authProviderHeader = req.headers['x-auth-provider'];
    
    console.log('🔍 Auth headers received:', {
      hasAuthHeader: !!authHeader,
      userIdHeader,
      userEmailHeader,
      userPhoneHeader,
      userNameHeader,
      authProviderHeader
    });

    let user = null;
    let token = null;

    // Extract token if present
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      console.log('📋 Token extracted, length:', token.length);
    }

    // Method 1: Try JWT token verification (from MSG91 login)
    if (token && !user) {
      try {
        console.log('🔄 Attempting JWT token verification...');
        console.log('🔑 JWT_SECRET configured:', JWT_SECRET ? 'YES' : 'NO');
        console.log('🔑 JWT_SECRET length:', JWT_SECRET?.length || 0);
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        console.log('✅ JWT verified successfully!');
        console.log('📋 Decoded payload:', JSON.stringify(decoded, null, 2));
        
        // Get user from database using decoded user ID
        const { data: jwtUser, error } = await supabase
          .from('users_app')
          .select('*')
          .eq('id', decoded.id)
          .single();
        
        if (!error && jwtUser) {
          user = jwtUser;
          console.log('✅ JWT token verified for user:', user.id, '-', user.full_name);
        } else {
          console.log('❌ User not found in database for JWT:', decoded.id);
          if (error) console.log('❌ Database error:', error.message);
        }
      } catch (jwtError) {
        console.log('⚠️ JWT verification failed:', jwtError.message);
        console.log('⚠️ JWT error name:', jwtError.name);
        console.log('⚠️ JWT error details:', jwtError.stack);
      }
    }

    // Method 2: Try Supabase token verification (fallback)
    if (token && !user) {
      try {
        console.log('🔄 Attempting Supabase token verification...');
        const { data, error } = await supabase.auth.getUser(token);
        
        if (!error && data.user) {
          console.log('✅ Supabase token verified for user:', data.user.id);
          
          // Get or create user profile
          user = await getOrCreateUserProfile(data.user, {
            phone: userPhoneHeader,
            name: userNameHeader,
            provider: 'supabase'
          });
        } else {
          console.log('❌ Supabase token verification failed:', error?.message);
        }
      } catch (supabaseError) {
        console.log('⚠️ Supabase token verification error:', supabaseError.message);
      }
    }

    // Method 3: Header-based authentication (for Flutter app)
    if (!user && userIdHeader) {
      try {
        console.log('🔄 Attempting header-based authentication...');
        
        // First, try to find existing user by ID
        const { data: existingUser } = await supabase
          .from('users_app')
          .select('*')
          .eq('id', userIdHeader)
          .single();

        if (existingUser) {
          user = existingUser;
          console.log('✅ Found existing user by ID:', user.id);
        } else if (userPhoneHeader) {
          // Try to find by phone
          const { data: foundUser } = await supabase
            .from('users_app')
            .select('*')
            .eq('phone', userPhoneHeader)
            .single();
          
          if (foundUser) {
            user = foundUser;
            console.log('✅ Found existing user by phone:', user.id);
          } else {
            // Create new user from headers
            console.log('🆕 Creating new user from headers...');
            user = await createUserFromHeaders({
              id: userIdHeader,
              phone: userPhoneHeader,
              name: userNameHeader,
              provider: authProviderHeader || 'flutter_app'
            });
          }
        }
      } catch (headerAuthError) {
        console.log('⚠️ Header-based authentication error:', headerAuthError.message);
      }
    }

    // Method 4: Phone lookup without user ID
    if (!user && userPhoneHeader) {
      try {
        console.log('🔄 Attempting phone lookup...');
        
        const { data: lookupUser } = await supabase
          .from('users_app')
          .select('*')
          .eq('phone', userPhoneHeader)
          .single();
        
        if (lookupUser) {
          user = lookupUser;
          console.log('✅ Found user by phone lookup:', user.id);
        }
      } catch (lookupError) {
        console.log('⚠️ Phone lookup failed:', lookupError.message);
      }
    }

    if (!user) {
      console.log('❌ No valid authentication found');
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please provide valid authentication credentials',
        debug: {
          hasAuthHeader: !!authHeader,
          hasUserIdHeader: !!userIdHeader,
          hasUserEmailHeader: !!userEmailHeader,
          hasUserPhoneHeader: !!userPhoneHeader,
          tokenLength: token?.length || 0
        }
      });
    }

    // Check if user is active
    if (!user.is_active) {
      console.log('⚠️ User account is deactivated:', user.id);
      return res.status(401).json({ 
        error: 'Account deactivated',
        message: 'Please contact support'
      });
    }

    // Update last login time
    try {
      await supabase
        .from('users_app')
        .update({ 
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
    } catch (updateError) {
      console.log('⚠️ Failed to update last login:', updateError.message);
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;
    req.authProvider = user.auth_provider || authProviderHeader || 'unknown';
    
    console.log('✅ Authentication successful:', {
      userId: user.id,
      phone: user.phone,
      provider: req.authProvider,
      role: user.role
    });
    
    next();

  } catch (error) {
    console.error('💥 Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      message: 'Internal server error during authentication',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Get or create user profile from Supabase auth user
 */
async function getOrCreateUserProfile(authUser, headerData = {}) {
  console.log('👤 Getting/creating user profile for:', authUser.id);
  
  // Try to get existing profile
  const { data: existingProfile } = await supabase
    .from('users_app')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (existingProfile) {
    console.log('✅ Found existing user profile:', existingProfile.id);
    return existingProfile;
  }

  // Create new profile
  const newProfileData = {
    id: authUser.id,
    phone: authUser.phone || headerData.phone || '',
    full_name: authUser.user_metadata?.full_name || 
               authUser.user_metadata?.name || 
               headerData.name || 
               'User',
    auth_provider: headerData.provider || 'supabase',
    role: 'rider',
    phone_verified: !!authUser.phone,
    is_verified: !!authUser.phone,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: newProfile, error: createError } = await supabase
    .from('users_app')
    .insert(newProfileData)
    .select()
    .single();

  if (createError) {
    console.error('❌ Failed to create user profile:', createError);
    throw new Error('Failed to create user profile: ' + createError.message);
  }

  console.log('✅ Created new user profile:', newProfile.id);

  // Create wallet for new user
  await createUserWallet(newProfile.id);

  return newProfile;
}

/**
 * Create user from headers (Flutter app)
 */
async function createUserFromHeaders(headerData) {
  console.log('🆕 Creating user from headers:', headerData);
  
  const userData = {
    id: headerData.id,
    phone: headerData.phone,
    full_name: headerData.name,
    auth_provider: headerData.provider,
    role: 'rider',
    phone_verified: true,
    is_verified: true,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: newUser, error: createError } = await supabase
    .from('users_app')
    .insert(userData)
    .select()
    .single();

  if (createError) {
    console.error('❌ Failed to create user from headers:', createError);
    throw new Error('Failed to create user: ' + createError.message);
  }

  console.log('✅ Created user from headers:', newUser.id);

  // Create wallet
  await createUserWallet(newUser.id);

  return newUser;
}

/**
 * Create wallet for user
 */
async function createUserWallet(userId, initialBalance = 0) {
  try {
    await supabase.from('wallets').insert({
      user_id: userId,
      balance_available_inr: initialBalance,
      balance_reserved_inr: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    console.log('✅ Created wallet for user:', userId, 'with balance:', initialBalance);
  } catch (walletError) {
    console.error('⚠️ Wallet creation error:', walletError);
  }
}

/**
 * Optional authentication - doesn't fail if no token provided
 */
async function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const userIdHeader = req.headers['x-user-id'];
  const userEmailHeader = req.headers['x-user-email'];
  
  if (!authHeader && !userIdHeader && !userEmailHeader) {
    console.log('ℹ️ No authentication provided for optional auth');
    req.user = null;
    req.userId = null;
    req.authProvider = null;
    return next();
  }

  // Try to authenticate, but don't fail if it doesn't work
  try {
    await unifiedAuthMiddleware(req, res, () => {
      console.log('✅ Optional authentication succeeded');
      next();
    });
  } catch (error) {
    console.log('⚠️ Optional auth failed, continuing without user:', error.message);
    req.user = null;
    req.userId = null;
    req.authProvider = null;
    next();
  }
}

/**
 * Middleware to ensure user has specific role
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (req.user.role !== role) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `Role '${role}' required, but user has role '${req.user.role}'`
      });
    }
    
    next();
  };
}

/**
 * Middleware to ensure user is admin
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required',
      message: 'This endpoint requires admin privileges'
    });
  }
  
  next();
}

/**
 * Debug middleware to log all request details
 */
function debugAuthMiddleware(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    console.log('🐛 Debug Auth Info:', {
      method: req.method,
      path: req.path,
      headers: {
        authorization: req.headers.authorization ? 'Bearer [REDACTED]' : undefined,
        'x-user-id': req.headers['x-user-id'],
        'x-user-email': req.headers['x-user-email'],
        'x-user-phone': req.headers['x-user-phone'],
        'x-auth-provider': req.headers['x-auth-provider'],
      },
      query: req.query,
      body: req.method === 'POST' ? req.body : undefined
    });
  }
  next();
}

module.exports = {
  unifiedAuthMiddleware,
  optionalAuthMiddleware,
  requireRole,
  requireAdmin,
  debugAuthMiddleware,
  // Legacy compatibility
  requireAuth: unifiedAuthMiddleware,
  optionalAuth: optionalAuthMiddleware
};
