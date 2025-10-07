// controllers/profileController.js
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.getMyProfile = async (req, res) => {
  try {
    // prefer req.user (middleware sets), fallback to headers/body
    const user = req.user;
    let profile = null;

    if (user && user.phone) {
      const { data } = await supabase.from('users_app').select('*').eq('phone', user.phone).maybeSingle();
      profile = data;
    } else if (user && user.id) {
      const { data } = await supabase.from('users_app').select('*').eq('id', user.id).maybeSingle();
      profile = data;
    } else if (req.headers['x-user-phone']) {
      const phone = req.headers['x-user-phone'];
      const { data } = await supabase.from('users_app').select('*').eq('phone', phone).maybeSingle();
      profile = data;
    }

    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    return res.json({ success: true, profile });
  } catch (err) {
    console.error('getMyProfile error:', err);
    return res.status(500).json({ error: 'Failed to load profile', message: err?.message || err });
  }
};
