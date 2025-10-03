// controllers/vehicleController.js - Vehicle management controller
const { supabase } = require('../supabase');

// Get user vehicles
exports.getUserVehicles = async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    
    // For development: allow testing without auth
    if (!userId && process.env.NODE_ENV === 'development') {
      // Test query to check table structure
      try {
        const { data: testData, error: testError } = await supabase
          .from('vehicles')
          .select('*')
          .limit(1);
        
        return res.json({
          success: true,
          vehicles: testData || [],
          count: testData ? testData.length : 0,
          debug: 'Development mode - showing first vehicle if any'
        });
      } catch (err) {
        return res.status(500).json({
          success: false,
          error: 'Database query failed',
          details: err.message
        });
      }
    }
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User authentication required' 
      });
    }

    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', userId)  // Make sure we use user_id consistently
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching vehicles:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch vehicles' 
      });
    }

    res.json({
      success: true,
      vehicles: vehicles || [],
      count: vehicles ? vehicles.length : 0
    });

  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

// Add new vehicle
exports.addVehicle = async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User authentication required' 
      });
    }

    const {
      vehicle_type = 'private',
      make,
      model,
      year,
      color,
      plate_number,
      seats = 4,
      fuel_type = 'petrol',
      transmission = 'manual',
      ac = true
    } = req.body;

    // Validate required fields
    if (!make || !model || !plate_number) {
      return res.status(400).json({ 
        success: false, 
        error: 'Make, model, and plate number are required' 
      });
    }

    // Validate plate number format (Indian format)
    const plateRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$|^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/;
    if (!plateRegex.test(plate_number.toUpperCase())) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid plate number format. Use format like MH12AB1234' 
      });
    }

    // Check if plate number already exists
    const { data: existingVehicle } = await supabase
      .from('vehicles')
      .select('id, user_id')
      .or(`plate_number.eq.${plate_number.toUpperCase()},plate.eq.${plate_number.toUpperCase()}`)
      .single();

    if (existingVehicle) {
      if (existingVehicle.user_id === userId) {
        return res.status(400).json({ 
          success: false, 
          error: 'You have already added this vehicle' 
        });
      } else {
        return res.status(400).json({ 
          success: false, 
          error: 'This vehicle is already registered by another user' 
        });
      }
    }

    // Create vehicle record
    const vehicleData = {
      user_id: userId,
      vehicle_type,
      make: make.trim(),
      model: model.trim(),
      year: year ? parseInt(year) : null,
      color: color?.trim(),
      plate_number: plate_number.toUpperCase().trim(),
      plate: plate_number.toUpperCase().trim(), // Also set old plate field
      seats: parseInt(seats) || 4,
      fuel_type: fuel_type?.toLowerCase() || 'petrol',
      transmission: transmission?.toLowerCase() || 'manual',
      ac: Boolean(ac),
      is_verified: false,
      verified: false, // Set old verified field too
      verification_status: 'pending',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .insert([vehicleData])
      .select()
      .single();

    if (error) {
      console.error('Error adding vehicle:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to add vehicle' 
      });
    }

    res.status(201).json({
      success: true,
      message: 'Vehicle added successfully',
      vehicle
    });

  } catch (error) {
    console.error('Add vehicle error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

// Update vehicle
exports.updateVehicle = async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { vehicleId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User authentication required' 
      });
    }

    // Check if vehicle belongs to user
    const { data: vehicle, error: fetchError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', vehicleId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !vehicle) {
      return res.status(404).json({ 
        success: false, 
        error: 'Vehicle not found' 
      });
    }

    const {
      make,
      model,
      year,
      color,
      seats,
      fuel_type,
      transmission,
      ac
    } = req.body;

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (make) updateData.make = make.trim();
    if (model) updateData.model = model.trim();
    if (year) updateData.year = parseInt(year);
    if (color) updateData.color = color.trim();
    if (seats) updateData.seats = parseInt(seats);
    if (fuel_type) updateData.fuel_type = fuel_type.toLowerCase();
    if (transmission) updateData.transmission = transmission.toLowerCase();
    if (ac !== undefined) updateData.ac = Boolean(ac);

    const { data: updatedVehicle, error } = await supabase
      .from('vehicles')
      .update(updateData)
      .eq('id', vehicleId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating vehicle:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to update vehicle' 
      });
    }

    res.json({
      success: true,
      message: 'Vehicle updated successfully',
      vehicle: updatedVehicle
    });

  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

// Delete vehicle
exports.deleteVehicle = async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { vehicleId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User authentication required' 
      });
    }

    // Soft delete by setting is_active to false
    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', vehicleId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error deleting vehicle:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to delete vehicle' 
      });
    }

    if (!vehicle) {
      return res.status(404).json({ 
        success: false, 
        error: 'Vehicle not found' 
      });
    }

    res.json({
      success: true,
      message: 'Vehicle deleted successfully'
    });

  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

// Get KYC documents
exports.getKycDocuments = async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User authentication required' 
      });
    }

    const { data: documents, error } = await supabase
      .from('kyc_documents')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching KYC documents:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch documents' 
      });
    }

    res.json({
      success: true,
      documents: documents || [],
      count: documents ? documents.length : 0
    });

  } catch (error) {
    console.error('Get KYC documents error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

// Upload KYC document
exports.uploadKycDocument = async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User authentication required' 
      });
    }

    const {
      document_type,
      document_number,
      document_url
    } = req.body;

    // Validate required fields
    if (!document_type || !document_number || !document_url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Document type, number, and URL are required' 
      });
    }

    // Check if document already exists
    const { data: existingDoc } = await supabase
      .from('kyc_documents')
      .select('id')
      .eq('user_id', userId)
      .eq('document_type', document_type)
      .eq('document_number', document_number)
      .single();

    if (existingDoc) {
      return res.status(400).json({ 
        success: false, 
        error: 'This document is already uploaded' 
      });
    }

    // Create document record
    const documentData = {
      user_id: userId,
      document_type: document_type.toLowerCase(),
      document_number: document_number.trim(),
      document_url: document_url.trim(),
      verification_status: 'pending',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: document, error } = await supabase
      .from('kyc_documents')
      .insert([documentData])
      .select()
      .single();

    if (error) {
      console.error('Error uploading document:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to upload document' 
      });
    }

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      document
    });

  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

module.exports = exports;
