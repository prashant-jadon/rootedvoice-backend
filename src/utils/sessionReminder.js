const Session = require('../models/Session');
const Client = require('../models/Client');
const Therapist = require('../models/Therapist');
const User = require('../models/User');
const { sendEmail, emailTemplates } = require('./emailService');
const { sendSMS, sendSessionReminderSMS } = require('./smsService');
const { sendPushNotification, createSessionReminderPayload } = require('./pushNotificationService');

// Helper function to parse scheduledTime string and combine with scheduledDate
const getSessionDateTime = (scheduledDate, scheduledTime) => {
  const sessionDate = new Date(scheduledDate);
  const timeStr = scheduledTime.replace(/[APM]/gi, '').trim();
  const [hours, minutes] = timeStr.split(':').map(Number);
  const isPM = scheduledTime.toUpperCase().includes('PM');
  
  const sessionDateTime = new Date(sessionDate);
  sessionDateTime.setHours(
    isPM && hours !== 12 ? hours + 12 : hours === 12 && !isPM ? 0 : hours,
    minutes || 0,
    0,
    0
  );
  
  return sessionDateTime;
};

// Send session reminders
const sendSessionReminders = async () => {
  try {
    const now = new Date();
    
    // 24-hour reminder: sessions scheduled between 24-25 hours from now
    const tomorrowStart = new Date(now);
    tomorrowStart.setHours(tomorrowStart.getHours() + 24);
    tomorrowStart.setMinutes(0);
    tomorrowStart.setSeconds(0);
    tomorrowStart.setMilliseconds(0);
    
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(tomorrowEnd.getHours() + 1);

    // 45-minute reminder: sessions scheduled between 45-60 minutes from now
    const soonStart = new Date(now);
    soonStart.setMinutes(soonStart.getMinutes() + 45);
    soonStart.setSeconds(0);
    soonStart.setMilliseconds(0);
    
    const soonEnd = new Date(soonStart);
    soonEnd.setMinutes(soonEnd.getMinutes() + 15);

    // Find all upcoming sessions that need reminders
    const allSessions = await Session.find({
      status: { $in: ['scheduled', 'confirmed'] },
      $or: [
        { reminder24hSent: { $ne: true } },
        { reminder45mSent: { $ne: true } },
      ],
    })
      .populate({
        path: 'clientId',
        populate: { path: 'userId', select: 'email firstName lastName phone' }
      })
      .populate({
        path: 'therapistId',
        populate: { path: 'userId', select: 'email firstName lastName phone' }
      });

    // Filter sessions for 24-hour reminder
    const sessions24h = allSessions.filter(session => {
      if (session.reminder24hSent) return false;
      const sessionDateTime = getSessionDateTime(session.scheduledDate, session.scheduledTime);
      return sessionDateTime >= tomorrowStart && sessionDateTime < tomorrowEnd;
    });

    // Filter sessions for 45-minute reminder
    const sessions45m = allSessions.filter(session => {
      if (session.reminder45mSent) return false;
      const sessionDateTime = getSessionDateTime(session.scheduledDate, session.scheduledTime);
      return sessionDateTime >= soonStart && sessionDateTime < soonEnd;
    });

    // Send 24-hour reminders
    for (const session of sessions24h) {
      const sessionDateTime = getSessionDateTime(session.scheduledDate, session.scheduledTime);
      const sessionDate = sessionDateTime.toLocaleDateString();
      const sessionTime = session.scheduledTime;

      // Get client preferences
      const client = await Client.findById(session.clientId._id || session.clientId);
      const clientPreferences = client?.preferences?.sessionReminders || { enabled: true, email24h: true, sms24h: false, push24h: true };

      // Send to client
      if (session.clientId && session.clientId.userId && clientPreferences.enabled) {
        const clientUser = await User.findById(session.clientId.userId._id || session.clientId.userId);
        
        // Email reminder
        if (clientPreferences.email24h !== false) {
          try {
            await sendEmail({
              to: clientUser.email,
              ...emailTemplates.sessionReminder(
                clientUser.firstName,
                sessionDate,
                sessionTime
              ),
            });
          } catch (error) {
            console.error('Failed to send email reminder:', error);
          }
        }

        // SMS reminder
        if (clientPreferences.sms24h && clientUser.phone) {
          try {
            const smsMessage = sendSessionReminderSMS(clientUser.firstName, sessionDate, sessionTime, 24 * 60);
            await sendSMS(clientUser.phone, smsMessage);
          } catch (error) {
            console.error('Failed to send SMS reminder:', error);
          }
        }

        // Push notification
        if (clientPreferences.push24h !== false && clientUser.pushSubscription) {
          try {
            const payload = createSessionReminderPayload(clientUser.firstName, sessionDate, sessionTime, 24 * 60);
            await sendPushNotification(clientUser.pushSubscription, payload);
          } catch (error) {
            console.error('Failed to send push notification:', error);
          }
        }
      }

      // Send to therapist
      if (session.therapistId && session.therapistId.userId) {
        const therapistUser = await User.findById(session.therapistId.userId._id || session.therapistId.userId);
        
        // Email reminder (therapists always get email)
        try {
          await sendEmail({
            to: therapistUser.email,
            subject: 'Session Reminder - Tomorrow',
            html: `
              <h2>Session Reminder</h2>
              <p>Hi ${therapistUser.firstName},</p>
              <p>This is a reminder that you have a therapy session scheduled for:</p>
              <p><strong>Date:</strong> ${sessionDate}</p>
              <p><strong>Time:</strong> ${sessionTime}</p>
              <p><strong>Client:</strong> ${session.clientId.userId.firstName} ${session.clientId.userId.lastName}</p>
              <p>Please log in 5 minutes before your session starts.</p>
            `,
          });
        } catch (error) {
          console.error('Failed to send therapist email reminder:', error);
        }

        // Push notification for therapist
        if (therapistUser.pushSubscription) {
          try {
            const payload = createSessionReminderPayload(
              therapistUser.firstName,
              sessionDate,
              sessionTime,
              24 * 60
            );
            await sendPushNotification(therapistUser.pushSubscription, payload);
          } catch (error) {
            console.error('Failed to send therapist push notification:', error);
          }
        }
      }

      // Mark reminder as sent
      session.reminder24hSent = true;
      await session.save();
    }

    // Send 45-minute reminders
    for (const session of sessions45m) {
      const sessionDateTime = getSessionDateTime(session.scheduledDate, session.scheduledTime);
      const sessionDate = sessionDateTime.toLocaleDateString();
      const sessionTime = session.scheduledTime;

      // Get client preferences
      const client = await Client.findById(session.clientId._id || session.clientId);
      const clientPreferences = client?.preferences?.sessionReminders || { enabled: true, email45m: true, sms45m: true, push45m: true };

      // Send to client
      if (session.clientId && session.clientId.userId && clientPreferences.enabled) {
        const clientUser = await User.findById(session.clientId.userId._id || session.clientId.userId);
        
        // Email reminder
        if (clientPreferences.email45m !== false) {
          try {
            await sendEmail({
              to: clientUser.email,
              subject: 'Session Starting Soon - 45 Minutes',
              html: `
                <h2>Session Starting Soon</h2>
                <p>Hi ${clientUser.firstName},</p>
                <p>Your therapy session is starting in 45 minutes:</p>
                <p><strong>Date:</strong> ${sessionDate}</p>
                <p><strong>Time:</strong> ${sessionTime}</p>
                <p>Please prepare and log in 5 minutes before your session starts.</p>
              `,
            });
          } catch (error) {
            console.error('Failed to send email reminder:', error);
          }
        }

        // SMS reminder
        if (clientPreferences.sms45m && clientUser.phone) {
          try {
            const smsMessage = sendSessionReminderSMS(clientUser.firstName, sessionDate, sessionTime, 45);
            await sendSMS(clientUser.phone, smsMessage);
          } catch (error) {
            console.error('Failed to send SMS reminder:', error);
          }
        }

        // Push notification
        if (clientPreferences.push45m !== false && clientUser.pushSubscription) {
          try {
            const payload = createSessionReminderPayload(clientUser.firstName, sessionDate, sessionTime, 45);
            await sendPushNotification(clientUser.pushSubscription, payload);
          } catch (error) {
            console.error('Failed to send push notification:', error);
          }
        }
      }

      // Send to therapist
      if (session.therapistId && session.therapistId.userId) {
        const therapistUser = await User.findById(session.therapistId.userId._id || session.therapistId.userId);
        
        // Email reminder (therapists always get email)
        try {
          await sendEmail({
            to: therapistUser.email,
            subject: 'Session Starting Soon - 45 Minutes',
            html: `
              <h2>Session Starting Soon</h2>
              <p>Hi ${therapistUser.firstName},</p>
              <p>Your therapy session is starting in 45 minutes:</p>
              <p><strong>Date:</strong> ${sessionDate}</p>
              <p><strong>Time:</strong> ${sessionTime}</p>
              <p><strong>Client:</strong> ${session.clientId.userId.firstName} ${session.clientId.userId.lastName}</p>
              <p>Please prepare and log in 5 minutes before your session starts.</p>
            `,
          });
        } catch (error) {
          console.error('Failed to send therapist email reminder:', error);
        }

        // Push notification for therapist
        if (therapistUser.pushSubscription) {
          try {
            const payload = createSessionReminderPayload(
              therapistUser.firstName,
              sessionDate,
              sessionTime,
              45
            );
            await sendPushNotification(therapistUser.pushSubscription, payload);
          } catch (error) {
            console.error('Failed to send therapist push notification:', error);
          }
        }
      }

      // Mark reminder as sent
      session.reminder45mSent = true;
      await session.save();
    }

    console.log(`Sent ${sessions24h.length} 24-hour reminders and ${sessions45m.length} 45-minute reminders`);
  } catch (error) {
    console.error('Error sending session reminders:', error);
  }
};

module.exports = {
  sendSessionReminders,
};

