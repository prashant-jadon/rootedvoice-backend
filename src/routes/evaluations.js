const express = require('express');
const router = express.Router();
const {
    getEvaluation,
    getMyEvaluation,
    createEvaluation,
    updateEvaluationQuestions,
    submitEvaluation,
    getAllEvaluations,
    reviewEvaluation
} = require('../controllers/evaluationController');

const { protect, authorize } = require('../middlewares/auth');

// Public routes (none for now)

// Protected routes
router.use(protect);

router.post('/', authorize('admin', 'therapist'), createEvaluation);
router.get('/', authorize('admin'), getAllEvaluations);
router.get('/my-evaluation', authorize('client'), getMyEvaluation);
router.get('/:id', getEvaluation);
router.put('/:id/questions', authorize('admin', 'therapist'), updateEvaluationQuestions);
router.put('/:id/review', authorize('admin'), reviewEvaluation);
router.post('/:id/submit', authorize('client'), submitEvaluation);

module.exports = router;
