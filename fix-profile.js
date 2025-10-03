// FIX SCRIPT - Run this once to update your profile in local database
// Save as: B:\CabShare\carshare-backend\fix-profile.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixProfile() {
  const userId = '310ccd4b-8f6d-4a55-a6c0-7b5ce5699912';
  
  console.log('🔧 Fixing profile for user:', userId);
  
  // Update users_app table
  const { data, error } = await supabase
    .from('users_app')
    .update({
      email: 'piyush@worksetu.com',  // YOUR EMAIL HERE
      phone: '+919876543210',        // YOUR PHONE HERE (with +91)
      full_name: 'Piyush Chopda',
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select();

  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Profile updated successfully!');
    console.log('📧 Email:', data[0].email);
    console.log('📱 Phone:', data[0].phone);
    console.log('👤 Name:', data[0].full_name);
  }
  
  process.exit(0);
}

fixProfile();
