// OCR Service for document text extraction
// Uses Tesseract.js for client-side OCR or can integrate with cloud OCR APIs

const Tesseract = require('tesseract.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Extract text from PDF using pdf-parse (for text-based PDFs)
 * @param {string} pdfPath - Path to PDF file
 * @returns {Promise<{text: string, isTextBased: boolean}>}
 */
const extractTextFromPDF = async (pdfPath) => {
  try {
    // Try to use pdf-parse if available
    // pdf-parse v2.4.5+ is an ES module with PDFParse class
    let PDFParseClass;
    try {
      const pdfParseModule = await import('pdf-parse');
      PDFParseClass = pdfParseModule.PDFParse;
      
      if (!PDFParseClass || typeof PDFParseClass !== 'function') {
        console.log('PDFParse class not found in pdf-parse module');
        return { text: '', isTextBased: false };
      }
    } catch (e) {
      console.log('pdf-parse not available:', e.message);
      return { text: '', isTextBased: false };
    }

    // Read PDF file
    const dataBuffer = fs.readFileSync(pdfPath);
    
    // Create PDFParse instance with data buffer
    const parser = new PDFParseClass({
      data: dataBuffer,
      verbosity: 0, // 0 = errors only, 1 = warnings, 2 = info, 3 = debug
    });
    
    // Use getText method to extract text
    const result = await parser.getText();
    
    // Clean up
    await parser.destroy();
    
    // Extract text from result (result should have a .text property)
    const extractedText = result?.text || '';
    
    if (extractedText && extractedText.trim().length > 50) {
      // PDF has extractable text
      console.log(`Successfully extracted ${extractedText.trim().length} characters from PDF`);
      return {
        text: extractedText.trim(),
        isTextBased: true,
      };
    }
    
    // PDF appears to be scanned/image-based or has little text
    console.log('PDF text extraction returned little or no text');
    return {
      text: extractedText.trim() || '',
      isTextBased: false,
    };
  } catch (error) {
    console.error('PDF text extraction error:', error);
    return {
      text: '',
      isTextBased: false,
    };
  }
};

/**
 * Extract text from image/document using Tesseract.js
 * @param {string} filePath - Local file path to the document
 * @param {string} mimeType - MIME type of the file
 * @param {string} pdfType - Optional: 'text' or 'image' for PDFs
 * @returns {Promise<{text: string, confidence: number}>}
 */
const extractTextWithOCR = async (filePath, mimeType, pdfType = null) => {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        text: '',
        confidence: 0,
        error: `File not found: ${filePath}`,
      };
    }

    // Check if file is an image type that Tesseract can process
    const supportedImageTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/bmp',
      'image/webp',
    ];

    let imagesToProcess = [filePath];
    let extractedText = '';

    // Handle PDF files
    if (mimeType === 'application/pdf') {
      try {
        // If user specified PDF type, use that
        if (pdfType === 'text') {
          // User says it's text-based - extract text directly
          console.log('Processing text-based PDF as specified by user...');
          const pdfResult = await extractTextFromPDF(filePath);
          
          if (pdfResult.text && pdfResult.text.trim().length > 0) {
            console.log(`Successfully extracted ${pdfResult.text.length} characters from text-based PDF`);
            return {
              text: pdfResult.text,
              confidence: 0.95, // High confidence for text-based PDFs
            };
          } else {
            // Text extraction returned empty - might be image-based after all
            console.warn('Text extraction returned empty, but user specified text-based. Trying OCR...');
            // Fall through to image-based processing
          }
        } else if (pdfType === 'image') {
          // User says it's image-based - need to convert to images and use OCR
          console.log('Processing image-based PDF as specified by user...');
          // Try to extract text first (some image PDFs might have some text)
          const pdfResult = await extractTextFromPDF(filePath);
          
          if (pdfResult.text && pdfResult.text.trim().length > 0) {
            // Got some text, but user said it's image-based, so confidence is lower
            console.log(`Extracted ${pdfResult.text.length} characters from image-based PDF`);
            return {
              text: pdfResult.text,
              confidence: 0.70, // Lower confidence for image-based PDFs
            };
          }
          
          // No text extracted - truly image-based, would need OCR
          return {
            text: '',
            confidence: 0,
            error: 'Image-based PDF OCR requires converting PDF pages to images first. For now, please convert PDF pages to images (PNG/JPG) and upload them separately, or use a text-based PDF.',
          };
        } else {
          // No type specified - try text extraction first, then fallback
          console.log('PDF type not specified, attempting text extraction first...');
          const pdfResult = await extractTextFromPDF(filePath);
          
          if (pdfResult.isTextBased && pdfResult.text && pdfResult.text.trim().length > 50) {
            console.log(`Successfully extracted ${pdfResult.text.length} characters from text-based PDF`);
            return {
              text: pdfResult.text,
              confidence: 0.95,
            };
          }
          
          // Text extraction failed or returned little text - likely image-based
          console.log('PDF appears to be image-based. User should specify PDF type.');
          return {
            text: '',
            confidence: 0,
            error: 'Could not extract text from PDF. Please specify if this is a text-based or image-based PDF.',
          };
        }
      } catch (error) {
        console.error('PDF processing failed:', error);
        return {
          text: '',
          confidence: 0,
          error: `Failed to process PDF: ${error.message}`,
        };
      }
    } else if (!supportedImageTypes.includes(mimeType)) {
      return {
        text: '',
        confidence: 0,
        error: `Unsupported file type: ${mimeType}. Please upload an image or PDF file.`,
      };
    }

    // Process all images and combine text
    let allText = '';
    let totalConfidence = 0;
    let processedCount = 0;

    for (const imagePath of imagesToProcess) {
      try {
        console.log(`Processing OCR for: ${imagePath}`);
        const { data: { text }, confidence } = await Tesseract.recognize(
          imagePath,
          'eng', // Language - can be extended to support multiple languages
          {
            logger: (m) => {
              // Log progress if needed
              if (m.status === 'recognizing text') {
                console.log(`OCR Progress for ${path.basename(imagePath)}: ${Math.round(m.progress * 100)}%`);
              }
            },
          }
        );

        allText += text.trim() + '\n\n';
        totalConfidence += confidence || 0;
        processedCount++;

        // Clean up temporary PDF images after processing
        if (mimeType === 'application/pdf' && imagePath !== filePath) {
          try {
            fs.unlinkSync(imagePath);
          } catch (cleanupError) {
            console.warn('Failed to cleanup temporary image:', cleanupError);
          }
        }
      } catch (error) {
        console.error(`OCR Error for ${imagePath}:`, error);
        // Continue with other images even if one fails
      }
    }


    const avgConfidence = processedCount > 0 ? totalConfidence / processedCount : 0;

    return {
      text: allText.trim(),
      confidence: avgConfidence,
    };
  } catch (error) {
    console.error('OCR Error:', error);
    return {
      text: '',
      confidence: 0,
      error: error.message || 'OCR processing failed',
    };
  }
};

