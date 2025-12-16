const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/roleCheck');
const {
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
} = require('../controllers/forumController');

// Public routes (optional auth for personalized content)
router.get('/posts', optionalAuth, getPosts);
router.get('/posts/:id', optionalAuth, getPost);

// Protected routes
router.use(protect);

router.post('/posts', createPost);
router.put('/posts/:id', updatePost);
router.delete('/posts/:id', deletePost);
router.post('/posts/:id/like', toggleLikePost);
router.post('/posts/:id/pin', isAdmin, togglePinPost);
router.post('/posts/:id/replies', createReply);
router.put('/replies/:id', updateReply);
router.delete('/replies/:id', deleteReply);
router.post('/replies/:id/like', toggleLikeReply);

module.exports = router;

