const Assignment = require('../models/Assignment');
const Client = require('../models/Client');
const Therapist = require('../models/Therapist');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Get all assignments for a client
// @route   GET /api/assignments
// @access  Private
const getAssignments = asyncHandler(async (req, res) => {
  const { clientId, therapistId, completed, overdue } = req.query;
  const userId = req.user._id;

  const filter = {};

  // If client, only show their assignments
  if (req.user.role === 'client') {
    const client = await Client.findOne({ userId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found',
      });
    }
    filter.clientId = client._id;
  } else if (clientId) {
    filter.clientId = clientId;
  }

  // If therapist, only show their assignments
  if (req.user.role === 'therapist') {
    const therapist = await Therapist.findOne({ userId });
    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: 'Therapist profile not found',
      });
    }
    filter.therapistId = therapist._id;
  } else if (therapistId) {
    filter.therapistId = therapistId;
  }

  if (completed !== undefined) {
    filter.completed = completed === 'true';
  }

  const assignments = await Assignment.find(filter)
    .populate('clientId', 'userId')
    .populate({
      path: 'clientId',
      populate: { path: 'userId', select: 'firstName lastName' }
    })
    .populate('therapistId', 'userId')
    .populate({
      path: 'therapistId',
      populate: { path: 'userId', select: 'firstName lastName' }
    })
    .populate('goalId', 'title')
    .sort({ dueDate: 1, createdAt: -1 });

  // Filter overdue if requested
  let filteredAssignments = assignments;
  if (overdue === 'true') {
    filteredAssignments = assignments.filter(assignment => {
      return !assignment.completed && new Date(assignment.dueDate) < new Date();
    });
  }

  res.json({
    success: true,
    data: filteredAssignments,
  });
});

// @desc    Get assignment by ID
// @route   GET /api/assignments/:id
// @access  Private
const getAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id)
    .populate('clientId', 'userId')
    .populate({
      path: 'clientId',
      populate: { path: 'userId', select: 'firstName lastName' }
    })
    .populate('therapistId', 'userId')
    .populate({
      path: 'therapistId',
      populate: { path: 'userId', select: 'firstName lastName' }
    })
    .populate('goalId', 'title');

  if (!assignment) {
    return res.status(404).json({
      success: false,
      message: 'Assignment not found',
    });
  }

  // Check authorization
  if (req.user.role === 'client') {
    const client = await Client.findOne({ userId: req.user._id });
    if (client && assignment.clientId.toString() !== client._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }
  } else if (req.user.role === 'therapist') {
    const therapist = await Therapist.findOne({ userId: req.user._id });
    if (therapist && assignment.therapistId.toString() !== therapist._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }
  }

  res.json({
    success: true,
    data: assignment,
  });
});

// @desc    Create new assignment
// @route   POST /api/assignments
// @access  Private (Therapist)
const createAssignment = asyncHandler(async (req, res) => {
  const { clientId, goalId, title, description, type, dueDate, instructions, attachments } = req.body;

  // Handle file uploads if any
  let attachmentData = attachments || [];
  
  // If files are uploaded via multer, process them
  if (req.files && req.files.length > 0) {
    attachmentData = req.files.map(file => ({
      fileName: file.originalname,
      fileUrl: `${req.protocol}://${req.get('host')}/uploads/documents/${file.filename}`,
      fileType: file.mimetype,
    }));
  }

  // Get therapist profile
  const therapist = await Therapist.findOne({ userId: req.user._id });
  if (!therapist) {
    return res.status(404).json({
      success: false,
      message: 'Therapist profile not found',
    });
  }

  // Verify client exists
  const client = await Client.findById(clientId);
  if (!client) {
    return res.status(404).json({
      success: false,
      message: 'Client not found',
    });
  }

  // Verify client is assigned to this therapist
  if (client.assignedTherapist && client.assignedTherapist.toString() !== therapist._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Client is not assigned to you',
    });
  }

  const assignment = await Assignment.create({
    clientId,
    therapistId: therapist._id,
    goalId,
    title,
    description,
    type: type || 'daily-practice',
    dueDate,
    instructions,
    attachments: attachmentData,
  });

  const populatedAssignment = await Assignment.findById(assignment._id)
    .populate('clientId', 'userId')
    .populate({
      path: 'clientId',
      populate: { path: 'userId', select: 'firstName lastName' }
    })
    .populate('therapistId', 'userId')
    .populate({
      path: 'therapistId',
      populate: { path: 'userId', select: 'firstName lastName' }
    })
    .populate('goalId', 'title');

  res.status(201).json({
    success: true,
    message: 'Assignment created successfully',
    data: populatedAssignment,
  });
});

