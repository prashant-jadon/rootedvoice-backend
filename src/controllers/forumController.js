const ForumPost = require('../models/ForumPost');
const ForumReply = require('../models/ForumReply');
const User = require('../models/User');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Get all forum posts
// @route   GET /api/forum/posts
// @access  Public (or Private for filtered content)
const getPosts = asyncHandler(async (req, res) => {
  const { category, search, page = 1, limit = 20, sort = 'lastActivityAt' } = req.query;

  const filter = { isDeleted: false };

  if (category) {
    filter.category = category;
  }

  if (search) {
    filter.$text = { $search: search };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  let sortOption = {};
  if (sort === 'lastActivityAt') {
    sortOption = { isPinned: -1, lastActivityAt: -1 };
  } else if (sort === 'createdAt') {
    sortOption = { isPinned: -1, createdAt: -1 };
  } else if (sort === 'replyCount') {
    sortOption = { isPinned: -1, replyCount: -1 };
  }

  const posts = await ForumPost.find(filter)
    .populate('authorId', 'firstName lastName email avatar')
    .sort(sortOption)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await ForumPost.countDocuments(filter);

  res.json({
    success: true,
    data: posts,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// @desc    Get post by ID
// @route   GET /api/forum/posts/:id
// @access  Public
const getPost = asyncHandler(async (req, res) => {
  const post = await ForumPost.findById(req.params.id)
    .populate('authorId', 'firstName lastName email avatar');

  if (!post || post.isDeleted) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  // Increment view count
  post.viewCount += 1;
  await post.save();

  // Get replies
  const replies = await ForumReply.find({ postId: post._id, isDeleted: false })
    .populate('authorId', 'firstName lastName email avatar')
    .populate('parentReplyId')
    .sort({ createdAt: 1 });

  res.json({
    success: true,
    data: {
      post,
      replies,
    },
  });
});

// @desc    Create new post
// @route   POST /api/forum/posts
// @access  Private
const createPost = asyncHandler(async (req, res) => {
  const { title, content, category, tags } = req.body;

  const post = await ForumPost.create({
    authorId: req.user._id,
    title,
    content,
    category: category || 'general',
    tags: tags || [],
  });

  const populatedPost = await ForumPost.findById(post._id)
    .populate('authorId', 'firstName lastName email avatar');

  res.status(201).json({
    success: true,
    message: 'Post created successfully',
    data: populatedPost,
  });
});

// @desc    Update post
// @route   PUT /api/forum/posts/:id
// @access  Private (Author or Admin)
const updatePost = asyncHandler(async (req, res) => {
  const post = await ForumPost.findById(req.params.id);

  if (!post || post.isDeleted) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  // Check authorization
  if (post.authorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const updatedPost = await ForumPost.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('authorId', 'firstName lastName email avatar');

  res.json({
    success: true,
    message: 'Post updated successfully',
    data: updatedPost,
  });
});

// @desc    Delete post
// @route   DELETE /api/forum/posts/:id
// @access  Private (Author or Admin)
const deletePost = asyncHandler(async (req, res) => {
  const post = await ForumPost.findById(req.params.id);

  if (!post || post.isDeleted) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  // Check authorization
  if (post.authorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  // Soft delete
  post.isDeleted = true;
  await post.save();

  res.json({
    success: true,
    message: 'Post deleted successfully',
  });
});

// @desc    Like/Unlike post
// @route   POST /api/forum/posts/:id/like
// @access  Private
const toggleLikePost = asyncHandler(async (req, res) => {
  const post = await ForumPost.findById(req.params.id);

  if (!post || post.isDeleted) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  const userId = req.user._id;
  const isLiked = post.likes.includes(userId);

  if (isLiked) {
    post.likes = post.likes.filter(id => id.toString() !== userId.toString());
  } else {
    post.likes.push(userId);
  }

  await post.save();

  res.json({
    success: true,
    message: isLiked ? 'Post unliked' : 'Post liked',
    data: {
      liked: !isLiked,
      likeCount: post.likes.length,
    },
  });
});

// @desc    Pin/Unpin post (Admin only)
// @route   POST /api/forum/posts/:id/pin
// @access  Private/Admin
const togglePinPost = asyncHandler(async (req, res) => {
  const post = await ForumPost.findById(req.params.id);

  if (!post || post.isDeleted) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  post.isPinned = !post.isPinned;
  await post.save();

  res.json({
    success: true,
    message: post.isPinned ? 'Post pinned' : 'Post unpinned',
    data: post,
  });
});

// @desc    Create reply to post
// @route   POST /api/forum/posts/:id/replies
// @access  Private
const createReply = asyncHandler(async (req, res) => {
  const { content, parentReplyId } = req.body;
  const postId = req.params.id;

  const post = await ForumPost.findById(postId);

  if (!post || post.isDeleted) {
    return res.status(404).json({
      success: false,
      message: 'Post not found',
    });
  }

  if (post.isLocked) {
    return res.status(403).json({
      success: false,
      message: 'Post is locked',
    });
  }

  const reply = await ForumReply.create({
    postId,
    authorId: req.user._id,
    content,
    parentReplyId: parentReplyId || null,
  });

  // Update post reply count and last activity
  post.replyCount += 1;
  post.lastActivityAt = new Date();
  await post.save();

  const populatedReply = await ForumReply.findById(reply._id)
    .populate('authorId', 'firstName lastName email avatar')
    .populate('parentReplyId');

  res.status(201).json({
    success: true,
    message: 'Reply created successfully',
    data: populatedReply,
  });
});

// @desc    Update reply
// @route   PUT /api/forum/replies/:id
// @access  Private (Author or Admin)
const updateReply = asyncHandler(async (req, res) => {
  const reply = await ForumReply.findById(req.params.id);

  if (!reply || reply.isDeleted) {
    return res.status(404).json({
      success: false,
      message: 'Reply not found',
    });
  }

  // Check authorization
  if (reply.authorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  reply.content = req.body.content;
  reply.isEdited = true;
  reply.editedAt = new Date();
  await reply.save();

  const populatedReply = await ForumReply.findById(reply._id)
    .populate('authorId', 'firstName lastName email avatar')
    .populate('parentReplyId');

  res.json({
    success: true,
    message: 'Reply updated successfully',
    data: populatedReply,
  });
});

// @desc    Delete reply
// @route   DELETE /api/forum/replies/:id
// @access  Private (Author or Admin)
const deleteReply = asyncHandler(async (req, res) => {
  const reply = await ForumReply.findById(req.params.id);

  if (!reply || reply.isDeleted) {
    return res.status(404).json({
      success: false,
      message: 'Reply not found',
    });
  }

  // Check authorization
  if (reply.authorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  // Soft delete
  reply.isDeleted = true;
  await reply.save();

  // Update post reply count
  const post = await ForumPost.findById(reply.postId);
  if (post) {
    post.replyCount = Math.max(0, post.replyCount - 1);
    await post.save();
  }

  res.json({
    success: true,
    message: 'Reply deleted successfully',
  });
});

// @desc    Like/Unlike reply
// @route   POST /api/forum/replies/:id/like
// @access  Private
const toggleLikeReply = asyncHandler(async (req, res) => {
  const reply = await ForumReply.findById(req.params.id);

  if (!reply || reply.isDeleted) {
    return res.status(404).json({
      success: false,
      message: 'Reply not found',
    });
  }

  const userId = req.user._id;
  const isLiked = reply.likes.includes(userId);

  if (isLiked) {
    reply.likes = reply.likes.filter(id => id.toString() !== userId.toString());
  } else {
    reply.likes.push(userId);
  }

  await reply.save();

  res.json({
    success: true,
    message: isLiked ? 'Reply unliked' : 'Reply liked',
    data: {
      liked: !isLiked,
      likeCount: reply.likes.length,
    },
  });
});

module.exports = {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  toggleLikePost,
  togglePinPost,
  createReply,
  updateReply,
  deleteReply,
  toggleLikeReply,
};

