const User = require('../models/User');
const Therapist = require('../models/Therapist');
const Client = require('../models/Client');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const Session = require('../models/Session');
const AdminActionLog = require('../models/AdminActionLog');
const { asyncHandler } = require('../middlewares/errorHandler');
const { logAdminAction, getClientIp, getUserAgent } = require('../utils/adminLogger');

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = asyncHandler(async (req, res) => {
  const { role, search, page = 1, limit = 50 } = req.query;
  
  const query = {};
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { email: { $regex: search, $options: 'i' } },
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const users = await User.find(query)
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await User.countDocuments(query);

  res.json({
    success: true,
    data: users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// @desc    Get all therapists
// @route   GET /api/admin/therapists
// @access  Private/Admin
const getAllTherapists = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  
  const query = {};
  if (search) {
    query.$or = [
      { 'userId.email': { $regex: search, $options: 'i' } },
      { 'userId.firstName': { $regex: search, $options: 'i' } },
      { 'userId.lastName': { $regex: search, $options: 'i' } },
      { specialization: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const therapists = await Therapist.find(query)
    .populate('userId', 'email firstName lastName phone avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Therapist.countDocuments(query);

  res.json({
    success: true,
    data: therapists,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// @desc    Get all clients
// @route   GET /api/admin/clients
// @access  Private/Admin
const getAllClients = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  
  const query = {};
  if (search) {
    query.$or = [
      { 'userId.email': { $regex: search, $options: 'i' } },
      { 'userId.firstName': { $regex: search, $options: 'i' } },
      { 'userId.lastName': { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const clients = await Client.find(query)
    .populate('userId', 'email firstName lastName phone avatar')
    .populate({
      path: 'assignedTherapist',
      populate: {
        path: 'userId',
        select: 'firstName lastName email'
      },
      select: 'userId specialization'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Client.countDocuments(query);

  res.json({
    success: true,
    data: clients,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// @desc    Get client by ID (admin)
// @route   GET /api/admin/clients/:id
// @access  Private/Admin
const getClientById = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id)
    .populate('userId', 'email firstName lastName phone avatar')
    .populate({
      path: 'assignedTherapist',
      populate: {
        path: 'userId',
        select: 'firstName lastName email'
      },
      select: 'userId specialization credentials'
    });

  if (!client) {
    return res.status(404).json({
      success: false,
      message: 'Client not found',
    });
  }

  res.json({
    success: true,
    data: client,
  });
});

// @desc    Get all payments
// @route   GET /api/admin/payments
// @access  Private/Admin
const getAllPayments = asyncHandler(async (req, res) => {
  const { status, startDate, endDate, page = 1, limit = 50 } = req.query;
  
  const query = {};
  if (status) query.status = status;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const payments = await Payment.find(query)
    .populate('clientId', 'userId')
    .populate('therapistId', 'userId')
    .populate('sessionId', 'date time duration')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Payment.countDocuments(query);

  // Calculate totals
  const totalAmount = await Payment.aggregate([
    { $match: query },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  res.json({
    success: true,
    data: payments,
    totals: {
      totalAmount: totalAmount[0]?.total || 0,
      totalCount: total,
    },
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
const getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalTherapists,
    totalClients,
    totalSessions,
    totalPayments,
    activeSubscriptions,
    totalRevenue,
    monthlyRevenue,
  ] = await Promise.all([
    User.countDocuments(),
    Therapist.countDocuments(),
    Client.countDocuments(),
    Session.countDocuments(),
    Payment.countDocuments({ status: 'completed' }),
    Subscription.countDocuments({ status: 'active' }),
    Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        therapists: totalTherapists,
        clients: totalClients,
      },
      sessions: {
        total: totalSessions,
      },
      subscriptions: {
        active: activeSubscriptions,
      },
      payments: {
        total: totalPayments,
        revenue: {
          allTime: totalRevenue[0]?.total || 0,
          thisMonth: monthlyRevenue[0]?.total || 0,
        },
      },
    },
  });
});

// @desc    Get all sessions
// @route   GET /api/admin/sessions
// @access  Private/Admin
const getAllSessions = asyncHandler(async (req, res) => {
  const { status, startDate, endDate, therapistId, clientId, page = 1, limit = 50 } = req.query;
  
  const query = {};
  if (status) query.status = status;
  if (therapistId) query.therapistId = therapistId;
  if (clientId) query.clientId = clientId;
  if (startDate || endDate) {
    query.scheduledDate = {};
    if (startDate) query.scheduledDate.$gte = new Date(startDate);
    if (endDate) query.scheduledDate.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const sessions = await Session.find(query)
    .populate('therapistId', 'userId')
    .populate('clientId', 'userId')
    .sort({ scheduledDate: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Session.countDocuments(query);

  res.json({
    success: true,
    data: sessions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// @desc    Get reports/analytics
// @route   GET /api/admin/reports
// @access  Private/Admin
const getReports = asyncHandler(async (req, res) => {
  const { range = 'month' } = req.query;
  
  let startDate, endDate;
  const now = new Date();
  
  switch (range) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = now;
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = now;
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
  }

  const [
    sessionsCount,
    completedSessions,
    revenue,
    newUsers,
    newTherapists,
    newClients,
    paymentsCount,
  ] = await Promise.all([
    Session.countDocuments({
      scheduledDate: { $gte: startDate, $lte: endDate },
    }),
    Session.countDocuments({
      scheduledDate: { $gte: startDate, $lte: endDate },
      status: 'completed',
    }),
    Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    User.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    }),
    Therapist.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    }),
    Client.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    }),
    Payment.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'completed',
    }),
  ]);

  // Get revenue by day for the period
  const revenueByDay = await Payment.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({
    success: true,
    data: {
      range,
      period: {
        startDate,
        endDate,
      },
      sessions: {
        total: sessionsCount,
        completed: completedSessions,
        completionRate: sessionsCount > 0 ? (completedSessions / sessionsCount * 100).toFixed(2) : 0,
      },
      revenue: {
        total: revenue[0]?.total || 0,
        payments: paymentsCount,
        byDay: revenueByDay,
      },
      users: {
        total: newUsers,
        therapists: newTherapists,
        clients: newClients,
      },
    },
  });
});

// @desc    Get admin settings
// @route   GET /api/admin/settings
// @access  Private/Admin
const getSettings = asyncHandler(async (req, res) => {
  // For now, return basic settings
  // In the future, you might want to store settings in a database
  res.json({
    success: true,
    data: {
      platform: {
        name: 'Rooted Voices',
        version: '1.0.0',
      },
      features: {
        payments: true,
        subscriptions: true,
        videoCalls: true,
        translations: true,
      },
      limits: {
        maxFileSize: process.env.MAX_FILE_SIZE || 10485760,
        rateLimitWindow: process.env.RATE_LIMIT_WINDOW || 15,
        rateLimitMax: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
      },
    },
  });
});

// @desc    Update admin settings
// @route   PUT /api/admin/settings
// @access  Private/Admin
const updateSettings = asyncHandler(async (req, res) => {
  // For now, just return success
  // In the future, you might want to store settings in a database
  res.json({
    success: true,
    message: 'Settings updated successfully',
    data: req.body,
  });
});

// @desc    Update therapist credentials (SLP/SLPA)
// @route   PUT /api/admin/therapists/:id/credentials
// @access  Private/Admin
const updateTherapistCredentials = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { credentials } = req.body;

  if (!credentials || !['SLP', 'SLPA'].includes(credentials)) {
    return res.status(400).json({
      success: false,
      message: 'Credentials must be either "SLP" or "SLPA"',
    });
  }

  const therapist = await Therapist.findById(id);
  
  if (!therapist) {
    return res.status(404).json({
      success: false,
      message: 'Therapist not found',
    });
  }

  // Check if hourly rate needs to be adjusted based on new credentials
  const { getRateCapsForUse } = require('./pricingController');
  const rateCaps = getRateCapsForUse();
  const maxRate = rateCaps[credentials] || rateCaps.SLP;

  // If current rate exceeds new credential's max rate, cap it
  if (therapist.hourlyRate > maxRate) {
    therapist.hourlyRate = maxRate;
  }

  const oldCredentials = therapist.credentials;
  therapist.credentials = credentials;
  await therapist.save();

  // Log the action
  const therapistName = therapist.userId 
    ? `${therapist.userId.firstName} ${therapist.userId.lastName}`
    : 'Unknown';

  await logAdminAction({
    adminId: req.user._id,
    action: 'therapist_credentials_updated',
    targetType: 'therapist',
    targetId: id,
    targetName: therapistName,
    details: {
      oldCredentials,
      newCredentials: credentials,
    },
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  const updatedTherapist = await Therapist.findById(id)
    .populate('userId', 'firstName lastName email avatar phone');

  res.json({
    success: true,
    message: `Therapist credentials updated to ${credentials}`,
    data: updatedTherapist,
  });
});

// @desc    Bulk update therapist credentials
// @route   PUT /api/admin/therapists/credentials/bulk
// @access  Private/Admin
const bulkUpdateTherapistCredentials = asyncHandler(async (req, res) => {
  const { therapistIds, credentials } = req.body;

  if (!therapistIds || !Array.isArray(therapistIds) || therapistIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'therapistIds must be a non-empty array',
    });
  }

  if (!credentials || !['SLP', 'SLPA'].includes(credentials)) {
    return res.status(400).json({
      success: false,
      message: 'Credentials must be either "SLP" or "SLPA"',
    });
  }

  const { getRateCapsForUse } = require('./pricingController');
  const rateCaps = getRateCapsForUse();
  const maxRate = rateCaps[credentials] || rateCaps.SLP;

  const updateResults = await Promise.all(
    therapistIds.map(async (therapistId) => {
      try {
        const therapist = await Therapist.findById(therapistId);
        if (!therapist) {
          return { therapistId, success: false, message: 'Therapist not found' };
        }

        // Adjust hourly rate if needed
        if (therapist.hourlyRate > maxRate) {
          therapist.hourlyRate = maxRate;
        }

        therapist.credentials = credentials;
        await therapist.save();

        return { therapistId, success: true, message: 'Updated successfully' };
      } catch (error) {
        return { therapistId, success: false, message: error.message };
      }
    })
  );

  const successCount = updateResults.filter(r => r.success).length;
  const failCount = updateResults.filter(r => !r.success).length;

  res.json({
    success: true,
    message: `Updated ${successCount} therapist(s), ${failCount} failed`,
    data: {
      total: therapistIds.length,
      successful: successCount,
      failed: failCount,
      results: updateResults,
    },
  });
});

// @desc    Get therapist earnings and hours
// @route   GET /api/admin/therapists/:id/earnings
// @access  Private/Admin
const getTherapistEarnings = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  const therapist = await Therapist.findById(id);
  if (!therapist) {
    return res.status(404).json({
      success: false,
      message: 'Therapist not found',
    });
  }

  // Build date filter for sessions (use scheduledDate)
  const sessionDateFilter = {};
  if (startDate || endDate) {
    sessionDateFilter.scheduledDate = {};
    if (startDate) sessionDateFilter.scheduledDate.$gte = new Date(startDate);
    if (endDate) sessionDateFilter.scheduledDate.$lte = new Date(endDate);
  }

  // Build date filter for payments (use createdAt)
  const paymentDateFilter = {};
  if (startDate || endDate) {
    paymentDateFilter.createdAt = {};
    if (startDate) paymentDateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) paymentDateFilter.createdAt.$lte = new Date(endDate);
  }

  // Get completed sessions with payments
  const sessions = await Session.find({
    therapistId: id,
    status: 'completed',
    ...sessionDateFilter,
  }).populate('therapistId', 'credentials hourlyRate');

  // Calculate total hours (using session duration)
  const totalHours = sessions.reduce((sum, session) => {
    return sum + (session.duration || 0) / 60; // Convert minutes to hours
  }, 0);

  // Get payment records for earnings calculation
  const payments = await Payment.find({
    therapistId: id,
    status: 'completed',
    ...paymentDateFilter,
  });

  // Calculate earnings based on hourly rate (NOT percentage splits)
  // Therapists are paid their current hourly rate for hours worked
  let totalEarnings = 0;
  let totalRevenue = 0;

  for (const session of sessions) {
    if (session.therapistId) {
      const hourlyRate = session.therapistId.hourlyRate || (session.therapistId.credentials === 'SLPA' ? 30 : 35);
      const hoursWorked = (session.duration || 0) / 60; // Convert minutes to hours
      const sessionEarnings = Math.round(hourlyRate * hoursWorked * 100); // Convert to cents
      totalEarnings += sessionEarnings;
      
      // Total revenue is the session price paid by client
      const payment = payments.find(p => p.sessionId.toString() === session._id.toString());
      if (payment) {
        totalRevenue += payment.amount;
      }
    }
  }

  // Aggregate earnings by credential type (based on hourly rate, NOT percentage splits)
  const earningsByCredential = {};
  for (const session of sessions) {
    if (session.therapistId) {
      const credentialType = session.therapistId.credentials || 'SLP';
      if (!earningsByCredential[credentialType]) {
        earningsByCredential[credentialType] = { hours: 0, earnings: 0, sessions: 0 };
      }
      const hoursWorked = (session.duration || 0) / 60;
      const hourlyRate = session.therapistId.hourlyRate || (credentialType === 'SLPA' ? 30 : 35);
      const sessionEarnings = Math.round(hourlyRate * hoursWorked * 100); // Convert to cents
      
      earningsByCredential[credentialType].hours += hoursWorked;
      earningsByCredential[credentialType].earnings += sessionEarnings;
      earningsByCredential[credentialType].sessions += 1;
    }
  }

  res.json({
    success: true,
    data: {
      therapist: {
        _id: therapist._id,
        credentials: therapist.credentials,
        hourlyRate: therapist.hourlyRate,
      },
      summary: {
        totalHours: parseFloat(totalHours.toFixed(2)),
        totalEarnings: totalEarnings, // in cents
        totalRevenue: totalRevenue, // in cents
        totalSessions: sessions.length,
      },
      byCredential: earningsByCredential,
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    },
  });
});

// @desc    Get all therapists earnings summary
// @route   GET /api/admin/therapists/earnings
// @access  Private/Admin
const getAllTherapistsEarnings = asyncHandler(async (req, res) => {
  const { startDate, endDate, credentialType } = req.query;

  // Build date filter for sessions (use scheduledDate)
  const sessionDateFilter = {};
  if (startDate || endDate) {
    sessionDateFilter.scheduledDate = {};
    if (startDate) sessionDateFilter.scheduledDate.$gte = new Date(startDate);
    if (endDate) sessionDateFilter.scheduledDate.$lte = new Date(endDate);
  }

  // Build date filter for payments (use createdAt)
  const paymentDateFilter = {};
  if (startDate || endDate) {
    paymentDateFilter.createdAt = {};
    if (startDate) paymentDateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) paymentDateFilter.createdAt.$lte = new Date(endDate);
  }

  // Build therapist filter
  const therapistFilter = {};
  if (credentialType) {
    therapistFilter.credentials = credentialType;
  }

  const therapists = await Therapist.find(therapistFilter).populate('userId', 'firstName lastName email');

  const { getPaymentSplitForUse } = require('./pricingController');
  const earningsData = await Promise.all(
    therapists.map(async (therapist) => {
      const sessions = await Session.find({
        therapistId: therapist._id,
        status: 'completed',
        ...sessionDateFilter,
      });

      const totalHours = sessions.reduce((sum, session) => {
        return sum + (session.duration || 0) / 60;
      }, 0);

      const payments = await Payment.find({
        therapistId: therapist._id,
        status: 'completed',
        ...paymentDateFilter,
      });

      // Calculate earnings based on hourly rate (NOT percentage splits)
      let totalEarnings = 0;
      for (const session of sessions) {
        if (session.therapistId) {
          const hourlyRate = session.therapistId.hourlyRate || (therapist.credentials === 'SLPA' ? 30 : 35);
          const hoursWorked = (session.duration || 0) / 60; // Convert minutes to hours
          const sessionEarnings = Math.round(hourlyRate * hoursWorked * 100); // Convert to cents
          totalEarnings += sessionEarnings;
        }
      }

      return {
        therapistId: therapist._id,
        name: `${therapist.userId?.firstName || ''} ${therapist.userId?.lastName || ''}`.trim(),
        email: therapist.userId?.email || '',
        credentials: therapist.credentials,
        totalHours: parseFloat(totalHours.toFixed(2)),
        totalEarnings: totalEarnings,
        totalSessions: sessions.length,
      };
    })
  );

  // Calculate earnings ranges distribution
  const earningsRanges = {
    '0-1000': 0,
    '1000-5000': 0,
    '5000-10000': 0,
    '10000-25000': 0,
    '25000-50000': 0,
    '50000+': 0,
  };

  earningsData.forEach((therapist) => {
    const earnings = therapist.totalEarnings / 100; // Convert from cents to dollars
    if (earnings === 0) {
      earningsRanges['0-1000']++;
    } else if (earnings < 1000) {
      earningsRanges['0-1000']++;
    } else if (earnings < 5000) {
      earningsRanges['1000-5000']++;
    } else if (earnings < 10000) {
      earningsRanges['5000-10000']++;
    } else if (earnings < 25000) {
      earningsRanges['10000-25000']++;
    } else if (earnings < 50000) {
      earningsRanges['25000-50000']++;
    } else {
      earningsRanges['50000+']++;
    }
  });

  // Calculate hours ranges distribution
  const hoursRanges = {
    '0-10': 0,
    '10-50': 0,
    '50-100': 0,
    '100-250': 0,
    '250-500': 0,
    '500+': 0,
  };

  earningsData.forEach((therapist) => {
    const hours = therapist.totalHours;
    if (hours === 0) {
      hoursRanges['0-10']++;
    } else if (hours < 10) {
      hoursRanges['0-10']++;
    } else if (hours < 50) {
      hoursRanges['10-50']++;
    } else if (hours < 100) {
      hoursRanges['50-100']++;
    } else if (hours < 250) {
      hoursRanges['100-250']++;
    } else if (hours < 500) {
      hoursRanges['250-500']++;
    } else {
      hoursRanges['500+']++;
    }
  });

  // Aggregate statistics
  const aggregateStats = {
    totalTherapists: earningsData.length,
    totalHours: earningsData.reduce((sum, t) => sum + t.totalHours, 0),
    totalEarnings: earningsData.reduce((sum, t) => sum + t.totalEarnings, 0),
    byCredential: {
      SLP: {
        count: earningsData.filter(t => t.credentials === 'SLP').length,
        totalHours: earningsData.filter(t => t.credentials === 'SLP').reduce((sum, t) => sum + t.totalHours, 0),
        totalEarnings: earningsData.filter(t => t.credentials === 'SLP').reduce((sum, t) => sum + t.totalEarnings, 0),
      },
      SLPA: {
        count: earningsData.filter(t => t.credentials === 'SLPA').length,
        totalHours: earningsData.filter(t => t.credentials === 'SLPA').reduce((sum, t) => sum + t.totalHours, 0),
        totalEarnings: earningsData.filter(t => t.credentials === 'SLPA').reduce((sum, t) => sum + t.totalEarnings, 0),
      },
    },
    earningsRanges,
    hoursRanges,
  };

  res.json({
    success: true,
    data: {
      therapists: earningsData,
      aggregate: aggregateStats,
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    },
  });
});

// @desc    Update therapist status (activate, pause, deactivate)
// @route   PUT /api/admin/therapists/:id/status
// @access  Private/Admin
const updateTherapistStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!['pending', 'inactive', 'active', 'paused'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status. Must be one of: pending, inactive, active, paused',
    });
  }

  const therapist = await Therapist.findById(id);
  if (!therapist) {
    return res.status(404).json({
      success: false,
      message: 'Therapist not found',
    });
  }

  therapist.status = status;
  if (status === 'paused') {
    therapist.pausedAt = new Date();
    therapist.pausedBy = req.user._id;
    therapist.pauseReason = reason || 'Paused by admin';
  } else if (status === 'active') {
    therapist.pausedAt = null;
    therapist.pausedBy = null;
    therapist.pauseReason = null;
  }

  const oldStatus = therapist.status;
  await therapist.save();

  // Log the action
  const therapistName = therapist.userId 
    ? `${therapist.userId.firstName} ${therapist.userId.lastName}`
    : 'Unknown';
  
  let actionType = 'therapist_status_changed';
  if (status === 'active' && oldStatus === 'pending') {
    actionType = 'therapist_approved';
  } else if (status === 'inactive' && oldStatus === 'pending') {
    actionType = 'therapist_rejected';
  } else if (status === 'paused') {
    actionType = 'therapist_paused';
  } else if (status === 'active' && oldStatus === 'paused') {
    actionType = 'therapist_activated';
  }

  await logAdminAction({
    adminId: req.user._id,
    action: actionType,
    targetType: 'therapist',
    targetId: id,
    targetName: therapistName,
    details: {
      oldStatus,
      newStatus: status,
    },
    metadata: {
      reason: reason || null,
    },
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  const updatedTherapist = await Therapist.findById(id)
    .populate('userId', 'firstName lastName email avatar phone');

  res.json({
    success: true,
    message: `Therapist status updated to ${status}`,
    data: updatedTherapist,
  });
});

// @desc    Update therapist supervising status
// @route   PUT /api/admin/therapists/:id/supervising
// @access  Private/Admin
const updateTherapistSupervising = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { canSupervise } = req.body;

  const therapist = await Therapist.findById(id);
  if (!therapist) {
    return res.status(404).json({
      success: false,
      message: 'Therapist not found',
    });
  }

  // Only SLPs can supervise
  if (therapist.credentials !== 'SLP') {
    return res.status(400).json({
      success: false,
      message: 'Only SLPs can be designated as supervisors',
    });
  }

  const oldSupervisingStatus = therapist.canSupervise || false;
  therapist.canSupervise = canSupervise === true;
  await therapist.save();

  // Log the action
  const therapistName = therapist.userId 
    ? `${therapist.userId.firstName} ${therapist.userId.lastName}`
    : 'Unknown';

  await logAdminAction({
    adminId: req.user._id,
    action: 'therapist_supervising_updated',
    targetType: 'therapist',
    targetId: id,
    targetName: therapistName,
    details: {
      oldCanSupervise: oldSupervisingStatus,
      newCanSupervise: therapist.canSupervise,
    },
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  const updatedTherapist = await Therapist.findById(id)
    .populate('userId', 'firstName lastName email avatar phone');

  res.json({
    success: true,
    message: `Therapist supervising status updated to ${therapist.canSupervise ? 'can supervise' : 'cannot supervise'}`,
    data: updatedTherapist,
  });
});

// @desc    Verify therapist compliance documents
// @route   PUT /api/admin/therapists/:id/verify-compliance
// @access  Private/Admin
const verifyTherapistCompliance = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { documentType, verified, notes } = req.body;

  const therapist = await Therapist.findById(id);
  if (!therapist) {
    return res.status(404).json({
      success: false,
      message: 'Therapist not found',
    });
  }

  const verificationData = {
    verified: verified === true,
    verifiedAt: verified === true ? new Date() : null,
    verifiedBy: verified === true ? req.user._id : null,
  };

  // Handle different document types
  if (documentType === 'spaMembership') {
    if (!therapist.complianceDocuments.spaMembership) {
      therapist.complianceDocuments.spaMembership = {};
    }
    therapist.complianceDocuments.spaMembership = {
      ...therapist.complianceDocuments.spaMembership,
      ...verificationData,
    };
  } else if (documentType === 'stateRegistration') {
    if (!therapist.complianceDocuments.stateRegistration) {
      therapist.complianceDocuments.stateRegistration = {};
    }
    therapist.complianceDocuments.stateRegistration = {
      ...therapist.complianceDocuments.stateRegistration,
      ...verificationData,
    };
  } else if (documentType === 'professionalIndemnityInsurance') {
    if (!therapist.complianceDocuments.professionalIndemnityInsurance) {
      therapist.complianceDocuments.professionalIndemnityInsurance = {};
    }
    therapist.complianceDocuments.professionalIndemnityInsurance = {
      ...therapist.complianceDocuments.professionalIndemnityInsurance,
      ...verificationData,
    };
  } else if (documentType === 'workingWithChildrenCheck') {
    if (!therapist.complianceDocuments.workingWithChildrenCheck) {
      therapist.complianceDocuments.workingWithChildrenCheck = {};
    }
    therapist.complianceDocuments.workingWithChildrenCheck = {
      ...therapist.complianceDocuments.workingWithChildrenCheck,
      ...verificationData,
    };
  } else if (documentType === 'policeCheck') {
    if (!therapist.complianceDocuments.policeCheck) {
      therapist.complianceDocuments.policeCheck = {};
    }
    therapist.complianceDocuments.policeCheck = {
      ...therapist.complianceDocuments.policeCheck,
      ...verificationData,
    };
  } else if (documentType === 'stateLicense') {
    // Legacy support
    if (!therapist.complianceDocuments.stateLicense) {
      therapist.complianceDocuments.stateLicense = {};
    }
    therapist.complianceDocuments.stateLicense = {
      ...therapist.complianceDocuments.stateLicense,
      ...verificationData,
    };
  } else if (documentType === 'liabilityInsurance') {
    // Legacy support
    if (!therapist.complianceDocuments.liabilityInsurance) {
      therapist.complianceDocuments.liabilityInsurance = {};
    }
    therapist.complianceDocuments.liabilityInsurance = {
      ...therapist.complianceDocuments.liabilityInsurance,
      ...verificationData,
    };
  } else if (documentType === 'additionalCredentials') {
    // This would require credentialId in body to identify which credential
    const { credentialId } = req.body;
    if (!credentialId) {
      return res.status(400).json({
        success: false,
        message: 'credentialId is required for additionalCredentials',
      });
    }
    const credential = therapist.complianceDocuments.additionalCredentials.id(credentialId);
    if (credential) {
      credential.verified = verified === true;
      credential.verifiedAt = verified === true ? new Date() : null;
      credential.verifiedBy = verified === true ? req.user._id : null;
    }
  } else {
    return res.status(400).json({
      success: false,
      message: 'Invalid documentType. Must be one of: spaMembership, stateRegistration, professionalIndemnityInsurance, workingWithChildrenCheck, policeCheck, stateLicense, liabilityInsurance, additionalCredentials',
    });
  }

  // Add admin note if provided
  if (notes) {
    therapist.adminNotes.push({
      note: notes,
      addedBy: req.user._id,
      addedAt: new Date(),
    });
  }

  // Log the document verification action
  const therapistName = therapist.userId 
    ? `${therapist.userId.firstName} ${therapist.userId.lastName}`
    : 'Unknown';

  await logAdminAction({
    adminId: req.user._id,
    action: verified === true ? 'therapist_document_verified' : 'therapist_document_rejected',
    targetType: 'document',
    targetId: id,
    targetName: `${therapistName} - ${documentType}`,
    details: {
      documentType,
      verified: verified === true,
      therapistId: id,
    },
    metadata: {
      notes: notes || null,
    },
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  // Check if all required documents are verified to auto-activate
  // US-based documents (primary)
  const ashaCertificationVerified = therapist.complianceDocuments?.ashaCertification?.verified || false;
  const stateLicensureVerified = therapist.complianceDocuments?.stateLicensure?.verified || false;
  const liabilityInsuranceVerified = therapist.complianceDocuments?.professionalLiabilityInsurance?.verified || false;
  const backgroundCheckVerified = therapist.complianceDocuments?.backgroundCheck?.verified || false;
  const supervisionVerified = therapist.complianceDocuments?.supervision?.verified || false;
  
  // Legacy Australia-specific documents
  const spaMembershipVerified = therapist.complianceDocuments?.spaMembership?.verified || false;
  const stateRegistrationVerified = therapist.complianceDocuments?.stateRegistration?.verified || false;
  const insuranceVerified = therapist.complianceDocuments?.professionalIndemnityInsurance?.verified || false;
  const wwccVerified = therapist.complianceDocuments?.workingWithChildrenCheck?.verified || false;
  const policeCheckVerified = therapist.complianceDocuments?.policeCheck?.verified || false;
  
  // Legacy US documents (for backward compatibility)
  const stateLicenseVerified = therapist.complianceDocuments?.stateLicense?.verified || false;
  const legacyLiabilityInsuranceVerified = therapist.complianceDocuments?.liabilityInsurance?.verified || false;

  // Auto-activate if all required documents are verified
  // Check US-based documents first (role-specific)
  const isSLP = therapist.credentials === 'SLP';
  const isSLPA = therapist.credentials === 'SLPA';
  
  let allUSDocsVerified = false;
  if (isSLP) {
    // SLP requires: ASHA Certification, State Licensure, Professional Liability Insurance, Background Check
    allUSDocsVerified = ashaCertificationVerified && stateLicensureVerified && liabilityInsuranceVerified && backgroundCheckVerified;
  } else if (isSLPA) {
    // SLPA requires: State Licensure, Professional Liability Insurance, Background Check, Supervision
    allUSDocsVerified = stateLicensureVerified && liabilityInsuranceVerified && backgroundCheckVerified && supervisionVerified;
  }
  
  // Legacy checks for backward compatibility
  const allAustraliaDocsVerified = spaMembershipVerified && stateRegistrationVerified && insuranceVerified && wwccVerified && policeCheckVerified;
  const allLegacyDocsVerified = stateLicenseVerified && legacyLiabilityInsuranceVerified;
  
  if ((allUSDocsVerified || allAustraliaDocsVerified || allLegacyDocsVerified) && therapist.status === 'pending') {
    therapist.status = 'active';
    therapist.isVerified = true;
  }

  await therapist.save();

  const updatedTherapist = await Therapist.findById(id)
    .populate('userId', 'firstName lastName email avatar phone')
    .populate('complianceDocuments.stateLicense.verifiedBy', 'firstName lastName')
    .populate('complianceDocuments.liabilityInsurance.verifiedBy', 'firstName lastName');

  res.json({
    success: true,
    message: 'Compliance document verification updated',
    data: updatedTherapist,
  });
});

// @desc    Get therapist activity logs
// @route   GET /api/admin/therapists/:id/activity
// @access  Private/Admin
const getTherapistActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate, page = 1, limit = 50 } = req.query;

  const therapist = await Therapist.findById(id);
  if (!therapist) {
    return res.status(404).json({
      success: false,
      message: 'Therapist not found',
    });
  }

  // Build date filter for sessions
  const sessionDateFilter = {};
  if (startDate || endDate) {
    sessionDateFilter.scheduledDate = {};
    if (startDate) sessionDateFilter.scheduledDate.$gte = new Date(startDate);
    if (endDate) sessionDateFilter.scheduledDate.$lte = new Date(endDate);
  }

  // Build date filter for payments
  const paymentDateFilter = {};
  if (startDate || endDate) {
    paymentDateFilter.createdAt = {};
    if (startDate) paymentDateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) paymentDateFilter.createdAt.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get sessions
  const sessions = await Session.find({
    therapistId: id,
    ...sessionDateFilter,
  })
    .populate('clientId', 'userId')
    .sort({ scheduledDate: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const totalSessions = await Session.countDocuments({
    therapistId: id,
    ...sessionDateFilter,
  });

  // Calculate activity metrics
  const completedSessions = sessions.filter(s => s.status === 'completed').length;
  const cancelledSessions = sessions.filter(s => s.status === 'cancelled').length;
  const noShowSessions = sessions.filter(s => s.status === 'no-show').length;

  // Get payments
  const payments = await Payment.find({
    therapistId: id,
    ...paymentDateFilter,
  }).sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      therapist: {
        _id: therapist._id,
        name: `${therapist.userId?.firstName || ''} ${therapist.userId?.lastName || ''}`.trim(),
        credentials: therapist.credentials,
      },
      activity: {
        sessions: sessions.map(s => ({
          _id: s._id,
          scheduledDate: s.scheduledDate,
          status: s.status,
          duration: s.duration,
          clientId: s.clientId?._id,
          clientName: s.clientId?.userId ? `${s.clientId.userId.firstName} ${s.clientId.userId.lastName}` : 'N/A',
          cancellationReason: s.cancellationReason,
          cancelledAt: s.cancelledAt,
        })),
        payments: payments.map(p => ({
          _id: p._id,
          amount: p.amount,
          status: p.status,
          createdAt: p.createdAt,
          sessionId: p.sessionId,
        })),
      },
      metrics: {
        totalSessions,
        completedSessions,
        cancelledSessions,
        noShowSessions,
        totalPayments: payments.length,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalSessions,
        pages: Math.ceil(totalSessions / parseInt(limit)),
      },
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    },
  });
});

// @desc    Get therapists with incomplete profiles
// @route   GET /api/admin/therapists/incomplete
// @access  Private/Admin
const getIncompleteTherapistProfiles = asyncHandler(async (req, res) => {
  const therapists = await Therapist.find({
    status: { $in: ['pending', 'inactive'] },
  })
    .populate('userId', 'firstName lastName email phone')
    .sort({ createdAt: -1 });

  const incompleteProfiles = therapists.map(therapist => {
    const missingItems = [];
    
    // Check Australia-specific documents
    if (!therapist.complianceDocuments?.spaMembership?.membershipNumber) {
      missingItems.push('SPA Membership Number');
    }
    if (!therapist.complianceDocuments?.spaMembership?.verified) {
      missingItems.push('SPA Membership Verification');
    }
    if (!therapist.complianceDocuments?.stateRegistration?.registrationNumber) {
      missingItems.push('State Registration Number');
    }
    if (!therapist.complianceDocuments?.stateRegistration?.verified) {
      missingItems.push('State Registration Verification');
    }
    if (!therapist.complianceDocuments?.professionalIndemnityInsurance?.policyNumber) {
      missingItems.push('Professional Indemnity Insurance Policy Number');
    }
    if (!therapist.complianceDocuments?.professionalIndemnityInsurance?.verified) {
      missingItems.push('Professional Indemnity Insurance Verification');
    }
    if (!therapist.complianceDocuments?.workingWithChildrenCheck?.checkNumber) {
      missingItems.push('Working with Children Check Number');
    }
    if (!therapist.complianceDocuments?.workingWithChildrenCheck?.verified) {
      missingItems.push('Working with Children Check Verification');
    }
    if (!therapist.complianceDocuments?.policeCheck?.checkNumber) {
      missingItems.push('Police Check Number');
    }
    if (!therapist.complianceDocuments?.policeCheck?.verified) {
      missingItems.push('Police Check Verification');
    }
    
    // Legacy documents (for backward compatibility - only check if Australia docs don't exist)
    if (!therapist.complianceDocuments?.spaMembership?.membershipNumber) {
      if (!therapist.complianceDocuments?.stateLicense?.number) {
        missingItems.push('State License Number (Legacy)');
      }
      if (!therapist.complianceDocuments?.stateLicense?.verified) {
        missingItems.push('State License Verification (Legacy)');
      }
    }
    if (!therapist.complianceDocuments?.professionalIndemnityInsurance?.policyNumber) {
      if (!therapist.complianceDocuments?.liabilityInsurance?.policyNumber) {
        missingItems.push('Liability Insurance Policy Number (Legacy)');
      }
      if (!therapist.complianceDocuments?.liabilityInsurance?.verified) {
        missingItems.push('Liability Insurance Verification (Legacy)');
      }
    }
    if (!therapist.hourlyRate) {
      missingItems.push('Hourly Rate');
    }
    if (!therapist.specializations || therapist.specializations.length === 0) {
      missingItems.push('Specializations');
    }
    if (!therapist.availability || therapist.availability.length === 0) {
      missingItems.push('Availability');
    }

    return {
      therapist: {
        _id: therapist._id,
        name: `${therapist.userId?.firstName || ''} ${therapist.userId?.lastName || ''}`.trim(),
        email: therapist.userId?.email || '',
        status: therapist.status,
        credentials: therapist.credentials,
      },
      missingItems,
      isComplete: missingItems.length === 0,
    };
  });

  res.json({
    success: true,
    data: {
      incompleteProfiles: incompleteProfiles.filter(p => !p.isComplete),
      allPending: incompleteProfiles,
      total: incompleteProfiles.length,
      incomplete: incompleteProfiles.filter(p => !p.isComplete).length,
    },
  });
});

// @desc    Suspend a user
// @route   POST /api/admin/users/:id/suspend
// @access  Private/Admin
const suspendUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  const wasActive = user.isActive;
  user.isActive = false;
  await user.save();

  // Log the action
  const userName = `${user.firstName} ${user.lastName} (${user.email})`;
  
  await logAdminAction({
    adminId: req.user._id,
    action: 'user_suspended',
    targetType: 'user',
    targetId: id,
    targetName: userName,
    details: {
      wasActive,
      isActive: false,
      userRole: user.role,
    },
    metadata: {
      reason: reason || null,
    },
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  res.json({
    success: true,
    message: 'User suspended successfully',
    data: user,
  });
});

// @desc    Activate a user
// @route   POST /api/admin/users/:id/activate
// @access  Private/Admin
const activateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  const wasActive = user.isActive;
  user.isActive = true;
  await user.save();

  // Log the action
  const userName = `${user.firstName} ${user.lastName} (${user.email})`;
  
  await logAdminAction({
    adminId: req.user._id,
    action: 'user_activated',
    targetType: 'user',
    targetId: id,
    targetName: userName,
    details: {
      wasActive,
      isActive: true,
      userRole: user.role,
    },
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  res.json({
    success: true,
    message: 'User activated successfully',
    data: user,
  });
});

// @desc    Bulk user action (suspend/activate)
// @route   POST /api/admin/users/bulk-action
// @access  Private/Admin
const bulkUserAction = asyncHandler(async (req, res) => {
  const { userIds, action } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'userIds must be a non-empty array',
    });
  }

  if (!['suspend', 'activate'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'action must be either "suspend" or "activate"',
    });
  }

  const isActive = action === 'activate';
  const users = await User.find({ _id: { $in: userIds } });
  
  const updatePromises = users.map(user => {
    user.isActive = isActive;
    return user.save();
  });

  await Promise.all(updatePromises);

  // Log the bulk action
  const userNames = users.map(u => `${u.firstName} ${u.lastName} (${u.email})`).join(', ');
  
  await logAdminAction({
    adminId: req.user._id,
    action: 'user_bulk_action',
    targetType: 'user',
    targetId: userIds[0], // Use first ID as primary target
    targetName: `${action} ${userIds.length} users`,
    details: {
      action,
      userIds,
      count: userIds.length,
      isActive,
    },
    metadata: {
      userNames,
    },
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  res.json({
    success: true,
    message: `${action === 'suspend' ? 'Suspended' : 'Activated'} ${userIds.length} user(s) successfully`,
    data: {
      count: userIds.length,
      action,
    },
  });
});

