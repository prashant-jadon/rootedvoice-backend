const User = require('../models/User');
const Therapist = require('../models/Therapist');
const Client = require('../models/Client');
const { generateAccessToken, generateRefreshToken } = require('../config/jwt');
const { asyncHandler } = require('../middlewares/errorHandler');
const { sendEmail, emailTemplates } = require('../utils/emailService');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const { email, password, role, firstName, lastName, phone, ...additionalData } = req.body;

  // Check if user exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({
      success: false,
      message: 'User with this email already exists',
    });
  }

  // Create user
  const user = await User.create({
    email,
    password,
    role,
    firstName,
    lastName,
    phone,
  });

  // Create role-specific profile
  if (role === 'therapist') {
    // Validate credentials
    if (!additionalData.credentials || !['SLP', 'SLPA'].includes(additionalData.credentials)) {
      return res.status(400).json({
        success: false,
        message: 'Valid credentials (SLP or SLPA) are required',
      });
    }

    // Validate required fields for Australia
    if (!additionalData.licenseNumber && !additionalData.spaMembershipNumber) {
      return res.status(400).json({
        success: false,
        message: 'License number or SPA membership number is required',
      });
    }

    // Get rate caps for validation
    const { getRateCapsForUse } = require('./pricingController');
    const rateCaps = getRateCapsForUse();
    const maxRate = rateCaps[additionalData.credentials] || rateCaps.SLP;
    const hourlyRate = additionalData.hourlyRate || (additionalData.credentials === 'SLP' ? 75 : 55);
    
    if (hourlyRate > maxRate) {
      return res.status(400).json({
        success: false,
        message: `Hourly rate for ${additionalData.credentials} cannot exceed $${maxRate}/hour`,
      });
    }

    // Create therapist with pending status (requires admin verification)
    const therapist = await Therapist.create({
      userId: user._id,
      licenseNumber: additionalData.licenseNumber || additionalData.spaMembershipNumber || 'TEMP-' + Date.now(),
      licensedStates: additionalData.licensedStates || [],
      specializations: additionalData.specializations || [],
      hourlyRate: hourlyRate,
      credentials: additionalData.credentials,
      status: 'pending', // Start as pending until admin verifies
      isVerified: false,
      practiceLocation: additionalData.practiceLocation || {},
      // Initialize compliance documents structure
      complianceDocuments: {
        spaMembership: additionalData.spaMembership ? {
          membershipNumber: additionalData.spaMembership.membershipNumber,
          membershipType: additionalData.spaMembership.membershipType,
          expirationDate: additionalData.spaMembership.expirationDate,
          documentUrl: additionalData.spaMembership.documentUrl,
        } : {},
        stateRegistration: additionalData.stateRegistration ? {
          registrationNumber: additionalData.stateRegistration.registrationNumber,
          state: additionalData.stateRegistration.state,
          expirationDate: additionalData.stateRegistration.expirationDate,
          documentUrl: additionalData.stateRegistration.documentUrl,
        } : {},
        professionalIndemnityInsurance: additionalData.professionalIndemnityInsurance ? {
          provider: additionalData.professionalIndemnityInsurance.provider,
          policyNumber: additionalData.professionalIndemnityInsurance.policyNumber,
          coverageAmount: additionalData.professionalIndemnityInsurance.coverageAmount,
          expirationDate: additionalData.professionalIndemnityInsurance.expirationDate,
          documentUrl: additionalData.professionalIndemnityInsurance.documentUrl,
        } : {},
        workingWithChildrenCheck: additionalData.workingWithChildrenCheck ? {
          checkNumber: additionalData.workingWithChildrenCheck.checkNumber,
          state: additionalData.workingWithChildrenCheck.state,
          expirationDate: additionalData.workingWithChildrenCheck.expirationDate,
          documentUrl: additionalData.workingWithChildrenCheck.documentUrl,
        } : {},
        policeCheck: additionalData.policeCheck ? {
          checkNumber: additionalData.policeCheck.checkNumber,
          issueDate: additionalData.policeCheck.issueDate,
          expirationDate: additionalData.policeCheck.expirationDate,
          documentUrl: additionalData.policeCheck.documentUrl,
        } : {},
        academicQualifications: additionalData.academicQualifications || [],
      },
    });

    // Ensure status is explicitly set to pending
    therapist.status = 'pending'
    therapist.isVerified = false
    await therapist.save()
  } else if (role === 'client') {
    await Client.create({
      userId: user._id,
      dateOfBirth: additionalData.dateOfBirth || new Date('2000-01-01'),
      guardianName: additionalData.guardianName,
      guardianRelation: additionalData.guardianRelation,
    });
  }

  // Generate tokens
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  // Send welcome email
  sendEmail({
    to: user.email,
    ...emailTemplates.welcome(user.firstName),
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      accessToken,
      refreshToken,
    },
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide email and password',
    });
  }

  // Check for user (include password for comparison)
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  // Check if password matches
  const isPasswordMatch = await user.comparePassword(password);

  if (!isPasswordMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  // Check if account is active
  if (!user.isActive) {
    return res.status(401).json({
      success: false,
      message: 'Account has been deactivated',
    });
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate tokens
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    },
  });
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const user = req.user;

  let profile = null;
  if (user.role === 'therapist') {
    profile = await Therapist.findOne({ userId: user._id });
  } else if (user.role === 'client') {
    profile = await Client.findOne({ userId: user._id });
  }

  res.json({
    success: true,
    data: {
      user,
      profile,
    },
  });
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'No user found with that email',
    });
  }

  // Generate reset token (simplified for demo)
  const resetToken = require('crypto').randomBytes(32).toString('hex');
  user.passwordResetToken = resetToken;
  user.passwordResetExpires = Date.now() + 3600000; // 1 hour
  await user.save();

  // Create reset URL
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  // Send email
  await sendEmail({
    to: user.email,
    ...emailTemplates.passwordReset(user.firstName, resetUrl),
  });

  res.json({
    success: true,
    message: 'Password reset email sent',
  });
});

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset token',
    });
  }

  // Set new password
  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  res.json({
    success: true,
    message: 'Password reset successful',
  });
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token is required',
    });
  }

  try {
    const jwt = require('jsonwebtoken');
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const decoded = jwt.verify(refreshToken, refreshSecret);

    // Verify it's a refresh token
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type',
      });
    }

    // Get user
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user._id, user.role);

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token',
    });
  }
});

module.exports = {
  register,
  login,
  getMe,
  logout,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
};

