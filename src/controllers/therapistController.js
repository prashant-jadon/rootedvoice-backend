const Therapist = require('../models/Therapist');
const User = require('../models/User');
const Review = require('../models/Review');
const { asyncHandler } = require('../middlewares/errorHandler');
const { getRateCapsForUse } = require('./pricingController');
const upload = require('../config/multer');
const path = require('path');
const fs = require('fs').promises;

// @desc    Get all therapists
// @route   GET /api/therapists
// @access  Public
const getTherapists = asyncHandler(async (req, res) => {
  const {
    state,
    specialization,
    minRate,
    maxRate,
    minRating,
    isVerified,
    language,
    bilingual,
    page = 1,
    limit = 10,
  } = req.query;

  // Build filter
  const filter = {};
  
  if (state) {
    filter.licensedStates = state;
  }
  
  if (specialization) {
    filter.specializations = specialization;
  }
  
  if (minRate || maxRate) {
    filter.hourlyRate = {};
    if (minRate) filter.hourlyRate.$gte = parseFloat(minRate);
    if (maxRate) filter.hourlyRate.$lte = parseFloat(maxRate);
  }
  
  if (minRating) {
    filter.rating = { $gte: parseFloat(minRating) };
  }
  
  if (isVerified !== undefined) {
    filter.isVerified = isVerified === 'true';
  }

  // Only show active therapists to public
  filter.status = 'active';

  // Bilingual therapist matching
  if (language) {
    filter.$or = [
      { spokenLanguages: language },
      { bilingualTherapy: true },
    ];
  }

  if (bilingual === 'true') {
    filter.bilingualTherapy = true;
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const therapists = await Therapist.find(filter)
    .populate('userId', 'firstName lastName email avatar')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ rating: -1, totalSessions: -1 });

  const total = await Therapist.countDocuments(filter);

  res.json({
    success: true,
    data: {
      therapists,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    },
  });
});

// @desc    Get therapist by ID
// @route   GET /api/therapists/:id
// @access  Public
const getTherapist = asyncHandler(async (req, res) => {
  const therapist = await Therapist.findById(req.params.id)
    .populate('userId', 'firstName lastName email avatar phone');

  if (!therapist) {
    return res.status(404).json({
      success: false,
      message: 'Therapist not found',
    });
  }

  // Get reviews for this therapist
  const reviews = await Review.find({ therapistId: therapist._id, isPublic: true })
    .populate('clientId', 'userId')
    .sort({ createdAt: -1 })
    .limit(10);

  res.json({
    success: true,
    data: {
      therapist,
      reviews,
    },
  });
});

