const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
  },
  description: {
    type: String,
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    index: true,
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
  },
  location: {
    type: String,
    default: 'Online',
  },
  meetingLink: {
    type: String,
    required: true,
  },
  jitsiRoomName: {
    type: String,
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'rescheduled'],
    default: 'scheduled',
  },
  reminders: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'push', 'in-app'],
      default: 'email',
    },
    minutesBefore: {
      type: Number,
      default: 15,
    },
    sent: {
      type: Boolean,
      default: false,
    },
    sentAt: Date,
  }],
  isAllDay: {
    type: Boolean,
    default: false,
  },
  timezone: {
    type: String,
    default: 'UTC',
  },
  color: {
    type: String,
    default: '#3B82F6', // Blue
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
calendarEventSchema.index({ userId: 1, startDate: 1 });
calendarEventSchema.index({ sessionId: 1 });
calendarEventSchema.index({ startDate: 1, endDate: 1 });
calendarEventSchema.index({ status: 1 });

// Virtual for duration in minutes
calendarEventSchema.virtual('duration').get(function() {
  return Math.round((this.endDate - this.startDate) / (1000 * 60));
});

// Method to check if event is upcoming
calendarEventSchema.methods.isUpcoming = function() {
  return this.startDate > new Date() && this.status !== 'cancelled';
};

// Method to check if event is past
calendarEventSchema.methods.isPast = function() {
  return this.endDate < new Date();
};

// Static method to get upcoming events for a user
calendarEventSchema.statics.getUpcomingEvents = function(userId, limit = 10) {
  return this.find({
    userId,
    startDate: { $gte: new Date() },
    status: { $ne: 'cancelled' },
  })
    .populate('sessionId')
    .sort({ startDate: 1 })
    .limit(limit);
};

// Static method to get events for a date range
calendarEventSchema.statics.getEventsByDateRange = function(userId, startDate, endDate) {
  return this.find({
    userId,
    startDate: { $gte: startDate, $lte: endDate },
    status: { $ne: 'cancelled' },
  })
    .populate('sessionId')
    .sort({ startDate: 1 });
};

const CalendarEvent = mongoose.model('CalendarEvent', calendarEventSchema);

module.exports = CalendarEvent;

