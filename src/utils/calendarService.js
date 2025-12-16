// Calendar Integration Service
// Supports Google Calendar, Outlook, and Apple Calendar

const axios = require('axios');

/**
 * Generate Google Calendar event URL
 * @param {Object} sessionData - Session data
 * @returns {string} Google Calendar URL
 */
const generateGoogleCalendarUrl = (sessionData) => {
  const {
    title = 'Therapy Session',
    description = '',
    startDate,
    endDate,
    location = '',
  } = sessionData;

  // Format dates for Google Calendar (YYYYMMDDTHHMMSSZ)
  const formatGoogleDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const start = formatGoogleDate(startDate);
  const end = formatGoogleDate(endDate);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details: description,
    location: location,
    sf: 'true',
    output: 'xml',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/**
 * Generate Outlook Calendar event URL
 * @param {Object} sessionData - Session data
 * @returns {string} Outlook Calendar URL
 */
const generateOutlookCalendarUrl = (sessionData) => {
  const {
    title = 'Therapy Session',
    description = '',
    startDate,
    endDate,
    location = '',
  } = sessionData;

  // Format dates for Outlook (ISO 8601)
  const formatOutlookDate = (date) => {
    return date.toISOString();
  };

  const params = new URLSearchParams({
    subject: title,
    body: description,
    startdt: formatOutlookDate(startDate),
    enddt: formatOutlookDate(endDate),
    location: location,
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};

/**
 * Generate Apple Calendar (.ics file) data
 * @param {Object} sessionData - Session data
 * @returns {string} ICS file content
 */
const generateAppleCalendarIcs = (sessionData) => {
  const {
    title = 'Therapy Session',
    description = '',
    startDate,
    endDate,
    location = '',
    meetingLink = '',
  } = sessionData;

  const formatICSDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const uid = `therapy-session-${Date.now()}@rootedvoices.com`;
  const now = new Date();

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rooted Voices//Therapy Session//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICSDate(now)}`,
    `DTSTART:${formatICSDate(startDate)}`,
    `DTEND:${formatICSDate(endDate)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}${meetingLink ? `\\n\\nMeeting Link: ${meetingLink}` : ''}`,
    `LOCATION:${location || 'Online'}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Therapy session in 15 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return ics;
};

/**
 * Create Google Calendar event via API
 * @param {Object} sessionData - Session data
 * @param {string} accessToken - Google OAuth access token
 * @returns {Promise<Object>} Created event
 */
const createGoogleCalendarEvent = async (sessionData, accessToken) => {
  const {
    title = 'Therapy Session',
    description = '',
    startDate,
    endDate,
    location = '',
    meetingLink = '',
  } = sessionData;

  try {
    const event = {
      summary: title,
      description: `${description}\n\nMeeting Link: ${meetingLink}`,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      location: location || 'Online',
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 24 hours before
          { method: 'popup', minutes: 15 }, // 15 minutes before
        ],
      },
      conferenceData: meetingLink ? {
        createRequest: {
          requestId: `therapy-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      } : undefined,
    };

    const response = await axios.post(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      event,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
      hangoutLink: response.data.hangoutLink,
    };
  } catch (error) {
    console.error('Google Calendar API Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
};

/**
 * Create Outlook Calendar event via API
 * @param {Object} sessionData - Session data
 * @param {string} accessToken - Microsoft OAuth access token
 * @returns {Promise<Object>} Created event
 */
const createOutlookCalendarEvent = async (sessionData, accessToken) => {
  const {
    title = 'Therapy Session',
    description = '',
    startDate,
    endDate,
    location = '',
    meetingLink = '',
  } = sessionData;

  try {
    const event = {
      subject: title,
      body: {
        contentType: 'HTML',
        content: `${description}<br><br><a href="${meetingLink}">Join Meeting</a>`,
      },
      start: {
        dateTime: startDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      location: {
        displayName: location || 'Online',
      },
      isReminderOn: true,
      reminderMinutesBeforeStart: 15,
      isOnlineMeeting: !!meetingLink,
      onlineMeetingProvider: meetingLink ? 'teamsForBusiness' : undefined,
      onlineMeeting: meetingLink ? {
        joinUrl: meetingLink,
      } : undefined,
    };

    const response = await axios.post(
      'https://graph.microsoft.com/v1.0/me/calendar/events',
      event,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      eventId: response.data.id,
      webLink: response.data.webLink,
      onlineMeeting: response.data.onlineMeeting,
    };
  } catch (error) {
    console.error('Outlook Calendar API Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
};

/**
 * Delete calendar event
 * @param {string} provider - Calendar provider ('google' or 'outlook')
 * @param {string} eventId - Event ID
 * @param {string} accessToken - OAuth access token
 * @returns {Promise<Object>} Deletion result
 */
const deleteCalendarEvent = async (provider, eventId, accessToken) => {
  try {
    let url;
    if (provider === 'google') {
      url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;
    } else if (provider === 'outlook') {
      url = `https://graph.microsoft.com/v1.0/me/calendar/events/${eventId}`;
    } else {
      return { success: false, error: 'Unsupported provider' };
    }

    await axios.delete(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Delete Calendar Event Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
};

/**
 * Update calendar event
 * @param {string} provider - Calendar provider
 * @param {string} eventId - Event ID
 * @param {Object} updates - Event updates
 * @param {string} accessToken - OAuth access token
 * @returns {Promise<Object>} Update result
 */
const updateCalendarEvent = async (provider, eventId, updates, accessToken) => {
  try {
    let url;
    if (provider === 'google') {
      url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;
    } else if (provider === 'outlook') {
      url = `https://graph.microsoft.com/v1.0/me/calendar/events/${eventId}`;
    } else {
      return { success: false, error: 'Unsupported provider' };
    }

    const response = await axios.patch(url, updates, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      event: response.data,
    };
  } catch (error) {
    console.error('Update Calendar Event Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
};

module.exports = {
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
  generateAppleCalendarIcs,
  createGoogleCalendarEvent,
  createOutlookCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
};

