const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required'],
  },
  guardianName: {
    type: String,
    trim: true,
  },
  guardianRelation: {
    type: String,
    trim: true,
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
  },
  emergencyContact: {
    name: String,
    phone: String,
    relation: String,
  },
  medicalHistory: {
    type: String,
    maxlength: 5000,
  },
  currentDiagnoses: [{
    type: String,
    trim: true,
  }],
  assignedTherapist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Therapist',
  },
  insuranceInfo: {
    provider: String,
    policyNumber: String,
    groupNumber: String,
  },
  documents: [{
    type: {
      type: String,
      enum: ['IEP', 'IFSP', 'medical', 'evaluation', 'discharge', 'assessment', 'other'],
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    notes: String,
    // OCR and AI Analysis fields
    ocrProcessed: {
      type: Boolean,
      default: false,
    },
    extractedText: {
      type: String,
    },
    aiAnalysis: {
      keyPoints: [{
        type: String,
      }],
      summary: String,
      importantDates: [{
        date: {
          type: mongoose.Schema.Types.Mixed, // Can be Date or String
        },
        description: String,
      }],
      diagnoses: [{
        type: String,
      }],
      recommendations: [{
        type: String,
      }],
      analyzedAt: Date,
    },
    ocrConfidence: Number,
    ocrError: String,
    fileSize: Number,
    mimeType: String,
  }],
  preferences: {
    sessionReminders: {
      enabled: {
        type: Boolean,
        default: true,
      },
      email24h: {
        type: Boolean,
        default: true,
      },
      email45m: {
        type: Boolean,
        default: true,
      },
      sms24h: {
        type: Boolean,
        default: false,
      },
      sms45m: {
        type: Boolean,
        default: true,
      },
      push24h: {
        type: Boolean,
        default: true,
      },
      push45m: {
        type: Boolean,
        default: true,
      },
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    smsNotifications: {
      type: Boolean,
      default: false,
    },
    preferredLanguage: {
      type: String,
      default: 'en',
    },
    enableTranslation: {
      type: Boolean,
      default: false,
    },
  },
  spokenLanguages: [{
    type: String,
    enum: ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'pt', 'ru', 'it', 'hi', 'nl', 'pl', 'tr', 'vi', 'asl'],
  }],
}, {
  timestamps: true,
});

// Indexes
clientSchema.index({ userId: 1 });
clientSchema.index({ assignedTherapist: 1 });
clientSchema.index({ dateOfBirth: 1 });

// Virtual for age
clientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Virtual for age group
clientSchema.virtual('ageGroup').get(function() {
  const age = this.age;
  if (age === null) return 'Unknown';
  if (age <= 3) return '0-3';
  if (age <= 12) return '3-12';
  if (age <= 18) return '13-18';
  if (age <= 65) return '18-65';
  return '65+';
});

const Client = mongoose.model('Client', clientSchema);

module.exports = Client;

