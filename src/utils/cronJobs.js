const cron = require('node-cron');
const Evaluation = require('../models/Evaluation');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Client = require('../models/Client');
const Subscription = require('../models/Subscription');
const Session = require('../models/Session');
const { sendEmail, emailTemplates } = require('./emailService');

// Helper: Format date for display
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
};

// Check therapist review deadlines (runs daily at 9 AM)
const checkTherapistReviewDeadlines = async () => {
    try {
        const now = new Date();

        // Find evaluations where therapist review deadline has passed
        const overdueEvaluations = await Evaluation.find({
            status: { $in: ['therapist_assigned', 'therapist_reviewing'] },
            therapistReviewDeadline: { $lte: now },
        });

        for (const evaluation of overdueEvaluations) {
            // Auto-mark as ready for meeting
            evaluation.status = 'ready_for_meeting';
            evaluation.therapistReadyAt = now;
            await evaluation.save();

            // Notify client
            const clientUser = await User.findById(evaluation.clientId);
            if (clientUser) {
                await Notification.create({
                    userId: evaluation.clientId,
                    type: 'evaluation-therapist-ready',
                    title: 'Your Therapist is Ready!',
                    message: `Your therapist has reviewed your details. Your evaluation meeting is scheduled for ${formatDate(evaluation.scheduledDate)}.`,
                    link: '/client-evaluation',
                    metadata: { evaluationId: evaluation._id }
                });

                const readyEmail = emailTemplates.therapistReady(
                    clientUser.firstName,
                    'Your therapist',
                    formatDate(evaluation.scheduledDate),
                    evaluation.scheduledTime
                );
                await sendEmail({
                    to: clientUser.email,
                    subject: readyEmail.subject,
                    html: readyEmail.html,
                });
            }

            console.log(`✅ Auto-marked evaluation ${evaluation._id} as ready (deadline passed)`);
        }
    } catch (error) {
        console.error('Error checking therapist review deadlines:', error);
    }
};

// Send evaluation reminders (runs daily at 6 PM, for meetings the next day)
const sendEvaluationReminders = async () => {
    try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
        const tomorrowEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59);

        const upcomingEvaluations = await Evaluation.find({
            status: { $in: ['ready_for_meeting', 'meeting_scheduled'] },
            scheduledDate: { $gte: tomorrowStart, $lte: tomorrowEnd },
        });

        for (const evaluation of upcomingEvaluations) {
            // Notify client
            const clientUser = await User.findById(evaluation.clientId);
            if (clientUser) {
                await Notification.create({
                    userId: evaluation.clientId,
                    type: 'evaluation-meeting-reminder',
                    title: 'Evaluation Meeting Tomorrow',
                    message: `Reminder: Your diagnostic evaluation is scheduled for tomorrow at ${evaluation.scheduledTime}.`,
                    link: '/client-evaluation',
                    metadata: { evaluationId: evaluation._id }
                });

                const reminderEmail = emailTemplates.evaluationReminder(
                    clientUser.firstName,
                    formatDate(evaluation.scheduledDate),
                    evaluation.scheduledTime,
                    evaluation.meetingLink
                );
                await sendEmail({
                    to: clientUser.email,
                    subject: reminderEmail.subject,
                    html: reminderEmail.html,
                });
            }

            console.log(`✅ Sent evaluation reminder for ${evaluation._id}`);
        }
    } catch (error) {
        console.error('Error sending evaluation reminders:', error);
    }
};

