const mongoose = require('mongoose');

const familyCoachingSessionSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
  },
  therapistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Therapist',
    required: true,
  },
  scheduledDate: {
    type: Date,
    required: [true, 'Scheduled date is required'],
  },
  scheduledTime: {
    type: String,
    required: [true, 'Scheduled time is required'],
  },
  duration: {
    type: Number,
    required: true,
    default: 60, // minutes
    min: [30, 'Duration must be at least 30 minutes'],
    max: [120, 'Duration cannot exceed 120 minutes'],
  },
  sessionType: {
    type: String,
    enum: ['family-coaching', 'caregiver-training', 'support-session'],
    default: 'family-coaching',
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show', 'rescheduled'],
    default: 'scheduled',
  },
  meetingLink: {
    type: String,
  },
  jitsiRoomName: {
    type: String,
  },
  participants: [{
    name: {
      type: String,
      required: true,
    },
    relationship: {
      type: String,
      enum: ['parent', 'guardian', 'sibling', 'family-member', 'caregiver', 'other'],
    },
    email: String,
    phone: String,
  }],
  topics: [{
    type: String,
  }],
  notes: {
    type: String,
    maxlength: 5000,
  },
  goals: {
    type: String,
    maxlength: 2000,
  },
  outcomes: {
    type: String,
    maxlength: 2000,
  },
  price: {
    type: Number,
    default: 0, // Included in Flourish tier, but can be charged separately if needed
  },
  paymentStatus: {
    type: String,
    enum: ['included', 'pending', 'completed', 'refunded', 'failed'],
    default: 'included', // Included in subscription
  },
  cancellationReason: {
    type: String,
  },
  cancelledAt: {
    type: Date,
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  actualStartTime: {
    type: Date,
  },
  actualEndTime: {
    type: Date,
  },
  reminder24hSent: {
    type: Boolean,
    default: false,
  },
  reminder45mSent: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Indexes
familyCoachingSessionSchema.index({ clientId: 1, scheduledDate: -1 });
familyCoachingSessionSchema.index({ therapistId: 1, scheduledDate: -1 });
familyCoachingSessionSchema.index({ status: 1 });
familyCoachingSessionSchema.index({ scheduledDate: 1 });
familyCoachingSessionSchema.index({ clientId: 1, status: 1, scheduledDate: 1 });
familyCoachingSessionSchema.index({ therapistId: 1, status: 1, scheduledDate: 1 });

// Virtual for actual duration
familyCoachingSessionSchema.virtual('actualDuration').get(function() {
  if (this.actualStartTime && this.actualEndTime) {
    return (this.actualEndTime - this.actualStartTime) / (1000 * 60); // minutes
  }
  return null;
});

const FamilyCoachingSession = mongoose.model('FamilyCoachingSession', familyCoachingSessionSchema);

module.exports = FamilyCoachingSession;

