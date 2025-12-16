const Client = require('../models/Client');
const User = require('../models/User');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Get all clients (for therapist)
// @route   GET /api/clients
// @access  Private (Therapist)
const getClients = asyncHandler(async (req, res) => {
  const Therapist = require('../models/Therapist');
  
  // Get therapist profile
  const therapist = await Therapist.findOne({ userId: req.user._id });
  
  if (!therapist) {
    return res.status(404).json({
      success: false,
      message: 'Therapist profile not found',
    });
  }

  // Get clients assigned to this therapist
  const clients = await Client.find({ assignedTherapist: therapist._id })
    .populate('userId', 'firstName lastName email avatar phone')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: clients,
  });
});

// @desc    Get client by ID
// @route   GET /api/clients/:id
// @access  Private
const getClient = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id)
    .populate('userId', 'firstName lastName email avatar phone')
    .populate({
      path: 'assignedTherapist',
      populate: {
        path: 'userId',
        select: 'firstName lastName email'
      }
    });

  if (!client) {
    return res.status(404).json({
      success: false,
      message: 'Client not found',
    });
  }

  // Check authorization
  if (req.user.role === 'client' && client.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  res.json({
    success: true,
    data: client,
  });
});

// @desc    Get own client profile
// @route   GET /api/clients/me
// @access  Private (Client)
const getMyProfile = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ userId: req.user._id })
    .populate('userId', 'firstName lastName email avatar phone')
    .populate({
      path: 'assignedTherapist',
      populate: {
        path: 'userId',
        select: 'firstName lastName email'
      }
    });

  if (!client) {
    return res.status(404).json({
      success: false,
      message: 'Client profile not found',
    });
  }

  res.json({
    success: true,
    data: client,
  });
});

// @desc    Create or update client profile
// @route   POST /api/clients
// @access  Private (Client)
const createOrUpdateClient = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  let client = await Client.findOne({ userId });

  if (client) {
    // Update existing profile
    client = await Client.findOneAndUpdate(
      { userId },
      req.body,
      { new: true, runValidators: true }
    ).populate('userId', 'firstName lastName email avatar');
  } else {
    // Create new profile
    client = await Client.create({
      userId,
      ...req.body,
    });
    client = await client.populate('userId', 'firstName lastName email avatar');
  }

  res.json({
    success: true,
    data: client,
  });
});

