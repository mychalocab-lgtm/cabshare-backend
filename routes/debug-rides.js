// debug-rides.js - Simple endpoint to test My Rides functionality
const express = require('express');
const router = express.Router();
const { supabase } = require('../supabase');

// Simple debug endpoint for My Rides data
router.get('/debug/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`🔍 DEBUG: Getting data for user: ${userId}`);
    
    // Get user's bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id, ride_id, rider_id, seats_booked, status, 
        fare_total_inr, deposit_inr, created_at, updated_at
      `)
      .eq('rider_id', userId)
      .order('created_at', { ascending: false });
    
    console.log(`📋 Found ${(bookings || []).length} bookings for user ${userId}`);
    
    // Get user's published rides
    const { data: rides, error: ridesError } = await supabase
      .from('rides')
      .select(`
        id, driver_id, route_id, depart_date, depart_time, 
        price_per_seat_inr, seats_total, seats_available,
        ride_type, status, created_at, car_make, car_model, car_plate
      `)
      .eq('driver_id', userId)
      .order('created_at', { ascending: false });
    
    console.log(`🚗 Found ${(rides || []).length} published rides for user ${userId}`);
    
    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users_app')
      .select('id, full_name, email, phone, role')
      .eq('id', userId)
      .single();
    
    console.log(`👤 User details: ${user?.full_name || 'Unknown'} (${user?.email || 'no email'})`);
    
    res.json({
      success: true,
      user_id: userId,
      user: user || null,
      user_error: userError?.message || null,
      bookings_count: (bookings || []).length,
      bookings_error: bookingsError?.message || null,
      bookings_sample: (bookings || []).slice(0, 2),
      rides_count: (rides || []).length,
      rides_error: ridesError?.message || null,
      rides_sample: (rides || []).slice(0, 2),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ DEBUG endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      user_id: req.params.userId,
      timestamp: new Date().toISOString()
    });
  }
});

// Simple endpoint to test all users
router.get('/debug/all-users', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Getting all users with their data...');
    
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users_app')
      .select('id, full_name, email, phone, role')
      .limit(10);
    
    const userSummary = [];
    
    for (const user of users || []) {
      // Get counts for each user
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('rider_id', user.id);
      
      const { data: rides } = await supabase
        .from('rides')
        .select('id')
        .eq('driver_id', user.id);
      
      userSummary.push({
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
        bookings_count: (bookings || []).length,
        rides_count: (rides || []).length
      });
    }
    
    res.json({
      success: true,
      total_users: (users || []).length,
      users_error: usersError?.message || null,
      users: userSummary,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ DEBUG all users error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint to create some sample data
router.post('/debug/create-sample', async (req, res) => {
  try {
    const userId = req.body.user_id || '501ec14e-570b-42ca-86b4-69e682d1193c'; // From your logs
    
    console.log(`🔨 Creating sample data for user: ${userId}`);
    
    // Create a sample route if it doesn't exist
    const { data: existingRoute } = await supabase
      .from('routes')
      .select('id')
      .ilike('origin', 'Mumbai')
      .ilike('destination', 'Pune')
      .limit(1)
      .maybeSingle();
    
    let routeId;
    if (existingRoute) {
      routeId = existingRoute.id;
    } else {
      const { data: newRoute, error: routeError } = await supabase
        .from('routes')
        .insert({
          name: 'Mumbai → Pune Express',
          origin: 'Mumbai',
          destination: 'Pune',
          is_active: true
        })
        .select('id')
        .single();
      
      if (routeError) {
        throw new Error('Failed to create route: ' + routeError.message);
      }
      
      routeId = newRoute.id;
    }
    
    // Create a sample ride
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .insert({
        driver_id: userId,
        route_id: routeId,
        depart_date: '2025-12-30',
        depart_time: '10:00:00',
        seats_total: 4,
        seats_available: 3,
        price_per_seat_inr: 500,
        ride_type: 'private_pool',
        allow_auto_confirm: true,
        car_make: 'Maruti',
        car_model: 'Swift',
        car_plate: 'MH01AB1234',
        status: 'published'
      })
      .select()
      .single();
    
    if (rideError) {
      throw new Error('Failed to create ride: ' + rideError.message);
    }
    
    // Create a sample booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        ride_id: ride.id,
        rider_id: userId,
        seats_booked: 1,
        fare_total_inr: 500,
        deposit_inr: 100,
        status: 'confirmed'
      })
      .select()
      .single();
    
    res.json({
      success: true,
      message: 'Sample data created successfully',
      ride_id: ride.id,
      booking_id: booking?.id || null,
      route_id: routeId,
      user_id: userId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Create sample data error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;