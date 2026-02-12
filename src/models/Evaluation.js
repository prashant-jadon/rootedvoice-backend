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
        required: false // Can be assigned later
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        required: false // Linked to the initial evaluation session
    },
    status: {
        type: String,
        enum: ['pending_creation', 'assigned', 'in_progress', 'completed', 'reviewed'],
        default: 'pending_creation'
    },
    // Dynamic Questionnaire Structure
    questions: [{
        id: { type: String, required: true }, // unique id for the question
        text: { type: String, required: true },
        type: {
            type: String,
            enum: ['text', 'textarea', 'radio', 'checkbox', 'select'],
            default: 'text'
        },
        options: [{ type: String }], // For radio/select/checkbox
        required: { type: Boolean, default: true }
    }],
    // Client Answers
    answers: [{
        questionId: { type: String },
        answer: { type: mongoose.Schema.Types.Mixed }, // String or Array
        submittedAt: { type: Date }
    }],
    adminNotes: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
evaluationSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const Evaluation = mongoose.model('Evaluation', evaluationSchema);

module.exports = Evaluation;
