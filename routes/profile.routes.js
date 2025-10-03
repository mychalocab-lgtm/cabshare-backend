// routes/profile.routes.js - FIXED PROFILE MANAGEMENT SYSTEM (COMPATIBLE WITH EXISTING DB)
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { unifiedAuthMiddleware } = require('../middleware/unifiedAuth');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Apply unified authentication middleware to all routes
router.use(unifiedAuthMiddleware);

// GET /api/profile/me - Get complete user profile
router.get('/me', async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    console.log('🔵 GET Profile request');
    console.log('  - Final userId:', userId);
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Try to get user data from users_app table first (if it exists)
    let userData = null;
    try {
      const { data: userAppData, error: userAppError } = await supabase
        .from('users_app')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!userAppError) {
        userData = userAppData;
      }
    } catch (e) {
      console.log('users_app table not found or error, trying auth.users');
    }

    // Fallback to auth.users if users_app doesn't exist or user not found
    if (!userData) {
      const { data: authUserData, error: authError } = await supabase.auth.admin.getUserById(userId);
      if (authError) {
        console.error('Error fetching user from auth:', authError);
        return res.status(404).json({ error: 'User not found' });
      }
      
      userData = {
        id: authUserData.user.id,
        email: authUserData.user.email,
        full_name: authUserData.user.user_metadata?.full_name || '',
        phone: authUserData.user.phone || '',
        role: 'rider',
        is_verified: authUserData.user.email_confirmed_at ? true : false,
        email_verified: authUserData.user.email_confirmed_at ? true : false,
        phone_verified: authUserData.user.phone_confirmed_at ? true : false,
        created_at: authUserData.user.created_at,
        updated_at: authUserData.user.updated_at
      };
    }

    // Get additional profile data from profiles table if it exists
    let profileData = {};
    try {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (!profileError && profiles) {
        profileData = profiles;
      }
    } catch (e) {
      console.log('profiles table not found or error:', e);
    }

    // Merge user data with profile data
    const combinedProfile = {
      id: userData.id,
      email: userData.email,
      full_name: userData.full_name,
      phone: userData.phone,
      role: userData.role || 'rider',
      is_verified: userData.is_verified || false,
      is_active: userData.is_active !== false,
      email_verified: userData.email_verified || false,
      phone_verified: userData.phone_verified || false,
      auth_provider: userData.auth_provider || 'supabase',
      created_at: userData.created_at,
      updated_at: userData.updated_at,
      
      // Additional profile fields from profiles table
      bio: profileData.bio || null,
      date_of_birth: profileData.date_of_birth || null,
      gender: profileData.gender || null,
      profile_picture_url: profileData.profile_picture_url || null,
      address: profileData.address || null,
      city: profileData.city || null,
      state: profileData.state || null,
      country: profileData.country || 'India',
      
      // Travel preferences
      chat_preference: profileData.chat_preference || 'talkative',
      music_preference: profileData.music_preference || 'depends',
      pets_preference: profileData.pets_preference || 'depends',
      smoking_preference: profileData.smoking_preference || 'no',
      
      // Verification status from profiles table
      is_aadhaar_verified: profileData.is_aadhaar_verified || false,
      is_license_verified: profileData.is_license_verified || false,
      is_vehicle_verified: profileData.is_vehicle_verified || false,
      is_doc_verified: profileData.is_doc_verified || false,
    };

    console.log('✅ Profile found:', combinedProfile.full_name);
    res.json({ 
      success: true,
      user: combinedProfile 
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST /api/profile/update - Update user profile
router.post('/update', async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const updates = req.body;
    
    console.log('📝 Updating profile for user:', userId);
    console.log('  - Updates:', JSON.stringify(updates));
    
    if (!userId) {
      console.error('❌ No userId found');
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Split updates between different tables
    const userUpdates = {};
    const profileUpdates = {};

    // Fields that go to users_app table
    const userFields = ['full_name'];
    userFields.forEach(field => {
      if (updates[field] !== undefined) {
        userUpdates[field] = updates[field];
      }
    });
    
    // Handle phone number separately - ensure it has +91 prefix
    if (updates['phone'] !== undefined) {
      let phone = updates['phone'].toString().trim();
      // Remove any existing +91 or 91 prefix
      phone = phone.replace(/^(\+91|91)/, '');
      // Add +91 prefix
      userUpdates['phone'] = `+91${phone}`;
      console.log('  - Normalized phone:', userUpdates['phone']);
    }

    // Fields that go to profiles table
    const profileFields = [
      'bio', 'date_of_birth', 'gender', 'address', 'city', 'state', 'country',
      'chat_preference', 'music_preference', 'pets_preference', 'smoking_preference'
    ];
    profileFields.forEach(field => {
      if (updates[field] !== undefined) {
        profileUpdates[field] = updates[field];
      }
    });

    // Update users_app table if there are user fields to update
    if (Object.keys(userUpdates).length > 0) {
      try {
        userUpdates.updated_at = new Date().toISOString();
        
        console.log('  - Updating users_app with:', userUpdates);
        const { data: updatedUser, error: userUpdateError } = await supabase
          .from('users_app')
          .update(userUpdates)
          .eq('id', userId)
          .select()
          .single();

        if (userUpdateError) {
          console.error('users_app update error:', userUpdateError);
          return res.status(400).json({ error: 'Failed to update user data: ' + userUpdateError.message });
        }
        
        console.log('  - users_app updated successfully');
      } catch (e) {
        console.error('users_app table error:', e);
        return res.status(500).json({ error: 'Database error updating user data' });
      }
    }

    // Update or create profiles table entry if there are profile fields to update
    if (Object.keys(profileUpdates).length > 0) {
      try {
        profileUpdates.updated_at = new Date().toISOString();

        console.log('  - Updating profiles with:', profileUpdates);
        
        // Try to update first, if no record exists, insert one
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (existingProfile) {
          // Update existing profile
          const { data: updatedProfile, error: profileUpdateError } = await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('id', userId)
            .select()
            .single();

          if (profileUpdateError) {
            console.error('Error updating profiles:', profileUpdateError);
            return res.status(400).json({ error: 'Failed to update profile data: ' + profileUpdateError.message });
          }
          
          console.log('  - profiles updated successfully');
        } else {
          // Create new profile entry
          const { data: newProfile, error: profileInsertError } = await supabase
            .from('profiles')
            .insert({ 
              id: userId,
              ...profileUpdates,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (profileInsertError) {
            console.error('Error creating profile:', profileInsertError);
            return res.status(400).json({ error: 'Failed to create profile data: ' + profileInsertError.message });
          }
          
          console.log('  - profiles created successfully');
        }
      } catch (e) {
        console.error('profiles table error:', e);
        return res.status(500).json({ error: 'Database error updating profile data' });
      }
    }

    // Return success with updated user data
    console.log('✅ Profile updated successfully');
    
    // Fetch and return updated profile
    try {
      console.log('📥 Fetching updated profile data...');
      const { data: updatedUserData, error: userFetchError } = await supabase
        .from('users_app')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (userFetchError) {
        console.error('❌ Error fetching updated user:', userFetchError);
      } else {
        console.log('✅ Updated user data:', updatedUserData);
      }
      
      const { data: updatedProfileData, error: profileFetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileFetchError) {
        console.error('❌ Error fetching updated profile:', profileFetchError);
      } else {
        console.log('✅ Updated profile data:', updatedProfileData);
      }
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          ...updatedUserData,
          ...updatedProfileData
        }
      });
    } catch (e) {
      console.error('❌ Error fetching updated data:', e);
      // Fallback if fetch fails
      res.json({ 
        success: true, 
        message: 'Profile updated successfully'
      });
    }

  } catch (error) {
    console.error('❌ Profile update error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to update profile',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/profile/vehicles - Get user vehicles
router.get('/vehicles', async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Try to get vehicles from either vehicles table or vehicles_api_view
    let vehicles = [];
    
    try {
      // First try the vehicles_api_view (standardized view)
      const { data: vehicleViewData, error: viewError } = await supabase
        .from('vehicles_api_view')
        .select('*')
        .eq('owner_id', userId);

      if (!viewError) {
        vehicles = vehicleViewData || [];
      } else {
        // Fallback to direct vehicles table query
        const { data: vehicleData, error: vehicleError } = await supabase
          .from('vehicles')
          .select('*')
          .eq('owner_id', userId)
          .eq('is_active', true);

        if (!vehicleError) {
          vehicles = vehicleData || [];
        }
      }
    } catch (e) {
      console.log('vehicles table not found:', e);
      vehicles = [];
    }

    res.json(vehicles);

  } catch (error) {
    console.error('Vehicles fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// POST /api/profile/vehicles - Add new vehicle
router.post('/vehicles', async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { make, model, plate_number, vehicle_type, year, color } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    // Check if vehicles table exists by trying to query it
    try {
      const { data: vehicle, error } = await supabase
        .from('vehicles')
        .insert({
          owner_id: userId,
          make,
          model,
          plate_number,
          vehicle_type,
          year,
          color,
          is_verified: false,
          is_active: true,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding vehicle:', error);
        return res.status(400).json({ error: 'Failed to add vehicle' });
      }

      res.status(201).json(vehicle);
    } catch (e) {
      console.log('vehicles table not found');
      res.status(501).json({ error: 'Vehicle management not available yet' });
    }

  } catch (error) {
    console.error('Vehicle add error:', error);
    res.status(500).json({ error: 'Failed to add vehicle' });
  }
});

// DELETE /api/profile/vehicles/:id - Delete vehicle
router.delete('/vehicles/:id', async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const vehicleId = req.params.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ is_active: false })
        .eq('id', vehicleId)
        .eq('owner_id', userId);

      if (error) {
        console.error('Error deleting vehicle:', error);
        return res.status(400).json({ error: 'Failed to delete vehicle' });
      }

      res.json({ success: true, message: 'Vehicle deleted successfully' });
    } catch (e) {
      console.log('vehicles table not found');
      res.status(501).json({ error: 'Vehicle management not available yet' });
    }

  } catch (error) {
    console.error('Vehicle delete error:', error);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

// GET /api/profile/kyc - Get KYC documents
router.get('/kyc', async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    try {
      const { data: documents, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching KYC documents:', error);
        return res.status(400).json({ error: 'Failed to fetch documents' });
      }

      res.json(documents || []);
    } catch (e) {
      console.log('kyc_documents table not found');
      res.json([]);
    }

  } catch (error) {
    console.error('KYC fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch KYC documents' });
  }
});

