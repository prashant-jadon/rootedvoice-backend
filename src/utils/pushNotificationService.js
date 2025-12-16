// Web Push Notification Service
// Requires VAPID keys in .env (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)

const webpush = require('web-push');

let isInitialized = false;

// Initialize web push with VAPID keys
const initWebPush = () => {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    isInitialized = true;
    console.log('✅ Web Push service initialized');
    return true;
  }
  console.warn('VAPID keys not configured. Push notifications will not work.');
  return false;
};

// Send push notification
const sendPushNotification = async (subscription, payload) => {
  if (!isInitialized) {
    if (!initWebPush()) {
      return { success: false, error: 'Push notification service not configured' };
    }
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { success: true };
  } catch (error) {
    console.error('Push notification error:', error);
    
    // Handle expired/invalid subscriptions
    if (error.statusCode === 410 || error.statusCode === 404) {
      return { success: false, error: 'Subscription expired', expired: true };
    }
    
    return { success: false, error: error.message || 'Failed to send push notification' };
  }
};

// Create session reminder payload
const createSessionReminderPayload = (name, sessionDate, sessionTime, minutesBefore = 24 * 60) => {
  const timeText = minutesBefore >= 60 
    ? `${Math.floor(minutesBefore / 60)} hour${Math.floor(minutesBefore / 60) > 1 ? 's' : ''}`
    : `${minutesBefore} minute${minutesBefore > 1 ? 's' : ''}`;
  
  return {
    title: 'Session Reminder',
    body: `Hi ${name}, your therapy session is scheduled for ${sessionDate} at ${sessionTime} (in ${timeText})`,
    icon: '/logorooted 1.png',
    badge: '/logorooted 1.png',
    data: {
      url: '/sessions',
      type: 'session-reminder',
    },
    actions: [
      {
        action: 'view',
        title: 'View Session',
      },
    ],
  };
};

module.exports = {
  initWebPush,
  sendPushNotification,
  createSessionReminderPayload,
};

