const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const {
  getClients,
  getClient,
  getMyProfile,
  createOrUpdateClient,
  uploadDocument,
  getDocuments,
  deleteDocument,
  getTherapyTimeline,
  searchDocuments,
} = require('../controllers/clientController');
const { protect } = require('../middlewares/auth');
const { isTherapist, isClient } = require('../middlewares/roleCheck');

// Therapist routes
router.get('/', protect, isTherapist, getClients);

// Client routes
router.get('/me', protect, isClient, getMyProfile);
router.post('/', protect, isClient, createOrUpdateClient);
router.put('/me', protect, isClient, createOrUpdateClient);

// Shared routes
router.get('/:id', protect, getClient);
router.post('/:id/documents', protect, upload.single('document'), uploadDocument);
router.get('/:id/documents', protect, getDocuments);
router.get('/:id/documents/search', protect, searchDocuments);
router.delete('/:id/documents/:docId', protect, deleteDocument);
router.get('/:id/timeline', protect, getTherapyTimeline);

module.exports = router;

