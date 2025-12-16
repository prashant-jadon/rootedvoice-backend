const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
  getFamilyCoachingSessions,
  getFamilyCoachingSession,
  createFamilyCoachingSession,
  updateFamilyCoachingSession,
  cancelFamilyCoachingSession,
} = require('../controllers/familyCoachingController');

// All routes require authentication
router.use(protect);

router.get('/', getFamilyCoachingSessions);
router.get('/:id', getFamilyCoachingSession);
router.post('/', createFamilyCoachingSession);
router.put('/:id', updateFamilyCoachingSession);
router.delete('/:id', cancelFamilyCoachingSession);

module.exports = router;

