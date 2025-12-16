// Gemini AI Service for Translation, Language Detection, and AI Features
// Uses Google Gemini API for multilingual support

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini API
let genAI = null;
let translationModel = null;
let languageDetectionModel = null;

const initializeGemini = () => {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY not set. Translation features will use fallback methods.');
    return false;
  }

  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Default model - try latest versions first
    const defaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    
    // Try different model name formats in order of preference
    const modelNamesToTry = [
      defaultModel,
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash-002',
      'gemini-1.5-flash-001',
      'gemini-1.5-flash',
      'gemini-1.5-pro-latest',
      'gemini-1.5-pro-002',
      'gemini-1.5-pro-001',
      'gemini-1.5-pro',
      'gemini-pro',
      'gemini-2.5-flash'
    ];
    
    let modelInitialized = false;
    let workingModel = null;
    
    for (const name of modelNamesToTry) {
      try {
        const testModel = genAI.getGenerativeModel({ model: name });
        translationModel = testModel;
        languageDetectionModel = testModel;
        workingModel = name;
        modelInitialized = true;
        console.log(`✅ Gemini API initialized with model: ${name}`);
        break;
      } catch (err) {
        // Try next model name - don't log here to avoid spam
        continue;
      }
    }
    
    if (!modelInitialized) {
      console.error('❌ Failed to initialize any Gemini model. Please check your API key and model availability.');
      console.error('💡 Tip: Set GEMINI_MODEL in your .env file to specify a model name');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Gemini API:', error);
    return false;
  }
};

// Initialize on module load
const isInitialized = initializeGemini();

/**
 * Translate text using Gemini API
 * @param {string} text - Text to translate
 * @param {string} sourceLanguage - Source language code (e.g., 'en', 'es')
 * @param {string} targetLanguage - Target language code
 * @returns {Promise<string>} Translated text
 */
const translateTextWithGemini = async (text, sourceLanguage = 'auto', targetLanguage = 'en') => {
  if (!text || text.trim().length === 0) {
    return text;
  }

  if (sourceLanguage === targetLanguage) {
    return text;
  }

  if (!isInitialized || !translationModel) {
    console.warn('Gemini not initialized, using fallback');
    return `[Translated: ${text}]`;
  }

  try {
    const languageNames = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      zh: 'Chinese (Simplified)',
      ja: 'Japanese',
      ko: 'Korean',
      ar: 'Arabic',
      pt: 'Portuguese',
      ru: 'Russian',
      it: 'Italian',
      hi: 'Hindi',
      nl: 'Dutch',
      pl: 'Polish',
      tr: 'Turkish',
      vi: 'Vietnamese',
      asl: 'American Sign Language',
    };

    const sourceLangName = sourceLanguage === 'auto' ? 'the detected language' : languageNames[sourceLanguage] || sourceLanguage;
    const targetLangName = languageNames[targetLanguage] || targetLanguage;

    const prompt = `Translate the following text from ${sourceLangName} to ${targetLangName}. 
    Provide only the translation, no explanations or additional text.
    Maintain the original meaning, tone, and context.
    If the text is already in ${targetLangName}, return it unchanged.
    
    Text to translate: "${text}"`;

    // Try with current model, if it fails try other models
    let result;
    try {
      result = await translationModel.generateContent(prompt);
    } catch (modelError) {
      // If model fails, try to reinitialize with a different model
      console.warn(`Model ${process.env.GEMINI_MODEL || 'default'} failed, trying alternative models...`);
      const alternativeModels = [
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash-001',
        'gemini-1.5-pro-latest',
        'gemini-1.5-pro-001',
        'gemini-pro',
      ];
      
      let success = false;
      for (const modelName of alternativeModels) {
        try {
          const altModel = genAI.getGenerativeModel({ model: modelName });
          result = await altModel.generateContent(prompt);
          // Update the global model if this one works
          translationModel = altModel;
          languageDetectionModel = altModel;
          console.log(`✅ Switched to model: ${modelName}`);
          success = true;
          break;
        } catch (err) {
          continue;
        }
      }
      
      if (!success) {
        throw modelError; // Re-throw original error if all models fail
      }
    }
    
    const response = await result.response;
    const translatedText = response.text().trim();

    // Clean up the response (remove quotes if present)
    return translatedText.replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error('Gemini translation error:', error.message || error);
    // Fallback to simple return
    return `[Translation Error: ${text}]`;
  }
};

