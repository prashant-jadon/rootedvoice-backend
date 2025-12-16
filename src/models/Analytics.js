const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  therapistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Therapist',
    required: true,
  },
  period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  metrics: {
    totalSessions: {
      type: Number,
      default: 0,
    },
    completedSessions: {
      type: Number,
      default: 0,
    },
    cancelledSessions: {
      type: Number,
      default: 0,
    },
    noShows: {
      type: Number,
      default: 0,
    },
    revenue: {
      type: Number,
      default: 0,
    },
    newClients: {
      type: Number,
      default: 0,
    },
    activeClients: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
    },
    averageSessionDuration: {
      type: Number,
      default: 0,
    },
    totalMinutes: {
      type: Number,
      default: 0,
    },
    clientRetentionRate: {
      type: Number,
      default: 0,
    },
    responseTime: {
      type: Number,
      default: 0,
    },
  },
  caseloadByAge: {
    '0-3': { type: Number, default: 0 },
    '3-12': { type: Number, default: 0 },
    '13-18': { type: Number, default: 0 },
    '18-65': { type: Number, default: 0 },
    '65+': { type: Number, default: 0 },
  },
  caseloadByDisorder: [{
    disorder: String,
    count: Number,
  }],
}, {
  timestamps: true,
});

// Indexes
analyticsSchema.index({ therapistId: 1, period: 1, date: -1 });
analyticsSchema.index({ date: -1 });

// Compound unique index to prevent duplicates
analyticsSchema.index(
  { therapistId: 1, period: 1, date: 1 },
  { unique: true }
);

const Analytics = mongoose.model('Analytics', analyticsSchema);

module.exports = Analytics;

