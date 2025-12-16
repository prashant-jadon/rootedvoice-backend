// Translation service for multilingual support
// Uses Google Gemini API for AI-powered translation

const {
  translateTextWithGemini,
  detectLanguageWithGemini,
  translateRealTime,
  interpretWithContext,
  generateTranslatedTranscript,
  translateInterface,
} = require('./geminiService');

const SUPPORTED_LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  zh: 'Chinese',
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

// Simple translation dictionary (in production, use API)
const TRANSLATIONS = {
  en: {
    'session.starting': 'Session Starting',
    'session.ended': 'Session Ended',
    'mute.audio': 'Mute Audio',
    'mute.video': 'Mute Video',
    'end.call': 'End Call',
    'join.session': 'Join Session',
    'waiting.participant': 'Waiting for participant...',
  },
  es: {
    'session.starting': 'Sesión Iniciando',
    'session.ended': 'Sesión Terminada',
    'mute.audio': 'Silenciar Audio',
    'mute.video': 'Silenciar Video',
    'end.call': 'Finalizar Llamada',
    'join.session': 'Unirse a Sesión',
    'waiting.participant': 'Esperando participante...',
  },
  fr: {
    'session.starting': 'Session Démarrage',
    'session.ended': 'Session Terminée',
    'mute.audio': 'Couper le Son',
    'mute.video': 'Couper la Vidéo',
    'end.call': 'Terminer l\'Appel',
    'join.session': 'Rejoindre la Session',
    'waiting.participant': 'En attente du participant...',
  },
};

// Get translation for a key
const translate = (key, targetLanguage = 'en') => {
  const translations = TRANSLATIONS[targetLanguage] || TRANSLATIONS.en;
  return translations[key] || key;
};

// Translate text using Gemini API
const translateText = async (text, sourceLanguage, targetLanguage) => {
  if (sourceLanguage === targetLanguage) {
    return text;
  }

  try {
    return await translateTextWithGemini(text, sourceLanguage, targetLanguage);
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Return original on error
  }
};

// Detect language from text using Gemini API
const detectLanguage = async (text) => {
  try {
    const result = await detectLanguageWithGemini(text);
    return result.language;
  } catch (error) {
    console.error('Language detection error:', error);
    return 'en'; // Default to English on error
  }
};

// Get Jitsi language code mapping
const getJitsiLanguageCode = (languageCode) => {
  const jitsiLanguageMap = {
    en: 'en',
    es: 'es',
    fr: 'fr',
    de: 'de',
    zh: 'zh',
    ja: 'ja',
    ko: 'ko',
    ar: 'ar',
    pt: 'pt',
    ru: 'ru',
    it: 'it',
    hi: 'hi',
    nl: 'nl',
    pl: 'pl',
    tr: 'tr',
    vi: 'vi',
  };
  return jitsiLanguageMap[languageCode] || 'en';
};

// Get supported languages list
const getSupportedLanguages = () => {
  return Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
    code,
    name,
  }));
};

// Real-time translation for video sessions
const translateRealTimeText = async (text, sourceLanguage, targetLanguage) => {
  try {
    const result = await translateRealTime(text, sourceLanguage, targetLanguage);
    return result.translated;
  } catch (error) {
    console.error('Real-time translation error:', error);
    return text;
  }
};

// AI-assisted interpretation with context
const interpretText = async (text, sourceLanguage, targetLanguage, context) => {
  try {
    return await interpretWithContext(text, sourceLanguage, targetLanguage, context);
  } catch (error) {
    console.error('Interpretation error:', error);
    const translated = await translateText(text, sourceLanguage, targetLanguage);
    return { translated, explanation: '' };
  }
};

// Generate translated transcript
const translateTranscript = async (transcript, originalLanguage, targetLanguage) => {
  try {
    return await generateTranslatedTranscript(transcript, originalLanguage, targetLanguage);
  } catch (error) {
    console.error('Transcript translation error:', error);
    return transcript;
  }
};

// Translate interface text
const translateUIText = async (text, targetLanguage) => {
  try {
    return await translateInterface(text, targetLanguage);
  } catch (error) {
    console.error('Interface translation error:', error);
    return text;
  }
};

module.exports = {
  translate,
  translateText,
  detectLanguage,
  getJitsiLanguageCode,
  getSupportedLanguages,
  translateRealTimeText,
  interpretText,
  translateTranscript,
  translateUIText,
  SUPPORTED_LANGUAGES,
};