/**
 * Detect language from text using Gemini API
 * @param {string} text - Text to analyze
 * @returns {Promise<{language: string, confidence: number}>}
 */
const detectLanguageWithGemini = async (text) => {
  if (!text || text.trim().length === 0) {
    return { language: 'en', confidence: 0 };
  }

  if (!isInitialized || !languageDetectionModel) {
    // Fallback to regex-based detection
    return detectLanguageFallback(text);
  }

  try {
    const prompt = `Detect the language of the following text. 
    Respond with only the ISO 639-1 language code (e.g., 'en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'pt', 'ru', 'it', 'hi', 'nl', 'pl', 'tr', 'vi').
    If you cannot determine the language, respond with 'en'.
    
    Text: "${text.substring(0, 500)}"`;

    const result = await languageDetectionModel.generateContent(prompt);
    const response = await result.response;
    const detectedCode = response.text().trim().toLowerCase().replace(/[^a-z]/g, '');

    // Validate language code
    const validCodes = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'pt', 'ru', 'it', 'hi', 'nl', 'pl', 'tr', 'vi', 'asl'];
    const language = validCodes.includes(detectedCode) ? detectedCode : 'en';

    return {
      language,
      confidence: 0.9, // Gemini is generally very accurate
    };
  } catch (error) {
    console.error('Gemini language detection error:', error);
    return detectLanguageFallback(text);
  }
};

/**
 * Fallback language detection using regex patterns
 */
const detectLanguageFallback = (text) => {
  // Spanish/French/Portuguese
  if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(text)) {
    // More specific checks
    if (/[ñ]/.test(text) && /[áéíóú]/.test(text)) return { language: 'es', confidence: 0.7 };
    if (/[àâäèéêëîïôùûüÿ]/.test(text)) return { language: 'fr', confidence: 0.7 };
    if (/[ãõ]/.test(text)) return { language: 'pt', confidence: 0.7 };
  }
  // German
  if (/[äöüß]/.test(text)) return { language: 'de', confidence: 0.7 };
  // Chinese
  if (/[一-龯]/.test(text)) return { language: 'zh', confidence: 0.8 };
  // Japanese
  if (/[あ-ん]/.test(text) || /[ア-ン]/.test(text)) return { language: 'ja', confidence: 0.8 };
  // Korean
  if (/[가-힣]/.test(text)) return { language: 'ko', confidence: 0.8 };
  // Arabic
  if (/[ا-ي]/.test(text)) return { language: 'ar', confidence: 0.8 };
  // Russian
  if (/[а-яё]/.test(text)) return { language: 'ru', confidence: 0.7 };
  // Hindi
  if (/[अ-ह]/.test(text)) return { language: 'hi', confidence: 0.7 };

  return { language: 'en', confidence: 0.5 };
};

/**
 * Translate multiple texts in batch
 * @param {Array<{text: string, sourceLanguage: string, targetLanguage: string}>} translations
 * @returns {Promise<Array<string>>}
 */
const translateBatch = async (translations) => {
  if (!isInitialized) {
    return translations.map(t => `[Translated: ${t.text}]`);
  }

  try {
    const results = await Promise.all(
      translations.map(t => translateTextWithGemini(t.text, t.sourceLanguage, t.targetLanguage))
    );
    return results;
  } catch (error) {
    console.error('Batch translation error:', error);
    return translations.map(t => `[Translation Error: ${t.text}]`);
  }
};

/**
 * Real-time translation for video sessions
 * Processes speech-to-text and translates in real-time
 * @param {string} transcript - Speech transcript
 * @param {string} sourceLanguage - Source language
 * @param {string} targetLanguage - Target language
 * @returns {Promise<{original: string, translated: string, timestamp: Date}>}
 */
