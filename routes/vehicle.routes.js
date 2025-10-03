// routes/vehicle.routes.js - Vehicle management routes
const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');

// Vehicle routes
router.get('/vehicles', vehicleController.getUserVehicles);
router.post('/vehicles', vehicleController.addVehicle);
router.put('/vehicles/:vehicleId', vehicleController.updateVehicle);
router.delete('/vehicles/:vehicleId', vehicleController.deleteVehicle);

// KYC document routes
router.get('/kyc', vehicleController.getKycDocuments);
router.post('/kyc', vehicleController.uploadKycDocument);

module.exports = router;