// POST /api/profile/kyc - Upload KYC document
router.post('/kyc', async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { doc_type, doc_number, file_url } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    try {
      const { data: document, error } = await supabase
        .from('kyc_documents')
        .insert({
          user_id: userId,
          doc_type,
          doc_number,
          file_url,
          verification_status: 'pending',
          uploaded_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error uploading KYC document:', error);
        return res.status(400).json({ error: 'Failed to upload document' });
      }

      res.status(201).json(document);
    } catch (e) {
      console.log('kyc_documents table not found');
      res.status(501).json({ error: 'Document verification not available yet' });
    }

  } catch (error) {
    console.error('KYC upload error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// GET /api/profile/stats - Get user statistics for profile display
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    try {
      const { data: stats, error } = await supabase
        .from('user_profile_stats')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('user_profile_stats view not found, returning default stats');
        // Return default stats
        return res.json({
          total_rides: 0,
          driver_rides: 0,
          passenger_rides: 0,
          driver_rating: 0,
          passenger_rating: 0,
          total_ratings: 0,
          is_profile_verified: false,
          verification_count: 0
        });
      }

      res.json(stats);
    } catch (e) {
      console.log('Error fetching stats:', e);
      res.json({
        total_rides: 0,
        driver_rides: 0,
        passenger_rides: 0,
        driver_rating: 0,
        passenger_rating: 0,
        total_ratings: 0,
        is_profile_verified: false,
        verification_count: 0
      });
    }

  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

module.exports = router;