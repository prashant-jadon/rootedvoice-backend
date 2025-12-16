const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Send email
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('Email service not configured. Skipping email send.');
      return { success: true, message: 'Email service not configured' };
    }

    const transporter = createTransporter();

    const mailOptions = {
      from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
      to,
      subject,
      text,
      html: html || text,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
};

// Email templates
const emailTemplates = {
  // Welcome email
  welcome: (name) => ({
    subject: 'Welcome to Rooted Voices!',
    html: `
      <h1>Welcome to Rooted Voices, ${name}!</h1>
      <p>We're excited to have you join our community.</p>
      <p>Get started by completing your profile and exploring our platform.</p>
    `,
  }),

  // Session reminder
  sessionReminder: (name, sessionDate, sessionTime) => ({
    subject: 'Session Reminder - Tomorrow',
    html: `
      <h2>Session Reminder</h2>
      <p>Hi ${name},</p>
      <p>This is a reminder that you have a therapy session scheduled for:</p>
      <p><strong>Date:</strong> ${sessionDate}</p>
      <p><strong>Time:</strong> ${sessionTime}</p>
      <p>Please log in 5 minutes before your session starts.</p>
    `,
  }),

  // Password reset
  passwordReset: (name, resetLink) => ({
    subject: 'Password Reset Request',
    html: `
      <h2>Password Reset</h2>
      <p>Hi ${name},</p>
      <p>You requested to reset your password. Click the link below:</p>
      <a href="${resetLink}">Reset Password</a>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  }),

  // Email verification
  emailVerification: (name, verificationLink) => ({
    subject: 'Verify Your Email',
    html: `
      <h2>Email Verification</h2>
      <p>Hi ${name},</p>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${verificationLink}">Verify Email</a>
      <p>This link expires in 24 hours.</p>
    `,
  }),
};

module.exports = {
  sendEmail,
  emailTemplates,
};

