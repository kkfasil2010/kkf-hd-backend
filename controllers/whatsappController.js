const jobManager = require('../services/jobManager');
const whatsappService = require('../services/whatsappService');

// Standard RFC 4122 v4 UUID Regex
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

exports.verifyWebhook = (req, res) => {
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
};

exports.handleIncomingEvent = async (req, res) => {
  const body = req.body;

  // Always respond 200 OK immediately to acknowledge event receipt to Meta
  res.sendStatus(200);

  if (!body.object || body.object !== 'whatsapp_business_account') {
    return;
  }

  const entries = body.entry;
  if (!entries || !entries[0] || !entries[0].changes || !entries[0].changes[0]) {
    return;
  }

  const value = entries[0].changes[0].value;

  // 1. Handle Status updates (delivery confirmations, read receipts)
  if (value.statuses && value.statuses[0]) {
    const statusObj = value.statuses[0];
    console.log(`[Webhook] Status update for message ${statusObj.id}: ${statusObj.status}`);
    return;
  }

  // 2. Handle Inbound Messages
  if (!value.messages || !value.messages[0]) {
    return;
  }

  const message = value.messages[0];
  const wamid = message.id;
  const senderPhone = message.from; // Authoritative customer phone number

  // Idempotency check: Ignore duplicate webhook deliveries
  if (jobManager.isMessageProcessed(wamid)) {
    console.log(`[Webhook] Duplicate event skipped: ${wamid}`);
    return;
  }

  const textBody = message.text ? message.text.body : '';
  console.log(`[Webhook] Received message from ${senderPhone}: "${textBody}"`);

  // Extract UUID from text
  const match = textBody.match(UUID_REGEX);
  if (!match) {
    console.log(`[Webhook] No UUID found in message from ${senderPhone}`);
    return;
  }

  const extractedUuid = match[0];
  console.log(`[Webhook] Extracted UUID: ${extractedUuid} for customer ${senderPhone}`);

  // Atomic Claim: Prevents concurrent race conditions
  const job = jobManager.claimJobForSending(extractedUuid, senderPhone);
  if (!job) {
    console.log(`[Webhook] Job ${extractedUuid} cannot be claimed (Either invalid, expired, or already used)`);
    return;
  }

  // Trigger Asynchronous 2-Step Video Delivery
  try {
    await whatsappService.deliverVideoToCustomer(senderPhone, job.filePath);
    jobManager.markDelivered(extractedUuid);
    console.log(`[Webhook] Delivery sequence successfully completed for ${extractedUuid}`);
  } catch (err) {
    console.error(`[Webhook] Delivery failed for ${extractedUuid}:`, err.message);
    jobManager.markFailed(extractedUuid, err.message);
  }
};
