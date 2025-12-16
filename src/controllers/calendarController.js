const User = require('../models/User');
const Session = require('../models/Session');
const CalendarEvent = require('../models/CalendarEvent');
const { asyncHandler } = require('../middlewares/errorHandler');
const {
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
  generateAppleCalendarIcs,
  createGoogleCalendarEvent,
  createOutlookCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} = require('../utils/calendarService');
const {
  createCalendarEventFromSession,
  updateCalendarEventFromSession,
  deleteCalendarEventsForSession,
  getUserCalendarEvents,
  getUpcomingEvents,
  generateCalendarUrls,
} = require('../utils/internalCalendarService');

// @desc    Get user's calendar events
// @route   GET /api/calendar/events
// @access  Private
const getCalendarEvents = asyncHandler(async (req, res) => {
  const { startDate, endDate, limit = 50 } = req.query;
  const userId = req.user._id;

  let events;

  if (startDate && endDate) {
    // Get events for date range
    events = await getUserCalendarEvents(
      userId,
      new Date(startDate),
      new Date(endDate)
    );
  } else {
    // Get upcoming events
    events = await getUpcomingEvents(userId, parseInt(limit));
  }

  res.json({
    success: true,
    data: events,
  });
});

// @desc    Get calendar event by ID
// @route   GET /api/calendar/events/:id
// @access  Private
const getCalendarEvent = asyncHandler(async (req, res) => {
  const event = await CalendarEvent.findById(req.params.id)
    .populate('sessionId')
    .populate('userId', 'firstName lastName email');

  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Calendar event not found',
    });
  }

  // Check authorization
  if (event.userId._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this event',
    });
  }

  // Generate calendar URLs for manual add
  const calendarUrls = generateCalendarUrls(event);

  res.json({
    success: true,
    data: {
      event,
      calendarUrls,
    },
  });
});

// @desc    Get calendar integration status
// @route   GET /api/calendar/status
// @access  Private
const getCalendarStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('calendarIntegration');

  res.json({
    success: true,
    data: {
      provider: user.calendarIntegration?.provider || 'none',
      syncEnabled: user.calendarIntegration?.syncEnabled || false,
      lastSyncAt: user.calendarIntegration?.lastSyncAt || null,
      internalCalendarEnabled: true, // Built-in calendar is always enabled
    },
  });
});

// @desc    Connect Google Calendar (for external sync - optional)
// @route   POST /api/calendar/connect/google
// @access  Private
const connectGoogleCalendar = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken, calendarId } = req.body;

  if (!accessToken) {
    return res.status(400).json({
      success: false,
      message: 'Access token is required',
    });
  }

  const user = await User.findById(req.user._id);
  user.calendarIntegration = {
    provider: 'google',
    accessToken,
    refreshToken: refreshToken || user.calendarIntegration?.refreshToken,
    calendarId: calendarId || 'primary',
    syncEnabled: true,
    lastSyncAt: new Date(),
  };

  await user.save();

  res.json({
    success: true,
    message: 'Google Calendar connected successfully',
    data: {
      provider: 'google',
      syncEnabled: true,
    },
  });
});

// @desc    Connect Outlook Calendar (for external sync - optional)
// @route   POST /api/calendar/connect/outlook
// @access  Private
const connectOutlookCalendar = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken, calendarId } = req.body;

  if (!accessToken) {
    return res.status(400).json({
      success: false,
      message: 'Access token is required',
    });
  }

  const user = await User.findById(req.user._id);
  user.calendarIntegration = {
    provider: 'outlook',
    accessToken,
    refreshToken: refreshToken || user.calendarIntegration?.refreshToken,
    calendarId: calendarId || 'calendar',
    syncEnabled: true,
    lastSyncAt: new Date(),
  };

  await user.save();

  res.json({
    success: true,
    message: 'Outlook Calendar connected successfully',
    data: {
      provider: 'outlook',
      syncEnabled: true,
    },
  });
});

// @desc    Disconnect calendar
// @route   POST /api/calendar/disconnect
// @access  Private
const disconnectCalendar = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.calendarIntegration = {
    provider: 'none',
    syncEnabled: false,
  };
  // Clear tokens
  user.calendarIntegration.accessToken = undefined;
  user.calendarIntegration.refreshToken = undefined;
  user.calendarIntegration.calendarId = undefined;

  await user.save();

  res.json({
    success: true,
    message: 'Calendar disconnected successfully',
  });
});

