// Internal Calendar Service
// Manages built-in calendar events (not external calendar sync)

const CalendarEvent = require('../models/CalendarEvent');
const Session = require('../models/Session');
const User = require('../models/User');

/**
 * Create calendar event from session
 * @param {Object} session - Session object
 * @param {Object} userId - User ID to create event for
 * @returns {Promise<Object>} Created calendar event
 */
const createCalendarEventFromSession = async (session, userId) => {
  try {
    // Calculate session times
    const sessionStart = new Date(session.scheduledDate);
    const [hours, minutes] = session.scheduledTime.replace(/[APM]/gi, '').split(':').map(Number);
    const isPM = session.scheduledTime.toUpperCase().includes('PM');
    sessionStart.setHours(
      isPM && hours !== 12 ? hours + 12 : hours === 12 && !isPM ? 0 : hours,
      minutes || 0,
      0,
      0
    );

    const sessionEnd = new Date(sessionStart);
    sessionEnd.setMinutes(sessionEnd.getMinutes() + (session.duration || 45));

    // Get user and session details
    const user = await User.findById(userId);
    const populatedSession = await Session.findById(session._id)
      .populate('therapistId', 'userId')
      .populate({
        path: 'therapistId',
        populate: { path: 'userId', select: 'firstName lastName' }
      })
      .populate('clientId', 'userId')
      .populate({
        path: 'clientId',
        populate: { path: 'userId', select: 'firstName lastName' }
      });

    // Determine title and description based on user role
    let title, description;
    if (user.role === 'therapist') {
      const clientName = populatedSession.clientId?.userId
        ? `${populatedSession.clientId.userId.firstName} ${populatedSession.clientId.userId.lastName}`
        : 'Client';
      title = `${session.sessionType || 'Therapy'} Session - ${clientName}`;
      description = `Therapy session with ${clientName}`;
    } else {
      const therapistName = populatedSession.therapistId?.userId
        ? `${populatedSession.therapistId.userId.firstName} ${populatedSession.therapistId.userId.lastName}`
        : 'Therapist';
      title = `${session.sessionType || 'Therapy'} Session - ${therapistName}`;
      description = `Therapy session with ${therapistName}`;
    }

    // Check if event already exists
    const existingEvent = await CalendarEvent.findOne({
      userId,
      sessionId: session._id,
    });

    if (existingEvent) {
      // Update existing event
      existingEvent.title = title;
      existingEvent.description = description;
      existingEvent.startDate = sessionStart;
      existingEvent.endDate = sessionEnd;
      existingEvent.meetingLink = session.meetingLink || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/video-call?sessionId=${session._id}`;
      existingEvent.jitsiRoomName = session.jitsiRoomName;
      existingEvent.status = session.status;
      existingEvent.location = 'Online';
      await existingEvent.save();
      return existingEvent;
    }

    // Create new calendar event
    const calendarEvent = await CalendarEvent.create({
      userId,
      sessionId: session._id,
      title,
      description,
      startDate: sessionStart,
      endDate: sessionEnd,
      location: 'Online',
      meetingLink: session.meetingLink || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/video-call?sessionId=${session._id}`,
      jitsiRoomName: session.jitsiRoomName,
      status: session.status,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      reminders: [
        {
          type: 'email',
          minutesBefore: 24 * 60, // 24 hours
        },
        {
          type: 'in-app',
          minutesBefore: 45, // 45 minutes
        },
      ],
      color: user.role === 'therapist' ? '#3B82F6' : '#8B5CF6', // Blue for therapist, purple for client
    });

    return calendarEvent;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw error;
  }
};

/**
 * Update calendar event when session changes
 * @param {Object} session - Updated session object
 * @returns {Promise<void>}
 */
