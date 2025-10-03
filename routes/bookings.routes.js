// routes/bookings.routes.js - FIXED MIDDLEWARE USAGE
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { unifiedAuthMiddleware, optionalAuthMiddleware } = require('../middleware/unifiedAuth');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Apply unified auth middleware to all routes
router.use(unifiedAuthMiddleware);

// POST /bookings - Create booking with unified user management
router.post('/', async (req, res) => {
  try {
    const uid = req.user?.id;
    
    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { ride_id } = req.body;
    const seats = req.body.seats || req.body.seats_requested || 1;
    
    if (!ride_id) {
      return res.status(400).json({ error: 'ride_id is required' });
    }

    console.log(`Creating booking: ride_id=${ride_id}, seats=${seats}, rider=${uid}`);

    // Get ride details
    const { data: ride, error: rideErr } = await supabase
      .from('rides')
      .select(`
        id, driver_id, seats_available, price_per_seat_inr, 
        status, allow_auto_confirm, ride_type, "from", "to",
        depart_date, depart_time, auto_approve, allow_auto_book
      `)
      .eq('id', ride_id)
      .single();
      
    if (rideErr || !ride) {
      console.error('Ride fetch error:', rideErr);
      return res.status(404).json({ error: 'Ride not found' });
    }

    // Basic validations
    if (ride.driver_id === uid) {
      return res.status(400).json({ error: 'Cannot book your own ride' });
    }

    if (ride.status !== 'published') {
      return res.status(400).json({ error: 'Ride not available' });
    }

    if (seats > (ride.seats_available || 0)) {
      return res.status(400).json({ error: 'Not enough seats available' });
    }

    // Calculate fare and deposit
    const totalFare = (ride.price_per_seat_inr || 0) * seats;
    const rideType = ride.ride_type || 'private_pool';
    
    // Calculate deposit amount (20% of fare or minimum 50)
    const depositAmount = Math.max(Math.ceil(totalFare * 0.2), 50);
    
    console.log(`Fare calculation: total=${totalFare}, deposit=${depositAmount}`);

    // Ensure user has wallet
    let { data: wallet } = await supabase
      .from('wallets')
      .select('balance_available_inr, balance_reserved_inr')
      .eq('user_id', uid)
      .single();
      
    if (!wallet) {
      // Create wallet if it doesn't exist
      const { data: newWallet, error: walletCreateError } = await supabase
        .from('wallets')
        .insert({
          user_id: uid,
          balance_available_inr: 0,
          balance_reserved_inr: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (walletCreateError) {
        console.error('Wallet creation error:', walletCreateError);
        return res.status(500).json({ error: 'Failed to create wallet' });
      }
      
      wallet = newWallet;
    }
      
    const availableBalance = wallet?.balance_available_inr || 0;
    
    if (availableBalance < depositAmount) {
      return res.status(400).json({
        error: 'Insufficient wallet balance',
        message: `You need ₹${depositAmount} in your wallet to book this ride. Your current balance is ₹${availableBalance}.`,
        required_balance: depositAmount,
        current_balance: availableBalance,
        shortfall: depositAmount - availableBalance
      });
    }

    // Get default stops - create them if they don't exist
    let fromStopId = req.body.from_stop_id;
    let toStopId = req.body.to_stop_id;
    
    if (!fromStopId || !toStopId) {
      // Try to find existing stops
      const { data: existingStops } = await supabase
        .from('stops')
        .select('id, name')
        .limit(2);
        
      if (existingStops && existingStops.length >= 2) {
        fromStopId = fromStopId || existingStops[0].id;
        toStopId = toStopId || existingStops[1].id;
      } else {
        // Create default stops if they don't exist
        const { data: defaultFromStop } = await supabase
          .from('stops')
          .insert({
            name: `${ride.from} Default`,
            latitude: 0,
            longitude: 0,
            is_active: true
          })
          .select('id')
          .single();
          
        const { data: defaultToStop } = await supabase
          .from('stops')
          .insert({
            name: `${ride.to} Default`,
            latitude: 0,
            longitude: 0,
            is_active: true
          })
          .select('id')
          .single();
          
        fromStopId = fromStopId || defaultFromStop?.id;
        toStopId = toStopId || defaultToStop?.id;
      }
    }

    if (!fromStopId || !toStopId) {
      return res.status(500).json({ error: 'Could not create or find pickup/drop stops' });
    }

    // Determine booking status based on auto-approval setting
    const autoConfirm = ride.auto_approve ?? ride.allow_auto_confirm ?? ride.allow_auto_book ?? true;
    let status = autoConfirm ? 'confirmed' : 'pending';
    let newSeatsAvail = ride.seats_available;
    
    if (status === 'confirmed') {
      newSeatsAvail = ride.seats_available - seats;
    }

    console.log(`Booking will be ${status} (auto_approve: ${autoConfirm})`);

    const bookingData = {
      ride_id,
      rider_id: uid,
      from_stop_id: fromStopId,
      to_stop_id: toStopId,
      seats_booked: seats,
      fare_total_inr: totalFare,
      deposit_inr: depositAmount,
      status
    };

    console.log('Creating booking with data:', bookingData);

    // Create booking
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select(`
        id, ride_id, rider_id, seats_booked, status, 
        fare_total_inr, deposit_inr, created_at, from_stop_id, to_stop_id
      `)
      .single();
      
    if (bookingErr) {
      console.error('Booking creation error:', bookingErr);
      return res.status(400).json({ 
        error: 'Failed to create booking',
        message: bookingErr.message,
        details: bookingErr
      });
    }

    console.log('Booking created successfully:', booking);

    // Get stop names
    const { data: fromStop } = await supabase
      .from('stops')
      .select('name')
      .eq('id', fromStopId)
      .single();
      
    const { data: toStop } = await supabase
      .from('stops')
      .select('name')
      .eq('id', toStopId)
      .single();

    // If confirmed, update available seats and reserve deposit
    if (status === 'confirmed') {
      // Update ride seats
      const { error: seatsErr } = await supabase
        .from('rides')
        .update({ seats_available: newSeatsAvail })
        .eq('id', ride_id);
        
      if (seatsErr) {
        console.error('Failed to update seats:', seatsErr);
      }

      // Reserve deposit in wallet
      const { error: walletErr } = await supabase
        .from('wallets')
        .update({
          balance_available_inr: availableBalance - depositAmount,
          balance_reserved_inr: (wallet?.balance_reserved_inr || 0) + depositAmount
        })
        .eq('user_id', uid);
        
      if (walletErr) {
        console.error('Failed to reserve deposit:', walletErr);
      } else {
        // Create wallet transaction record
        await supabase
          .from('wallet_transactions')
          .insert({
            user_id: uid,
            tx_type: 'reserve',
            amount_inr: depositAmount,
            note: `Deposit reserved for ride ${ride.from} to ${ride.to}`,
            ref_booking_id: booking.id
          });
      }

      // 🔥 CREATE AUTO-MESSAGE FOR CONFIRMED BOOKING
      try {
        // Create inbox thread if it doesn't exist
        const { data: existingThread } = await supabase
          .from('inbox_threads')
          .select('id')
          .eq('ride_id', ride_id)
          .eq('rider_id', uid)
          .eq('driver_id', ride.driver_id)
          .maybeSingle();

        let threadId;
        if (existingThread) {
          threadId = existingThread.id;
        } else {
          const { data: newThread, error: threadErr } = await supabase
            .from('inbox_threads')
            .insert({
              ride_id,
              rider_id: uid,
              driver_id: ride.driver_id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select('id')
            .single();
          
          if (!threadErr && newThread) {
            threadId = newThread.id;
          }
        }

        // Create auto-message from driver to rider
        if (threadId) {
          const autoMessage = `🚗 Booking confirmed! Looking forward to our trip from ${ride.from || 'pickup'} to ${ride.to || 'destination'} on ${ride.depart_date} at ${ride.depart_time}. Please be ready at the pickup point 10 minutes early. Safe travels! 🛣️`;
          
          await supabase
            .from('inbox_messages')
            .insert({
              thread_id: threadId,
              sender_id: ride.driver_id,
              body: autoMessage,
              created_at: new Date().toISOString()
            });
          
          console.log('✅ Auto-message created for booking confirmation');
        }
      } catch (msgErr) {
        console.error('Failed to create auto-message:', msgErr);
      }
    } else {
      // For pending bookings, still reserve the deposit
      const { error: walletErr } = await supabase
        .from('wallets')
        .update({
          balance_available_inr: availableBalance - depositAmount,
          balance_reserved_inr: (wallet?.balance_reserved_inr || 0) + depositAmount
        })
        .eq('user_id', uid);
        
      if (!walletErr) {
        await supabase
          .from('wallet_transactions')
          .insert({
            user_id: uid,
            tx_type: 'reserve',
            amount_inr: depositAmount,
            note: `Deposit reserved for pending booking ${booking.id}`,
            ref_booking_id: booking.id
          });
      }
    }

    res.json({
      success: true,
      id: booking.id,
      ride_id: booking.ride_id,
      rider_id: booking.rider_id,
      seats: booking.seats_booked,
      status: booking.status,
      fare_total_inr: booking.fare_total_inr,
      deposit_inr: booking.deposit_inr,
      pickup_stop: fromStop?.name || 'Default Pickup',
      drop_stop: toStop?.name || 'Default Drop',
      auto_approved: status === 'confirmed',
      message: status === 'confirmed' 
        ? `Booking confirmed automatically! ₹${depositAmount} deposit reserved. Check your inbox for ride details.`
        : `Booking request sent to driver! ₹${depositAmount} deposit reserved. You'll be notified when approved.`
    });
  } catch (e) {
    console.error('Booking error:', e);
    res.status(500).json({ 
      error: 'Internal server error',
      message: e.message 
    });
  }
});

// PUT /bookings/:id/status - Approve/reject booking (for drivers)
router.put('/:id/status', async (req, res) => {
  try {
    const uid = req.user?.id;
    const { id: bookingId } = req.params;
    const { status, action } = req.body;

    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const newStatus = status || (action === 'approve' ? 'confirmed' : 'rejected');

    if (!['confirmed', 'rejected'].includes(newStatus)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        message: 'Status must be "confirmed" or "rejected"'
      });
    }

    // Get booking and ride details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id, ride_id, rider_id, seats_booked, status, 
        fare_total_inr, deposit_inr
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select(`
        id, driver_id, seats_available, "from", "to",
        depart_date, depart_time
      `)
      .eq('id', booking.ride_id)
      .single();

    if (rideError || !ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    // Check if user is the driver
    if (ride.driver_id !== uid) {
      return res.status(403).json({ error: 'Only the driver can approve/reject bookings' });
    }

    // Check if booking is still pending
    if (booking.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Booking already processed',
        message: `Booking status is already ${booking.status}`
      });
    }

    // Update booking status
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (updateError) {
      return res.status(400).json({ 
        error: 'Failed to update booking',
        message: updateError.message
      });
    }

    // If confirmed, update seat availability
    if (newStatus === 'confirmed') {
      const newSeatsAvail = (ride.seats_available || 0) - booking.seats_booked;
      await supabase
        .from('rides')
        .update({ seats_available: Math.max(0, newSeatsAvail) })
        .eq('id', booking.ride_id);
    }

    // If rejected, release deposit back to wallet
    if (newStatus === 'rejected') {
      try {
        // Get current wallet
        const { data: wallet } = await supabase
          .from('wallets')
          .select('balance_available_inr, balance_reserved_inr')
          .eq('user_id', booking.rider_id)
          .single();

        if (wallet) {
          // Release deposit
          await supabase
            .from('wallets')
            .update({
              balance_available_inr: (wallet.balance_available_inr || 0) + booking.deposit_inr,
              balance_reserved_inr: Math.max(0, (wallet.balance_reserved_inr || 0) - booking.deposit_inr)
            })
            .eq('user_id', booking.rider_id);

          // Record transaction
          await supabase
            .from('wallet_transactions')
            .insert({
              user_id: booking.rider_id,
              tx_type: 'refund',
              amount_inr: booking.deposit_inr,
              note: `Refund for rejected booking ${booking.id}`,
              ref_booking_id: booking.id
            });
        }
      } catch (releaseErr) {
        console.error('Failed to release deposit:', releaseErr);
      }
    }

    return res.json({
      success: true,
      booking_id: bookingId,
      status: newStatus,
      message: newStatus === 'confirmed' 
        ? 'Booking approved successfully! Rider has been notified.'
        : 'Booking rejected. Deposit has been refunded to rider.'
    });

  } catch (e) {
    console.error('Update booking status error:', e);
    return res.status(500).json({ error: e.message });
  }
});

// GET /bookings/driver/pending - Get pending bookings for driver
router.get('/driver/pending', async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get rides published by this driver
    const { data: rides, error: ridesError } = await supabase
      .from('rides')
      .select('id, "from", "to", depart_date, depart_time, auto_approve')
      .eq('driver_id', uid)
      .eq('status', 'published');

    if (ridesError) {
      return res.status(400).json({ error: ridesError.message });
    }

    const result = [];

    // For each ride, get pending and confirmed bookings
    for (const ride of rides || []) {
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id, rider_id, seats_booked, status, 
          fare_total_inr, deposit_inr, created_at
        `)
        .eq('ride_id', ride.id)
        .in('status', ['pending', 'confirmed'])
        .order('created_at', { ascending: false });

      if (!bookingsError && bookings) {
        // Get rider details for each booking
        for (const booking of bookings) {
          const { data: rider } = await supabase
            .from('users_app')
            .select('full_name, phone, email')
            .eq('id', booking.rider_id)
            .single();

          result.push({
            ride: {
              id: ride.id,
              from: ride.from,
              to: ride.to,
              depart_date: ride.depart_date,
              depart_time: ride.depart_time,
              auto_approve: ride.auto_approve
            },
            booking: {
              ...booking,
              rider: rider || {}
            }
          });
        }
      }
    }

    return res.json(result);

  } catch (e) {
    console.error('Get driver bookings error:', e);
    return res.status(500).json({ error: e.message });
  }
});

// POST /bookings/load-wallet - Load wallet
router.post('/load-wallet', async (req, res) => {
  try {
    const uid = req.user?.id;
    const amount = req.body.amount || 1000; // Default ₹1000
    
    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    console.log(`Loading wallet: ${amount} for user ${uid}`);

    // Get or create wallet
    let { data: wallet } = await supabase
      .from('wallets')
      .select('balance_available_inr, balance_reserved_inr')
      .eq('user_id', uid)
      .single();
    
    if (!wallet) {
      // Create wallet if it doesn't exist
      const { data: newWallet, error: createError } = await supabase
        .from('wallets')
        .insert({
          user_id: uid,
          balance_available_inr: amount,
          balance_reserved_inr: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (createError) {
        console.error('Failed to create wallet:', createError);
        return res.status(400).json({ error: createError.message });
      }
      
      wallet = newWallet;
    } else {
      // Update existing wallet
      const { error: updateErr } = await supabase
        .from('wallets')
        .update({
          balance_available_inr: (wallet.balance_available_inr || 0) + amount
        })
        .eq('user_id', uid);
        
      if (updateErr) {
        console.error('Failed to update wallet:', updateErr);
        return res.status(400).json({ error: updateErr.message });
      }
    }
    
    // Create transaction record
    await supabase
      .from('wallet_transactions')
      .insert({
        user_id: uid,
        tx_type: 'deposit',
        amount_inr: amount,
        note: `Wallet loaded with ₹${amount}`
      });

    res.json({
      success: true,
      message: `Wallet loaded with ₹${amount}`,
      amount_added: amount,
      new_balance: (wallet.balance_available_inr || 0) + amount
    });
  } catch (e) {
    console.error('Wallet load error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /bookings/inbox - Get user bookings
router.get('/inbox', async (req, res) => {
  try {
    const uid = req.user?.id || req.query.uid;
    
    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    console.log(`Getting inbox for user ${uid}`);

    // Get bookings
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, ride_id, seats_booked, status, fare_total_inr, 
        deposit_inr, created_at, from_stop_id, to_stop_id
      `)
      .eq('rider_id', uid)
      .order('created_at', { ascending: false })
      .limit(20);
      
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Get ride and stop details separately
    const result = [];
    for (const booking of data || []) {
      // Get ride details
      const { data: ride } = await supabase
        .from('rides')
        .select('id, "from", "to", depart_date, depart_time, driver_id')
        .eq('id', booking.ride_id)
        .single();

      // Get stop details
      const { data: fromStop } = await supabase
        .from('stops')
        .select('name')
        .eq('id', booking.from_stop_id)
        .single();

      const { data: toStop } = await supabase
        .from('stops')
        .select('name')
        .eq('id', booking.to_stop_id)
        .single();

      result.push({
        ...booking,
        ride: ride || {},
        pickup_location: fromStop?.name || 'Unknown',
        drop_location: toStop?.name || 'Unknown'
      });
    }

    res.json(result);
  } catch (e) {
    console.error('Inbox fetch error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /bookings/wallet - Get wallet balance
router.get('/wallet', async (req, res) => {
  try {
    const uid = req.user?.id || req.query.uid;
    
    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance_available_inr, balance_reserved_inr, updated_at')
      .eq('user_id', uid)
      .single();
    
    if (!wallet) {
      return res.json({
        balance_available_inr: 0,
        balance_reserved_inr: 0,
        total_balance_inr: 0
      });
    }

    res.json({
      ...wallet,
      total_balance_inr: (wallet.balance_available_inr || 0) + (wallet.balance_reserved_inr || 0)
    });
  } catch (e) {
    console.error('Wallet fetch error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /bookings/mine - Get user's bookings (rider perspective)
router.get('/mine', async (req, res) => {
  try {
    const uid = req.user?.id;
    
    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    console.log(`🔍 Getting bookings for rider: ${uid}`);

    // Get user's bookings (without problematic joins)
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id, ride_id, seats_booked, status, fare_total_inr, 
        deposit_inr, created_at, updated_at, from_stop_id, to_stop_id
      `)
      .eq('rider_id', uid)
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (error) {
      console.error('❌ Bookings fetch error:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log(`📋 Found ${(bookings || []).length} raw bookings from database`);
    console.log(`📋 Raw bookings data:`, JSON.stringify(bookings, null, 2));

    // Build results with separate API calls to avoid join issues
    const result = [];
    for (const booking of bookings || []) {
      console.log(`🔍 Processing booking ${booking.id} for ride ${booking.ride_id}`);
      
      // Get ride details first
      const { data: ride, error: rideError } = await supabase
        .from('rides')
        .select(`
          id, driver_id, route_id, "from", "to", depart_date, depart_time,
          price_per_seat_inr, vehicle_make, vehicle_model, vehicle_plate,
          car_make, car_model, car_plate, ride_type, status
        `)
        .eq('id', booking.ride_id)
        .single();

      if (rideError) {
        console.error(`❌ Ride fetch error for booking ${booking.id}:`, rideError);
        continue; // Skip this booking if ride not found
      }

      // Get route info if from/to are null
      let fromLocation = ride.from;
      let toLocation = ride.to;
      
      if (ride.route_id && (!fromLocation || !toLocation)) {
        console.log(`🔍 Fetching route info for booking ${booking.id}, route_id: ${ride.route_id}`);
        const { data: route, error: routeError } = await supabase
          .from('routes')
          .select('id, name, origin, destination')
          .eq('id', ride.route_id)
          .single();
        
        if (!routeError && route) {
          fromLocation = route.origin || fromLocation || 'Unknown Origin';
          toLocation = route.destination || toLocation || 'Unknown Destination';
          console.log(`✅ Found route info for booking ${booking.id}: ${fromLocation} -> ${toLocation}`);
        } else {
          console.error(`❌ Route fetch error for booking ${booking.id}:`, routeError);
        }
      }
      
      // Set defaults if still missing
      if (!fromLocation) fromLocation = 'Unknown Origin';
      if (!toLocation) toLocation = 'Unknown Destination';

      console.log(`✅ Found ride for booking ${booking.id}: ${fromLocation} -> ${toLocation}`);

      // Get driver details using the ride's driver_id
      const { data: driver } = await supabase
        .from('users_app')
        .select('full_name, phone, email')
        .eq('id', ride.driver_id)
        .single();

      console.log(`✅ Found driver for booking ${booking.id}: ${driver?.full_name || 'Unknown'}`);

      // Get stop names
      const { data: fromStop } = await supabase
        .from('stops')
        .select('name')
        .eq('id', booking.from_stop_id)
        .maybeSingle();
      
      const { data: toStop } = await supabase
        .from('stops')
        .select('name')
        .eq('id', booking.to_stop_id)
        .maybeSingle();

      const bookingData = {
        id: booking.id,
        ride_id: booking.ride_id,
        rider_id: uid,
        seats_booked: booking.seats_booked,
        status: booking.status,
        fare_total_inr: booking.fare_total_inr,
        deposit_inr: booking.deposit_inr,
        created_at: booking.created_at,
        updated_at: booking.updated_at,
        pickup_stop: fromStop?.name || 'Default Pickup',
        drop_stop: toStop?.name || 'Default Drop',
        ride: {
          id: ride.id,
          from: fromLocation,
          to: toLocation,
          depart_date: ride.depart_date,
          depart_time: ride.depart_time,
          price_per_seat_inr: ride.price_per_seat_inr,
          vehicle_make: ride.vehicle_make || ride.car_make || 'Unknown',
          vehicle_model: ride.vehicle_model || ride.car_model || 'Unknown',
          vehicle_plate: ride.vehicle_plate || ride.car_plate || 'Unknown',
          ride_type: ride.ride_type || 'private_pool',
          status: ride.status,
          driver_id: ride.driver_id
        },
        driver: {
          full_name: driver?.full_name || 'Driver',
          phone: driver?.phone || '',
          email: driver?.email || '',
          rating: 4.5 // Default rating
        }
      };
      
      console.log(`📦 Processed booking data for ${booking.id}:`, JSON.stringify(bookingData, null, 2));
      result.push(bookingData);
    }

    console.log(`✅ Returning ${result.length} processed bookings for user`);
    console.log(`📤 Final response:`, JSON.stringify(result, null, 2));
    return res.json(result);
  } catch (e) {
    console.error('❌ My bookings error:', e);
    return res.status(500).json({ error: e.message });
  }
});

// GET /bookings/:id - Get booking details
router.get('/:id', async (req, res) => {
  try {
    const uid = req.user?.id;
    const { id: bookingId } = req.params;

    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id, ride_id, rider_id, seats_booked, fare_total_inr, deposit_inr, status, created_at
      `)
      .eq('id', bookingId)
      .single();

    if (error) {
      console.error('Booking fetch error:', error);
      return res.status(400).json({ error: error.message });
    }

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Get ride details
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select(`
        id, driver_id, "from", "to", depart_date, depart_time, 
        price_per_seat_inr, car_make, car_model, car_plate, ride_type
      `)
      .eq('id', booking.ride_id)
      .single();

    // Check if user has access to this booking
    const isRider = booking.rider_id === uid;
    const isDriver = ride?.driver_id === uid;

    if (!isRider && !isDriver) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json({
      ...booking,
      ride: ride || {}
    });
  } catch (e) {
    console.error('Get booking error:', e);
    return res.status(500).json({ error: e.message });
  }
});

// POST /bookings/:id/cancel - Cancel booking (alternative endpoint)
router.post('/:id/cancel', async (req, res) => {
  try {
    const uid = req.user?.id;
    const { id: bookingId } = req.params;

    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchErr || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const isRider = booking.rider_id === uid;
    if (!isRider) {
      return res.status(403).json({ error: 'Only the rider can cancel this booking' });
    }

    if (booking.status === 'cancelled') {
      return res.json({ success: true, message: 'Booking is already cancelled' });
    }

    // Update booking status to cancelled
    const { error: cancelErr } = await supabase
      .from('bookings')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (cancelErr) {
      return res.status(400).json({ error: cancelErr.message });
    }

    // Release seat back to ride if it was confirmed
    if (booking.status === 'confirmed') {
      const { error: seatsErr } = await supabase
        .from('rides')
        .update({ 
          seats_available: supabase.raw('seats_available + ?', [booking.seats_booked])
        })
        .eq('id', booking.ride_id);
        
      if (seatsErr) {
        console.error('Failed to update seat availability:', seatsErr);
      }
    }

    // Release deposit (simplified - you can add penalty logic later)
    try {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance_available_inr, balance_reserved_inr')
        .eq('user_id', booking.rider_id)
        .single();

      if (wallet && booking.deposit_inr > 0) {
        await supabase
          .from('wallets')
          .update({
            balance_available_inr: (wallet.balance_available_inr || 0) + booking.deposit_inr,
            balance_reserved_inr: Math.max(0, (wallet.balance_reserved_inr || 0) - booking.deposit_inr)
          })
          .eq('user_id', booking.rider_id);

        await supabase
          .from('wallet_transactions')
          .insert({
            user_id: booking.rider_id,
            tx_type: 'release',
            amount_inr: booking.deposit_inr,
            note: `Deposit released for cancelled booking ${booking.id}`,
            ref_booking_id: booking.id
          });
      }
    } catch (releaseErr) {
      console.error('Failed to release deposit:', releaseErr);
    }

    return res.json({ 
      success: true, 
      message: 'Booking cancelled successfully',
      booking_id: bookingId
    });
  } catch (e) {
    console.error('Cancel booking error:', e);
    return res.status(500).json({ error: e.message });
  }
});

// DELETE /bookings/:id - Cancel booking
router.delete('/:id', async (req, res) => {
  try {
    const uid = req.user?.id;
    const { id: bookingId } = req.params;

    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchErr || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const isRider = booking.rider_id === uid;
    if (!isRider) {
      return res.status(403).json({ error: 'Only the rider can cancel this booking' });
    }

    // Update booking status to cancelled
    const { error: cancelErr } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);

    if (cancelErr) {
      return res.status(400).json({ error: cancelErr.message });
    }

    return res.json({ 
      success: true, 
      message: 'Booking cancelled successfully'
    });
  } catch (e) {
    console.error('Cancel booking error:', e);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;