// @desc    Generate calendar event URL (for manual add to external calendars)
// @route   GET /api/calendar/event-url/:sessionId
// @access  Private
const getCalendarEventUrl = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.sessionId)
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

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }

  // Calculate session times
  const sessionStart = new Date(session.scheduledDate);
  const [hours, minutes] = session.scheduledTime.replace(/[APM]/gi, '').split(':').map(Number);
  const isPM = session.scheduledTime.toUpperCase().includes('PM');
  sessionStart.setHours(isPM && hours !== 12 ? hours + 12 : hours === 12 && !isPM ? 0 : hours, minutes || 0, 0, 0);
  
  const sessionEnd = new Date(sessionStart);
  sessionEnd.setMinutes(sessionEnd.getMinutes() + session.duration);

  const sessionData = {
    title: `${session.sessionType || 'Therapy'} Session - Rooted Voices`,
    description: `Therapy session with ${session.therapistId?.userId?.firstName || 'Therapist'} ${session.therapistId?.userId?.lastName || ''}`,
    startDate: sessionStart,
    endDate: sessionEnd,
    location: 'Online',
    meetingLink: session.meetingLink || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/video-call?sessionId=${session._id}`,
  };

  const { provider = 'google' } = req.query;

  let eventUrl;
  if (provider === 'outlook') {
    eventUrl = generateOutlookCalendarUrl(sessionData);
  } else {
    eventUrl = generateGoogleCalendarUrl(sessionData);
  }

  // Also generate ICS file for Apple Calendar
  const icsContent = generateAppleCalendarIcs(sessionData);

  res.json({
    success: true,
    data: {
      googleCalendarUrl: generateGoogleCalendarUrl(sessionData),
      outlookCalendarUrl: generateOutlookCalendarUrl(sessionData),
      appleCalendarIcs: icsContent,
      eventUrl, // Default based on query param
    },
  });
});

// @desc    Sync session to external calendar (optional - for Google/Outlook sync)
// @route   POST /api/calendar/sync-session/:sessionId
// @access  Private
const syncSessionToCalendar = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.sessionId)
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

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }

  const user = await User.findById(req.user._id).select('calendarIntegration');

  if (!user.calendarIntegration?.syncEnabled || !user.calendarIntegration?.accessToken) {
    return res.status(400).json({
      success: false,
      message: 'Calendar integration not enabled or access token missing',
    });
  }

  // Calculate session times
  const sessionStart = new Date(session.scheduledDate);
  const [hours, minutes] = session.scheduledTime.replace(/[APM]/gi, '').split(':').map(Number);
  const isPM = session.scheduledTime.toUpperCase().includes('PM');
  sessionStart.setHours(isPM && hours !== 12 ? hours + 12 : hours === 12 && !isPM ? 0 : hours, minutes || 0, 0, 0);
  
  const sessionEnd = new Date(sessionStart);
  sessionEnd.setMinutes(sessionEnd.getMinutes() + session.duration);

  const sessionData = {
    title: `${session.sessionType || 'Therapy'} Session - Rooted Voices`,
    description: `Therapy session with ${session.therapistId?.userId?.firstName || 'Therapist'} ${session.therapistId?.userId?.lastName || ''}`,
    startDate: sessionStart,
    endDate: sessionEnd,
    location: 'Online',
    meetingLink: session.meetingLink || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/video-call?sessionId=${session._id}`,
  };

  const provider = user.calendarIntegration.provider;
  let result;

  if (provider === 'google') {
    result = await createGoogleCalendarEvent(sessionData, user.calendarIntegration.accessToken);
  } else if (provider === 'outlook') {
    result = await createOutlookCalendarEvent(sessionData, user.calendarIntegration.accessToken);
  } else {
    return res.status(400).json({
      success: false,
      message: 'Unsupported calendar provider',
    });
  }

  if (result.success) {
    // Update session with calendar event ID
    session.calendarEventId = result.eventId;
    session.calendarProvider = provider;
    await session.save();

    // Update user's last sync time
    user.calendarIntegration.lastSyncAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Session synced to calendar successfully',
      data: {
        eventId: result.eventId,
        eventLink: result.htmlLink || result.webLink,
      },
    });
  } else {
    res.status(500).json({
      success: false,
      message: result.error || 'Failed to sync session to calendar',
    });
  }
});

module.exports = {
  getCalendarEvents,
  getCalendarEvent,
  getCalendarStatus,
  connectGoogleCalendar,
  connectOutlookCalendar,
  disconnectCalendar,
  getCalendarEventUrl,
  syncSessionToCalendar,
};
