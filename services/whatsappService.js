const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

class WhatsappService {
  constructor() {
    this.token = process.env.WHATSAPP_ACCESS_TOKEN;
    this.phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.apiVersion = process.env.META_API_VERSION || 'v19.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneId}`;
  }

  /**
   * Step 1: Uploads the local temporary video to Meta Graph API.
   * Returns the generated media_id.
   */
  async uploadMedia(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`FILE_NOT_FOUND: ${filePath}`);
    }

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('type', 'video/mp4');
    form.append('messaging_product', 'whatsapp');

    const uploadUrl = `${this.baseUrl}/media`;

    const response = await axios.post(uploadUrl, form, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        ...form.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    if (!response.data || !response.data.id) {
      throw new Error('FAILED_TO_GET_MEDIA_ID_FROM_META');
    }

    return response.data.id;
  }

  /**
   * Step 2: Dispatches the video message with media_id and instruction caption.
   */
  async sendVideoMessage(recipientPhone, mediaId) {
    const messageUrl = `${this.baseUrl}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'video',
      video: {
        id: mediaId,
        caption: "✅ Great, Here is your HD Video!\n\n1. Download ⬇️ the video.\n2. Use FORWARD ➡️ button for HD status.\n\n⚠️ Do not use SHARE button ⚠️"
      }
    };

    const response = await axios.post(messageUrl, payload, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      }
    });

    return response.data;
  }

  /**
   * Comprehensive 2-step delivery runner.
   */
  async deliverVideoToCustomer(recipientPhone, filePath) {
    console.log(`[WhatsappService] Starting 2-step delivery for ${recipientPhone}...`);
    
    // Step 1: Upload Media
    const mediaId = await this.uploadMedia(filePath);
    console.log(`[WhatsappService] Media uploaded to Meta. Media ID: ${mediaId}`);

    // Step 2: Send Video Message
    const dispatchResult = await this.sendVideoMessage(recipientPhone, mediaId);
    console.log(`[WhatsappService] Video message successfully dispatched to ${recipientPhone}`);
    
    return dispatchResult;
  }
}

module.exports = new WhatsappService();
