// SMS Service using Twilio
// Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env

const twilio = require('twilio');

let twilioClient = null;

// Initialize Twilio client
const initTwilio = () => {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
      twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      console.log('✅ Twilio SMS service initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize Twilio:', error);
      return false;
    }
  }
  return false;
};

// Send SMS
const sendSMS = async (to, message) => {
  if (!twilioClient) {
    if (!initTwilio()) {
      console.warn('Twilio not configured. SMS will not be sent.');
      return { success: false, error: 'SMS service not configured' };
    }
  }

  if (!process.env.TWILIO_PHONE_NUMBER) {
    return { success: false, error: 'Twilio phone number not configured' };
  }

  try {
    // Format phone number (ensure it starts with +)
    let phoneNumber = to.trim();
    if (!phoneNumber.startsWith('+')) {
      // Assume US number if no country code
      phoneNumber = `+1${phoneNumber.replace(/\D/g, '')}`;
    }

    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    return {
      success: true,
      messageId: result.sid,
    };
  } catch (error) {
    console.error('SMS sending error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send SMS',
    };
  }
};

// Send session reminder SMS
const sendSessionReminderSMS = (name, sessionDate, sessionTime, minutesBefore = 24 * 60) => {
  const timeText = minutesBefore >= 60 
    ? `${Math.floor(minutesBefore / 60)} hour${Math.floor(minutesBefore / 60) > 1 ? 's' : ''}`
    : `${minutesBefore} minute${minutesBefore > 1 ? 's' : ''}`;
  
  const message = `Hi ${name}, this is a reminder that you have a therapy session scheduled for ${sessionDate} at ${sessionTime} (in ${timeText}). Please log in 5 minutes before your session starts. - Rooted Voices`;

  return message;
};

module.exports = {
  initTwilio,
  sendSMS,
  sendSessionReminderSMS,
};