const translateRealTime = async (transcript, sourceLanguage, targetLanguage) => {
  if (!transcript || transcript.trim().length === 0) {
    return { original: transcript, translated: transcript, timestamp: new Date() };
  }

  const translated = await translateTextWithGemini(transcript, sourceLanguage, targetLanguage);

  return {
    original: transcript,
    translated,
    timestamp: new Date(),
    sourceLanguage,
    targetLanguage,
  };
};

/**
 * AI-assisted interpretation for non-English speaking clients
 * Provides context-aware translation with medical/therapy terminology
 * @param {string} text - Text to interpret
 * @param {string} sourceLanguage - Source language
 * @param {string} targetLanguage - Target language
 * @param {string} context - Context (e.g., 'therapy_session', 'medical_history')
 * @returns {Promise<{translated: string, explanation: string}>}
 */
const interpretWithContext = async (text, sourceLanguage, targetLanguage, context = 'general') => {
  if (!isInitialized || !translationModel) {
    const translated = await translateTextWithGemini(text, sourceLanguage, targetLanguage);
    return { translated, explanation: '' };
  }

  try {
    const contextPrompts = {
      therapy_session: 'This is a speech-language therapy session. Translate medical and therapy terminology accurately.',
      medical_history: 'This is medical history documentation. Maintain medical accuracy in translation.',
      assessment: 'This is a clinical assessment. Preserve clinical terminology precisely.',
      general: 'Translate this text accurately while maintaining context.',
    };

    const prompt = `${contextPrompts[context] || contextPrompts.general}
    
    Translate from ${sourceLanguage} to ${targetLanguage}:
    "${text}"
    
    Provide the translation and a brief explanation of any important context or terminology.`;

    const result = await translationModel.generateContent(prompt);
    const response = await result.response;
    const fullResponse = response.text().trim();

    // Try to extract translation and explanation
    const lines = fullResponse.split('\n');
    const translated = lines[0].replace(/^["']|["']$/g, '');
    const explanation = lines.slice(1).join(' ').trim();

    return {
      translated,
      explanation: explanation || '',
    };
  } catch (error) {
    console.error('Context interpretation error:', error);
    const translated = await translateTextWithGemini(text, sourceLanguage, targetLanguage);
    return { translated, explanation: '' };
  }
};

/**
 * Generate session transcript in client's preferred language
 * @param {string} transcript - Original transcript
 * @param {string} originalLanguage - Original language
 * @param {string} targetLanguage - Client's preferred language
 * @returns {Promise<string>}
 */
const generateTranslatedTranscript = async (transcript, originalLanguage, targetLanguage) => {
  if (originalLanguage === targetLanguage) {
    return transcript;
  }

  return await translateTextWithGemini(transcript, originalLanguage, targetLanguage);
};

/**
 * Filter therapists by bilingual capabilities using AI
 * @param {Array} therapists - List of therapists
 * @param {string} requiredLanguage - Required language
 * @returns {Promise<Array>} Filtered therapists
 */
const filterBilingualTherapists = async (therapists, requiredLanguage) => {
  if (!requiredLanguage || requiredLanguage === 'en') {
    return therapists;
  }

  // Filter therapists who have the language in their spokenLanguages array
  return therapists.filter(therapist => {
    const spokenLanguages = therapist.spokenLanguages || [];
    return spokenLanguages.includes(requiredLanguage) || therapist.bilingualTherapy === true;
  });
};

/**
 * Translate interface text using Gemini
 * @param {string} text - Interface text to translate
 * @param {string} targetLanguage - Target language
 * @returns {Promise<string>}
 */
const translateInterface = async (text, targetLanguage) => {
  if (targetLanguage === 'en') {
    return text;
  }

  return await translateTextWithGemini(text, 'en', targetLanguage);
};

module.exports = {
  translateTextWithGemini,
  detectLanguageWithGemini,
  translateBatch,
  translateRealTime,
  interpretWithContext,
  generateTranslatedTranscript,
  filterBilingualTherapists,
  translateInterface,
  isInitialized: () => isInitialized,
};

