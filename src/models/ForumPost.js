const mongoose = require('mongoose');

const forumPostSchema = new mongoose.Schema({
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: [true, 'Post title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  content: {
    type: String,
    required: [true, 'Post content is required'],
    maxlength: [5000, 'Content cannot exceed 5000 characters'],
  },
  category: {
    type: String,
    enum: ['general', 'case-studies', 'resources', 'questions', 'tips', 'announcements', 'other'],
    default: 'general',
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  isPinned: {
    type: Boolean,
    default: false,
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  viewCount: {
    type: Number,
    default: 0,
  },
  replyCount: {
    type: Number,
    default: 0,
  },
  lastActivityAt: {
    type: Date,
    default: Date.now,
  },
  isLocked: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Indexes
forumPostSchema.index({ authorId: 1, createdAt: -1 });
forumPostSchema.index({ category: 1, lastActivityAt: -1 });
forumPostSchema.index({ tags: 1 });
forumPostSchema.index({ isPinned: -1, lastActivityAt: -1 });
forumPostSchema.index({ isDeleted: 1 });

// Text index for search
forumPostSchema.index({ title: 'text', content: 'text', tags: 'text' });

// Virtual for like count
forumPostSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

const ForumPost = mongoose.model('ForumPost', forumPostSchema);

module.exports = ForumPost;