// @desc    Update assignment
// @route   PUT /api/assignments/:id
// @access  Private
const updateAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);

  if (!assignment) {
    return res.status(404).json({
      success: false,
      message: 'Assignment not found',
    });
  }

  // Check authorization
  if (req.user.role === 'therapist') {
    const therapist = await Therapist.findOne({ userId: req.user._id });
    if (therapist && assignment.therapistId.toString() !== therapist._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }
  } else if (req.user.role === 'client') {
    // Clients can only mark as completed or add feedback
    const allowedFields = ['completed', 'completedAt'];
    const updateFields = Object.keys(req.body);
    const invalidFields = updateFields.filter(field => !allowedFields.includes(field));
    
    if (invalidFields.length > 0) {
      return res.status(403).json({
        success: false,
        message: `Clients can only update: ${allowedFields.join(', ')}`,
      });
    }
  }

  // If marking as completed, set completedAt
  if (req.body.completed === true && !assignment.completed) {
    req.body.completedAt = new Date();
  } else if (req.body.completed === false) {
    req.body.completedAt = null;
  }

  const updatedAssignment = await Assignment.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  )
    .populate('clientId', 'userId')
    .populate({
      path: 'clientId',
      populate: { path: 'userId', select: 'firstName lastName' }
    })
    .populate('therapistId', 'userId')
    .populate({
      path: 'therapistId',
      populate: { path: 'userId', select: 'firstName lastName' }
    })
    .populate('goalId', 'title');

  res.json({
    success: true,
    message: 'Assignment updated successfully',
    data: updatedAssignment,
  });
});

// @desc    Add feedback to assignment
// @route   POST /api/assignments/:id/feedback
// @access  Private (Therapist)
const addFeedback = asyncHandler(async (req, res) => {
  const { feedback, rating } = req.body;

  const assignment = await Assignment.findById(req.params.id);

  if (!assignment) {
    return res.status(404).json({
      success: false,
      message: 'Assignment not found',
    });
  }

  // Check authorization
  const therapist = await Therapist.findOne({ userId: req.user._id });
  if (!therapist || assignment.therapistId.toString() !== therapist._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  assignment.feedback = feedback;
  assignment.feedbackDate = new Date();
  if (rating) {
    assignment.rating = rating;
  }

  await assignment.save();

  const populatedAssignment = await Assignment.findById(assignment._id)
    .populate('clientId', 'userId')
    .populate({
      path: 'clientId',
      populate: { path: 'userId', select: 'firstName lastName' }
    })
    .populate('therapistId', 'userId')
    .populate({
      path: 'therapistId',
      populate: { path: 'userId', select: 'firstName lastName' }
    })
    .populate('goalId', 'title');

  res.json({
    success: true,
    message: 'Feedback added successfully',
    data: populatedAssignment,
  });
});

// @desc    Delete assignment
// @route   DELETE /api/assignments/:id
// @access  Private (Therapist)
const deleteAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);

  if (!assignment) {
    return res.status(404).json({
      success: false,
      message: 'Assignment not found',
    });
  }

  // Check authorization
  const therapist = await Therapist.findOne({ userId: req.user._id });
  if (!therapist || assignment.therapistId.toString() !== therapist._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  await Assignment.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Assignment deleted successfully',
  });
});

module.exports = {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  addFeedback,
  deleteAssignment,
};

