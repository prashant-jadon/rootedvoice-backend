// Jitsi Meeting Link Generation Service
// Improved meeting link generation with better room naming and security

const crypto = require('crypto');

/**
 * Generate secure Jitsi room name
 * @param {string} sessionId - Session ID
 * @param {string} therapistId - Therapist ID
 * @param {string} clientId - Client ID
 * @returns {string} Secure room name
 */
const generateJitsiRoomName = (sessionId, therapistId, clientId) => {
  // Create a unique, secure room name
  // Format: RootedVoices-{sessionId}-{hash}
  const hash = crypto
    .createHash('sha256')
    .update(`${sessionId}-${therapistId}-${clientId}-${Date.now()}`)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();

  return `RootedVoices-${sessionId}-${hash}`;
};

/**
 * Generate Jitsi meeting URL with proper configuration
 * @param {Object} options - Meeting options
 * @returns {string} Jitsi meeting URL
 */
const generateJitsiMeetingUrl = (options) => {
  const {
    roomName,
    displayName,
    isModerator = false,
    language = 'en',
    enableTranslation = false,
    targetLanguage = 'en',
    startWithAudioMuted = false,
    startWithVideoMuted = false,
  } = options;

  // Base Jitsi URL
  const baseUrl = process.env.JITSI_SERVER_URL || 'https://meet.jit.si';
  
  // Build configuration parameters
  const configParams = [
    `userInfo.displayName="${encodeURIComponent(displayName || 'Guest')}"`,
    'config.prejoinPageEnabled=false',
    `config.startWithAudioMuted=${startWithAudioMuted}`,
    `config.startWithVideoMuted=${startWithVideoMuted}`,
    `config.defaultLanguage=${language}`,
    'config.enableLayerSuspension=true',
    'config.enableNoAudioDetection=true',
    'config.enableNoisyMicDetection=true',
    'config.enableTalkWhileMuted=false',
    'config.enableClosePage=true',
    'config.enableWelcomePage=false',
    'config.enableInsecureRoomNameWarning=false',
    'config.enableDisplayNameInStats=false',
    'config.enableEmailInStats=false',
    'config.enableLipSync=false',
    'config.enableRemb=true',
    'config.enableTcc=true',
    'config.enableOpusRed=true',
    'config.enableH264=true',
    'config.enableVP8=true',
    'config.enableVP9=true',
    'config.resolution=720',
    'config.constraints.video.height.ideal=720',
    'config.constraints.video.width.ideal=1280',
    'config.p2p.enabled=true',
    'config.p2p.useStunTurn=true',
    'config.analytics.disabled=true', // Privacy: disable analytics
    'config.disableDeepLinking=true',
    'config.disableInviteFunctions=false',
    'config.disableRemoteMute=true', // Only moderator can mute
    'config.disableThirdPartyRequests=true',
    'config.enableLobbyChat=true',
    'config.enableChat=true',
    'config.enableFileUploads=false', // Security: disable file uploads
    'config.enableRecording=false', // Recording handled separately
  ];

  // Add moderator configuration
  if (isModerator) {
    configParams.push('config.startAudioOnly=false');
    configParams.push('config.startScreenSharing=false');
  }

  // Add translation configuration
  if (enableTranslation && targetLanguage !== language) {
    configParams.push('config.transcriptionEnabled=true');
    configParams.push(`config.translationLanguages=["${targetLanguage}"]`);
  }

  // Build final URL
  const url = `${baseUrl}/${roomName}#${configParams.join('&')}`;

  return url;
};

/**
 * Generate meeting link for session
 * @param {Object} session - Session object
 * @param {Object} user - User object (therapist or client)
 * @returns {Object} Meeting link and room name
 */