// @desc    Get admin action logs
// @route   GET /api/admin/action-logs
// @access  Private/Admin
const getAdminActionLogs = asyncHandler(async (req, res) => {
  const { 
    adminId, 
    action, 
    targetType, 
    targetId, 
    startDate, 
    endDate, 
    page = 1, 
    limit = 50 
  } = req.query;

  const query = {};
  
  if (adminId) query.adminId = adminId;
  if (action) query.action = action;
  if (targetType) query.targetType = targetType;
  if (targetId) query.targetId = targetId;
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const logs = await AdminActionLog.find(query)
    .populate('adminId', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await AdminActionLog.countDocuments(query);

  res.json({
    success: true,
    data: logs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// @desc    Get platform stats
// @route   GET /api/admin/platform-stats
// @access  Private/Admin
const getPlatformStats = asyncHandler(async (req, res) => {
  const PlatformStats = require('../models/PlatformStats');
  const stats = await PlatformStats.getStats();
  
  res.json({
    success: true,
    data: stats,
  });
});

// @desc    Update platform stats
// @route   PUT /api/admin/platform-stats
// @access  Private/Admin
const updatePlatformStats = asyncHandler(async (req, res) => {
  const PlatformStats = require('../models/PlatformStats');
  const updates = req.body;
  
  let stats = await PlatformStats.findOne();
  if (!stats) {
    stats = await PlatformStats.create(updates);
  } else {
    stats = await PlatformStats.findOneAndUpdate(
      {},
      { $set: updates },
      { new: true, runValidators: true }
    );
  }
  
  res.json({
    success: true,
    message: 'Platform stats updated successfully',
    data: stats,
  });
});

module.exports = {
  getAllUsers,
  getAllTherapists,
  getAllClients,
  getClientById,
  getAllPayments,
  getAllSessions,
  getReports,
  getSettings,
  updateSettings,
  updateTherapistCredentials,
  bulkUpdateTherapistCredentials,
  getDashboardStats,
  getTherapistEarnings,
  getAllTherapistsEarnings,
  updateTherapistStatus,
  getPlatformStats,
  updatePlatformStats,
  updateTherapistSupervising,
  verifyTherapistCompliance,
  getTherapistActivity,
  getIncompleteTherapistProfiles,
  suspendUser,
  activateUser,
  bulkUserAction,
  getAdminActionLogs,
};

