const Session = require('../models/Session');
const Therapist = require('../models/Therapist');
const Client = require('../models/Client');
const Payment = require('../models/Payment');
const { asyncHandler } = require('../middlewares/errorHandler');
const { v4: uuidv4 } = require('uuid');
const { getCancellationFee, getRateCapsForUse } = require('./pricingController');

// @desc    Get all sessions
// @route   GET /api/sessions
// @access  Private
const getSessions = asyncHandler(async (req, res) => {
  const { status, startDate, endDate, page = 1, limit = 10 } = req.query;

  // Build filter based on user role
  const filter = {};
  
  if (req.user.role === 'therapist') {
    const therapist = await Therapist.findOne({ userId: req.user._id });
    if (therapist) {
      filter.therapistId = therapist._id;
    }
  } else if (req.user.role === 'client') {
    const client = await Client.findOne({ userId: req.user._id });
    if (client) {
      filter.clientId = client._id;
    }
  }

  if (status) {
    filter.status = status;
  }

  if (startDate || endDate) {
    filter.scheduledDate = {};
    if (startDate) filter.scheduledDate.$gte = new Date(startDate);
    if (endDate) filter.scheduledDate.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const sessions = await Session.find(filter)
    .populate('therapistId')
    .populate({
      path: 'therapistId',
      populate: { path: 'userId', select: 'firstName lastName avatar' }
    })
    .populate({
      path: 'clientId',
      populate: { path: 'userId', select: 'firstName lastName avatar' }
    })
    .sort({ scheduledDate: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Session.countDocuments(filter);

  res.json({
    success: true,
    data: {
      sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    },
  });
});

// @desc    Get upcoming sessions
// @route   GET /api/sessions/upcoming
// @access  Private
const getUpcomingSessions = asyncHandler(async (req, res) => {
  const filter = {
    status: { $in: ['scheduled', 'confirmed'] },
    scheduledDate: { $gte: new Date() },
  };

  if (req.user.role === 'therapist') {
    const therapist = await Therapist.findOne({ userId: req.user._id });
    if (therapist) filter.therapistId = therapist._id;
  } else if (req.user.role === 'client') {
    const client = await Client.findOne({ userId: req.user._id });
    if (client) filter.clientId = client._id;
  }

  const sessions = await Session.find(filter)
    .populate({
      path: 'therapistId',
      populate: { path: 'userId', select: 'firstName lastName avatar' }
    })
    .populate({
      path: 'clientId',
      populate: { path: 'userId', select: 'firstName lastName avatar' }
    })
    .sort({ scheduledDate: 1 })
    .limit(10);

  res.json({
    success: true,
    data: sessions,
  });
});

// @desc    Get session by ID
// @route   GET /api/sessions/:id
// @access  Private
const getSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id)
    .populate({
      path: 'therapistId',
      populate: { path: 'userId', select: 'firstName lastName avatar email phone' }
    })
    .populate({
      path: 'clientId',
      populate: { path: 'userId', select: 'firstName lastName avatar email phone' }
    });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }

  res.json({
    success: true,
    data: session,
  });
});

