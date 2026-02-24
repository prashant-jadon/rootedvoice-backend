const Evaluation = require('../models/Evaluation');
const User = require('../models/User');
const Client = require('../models/Client');
const Therapist = require('../models/Therapist');
const Session = require('../models/Session');
const Notification = require('../models/Notification');
const { asyncHandler } = require('../middlewares/errorHandler');
const { sendEmail, emailTemplates } = require('../utils/emailService');
const { sendSMS, smsTemplates } = require('../utils/smsService');
const { v4: uuidv4 } = require('uuid');

// Helper: Calculate N business days from a date
const addBusinessDays = (date, days) => {
    const result = new Date(date);
    let added = 0;
    while (added < days) {
        result.setDate(result.getDate() + 1);
        const dayOfWeek = result.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            added++;
        }
    }
    return result;
};

// Helper: Format date for display
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
};

// @desc    Book evaluation - Step 1: Create evaluation record
// @route   POST /api/evaluations/book
// @access  Private/Client
const bookEvaluation = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Check if client already has an active evaluation
    const existingEval = await Evaluation.findOne({
        clientId: userId,
        status: { $nin: ['cancelled', 'recommendations_sent'] }
    });

    if (existingEval) {
        return res.status(400).json({
            success: false,
            message: 'You already have an active evaluation. Please complete or cancel it first.',
            data: existingEval
        });
    }

    // Get client profile and check intake form
    const client = await Client.findOne({ userId });
    if (!client) {
        return res.status(400).json({
            success: false,
            message: 'Please create your client profile first.'
        });
    }

    if (!client.intake || !client.intake.intakeCompleted) {
        return res.status(400).json({
            success: false,
            message: 'Please complete your intake form before booking an evaluation.',
            redirectTo: '/client-intake'
        });
    }

    // Snapshot client intake data
    const intakeFormData = {
        clientType: client.intake.clientType,
        primaryConcerns: client.intake.primaryConcerns,
        communicationConcerns: client.intake.communicationConcerns,
        stateOfResidence: client.intake.stateOfResidence,
        additionalNotes: client.intake.additionalNotes,
        dateOfBirth: client.dateOfBirth,
        medicalHistory: client.medicalHistory,
        currentDiagnoses: client.currentDiagnoses,
        guardianName: client.guardianName,
        guardianRelation: client.guardianRelation,
    };

    // Create evaluation in pending_payment status
    const evaluation = await Evaluation.create({
        clientId: userId,
        intakeFormData,
        status: 'pending_payment',
        amountPaid: 195,
    });

    res.status(201).json({
        success: true,
        message: 'Evaluation created. Please proceed with payment.',
        data: evaluation
    });
});

// @desc    Mark evaluation as paid (called after Stripe payment)
// @route   POST /api/evaluations/payment-complete
// @access  Private/Client
const evaluationPaymentComplete = asyncHandler(async (req, res) => {
    const { evaluationId, stripeCheckoutSessionId, stripePaymentIntentId } = req.body;
    const userId = req.user._id;

    const evaluation = await Evaluation.findOne({
        _id: evaluationId,
        clientId: userId,
        status: 'pending_payment'
    });

    if (!evaluation) {
        return res.status(404).json({
            success: false,
            message: 'Evaluation not found or already paid.'
        });
    }

    evaluation.status = 'paid';
    evaluation.stripeCheckoutSessionId = stripeCheckoutSessionId;
    evaluation.stripePaymentIntentId = stripePaymentIntentId;
    await evaluation.save();

    // Set $195 evaluation credit on client
    const client = await Client.findOne({ userId });
    if (client) {
        client.evaluationCredit = {
            amount: 195,
            evaluationId: evaluation._id,
            status: 'available',
        };
        client.hasPaidEvaluationFee = true;
        await client.save();
    }

    res.json({
        success: true,
        message: 'Payment confirmed. You can now select a therapist.',
        data: evaluation
    });
});

