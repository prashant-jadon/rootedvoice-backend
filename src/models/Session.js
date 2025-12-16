const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
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
    required: [true, 'Duration is required'],
    default: 45, // minutes
    min: [15, 'Duration must be at least 15 minutes'],
    max: [120, 'Duration cannot exceed 120 minutes'],
  },
  sessionType: {
    type: String,
    enum: ['initial', 'follow-up', 'assessment', 'maintenance', 'consultation'],
    default: 'follow-up',
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
  calendarEventId: {
    type: String,
  },
  calendarProvider: {
    type: String,
    enum: ['google', 'outlook', 'apple', 'none'],
    default: 'none',
  },
  notes: {
    type: String,
    maxlength: 5000,
  },
  soapNote: {
    subjective: String,
    objective: String,
    assessment: String,
    plan: String,
    generatedAt: Date,
    aiGenerated: {
      type: Boolean,
      default: false,
    },
  },
  recording: {
    url: String,
    duration: Number,
    consentGiven: {
      type: Boolean,
      default: false,
    },
  },
  transcript: {
    originalLanguage: {
      type: String,
      default: 'en',
    },
    text: String,
    translatedText: {
      type: Map,
      of: String, // Map of language code -> translated text
    },
    createdAt: Date,
  },
  translationEnabled: {
    type: Boolean,
    default: false,
  },
  sourceLanguage: {
    type: String,
    default: 'en',
  },
  targetLanguage: {
    type: String,
    default: 'en',
  },
  price: {
    type: Number,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'refunded', 'failed'],
    default: 'pending',
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
sessionSchema.index({ therapistId: 1, scheduledDate: -1 });
sessionSchema.index({ clientId: 1, scheduledDate: -1 });
sessionSchema.index({ status: 1 });
sessionSchema.index({ scheduledDate: 1 });
sessionSchema.index({ paymentStatus: 1 });

// Compound index for upcoming sessions
sessionSchema.index({ therapistId: 1, status: 1, scheduledDate: 1 });
sessionSchema.index({ clientId: 1, status: 1, scheduledDate: 1 });

// Virtual for actual duration
sessionSchema.virtual('actualDuration').get(function() {
  if (this.actualStartTime && this.actualEndTime) {
    return Math.round((this.actualEndTime - this.actualStartTime) / 60000); // in minutes
  }
  return null;
});

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;

