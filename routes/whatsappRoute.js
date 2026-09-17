const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

// Meta Webhook Verification
router.get('/', whatsappController.verifyWebhook);

// Meta Incoming Events (Messages & Statuses)
router.post('/', whatsappController.handleIncomingEvent);

module.exports = router;
