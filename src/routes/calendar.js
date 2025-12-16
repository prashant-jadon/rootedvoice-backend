const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
  getCalendarEvents,
  getCalendarEvent,
  getCalendarStatus,
  connectGoogleCalendar,
  connectOutlookCalendar,
  disconnectCalendar,
  getCalendarEventUrl,
  syncSessionToCalendar,
} = require('../controllers/calendarController');

// All calendar routes require authentication
router.use(protect);

// Internal calendar routes (built-in calendar)
router.get('/events', getCalendarEvents);
router.get('/events/:id', getCalendarEvent);

// Calendar integration status
router.get('/status', getCalendarStatus);

// External calendar sync (optional - Google/Outlook)
router.post('/connect/google', connectGoogleCalendar);
router.post('/connect/outlook', connectOutlookCalendar);
router.post('/disconnect', disconnectCalendar);

// Calendar event URLs for manual add
router.get('/event-url/:sessionId', getCalendarEventUrl);
router.post('/sync-session/:sessionId', syncSessionToCalendar);

module.exports = router;