// @desc    Get available SLP therapists (with slots after 3 business days)
// @route   GET /api/evaluations/available-therapists
// @access  Private/Client
const getAvailableTherapists = asyncHandler(async (req, res) => {
    // Only fully SLP therapists allowed for evaluations
    const therapists = await Therapist.find({
        credentials: 'SLP',
        status: 'active',
    }).populate('userId', 'firstName lastName avatar email');

    // Calculate minimum date (3 business days from now)
    const minDate = addBusinessDays(new Date(), 3);

    // Get all existing evaluations/sessions in the date range to check for conflicts
    const maxDate = new Date(minDate);
    maxDate.setDate(maxDate.getDate() + 14);

    const existingEvaluations = await Evaluation.find({
        status: { $nin: ['cancelled', 'recommendations_sent', 'pending_payment', 'pending_creation'] },
        scheduledDate: { $gte: minDate, $lte: maxDate },
    });

    const existingSessions = await Session.find({
        status: { $in: ['scheduled', 'confirmed', 'in-progress'] },
        scheduledDate: { $gte: minDate, $lte: maxDate },
    });

    // For each therapist, find available slots after the 3-day window
    const therapistsWithSlots = therapists.map(therapist => {
        const availability = therapist.availability || [];
        const availableSlots = [];
        const daysToCheck = 14; // Check next 2 weeks after the 3-day window

        for (let i = 0; i < daysToCheck; i++) {
            const checkDate = new Date(minDate);
            checkDate.setDate(checkDate.getDate() + i);
            const dayName = checkDate.toLocaleDateString('en-US', { weekday: 'long' });
            const dateStr = checkDate.toISOString().split('T')[0];

            const daySlots = availability.filter(a => a.day === dayName);
            daySlots.forEach(slot => {
                // Check for conflicts with existing evaluations/sessions
                const hasConflict = existingEvaluations.some(e =>
                    e.therapistId?.toString() === therapist._id.toString() &&
                    e.scheduledDate?.toISOString().split('T')[0] === dateStr &&
                    e.scheduledTime === slot.startTime
                ) || existingSessions.some(s =>
                    s.therapistId?.toString() === therapist._id.toString() &&
                    s.scheduledDate?.toISOString().split('T')[0] === dateStr &&
                    s.scheduledTime === slot.startTime
                );

                if (!hasConflict) {
                    availableSlots.push({
                        date: dateStr,
                        dayName,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                    });
                }
            });
        }

        return {
            _id: therapist._id,
            userId: therapist.userId,
            specializations: therapist.specializations,
            bio: therapist.bio,
            experience: therapist.experience,
            rating: therapist.rating,
            totalReviews: therapist.totalReviews,
            credentials: therapist.credentials,
            spokenLanguages: therapist.spokenLanguages,
            availableSlots,
        };
    }); // Send all active, verified SLP therapists, even if no slots available

    res.json({
        success: true,
        data: {
            therapists: therapistsWithSlots,
            minDate: minDate.toISOString().split('T')[0],
        }
    });
});

