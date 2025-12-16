// AI Document Analysis Service using Gemini API
// Extracts key points, summaries, dates, diagnoses, and recommendations from documents

const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Analyze document using Gemini API
 * @param {string} text - Extracted text from OCR
 * @param {string} documentType - Type of document (IEP, IFSP, medical, etc.)
 * @returns {Promise<Object>} Analysis results
 */
const analyzeDocument = async (text, documentType) => {
  if (!text || text.trim().length === 0) {
    return {
      success: false,
      error: 'No text available for analysis',
    };
  }

  try {
    // Use Gemini API if available, otherwise fallback to rule-based
    if (process.env.GEMINI_API_KEY) {
      return await analyzeDocumentWithGemini(text, documentType);
    } else {
      // Fallback to rule-based analysis
      console.warn('GEMINI_API_KEY not set. Using rule-based analysis.');
      return await analyzeDocumentRuleBased(text, documentType);
    }
  } catch (error) {
    console.error('AI Analysis Error:', error);
    // Fallback to rule-based if Gemini fails
    return await analyzeDocumentRuleBased(text, documentType);
  }
};

/**
 * Analyze document using Gemini API
 */
const analyzeDocumentWithGemini = async (text, documentType) => {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use gemini-1.5-flash for fast processing, or gemini-1.5-pro for better quality
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    const documentTypeContext = {
      IEP: 'Individualized Education Program (IEP)',
      IFSP: 'Individualized Family Service Plan (IFSP)',
      medical: 'medical document',
      evaluation: 'evaluation report',
      discharge: 'discharge summary',
      assessment: 'assessment report',
      other: 'document',
    };

    const context = documentTypeContext[documentType] || 'document';

    const prompt = `You are analyzing a ${context} for a speech-language therapy platform. Extract and structure the following information from the document text:

Document Type: ${context}
Document Text (first 8000 characters):
${text.substring(0, 8000)}

Please provide a JSON response with the following structure:
{
  "keyPoints": ["key point 1", "key point 2", ...],
  "summary": "A concise 2-3 sentence summary of the document",
  "importantDates": [
    {"date": "YYYY-MM-DD", "description": "What this date represents"}
  ],
  "diagnoses": ["diagnosis 1", "diagnosis 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...]
}

Important:
- Extract only factual information from the document
- For dates, use YYYY-MM-DD format
- Limit key points to top 10 most important
- Limit diagnoses to actual medical/clinical diagnoses mentioned
- Limit recommendations to actionable items
- Be concise but accurate

Return ONLY valid JSON, no additional text.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text().trim();

    // Parse JSON response (remove markdown code blocks if present)
    let jsonText = responseText;
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonText);

    // Ensure dates are properly formatted (keep as strings for JSON serialization)
    if (parsed.importantDates && Array.isArray(parsed.importantDates)) {
      parsed.importantDates = parsed.importantDates.map(item => {
        let dateValue = item.date;
        // If it's a string, try to parse it
        if (typeof dateValue === 'string') {
          const parsedDate = new Date(dateValue);
          if (!isNaN(parsedDate.getTime())) {
            dateValue = parsedDate.toISOString().split('T')[0]; // Store as YYYY-MM-DD
          }
        } else if (dateValue instanceof Date) {
          dateValue = dateValue.toISOString().split('T')[0];
        }
        return {
          date: dateValue,
          description: item.description || '',
        };
      }).filter(item => item.date);
    }

    return {
      success: true,
      analysis: {
        keyPoints: parsed.keyPoints || [],
        summary: parsed.summary || 'No summary available.',
        importantDates: parsed.importantDates || [],
        diagnoses: parsed.diagnoses || [],
        recommendations: parsed.recommendations || [],
        analyzedAt: new Date(),
      },
    };
  } catch (error) {
    console.error('Gemini API Analysis Error:', error);
    // Fallback to rule-based
    return await analyzeDocumentRuleBased(text, documentType);
  }
};

/**
 * Rule-based analysis (fallback)
 */
const analyzeDocumentRuleBased = async (text, documentType) => {
  const analysis = {
    keyPoints: extractKeyPoints(text, documentType),
    summary: generateSummary(text, documentType),
    importantDates: extractImportantDates(text),
    diagnoses: extractDiagnoses(text, documentType),
    recommendations: extractRecommendations(text, documentType),
    analyzedAt: new Date(),
  };

  return {
    success: true,
    analysis,
  };
};

/**
 * Extract key points from text
 */
const extractKeyPoints = (text, documentType) => {
  const keyPoints = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);

  // Document-type specific patterns
  const patterns = {
    IEP: [
      /goals?:?\s*([^\.]+)/gi,
      /objectives?:?\s*([^\.]+)/gi,
      /accommodations?:?\s*([^\.]+)/gi,
      /services?:?\s*([^\.]+)/gi,
    ],
    IFSP: [
      /outcomes?:?\s*([^\.]+)/gi,
      /services?:?\s*([^\.]+)/gi,
      /family\s+priorities?:?\s*([^\.]+)/gi,
    ],
    medical: [
      /diagnosis:?\s*([^\.]+)/gi,
      /condition:?\s*([^\.]+)/gi,
      /treatment:?\s*([^\.]+)/gi,
      /medication:?\s*([^\.]+)/gi,
    ],
    evaluation: [
      /findings?:?\s*([^\.]+)/gi,
      /assessment:?\s*([^\.]+)/gi,
      /results?:?\s*([^\.]+)/gi,
      /recommendations?:?\s*([^\.]+)/gi,
    ],
  };

  const docPatterns = patterns[documentType] || patterns.evaluation;

  docPatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].trim().length > 10) {
        keyPoints.push(match[1].trim());
      }
    }
  });

  // Extract important sentences (longer sentences often contain key info)
  sentences
    .filter(s => s.length > 50 && s.length < 200)
    .slice(0, 5)
    .forEach(sentence => {
      if (!keyPoints.some(kp => sentence.includes(kp))) {
        keyPoints.push(sentence.trim());
      }
    });

  // Remove duplicates and limit to top 10
  return [...new Set(keyPoints)].slice(0, 10);
};

/**
 * Generate summary of document
 */
const generateSummary = (text, documentType) => {
  // Simple extractive summarization
  // In production, use abstractive summarization with AI models
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  if (sentences.length === 0) {
    return 'No summary available.';
  }

  // Get first few sentences and last sentence (often contains conclusions)
  const firstPart = sentences.slice(0, 3).join('. ');
  const lastPart = sentences[sentences.length - 1];

  // For specific document types, add context
  const typeContext = {
    IEP: 'This Individualized Education Program (IEP) document',
    IFSP: 'This Individualized Family Service Plan (IFSP) document',
    medical: 'This medical document',
    evaluation: 'This evaluation report',
    discharge: 'This discharge summary',
    assessment: 'This assessment report',
  };

  const context = typeContext[documentType] || 'This document';
  
  return `${context} contains the following information: ${firstPart}. ${lastPart}`;
};

/**
 * Extract important dates from text
 */
const extractImportantDates = (text) => {
  const dates = [];
  
  // Date patterns: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, Month DD, YYYY
  const datePatterns = [
    /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g,
    /\b(\d{4}-\d{2}-\d{2})\b/g,
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
  ];

  datePatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      try {
        let dateStr = match[0];
        if (match[1] && match[2] && match[3]) {
          // Month DD, YYYY format
          dateStr = `${match[1]} ${match[2]}, ${match[3]}`;
        }
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          // Extract context around the date
          const index = text.indexOf(match[0]);
          const context = text.substring(Math.max(0, index - 50), Math.min(text.length, index + 50));
          dates.push({
            date,
            description: context.trim().substring(0, 100),
          });
        }
      } catch (error) {
        // Skip invalid dates
      }
    }
  });

  // Remove duplicates and sort
  const uniqueDates = [];
  const seenDates = new Set();
  
  dates.forEach(item => {
    const dateKey = item.date.toISOString().split('T')[0];
    if (!seenDates.has(dateKey)) {
      seenDates.add(dateKey);
      uniqueDates.push(item);
    }
  });

  return uniqueDates.sort((a, b) => a.date - b.date).slice(0, 10);
};

/**
 * Extract diagnoses from text
 */
const extractDiagnoses = (text, documentType) => {
  const diagnoses = [];
  
  // Common diagnosis patterns
  const diagnosisPatterns = [
    /diagnosis:?\s*([^\.\n]+)/gi,
    /diagnosed\s+with\s+([^\.\n]+)/gi,
    /condition:?\s*([^\.\n]+)/gi,
    /disorder:?\s*([^\.\n]+)/gi,
    /(?:ICD-10|ICD10):\s*([^\s]+)\s+([^\.\n]+)/gi,
  ];

  diagnosisPatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const diagnosis = match[1] || match[2] || match[0];
      if (diagnosis && diagnosis.trim().length > 3 && diagnosis.trim().length < 100) {
        diagnoses.push(diagnosis.trim());
      }
    }
  });

  // Common speech-language pathology diagnoses
  const slpDiagnoses = [
    'apraxia',
    'dysarthria',
    'aphasia',
    'dysphagia',
    'stuttering',
    'language delay',
    'articulation disorder',
    'phonological disorder',
    'autism',
    'ADHD',
    'hearing loss',
    'voice disorder',
  ];

  slpDiagnoses.forEach(diagnosis => {
    if (text.toLowerCase().includes(diagnosis)) {
      diagnoses.push(diagnosis);
    }
  });

  return [...new Set(diagnoses)].slice(0, 10);
};

/**
 * Extract recommendations from text
 */
const extractRecommendations = (text, documentType) => {
  const recommendations = [];
  
  // Recommendation patterns
  const recommendationPatterns = [
    /recommend(?:ation|ed)?:?\s*([^\.\n]+)/gi,
    /suggest(?:ion|ed)?:?\s*([^\.\n]+)/gi,
    /should\s+([^\.\n]+)/gi,
    /it\s+is\s+recommended\s+that\s+([^\.\n]+)/gi,
    /next\s+steps?:?\s*([^\.\n]+)/gi,
  ];

  recommendationPatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const recommendation = match[1] || match[0];
      if (recommendation && recommendation.trim().length > 10 && recommendation.trim().length < 200) {
        recommendations.push(recommendation.trim());
      }
    }
  });

  // Extract sentences with action words
  const actionWords = ['should', 'must', 'need', 'require', 'consider', 'implement'];
  const sentences = text.split(/[.!?]+/);
  
  sentences.forEach(sentence => {
    if (actionWords.some(word => sentence.toLowerCase().includes(word)) && 
        sentence.length > 20 && sentence.length < 200) {
      if (!recommendations.some(rec => sentence.includes(rec))) {
        recommendations.push(sentence.trim());
      }
    }
  });

  return [...new Set(recommendations)].slice(0, 10);
};

/**
 * Enhanced AI analysis using external API (placeholder for production)
 */
const analyzeDocumentWithAI = async (text, documentType) => {
  // Placeholder for AI API integration
  // Options:
  // 1. OpenAI GPT-4 for structured extraction
  // 2. Google Cloud Natural Language API
  // 3. AWS Comprehend Medical
  // 4. Azure Text Analytics

  // Example with OpenAI:
  /*
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const prompt = `Analyze this ${documentType} document and extract:
  1. Key points (bullet list)
  2. Summary (2-3 sentences)
  3. Important dates with descriptions
  4. Diagnoses mentioned
  5. Recommendations
  
  Document text: ${text.substring(0, 4000)}`;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  });
  
  return parseAIResponse(response.choices[0].message.content);
  */

  // For now, use rule-based analysis
  return analyzeDocument(text, documentType);
};

module.exports = {
  analyzeDocument,
  analyzeDocumentWithAI,
  extractKeyPoints,
  generateSummary,
  extractImportantDates,
  extractDiagnoses,
  extractRecommendations,
};

