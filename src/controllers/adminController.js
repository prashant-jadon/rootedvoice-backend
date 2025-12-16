const User = require('../models/User');
const Therapist = require('../models/Therapist');
const Client = require('../models/Client');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const Session = require('../models/Session');
const { asyncHandler } = require('../middlewares/errorHandler');

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
    .populate('assignedTherapist', 'userId specialization')
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

  therapist.credentials = credentials;
  await therapist.save();

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

module.exports = {
  getAllUsers,
  getAllTherapists,
  getAllClients,
  getAllPayments,
  getAllSessions,
  getReports,
  getSettings,
  updateSettings,
  updateTherapistCredentials,
  bulkUpdateTherapistCredentials,
  getDashboardStats,
};

