const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middlewares/auth');
const { isTherapist } = require('../middlewares/roleCheck');
const {
  getResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  aiSearchResources,
} = require('../controllers/resourceController');

// Public routes (optional auth for access level filtering)
router.get('/', optionalAuth, getResources);
router.get('/ai-search', optionalAuth, aiSearchResources);
router.get('/:id', optionalAuth, getResource);

// Protected routes
router.use(protect);
router.use(isTherapist);

router.post('/', createResource);
router.put('/:id', updateResource);
router.delete('/:id', deleteResource);

module.exports = router;