const generateSessionMeetingLink = (session, user) => {
  const roomName = generateJitsiRoomName(
    session._id.toString(),
    session.therapistId._id?.toString() || session.therapistId.toString(),
    session.clientId._id?.toString() || session.clientId.toString()
  );

  const displayName = user
    ? `${user.firstName} ${user.lastName}`
    : 'Guest';

  // Determine if user is moderator (therapist)
  const isModerator = user?.role === 'therapist';

  const meetingUrl = generateJitsiMeetingUrl({
    roomName,
    displayName,
    isModerator,
    language: user?.preferredLanguage || 'en',
    enableTranslation: session.translationEnabled || false,
    targetLanguage: session.targetLanguage || 'en',
    startWithAudioMuted: false,
    startWithVideoMuted: false,
  });

  return {
    roomName,
    meetingUrl,
    meetingLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/video-call?sessionId=${session._id}`,
  };
};

/**
 * Generate meeting link with external API (for iframe embedding)
 * @param {Object} session - Session object
 * @param {Object} user - User object
 * @returns {Object} Meeting configuration
 */
const generateJitsiExternalApiConfig = (session, user) => {
  const roomName = generateJitsiRoomName(
    session._id.toString(),
    session.therapistId._id?.toString() || session.therapistId.toString(),
    session.clientId._id?.toString() || session.clientId.toString()
  );

  const displayName = user
    ? `${user.firstName} ${user.lastName}`
    : 'Guest';

  const isModerator = user?.role === 'therapist';

  return {
    roomName,
    width: '100%',
    height: '100%',
    parentNode: null, // Set in frontend
    configOverwrite: {
      prejoinPageEnabled: false,
      disableDeepLinking: true,
      startWithAudioMuted: false,
      startWithVideoMuted: false,
      defaultLanguage: user?.preferredLanguage || 'en',
      enableLayerSuspension: true,
      enableNoAudioDetection: true,
      enableNoisyMicDetection: true,
      enableTalkWhileMuted: false,
      enableClosePage: true,
      enableWelcomePage: false,
      enableDisplayNameInStats: false,
      enableEmailInStats: false,
      enableLipSync: false,
      enableRemb: true,
      enableTcc: true,
      enableOpusRed: true,
      enableH264: true,
      enableVP8: true,
      enableVP9: true,
      resolution: 720,
      'constraints.video.height.ideal': 720,
      'constraints.video.width.ideal': 1280,
      p2p: {
        enabled: true,
        useStunTurn: true,
      },
      analytics: {
        disabled: true,
      },
      disableDeepLinking: true,
      disableInviteFunctions: false,
      disableRemoteMute: true,
      disableThirdPartyRequests: true,
      enableLobbyChat: true,
      enableChat: true,
      enableFileUploads: false,
      enableRecording: false,
      transcriptionEnabled: session.translationEnabled || false,
      translationLanguages: session.translationEnabled && session.targetLanguage
        ? [session.targetLanguage]
        : [],
    },
    interfaceConfigOverwrite: {
      TOOLBAR_BUTTONS: [
        'microphone',
        'camera',
        'closedcaptions',
        'desktop',
        'fullscreen',
        'fodeviceselection',
        'hangup',
        'profile',
        'chat',
        'recording',
        'livestreaming',
        'settings',
        'raisehand',
        'videoquality',
        'filmstrip',
        'feedback',
        'stats',
        'shortcuts',
        'tileview',
        'videobackgroundblur',
        'download',
        'help',
        'mute-everyone',
        'security',
      ],
      SETTINGS_SECTIONS: [
        'devices',
        'language',
        'moderator',
        'profile',
        'calendar',
      ],
      SHOW_JITSI_WATERMARK: false,
      SHOW_WATERMARK_FOR_GUESTS: false,
      SHOW_BRAND_WATERMARK: false,
      BRAND_WATERMARK_LINK: '',
      SHOW_POWERED_BY: false,
      DISPLAY_WELCOME_PAGE: false,
      DISPLAY_WELCOME_PAGE_CONTENT: false,
      DISPLAY_WELCOME_PAGE_TOOLBAR_ADDITIONAL_CONTENT: false,
      APP_NAME: 'Rooted Voices',
      NATIVE_APP_NAME: 'Rooted Voices',
      PROVIDER_NAME: 'Rooted Voices',
      DEFAULT_BACKGROUND: '#000000',
      DEFAULT_WELCOME_PAGE_LOGO_URL: '',
      DEFAULT_LOGO_URL: '',
      HIDE_INVITE_MORE_HEADER: false,
      INITIAL_TOOLBAR_TIMEOUT: 20000,
      TOOLBAR_TIMEOUT: 4000,
      TOOLBAR_ALWAYS_VISIBLE: false,
      TOOLBAR_BUTTONS_WIDTH: 77,
      TOOLBAR_BUTTONS_HEIGHT: 25,
      MAIN_TOOLBAR_BUTTONS: [
        'microphone',
        'camera',
        'closedcaptions',
        'desktop',
        'fullscreen',
        'hangup',
      ],
    },
    userInfo: {
      displayName: displayName,
      email: user?.email || '',
    },
    jwt: null, // Add JWT if using Jitsi Meet with authentication
  };
};

module.exports = {
  generateJitsiRoomName,
  generateJitsiMeetingUrl,
  generateSessionMeetingLink,
  generateJitsiExternalApiConfig,
};