const updateCalendarEventFromSession = async (session) => {
  try {
    // Get all calendar events for this session
    const events = await CalendarEvent.find({ sessionId: session._id });

    // Calculate new session times
    const sessionStart = new Date(session.scheduledDate);
    const [hours, minutes] = session.scheduledTime.replace(/[APM]/gi, '').split(':').map(Number);
    const isPM = session.scheduledTime.toUpperCase().includes('PM');
    sessionStart.setHours(
      isPM && hours !== 12 ? hours + 12 : hours === 12 && !isPM ? 0 : hours,
      minutes || 0,
      0,
      0
    );

    const sessionEnd = new Date(sessionStart);
    sessionEnd.setMinutes(sessionEnd.getMinutes() + (session.duration || 45));

    // Update all events for this session
    for (const event of events) {
      event.startDate = sessionStart;
      event.endDate = sessionEnd;
      event.status = session.status;
      event.meetingLink = session.meetingLink || event.meetingLink;
      event.jitsiRoomName = session.jitsiRoomName || event.jitsiRoomName;

      // Update title if session type changed
      if (session.sessionType) {
        const populatedSession = await Session.findById(session._id)
          .populate('therapistId', 'userId')
          .populate({
            path: 'therapistId',
            populate: { path: 'userId', select: 'firstName lastName' }
          })
          .populate('clientId', 'userId')
          .populate({
            path: 'clientId',
            populate: { path: 'userId', select: 'firstName lastName' }
          });

        const user = await User.findById(event.userId);
        if (user.role === 'therapist') {
          const clientName = populatedSession.clientId?.userId
            ? `${populatedSession.clientId.userId.firstName} ${populatedSession.clientId.userId.lastName}`
            : 'Client';
          event.title = `${session.sessionType} Session - ${clientName}`;
        } else {
          const therapistName = populatedSession.therapistId?.userId
            ? `${populatedSession.therapistId.userId.firstName} ${populatedSession.therapistId.userId.lastName}`
            : 'Therapist';
          event.title = `${session.sessionType} Session - ${therapistName}`;
        }
      }

      await event.save();
    }
  } catch (error) {
    console.error('Error updating calendar event:', error);
    throw error;
  }
};

/**
 * Delete calendar events when session is cancelled
 * @param {string} sessionId - Session ID
 * @returns {Promise<void>}
 */
const deleteCalendarEventsForSession = async (sessionId) => {
  try {
    // Soft delete - mark as cancelled instead of deleting
    await CalendarEvent.updateMany(
      { sessionId },
      { status: 'cancelled' }
    );
  } catch (error) {
    console.error('Error deleting calendar events:', error);
    throw error;
  }
};

/**
 * Get calendar events for a user
 * @param {string} userId - User ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Calendar events
 */
const getUserCalendarEvents = async (userId, startDate, endDate) => {
  try {
    return await CalendarEvent.getEventsByDateRange(userId, startDate, endDate);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
};

/**
 * Get upcoming events for a user
 * @param {string} userId - User ID
 * @param {number} limit - Number of events to return
 * @returns {Promise<Array>} Upcoming events
 */
const getUpcomingEvents = async (userId, limit = 10) => {
  try {
    return await CalendarEvent.getUpcomingEvents(userId, limit);
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    throw error;
  }
};

/**
 * Generate calendar event URLs for manual add (Google, Outlook, Apple)
 * @param {Object} calendarEvent - Calendar event
 * @returns {Object} Calendar URLs
 */
const generateCalendarUrls = (calendarEvent) => {
  const {
    generateGoogleCalendarUrl,
    generateOutlookCalendarUrl,
    generateAppleCalendarIcs,
  } = require('./calendarService');

  const sessionData = {
    title: calendarEvent.title,
    description: calendarEvent.description,
    startDate: calendarEvent.startDate,
    endDate: calendarEvent.endDate,
    location: calendarEvent.location,
    meetingLink: calendarEvent.meetingLink,
  };

  return {
    googleCalendarUrl: generateGoogleCalendarUrl(sessionData),
    outlookCalendarUrl: generateOutlookCalendarUrl(sessionData),
    appleCalendarIcs: generateAppleCalendarIcs(sessionData),
  };
};

module.exports = {
  createCalendarEventFromSession,
  updateCalendarEventFromSession,
  deleteCalendarEventsForSession,
  getUserCalendarEvents,
  getUpcomingEvents,
  generateCalendarUrls,
};

