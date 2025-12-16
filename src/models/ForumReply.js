const mongoose = require('mongoose');

const forumReplySchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumPost',
    required: true,
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: [true, 'Reply content is required'],
    maxlength: [2000, 'Reply cannot exceed 2000 characters'],
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  parentReplyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumReply',
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  isEdited: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Indexes
forumReplySchema.index({ postId: 1, createdAt: 1 });
forumReplySchema.index({ authorId: 1 });
forumReplySchema.index({ parentReplyId: 1 });
forumReplySchema.index({ isDeleted: 1 });

// Virtual for like count
forumReplySchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Update post reply count after save
forumReplySchema.post('save', async function() {
  await mongoose.model('ForumPost').findByIdAndUpdate(
    this.postId,
    { 
      $inc: { replyCount: 1 },
      lastActivityAt: new Date()
    }
  );
});

const ForumReply = mongoose.model('ForumReply', forumReplySchema);

module.exports = ForumReply;

