const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const { protect } = require('../middlewares/auth');
const { isTherapist } = require('../middlewares/roleCheck');
const {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  addFeedback,
  deleteAssignment,
} = require('../controllers/assignmentController');

// All assignment routes require authentication
router.use(protect);

// Routes accessible to both therapist and client
router.get('/', getAssignments);
router.get('/:id', getAssignment);

// Therapist-only routes
router.post('/', isTherapist, createAssignment);
router.put('/:id', updateAssignment);
router.post('/:id/feedback', isTherapist, addFeedback);
router.delete('/:id', isTherapist, deleteAssignment);

module.exports = router;

