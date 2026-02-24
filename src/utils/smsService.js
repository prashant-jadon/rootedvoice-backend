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
      console.log(`[SMS Preview] To: ${to} | Message: ${message}`);
      return { success: false, error: 'SMS service not configured' };
    }
  }

  if (!process.env.TWILIO_PHONE_NUMBER) {
    console.warn('Twilio phone number not set. SMS will not be sent.');
    console.log(`[SMS Preview] To: ${to} | Message: ${message}`);
    return { success: false, error: 'Twilio phone number not configured' };
  }

  if (!to) {
    console.warn('No recipient phone number provided.');
    return { success: false, error: 'No recipient phone number' };
  }

  try {
    // Format phone number (ensure it starts with +)
    let phoneNumber = to.trim();
    if (!phoneNumber.startsWith('+')) {
      // Remove leading 0 and assume India (+91) if no country code
      const digits = phoneNumber.replace(/\D/g, '').replace(/^0+/, '');
      phoneNumber = `+1${digits}`;
    }

    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    console.log(`✅ SMS sent to ${phoneNumber} (SID: ${result.sid})`);
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

// ========== SMS MESSAGE TEMPLATES ==========

const BRAND = 'Rooted Voices';

const smsTemplates = {
  // Forgot password
  forgotPassword: (name, resetLink) =>
    `Hi ${name}, you requested a password reset for your ${BRAND} account. Reset here: ${resetLink} (expires in 1 hour). If you didn't request this, ignore this message.`,

  // Evaluation booked - sent to client
  evaluationBookedClient: (clientName, therapistName, date, time) =>
    `Hi ${clientName}, your evaluation with ${therapistName} is booked for ${date} at ${time} (60 min, online). Your therapist will review your details within 3 business days. - ${BRAND}`,

  // Evaluation booked - sent to therapist
  evaluationBookedTherapist: (therapistName, clientName) =>
    `Hi ${therapistName}, you've been assigned a new evaluation for ${clientName}. Please review client details within 3 business days. Log in to view: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/my-practice - ${BRAND}`,

  // Therapist ready - sent to client
  therapistReady: (clientName, therapistName, date, time) =>
    `Hi ${clientName}, ${therapistName} has reviewed your details and is ready for your evaluation on ${date} at ${time}. Please log in 5 min early. - ${BRAND}`,

  // Evaluation complete with recommendations - sent to client
  evaluationCompleted: (clientName, therapistName) =>
    `Hi ${clientName}, your evaluation with ${therapistName} is complete! Recommendations are ready. Your $195 credit is available! View: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing - ${BRAND}`,

  // Session booked - sent to client
  sessionBookedClient: (clientName, therapistName, date, time, duration) =>
    `Hi ${clientName}, your session with ${therapistName} is booked for ${date} at ${time} (${duration} min). Log in 5 min early. - ${BRAND}`,

  // Session booked - sent to therapist
  sessionBookedTherapist: (therapistName, clientName, date, time, duration) =>
    `Hi ${therapistName}, a session with ${clientName} is scheduled for ${date} at ${time} (${duration} min). - ${BRAND}`,

  // Session reminder
  sessionReminder: (name, sessionDate, sessionTime, minutesBefore = 24 * 60) => {
    const timeText = minutesBefore >= 60
      ? `${Math.floor(minutesBefore / 60)} hour${Math.floor(minutesBefore / 60) > 1 ? 's' : ''}`
      : `${minutesBefore} minute${minutesBefore > 1 ? 's' : ''}`;
    return `Hi ${name}, reminder: therapy session on ${sessionDate} at ${sessionTime} (in ${timeText}). Log in 5 min early. - ${BRAND}`;
  },
};

module.exports = {
  initTwilio,
  sendSMS,
  smsTemplates,
};
