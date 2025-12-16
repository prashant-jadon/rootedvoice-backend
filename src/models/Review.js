const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  therapistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Therapist',
    required: true,
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [1000, 'Comment cannot exceed 1000 characters'],
  },
  isAnonymous: {
    type: Boolean,
    default: false,
  },
  response: {
    type: String,
    trim: true,
    maxlength: [500, 'Response cannot exceed 500 characters'],
  },
  respondedAt: {
    type: Date,
  },
  isPublic: {
    type: Boolean,
    default: true,
  },
  isReported: {
    type: Boolean,
    default: false,
  },
  reportReason: {
    type: String,
  },
}, {
  timestamps: true,
});

// Indexes
reviewSchema.index({ therapistId: 1, createdAt: -1 });
reviewSchema.index({ clientId: 1 });
reviewSchema.index({ sessionId: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ isPublic: 1 });

// Ensure one review per session
reviewSchema.index({ sessionId: 1 }, { unique: true });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;