// @desc    Upload compliance documents
// @route   POST /api/therapists/upload-documents
// @access  Private (Therapist)
const uploadDocuments = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const therapist = await Therapist.findOne({ userId });

  if (!therapist) {
    return res.status(404).json({
      success: false,
      message: 'Therapist profile not found',
    });
  }

  const uploadedFiles = {};
  const documentTypes = [
    'spaMembership',
    'stateRegistration',
    'professionalIndemnityInsurance',
    'workingWithChildrenCheck',
    'policeCheck',
    'academicQualification',
    'additionalCredential',
  ];

  // Process uploaded files
  for (const docType of documentTypes) {
    if (req.files && req.files[docType]) {
      const file = Array.isArray(req.files[docType]) ? req.files[docType][0] : req.files[docType];
      uploadedFiles[docType] = file.path;
    }
  }

  // Update therapist with document URLs
  if (uploadedFiles.spaMembership && req.body.spaMembershipNumber) {
    therapist.complianceDocuments.spaMembership = {
      ...therapist.complianceDocuments.spaMembership,
      membershipNumber: req.body.spaMembershipNumber,
      membershipType: req.body.spaMembershipType,
      expirationDate: req.body.spaMembershipExpirationDate,
      documentUrl: uploadedFiles.spaMembership,
    };
  }

  if (uploadedFiles.stateRegistration && req.body.stateRegistrationNumber) {
    therapist.complianceDocuments.stateRegistration = {
      ...therapist.complianceDocuments.stateRegistration,
      registrationNumber: req.body.stateRegistrationNumber,
      state: req.body.stateRegistrationState,
      expirationDate: req.body.stateRegistrationExpirationDate,
      documentUrl: uploadedFiles.stateRegistration,
    };
  }

  if (uploadedFiles.professionalIndemnityInsurance && req.body.insuranceProvider) {
    therapist.complianceDocuments.professionalIndemnityInsurance = {
      ...therapist.complianceDocuments.professionalIndemnityInsurance,
      provider: req.body.insuranceProvider,
      policyNumber: req.body.insurancePolicyNumber,
      coverageAmount: req.body.insuranceCoverageAmount,
      expirationDate: req.body.insuranceExpirationDate,
      documentUrl: uploadedFiles.professionalIndemnityInsurance,
    };
  }

  if (uploadedFiles.workingWithChildrenCheck && req.body.wwccNumber) {
    therapist.complianceDocuments.workingWithChildrenCheck = {
      ...therapist.complianceDocuments.workingWithChildrenCheck,
      checkNumber: req.body.wwccNumber,
      state: req.body.wwccState,
      expirationDate: req.body.wwccExpirationDate,
      documentUrl: uploadedFiles.workingWithChildrenCheck,
    };
  }

  if (uploadedFiles.policeCheck && req.body.policeCheckNumber) {
    therapist.complianceDocuments.policeCheck = {
      ...therapist.complianceDocuments.policeCheck,
      checkNumber: req.body.policeCheckNumber,
      issueDate: req.body.policeCheckIssueDate,
      expirationDate: req.body.policeCheckExpirationDate,
      documentUrl: uploadedFiles.policeCheck,
    };
  }

  await therapist.save();

  res.json({
    success: true,
    message: 'Documents uploaded successfully',
    data: {
      uploadedFiles: Object.keys(uploadedFiles),
      therapist: await Therapist.findById(therapist._id).populate('userId', 'firstName lastName email'),
    },
  });
});

// @desc    Create/Update therapist profile
// @route   POST /api/therapists
// @access  Private (Therapist)
const createOrUpdateTherapist = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Get rate caps
  const rateCaps = getRateCapsForUse();

  // Validate hourly rate against credentials
  if (req.body.hourlyRate !== undefined) {
    const credentials = req.body.credentials || 'SLP';
    const maxRate = rateCaps[credentials] || rateCaps.SLP;

    if (req.body.hourlyRate > maxRate) {
      return res.status(400).json({
        success: false,
        message: `Hourly rate for ${credentials} cannot exceed $${maxRate}/hour`,
      });
    }
  }

  // Extract phone from body if provided (it belongs to User model)
  const { phone, ...therapistData } = req.body;

  // Update User model if phone is provided
  if (phone !== undefined) {
    await User.findByIdAndUpdate(userId, { phone }, { new: true });
  }

  // Check if profile exists
  let therapist = await Therapist.findOne({ userId });

  if (therapist) {
    // If updating hourly rate, validate against current or new credentials
    if (therapistData.hourlyRate !== undefined) {
      const credentials = therapistData.credentials || therapist.credentials;
      const maxRate = rateCaps[credentials] || rateCaps.SLP;

      if (therapistData.hourlyRate > maxRate) {
        return res.status(400).json({
          success: false,
          message: `Hourly rate for ${credentials} cannot exceed $${maxRate}/hour`,
        });
      }
    }

    // Update existing profile
    therapist = await Therapist.findOneAndUpdate(
      { userId },
      therapistData,
      { new: true, runValidators: true }
    ).populate('userId', 'firstName lastName email avatar phone');
  } else {
    // Create new profile
    therapist = await Therapist.create({
      userId,
      ...therapistData,
    });
    therapist = await therapist.populate('userId', 'firstName lastName email avatar phone');
  }

  res.json({
    success: true,
    data: therapist,
  });
});