// @desc    Select therapist + time slot for evaluation
// @route   POST /api/evaluations/select-therapist
// @access  Private/Client
const selectTherapist = asyncHandler(async (req, res) => {
    const { evaluationId, therapistId, scheduledDate, scheduledTime } = req.body;
    const userId = req.user._id;

    const evaluation = await Evaluation.findOne({
        _id: evaluationId,
        clientId: userId,
        status: 'paid'
    });

    if (!evaluation) {
        return res.status(404).json({
            success: false,
            message: 'Evaluation not found or not in correct state.'
        });
    }

    // Verify therapist is SLP and active
    const therapist = await Therapist.findById(therapistId).populate('userId', 'firstName lastName email');
    if (!therapist || therapist.credentials !== 'SLP' || therapist.status !== 'active') {
        return res.status(400).json({
            success: false,
            message: 'Selected therapist is not available for evaluations.'
        });
    }

    // Verify date is at least 3 business days from now
    const minDate = addBusinessDays(new Date(), 3);
    const selectedDate = new Date(scheduledDate);
    if (selectedDate < minDate) {
        return res.status(400).json({
            success: false,
            message: 'Evaluation must be scheduled at least 3 business days from now.'
        });
    }

    // Check for double-booking conflict
    const conflict = await Evaluation.findOne({
        therapistId,
        scheduledDate: selectedDate,
        scheduledTime,
        status: { $nin: ['cancelled', 'recommendations_sent'] },
    });
    if (conflict) {
        return res.status(400).json({
            success: false,
            message: 'This time slot is already booked. Please select a different slot.'
        });
    }

    // Generate Jitsi room
    const { generateJitsiRoomName } = require('../utils/jitsiService');
    const jitsiRoomName = generateJitsiRoomName(
        evaluation._id.toString(),
        therapistId.toString(),
        userId.toString()
    );
    const meetingLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/video-call?evaluationId=${evaluation._id}`;

    // Update evaluation
    evaluation.therapistId = therapistId;
    evaluation.scheduledDate = selectedDate;
    evaluation.scheduledTime = scheduledTime;
    evaluation.jitsiRoomName = jitsiRoomName;
    evaluation.meetingLink = meetingLink;
    evaluation.status = 'therapist_assigned';
    evaluation.therapistAssignedAt = new Date();
    evaluation.therapistReviewDeadline = addBusinessDays(new Date(), 3);
    await evaluation.save();

    // Get client details for notification
    const clientUser = await User.findById(userId);
    const client = await Client.findOne({ userId });

    // Send notification to therapist
    await Notification.create({
        userId: therapist.userId._id,
        type: 'evaluation-therapist-assigned',
        title: 'New Evaluation Assignment',
        message: `You have been assigned a diagnostic evaluation for ${clientUser.firstName} ${clientUser.lastName}. Please review their details within 3 business days.`,
        link: '/my-practice',
        metadata: {
            evaluationId: evaluation._id,
            clientName: `${clientUser.firstName} ${clientUser.lastName}`,
        }
    });

    // Send SMS to therapist about new assignment
    const therapistUser2 = therapist.userId;
    if (therapistUser2.phone) {
        const msg = smsTemplates.evaluationBookedTherapist(
            therapistUser2.firstName,
            `${clientUser.firstName} ${clientUser.lastName}`
        );
        sendSMS(therapistUser2.phone, msg);
    }

    // Send SMS to client confirming booking
    if (clientUser.phone) {
        const msg = smsTemplates.evaluationBookedClient(
            clientUser.firstName,
            `${therapist.userId.firstName} ${therapist.userId.lastName}`,
            formatDate(selectedDate),
            scheduledTime
        );
        sendSMS(clientUser.phone, msg);
    }

    // Create notification for client
    await Notification.create({
        userId: userId,
        type: 'evaluation-booked',
        title: 'Evaluation Booked',
        message: `Your evaluation with ${therapist.userId.firstName} ${therapist.userId.lastName} is booked for ${formatDate(selectedDate)} at ${scheduledTime}. Your therapist will review your details within 3 business days.`,
        link: '/client-evaluation',
        metadata: {
            evaluationId: evaluation._id,
            therapistName: `${therapist.userId.firstName} ${therapist.userId.lastName}`,
        }
    });

    res.json({
        success: true,
        message: 'Therapist selected and notified. You will be contacted within 3 business days.',
        data: evaluation
    });
});

// @desc    Therapist starts reviewing (acknowledges receipt)
// @route   POST /api/evaluations/:id/start-review
// @access  Private/Therapist
const therapistStartReview = asyncHandler(async (req, res) => {
    const evaluation = await Evaluation.findById(req.params.id);

    if (!evaluation) {
        return res.status(404).json({ success: false, message: 'Evaluation not found' });
    }

    const therapist = await Therapist.findOne({ userId: req.user._id });
    if (!therapist || therapist._id.toString() !== evaluation.therapistId.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (evaluation.status === 'therapist_reviewing') {
        return res.json({ success: true, message: 'Review already started' });
    }

    if (evaluation.status !== 'therapist_assigned') {
        return res.status(400).json({
            success: false,
            message: 'Evaluation is not in the assigned state'
        });
    }

    evaluation.status = 'therapist_reviewing';
    await evaluation.save();

    // Notify client that therapist has started reviewing
    const therapistUser = await User.findById(req.user._id);
    await Notification.create({
        userId: evaluation.clientId,
        type: 'evaluation-review-started',
        title: 'Therapist Reviewing Your Details',
        message: `${therapistUser.firstName} ${therapistUser.lastName} has started reviewing your intake details. You will be notified when they are ready.`,
        link: '/client-evaluation',
        metadata: { evaluationId: evaluation._id }
    });

    res.json({
        success: true,
        message: 'Review started. Client has been notified.',
        data: evaluation
    });
});

// @desc    Therapist marks ready (after reviewing client details)
// @route   POST /api/evaluations/:id/therapist-ready
// @access  Private/Therapist
const therapistReady = asyncHandler(async (req, res) => {
    const evaluation = await Evaluation.findById(req.params.id);

    if (!evaluation) {
        return res.status(404).json({ success: false, message: 'Evaluation not found' });
    }

    // Get therapist profile
    const therapist = await Therapist.findOne({ userId: req.user._id });
    if (!therapist || therapist._id.toString() !== evaluation.therapistId.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (!['therapist_assigned', 'therapist_reviewing'].includes(evaluation.status)) {
        return res.status(400).json({
            success: false,
            message: 'Evaluation is not in the review state'
        });
    }

    const { therapistNotes } = req.body;

    evaluation.status = 'ready_for_meeting';
    evaluation.therapistReadyAt = new Date();
    if (therapistNotes) evaluation.therapistNotes = therapistNotes;
    await evaluation.save();

    // Notify client
    const clientUser = await User.findById(evaluation.clientId);
    const therapistUser = await User.findById(req.user._id);

    await Notification.create({
        userId: evaluation.clientId,
        type: 'evaluation-therapist-ready',
        title: 'Your Therapist is Ready!',
        message: `${therapistUser.firstName} ${therapistUser.lastName} has reviewed your details and is ready for your evaluation meeting on ${formatDate(evaluation.scheduledDate)} at ${evaluation.scheduledTime}.`,
        link: '/client-evaluation',
        metadata: { evaluationId: evaluation._id }
    });

    // Send SMS to client
    if (clientUser.phone) {
        const msg = smsTemplates.therapistReady(
            clientUser.firstName,
            `${therapistUser.firstName} ${therapistUser.lastName}`,
            formatDate(evaluation.scheduledDate),
            evaluation.scheduledTime
        );
        sendSMS(clientUser.phone, msg);
    }

    res.json({
        success: true,
        message: 'Marked as ready. Client has been notified.',
        data: evaluation
    });
});

// @desc    Start evaluation meeting
// @route   POST /api/evaluations/:id/start-meeting
// @access  Private
const startMeeting = asyncHandler(async (req, res) => {
    const evaluation = await Evaluation.findById(req.params.id);

    if (!evaluation) {
        return res.status(404).json({ success: false, message: 'Evaluation not found' });
    }

    if (evaluation.status === 'in_progress') {
        return res.json({
            success: true,
            data: {
                evaluationId: evaluation._id,
                jitsiRoomName: evaluation.jitsiRoomName,
                meetingLink: evaluation.meetingLink,
                duration: evaluation.duration,
                resourceLibraryAccess: true,
            }
        });
    }

    // Must be ready for meeting or meeting_scheduled
    if (!['ready_for_meeting', 'meeting_scheduled'].includes(evaluation.status)) {
        return res.status(400).json({
            success: false,
            message: 'Evaluation is not ready for meeting'
        });
    }

    evaluation.status = 'in_progress';
    evaluation.resourceLibraryAccessGranted = true; // Grant real-time resource library access during meeting
    await evaluation.save();

    res.json({
        success: true,
        data: {
            evaluationId: evaluation._id,
            jitsiRoomName: evaluation.jitsiRoomName,
            meetingLink: evaluation.meetingLink,
            duration: evaluation.duration,
            resourceLibraryAccess: true,
        }
    });
});

// @desc    Complete evaluation + send recommendations
// @route   POST /api/evaluations/:id/complete
// @access  Private/Therapist
const completeEvaluation = asyncHandler(async (req, res) => {
    const evaluation = await Evaluation.findById(req.params.id);

    if (!evaluation) {
        return res.status(404).json({ success: false, message: 'Evaluation not found' });
    }

    const therapist = await Therapist.findOne({ userId: req.user._id });
    if (!therapist || therapist._id.toString() !== evaluation.therapistId.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { subscriptionTier, notes, resourceIds, grantResourceAccess } = req.body;

    evaluation.status = 'completed';
    evaluation.completedAt = new Date();
    evaluation.recommendations = {
        subscriptionTier: subscriptionTier || null,
        notes: notes || '',
        resourceIds: resourceIds || [],
        sentAt: new Date(),
        sentBy: req.user._id,
    };
    evaluation.resourceLibraryAccessGranted = grantResourceAccess !== false;
    await evaluation.save();

    // Update client profile with recommendations
    const client = await Client.findOne({ userId: evaluation.clientId });
    if (client) {
        client.recommendations = {
            tier: subscriptionTier,
            notes: notes,
            resourceIds: resourceIds || [],
            recommendedAt: new Date(),
            recommendedBy: req.user._id,
        };
        client.hasCompletedEvaluation = true;
        await client.save();
    }

    // Send SMS with recommendations
    const clientUser = await User.findById(evaluation.clientId);
    const therapistUser = await User.findById(req.user._id);

    if (clientUser.phone) {
        const msg = smsTemplates.evaluationCompleted(
            clientUser.firstName,
            `${therapistUser.firstName} ${therapistUser.lastName}`
        );
        sendSMS(clientUser.phone, msg);
    }

    // Create notification
    await Notification.create({
        userId: evaluation.clientId,
        type: 'evaluation-recommendations',
        title: 'Evaluation Complete - Recommendations Ready',
        message: `Your evaluation is complete! ${therapistUser.firstName} has sent you personalized recommendations. Your $195 evaluation credit is ready to use!`,
        link: '/pricing?recommended=' + (subscriptionTier || ''),
        metadata: {
            evaluationId: evaluation._id,
            subscriptionTier,
        }
    });

    // Mark evaluation as recommendations sent
    evaluation.status = 'recommendations_sent';
    await evaluation.save();

    res.json({
        success: true,
        message: 'Evaluation completed and recommendations sent to client.',
        data: evaluation
    });
});

// @desc    Get client's current evaluation
// @route   GET /api/evaluations/my-evaluation
// @access  Private/Client
const getMyEvaluation = asyncHandler(async (req, res) => {
    const evaluation = await Evaluation.findOne({
        clientId: req.user._id,
    }).sort({ createdAt: -1 })
        .populate({
            path: 'therapistId',
            populate: { path: 'userId', select: 'firstName lastName avatar email' }
        });

    if (!evaluation) {
        return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: evaluation });
});

// @desc    Get evaluation by ID
// @route   GET /api/evaluations/:id
// @access  Private
const getEvaluation = asyncHandler(async (req, res) => {
    const evaluation = await Evaluation.findById(req.params.id)
        .populate('clientId', 'firstName lastName email')
        .populate({
            path: 'therapistId',
            populate: { path: 'userId', select: 'firstName lastName avatar email' }
        });

    if (!evaluation) {
        return res.status(404).json({ success: false, message: 'Evaluation not found' });
    }

    // Access control
    if (req.user.role === 'client' && evaluation.clientId._id?.toString() !== req.user._id.toString() && evaluation.clientId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (req.user.role === 'therapist') {
        const therapist = await Therapist.findOne({ userId: req.user._id });
        if (!therapist || (evaluation.therapistId && therapist._id.toString() !== evaluation.therapistId._id?.toString())) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
    }

    res.json({ success: true, data: evaluation });
});

// @desc    Get full evaluation details for therapist (includes full client intake data)
// @route   GET /api/evaluations/:id/details
// @access  Private/Therapist
const getTherapistEvaluationDetails = asyncHandler(async (req, res) => {
    const evaluation = await Evaluation.findById(req.params.id)
        .populate({
            path: 'therapistId',
            populate: { path: 'userId', select: 'firstName lastName avatar email' }
        });

    if (!evaluation) {
        return res.status(404).json({ success: false, message: 'Evaluation not found' });
    }

    const therapist = await Therapist.findOne({ userId: req.user._id });
    if (!therapist || therapist._id.toString() !== evaluation.therapistId?._id?.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Get full client details
    const clientUser = await User.findById(evaluation.clientId);
    const client = await Client.findOne({ userId: evaluation.clientId });

    res.json({
        success: true,
        data: {
            evaluation,
            clientInfo: {
                name: clientUser ? `${clientUser.firstName} ${clientUser.lastName}` : 'Unknown',
                email: clientUser?.email,
                avatar: clientUser?.avatar,
                dateOfBirth: client?.dateOfBirth,
                guardianName: client?.guardianName,
                guardianRelation: client?.guardianRelation,
                medicalHistory: client?.medicalHistory,
                currentDiagnoses: client?.currentDiagnoses,
                address: client?.address,
                emergencyContact: client?.emergencyContact,
                documents: client?.documents || [],
                intake: client?.intake,
                spokenLanguages: client?.spokenLanguages,
            }
        }
    });
});

// @desc    Get all evaluations (Admin)
// @route   GET /api/evaluations
// @access  Private/Admin
const getAllEvaluations = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};
    if (status) query.status = status;

    const evaluations = await Evaluation.find(query)
        .populate('clientId', 'firstName lastName email')
        .populate({
            path: 'therapistId',
            populate: { path: 'userId', select: 'firstName lastName' }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Evaluation.countDocuments(query);

    res.json({
        success: true,
        data: {
            evaluations,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            }
        }
    });
});

// @desc    Get therapist's assigned evaluations
// @route   GET /api/evaluations/my-assignments
// @access  Private/Therapist
const getTherapistEvaluations = asyncHandler(async (req, res) => {
    const therapist = await Therapist.findOne({ userId: req.user._id });
    if (!therapist) {
        return res.status(404).json({ success: false, message: 'Therapist profile not found' });
    }

    const evaluations = await Evaluation.find({
        therapistId: therapist._id,
        status: { $nin: ['cancelled'] }
    })
        .populate('clientId', 'firstName lastName email avatar')
        .sort({ createdAt: -1 });

    res.json({ success: true, data: evaluations });
});

// @desc    Cancel evaluation
// @route   POST /api/evaluations/:id/cancel
// @access  Private
const cancelEvaluation = asyncHandler(async (req, res) => {
    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) {
        return res.status(404).json({ success: false, message: 'Evaluation not found' });
    }

    // Only client or admin can cancel
    if (req.user.role === 'client' && evaluation.clientId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { reason } = req.body;
    evaluation.status = 'cancelled';
    evaluation.cancelledAt = new Date();
    evaluation.cancellationReason = reason || 'User cancelled';
    await evaluation.save();

    res.json({
        success: true,
        message: 'Evaluation cancelled.',
        data: evaluation
    });
});

// @desc    Admin: Assign/reassign therapist
// @route   PUT /api/evaluations/:id/assign-therapist
// @access  Private/Admin
const adminAssignTherapist = asyncHandler(async (req, res) => {
    const { therapistId } = req.body;
    const evaluation = await Evaluation.findById(req.params.id);

    if (!evaluation) {
        return res.status(404).json({ success: false, message: 'Evaluation not found' });
    }

    const therapist = await Therapist.findById(therapistId).populate('userId', 'firstName lastName email');
    if (!therapist || therapist.credentials !== 'SLP') {
        return res.status(400).json({ success: false, message: 'Therapist not found or not SLP' });
    }

    evaluation.therapistId = therapistId;
    evaluation.status = 'therapist_assigned';
    evaluation.therapistAssignedAt = new Date();
    evaluation.therapistReviewDeadline = addBusinessDays(new Date(), 3);
    await evaluation.save();

    // Notify therapist
    await Notification.create({
        userId: therapist.userId._id,
        type: 'evaluation-therapist-assigned',
        title: 'Evaluation Assignment (Admin)',
        message: 'You have been assigned a new evaluation by admin.',
        link: '/my-practice',
        metadata: { evaluationId: evaluation._id }
    });

    res.json({ success: true, data: evaluation });
});

module.exports = {
    bookEvaluation,
    evaluationPaymentComplete,
    getAvailableTherapists,
    selectTherapist,
    therapistStartReview,
    therapistReady,
    startMeeting,
    completeEvaluation,
    getMyEvaluation,
    getEvaluation,
    getTherapistEvaluationDetails,
    getAllEvaluations,
    getTherapistEvaluations,
    cancelEvaluation,
    adminAssignTherapist,
};
