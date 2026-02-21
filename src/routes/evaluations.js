const express = require('express');
const router = express.Router();
const {
    bookEvaluation,
    evaluationPaymentComplete,
    getAvailableTherapists,
    selectTherapist,
    therapistStartReview,
    therapistReady,
    startMeeting,
    completeEvaluation,
    getMyEvaluation,
    getEvaluation,
    getTherapistEvaluationDetails,
    getAllEvaluations,
    getTherapistEvaluations,
    cancelEvaluation,
    adminAssignTherapist,
} = require('../controllers/evaluationController');

const { protect, authorize } = require('../middlewares/auth');

// All routes are protected
router.use(protect);

// Client routes
router.post('/book', authorize('client'), bookEvaluation);
router.post('/payment-complete', authorize('client'), evaluationPaymentComplete);
router.get('/available-therapists', authorize('client'), getAvailableTherapists);
router.post('/select-therapist', authorize('client'), selectTherapist);
router.get('/my-evaluation', authorize('client'), getMyEvaluation);

// Therapist routes
router.get('/my-assignments', authorize('therapist'), getTherapistEvaluations);
router.post('/:id/start-review', authorize('therapist'), therapistStartReview);
router.post('/:id/therapist-ready', authorize('therapist'), therapistReady);
router.post('/:id/complete', authorize('therapist'), completeEvaluation);
router.get('/:id/details', authorize('therapist'), getTherapistEvaluationDetails);

// Shared routes (accessible by both client and therapist)
router.post('/:id/start-meeting', startMeeting);
router.get('/:id', getEvaluation);

// Client cancel
router.post('/:id/cancel', cancelEvaluation);

// Admin routes
router.get('/', authorize('admin'), getAllEvaluations);
router.put('/:id/assign-therapist', authorize('admin'), adminAssignTherapist);

module.exports = router;