// @desc    Upload client document
// @route   POST /api/clients/:id/documents
// @access  Private
const uploadDocument = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id);

  if (!client) {
    return res.status(404).json({
      success: false,
      message: 'Client not found',
    });
  }

  // Check authorization
  if (req.user.role === 'client' && client.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const { type, notes, pdfType } = req.body;
  
  // Get file from multer upload
  const file = req.file;
  if (!file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded',
    });
  }

  // Construct file URL for frontend access
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/documents/${file.filename}`;
  // Get local file path (multer saves to file.path)
  const localFilePath = file.path;
  const fileName = file.originalname;
  const fileSize = file.size;
  const mimeType = file.mimetype;

  console.log('Document upload:', {
    fileName,
    fileSize,
    mimeType,
    localFilePath,
    fileUrl,
  });

  // Create document object
  const newDocument = {
    type,
    fileName,
    fileUrl,
    notes,
    uploadedAt: new Date(),
    fileSize: fileSize || 0,
    mimeType: mimeType || 'application/octet-stream',
    ocrProcessed: false,
  };

  // Add document to client first
  client.documents.push(newDocument);
  await client.save();

  // Get the newly created document ID
  const savedDocument = client.documents[client.documents.length - 1];
  const documentId = savedDocument._id;

  // Process OCR and AI Analysis asynchronously
  // This allows the response to return quickly while processing happens in background
  const processDocumentAsync = async () => {
    try {
      const { processDocumentOCR } = require('../utils/ocrService');
      const { analyzeDocument } = require('../utils/aiDocumentAnalysis');
      const path = require('path');

      // Get local file path (file is already saved by multer)
      // Multer provides file.path which is the full path to the saved file
      const localFilePath = file.path;

      console.log(`Starting OCR processing for document: ${documentId}`);
      console.log(`File path: ${localFilePath}`);
      console.log(`File exists: ${require('fs').existsSync(localFilePath)}`);

      // Process OCR with local file path
      const ocrResult = await processDocumentOCR({
        filePath: localFilePath,
        mimeType: mimeType || 'application/octet-stream',
        pdfType: pdfType, // 'text' or 'image' for PDFs
      });

      console.log(`OCR Result:`, {
        success: ocrResult.success,
        textLength: ocrResult.extractedText?.length || 0,
        confidence: ocrResult.confidence,
        error: ocrResult.error,
      });

      // Update the document in the database with OCR results
      const updatedClient = await Client.findById(req.params.id);
      const document = updatedClient.documents.id(documentId);

      if (!document) {
        console.error(`Document ${documentId} not found in client ${req.params.id}`);
        return;
      }

      if (ocrResult.success && ocrResult.extractedText) {
        document.extractedText = ocrResult.extractedText;
        document.ocrProcessed = true;
        document.ocrConfidence = ocrResult.confidence;
        await updatedClient.save();
        console.log(`OCR results saved for document: ${documentId}`);

        // Process AI Analysis if OCR was successful and has text
        if (ocrResult.extractedText.trim().length > 0) {
          console.log(`Starting AI analysis for document: ${documentId}`);
          try {
            const analysisResult = await analyzeDocument(ocrResult.extractedText, type);
            
            console.log(`AI Analysis Result:`, {
              success: analysisResult.success,
              hasAnalysis: !!analysisResult.analysis,
              error: analysisResult.error,
            });

            if (analysisResult.success && analysisResult.analysis) {
              // Ensure dates are properly serialized
              const analysisData = {
                ...analysisResult.analysis,
                importantDates: analysisResult.analysis.importantDates?.map(item => ({
                  date: item.date instanceof Date ? item.date.toISOString() : item.date,
                  description: item.description,
                })) || [],
                analyzedAt: new Date(),
              };

              document.aiAnalysis = analysisData;
              await updatedClient.save();
              console.log(`✅ AI analysis results saved for document: ${documentId}`);
              console.log(`   Summary: ${(analysisData.summary || '').substring(0, 100)}...`);
              console.log(`   Key points: ${analysisData.keyPoints.length}`);
              console.log(`   Dates: ${analysisData.importantDates.length}`);
              console.log(`   Diagnoses: ${analysisData.diagnoses.length}`);
              console.log(`   Recommendations: ${analysisData.recommendations.length}`);
            } else {
              console.warn(`AI analysis failed for document ${documentId}:`, analysisResult.error);
              // Mark OCR as processed even if AI fails
              document.ocrProcessed = true;
              await updatedClient.save();
            }
          } catch (aiError) {
            console.error(`AI analysis error for document ${documentId}:`, aiError);
            // Mark OCR as processed even if AI fails
            document.ocrProcessed = true;
            await updatedClient.save();
          }
        } else {
          console.warn(`No text extracted from document ${documentId}, skipping AI analysis`);
          document.ocrProcessed = true;
          await updatedClient.save();
        }
      } else {
        // OCR failed - mark as processed but log error
        console.error(`OCR failed for document ${documentId}:`, ocrResult.error);
        document.ocrProcessed = true; // Mark as processed to stop showing "processing"
        document.ocrError = ocrResult.error;
        await updatedClient.save();
      }
    } catch (error) {
      console.error('Error processing document OCR/AI:', error);
      // Try to mark document as processed to prevent infinite "processing" state
      try {
        const updatedClient = await Client.findById(req.params.id);
        const document = updatedClient.documents.id(documentId);
        if (document) {
          document.ocrProcessed = true;
          document.ocrError = error.message || 'Processing failed';
          await updatedClient.save();
        }
      } catch (saveError) {
        console.error('Failed to update document error status:', saveError);
      }
    }
  };

  // Start async processing (don't await - let it run in background)
  processDocumentAsync();

  // Notify assigned therapist if document is uploaded
  if (client.assignedTherapist) {
    const Therapist = require('../models/Therapist');
    const therapist = await Therapist.findById(client.assignedTherapist).populate('userId');
    if (therapist && therapist.userId) {
      const { sendEmail, emailTemplates } = require('../utils/emailService');
      await sendEmail({
        to: therapist.userId.email,
        subject: `New Document Uploaded - ${client.userId.firstName} ${client.userId.lastName}`,
        html: `
          <h2>New Document Uploaded</h2>
          <p>A new document has been uploaded for your client:</p>
          <p><strong>Client:</strong> ${client.userId.firstName} ${client.userId.lastName}</p>
          <p><strong>Document Type:</strong> ${type}</p>
          <p><strong>File Name:</strong> ${fileName}</p>
          ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
          <p>Please review the document in the client's profile.</p>
        `,
      });
    }
  }

  res.json({
    success: true,
    message: 'Document uploaded successfully',
    data: client,
  });
});

// @desc    Get client documents
// @route   GET /api/clients/:id/documents
// @access  Private
const getDocuments = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id);

  if (!client) {
    return res.status(404).json({
      success: false,
      message: 'Client not found',
    });
  }

  // Check authorization
  if (req.user.role === 'client' && client.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  res.json({
    success: true,
    data: client.documents,
  });
});

// @desc    Delete client document
// @route   DELETE /api/clients/:id/documents/:docId
// @access  Private
const deleteDocument = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id);

  if (!client) {
    return res.status(404).json({
      success: false,
      message: 'Client not found',
    });
  }

  // Check authorization
  if (req.user.role === 'client' && client.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  client.documents = client.documents.filter(
    doc => doc._id.toString() !== req.params.docId
  );

  await client.save();

  res.json({
    success: true,
    message: 'Document deleted successfully',
    data: client,
  });
});

// @desc    Get therapy history timeline
// @route   GET /api/clients/:id/timeline
// @access  Private
const getTherapyTimeline = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id)
    .populate('userId', 'firstName lastName');

  if (!client) {
    return res.status(404).json({
      success: false,
      message: 'Client not found',
    });
  }

  // Check authorization
  if (req.user.role === 'client' && client.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const Session = require('../models/Session');
  const Assignment = require('../models/Assignment');

  // Get all sessions
  const sessions = await Session.find({ clientId: client._id })
    .populate('therapistId', 'userId')
    .populate({
      path: 'therapistId',
      populate: { path: 'userId', select: 'firstName lastName' }
    })
    .sort({ scheduledDate: -1 });

  // Get all assignments
  const assignments = await Assignment.find({ clientId: client._id })
    .populate('therapistId', 'userId')
    .sort({ createdAt: -1 });

  // Get all documents
  const documents = client.documents || [];

  // Combine and sort by date
  const timeline = [];

  // Add sessions
  sessions.forEach(session => {
    timeline.push({
      type: 'session',
      id: session._id,
      date: session.scheduledDate,
      title: `${session.sessionType} Session`,
      description: `Session with ${session.therapistId?.userId?.firstName || 'Therapist'}`,
      status: session.status,
      data: {
        duration: session.duration,
        price: session.price,
        notes: session.notes,
      },
    });
  });

  // Add documents
  documents.forEach(doc => {
    timeline.push({
      type: 'document',
      id: doc._id,
      date: doc.uploadedAt,
      title: `${doc.type} Document`,
      description: doc.fileName,
      status: doc.ocrProcessed ? 'processed' : 'pending',
      data: {
        fileUrl: doc.fileUrl,
        type: doc.type,
        hasAnalysis: !!doc.aiAnalysis,
      },
    });
  });

  // Add assignments
  assignments.forEach(assignment => {
    timeline.push({
      type: 'assignment',
      id: assignment._id,
      date: assignment.createdAt,
      title: assignment.title,
      description: assignment.description,
      status: assignment.completed ? 'completed' : 'pending',
      data: {
        dueDate: assignment.dueDate,
        completed: assignment.completed,
      },
    });
  });

  // Sort by date (most recent first)
  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json({
    success: true,
    data: {
      timeline,
      stats: {
        totalSessions: sessions.length,
        totalDocuments: documents.length,
        totalAssignments: assignments.length,
        completedSessions: sessions.filter(s => s.status === 'completed').length,
        processedDocuments: documents.filter(d => d.ocrProcessed).length,
      },
    },
  });
});

// @desc    Search documents (for therapists)
// @route   GET /api/clients/:id/documents/search
// @access  Private (Therapist)
const searchDocuments = asyncHandler(async (req, res) => {
  const { search, type, hasAnalysis, dateFrom, dateTo } = req.query;

  const client = await Client.findById(req.params.id)
    .populate('userId', 'firstName lastName');

  if (!client) {
    return res.status(404).json({
      success: false,
      message: 'Client not found',
    });
  }

  // Only therapists can search documents
  if (req.user.role !== 'therapist') {
    return res.status(403).json({
      success: false,
      message: 'Only therapists can search documents',
    });
  }

  let documents = client.documents || [];

  // Filter by type
  if (type) {
    documents = documents.filter(doc => doc.type === type);
  }

  // Filter by analysis status
  if (hasAnalysis === 'true') {
    documents = documents.filter(doc => doc.aiAnalysis);
  }

  // Filter by date range
  if (dateFrom || dateTo) {
    documents = documents.filter(doc => {
      const docDate = new Date(doc.uploadedAt);
      if (dateFrom && docDate < new Date(dateFrom)) return false;
      if (dateTo && docDate > new Date(dateTo)) return false;
      return true;
    });
  }

  // Search in text content
  if (search) {
    const searchLower = search.toLowerCase();
    documents = documents.filter(doc => {
      // Search in filename
      if (doc.fileName.toLowerCase().includes(searchLower)) return true;
      
      // Search in extracted text
      if (doc.extractedText && doc.extractedText.toLowerCase().includes(searchLower)) return true;
      
      // Search in AI analysis
      if (doc.aiAnalysis) {
        if (doc.aiAnalysis.summary && doc.aiAnalysis.summary.toLowerCase().includes(searchLower)) return true;
        if (doc.aiAnalysis.keyPoints && doc.aiAnalysis.keyPoints.some(kp => kp.toLowerCase().includes(searchLower))) return true;
        if (doc.aiAnalysis.diagnoses && doc.aiAnalysis.diagnoses.some(d => d.toLowerCase().includes(searchLower))) return true;
        if (doc.aiAnalysis.recommendations && doc.aiAnalysis.recommendations.some(r => r.toLowerCase().includes(searchLower))) return true;
      }
      
      // Search in notes
      if (doc.notes && doc.notes.toLowerCase().includes(searchLower)) return true;
      
      return false;
    });
  }

  // Sort by date (most recent first)
  documents.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  res.json({
    success: true,
    data: {
      documents,
      total: documents.length,
      client: {
        id: client._id,
        name: `${client.userId.firstName} ${client.userId.lastName}`,
      },
    },
  });
});

module.exports = {
  getClients,
  getClient,
  getMyProfile,
  createOrUpdateClient,
  uploadDocument,
  getDocuments,
  deleteDocument,
  getTherapyTimeline,
  searchDocuments,
};

