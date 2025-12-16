// AI Resource Search Service
// Understands natural language queries and converts them to database filters

/**
 * Parse natural language query and extract search parameters
 * @param {string} query - Natural language search query
 * @returns {Object} Parsed search parameters
 */
const parseNaturalLanguageQuery = (query) => {
  if (!query || query.trim().length === 0) {
    return {
      search: '',
      category: null,
      ageGroup: null,
      disorderType: null,
      goalType: null,
    };
  }

  const queryLower = query.toLowerCase();
  const parsed = {
    search: query,
    category: null,
    ageGroup: null,
    disorderType: [],
    goalType: [],
  };

  // Extract age group
  const agePatterns = [
    { pattern: /(?:for|age|aged?)\s*(?:of\s*)?(\d+)\s*(?:year|yr|month|mo|old)/gi, extract: (match) => {
      const age = parseInt(match[1]);
      if (age <= 3) return '0-3';
      if (age <= 12) return '3-12';
      if (age <= 18) return '13-18';
      if (age <= 65) return '18-65';
      return '65+';
    }},
    { pattern: /(?:toddler|infant|baby)/gi, extract: () => '0-3' },
    { pattern: /(?:preschool|pre-school|young child)/gi, extract: () => '3-12' },
    { pattern: /(?:school age|school-age|elementary)/gi, extract: () => '3-12' },
    { pattern: /(?:teen|teenager|adolescent)/gi, extract: () => '13-18' },
    { pattern: /(?:adult)/gi, extract: () => '18-65' },
    { pattern: /(?:senior|elderly|geriatric)/gi, extract: () => '65+' },
  ];

  for (const agePattern of agePatterns) {
    const match = queryLower.match(agePattern.pattern);
    if (match) {
      parsed.ageGroup = agePattern.extract(match[0]);
      break;
    }
  }

  // Extract category
  const categoryMap = {
    'worksheet': ['worksheet', 'worksheet', 'printable', 'activity sheet'],
    'assessment': ['assessment', 'test', 'evaluation', 'screening'],
    'video': ['video', 'recording', 'tutorial', 'demonstration'],
    'audio': ['audio', 'sound', 'recording', 'podcast'],
    'exercise': ['exercise', 'practice', 'drill', 'activity'],
    'template': ['template', 'form', 'outline'],
    'guide': ['guide', 'manual', 'handbook', 'instructions'],
  };

  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(keyword => queryLower.includes(keyword))) {
      parsed.category = category;
      break;
    }
  }

  // Extract goal type
  const goalMap = {
    'articulation': ['articulation', '/r/', '/s/', '/l/', 'sound', 'pronunciation', 'speech sounds'],
    'language': ['language', 'vocabulary', 'grammar', 'syntax', 'semantics', 'expressive', 'receptive'],
    'fluency': ['fluency', 'stuttering', 'stammering', 'dysfluency'],
    'voice': ['voice', 'vocal', 'hoarse', 'vocal quality'],
    'swallowing': ['swallowing', 'dysphagia', 'feeding', 'oral motor'],
    'cognitive': ['cognitive', 'memory', 'attention', 'executive function'],
    'social': ['social', 'pragmatics', 'conversation', 'social skills'],
  };

  for (const [goal, keywords] of Object.entries(goalMap)) {
    if (keywords.some(keyword => queryLower.includes(keyword))) {
      parsed.goalType.push(goal);
    }
  }

  // Extract disorder type (common SLP disorders)
  const disorderKeywords = [
    { keywords: ['apraxia', 'childhood apraxia'], disorder: 'apraxia' },
    { keywords: ['autism', 'asd', 'autistic'], disorder: 'autism' },
    { keywords: ['down syndrome', 'downs'], disorder: 'down syndrome' },
    { keywords: ['cerebral palsy', 'cp'], disorder: 'cerebral palsy' },
    { keywords: ['hearing loss', 'deaf', 'hard of hearing'], disorder: 'hearing loss' },
    { keywords: ['aphasia'], disorder: 'aphasia' },
    { keywords: ['dysarthria'], disorder: 'dysarthria' },
    { keywords: ['adhd', 'attention deficit'], disorder: 'adhd' },
    { keywords: ['language delay', 'delayed language'], disorder: 'language delay' },
    { keywords: ['speech delay', 'delayed speech'], disorder: 'speech delay' },
  ];

  for (const { keywords, disorder } of disorderKeywords) {
    if (keywords.some(keyword => queryLower.includes(keyword))) {
      parsed.disorderType.push(disorder);
    }
  }

  // Extract specific sounds (e.g., "/r/ sounds", "R sound")
  const soundPatterns = [
    /(?:\/r\/|\/s\/|\/l\/|\/th\/|\/sh\/|\/ch\/|\/k\/|\/g\/)/gi,
    /\b([rsltkg]|th|sh|ch|zh)\s+(?:sound|phoneme)/gi,
  ];

  for (const pattern of soundPatterns) {
    const match = queryLower.match(pattern);
    if (match) {
      parsed.goalType.push('articulation');
      // Add the sound to search terms
      parsed.search = `${parsed.search} ${match[0]}`;
      break;
    }
  }

  return parsed;
};

