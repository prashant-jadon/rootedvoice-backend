const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@rootedvoices.com';
const FROM_NAME = process.env.FROM_NAME || 'Rooted Voices';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Send email via SendGrid
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('SendGrid not configured. Skipping email send.');
      console.log(`Would send to: ${to}, Subject: ${subject}`);
      return { success: true, message: 'Email service not configured (dev mode)' };
    }

    const msg = {
      to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      text: text || subject,
      html: html || text,
    };

    const result = await sgMail.send(msg);
    console.log('Email sent via SendGrid:', result[0]?.statusCode);
    return { success: true, statusCode: result[0]?.statusCode };
  } catch (error) {
    console.error('SendGrid email error:', error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
};

// ========== EMAIL TEMPLATES ==========

const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #f4f7fa; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #2d5a27 0%, #4a7c59 100%); padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; }
    .body { padding: 32px 24px; color: #333; line-height: 1.6; }
    .body h2 { color: #2d5a27; margin-top: 0; }
    .body p { margin: 12px 0; }
    .btn { display: inline-block; background: #2d5a27; color: #ffffff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
    .info-box { background: #f0f7ee; border-left: 4px solid #2d5a27; padding: 16px; border-radius: 0 8px 8px 0; margin: 16px 0; }
    .credit-box { background: #fff8e1; border-left: 4px solid #f9a825; padding: 16px; border-radius: 0 8px 8px 0; margin: 16px 0; }
    .footer { background: #f8f9fa; padding: 24px; text-align: center; color: #666; font-size: 13px; }
    .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #eee; }
    .detail-label { font-weight: 600; color: #555; min-width: 140px; }
    .detail-value { color: #333; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Rooted Voices</h1>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Rooted Voices. All rights reserved.</p>
      <p>Questions? Contact us at support@rootedvoices.com</p>
    </div>
  </div>
</body>
</html>
`;

// Email Templates
const emailTemplates = {
  // Welcome email
  welcome: (name) => ({
    subject: 'Welcome to Rooted Voices!',
    html: baseTemplate(`
      <h2>Welcome, ${name}!</h2>
      <p>We're excited to have you join our community of speech-language therapy.</p>
      <p>Get started by completing your profile and booking your initial evaluation.</p>
      <a href="${FRONTEND_URL}/evaluation-booking" class="btn">Book Your Evaluation</a>
    `),
  }),

  // Session reminder
  sessionReminder: (name, sessionDate, sessionTime) => ({
    subject: 'Session Reminder - Tomorrow',
    html: baseTemplate(`
      <h2>Session Reminder</h2>
      <p>Hi ${name},</p>
      <p>This is a reminder that you have a therapy session scheduled:</p>
      <div class="info-box">
        <p><strong>Date:</strong> ${sessionDate}</p>
        <p><strong>Time:</strong> ${sessionTime}</p>
      </div>
      <p>Please log in 5 minutes before your session starts.</p>
      <a href="${FRONTEND_URL}/sessions" class="btn">View Session</a>
    `),
  }),

  // Password reset
  passwordReset: (name, resetLink) => ({
    subject: 'Password Reset Request',
    html: baseTemplate(`
      <h2>Password Reset</h2>
      <p>Hi ${name},</p>
      <p>You requested to reset your password. Click the button below:</p>
      <a href="${resetLink}" class="btn">Reset Password</a>
      <p style="color: #888; font-size: 13px;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
    `),
  }),

  // Email verification
  emailVerification: (name, verificationLink) => ({
    subject: 'Verify Your Email',
    html: baseTemplate(`
      <h2>Email Verification</h2>
      <p>Hi ${name},</p>
      <p>Please verify your email address:</p>
      <a href="${verificationLink}" class="btn">Verify Email</a>
      <p style="color: #888; font-size: 13px;">This link expires in 24 hours.</p>
    `),
  }),

  // ========== EVALUATION-SPECIFIC TEMPLATES ==========

  // Sent to client after booking evaluation + paying $195
  evaluationBooked: (clientName, therapistName, scheduledDate, scheduledTime) => ({
    subject: 'Evaluation Booked - Rooted Voices',
    html: baseTemplate(`
      <h2>Your Evaluation is Booked!</h2>
      <p>Hi ${clientName},</p>
      <p>Thank you for booking your diagnostic evaluation. Here are your details:</p>
      <div class="info-box">
        <p><strong>Therapist:</strong> ${therapistName}</p>
        <p><strong>Date:</strong> ${scheduledDate}</p>
        <p><strong>Time:</strong> ${scheduledTime}</p>
        <p><strong>Duration:</strong> 60 minutes</p>
        <p><strong>Type:</strong> Online Video (Jitsi)</p>
      </div>
      <p>Your assigned therapist will review your intake information over the next 3 business days. You'll receive a notification when they are ready.</p>
      <div class="credit-box">
        <p><strong>💰 $195 Evaluation Credit:</strong> Your evaluation fee will be credited toward any subscription you purchase!</p>
      </div>
      <a href="${FRONTEND_URL}/client-evaluation" class="btn">View Evaluation Status</a>
    `),
  }),

  // Sent to therapist when assigned an evaluation
  therapistAssigned: (therapistName, clientName, clientDetails) => ({
    subject: 'New Evaluation Assignment - Rooted Voices',
    html: baseTemplate(`
      <h2>New Evaluation Assignment</h2>
      <p>Hi ${therapistName},</p>
      <p>You have been assigned a new diagnostic evaluation. Please review the client details below:</p>
      <div class="info-box">
        <p><strong>Client:</strong> ${clientName}</p>
        ${clientDetails.dateOfBirth ? `<p><strong>Date of Birth:</strong> ${clientDetails.dateOfBirth}</p>` : ''}
        ${clientDetails.primaryConcerns ? `<p><strong>Primary Concerns:</strong> ${clientDetails.primaryConcerns}</p>` : ''}
        ${clientDetails.communicationConcerns ? `<p><strong>Communication Concerns:</strong> ${clientDetails.communicationConcerns}</p>` : ''}
        ${clientDetails.medicalHistory ? `<p><strong>Medical History:</strong> ${clientDetails.medicalHistory}</p>` : ''}
        ${clientDetails.stateOfResidence ? `<p><strong>State:</strong> ${clientDetails.stateOfResidence}</p>` : ''}
      </div>
      <p>You have <strong>3 business days</strong> to review this information. Once ready, please mark yourself as ready in the platform.</p>
      <a href="${FRONTEND_URL}/my-practice" class="btn">View Evaluation Details</a>
    `),
  }),

  // Sent to client when therapist is ready (after review)
  therapistReady: (clientName, therapistName, scheduledDate, scheduledTime) => ({
    subject: 'Your Therapist is Ready - Evaluation Meeting',
    html: baseTemplate(`
      <h2>Your Therapist is Ready!</h2>
      <p>Hi ${clientName},</p>
      <p>Great news! <strong>${therapistName}</strong> has reviewed your information and is ready for your evaluation meeting.</p>
      <div class="info-box">
        <p><strong>Meeting Date:</strong> ${scheduledDate}</p>
        <p><strong>Meeting Time:</strong> ${scheduledTime}</p>
        <p><strong>Duration:</strong> 60 minutes</p>
      </div>
      <p>You'll receive a meeting link before your appointment. Please ensure you have a stable internet connection and a quiet environment.</p>
      <a href="${FRONTEND_URL}/client-evaluation" class="btn">View Details</a>
    `),
  }),

  // Evaluation meeting reminder (24h before)
  evaluationReminder: (name, scheduledDate, scheduledTime, meetingLink) => ({
    subject: 'Evaluation Tomorrow - Rooted Voices',
    html: baseTemplate(`
      <h2>Your Evaluation is Tomorrow!</h2>
      <p>Hi ${name},</p>
      <p>This is a reminder that your diagnostic evaluation is scheduled for tomorrow:</p>
      <div class="info-box">
        <p><strong>Date:</strong> ${scheduledDate}</p>
        <p><strong>Time:</strong> ${scheduledTime}</p>
        <p><strong>Duration:</strong> 60 minutes</p>
      </div>
      <p>Please join 5 minutes early and ensure you have:</p>
      <ul>
        <li>Stable internet connection</li>
        <li>Camera and microphone working</li>
        <li>A quiet, well-lit environment</li>
      </ul>
      ${meetingLink ? `<a href="${meetingLink}" class="btn">Join Meeting</a>` : `<a href="${FRONTEND_URL}/client-evaluation" class="btn">View Meeting Link</a>`}
    `),
  }),

  // Sent to client after evaluation with recommendations
  evaluationCompleted: (clientName, therapistName, recommendations) => ({
    subject: 'Evaluation Complete - Your Recommendations',
    html: baseTemplate(`
      <h2>Evaluation Complete!</h2>
      <p>Hi ${clientName},</p>
      <p>Your diagnostic evaluation with <strong>${therapistName}</strong> is complete. Here are your personalized recommendations:</p>
      <div class="info-box">
        ${recommendations.tier ? `<p><strong>Recommended Plan:</strong> ${recommendations.tier}</p>` : ''}
        ${recommendations.notes ? `<p><strong>Therapist Notes:</strong> ${recommendations.notes}</p>` : ''}
      </div>
      ${recommendations.resourceAccess ? `
        <p>🎉 You now have access to our <strong>Resource Library</strong>! Explore materials curated for your needs.</p>
        <a href="${FRONTEND_URL}/resources" class="btn" style="margin-right: 8px;">View Resources</a>
      ` : ''}
      <div class="credit-box">
        <p><strong>💰 Remember:</strong> Your $195 evaluation fee will be credited when you purchase a subscription!</p>
      </div>
      <a href="${FRONTEND_URL}/pricing" class="btn">View Subscription Plans</a>
    `),
  }),

  // Subscription credit applied notification
  subscriptionCreditApplied: (clientName, creditAmount, subscriptionName, finalPrice) => ({
    subject: 'Evaluation Credit Applied - Rooted Voices',
    html: baseTemplate(`
      <h2>Credit Applied!</h2>
      <p>Hi ${clientName},</p>
      <p>Your evaluation credit has been applied to your subscription:</p>
      <div class="credit-box">
        <p><strong>Subscription:</strong> ${subscriptionName}</p>
        <p><strong>Credit Applied:</strong> -$${creditAmount}</p>
        <p><strong>Amount Charged:</strong> $${finalPrice}</p>
      </div>
      <p>Thank you for choosing Rooted Voices!</p>
      <a href="${FRONTEND_URL}/client-dashboard" class="btn">Go to Dashboard</a>
    `),
  }),

  // Therapist review reminder (sent 1 day before 3-day deadline)
  therapistReviewReminder: (therapistName, clientName, deadlineDate, evaluationId) => ({
    subject: 'Review Reminder - Evaluation Deadline Approaching',
    html: baseTemplate(`
      <h2>Review Deadline Approaching</h2>
      <p>Hi ${therapistName},</p>
      <p>This is a reminder that your review deadline for the evaluation with <strong>${clientName}</strong> is approaching.</p>
      <div class="info-box">
        <p><strong>Client:</strong> ${clientName}</p>
        <p><strong>Review Deadline:</strong> ${deadlineDate}</p>
      </div>
      <p>Please complete your review and mark yourself as ready. If you don't respond by the deadline, the system will automatically mark you as ready.</p>
      <a href="${FRONTEND_URL}/my-practice" class="btn">Review Now</a>
    `),
  }),

  // Evaluation schedule confirmation (sent to both parties)
  evaluationScheduleConfirmation: (name, therapistName, scheduledDate, scheduledTime, meetingLink) => ({
    subject: 'Evaluation Meeting Confirmed - Rooted Voices',
    html: baseTemplate(`
      <h2>Evaluation Meeting Confirmed</h2>
      <p>Hi ${name},</p>
      <p>Your evaluation meeting has been confirmed. Both parties are ready!</p>
      <div class="info-box">
        <p><strong>Therapist:</strong> ${therapistName}</p>
        <p><strong>Date:</strong> ${scheduledDate}</p>
        <p><strong>Time:</strong> ${scheduledTime}</p>
        <p><strong>Duration:</strong> 60 minutes</p>
        <p><strong>Type:</strong> Online Video (Jitsi)</p>
      </div>
      <p>Please join 5 minutes early and ensure you have a stable internet connection.</p>
      ${meetingLink ? `<a href="${meetingLink}" class="btn">Join Meeting</a>` : `<a href="${FRONTEND_URL}/client-evaluation" class="btn">View Meeting</a>`}
    `),
  }),
};

module.exports = {
  sendEmail,
  emailTemplates,
};
