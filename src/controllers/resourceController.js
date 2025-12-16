const Resource = require('../models/Resource');
const Therapist = require('../models/Therapist');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Get all resources
// @route   GET /api/resources
// @access  Public (with access level filtering)
const getResources = asyncHandler(async (req, res) => {
  const { category, ageGroup, disorderType, search, page = 1, limit = 20 } = req.query;

  const filter = {
    isApproved: true,
    isPublic: true,
  };

  // Get user's credentials if authenticated
  let userCredentials = null;
  if (req.user && req.user.role === 'therapist') {
    const therapist = await Therapist.findOne({ userId: req.user._id });
    if (therapist) {
      userCredentials = therapist.credentials;
    }
  }

  // Enforce SLPA access restrictions
  if (userCredentials === 'SLPA') {
    // SLPA can only access 'SLPA' or 'public' resources
    filter.$or = [
      { accessLevel: 'SLPA' },
      { accessLevel: 'public' },
    ];
  } else if (userCredentials === 'SLP') {
    // SLP can access all resources
    // No additional filter needed
  } else {
    // Non-therapist users can only access public resources
    filter.accessLevel = 'public';
  }

  if (category) {
    filter.category = category;
  }

  if (ageGroup) {
    filter.ageGroup = ageGroup;
  }

  if (disorderType) {
    filter.disorderType = disorderType;
  }

  if (search) {
    filter.$text = { $search: search };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const resources = await Resource.find(filter)
    .populate('uploadedBy', 'userId')
    .populate({
      path: 'uploadedBy',
      populate: { path: 'userId', select: 'firstName lastName' }
    })
    .sort({ downloads: -1, createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Resource.countDocuments(filter);

  res.json({
    success: true,
    data: resources,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// @desc    Get resource by ID
// @route   GET /api/resources/:id
// @access  Public (with access level check)
const getResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findById(req.params.id)
    .populate('uploadedBy', 'userId')
    .populate({
      path: 'uploadedBy',
      populate: { path: 'userId', select: 'firstName lastName' }
    });

  if (!resource || !resource.isApproved || !resource.isPublic) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found',
    });
  }

  // Check access level
  let userCredentials = null;
  if (req.user && req.user.role === 'therapist') {
    const therapist = await Therapist.findOne({ userId: req.user._id });
    if (therapist) {
      userCredentials = therapist.credentials;
    }
  }

  if (userCredentials === 'SLPA' && resource.accessLevel === 'SLP') {
    return res.status(403).json({
      success: false,
      message: 'This resource is restricted to SLP credentials only',
    });
  }

  if (!userCredentials && resource.accessLevel !== 'public') {
    return res.status(403).json({
      success: false,
      message: 'This resource requires therapist credentials',
    });
  }

  // Increment download count
  resource.downloads += 1;
  await resource.save();

  res.json({
    success: true,
    data: resource,
  });
});

// @desc    Create new resource
// @route   POST /api/resources
// @access  Private (Therapist)
const createResource = asyncHandler(async (req, res) => {
  const therapist = await Therapist.findOne({ userId: req.user._id });

  if (!therapist) {
    return res.status(404).json({
      success: false,
      message: 'Therapist profile not found',
    });
  }

  // SLPA cannot upload SLP-only resources
  if (therapist.credentials === 'SLPA' && req.body.accessLevel === 'SLP') {
    return res.status(403).json({
      success: false,
      message: 'SLPA credentials cannot create SLP-only resources',
    });
  }

  // SLPA cannot upload assessment resources
  if (therapist.credentials === 'SLPA' && req.body.category === 'assessment') {
    return res.status(403).json({
      success: false,
      message: 'SLPA credentials cannot upload assessment resources',
    });
  }

  const resource = await Resource.create({
    uploadedBy: therapist._id,
    ...req.body,
    isApproved: false, // Requires admin approval
  });

  const populatedResource = await Resource.findById(resource._id)
    .populate('uploadedBy', 'userId')
    .populate({
      path: 'uploadedBy',
      populate: { path: 'userId', select: 'firstName lastName' }
    });

  res.status(201).json({
    success: true,
    message: 'Resource created successfully. Pending admin approval.',
    data: populatedResource,
  });
});

// @desc    Update resource
// @route   PUT /api/resources/:id
// @access  Private (Uploader or Admin)
const updateResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found',
    });
  }

  const therapist = await Therapist.findOne({ userId: req.user._id });

  // Check authorization
  if (resource.uploadedBy.toString() !== therapist._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  // SLPA restrictions
  if (therapist && therapist.credentials === 'SLPA') {
    if (req.body.accessLevel === 'SLP') {
      return res.status(403).json({
        success: false,
        message: 'SLPA credentials cannot set access level to SLP',
      });
    }
    if (req.body.category === 'assessment') {
      return res.status(403).json({
        success: false,
        message: 'SLPA credentials cannot upload assessment resources',
      });
    }
  }

  const updatedResource = await Resource.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  )
    .populate('uploadedBy', 'userId')
    .populate({
      path: 'uploadedBy',
      populate: { path: 'userId', select: 'firstName lastName' }
    });

  res.json({
    success: true,
    message: 'Resource updated successfully',
    data: updatedResource,
  });
});

// @desc    Delete resource
// @route   DELETE /api/resources/:id
// @access  Private (Uploader or Admin)
const deleteResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found',
    });
  }

  const therapist = await Therapist.findOne({ userId: req.user._id });

  // Check authorization
  if (resource.uploadedBy.toString() !== therapist._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  await Resource.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Resource deleted successfully',
  });
});

// @desc    AI-powered resource search
// @route   GET /api/resources/ai-search
// @access  Public (with access level filtering)
const aiSearchResources = asyncHandler(async (req, res) => {
  const { query, page = 1, limit = 20 } = req.query;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required',
    });
  }

  // Build base filter (same as getResources)
  const baseFilter = {
    isApproved: true,
    isPublic: true,
  };

  // Get user's credentials if authenticated
  let userCredentials = null;
  if (req.user && req.user.role === 'therapist') {
    const therapist = await Therapist.findOne({ userId: req.user._id });
    if (therapist) {
      userCredentials = therapist.credentials;
    }
  }

  // Enforce SLPA access restrictions
  if (userCredentials === 'SLPA') {
    baseFilter.$or = [
      { accessLevel: 'SLPA' },
      { accessLevel: 'public' },
    ];
  } else if (userCredentials === 'SLP') {
    // SLP can access all resources
  } else {
    baseFilter.accessLevel = 'public';
  }

  // Use AI search service
  const { searchResourcesWithAI } = require('../utils/aiResourceSearch');
  const searchResult = await searchResourcesWithAI(query, baseFilter, Resource);

  if (!searchResult.success) {
    return res.status(500).json({
      success: false,
      message: searchResult.error || 'AI search failed',
    });
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const paginatedResources = searchResult.resources.slice(skip, skip + parseInt(limit));

  res.json({
    success: true,
    data: paginatedResources,
    parsedQuery: searchResult.parsedQuery,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: searchResult.resources.length,
      pages: Math.ceil(searchResult.resources.length / parseInt(limit)),
    },
  });
});

module.exports = {
  getResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  aiSearchResources,
};

