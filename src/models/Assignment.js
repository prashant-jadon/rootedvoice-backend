const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
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
  goalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Goal',
  },
  title: {
    type: String,
    required: [true, 'Assignment title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    required: [true, 'Assignment description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
  },
  type: {
    type: String,
    enum: ['daily-practice', 'video-exercise', 'reflection', 'reading', 'worksheet', 'other'],
    default: 'daily-practice',
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
  },
  completed: {
    type: Boolean,
    default: false,
  },
  completedAt: {
    type: Date,
  },
  instructions: {
    type: String,
    maxlength: 2000,
  },
  attachments: [{
    fileName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileType: String,
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  feedback: {
    type: String,
    maxlength: 1000,
  },
  feedbackDate: {
    type: Date,
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
  },
}, {
  timestamps: true,
});

// Indexes
assignmentSchema.index({ clientId: 1, completed: 1, dueDate: 1 });
assignmentSchema.index({ therapistId: 1 });
assignmentSchema.index({ goalId: 1 });
assignmentSchema.index({ dueDate: 1 });

// Virtual for overdue status
assignmentSchema.virtual('isOverdue').get(function() {
  if (this.completed) return false;
  return new Date() > new Date(this.dueDate);
});

const Assignment = mongoose.model('Assignment', assignmentSchema);

module.exports = Assignment;

