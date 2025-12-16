const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Therapist',
    required: true,
  },
  title: {
    type: String,
    required: [true, 'Resource title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    required: [true, 'Resource description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
  },
  category: {
    type: String,
    enum: ['worksheet', 'assessment', 'video', 'audio', 'exercise', 'template', 'guide', 'other'],
    required: true,
  },
  ageGroup: [{
    type: String,
    enum: ['0-3', '3-12', '13-18', '18-65', '65+'],
  }],
  disorderType: [{
    type: String,
    trim: true,
  }],
  goalType: [{
    type: String,
    enum: ['articulation', 'language', 'fluency', 'voice', 'swallowing', 'cognitive', 'social', 'other'],
  }],
  accessLevel: {
    type: String,
    enum: ['SLP', 'SLPA', 'public'],
    default: 'SLP',
  },
  fileUrl: {
    type: String,
    required: [true, 'File URL is required'],
  },
  thumbnailUrl: {
    type: String,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  fileType: {
    type: String,
    required: true,
  },
  downloads: {
    type: Number,
    default: 0,
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  isApproved: {
    type: Boolean,
    default: false,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: {
    type: Date,
  },
  isPublic: {
    type: Boolean,
    default: false,
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  ratingCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Indexes
resourceSchema.index({ uploadedBy: 1 });
resourceSchema.index({ category: 1 });
resourceSchema.index({ ageGroup: 1 });
resourceSchema.index({ tags: 1 });
resourceSchema.index({ accessLevel: 1 });
resourceSchema.index({ isApproved: 1 });
resourceSchema.index({ isPublic: 1 });
resourceSchema.index({ downloads: -1 });

// Text index for search
resourceSchema.index({ title: 'text', description: 'text', tags: 'text' });

const Resource = mongoose.model('Resource', resourceSchema);

module.exports = Resource;

