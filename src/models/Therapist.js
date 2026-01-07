const mongoose = require('mongoose');

const therapistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  licenseNumber: {
    type: String,
    required: [true, 'License number is required'],
    trim: true,
  },
  licensedStates: [{
    type: String,
    required: true,
  }],
  // Australia-specific: Practice location
  practiceLocation: {
    state: String, // NSW, VIC, QLD, SA, WA, TAS, NT, ACT
    city: String,
    postcode: String,
  },
  specializations: [{
    type: String,
    enum: [
      'Early Intervention',
      'Articulation & Phonology',
      'Language Development',
      'Fluency/Stuttering',
      'Voice Therapy',
      'Feeding & Swallowing',
      'AAC',
      'Cognitive-Communication',
      'Neurogenic Disorders',
      'Accent Modification',
      'Gender-Affirming Voice',
      'Pediatric',
      'Adult',
      'Geriatric',
    ],
  }],
  bio: {
    type: String,
    maxlength: [2000, 'Bio cannot exceed 2000 characters'],
  },
  location: {
    type: String,
    trim: true,
  },
  education: [{
    degree: String,
    institution: String,
    year: Number,
  }],
  certifications: [{
    name: String,
    issuer: String,
    year: Number,
  }],
  workExperience: [{
    position: String,
    company: String,
    startDate: Date,
    endDate: Date,
    isCurrent: {
      type: Boolean,
      default: false,
    },
    description: String,
  }],
  experience: {
    type: Number,
    default: 0,
    min: 0,
  },
  hourlyRate: {
    type: Number,
    required: [true, 'Hourly rate is required'],
    min: [0, 'Hourly rate must be positive'],
    validate: {
      validator: function(value) {
        // Rate cap validation will be handled in controller
        // This allows flexibility for admin to set caps
        return value >= 0;
      },
      message: 'Hourly rate must be a positive number',
    },
  },
  availability: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
    startTime: String,
    endTime: String,
  }],
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  totalReviews: {
    type: Number,
    default: 0,
  },
  totalSessions: {
    type: Number,
    default: 0,
  },
  activeClients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
  }],
  isVerified: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['pending', 'inactive', 'active', 'paused'],
    default: 'pending',
  },
  stripeAccountId: {
    type: String,
  },
  credentials: {
    type: String,
    enum: ['SLP', 'SLPA'],
    default: 'SLP',
  },
  canSupervise: {
    type: Boolean,
    default: false,
    comment: 'Indicates if this SLP can supervise SLPA assistants',
  },
  // Compliance documents
  complianceDocuments: {
    // Australia-specific: Speech Pathology Australia (SPA) membership
    spaMembership: {
      membershipNumber: String,
      membershipType: String, // Full Member, Provisional Member, etc.
      expirationDate: Date,
      documentUrl: String, // Uploaded document file path
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    // State registration (varies by Australian state)
    stateRegistration: {
      registrationNumber: String,
      state: String, // NSW, VIC, QLD, SA, WA, TAS, NT, ACT
      expirationDate: Date,
      documentUrl: String,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    // Professional indemnity insurance
    professionalIndemnityInsurance: {
      provider: String,
      policyNumber: String,
      coverageAmount: String,
      expirationDate: Date,
      documentUrl: String,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    // Working with Children Check (WWCC)
    workingWithChildrenCheck: {
      checkNumber: String,
      state: String,
      expirationDate: Date,
      documentUrl: String,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    // Police check / National Police Check
    policeCheck: {
      checkNumber: String,
      issueDate: Date,
      expirationDate: Date,
      documentUrl: String,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    // Academic qualifications
    academicQualifications: [{
      degree: String, // Bachelor, Master, PhD, etc.
      institution: String,
      year: Number,
      documentUrl: String,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    }],
    // Additional certifications
    additionalCredentials: [{
      name: String,
      issuer: String,
      expirationDate: Date,
      documentUrl: String,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    }],
    // Legacy support for US-based fields
    stateLicense: {
      number: String,
      state: String,
      expirationDate: Date,
      documentUrl: String,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    liabilityInsurance: {
      provider: String,
      policyNumber: String,
      expirationDate: Date,
      documentUrl: String,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
  },
  // Admin notes
  adminNotes: [{
    note: String,
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now },
  }],
  // Pause/deactivation info
  pausedAt: Date,
  pausedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  pauseReason: String,
  spokenLanguages: [{
    type: String,
    enum: ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'pt', 'ru', 'it', 'hi', 'nl', 'pl', 'tr', 'vi', 'asl'],
  }],
  bilingualTherapy: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Indexes
therapistSchema.index({ userId: 1 });
therapistSchema.index({ licensedStates: 1 });
therapistSchema.index({ specializations: 1 });
therapistSchema.index({ rating: -1 });
therapistSchema.index({ isVerified: 1 });
therapistSchema.index({ status: 1 });
therapistSchema.index({ credentials: 1 });

// Virtual for active client count
therapistSchema.virtual('activeClientCount').get(function() {
  return this.activeClients.length;
});

const Therapist = mongoose.model('Therapist', therapistSchema);

module.exports = Therapist;