// @desc    Create new session
// @route   POST /api/sessions
// @access  Private
const createSession = asyncHandler(async (req, res) => {
  const { clientId, therapistId, scheduledDate, scheduledTime, duration, sessionType, price } = req.body;

  console.log('=== CREATE SESSION REQUEST ===');
  console.log('Body:', req.body);
  console.log('clientId:', clientId, 'type:', typeof clientId);
  console.log('therapistId:', therapistId, 'type:', typeof therapistId);
  console.log('scheduledDate:', scheduledDate, 'type:', typeof scheduledDate);
  console.log('scheduledTime:', scheduledTime, 'type:', typeof scheduledTime);

  // Validate required fields
  if (!clientId || !therapistId || !scheduledDate || !scheduledTime) {
    const missing = [];
    if (!clientId) missing.push('clientId');
    if (!therapistId) missing.push('therapistId');
    if (!scheduledDate) missing.push('scheduledDate');
    if (!scheduledTime) missing.push('scheduledTime');
    
    console.log('Missing fields:', missing);
    return res.status(400).json({
      success: false,
      message: `Missing required fields: ${missing.join(', ')}`,
    });
  }

  // Validate ObjectId format
  const mongoose = require('mongoose');
  if (!mongoose.Types.ObjectId.isValid(therapistId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid therapistId format',
    });
  }

  if (!mongoose.Types.ObjectId.isValid(clientId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid clientId format',
    });
  }

  // Verify therapist and client exist
  const therapist = await Therapist.findById(therapistId);
  const client = await Client.findById(clientId);

  if (!therapist) {
    return res.status(404).json({
      success: false,
      message: 'Therapist not found',
    });
  }

  // Check if therapist is active (can provide services)
  if (therapist.status !== 'active') {
    return res.status(403).json({
      success: false,
      message: `Therapist is ${therapist.status} and cannot provide services. Please contact support.`,
    });
  }

  if (!client) {
    return res.status(404).json({
      success: false,
      message: 'Client not found',
    });
  }

  // Validate date format
  const sessionDate = new Date(scheduledDate);
  if (isNaN(sessionDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid scheduledDate format. Expected ISO date string (YYYY-MM-DD)',
    });
  }

  // Calculate session price
  let sessionPrice = price;
  if (sessionType === 'initial') {
    sessionPrice = 0; // Initial consultations are free
  } else if (!sessionPrice && therapist.hourlyRate) {
    sessionPrice = therapist.hourlyRate;
  } else if (!sessionPrice) {
    sessionPrice = 85; // Default price
  }

  // Get rate caps and ALWAYS enforce them (even if price comes from therapist.hourlyRate)
  const rateCaps = getRateCapsForUse();
  const maxRate = rateCaps[therapist.credentials] || rateCaps.SLP;

  // Validate and cap price against rate caps (only if not initial/free)
  if (sessionPrice > 0) {
    if (sessionPrice > maxRate) {
      // Instead of rejecting, cap the price to the maximum allowed
      console.warn(`Session price ${sessionPrice} exceeds max rate ${maxRate} for ${therapist.credentials}. Capping to ${maxRate}.`);
      sessionPrice = maxRate;
    }
  }

  // Auto-assign therapist to client if not already assigned
  if (!client.assignedTherapist) {
    client.assignedTherapist = therapistId;
    await client.save();
    console.log(`Auto-assigned therapist ${therapistId} to client ${clientId}`);
  }

  // Get user data for calendar integration
  const User = require('../models/User');
  const therapistUser = await User.findById(therapist.userId);
  const clientUser = await User.findById(client.userId);

  // Create session
  const session = await Session.create({
    therapistId,
    clientId,
    scheduledDate: sessionDate,
    scheduledTime,
    duration: duration || 45,
    sessionType: sessionType || 'follow-up',
    price: sessionPrice,
    status: 'scheduled',
  });

  // Generate Jitsi meeting link with actual session ID
  const { generateJitsiRoomName } = require('../utils/jitsiService');
  const finalRoomName = generateJitsiRoomName(
    session._id.toString(),
    therapistId.toString(),
    clientId.toString()
  );
  session.meetingLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/video-call?sessionId=${session._id}`;
  session.jitsiRoomName = finalRoomName;
  await session.save();

  const populatedSession = await Session.findById(session._id)
    .populate({
      path: 'therapistId',
      populate: { path: 'userId', select: 'firstName lastName avatar' }
    })
    .populate({
      path: 'clientId',
      populate: { path: 'userId', select: 'firstName lastName avatar' }
    });

  // Get remaining sessions for client (if client is booking)
  let remainingSessions = null;
  if (req.user.role === 'client') {
    try {
      const Subscription = require('../models/Subscription');
      const subscription = await Subscription.findOne({
        userId: req.user._id,
        status: 'active',
      }).sort({ createdAt: -1 });

      if (subscription) {
        // Calculate billing period
        const now = new Date();
        let periodStart, periodEnd;
        
        if (subscription.startDate) {
          if (subscription.billingCycle === 'every-4-weeks') {
            const weeksSinceStart = Math.floor((now - subscription.startDate) / (7 * 24 * 60 * 60 * 1000));
            const periodNumber = Math.floor(weeksSinceStart / 4);
            periodStart = new Date(subscription.startDate);
            periodStart.setDate(periodStart.getDate() + (periodNumber * 28));
            periodEnd = new Date(periodStart);
            periodEnd.setDate(periodEnd.getDate() + 28);
          } else if (subscription.billingCycle === 'monthly') {
            periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
            periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          } else {
            periodStart = subscription.startDate;
            periodEnd = subscription.nextBillingDate || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          }
        } else {
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        }

        // Count sessions used in current period (including the one just created)
        const usedSessions = await Session.countDocuments({
          clientId: client._id,
          scheduledDate: {
            $gte: periodStart,
            $lte: periodEnd,
          },
          status: {
            $in: ['scheduled', 'confirmed', 'in-progress', 'completed'],
          },
        });

        const totalSessions = subscription.sessionsPerMonth || 0;
        const hasUnlimited = totalSessions === 0 || totalSessions === -1;
        const remaining = hasUnlimited ? -1 : Math.max(0, totalSessions - usedSessions);

        remainingSessions = {
          totalSessions,
          usedSessions,
          remainingSessions: remaining,
          hasUnlimited,
        };
      }
    } catch (error) {
      console.error('Error calculating remaining sessions:', error);
      // Don't fail session creation if this fails
    }
  }

  // Create internal calendar events automatically for both therapist and client
  const createCalendarEventsAsync = async () => {
    try {
      const {
        createCalendarEventFromSession,
      } = require('../utils/internalCalendarService');

      // Create calendar event for therapist
      await createCalendarEventFromSession(session, therapistUser._id);

      // Create calendar event for client
      await createCalendarEventFromSession(session, clientUser._id);

      console.log(`✅ Calendar events created for session ${session._id}`);
    } catch (error) {
      console.error('Error creating calendar events:', error);
      // Don't fail session creation if calendar event creation fails
    }
  };

  // Start async calendar event creation (don't await)
  createCalendarEventsAsync();

  res.status(201).json({
    success: true,
    message: 'Session created successfully',
    data: populatedSession,
    ...(remainingSessions && { remainingSessions }),
  });
});

// @desc    Update session
// @route   PUT /api/sessions/:id
// @access  Private
const updateSession = asyncHandler(async (req, res) => {
  let session = await Session.findById(req.params.id);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }

  session = await Session.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  )
    .populate({
      path: 'therapistId',
      populate: { path: 'userId', select: 'firstName lastName avatar' }
    })
    .populate({
      path: 'clientId',
      populate: { path: 'userId', select: 'firstName lastName avatar' }
    });

  // Update calendar events when session changes
  const updateCalendarEventsAsync = async () => {
    try {
      const { updateCalendarEventFromSession } = require('../utils/internalCalendarService');
      await updateCalendarEventFromSession(session);
      console.log(`✅ Calendar events updated for session ${session._id}`);
    } catch (error) {
      console.error('Error updating calendar events:', error);
    }
  };

  // Start async calendar event update (don't await)
  updateCalendarEventsAsync();

  res.json({
    success: true,
    message: 'Session updated successfully',
    data: session,
  });
});

// @desc    Cancel session
// @route   DELETE /api/sessions/:id
// @access  Private
const cancelSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id)
    .populate('therapistId', 'credentials userId');

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }

  const { reason, loggedByTherapist } = req.body;

  session.status = 'cancelled';
  session.cancellationReason = reason;
  session.cancelledAt = new Date();
  session.cancelledBy = req.user._id;

  // Handle cancellation fee by credential type
  // If patient cancels AND therapist logs it, they get flat rate based on credentials
  const therapist = session.therapistId;
  const credentialType = therapist.credentials || 'SLPA';
  const isTherapistLogging = req.user.role === 'therapist' && loggedByTherapist === true;

  if (isTherapistLogging && ['SLP', 'SLPA'].includes(credentialType)) {
    // Therapist logged the cancellation - create payment record for cancellation fee
    const cancellationFee = getCancellationFee(credentialType);
    
    // Update session price to cancellation fee
    session.price = cancellationFee;
    session.paymentStatus = 'pending'; // Will be processed separately

    // Create payment record for cancellation fee
    await Payment.create({
      sessionId: session._id,
      clientId: session.clientId,
      therapistId: session.therapistId._id,
      amount: cancellationFee * 100, // Convert to cents
      currency: 'USD',
      paymentMethod: 'other',
      status: 'pending',
      metadata: {
        type: 'cancellation_fee',
        credentialType: credentialType,
        reason: reason || `Patient cancellation - ${credentialType} logged`,
      },
    });
  }

  await session.save();

  // Update calendar events to cancelled status
  const updateCalendarEventsAsync = async () => {
    try {
      const { updateCalendarEventFromSession } = require('../utils/internalCalendarService');
      await updateCalendarEventFromSession(session);
      console.log(`✅ Calendar events updated to cancelled for session ${session._id}`);
    } catch (error) {
      console.error('Error updating calendar events:', error);
    }
  };

  updateCalendarEventsAsync();

  res.json({
    success: true,
    message: 'Session cancelled successfully',
    data: session,
    ...(isTherapistLogging && ['SLP', 'SLPA'].includes(credentialType) && {
      cancellationFee: getCancellationFee(credentialType),
      message: `Session cancelled. ${credentialType} cancellation fee of $${getCancellationFee(credentialType)} will be processed.`,
    }),
  });
});

// @desc    Start session (generate meeting link)
// @route   POST /api/sessions/:id/start
// @access  Private
const startSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id)
    .populate('therapistId', 'userId')
    .populate({
      path: 'therapistId',
      populate: { path: 'userId', select: 'firstName lastName avatar preferredLanguage' }
    })
    .populate('clientId', 'userId')
    .populate({
      path: 'clientId',
      populate: { path: 'userId', select: 'firstName lastName avatar preferredLanguage' }
    });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }

  // Generate improved Jitsi meeting link if not already generated
  if (!session.jitsiRoomName || !session.meetingLink) {
    const { generateSessionMeetingLink } = require('../utils/jitsiService');
    const user = req.user;
    const meetingInfo = generateSessionMeetingLink(session, user);
    
    session.meetingLink = meetingInfo.meetingLink;
    session.jitsiRoomName = meetingInfo.roomName;
  }

  session.status = 'in-progress';
  session.actualStartTime = new Date();

  await session.save();

  res.json({
    success: true,
    message: 'Session started',
    data: session,
  });
});

// @desc    Complete session
// @route   POST /api/sessions/:id/complete
// @access  Private (Therapist)
const completeSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id)
    .populate('therapistId', 'credentials')
    .populate('clientId', 'userId');

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }

  session.status = 'completed';
  session.actualEndTime = new Date();
  
  if (req.body.notes) {
    session.notes = req.body.notes;
  }

  await session.save();

  // Update therapist session count
  await Therapist.findByIdAndUpdate(session.therapistId, {
    $inc: { totalSessions: 1 }
  });

  // NOTE: Goals and progress are NEVER auto-generated after session completion
  // Goals must be created by therapist AFTER diagnostic evaluation
  // Progress is updated manually by therapist based on clinical assessment

  // Auto-generate SOAP note using AI (async, don't block response)
  const generateSoapNoteAsync = async () => {
    try {
      const { generateSoapNote } = require('../utils/aiSoapNoteService');
      const Client = require('../models/Client');
      
      const client = await Client.findById(session.clientId)
        .populate('userId', 'firstName lastName');

      const clientInfo = {
        age: client?.age || null,
        goals: client?.currentDiagnoses || [],
      };

      const soapResult = await generateSoapNote({
        notes: session.notes || '',
        transcript: session.transcript || null,
        sessionType: session.sessionType,
        duration: session.duration,
        clientInfo,
        therapistInfo: {
          credentials: session.therapistId?.credentials,
        },
      });

      if (soapResult.success) {
        const updatedSession = await Session.findById(session._id);
        updatedSession.soapNote = soapResult.soapNote;
        await updatedSession.save();
        console.log(`AI SOAP note generated for session ${session._id}`);
      }
    } catch (error) {
      console.error('Error generating AI SOAP note:', error);
      // Don't fail the session completion if SOAP note generation fails
    }
  };

  // Start async SOAP note generation (don't await)
  generateSoapNoteAsync();

  // Payment will be processed separately via /api/stripe/process-session-payment
  // or automatically when client confirms payment

  res.json({
    success: true,
    message: 'Session completed. Payment processing required. SOAP note generation in progress.',
    data: session,
    requiresPayment: true,
    soapNoteGenerating: true,
  });
});

// @desc    Save SOAP note
// @route   POST /api/sessions/:id/soap-note
// @access  Private (Therapist)
// @desc    Save session transcript
// @route   POST /api/sessions/:id/transcript
// @access  Private
const saveTranscript = asyncHandler(async (req, res) => {
  const { text, originalLanguage, translatedText } = req.body;
  const session = await Session.findById(req.params.id);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }

  // Get client's preferred language for automatic translation
  const Client = require('../models/Client');
  const client = await Client.findById(session.clientId).populate('userId');
  const clientPreferredLanguage = client?.preferences?.preferredLanguage || 'en';

  // Auto-translate transcript to client's preferred language if different
  let autoTranslatedText = new Map();
  if (originalLanguage !== clientPreferredLanguage && text) {
    try {
      const { generateTranslatedTranscript } = require('../utils/geminiService');
      const translated = await generateTranslatedTranscript(text, originalLanguage || 'en', clientPreferredLanguage);
      autoTranslatedText.set(clientPreferredLanguage, translated);
    } catch (error) {
      console.error('Auto-translation error:', error);
    }
  }

  // Merge with provided translations
  if (translatedText && typeof translatedText === 'object') {
    Object.entries(translatedText).forEach(([lang, trans]) => {
      autoTranslatedText.set(lang, trans);
    });
  }

  // Save transcript
  session.transcript = {
    originalLanguage: originalLanguage || 'en',
    text: text,
    translatedText: autoTranslatedText,
    createdAt: new Date(),
  };

  await session.save();

  res.json({
    success: true,
    message: 'Transcript saved successfully',
    data: session.transcript,
  });
});

// @desc    Get translated transcript
// @route   GET /api/sessions/:id/transcript/:language
// @access  Private
const getTranscriptTranslation = asyncHandler(async (req, res) => {
  const { id, language } = req.params;
  const session = await Session.findById(id);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }

  if (!session.transcript || !session.transcript.text) {
    return res.status(404).json({
      success: false,
      message: 'Transcript not found for this session',
    });
  }

  // If requesting original language, return original text
  if (language === session.transcript.originalLanguage) {
    return res.json({
      success: true,
      data: {
        text: session.transcript.text,
        language: session.transcript.originalLanguage,
        isOriginal: true,
      },
    });
  }

  // Check if translation already exists
  const translatedText = session.transcript.translatedText?.get?.(language);
  if (translatedText) {
    return res.json({
      success: true,
      data: {
        text: translatedText,
        language: language,
        isOriginal: false,
      },
    });
  }

  // Translate on-the-fly if not cached
  const { translateText } = require('../utils/translationService');
  const translated = await translateText(
    session.transcript.text,
    session.transcript.originalLanguage,
    language
  );

  // Save translation to session
  if (!session.transcript.translatedText) {
    session.transcript.translatedText = new Map();
  }
  session.transcript.translatedText.set(language, translated);
  await session.save();

  res.json({
    success: true,
    data: {
      text: translated,
      language: language,
      isOriginal: false,
    },
  });
});

const saveSoapNote = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }

  const { subjective, objective, assessment, plan } = req.body;

  session.soapNote = {
    subjective,
    objective,
    assessment,
    plan,
    generatedAt: new Date(),
    aiGenerated: false,
  };

  await session.save();

  res.json({
    success: true,
    message: 'SOAP note saved successfully',
    data: session,
  });
});

module.exports = {
  getSessions,
  getUpcomingSessions,
  getSession,
  createSession,
  updateSession,
  cancelSession,
  startSession,
  completeSession,
  saveSoapNote,
  saveTranscript,
  getTranscriptTranslation,
};

