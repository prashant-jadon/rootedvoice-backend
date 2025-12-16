const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
  translateText,
  detectLanguage,
  getLanguages,
  getLanguagePreferences,
  updateLanguagePreferences,
  getBilingualTherapists,
  realtimeTranslation,
  interpretTranslation,
  translateSessionTranscript,
} = require('../controllers/translationController');

// Public routes
router.get('/languages', getLanguages);
router.get('/bilingual-therapists', getBilingualTherapists);

// Protected routes
router.use(protect);

router.post('/translate', translateText);
router.post('/detect', detectLanguage);
router.post('/realtime', realtimeTranslation);
router.post('/interpret', interpretTranslation);
router.post('/transcript', translateSessionTranscript);
router.get('/preferences', getLanguagePreferences);
router.put('/preferences', updateLanguagePreferences);

module.exports = router;

