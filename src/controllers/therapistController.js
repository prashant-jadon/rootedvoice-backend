const Therapist = require('../models/Therapist');
const User = require('../models/User');
const Review = require('../models/Review');
const { asyncHandler } = require('../middlewares/errorHandler');
const { getRateCapsForUse } = require('./pricingController');

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

module.exports = {
  getTherapists,
  getTherapist,
  getMyProfile,
  createOrUpdateTherapist,
  updateAvailability,
  getTherapistStats,
};

