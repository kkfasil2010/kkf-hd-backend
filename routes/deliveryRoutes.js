const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');

// Endpoint to upload optimized video and create job
router.post('/create', deliveryController.uploadMiddleware, deliveryController.createDeliveryJob);

// Polling endpoint for Flutter client to check status
router.get('/:uuid/status', deliveryController.getDeliveryStatus);

module.exports = router;
