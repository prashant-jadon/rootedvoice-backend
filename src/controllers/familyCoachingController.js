const FamilyCoachingSession = require('../models/FamilyCoachingSession');
const Client = require('../models/Client');
const Therapist = require('../models/Therapist');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { asyncHandler } = require('../middlewares/errorHandler');
const { generateJitsiRoomName } = require('../utils/jitsiService');
const { createCalendarEventFromSession } = require('../utils/internalCalendarService');

// @desc    Get all family coaching sessions for a user
// @route   GET /api/family-coaching
// @access  Private
const getFamilyCoachingSessions = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { status, startDate, endDate } = req.query;

  let filter = {};

  if (req.user.role === 'client') {
    const client = await Client.findOne({ userId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found',
      });
    }
    filter.clientId = client._id;
  } else if (req.user.role === 'therapist') {
    const therapist = await Therapist.findOne({ userId });
    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: 'Therapist profile not found',
      });
    }
    filter.therapistId = therapist._id;
  } else {
    return res.status(403).json({
      success: false,
      message: 'Only clients and therapists can access family coaching sessions',
    });
  }

  if (status) {
    filter.status = status;
  }

  if (startDate || endDate) {
    filter.scheduledDate = {};
    if (startDate) {
      filter.scheduledDate.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.scheduledDate.$lte = new Date(endDate);
    }
  }

  const sessions = await FamilyCoachingSession.find(filter)
    .populate({
      path: 'clientId',
      populate: { path: 'userId', select: 'firstName lastName email phone' }
    })
    .populate({
      path: 'therapistId',
      populate: { path: 'userId', select: 'firstName lastName email phone' }
    })
    .populate('cancelledBy', 'firstName lastName')
    .sort({ scheduledDate: -1 });

  res.json({
    success: true,
    data: sessions,
  });
});

// @desc    Get a single family coaching session
// @route   GET /api/family-coaching/:id
// @access  Private
const getFamilyCoachingSession = asyncHandler(async (req, res) => {
  const session = await FamilyCoachingSession.findById(req.params.id)
    .populate({
      path: 'clientId',
      populate: { path: 'userId', select: 'firstName lastName email phone' }
    })
    .populate({
      path: 'therapistId',
      populate: { path: 'userId', select: 'firstName lastName email phone' }
    })
    .populate('cancelledBy', 'firstName lastName');

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Family coaching session not found',
    });
  }

  // Verify access
  const userId = req.user._id;
  if (req.user.role === 'client') {
    const client = await Client.findOne({ userId });
    if (client && client._id.toString() !== session.clientId._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this session',
      });
    }
  } else if (req.user.role === 'therapist') {
    const therapist = await Therapist.findOne({ userId });
    if (therapist && therapist._id.toString() !== session.therapistId._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this session',
      });
    }
  }

  res.json({
    success: true,
    data: session,
  });
});

