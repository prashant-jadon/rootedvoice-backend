const { asyncHandler } = require('../middlewares/errorHandler');
const {
  translateText,
  detectLanguage,
  getSupportedLanguages,
  translateRealTimeText,
  interpretText,
  translateTranscript,
} = require('../utils/translationService');
const Client = require('../models/Client');
const Therapist = require('../models/Therapist');
const User = require('../models/User');

// @desc    Translate text
// @route   POST /api/translation/translate
// @access  Private
const translateTextEndpoint = asyncHandler(async (req, res) => {
  const { text, sourceLanguage, targetLanguage } = req.body;

  if (!text || !targetLanguage) {
    return res.status(400).json({
      success: false,
      message: 'Text and target language are required',
    });
  }

  const translated = await translateText(text, sourceLanguage || 'en', targetLanguage);

  res.json({
    success: true,
    data: {
      original: text,
      translated,
      sourceLanguage: sourceLanguage || 'en',
      targetLanguage,
    },
  });
});

// @desc    Detect language from text
// @route   POST /api/translation/detect
// @access  Private
const detectLanguageEndpoint = asyncHandler(async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({
      success: false,
      message: 'Text is required',
    });
  }

  const detectedLanguage = await detectLanguage(text);
  const { detectLanguageWithGemini } = require('../utils/geminiService');
  const detectionResult = await detectLanguageWithGemini(text);

  res.json({
    success: true,
    data: {
      language: detectionResult.language,
      confidence: detectionResult.confidence || 0.85,
    },
  });
});

// @desc    Get supported languages
// @route   GET /api/translation/languages
// @access  Public
const getLanguages = asyncHandler(async (req, res) => {
  const languages = getSupportedLanguages();

  res.json({
    success: true,
    data: languages,
  });
});

// @desc    Get user's language preferences
// @route   GET /api/translation/preferences
// @access  Private
const getLanguagePreferences = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId).select('preferredLanguage interfaceLanguage');
  
  let clientPreferences = null;
  if (req.user.role === 'client') {
    const client = await Client.findOne({ userId }).select('preferences spokenLanguages');
    if (client) {
      clientPreferences = {
        preferredLanguage: client.preferences?.preferredLanguage || user.preferredLanguage,
        enableTranslation: client.preferences?.enableTranslation || false,
        spokenLanguages: client.spokenLanguages || [],
      };
    }
  }

  res.json({
    success: true,
    data: {
      preferredLanguage: user.preferredLanguage || 'en',
      interfaceLanguage: user.interfaceLanguage || 'en',
      clientPreferences,
    },
  });
});

// @desc    Update language preferences
// @route   PUT /api/translation/preferences
// @access  Private
const updateLanguagePreferences = asyncHandler(async (req, res) => {
  const { preferredLanguage, interfaceLanguage, enableTranslation, spokenLanguages } = req.body;
  const userId = req.user._id;

  // Update user preferences
  const updateData = {};
  if (preferredLanguage) updateData.preferredLanguage = preferredLanguage;
  if (interfaceLanguage) updateData.interfaceLanguage = interfaceLanguage;

  await User.findByIdAndUpdate(userId, updateData);

  // Update client-specific preferences
  if (req.user.role === 'client') {
    const client = await Client.findOne({ userId });
    if (client) {
      if (enableTranslation !== undefined) {
        if (!client.preferences) client.preferences = {};
        client.preferences.enableTranslation = enableTranslation;
      }
      if (preferredLanguage) {
        if (!client.preferences) client.preferences = {};
        client.preferences.preferredLanguage = preferredLanguage;
      }
      if (spokenLanguages && Array.isArray(spokenLanguages)) {
        client.spokenLanguages = spokenLanguages;
      }
      await client.save();
    }
  }

  res.json({
    success: true,
    message: 'Language preferences updated successfully',
  });
});

// @desc    Get bilingual therapists
// @route   GET /api/translation/bilingual-therapists
// @access  Public
const getBilingualTherapists = asyncHandler(async (req, res) => {
  const { language } = req.query;

  if (!language) {
    return res.status(400).json({
      success: false,
      message: 'Language parameter is required',
    });
  }

  let therapists = await Therapist.find({
    $or: [
      { spokenLanguages: language },
      { bilingualTherapy: true },
    ],
  })
    .populate('userId', 'firstName lastName email avatar')
    .select('userId spokenLanguages bilingualTherapy specializations hourlyRate rating');

  // Use AI to filter and rank therapists
  const { filterBilingualTherapists } = require('../utils/geminiService');
  therapists = await filterBilingualTherapists(therapists, language);

  res.json({
    success: true,
    data: therapists,
  });
});

// @desc    Real-time translation for video sessions
// @route   POST /api/translation/realtime
// @access  Private
const realtimeTranslation = asyncHandler(async (req, res) => {
  const { text, sourceLanguage, targetLanguage } = req.body;

  if (!text || !targetLanguage) {
    return res.status(400).json({
      success: false,
      message: 'Text and target language are required',
    });
  }

  const translated = await translateRealTimeText(text, sourceLanguage || 'auto', targetLanguage);

  res.json({
    success: true,
    data: {
      original: text,
      translated,
      sourceLanguage: sourceLanguage || 'auto',
      targetLanguage,
      timestamp: new Date(),
    },
  });
});

// @desc    AI-assisted interpretation with context
// @route   POST /api/translation/interpret
// @access  Private
const interpretTranslation = asyncHandler(async (req, res) => {
  const { text, sourceLanguage, targetLanguage, context } = req.body;

  if (!text || !targetLanguage) {
    return res.status(400).json({
      success: false,
      message: 'Text and target language are required',
    });
  }

  const result = await interpretText(text, sourceLanguage || 'auto', targetLanguage, context || 'general');

  res.json({
    success: true,
    data: {
      original: text,
      translated: result.translated,
      explanation: result.explanation,
      sourceLanguage: sourceLanguage || 'auto',
      targetLanguage,
      context: context || 'general',
    },
  });
});

// @desc    Translate session transcript
// @route   POST /api/translation/transcript
// @access  Private
const translateSessionTranscript = asyncHandler(async (req, res) => {
  const { transcript, originalLanguage, targetLanguage } = req.body;

  if (!transcript || !targetLanguage) {
    return res.status(400).json({
      success: false,
      message: 'Transcript and target language are required',
    });
  }

  const translated = await translateTranscript(transcript, originalLanguage || 'en', targetLanguage);

  res.json({
    success: true,
    data: {
      original: transcript,
      translated,
      originalLanguage: originalLanguage || 'en',
      targetLanguage,
    },
  });
});

module.exports = {
  translateText: translateTextEndpoint,
  detectLanguage: detectLanguageEndpoint,
  getLanguages,
  getLanguagePreferences,
  updateLanguagePreferences,
  getBilingualTherapists,
  realtimeTranslation,
  interpretTranslation,
  translateSessionTranscript,
};