// @desc    Update therapist availability
// @route   PUT /api/therapists/:id/availability
// @access  Private (Therapist - own profile)
const updateAvailability = asyncHandler(async (req, res) => {
  const therapist = await Therapist.findById(req.params.id);

  if (!therapist) {
    return res.status(404).json({
      success: false,
      message: 'Therapist not found',
    });
  }

  // Check ownership
  if (therapist.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  therapist.availability = req.body.availability;
  await therapist.save();

  res.json({
    success: true,
    data: therapist,
  });
});

// @desc    Get therapist stats
// @route   GET /api/therapists/:id/stats
// @access  Private (Therapist - own profile)
const getTherapistStats = asyncHandler(async (req, res) => {
  const therapist = await Therapist.findById(req.params.id);

  if (!therapist) {
    return res.status(404).json({
      success: false,
      message: 'Therapist not found',
    });
  }

  // Check ownership or admin
  if (therapist.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const Session = require('../models/Session');

  // Get session stats
  const totalSessions = await Session.countDocuments({ therapistId: therapist._id });
  const completedSessions = await Session.countDocuments({ 
    therapistId: therapist._id, 
    status: 'completed' 
  });
  const upcomingSessions = await Session.countDocuments({ 
    therapistId: therapist._id, 
    status: { $in: ['scheduled', 'confirmed'] },
    scheduledDate: { $gte: new Date() }
  });

  // Calculate revenue
  const revenueData = await Session.aggregate([
    { 
      $match: { 
        therapistId: therapist._id,
        paymentStatus: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$price' }
      }
    }
  ]);

  const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

  res.json({
    success: true,
    data: {
      totalSessions,
      completedSessions,
      upcomingSessions,
      totalRevenue,
      activeClients: therapist.activeClients.length,
      rating: therapist.rating,
      totalReviews: therapist.totalReviews,
    },
  });
});

// @desc    Get own therapist profile
// @route   GET /api/therapists/me
// @access  Private (Therapist)
const getMyProfile = asyncHandler(async (req, res) => {
  const therapist = await Therapist.findOne({ userId: req.user._id })
    .populate('userId', 'firstName lastName email avatar phone');

  if (!therapist) {
    return res.status(404).json({
      success: false,
      message: 'Therapist profile not found',
    });
  }

  res.json({
    success: true,
    data: therapist,
  });
});

// @desc    Get therapist payments
// @route   GET /api/therapists/me/payments
// @access  Private (Therapist)
const getMyPayments = asyncHandler(async (req, res) => {
  const therapist = await Therapist.findOne({ userId: req.user._id });
  
  if (!therapist) {
    return res.status(404).json({
      success: false,
      message: 'Therapist profile not found',
    });
  }

  const Payment = require('../models/Payment');
  const { status, startDate, endDate, page = 1, limit = 50 } = req.query;
  
  const query = { therapistId: therapist._id };
  if (status) query.status = status;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const payments = await Payment.find(query)
    .populate({
      path: 'clientId',
      populate: { path: 'userId', select: 'firstName lastName email' }
    })
    .populate({
      path: 'sessionId',
      select: 'date time duration serviceType'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Payment.countDocuments(query);

  // Calculate stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Total revenue
  const totalRevenueData = await Payment.aggregate([
    { $match: { therapistId: therapist._id, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const totalRevenue = totalRevenueData[0]?.total || 0;

  // This month revenue
  const thisMonthData = await Payment.aggregate([
    { 
      $match: { 
        therapistId: therapist._id, 
        status: 'completed',
        createdAt: { $gte: startOfMonth }
      } 
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const thisMonthRevenue = thisMonthData[0]?.total || 0;

  // Last month revenue for comparison
  const lastMonthData = await Payment.aggregate([
    { 
      $match: { 
        therapistId: therapist._id, 
        status: 'completed',
        createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
      } 
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const lastMonthRevenue = lastMonthData[0]?.total || 0;

  // Pending payments
  const pendingData = await Payment.aggregate([
    { 
      $match: { 
        therapistId: therapist._id, 
        status: { $in: ['pending', 'processing'] }
      } 
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const pendingAmount = pendingData[0]?.total || 0;

  // Completed sessions count
  const Session = require('../models/Session');
  const completedSessions = await Session.countDocuments({
    therapistId: therapist._id,
    status: 'completed'
  });

  // Calculate month-over-month change
  const monthChange = lastMonthRevenue > 0 
    ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
    : thisMonthRevenue > 0 ? '100.0' : '0.0';

  res.json({
    success: true,
    data: payments,
    stats: {
      totalRevenue,
      thisMonthRevenue,
      pendingAmount,
      completedSessions,
      monthChange: parseFloat(monthChange),
    },
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

module.exports = {
  getTherapists,
  getTherapist,
  getMyProfile,
  createOrUpdateTherapist,
  updateAvailability,
  getTherapistStats,
  uploadDocuments,
  getMyPayments,
};
