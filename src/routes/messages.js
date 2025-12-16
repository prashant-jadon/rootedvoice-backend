const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const { protect } = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/roleCheck');
const {
  getSupportAgent,
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  deleteMessage,
  getSupportConversations,
  getAdminConversation,
  sendAdminReply,
} = require('../controllers/messageController');

// All message routes require authentication
router.use(protect);

// Public message routes
router.get('/support-agent', getSupportAgent);
router.get('/conversations', getConversations);
router.get('/:userId', getMessages);
router.post('/', upload.array('attachments', 5), sendMessage);
router.put('/read', markAsRead);
router.delete('/:id', deleteMessage);

// Admin-only routes for support chat
router.get('/admin/support-conversations', isAdmin, getSupportConversations);
router.get('/admin/conversation/:userId', isAdmin, getAdminConversation);
router.post('/admin/reply', isAdmin, upload.array('attachments', 5), sendAdminReply);

module.exports = router;

