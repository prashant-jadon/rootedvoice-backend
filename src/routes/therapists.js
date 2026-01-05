const express = require('express');
const router = express.Router();
const {
  getTherapists,
  getTherapist,
  getMyProfile,
  createOrUpdateTherapist,
  updateAvailability,
  getTherapistStats,
  uploadDocuments,
} = require('../controllers/therapistController');
const { protect, optionalAuth } = require('../middlewares/auth');
const { isTherapist } = require('../middlewares/roleCheck');
const upload = require('../config/multer');

// Public routes
router.get('/', optionalAuth, getTherapists);

// Protected routes - Therapist only
router.get('/me', protect, isTherapist, getMyProfile);
router.post('/', protect, isTherapist, createOrUpdateTherapist);
router.post('/upload-documents', protect, isTherapist, upload.fields([
  { name: 'spaMembership', maxCount: 1 },
  { name: 'stateRegistration', maxCount: 1 },
  { name: 'professionalIndemnityInsurance', maxCount: 1 },
  { name: 'workingWithChildrenCheck', maxCount: 1 },
  { name: 'policeCheck', maxCount: 1 },
  { name: 'academicQualification', maxCount: 5 },
  { name: 'additionalCredential', maxCount: 5 },
]), uploadDocuments);
router.put('/:id/availability', protect, isTherapist, updateAvailability);
router.get('/:id/stats', protect, getTherapistStats);

// Public/shared routes (must be after /me to avoid conflicts)
router.get('/:id', optionalAuth, getTherapist);

module.exports = router;

