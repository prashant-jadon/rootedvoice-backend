const Evaluation = require('../models/Evaluation');
const User = require('../models/User');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Get evaluation by ID
// @route   GET /api/evaluations/:id
// @access  Private
const getEvaluation = asyncHandler(async (req, res) => {
    const evaluation = await Evaluation.findById(req.params.id)
        .populate('clientId', 'firstName lastName email')
        .populate('therapistId', 'userId')
        .populate({
            path: 'therapistId',
            populate: { path: 'userId', select: 'firstName lastName' }
        });

    if (!evaluation) {
        res.status(404);
        throw new Error('Evaluation not found');
    }

    // Verify access privileges
    if (req.user.role === 'client' && evaluation.clientId._id.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized to view this evaluation');
    }
    // Therapists can only view evaluations they are assigned to (or all if admin/super) - simplifying to allow all therapists/admins for now

    res.json({
        success: true,
        data: evaluation
    });
});

// @desc    Get client's active evaluation
// @route   GET /api/evaluations/my-evaluation
// @access  Private/Client
const getMyEvaluation = asyncHandler(async (req, res) => {
    // Find the latest active evaluation for this client
    const evaluation = await Evaluation.findOne({
        clientId: req.user._id,
        status: { $in: ['pending_creation', 'assigned', 'in_progress', 'completed', 'reviewed'] }
    }).sort({ createdAt: -1 });

    if (!evaluation) {
        return res.status(200).json({ success: true, data: null });
    }

    res.json({
        success: true,
        data: evaluation
    });
});

// @desc    Create/Assign evaluation questionnaire (Admin/Therapist)
// @route   POST /api/evaluations
// @access  Private/Admin/Therapist
const createEvaluation = asyncHandler(async (req, res) => {
    const { clientId, therapistId, questions, bookingId } = req.body;

    // Check if client exists
    const client = await User.findById(clientId);
    if (!client) {
        res.status(404);
        throw new Error('Client not found');
    }

    const evaluation = await Evaluation.create({
        clientId,
        therapistId: therapistId || req.user.therapistId, // If creator is therapist, assign self optional
        bookingId,
        questions,
        status: 'assigned'
    });

    res.status(201).json({
        success: true,
        data: evaluation
    });
});

// @desc    Update evaluation questions (Admin/Therapist)
// @route   PUT /api/evaluations/:id/questions
// @access  Private/Admin/Therapist
const updateEvaluationQuestions = asyncHandler(async (req, res) => {
    const { questions } = req.body;

    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) {
        res.status(404);
        throw new Error('Evaluation not found');
    }

    evaluation.questions = questions;
    evaluation.status = 'assigned'; // Reset status if needed, or keep as is
    await evaluation.save();

    res.json({
        success: true,
        data: evaluation
    });
});

// @desc    Submit evaluation answers (Client)
// @route   POST /api/evaluations/:id/submit
// @access  Private/Client
const submitEvaluation = asyncHandler(async (req, res) => {
    const { answers } = req.body;

    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) {
        res.status(404);
        throw new Error('Evaluation not found');
    }

    if (evaluation.clientId.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized to submit this evaluation');
    }

    evaluation.answers = answers;
    evaluation.status = 'completed';
    await evaluation.save();

    res.json({
        success: true,
        data: evaluation
    });
});

// @desc    Get all evaluations (Admin)
// @route   GET /api/evaluations
// @access  Private/Admin
const getAllEvaluations = asyncHandler(async (req, res) => {
    const { status } = req.query;

    let query = {};
    if (status) {
        query.status = status;
    }

    const evaluations = await Evaluation.find(query)
        .populate('clientId', 'firstName lastName email')
        .sort({ createdAt: -1 });

    res.json({
        success: true,
        data: evaluations
    });
});


// @desc    Mark evaluation as reviewed (Admin)
// @route   PUT /api/evaluations/:id/review
// @access  Private/Admin
const reviewEvaluation = asyncHandler(async (req, res) => {
    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) {
        res.status(404);
        throw new Error('Evaluation not found');
    }

    const { adminNotes } = req.body;
    evaluation.status = 'reviewed';
    if (adminNotes) {
        evaluation.adminNotes = adminNotes;
    }
    await evaluation.save();

    res.json({
        success: true,
        data: evaluation
    });
});

module.exports = {
    getEvaluation,
    getMyEvaluation,
    createEvaluation,
    updateEvaluationQuestions,
    submitEvaluation,
    getAllEvaluations,
    reviewEvaluation
};
