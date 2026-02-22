const Session = require('../models/Session');
const Client = require('../models/Client');
const Therapist = require('../models/Therapist');
const Evaluation = require('../models/Evaluation');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Get notifications for the logged-in user
// @route   GET /api/notifications
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
    const notifications = [];
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in1h = new Date(now.getTime() + 60 * 60 * 1000);

    if (req.user.role === 'therapist') {
        const therapist = await Therapist.findOne({ userId: req.user._id });

        if (therapist) {
            // 1. Upcoming sessions in next 24 hours
            const upcomingSessions = await Session.find({
                therapistId: therapist._id,
                scheduledDate: { $gte: now, $lte: in24h },
                status: { $in: ['scheduled', 'confirmed'] },
            })
                .populate({ path: 'clientId', populate: { path: 'userId', select: 'firstName lastName' } })
                .sort({ scheduledDate: 1 })
                .limit(5);

            for (const session of upcomingSessions) {
                const sessionDate = new Date(session.scheduledDate);
                const minutesUntil = Math.round((sessionDate - now) / 60000);
                const clientName = session.clientId?.userId
                    ? `${session.clientId.userId.firstName} ${session.clientId.userId.lastName}`
                    : 'a client';

                const isVeryClose = sessionDate <= in1h;
                notifications.push({
                    id: `session-${session._id}`,
                    type: isVeryClose ? 'urgent' : 'info',
                    icon: '📅',
                    title: `Session ${isVeryClose ? 'Starting Soon' : 'Today'}`,
                    message: `With ${clientName} at ${session.scheduledTime}${minutesUntil <= 60 ? ` (in ${minutesUntil} min)` : ''}`,
                    link: `/video-call?sessionId=${session._id}`,
                    time: sessionDate.toISOString(),
                    read: false,
                });
            }

            // 2. Sessions from today that need SOAP notes (completed but no note)
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const completedNoSoap = await Session.find({
                therapistId: therapist._id,
                status: 'completed',
                completedAt: { $gte: todayStart },
                'soapNote.subjective': { $exists: false },
            })
                .populate({ path: 'clientId', populate: { path: 'userId', select: 'firstName lastName' } })
                .limit(3);

            for (const session of completedNoSoap) {
                const clientName = session.clientId?.userId
                    ? `${session.clientId.userId.firstName} ${session.clientId.userId.lastName}`
                    : 'client';
                notifications.push({
                    id: `soap-${session._id}`,
                    type: 'warning',
                    icon: '📝',
                    title: 'SOAP Note Required',
                    message: `Complete notes for ${clientName}'s session`,
                    link: `/sessions`,
                    time: session.completedAt?.toISOString() || now.toISOString(),
                    read: false,
                });
            }

            // 3. Evaluations awaiting therapist review
            const pendingEvals = await Evaluation.find({
                therapistId: therapist._id,
                status: { $in: ['therapist_assigned', 'therapist_reviewing', 'awaiting_therapist_selection'] }
            })
                .limit(3);

            for (const ev of pendingEvals) {
                notifications.push({
                    id: `eval-${ev._id}`,
                    type: 'warning',
                    icon: '🔍',
                    title: 'Evaluation Pending',
                    message: `Client evaluation awaiting your review`,
                    link: `/dashboard`,
                    time: ev.updatedAt?.toISOString() || now.toISOString(),
                    read: false,
                });
            }

            // 4. Upcoming sessions in next 7 days (high count)
            const weekSessions = await Session.countDocuments({
                therapistId: therapist._id,
                scheduledDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
                status: { $in: ['scheduled', 'confirmed'] },
            });
            if (weekSessions > 0) {
                notifications.push({
                    id: `week-summary-${Date.now()}`,
                    type: 'success',
                    icon: '✅',
                    title: `${weekSessions} Session${weekSessions > 1 ? 's' : ''} This Week`,
                    message: `You have ${weekSessions} upcoming session${weekSessions > 1 ? 's' : ''} this week`,
                    link: `/sessions`,
                    time: now.toISOString(),
                    read: true, // informational
                });
            }
        }
    } else if (req.user.role === 'client') {
        const client = await Client.findOne({ userId: req.user._id });

        if (client) {
            // 1. Upcoming sessions in next 24 hours
            const upcomingSessions = await Session.find({
                clientId: client._id,
                scheduledDate: { $gte: now, $lte: in24h },
                status: { $in: ['scheduled', 'confirmed'] },
            })
                .populate({ path: 'therapistId', populate: { path: 'userId', select: 'firstName lastName' } })
                .sort({ scheduledDate: 1 })
                .limit(5);

            for (const session of upcomingSessions) {
                const sessionDate = new Date(session.scheduledDate);
                const minutesUntil = Math.round((sessionDate - now) / 60000);
                const therapistName = session.therapistId?.userId
                    ? `Dr. ${session.therapistId.userId.firstName} ${session.therapistId.userId.lastName}`
                    : 'your therapist';

                const isVeryClose = sessionDate <= in1h;
                notifications.push({
                    id: `session-${session._id}`,
                    type: isVeryClose ? 'urgent' : 'info',
                    icon: '📅',
                    title: `Session ${isVeryClose ? 'Starting Soon!' : 'Reminder'}`,
                    message: `With ${therapistName} at ${session.scheduledTime}${minutesUntil <= 60 ? ` — in ${minutesUntil} min` : ''}`,
                    link: `/video-call?sessionId=${session._id}`,
                    time: sessionDate.toISOString(),
                    read: false,
                });
            }

            // 2. Evaluation status
            const evaluation = await Evaluation.findOne({
                clientId: req.user._id,
                status: { $in: ['therapist_assigned', 'therapist_reviewing', 'ready_for_meeting', 'meeting_scheduled'] }
            }).sort({ updatedAt: -1 });

            if (evaluation) {
                const statusMessages = {
                    therapist_assigned: 'Your therapist is reviewing your evaluation',
                    therapist_reviewing: 'Evaluation review in progress',
                    ready_for_meeting: '🎉 Your therapist is ready! Schedule your meeting',
                    meeting_scheduled: 'Evaluation meeting is coming up',
                };
                notifications.push({
                    id: `eval-${evaluation._id}`,
                    type: evaluation.status === 'ready_for_meeting' ? 'success' : 'info',
                    icon: '🏥',
                    title: 'Evaluation Update',
                    message: statusMessages[evaluation.status] || 'Evaluation status updated',
                    link: `/client-evaluation`,
                    time: evaluation.updatedAt?.toISOString() || now.toISOString(),
                    read: false,
                });
            }

            // 3. Upcoming week session count
            const weekSessions = await Session.countDocuments({
                clientId: client._id,
                scheduledDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
                status: { $in: ['scheduled', 'confirmed'] },
            });
            if (weekSessions > 0) {
                notifications.push({
                    id: `week-${Date.now()}`,
                    type: 'success',
                    icon: '📆',
                    title: `${weekSessions} Upcoming Session${weekSessions > 1 ? 's' : ''}`,
                    message: `You have ${weekSessions} session${weekSessions > 1 ? 's' : ''} scheduled this week`,
                    link: `/sessions`,
                    time: now.toISOString(),
                    read: true,
                });
            }

            // 4. Unpaid sessions
            const unpaidSessions = await Session.countDocuments({
                clientId: client._id,
                status: 'completed',
                paymentStatus: 'pending',
                price: { $gt: 0 },
            });
            if (unpaidSessions > 0) {
                notifications.push({
                    id: `unpaid-${Date.now()}`,
                    type: 'warning',
                    icon: '💳',
                    title: `${unpaidSessions} Unpaid Session${unpaidSessions > 1 ? 's' : ''}`,
                    message: `You have ${unpaidSessions} session${unpaidSessions > 1 ? 's' : ''} pending payment`,
                    link: `/sessions`,
                    time: now.toISOString(),
                    read: false,
                });
            }
        }
    }

    // Sort: unread first, then by time descending
    notifications.sort((a, b) => {
        if (a.read !== b.read) return a.read ? 1 : -1;
        return new Date(b.time).getTime() - new Date(a.time).getTime();
    });

    const unreadCount = notifications.filter(n => !n.read).length;

    res.json({
        success: true,
        data: {
            notifications: notifications.slice(0, 10),
            unreadCount,
        },
    });
});

module.exports = { getNotifications };
