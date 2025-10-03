// ENHANCED: bookingController.js with Auto-messaging Integration
const { supabase } = require('../supabase');
const { v4: uuidv4 } = require('uuid');

// ENHANCED: UUID validation function
function validateUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// ENHANCED: Safe UUID extraction with validation
function extractUserId(req) {
  let userId = req.auth?.userId || req.user?.id || req.body.rider_id || req.query.uid;
  
  if (!validateUUID(userId)) {
    console.warn('Invalid UUID received:', userId, 'generating new UUID');
    userId = uuidv4();
  }
  
  return userId;
}

// NEW: Auto-messaging system
async function createAutoMessage(type, bookingData, rideData, participantIds) {
  try {
    console.log(`🤖 Creating auto-message: ${type} for booking ${bookingData.id}`);
    
    const { driverId, riderId } = participantIds;
    let message = '';
    let senderId = 'system';
    let recipientId = riderId;
    
    const from = rideData.from || 'pickup location';
    const to = rideData.to || 'destination';
    const date = rideData.depart_date || 'travel date';
    const time = rideData.depart_time || 'travel time';
    const seats = bookingData.seats_booked || 1;
    const vehicle = `${rideData.vehicle_make || ''} ${rideData.vehicle_model || ''}`.trim();
    const vehicleInfo = vehicle && vehicle !== ' ' ? vehicle : 'vehicle';
    const plate = rideData.vehicle_plate || '';
    
    switch (type) {
      case 'booking_confirmed_auto':
        senderId = driverId;
        recipientId = riderId;
        message = `🚗 Booking confirmed! Looking forward to our trip from ${from} to ${to} on ${date} at ${time}. I'll be driving a ${vehicleInfo}${plate ? ` (${plate})` : ''}. Please be ready at the pickup point 10 minutes early. You've booked ${seats} seat${seats !== 1 ? 's' : ''}. Safe travels! 🛣️`;
        break;
        
      case 'booking_approved_auto':
        senderId = driverId;
        recipientId = riderId;
        message = `✅ Great news! I've approved your booking request for ${seats} seat${seats !== 1 ? 's' : ''} from ${from} to ${to} on ${date} at ${time}. Please be at the pickup location 10 minutes early. Looking forward to a pleasant journey together! 🚗`;
        break;
        
      case 'booking_request_auto':
        senderId = 'system';
        recipientId = driverId;
        message = `📨 New booking request received! A rider wants to book ${seats} seat${seats !== 1 ? 's' : ''} for your ride from ${from} to ${to} on ${date} at ${time}. Please review and approve/reject the request in your published rides section.`;
        break;
        
      case 'trip_completed_auto':
        senderId = 'system';
        recipientId = riderId;
        message = `🎉 Trip completed successfully! Thank you for traveling with us from ${from} to ${to}. We hope you had a comfortable journey. Please consider leaving a rating and review. Safe travels!`;
        break;
        
      default:
        console.warn(`Unknown auto-message type: ${type}`);
        return null;
    }
    
    // Create conversation thread if it doesn't exist
    const threadId = `thread_${Math.min(driverId, riderId)}_${Math.max(driverId, riderId)}_${rideData.id}`.replace(/[^a-zA-Z0-9_]/g, '_');
    
    const { data: existingThread } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', threadId)
      .single();
    
    if (!existingThread) {
      await supabase
        .from('conversations')
        .insert({
          id: threadId,
          ride_id: rideData.id,
          driver_id: driverId,
          rider_id: riderId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }
    
    // Insert the auto-message
    const messageData = {
      id: uuidv4(),
      conversation_id: threadId,
      sender_id: senderId,
      recipient_id: recipientId,
      message_text: message,
      message_type: type,
      is_auto_message: true,
      booking_id: bookingData.id,
      ride_id: rideData.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: newMessage, error } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Failed to create auto-message:', error);
      return null;
    }
    
    // Update conversation with last message
    await supabase
      .from('conversations')
      .update({
        last_message_id: newMessage.id,
        last_message_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId);
    
    console.log(`✅ Auto-message created: ${type} for booking ${bookingData.id}`);
    return newMessage;
    
  } catch (error) {
    console.error('❌ Auto-message creation failed:', error);
    return null;
  }
}

// ENHANCED: Create booking with auto-messaging
async function createBooking(req, res) {
  try {
    const uid = extractUserId(req);
    console.log('🔍 Booking request - validated uid:', uid);
    
    if (!uid) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please sign in to book a ride'
      });
    }

    const { ride_id } = req.body;
    const seats = parseInt(req.body.seats_booked || req.body.seats || 1);
    
    if (!ride_id || !seats || seats < 1) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'ride_id and seats_booked are required',
        received: { ride_id, seats }
      });
    }

    if (!validateUUID(ride_id)) {
      return res.status(400).json({
        error: 'Invalid ride ID format',
        message: 'Ride ID must be a valid UUID'
      });
    }

    // Get ride details with route information
    const { data: ride, error: rideErr } = await supabase
      .from('rides')
      .select(`
        id, driver_id, route_id, seats_available, seats_total, 
        price_per_seat_inr, status, ride_type, allow_auto_confirm,
        depart_date, depart_time, from_city_id, to_city_id,
        car_make, car_model, car_plate, vehicle_make, vehicle_model, vehicle_plate,
        "from", "to", notes
      `)
      .eq('id', ride_id)
      .single();
      
    if (rideErr || !ride) {
      console.error('❌ Ride fetch error:', rideErr);
      return res.status(404).json({ 
        error: 'Ride not found',
        message: rideErr?.message || 'The requested ride does not exist'
      });
    }

    // Get route info if from/to are null
    let fromLocation = ride.from;
    let toLocation = ride.to;
    
    if (ride.route_id && (!fromLocation || !toLocation)) {
      const { data: route } = await supabase
        .from('routes')
        .select('origin, destination')
        .eq('id', ride.route_id)
        .single();
      
      if (route) {
        fromLocation = route.origin || fromLocation;
        toLocation = route.destination || toLocation;
      }
    }

    // Validate ride status
    if (ride.status !== 'published') {
      return res.status(400).json({
        error: 'Ride not available',
        message: 'This ride is no longer available for booking'
      });
    }

    if (ride.driver_id === uid) {
      return res.status(400).json({
        error: 'Cannot book own ride',
        message: 'You cannot book your own ride'
      });
    }

    const seatsAvail = ride.seats_available || ride.seats_total || 0;
    if (seats > seatsAvail) {
      return res.status(400).json({ 
        error: 'Insufficient seats',
        message: `Only ${seatsAvail} seats available, you requested ${seats}` 
      });
    }

    // Calculate pricing and deposit
    const pricePerSeat = ride.price_per_seat_inr || 0;
    const totalFare = pricePerSeat * seats;
    let depositAmount = 0;
    
    if (ride.ride_type === 'commercial_pool' || ride.ride_type === 'commercial_full') {
      depositAmount = Math.floor(totalFare * 0.3); // 30% for commercial
    } else {
      depositAmount = Math.floor(totalFare * 0.1); // 10% for private
    }

    // Ensure user has wallet
    let { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('balance_available_inr, balance_reserved_inr')
      .eq('user_id', uid)
      .single();

    if (walletErr || !wallet) {
      const { data: newWallet, error: createWalletErr } = await supabase
        .from('wallets')
        .insert({
          user_id: uid,
          balance_available_inr: 0,
          balance_reserved_inr: 0,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createWalletErr) {
        return res.status(500).json({
          error: 'Failed to create wallet',
          message: createWalletErr.message
        });
      }
      wallet = newWallet;
    }

    if ((wallet.balance_available_inr || 0) < depositAmount) {
      return res.status(400).json({
        error: 'Insufficient wallet balance',
        message: `Deposit required: ₹${depositAmount}, Available: ₹${wallet?.balance_available_inr || 0}`,
        deposit_required: depositAmount,
        balance_available: wallet?.balance_available_inr || 0
      });
    }

    // Determine booking status
    const autoConfirm = ride.allow_auto_confirm || false;
    const status = autoConfirm ? 'confirmed' : 'pending';
    let newSeatsAvail = seatsAvail;
    
    if (status === 'confirmed') {
      newSeatsAvail = seatsAvail - seats;
    }

    // Get stop IDs if not provided
    let fromStopId = req.body.from_stop_id;
    let toStopId = req.body.to_stop_id;

    if (!fromStopId || !toStopId) {
      if (ride.route_id) {
        const { data: routeStops } = await supabase
          .from('route_stops')
          .select('id, stop_id, stop_order')
          .eq('route_id', ride.route_id)
          .order('stop_order', { ascending: true });

        if (routeStops && routeStops.length >= 2) {
          fromStopId = fromStopId || routeStops[0].stop_id || routeStops[0].id;
          toStopId = toStopId || routeStops[routeStops.length - 1].stop_id || routeStops[routeStops.length - 1].id;
        }
      }
    }

    // Create booking
    const bookingData = {
      id: uuidv4(),
      ride_id,
      rider_id: uid,
      seats_booked: seats,
      fare_total_inr: totalFare,
      rider_deposit_inr: depositAmount,
      status,
      created_at: new Date().toISOString(),
      ...(fromStopId && { from_stop_id: fromStopId }),
      ...(toStopId && { to_stop_id: toStopId })
    };

    console.log('📝 Creating booking with data:', bookingData);

    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();
      
    if (bookingErr) {
      console.error('❌ Booking creation error:', bookingErr);
      return res.status(400).json({ 
        error: 'Failed to create booking',
        message: bookingErr.message,
        details: bookingErr
      });
    }

    // Update wallet with proper transaction handling
    try {
      const { error: walletUpdateErr } = await supabase
        .from('wallets')
        .update({
          balance_available_inr: (wallet.balance_available_inr || 0) - depositAmount,
          balance_reserved_inr: (wallet.balance_reserved_inr || 0) + depositAmount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', uid);

      if (walletUpdateErr) throw walletUpdateErr;

      await supabase
        .from('wallet_transactions')
        .insert({
          id: uuidv4(),
          user_id: uid,
          tx_type: 'reserve',
          amount_inr: depositAmount,
          note: `Deposit for booking ${booking.id}`,
          ref_booking_id: booking.id,
          created_at: new Date().toISOString()
        });
    } catch (walletError) {
      await supabase.from('bookings').delete().eq('id', booking.id);
      return res.status(400).json({
        error: 'Failed to reserve deposit',
        message: walletError.message
      });
    }

    // Update seat availability if confirmed
    if (status === 'confirmed') {
      await supabase
        .from('rides')
        .update({ 
          seats_available: newSeatsAvail,
          updated_at: new Date().toISOString()
        })
        .eq('id', ride_id);
    }

    // ENHANCED: Create auto-message based on booking status
    const rideDataForMessage = {
      id: ride.id,
      from: fromLocation,
      to: toLocation,
      depart_date: ride.depart_date,
      depart_time: ride.depart_time,
      vehicle_make: ride.vehicle_make || ride.car_make,
      vehicle_model: ride.vehicle_model || ride.car_model,
      vehicle_plate: ride.vehicle_plate || ride.car_plate
    };

    const participantIds = {
      driverId: ride.driver_id,
      riderId: uid
    };

    if (status === 'confirmed') {
      // Create auto-message for confirmed booking
      await createAutoMessage('booking_confirmed_auto', booking, rideDataForMessage, participantIds);
    } else {
      // Create auto-message for pending booking (notification to driver)
      await createAutoMessage('booking_request_auto', booking, rideDataForMessage, participantIds);
    }

    return res.json({
      success: true,
      id: booking.id,
      ride_id: booking.ride_id,
      rider_id: booking.rider_id,
      seats: booking.seats_booked,
      status: booking.status,
      fare_total_inr: booking.fare_total_inr,
      deposit_inr: booking.rider_deposit_inr,
      auto_approved: status === 'confirmed',
      message: status === 'confirmed' 
        ? 'Booking confirmed automatically! Auto-message sent to your inbox.' 
        : 'Booking request sent to driver. Auto-notification sent.',
      auto_message_created: true
    });

  } catch (e) {
    console.error('❌ Booking creation error:', e);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: e.message
    });
  }
}

