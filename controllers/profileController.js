// controllers/profileController.js - FIXED TO WORK WITH EXISTING SCHEMA
const { supabase } = require('../supabase');

/**
 * Get user profile with comprehensive data
 */
async function getProfile(req, res) {
  try {
    // COMPREHENSIVE USER ID EXTRACTION
    const userId = req.user?.id || req.auth?.userId || req.headers['x-user-id'] || req.params.userId;
    
    console.log('🔵 GET Profile request');
    console.log('  - Final userId:', userId);
    
    if (!userId) {
      console.log('❌ No user ID found in request');
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please sign in to access your profile'
      });
    }

    // Get user profile
    const { data: userData, error: userError } = await supabase
      .from('users_app')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('❌ Profile fetch error:', userError);
      return res.status(404).json({
        error: 'Profile not found',
        message: 'User profile does not exist'
      });
    }

    console.log('✅ Profile found:', userData.full_name);

    // Get additional profile stats if needed
    const profileData = {
      ...userData,
      email_verified: userData.email_verified || false,
      phone_verified: userData.phone_verified || false,
      is_profile_verified: userData.is_verified || false,
      total_rides: 0,
      driver_rating: 0.0,
      passenger_rating: 0.0,
      // Use real data from database or defaults
      bio: userData.bio || '',
      address: userData.address || '',
      city: userData.city || '',
      gender: userData.gender || null,
      chat_preference: userData.chat_preference || 'talkative',
      music_preference: userData.music_preference || 'depends',
      pets_preference: userData.pets_preference || 'depends',
      smoking_preference: userData.smoking_preference || 'no'
    };

    return res.status(200).json({
      success: true,
      profile: profileData  // Changed from 'user' to 'profile'
    });

  } catch (error) {
    console.error('❌ Get profile error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * Update user profile - FIXED TO ONLY UPDATE EXISTING COLUMNS
 */
async function updateProfile(req, res) {
  try {
    // COMPREHENSIVE USER ID EXTRACTION
    const userId = req.user?.id || req.auth?.userId || req.headers['x-user-id'] || req.params.userId;
    const updates = req.body;
    
    console.log('🔵 UPDATE Profile request');
    console.log('  - Final userId:', userId);
    console.log('  - Update data received:', updates);
    
    if (!userId) {
      console.log('❌ No user ID found for update');
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please sign in to update your profile'
      });
    }

    // Check if user exists first
    console.log('🔍 Checking if user exists:', userId);
    const { data: existingUser, error: checkError } = await supabase
      .from('users_app')
      .select('*')
      .eq('id', userId)
      .single();

    if (checkError || !existingUser) {
      console.error('❌ User not found for update:', checkError);
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'User profile does not exist for update',
        userId: userId
      });
    }

    console.log('✅ User exists:', existingUser.full_name);

    // VALIDATE PHONE NUMBER (10 digits)
    if (updates.phone) {
      const cleanPhone = updates.phone.replace(/\D/g, ''); // Remove non-digits
      if (cleanPhone.length !== 10) {
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number',
          message: 'Phone number must be exactly 10 digits'
        });
      }
      // Store with +91 prefix for Indian numbers
      updates.phone = `+91${cleanPhone}`;
    }

    // FILTER TO ONLY EXISTING COLUMNS IN users_app TABLE
    const allowedFields = [
      'full_name', 'phone', 'email', 'avatar_url', 'photo_url',
      'is_verified', 'email_verified', 'phone_verified',
      'bio', 'address', 'city', 'gender',
      'chat_preference', 'music_preference', 'pets_preference', 'smoking_preference'
    ];

    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    // Remove sensitive fields
    delete filteredUpdates.id;
    delete filteredUpdates.created_at;
    delete filteredUpdates.auth_provider;
    delete filteredUpdates.firebase_uid;
    delete filteredUpdates.supabase_uid;
    delete filteredUpdates.password_hash;

    // Add updated timestamp
    filteredUpdates.updated_at = new Date().toISOString();

    console.log('🔵 Filtered update data (only existing columns):', filteredUpdates);
    console.log('🔵 Skipped fields (don\'t exist in users_app):', 
      Object.keys(updates).filter(key => !allowedFields.includes(key) && key !== 'updated_at')
    );

    // Perform the update
    const { data: updatedUser, error } = await supabase
      .from('users_app')
      .update(filteredUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase update error:', error);
      return res.status(400).json({
        success: false,
        error: 'Update failed',
        message: error.message || 'Failed to update profile',
        details: {
          code: error.code,
          hint: error.hint,
          details: error.details
        }
      });
    }

    if (!updatedUser) {
      console.log('❌ No user returned from update');
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'Profile not found for update after operation'
      });
    }

    console.log('✅ Profile updated successfully:', updatedUser.full_name);

    // Return user with additional frontend-compatible fields
    const responseUser = {
      ...updatedUser,
      // Use real data from database or defaults
      bio: updatedUser.bio || '',
      address: updatedUser.address || '',
      city: updatedUser.city || '',
      gender: updatedUser.gender || null,
      chat_preference: updatedUser.chat_preference || 'talkative',
      music_preference: updatedUser.music_preference || 'depends',
      pets_preference: updatedUser.pets_preference || 'depends',
      smoking_preference: updatedUser.smoking_preference || 'no'
    };

    return res.status(200).json({
      success: true,
      user: responseUser,
      message: 'Profile updated successfully',
      note: 'Some fields (bio, address, city, preferences) are not yet stored in database but have been saved locally'
    });

  } catch (error) {
    console.error('❌ Update profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * Get user vehicles
 */
async function getVehicles(req, res) {
  try {
    const userId = req.user?.id || req.auth?.userId || req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', userId) // FIXED: Changed from owner_id to user_id
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get vehicles error:', error);
      return res.status(400).json({
        error: 'Failed to fetch vehicles',
        message: error.message
      });
    }

    return res.status(200).json({
      success: true,
      vehicles: vehicles || []
    });

  } catch (error) {
    console.error('Get vehicles error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * Add vehicle
 */
async function addVehicle(req, res) {
  try {
    const userId = req.user?.id || req.auth?.userId || req.headers['x-user-id'];
    const vehicleData = req.body;
    
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .insert({
        ...vehicleData,
        user_id: userId, // FIXED: Changed from owner_id to user_id
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Add vehicle error:', error);
      return res.status(400).json({
        error: 'Failed to add vehicle',
        message: error.message
      });
    }

    return res.status(201).json({
      success: true,
      vehicle,
      message: 'Vehicle added successfully'
    });

  } catch (error) {
    console.error('Add vehicle error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * Get KYC documents
 */
async function getKycDocuments(req, res) {
  try {
    const userId = req.user?.id || req.auth?.userId || req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const { data: documents, error } = await supabase
      .from('verification_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get KYC documents error:', error);
      return res.status(400).json({
        error: 'Failed to fetch documents',
        message: error.message
      });
    }

    return res.status(200).json({
      success: true,
      documents: documents || []
    });

  } catch (error) {
    console.error('Get KYC documents error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * Upload KYC document
 */
async function uploadKycDocument(req, res) {
  try {
    const userId = req.user?.id || req.auth?.userId || req.headers['x-user-id'];
    const docData = req.body;
    
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const { data: document, error } = await supabase
      .from('verification_documents')
      .insert({
        ...docData,
        user_id: userId,
        verification_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Upload KYC document error:', error);
      return res.status(400).json({
        error: 'Failed to upload document',
        message: error.message
      });
    }

    return res.status(201).json({
      success: true,
      document,
      message: 'Document uploaded successfully'
    });

  } catch (error) {
    console.error('Upload KYC document error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * Ensure user profile exists
 */
async function ensureProfile(req, res) {
  try {
    const { email, phone, full_name, auth_provider, user_id } = req.body;
    
    console.log('🔵 ENSURE Profile request:', { email, phone, full_name, auth_provider, user_id });
    
    if (!email && !user_id) {
      return res.status(400).json({
        error: 'Missing required data',
        message: 'Email or user_id is required'
      });
    }

    // Validate and format phone number
    let formattedPhone = phone;
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, ''); // Remove non-digits
      if (cleanPhone.length === 10) {
        formattedPhone = `+91${cleanPhone}`;
      }
    }

    let userData;
    let isNewUser = false;

    // Try to find existing user
    if (user_id) {
      const { data: existingUser } = await supabase
        .from('users_app')
        .select('*')
        .eq('id', user_id)
        .single();
      
      userData = existingUser;
      console.log('🔵 Found user by ID:', userData?.full_name);
    }

    if (!userData && email) {
      const { data: existingUser } = await supabase
        .from('users_app')
        .select('*')
        .eq('email', email)
        .single();
      
      userData = existingUser;
      console.log('🔵 Found user by email:', userData?.full_name);
    }

    // Create user if not exists
    if (!userData) {
      console.log('🔵 Creating new user profile...');
      const { data: newUser, error: createError } = await supabase
        .from('users_app')
        .insert({
          id: user_id,
          full_name: full_name || email?.split('@')[0] || 'User',
          phone: formattedPhone || '',
          email: email || '',
          role: 'rider',
          auth_provider: auth_provider || 'supabase',
          is_verified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Profile creation failed:', createError);
        return res.status(400).json({
          error: 'Profile creation failed',
          message: createError.message
        });
      }

      userData = newUser;
      isNewUser = true;

      console.log('✅ New user profile created:', userData.full_name);

      // Create wallet for new user
      try {
        await supabase
          .from('wallets')
          .insert({
            user_id: userData.id,
            balance_available_inr: 0,
            balance_reserved_inr: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        console.log('✅ Wallet created for user');
      } catch (walletError) {
        console.warn('⚠️ Wallet creation failed (non-critical):', walletError);
      }
    }

    return res.status(200).json({
      success: true,
      user: userData,
      isNewUser
    });

  } catch (error) {
    console.error('❌ Ensure profile error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  getVehicles,
  addVehicle,
  getKycDocuments,
  uploadKycDocument,
  ensureProfile
};
