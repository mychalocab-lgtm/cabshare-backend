// routes/auth.routes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// helper to strip sensitive fields
function cleanUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
}

/**
 * POST /auth/verify-msg91
 * body { phone, accessToken, full_name? }
 * Verifies widget token (we assume widget does server-side verification or token is trusted),
 * create user if not exists, issue Chalocab JWT.
 */
router.post('/verify-msg91', async (req, res) => {
  try {
    const { phone, accessToken, full_name } = req.body;
    if (!phone || !accessToken) {
      return res.status(400).json({ error: 'Missing phone or accessToken' });
    }

    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;
    // basic decode to inspect (widget token format may vary)
    const decoded = jwt.decode(accessToken);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid access token' });
    }

    // find or create user
    let { data: user } = await supabase
      .from('users_app')
      .select('*')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (!user) {
      const now = new Date().toISOString();
      const { data: created, error } = await supabase
        .from('users_app')
        .insert([{
          id: uuidv4(),
          phone: normalizedPhone,
          full_name: full_name || 'User',
          auth_provider: 'msg91',
          role: 'rider',
          is_verified: true,
          is_active: true,
          created_at: now,
          updated_at: now
        }])
        .select()
        .single();
      if (error) throw error;
      user = created;
    }

    // generate backend JWT
    const token = jwt.sign({
      id: user.id,
      userId: user.id,
      phone: user.phone,
      full_name: user.full_name || user.name || 'User',
      email: user.email || null,
      role: user.role || 'rider'
    }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({ success: true, user: cleanUser(user), token });
  } catch (err) {
    console.error('verify-msg91 error:', err);
    return res.status(500).json({ error: 'Verification failed', message: err?.message || err });
  }
});

/**
 * (Optional) keep your existing login/register routes unchanged below — if you had them,
 * ensure tokens generated there also use the same payload shape. Example login flow:
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email/password required' });

    const { data: user } = await supabase
      .from('users_app')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = user.password_hash ? await bcrypt.compare(password, user.password_hash) : false;
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({
      id: user.id,
      userId: user.id,
      phone: user.phone,
      full_name: user.full_name || user.name || 'User',
      email: user.email,
      role: user.role
    }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({ success: true, user: cleanUser(user), token });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Export router
module.exports = router;