/**
 * Search resources using natural language query with multilingual support
 * @param {string} query - Natural language search query
 * @param {Object} baseFilter - Base filter (access level, etc.)
 * @param {Object} Resource - Resource model
 * @returns {Promise<Array>} Matching resources
 */
const searchResourcesWithAI = async (query, baseFilter, Resource) => {
  try {
    // Detect language and translate query if needed
    let processedQuery = query;
    try {
      const { detectLanguageWithGemini, translateTextWithGemini } = require('./geminiService');
      const detection = await detectLanguageWithGemini(query);
      
      // If query is not in English, translate it for better search results
      if (detection.language !== 'en') {
        const translated = await translateTextWithGemini(query, detection.language, 'en');
        processedQuery = `${query} ${translated}`; // Search in both languages
      }
    } catch (error) {
      console.error('Multilingual search processing error:', error);
      // Continue with original query
    }

    // Parse natural language query
    const parsed = parseNaturalLanguageQuery(processedQuery);

    // Build MongoDB filter
    const filter = { ...baseFilter };

    // Add text search
    if (parsed.search) {
      filter.$text = { $search: parsed.search };
    }

    // Add category filter
    if (parsed.category) {
      filter.category = parsed.category;
    }

    // Add age group filter
    if (parsed.ageGroup) {
      filter.ageGroup = parsed.ageGroup;
    }

    // Add disorder type filter
    if (parsed.disorderType && parsed.disorderType.length > 0) {
      filter.disorderType = { $in: parsed.disorderType };
    }

    // Add goal type filter
    if (parsed.goalType && parsed.goalType.length > 0) {
      filter.goalType = { $in: parsed.goalType };
    }

    // Search resources
    const resources = await Resource.find(filter)
      .populate('uploadedBy', 'userId')
      .populate({
        path: 'uploadedBy',
        populate: { path: 'userId', select: 'firstName lastName' }
      })
      .sort({ downloads: -1, createdAt: -1 })
      .limit(50);

    return {
      success: true,
      resources,
      parsedQuery: parsed,
    };
  } catch (error) {
    console.error('AI Resource Search Error:', error);
    return {
      success: false,
      error: error.message || 'Resource search failed',
      resources: [],
    };
  }
};

/**
 * Enhanced AI search using external API (placeholder for production)
 */
const searchResourcesWithAIAPI = async (query, baseFilter, Resource) => {
  // Placeholder for AI API integration
  // Options:
  // 1. OpenAI GPT-4 for query understanding
  // 2. Google Cloud Natural Language API
  // 3. AWS Comprehend
  // 4. Azure Cognitive Search

  // Example with OpenAI:
  /*
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const prompt = `Parse this natural language query for a speech-language pathology resource search:
  "${query}"
  
  Extract:
  - Age group (0-3, 3-12, 13-18, 18-65, 65+)
  - Category (worksheet, assessment, video, audio, exercise, template, guide)
  - Goal type (articulation, language, fluency, voice, swallowing, cognitive, social)
  - Disorder type (apraxia, autism, down syndrome, etc.)
  - Search keywords
  
  Return JSON with keys: ageGroup, category, goalType (array), disorderType (array), search`;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
  });
  
  const parsed = JSON.parse(response.choices[0].message.content);
  // Then use parsed to build filter and search
  */

  // For now, use rule-based parsing
  return searchResourcesWithAI(query, baseFilter, Resource);
};

module.exports = {
  parseNaturalLanguageQuery,
  searchResourcesWithAI,
  searchResourcesWithAIAPI,
};

