const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
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
  title: {
    type: String,
    required: [true, 'Goal title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    required: [true, 'Goal description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
  },
  category: {
    type: String,
    enum: ['articulation', 'language', 'fluency', 'voice', 'swallowing', 'cognitive', 'social', 'other'],
    required: true,
  },
  targetDate: {
    type: Date,
    required: [true, 'Target date is required'],
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'discontinued', 'on-hold'],
    default: 'active',
  },
  progress: {
    type: Number,
    default: 0, // Goals start at 0% - progress is updated by therapist based on clinical assessment
    min: 0,
    max: 100,
  },
  milestones: [{
    description: {
      type: String,
      required: true,
    },
    targetDate: Date,
    completed: {
      type: Boolean,
      default: false,
    },
    completedDate: Date,
    notes: String,
  }],
  baseline: {
    type: String,
    maxlength: 500,
  },
  measurementCriteria: {
    type: String,
    maxlength: 500,
  },
}, {
  timestamps: true,
});

// Indexes
goalSchema.index({ clientId: 1, status: 1 });
goalSchema.index({ therapistId: 1 });
goalSchema.index({ category: 1 });
goalSchema.index({ targetDate: 1 });

// Virtual for days remaining
goalSchema.virtual('daysRemaining').get(function() {
  if (!this.targetDate) return null;
  const today = new Date();
  const target = new Date(this.targetDate);
  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for completed milestones count
goalSchema.virtual('completedMilestones').get(function() {
  return this.milestones.filter(m => m.completed).length;
});

const Goal = mongoose.model('Goal', goalSchema);

module.exports = Goal;

