// Gusto contractor onboarding — email-based handoff.
//
// Rooted Voices does NOT integrate with the Gusto API. When an admin
// countersigns a clinician's ICA, this service emails the designated Gusto
// admin with the clinician's name and email. That admin then adds the
// clinician in Gusto manually and selects the "invite the contractor to
// enter their own information" option. Gusto emails the clinician directly,
// and they enter their bank + tax details inside Gusto — that data never
// touches our servers.
//
// Required env vars (service is a no-op if the admin email is missing):
//   GUSTO_ADMIN_EMAIL    — inbox that receives the handoff notification.
//                          Falls back to ADMIN_NOTIFICATION_EMAIL, then
//                          admin@rootedvoicestherapy.com.

const { sendEmail, ADMIN_NOTIFICATION_EMAIL } = require('./emailService');

const getGustoAdminEmail = () =>
  process.env.GUSTO_ADMIN_EMAIL || ADMIN_NOTIFICATION_EMAIL;

const isConfigured = () => Boolean(getGustoAdminEmail());

const buildEmail = ({ user, therapist }) => {
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const credential = therapist.credentials || 'SLP';
  const hourlyRate = Number(therapist.hourlyRate || 0);
  const rateLine = hourlyRate > 0 ? `$${hourlyRate.toFixed(2)}/hr` : 'Not set';

  const subject = `Add contractor to Gusto: ${fullName}`;
  const text = [
    `A clinician has been approved and countersigned on Rooted Voices.`,
    `Please add them to Gusto as a contractor and select the option to invite`,
    `them to enter their own bank and tax information.`,
    ``,
    `Name:       ${fullName}`,
    `Email:      ${user.email}`,
    `Credential: ${credential}`,
    `Hourly rate: ${rateLine}`,
    ``,
    `Gusto will then email ${user.email} directly so they can enter their`,
    `direct-deposit and tax details inside Gusto. Rooted Voices does not`,
    `collect or store any of that information.`,
  ].join('\n');

  const html = `
    <h2>Add Contractor to Gusto</h2>
    <p>A clinician has been approved and countersigned on Rooted Voices.
    Please add them to Gusto as a contractor and select the option to invite
    them to enter their own bank and tax information.</p>
    <table style="border-collapse:collapse;margin:12px 0;">
      <tr><td style="padding:4px 12px 4px 0;color:#555;"><strong>Name</strong></td><td style="padding:4px 0;">${fullName}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555;"><strong>Email</strong></td><td style="padding:4px 0;">${user.email}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555;"><strong>Credential</strong></td><td style="padding:4px 0;">${credential}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555;"><strong>Hourly rate</strong></td><td style="padding:4px 0;">${rateLine}</td></tr>
    </table>
    <p>Gusto will then email <strong>${user.email}</strong> directly so they can
    enter their direct-deposit and tax details inside Gusto. Rooted Voices does
    not collect or store any of that information.</p>
  `;

  return { subject, text, html };
};

// Notify the Gusto admin that a clinician is ready to be added. Returns:
//   { ok: true,  adminEmail }                 on success
//   { ok: false, skipped: true, reason }      if not configured
//   { ok: false, error }                      on email send failure
const notifyGustoAdmin = async ({ user, therapist }) => {
  const adminEmail = getGustoAdminEmail();
  if (!adminEmail) {
    return {
      ok: false,
      skipped: true,
      reason: 'GUSTO_ADMIN_EMAIL (or ADMIN_NOTIFICATION_EMAIL) not set',
    };
  }

  if (!user?.email || !user?.firstName || !user?.lastName) {
    return {
      ok: false,
      error: 'Missing therapist name or email required to notify Gusto admin',
    };
  }

  const { subject, text, html } = buildEmail({ user, therapist });

  const result = await sendEmail({ to: adminEmail, subject, text, html });
  if (result?.success) {
    return { ok: true, adminEmail };
  }

  return {
    ok: false,
    error: result?.error || 'Failed to send Gusto admin notification email',
  };
};

module.exports = {
  isConfigured,
  getGustoAdminEmail,
  notifyGustoAdmin,
};
