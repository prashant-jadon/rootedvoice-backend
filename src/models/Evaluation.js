const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    therapistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Therapist',
        required: false
    },
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        required: false
    },
    // Snapshot of intake data at time of booking
    intakeFormData: {
        clientType: String,
        primaryConcerns: String,
        communicationConcerns: String,
        stateOfResidence: String,
        additionalNotes: String,
        dateOfBirth: Date,
        medicalHistory: String,
        currentDiagnoses: [String],
        guardianName: String,
        guardianRelation: String,
    },
    status: {
        type: String,
        enum: [
            'pending_creation',      // Evaluation record created, e.g. from subscription verify-checkout
            'pending_payment',       // Evaluation created, waiting for $195 payment
            'intake_submitted',      // Intake form submitted
            'paid',                  // $195 paid, ready for therapist selection
            'awaiting_therapist_selection', // Waiting for client to pick therapist
            'therapist_assigned',    // Therapist assigned, review period starts
            'therapist_reviewing',   // Therapist is reviewing (3-day window)
            'ready_for_meeting',     // Therapist has reviewed, ready for meeting
            'meeting_scheduled',     // Meeting date confirmed
            'in_progress',           // Meeting is happening
            'completed',             // Evaluation done, recommendations pending
            'recommendations_sent',  // Recommendations sent to client
            'cancelled'              // Cancelled
        ],
        default: 'pending_payment'
    },
    // Payment info
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    },
    stripePaymentIntentId: String,
    stripeCheckoutSessionId: String,
    amountPaid: {
        type: Number,
        default: 195
    },
    // Scheduling
    scheduledDate: Date,
    scheduledTime: String,
    meetingLink: String,
    jitsiRoomName: String,
    duration: {
        type: Number,
        default: 60 // 60-minute evaluation
    },
    // Therapist review
    therapistAssignedAt: Date,
    therapistReviewDeadline: Date, // 3 business days from assignment
    therapistReadyAt: Date,
    therapistNotes: String,
    // Recommendations
    recommendations: {
        subscriptionTier: String,
        notes: String,
        resourceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
        sentAt: Date,
        sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
    // Resource library access
    resourceLibraryAccessGranted: {
        type: Boolean,
        default: false
    },
    completedAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
}, {
    timestamps: true,
});

// Indexes
evaluationSchema.index({ clientId: 1 });
evaluationSchema.index({ therapistId: 1 });
evaluationSchema.index({ status: 1 });
evaluationSchema.index({ scheduledDate: 1 });
evaluationSchema.index({ therapistReviewDeadline: 1 });

// Helper: Calculate 3 business days from a date
evaluationSchema.statics.getThreeBusinessDaysFromNow = function () {
    const date = new Date();
    let businessDays = 0;
    while (businessDays < 3) {
        date.setDate(date.getDate() + 1);
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
            businessDays++;
        }
    }
    return date;
};

const Evaluation = mongoose.model('Evaluation', evaluationSchema);

module.exports = Evaluation;
