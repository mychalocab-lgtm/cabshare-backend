// middleware/unifiedAuth.js
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
// adjust the supabase import to your existing project; if you have ../supabase.js export, use that
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

async function createUserFromHeaders(headerData) {
  const id = headerData.id || uuidv4();
  const phone = headerData.phone;
  const name = headerData.name || '';
  const provider = headerData.provider || 'flutter_app';
  const now = new Date().toISOString();

  const payload = {
    id,
    phone,
    full_name: name,
    auth_provider: provider,
    role: headerData.role || 'rider',
    phone_verified: !!phone,
    is_verified: !!phone,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('users_app')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('createUserFromHeaders error:', error);
    throw error;
  }
  // create wallet, other side-effects if you have such functions; keep them unchanged
  return data;
}

async function getOrCreateUserProfile(authUser, headerData = {}) {
  // Try by id
  const id = authUser.id || authUser.user_id || null;
  if (id) {
    const { data } = await supabase
      .from('users_app')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (data) return data;
  }

  // Try by phone
  if (authUser.phone) {
    const phone = authUser.phone.startsWith('+') ? authUser.phone : `+${authUser.phone}`;
    const { data } = await supabase
      .from('users_app')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();
    if (data) return data;
  }

  // Create profile
  const newProfile = {
    id: authUser.id || uuidv4(),
    phone: authUser.phone || headerData.phone || '',
    full_name: authUser.full_name || headerData.name || 'User',
    auth_provider: headerData.provider || 'supabase',
    role: authUser.role || 'rider',
    phone_verified: !!authUser.phone,
    is_verified: !!authUser.phone,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('users_app')
    .insert([newProfile])
    .select()
    .single();

  if (error) {
    console.error('getOrCreateUserProfile insert error:', error);
    throw error;
  }
  return data;
}

async function unifiedAuthMiddleware(req, res, next) {
  try {
    console.log('🔐 Auth Middleware -', req.method, req.path);
    const authHeader = req.headers['authorization'];
    const userIdHeader = req.headers['x-user-id'];
    const userEmailHeader = req.headers['x-user-email'];
    const userPhoneHeader = req.headers['x-user-phone'];
    const userNameHeader = req.headers['x-user-name'];
    const authProviderHeader = req.headers['x-auth-provider'];

    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    let user = null;

    // 1) If token present, try verifying backend JWT (we issue JWTs ourselves)
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // prioritize id, then phone
        const decodedId = decoded.id || decoded.userId || decoded.user_id;
        if (decodedId) {
          const { data } = await supabase
            .from('users_app')
            .select('*')
            .eq('id', decodedId)
            .maybeSingle();
          if (data) user = data;
        }
        if (!user && decoded.phone) {
          const phoneNorm = decoded.phone.startsWith('+') ? decoded.phone : `+${decoded.phone}`;
          const { data } = await supabase
            .from('users_app')
            .select('*')
            .eq('phone', phoneNorm)
            .maybeSingle();
          if (data) user = data;
        }
        if (!user) {
          // Last attempt: supabase auth getUser (if tokens were supabase tokens)
          try {
            const sb = await supabase.auth.getUser(token);
            if (sb?.data?.user) {
              user = await getOrCreateUserProfile(sb.data.user, { phone: userPhoneHeader, name: userNameHeader, provider: 'supabase' });
            }
          } catch (err) {
            console.warn('supabase.getUser failed:', err?.message || err);
          }
        }
      } catch (err) {
        console.warn('JWT verify failed:', err?.message || err);
      }
    }

    // 2) Header based fallback (mobile app may send x-user-phone)
    if (!user && (userIdHeader || userPhoneHeader || userEmailHeader)) {
      if (userIdHeader) {
        const { data } = await supabase
          .from('users_app')
          .select('*')
          .eq('id', userIdHeader)
          .maybeSingle();
        if (data) user = data;
      }
      if (!user && userPhoneHeader) {
        const phoneNorm = userPhoneHeader.startsWith('+') ? userPhoneHeader : `+${userPhoneHeader}`;
        const { data } = await supabase
          .from('users_app')
          .select('*')
          .eq('phone', phoneNorm)
          .maybeSingle();
        if (data) user = data;
        else {
          // create from headers
          user = await createUserFromHeaders({
            id: userIdHeader,
            phone: phoneNorm,
            name: userNameHeader,
            provider: authProviderHeader || 'flutter_app',
          });
        }
      }
      if (!user && userEmailHeader) {
        const { data } = await supabase
          .from('users_app')
          .select('*')
          .eq('email', userEmailHeader)
          .maybeSingle();
        if (data) user = data;
      }
    }

    // 3) Body/query fallback (loose)
    if (!user && (req.body?.phone || req.query?.phone)) {
      const c = req.body?.phone || req.query?.phone;
      const phoneNorm = c.startsWith('+') ? c : `+${c}`;
      const { data } = await supabase
        .from('users_app')
        .select('*')
        .eq('phone', phoneNorm)
        .maybeSingle();
      if (data) user = data;
    }

    if (!user) {
      console.log('❌ No valid authentication found');
      return res.status(401).json({ error: 'Authentication required' });
    }

    // ensure account active
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account deactivated' });
    }

    // update last login
    try {
      await supabase
        .from('users_app')
        .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', user.id);
    } catch (err) {
      console.warn('update last login failed:', err?.message || err);
    }

    req.user = user;
    req.userId = user.id;
    req.authProvider = user.auth_provider || 'unknown';
    return next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Authentication failed', message: err?.message || 'internal' });
  }
}

module.exports = {
  unifiedAuthMiddleware,
  requireAuth: unifiedAuthMiddleware
};
