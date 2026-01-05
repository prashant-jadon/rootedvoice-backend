const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine upload folder based on file type
    let folder = 'uploads/';
    
    if (file.fieldname === 'avatar') {
      folder += 'avatars/';
    } else if (file.fieldname === 'document') {
      folder += 'documents/';
    } else if (file.fieldname === 'spaMembership' || file.fieldname === 'stateRegistration' || 
               file.fieldname === 'professionalIndemnityInsurance' || file.fieldname === 'workingWithChildrenCheck' ||
               file.fieldname === 'policeCheck' || file.fieldname === 'academicQualification' ||
               file.fieldname === 'additionalCredential') {
      folder += 'documents/compliance/';
    } else if (file.fieldname === 'attachments') {
      folder += 'attachments/';
    } else if (file.fieldname === 'resource') {
      folder += 'resources/';
    } else if (file.fieldname === 'recording') {
      folder += 'recordings/';
    }
    
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedDocTypes = /pdf|doc|docx|txt/;
  const allowedVideoTypes = /mp4|avi|mov|wmv/;
  const allowedAudioTypes = /mp3|wav|ogg/;
  
  const extname = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype;
  
  // Check based on fieldname
  if (file.fieldname === 'avatar') {
    if (allowedImageTypes.test(extname) && mimetype.startsWith('image/')) {
      return cb(null, true);
    }
  } else if (file.fieldname === 'document') {
    if (allowedDocTypes.test(extname) || allowedImageTypes.test(extname)) {
      return cb(null, true);
    }
  } else if (file.fieldname === 'spaMembership' || file.fieldname === 'stateRegistration' || 
             file.fieldname === 'professionalIndemnityInsurance' || file.fieldname === 'workingWithChildrenCheck' ||
             file.fieldname === 'policeCheck' || file.fieldname === 'academicQualification' ||
             file.fieldname === 'additionalCredential') {
    // Compliance documents: PDF, images, or Word docs
    if (allowedDocTypes.test(extname) || allowedImageTypes.test(extname)) {
      return cb(null, true);
    }
  } else if (file.fieldname === 'attachments') {
    // Attachments can be documents, images, or other files
    if (
      allowedDocTypes.test(extname) ||
      allowedImageTypes.test(extname) ||
      allowedVideoTypes.test(extname) ||
      allowedAudioTypes.test(extname)
    ) {
      return cb(null, true);
    }
  } else if (file.fieldname === 'resource') {
    // Resources can be images, videos, audio, or documents
    if (
      allowedImageTypes.test(extname) ||
      allowedDocTypes.test(extname) ||
      allowedVideoTypes.test(extname) ||
      allowedAudioTypes.test(extname)
    ) {
      return cb(null, true);
    }
  } else if (file.fieldname === 'recording') {
    if (allowedVideoTypes.test(extname) && mimetype.startsWith('video/')) {
      return cb(null, true);
    }
  }
  
  cb(new Error(`Invalid file type for ${file.fieldname}. File: ${file.originalname}`));
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
  },
  fileFilter: fileFilter,
});

module.exports = upload;

