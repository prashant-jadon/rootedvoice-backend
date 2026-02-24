const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middlewares/auth');
const { authorize, isAdmin } = require('../middlewares/roleCheck');
const upload = require('../config/multer');
const { uploadLimiter } = require('../middlewares/rateLimiter');
const {
  getResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  aiSearchResources,
  approveResource,
} = require('../controllers/resourceController');

// Public routes (optional auth for access level filtering)
router.get('/', optionalAuth, getResources);
router.get('/ai-search', optionalAuth, aiSearchResources);
router.get('/:id', optionalAuth, getResource);

// Protected routes
router.use(protect);
router.use(authorize('therapist', 'admin'));

router.post('/', uploadLimiter, upload.single('resource'), createResource);
router.put('/:id', uploadLimiter, upload.single('resource'), updateResource);
router.delete('/:id', deleteResource);

// Admin-only route
router.put('/:id/approve', isAdmin, approveResource);

module.exports = router;