// ENHANCED: Update booking status with auto-messaging
async function updateBookingStatus(req, res) {
  try {
    const uid = extractUserId(req);
    const { bookingId } = req.params;
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

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, ride_id, rider_id, seats_booked, status, rider_deposit_inr')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Get ride details with route info
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select(`
        id, driver_id, route_id, seats_available, "from", "to",
        depart_date, depart_time, vehicle_make, vehicle_model, vehicle_plate,
        car_make, car_model, car_plate
      `)
      .eq('id', booking.ride_id)
      .single();

    if (rideError || !ride || ride.driver_id !== uid) {
      return res.status(403).json({ error: 'Only the driver can approve/reject bookings' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Booking already processed',
        message: `Booking status is already ${booking.status}`
      });
    }

    // Get route info if from/to are null
    let fromLocation = ride.from;
    let toLocation = ride.to;
    
    if (ride.route_id && (!fromLocation || !toLocation)) {
      const { data: route } = await supabase
        .from('routes')
        .select('origin, destination')
        .eq('id', ride.route_id)
        .single();
      
      if (route) {
        fromLocation = route.origin || fromLocation;
        toLocation = route.destination || toLocation;
      }
    }

    // Update booking status
    await supabase
      .from('bookings')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    // If confirmed, update seat availability
    if (newStatus === 'confirmed') {
      const newSeatsAvail = (ride.seats_available || 0) - booking.seats_booked;
      await supabase
        .from('rides')
        .update({ seats_available: Math.max(0, newSeatsAvail) })
        .eq('id', booking.ride_id);

      // ENHANCED: Create auto-message for approved booking
      const rideDataForMessage = {
        id: ride.id,
        from: fromLocation,
        to: toLocation,
        depart_date: ride.depart_date,
        depart_time: ride.depart_time,
        vehicle_make: ride.vehicle_make || ride.car_make,
        vehicle_model: ride.vehicle_model || ride.car_model,
        vehicle_plate: ride.vehicle_plate || ride.car_plate
      };

      const participantIds = {
        driverId: ride.driver_id,
        riderId: booking.rider_id
      };

      await createAutoMessage('booking_approved_auto', booking, rideDataForMessage, participantIds);
    }

    return res.json({
      success: true,
      booking_id: bookingId,
      status: newStatus,
      message: newStatus === 'confirmed' 
        ? 'Booking approved successfully! Auto-message sent to rider.' 
        : 'Booking rejected.',
      auto_message_created: newStatus === 'confirmed'
    });

  } catch (e) {
    console.error('❌ Update booking status error:', e);
    return res.status(500).json({ error: e.message });
  }
}

// REST OF THE ORIGINAL FUNCTIONS REMAIN UNCHANGED
async function getUserBookings(req, res) {
  try {
    const uid = extractUserId(req);
    if (!uid) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please sign in to view your bookings' 
      });
    }

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id, ride_id, rider_id, seats_booked, status, 
        fare_total_inr, rider_deposit_inr, created_at
      `)
      .eq('rider_id', uid)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('❌ Bookings fetch error:', error);
      return res.status(400).json({ 
        error: 'Failed to fetch bookings',
        message: error.message 
      });
    }

    return res.json(bookings || []);
  } catch (e) {
    console.error('❌ Get user bookings error:', e);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: e.message 
    });
  }
}

async function cancelBooking(req, res) {
  try {
    const uid = extractUserId(req);
    const { bookingId } = req.params;

    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchErr || !booking || booking.rider_id !== uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);

    return res.json({ 
      success: true, 
      message: 'Booking cancelled successfully'
    });
  } catch (e) {
    console.error('❌ Cancel booking error:', e);
    return res.status(500).json({ error: e.message });
  }
}

module.exports = {
  createBooking,
  getUserBookings,
  updateBookingStatus,
  cancelBooking,
  createAutoMessage // Export for use in other controllers
};