// @desc    Create a new family coaching session
// @route   POST /api/family-coaching
// @access  Private
const createFamilyCoachingSession = asyncHandler(async (req, res) => {
  const { clientId, scheduledDate, scheduledTime, duration, sessionType, participants, topics, goals, notes } = req.body;
  const userId = req.user._id;

  // Verify user has Flourish tier subscription
  const subscription = await Subscription.findOne({
    userId,
    status: 'active',
    tier: 'flourish',
  });

  if (!subscription) {
    return res.status(403).json({
      success: false,
      message: 'Family coaching sessions are only available for Flourish tier subscribers. Please upgrade your subscription.',
    });
  }

  // Get therapist (use assigned therapist or allow selection)
  let therapist;
  if (req.user.role === 'client') {
    const client = await Client.findById(clientId).populate('assignedTherapist');
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    if (client.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create sessions for this client',
      });
    }

    if (!client.assignedTherapist) {
      return res.status(400).json({
        success: false,
        message: 'No therapist assigned to this client',
      });
    }

    therapist = client.assignedTherapist;
  } else if (req.user.role === 'therapist') {
    therapist = await Therapist.findOne({ userId });
    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: 'Therapist profile not found',
      });
    }

    // Verify client exists and is assigned to this therapist
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    if (client.assignedTherapist && client.assignedTherapist.toString() !== therapist._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Client is not assigned to you',
      });
    }
  } else {
    return res.status(403).json({
      success: false,
      message: 'Only clients and therapists can create family coaching sessions',
    });
  }

  // Validate date
  const sessionDate = new Date(scheduledDate);
  if (isNaN(sessionDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid scheduledDate format',
    });
  }

  // Generate Jitsi room name
  const jitsiRoomName = generateJitsiRoomName();
  const meetingLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/video-call?sessionId=coaching-${jitsiRoomName}`;

  // Create session
  const session = await FamilyCoachingSession.create({
    clientId,
    therapistId: therapist._id,
    scheduledDate: sessionDate,
    scheduledTime: scheduledTime || '10:00 AM',
    duration: duration || 60,
    sessionType: sessionType || 'family-coaching',
    participants: participants || [],
    topics: topics || [],
    goals: goals || '',
    notes: notes || '',
    status: 'scheduled',
    meetingLink,
    jitsiRoomName,
    price: 0, // Included in subscription
    paymentStatus: 'included',
  });

  const populatedSession = await FamilyCoachingSession.findById(session._id)
    .populate({
      path: 'clientId',
      populate: { path: 'userId', select: 'firstName lastName email phone' }
    })
    .populate({
      path: 'therapistId',
      populate: { path: 'userId', select: 'firstName lastName email phone' }
    });

  // Create calendar events
  const therapistUser = await User.findById(therapist.userId);
  const clientUser = await User.findById((await Client.findById(clientId)).userId);
  
  // Create calendar events for both therapist and client
  // Note: createCalendarEventFromSession expects a Session model, but we can adapt it
  // For now, we'll create calendar events manually for family coaching
  const CalendarEvent = require('../models/CalendarEvent');
  const sessionStart = new Date(scheduledDate);
  const [hours, minutes] = (scheduledTime || '10:00 AM').replace(/[APM]/gi, '').split(':').map(Number);
  const isPM = (scheduledTime || '10:00 AM').toUpperCase().includes('PM');
  sessionStart.setHours(isPM && hours !== 12 ? hours + 12 : hours === 12 && !isPM ? 0 : hours, minutes || 0, 0, 0);
  const sessionEnd = new Date(sessionStart);
  sessionEnd.setMinutes(sessionEnd.getMinutes() + (duration || 60));

  const clientName = populatedSession.clientId?.userId 
    ? `${populatedSession.clientId.userId.firstName} ${populatedSession.clientId.userId.lastName}`
    : 'Client';
  const therapistName = populatedSession.therapistId?.userId
    ? `${populatedSession.therapistId.userId.firstName} ${populatedSession.therapistId.userId.lastName}`
    : 'Therapist';

  // Create event for therapist
  await CalendarEvent.create({
    userId: therapistUser._id,
    sessionId: session._id,
    title: `${sessionType === 'family-coaching' ? 'Family Coaching' : sessionType === 'caregiver-training' ? 'Caregiver Training' : 'Support Session'} - ${clientName}`,
    description: `Family coaching session with ${clientName}`,
    startDate: sessionStart,
    endDate: sessionEnd,
    location: 'Online',
    meetingLink: meetingLink,
    status: 'scheduled',
  });

  // Create event for client
  await CalendarEvent.create({
    userId: clientUser._id,
    sessionId: session._id,
    title: `${sessionType === 'family-coaching' ? 'Family Coaching' : sessionType === 'caregiver-training' ? 'Caregiver Training' : 'Support Session'} - ${therapistName}`,
    description: `Family coaching session with ${therapistName}`,
    startDate: sessionStart,
    endDate: sessionEnd,
    location: 'Online',
    meetingLink: meetingLink,
    status: 'scheduled',
  });

  res.status(201).json({
    success: true,
    message: 'Family coaching session created successfully',
    data: populatedSession,
  });
});

// @desc    Update a family coaching session
// @route   PUT /api/family-coaching/:id
// @access  Private
const updateFamilyCoachingSession = asyncHandler(async (req, res) => {
  const session = await FamilyCoachingSession.findById(req.params.id);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Family coaching session not found',
    });
  }

  // Verify authorization
  const userId = req.user._id;
  if (req.user.role === 'client') {
    const client = await Client.findOne({ userId });
    if (client && client._id.toString() !== session.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this session',
      });
    }
  } else if (req.user.role === 'therapist') {
    const therapist = await Therapist.findOne({ userId });
    if (therapist && therapist._id.toString() !== session.therapistId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this session',
      });
    }
  }

  // Update allowed fields
  const allowedFields = ['scheduledDate', 'scheduledTime', 'duration', 'sessionType', 'participants', 'topics', 'goals', 'notes', 'status', 'outcomes'];
  const updates = {};
  
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  // Handle date update
  if (updates.scheduledDate) {
    updates.scheduledDate = new Date(updates.scheduledDate);
  }

  // Update session
  Object.assign(session, updates);
  await session.save();

  const updatedSession = await FamilyCoachingSession.findById(session._id)
    .populate({
      path: 'clientId',
      populate: { path: 'userId', select: 'firstName lastName email phone' }
    })
    .populate({
      path: 'therapistId',
      populate: { path: 'userId', select: 'firstName lastName email phone' }
    });

  res.json({
    success: true,
    message: 'Family coaching session updated successfully',
    data: updatedSession,
  });
});

// @desc    Cancel a family coaching session
// @route   DELETE /api/family-coaching/:id
// @access  Private
const cancelFamilyCoachingSession = asyncHandler(async (req, res) => {
  const { cancellationReason } = req.body;
  const session = await FamilyCoachingSession.findById(req.params.id);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Family coaching session not found',
    });
  }

  if (session.status === 'cancelled' || session.status === 'completed') {
    return res.status(400).json({
      success: false,
      message: `Session is already ${session.status}`,
    });
  }

  // Verify authorization
  const userId = req.user._id;
  if (req.user.role === 'client') {
    const client = await Client.findOne({ userId });
    if (client && client._id.toString() !== session.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this session',
      });
    }
  } else if (req.user.role === 'therapist') {
    const therapist = await Therapist.findOne({ userId });
    if (therapist && therapist._id.toString() !== session.therapistId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this session',
      });
    }
  }

  session.status = 'cancelled';
  session.cancelledAt = new Date();
  session.cancelledBy = userId;
  session.cancellationReason = cancellationReason || 'Cancelled by user';

  await session.save();

  res.json({
    success: true,
    message: 'Family coaching session cancelled successfully',
    data: session,
  });
});

module.exports = {
  getFamilyCoachingSessions,
  getFamilyCoachingSession,
  createFamilyCoachingSession,
  updateFamilyCoachingSession,
  cancelFamilyCoachingSession,
};

