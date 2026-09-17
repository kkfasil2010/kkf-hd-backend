const express = require('express');
const router = express.Router();
const axios = require('axios');

// Helper function to send WhatsApp messages
async function sendWhatsAppMessage(toPhoneNumber, messageText) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

  try {
    await axios.post(url, {
      messaging_product: "whatsapp",
      to: toPhoneNumber,
      text: { body: messageText }
    }, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    console.log(`✅ Auto-reply sent successfully to ${toPhoneNumber}`);
  } catch (error) {
    console.error(`❌ Error sending message:`, error.response ? error.response.data : error.message);
  }
}

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

// Incoming Messages Webhook (Meta will send a POST request here)
router.post('/', (req, res) => {
  const body = req.body;

  if (body.object) {
    if (
      body.entry &&
      body.entry[0] &&
      body.entry[0].changes &&
      body.entry[0].changes[0] &&
      body.entry[0].changes[0].value &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      let phoneNumber = body.entry[0].changes[0].value.messages[0].from;
      let msgObj = body.entry[0].changes[0].value.messages[0];
      let msgBody = msgObj.text ? msgObj.text.body : '';

      console.log(`Incoming message from ${phoneNumber}: "${msgBody}"`);

      if (msgBody) {
        // Construct the reply text
        let replyText = `Hi there! 👋 Welcome to KKF HD Status Support.\n\nWe received your message: "${msgBody}".\nOur team will get back to you shortly!`;

        // Send the reply (do not await it, let it run in the background)
        sendWhatsAppMessage(phoneNumber, replyText);
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

module.exports = router;
