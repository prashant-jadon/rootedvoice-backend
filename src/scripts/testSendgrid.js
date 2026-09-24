/* eslint-disable no-console */
/**
 * Sends test emails through SendGrid using the app's emailService.
 *
 * Usage:
 *   node src/scripts/testSendgrid.js                     # sends both signup notifications to ADMIN_NOTIFICATION_EMAIL
 *   node src/scripts/testSendgrid.js you@example.com     # overrides the recipient
 *   node src/scripts/testSendgrid.js you@example.com therapist   # only the therapist-signup notification
 *   node src/scripts/testSendgrid.js you@example.com client      # only the client-signup notification
 *   node src/scripts/testSendgrid.js you@example.com plain       # a minimal sanity-check email (no template)
 *
 * Verifies:
 *   - SENDGRID_API_KEY is set and accepted
 *   - FROM_EMAIL is verified in SendGrid (domain auth or single-sender)
 *   - The admin-signup template renders and delivers
 */

require('dotenv').config();

const {
  sendEmail,
  emailTemplates,
  ADMIN_NOTIFICATION_EMAIL,
} = require('../utils/emailService');

const recipient = process.argv[2] || ADMIN_NOTIFICATION_EMAIL;
const mode = (process.argv[3] || 'both').toLowerCase();

const fakeTherapist = {
  firstName: 'Test',
  lastName: 'Therapist',
  email: 'test.therapist@example.com',
  phone: '+1 555 0100',
};

const fakeClient = {
  firstName: 'Test',
  lastName: 'Client',
  email: 'test.client@example.com',
  phone: '+1 555 0101',
};

const therapistExtras = {
  Credentials: 'SLP',
  'License #': 'TEST-12345',
  'Licensed States': 'CA, NY',
};

const clientExtras = {
  'Date of Birth': '1995-04-12',
  Guardian: 'N/A',
  'Guardian Relation': 'N/A',
};

function preflight() {
  const problems = [];
  if (!process.env.SENDGRID_API_KEY) {
    problems.push('SENDGRID_API_KEY is not set — the script will log-only, no email will actually send.');
  } else if (!process.env.SENDGRID_API_KEY.startsWith('SG.')) {
    problems.push('SENDGRID_API_KEY does not start with "SG." — double-check the value.');
  }
  if (!process.env.FROM_EMAIL) {
    problems.push('FROM_EMAIL not set — defaulting to noreply@rootedvoices.com (may not be verified in SendGrid).');
  }
  if (!recipient || !recipient.includes('@')) {
    problems.push(`Recipient "${recipient}" does not look like an email address.`);
  }
  return problems;
}

async function run() {
  console.log('─── SendGrid test ───');
  console.log(`Recipient:  ${recipient}`);
  console.log(`From:       ${process.env.FROM_EMAIL || 'noreply@rootedvoices.com'} (${process.env.FROM_NAME || 'Rooted Voices'})`);
  console.log(`Mode:       ${mode}`);
  console.log('');

  const issues = preflight();
  if (issues.length) {
    console.warn('Pre-flight warnings:');
    issues.forEach((p) => console.warn(`  • ${p}`));
    console.warn('');
  }

  const sends = [];

  if (mode === 'plain') {
    sends.push({
      label: 'plain sanity check',
      payload: {
        to: recipient,
        subject: 'SendGrid test — plain',
        text: 'If you received this, SendGrid is delivering from the Rooted Voices backend.',
        html: '<p>If you received this, <strong>SendGrid is delivering</strong> from the Rooted Voices backend.</p>',
      },
    });
  }

  if (mode === 'therapist' || mode === 'both') {
    sends.push({
      label: 'therapist signup notification',
      payload: {
        to: recipient,
        ...emailTemplates.adminNewSignup('therapist', fakeTherapist, therapistExtras),
      },
    });
  }

  if (mode === 'client' || mode === 'both') {
    sends.push({
      label: 'client signup notification',
      payload: {
        to: recipient,
        ...emailTemplates.adminNewSignup('client', fakeClient, clientExtras),
      },
    });
  }

  if (!sends.length) {
    console.error(`Unknown mode "${mode}". Use one of: both | therapist | client | plain`);
    process.exit(1);
  }

  let failed = 0;
  for (const s of sends) {
    process.stdout.write(`Sending ${s.label}… `);
    const result = await sendEmail(s.payload);
    if (result.success) {
      console.log(`ok (status ${result.statusCode || 'n/a'})`);
    } else {
      failed += 1;
      console.log(`FAILED — ${result.error}`);
    }
  }

  console.log('');
  if (failed === 0) {
    console.log('All test emails accepted by SendGrid.');
    console.log(`Check the inbox of ${recipient} (and its spam folder) in the next minute or two.`);
    process.exit(0);
  } else {
    console.error(`${failed} send(s) failed. See errors above.`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
