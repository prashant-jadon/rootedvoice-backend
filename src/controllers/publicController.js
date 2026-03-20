const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Get platform stats (public)
// @route   GET /api/public/platform-stats
// @access  Public
const getPlatformStats = asyncHandler(async (req, res) => {
  const PlatformStats = require('../models/PlatformStats');
  const stats = await PlatformStats.getStats();
  
  res.json({
    success: true,
    data: stats,
  });
});

const submitContactForm = asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  const Inquiry = require('../models/Inquiry');
  const { sendEmail } = require('../utils/emailService');

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ success: false, message: 'Please provide all required fields' });
  }

  // Create document
  const inquiry = await Inquiry.create({ name, email, phone, subject, message });

  // Admin alert email
  await sendEmail({
    to: process.env.ADMIN_EMAIL || 'support@rootedvoices.com',
    subject: `New Contact Inquiry: ${subject}`,
    html: `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong></p>
      <blockquote style="border-left: 4px solid #ccc; padding-left: 10px; color: #555;">
        ${message.replace(/\n/g, '<br>')}
      </blockquote>
    `
  });

  // User auto-reply email
  await sendEmail({
    to: email,
    subject: 'We received your message - Rooted Voices',
    html: `
      <h2>Thank You for Contacting Us</h2>
      <p>Hi ${name},</p>
      <p>We have successfully received your message regarding "<strong>${subject}</strong>".</p>
      <p>Our support team will review your inquiry and get back to you as soon as possible, usually within 24 business hours.</p>
      <br>
      <p>Best regards,<br>The Rooted Voices Team</p>
    `
  });

  res.status(201).json({ success: true, message: 'Message sent successfully', data: inquiry });
});

module.exports = {
  getPlatformStats,
  submitContactForm,
};