/**
 * Extract text using cloud OCR API (Google Cloud Vision, AWS Textract, etc.)
 * This is a placeholder for production integration
 * @param {string} filePath - Local file path to the document
 * @param {string} mimeType - MIME type of the file
 * @param {string} pdfType - Optional: 'text' or 'image' for PDFs
 * @returns {Promise<{text: string, confidence: number}>}
 */
const extractTextWithCloudOCR = async (filePath, mimeType, pdfType = null) => {
  // Placeholder for cloud OCR integration
  // Options:
  // 1. Google Cloud Vision API
  // 2. AWS Textract
  // 3. Azure Computer Vision
  // 4. Adobe PDF Services API (for PDFs)

  // Example structure for Google Cloud Vision:
  /*
  const vision = require('@google-cloud/vision');
  const client = new vision.ImageAnnotatorClient();
  
  const [result] = await client.textDetection(filePath);
  const detections = result.textAnnotations;
  const text = detections[0]?.description || '';
  
  return {
    text,
    confidence: 0.95, // Cloud APIs typically have high confidence
  };
  */

  // For now, fallback to Tesseract
  return extractTextWithOCR(filePath, mimeType, pdfType);
};

/**
 * Process document with OCR
 * @param {Object} documentData - Document data with filePath (local path), mimeType, and optional pdfType
 * @returns {Promise<Object>} OCR results
 */
const processDocumentOCR = async (documentData) => {
  const { filePath, mimeType, pdfType } = documentData;

  if (!filePath) {
    return {
      success: false,
      error: 'File path is required',
    };
  }

  try {
    // Use the file path as-is (should be absolute path from multer)
    let localFilePath = filePath;
    
    // If it's a URL, extract the filename and construct local path
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      const urlParts = filePath.split('/');
      const filename = urlParts[urlParts.length - 1];
      localFilePath = path.join(process.cwd(), 'uploads', 'documents', filename);
    } else if (!path.isAbsolute(filePath)) {
      // If relative path, make it absolute relative to project root
      localFilePath = path.join(process.cwd(), filePath);
    }

    console.log(`Processing OCR for file: ${localFilePath}`);
    
    // Verify file exists
    if (!fs.existsSync(localFilePath)) {
      console.error(`File not found: ${localFilePath}`);
      return {
        success: false,
        error: `File not found: ${localFilePath}`,
        extractedText: '',
        confidence: 0,
      };
    }

    // Use cloud OCR if available, otherwise use Tesseract
    const useCloudOCR = process.env.USE_CLOUD_OCR === 'true';
    
    let result;
    if (useCloudOCR) {
      result = await extractTextWithCloudOCR(localFilePath, mimeType, pdfType);
    } else {
      result = await extractTextWithOCR(localFilePath, mimeType, pdfType);
    }

    if (result.error) {
      console.error('OCR processing error:', result.error);
      return {
        success: false,
        error: result.error,
        extractedText: result.text || '',
        confidence: result.confidence || 0,
      };
    }

    console.log(`OCR completed. Extracted ${result.text.length} characters with ${result.confidence}% confidence`);

    return {
      success: true,
      extractedText: result.text,
      confidence: result.confidence,
      ocrProcessed: true,
    };
  } catch (error) {
    console.error('Document OCR processing error:', error);
    return {
      success: false,
      error: error.message || 'OCR processing failed',
      extractedText: '',
      confidence: 0,
    };
  }
};

module.exports = {
  extractTextWithOCR,
  extractTextWithCloudOCR,
  processDocumentOCR,
};

