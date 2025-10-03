// Simple test route to check vehicles table
const express = require('express');
const router = express.Router();
const { supabase } = require('../supabase');

// Test vehicles table structure
router.get('/test-vehicles', async (req, res) => {
  try {
    console.log('🔍 Testing vehicles table...');
    console.log('🔍 Supabase URL:', process.env.SUPABASE_URL);
    console.log('🔍 Service role key length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length);
    
    // Test basic connection first
    const { data: testConnection } = await supabase
      .from('users_app')
      .select('id')
      .limit(1);
    
    console.log('✅ Basic Supabase connection works');
    
    // Try to get table info
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .limit(3);
    
    if (error) {
      console.error('❌ Vehicles table error:', error);
      return res.json({
        success: false,
        error: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details,
        supabase_connected: true
      });
    }
    
    console.log('✅ Vehicles table accessible, found', data?.length || 0, 'records');
    res.json({
      success: true,
      message: 'Vehicles table is working',
      sample_data: data,
      count: data ? data.length : 0,
      supabase_connected: true
    });
    
  } catch (err) {
    console.error('❌ Test vehicles error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      supabase_connected: false
    });
  }
});

// Test adding a vehicle directly
router.get('/test-add-vehicle', async (req, res) => {
  try {
    console.log('🔍 Testing vehicle creation...');
    
    const testVehicle = {
      user_id: '00000000-0000-0000-0000-000000000001', // demo user
      make: 'Test',
      model: 'Vehicle',
      plate_number: 'TEST1234',
      plate: 'TEST1234',
      vehicle_type: 'private',
      seats: 4,
      fuel_type: 'petrol',
      transmission: 'manual',
      ac: true,
      is_verified: false,
      verified: false,
      verification_status: 'pending',
      is_active: true
    };
    
    const { data, error } = await supabase
      .from('vehicles')
      .insert([testVehicle])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Vehicle creation error:', error);
      return res.json({
        success: false,
        error: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details
      });
    }
    
    console.log('✅ Test vehicle created successfully');
    res.json({
      success: true,
      message: 'Test vehicle created',
      vehicle: data
    });
    
  } catch (err) {
    console.error('❌ Test vehicle creation error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