// Rollover unused sessions at end of billing cycle (runs daily at midnight)
const rolloverUnusedSessions = async () => {
    try {
        const now = new Date();

        // Find subscriptions whose billing period just ended
        const expiredPeriodSubs = await Subscription.find({
            status: 'active',
            nextBillingDate: { $lte: now },
            billingCycle: { $in: ['monthly', 'every-4-weeks'] },
        });

        for (const subscription of expiredPeriodSubs) {
            const client = await Client.findOne({ userId: subscription.userId });
            if (!client) continue;

            // Calculate sessions used in the expired period
            const periodStart = subscription.startDate;
            const periodEnd = subscription.nextBillingDate;

            const usedSessions = await Session.countDocuments({
                clientId: client._id,
                scheduledDate: { $gte: periodStart, $lte: periodEnd },
                status: { $in: ['scheduled', 'confirmed', 'in-progress', 'completed'] },
            });

            const totalSessions = subscription.sessionsPerMonth || 0;
            const unused = Math.max(0, totalSessions - usedSessions);

            if (unused > 0) {
                // Roll over unused sessions
                client.rolloverSessions = {
                    count: unused,
                    fromMonth: periodEnd,
                    expiresAt: new Date(now.getFullYear(), now.getMonth() + 2, 0), // Expire next month
                };
                await client.save();

                subscription.unusedSessionsAtEnd = unused;
                await subscription.save();

                console.log(`✅ Rolled over ${unused} sessions for user ${subscription.userId}`);
            }
        }
    } catch (error) {
        console.error('Error rolling over sessions:', error);
    }
};

// Initialize all cron jobs
const initCronJobs = () => {
    // Check therapist review deadlines every day at 9:00 AM
    cron.schedule('0 9 * * *', checkTherapistReviewDeadlines);

    // Send therapist review reminders every day at 10:00 AM (1 day before deadline)
    cron.schedule('0 10 * * *', sendTherapistReviewReminders);

    // Send evaluation reminders every day at 6:00 PM
    cron.schedule('0 18 * * *', sendEvaluationReminders);

    // Rollover unused sessions every day at midnight
    cron.schedule('0 0 * * *', rolloverUnusedSessions);

    console.log('✅ Cron jobs initialized (review deadlines, reminders, rollovers)');
};

// Send therapist review reminders (1 day before deadline)
const sendTherapistReviewReminders = async () => {
    try {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
        const tomorrowEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59);

        // Find evaluations whose therapist deadline is tomorrow
        const approachingDeadline = await Evaluation.find({
            status: { $in: ['therapist_assigned', 'therapist_reviewing'] },
            therapistReviewDeadline: { $gte: tomorrowStart, $lte: tomorrowEnd },
        });

        const Therapist = require('../models/Therapist');

        for (const evaluation of approachingDeadline) {
            if (!evaluation.therapistId) continue;

            const therapist = await Therapist.findById(evaluation.therapistId).populate('userId', 'firstName lastName email');
            if (!therapist || !therapist.userId) continue;

            const clientUser = await User.findById(evaluation.clientId);
            const clientName = clientUser ? `${clientUser.firstName} ${clientUser.lastName}` : 'Client';

            // Send reminder email to therapist
            const reminderEmail = emailTemplates.therapistReviewReminder(
                therapist.userId.firstName,
                clientName,
                formatDate(evaluation.therapistReviewDeadline),
                evaluation._id
            );
            await sendEmail({
                to: therapist.userId.email,
                subject: reminderEmail.subject,
                html: reminderEmail.html,
            });

            // Send in-app notification too
            await Notification.create({
                userId: therapist.userId._id,
                type: 'evaluation-review-reminder',
                title: 'Review Deadline Tomorrow',
                message: `Reminder: Your review deadline for ${clientName}'s evaluation is tomorrow. Please complete your review.`,
                link: '/my-practice',
                metadata: { evaluationId: evaluation._id }
            });

            console.log(`✅ Sent review reminder to therapist for evaluation ${evaluation._id}`);
        }
    } catch (error) {
        console.error('Error sending therapist review reminders:', error);
    }
};

module.exports = {
    initCronJobs,
    checkTherapistReviewDeadlines,
    sendTherapistReviewReminders,
    sendEvaluationReminders,
    rolloverUnusedSessions,
};
