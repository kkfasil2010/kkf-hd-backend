const express = require('express');
const router = express.Router();

// Webhook Verification (Meta will send a GET request here)
router.get('/', (req, res) => {
  const verify_token = process.env.WHATSAPP_VERIFY_TOKEN;
  
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
  
  if (mode && token) {
    if (mode === 'subscribe' && token === verify_token) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.status(400).send('Invalid request');
  }
});

module.exports = router;
