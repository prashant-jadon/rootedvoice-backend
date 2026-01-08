const Message = require('../models/Message');
const User = require('../models/User');
const Client = require('../models/Client');
const Therapist = require('../models/Therapist');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Get support agent ID (creates one if doesn't exist)
// @route   GET /api/messages/support-agent
// @access  Private
const getSupportAgent = asyncHandler(async (req, res) => {
  // Find or create support agent user
  let supportUser = await User.findOne({ 
    role: 'admin',
    email: { $regex: /support/i }
  });

  if (!supportUser) {
    // Create support agent user
    supportUser = await User.create({
      email: 'support@rootedvoices.com',
      password: process.env.SUPPORT_PASSWORD || 'Support123!',
      role: 'admin',
      firstName: 'Support',
      lastName: 'Team',
      phone: '',
    });
  }

  res.json({
    success: true,
    data: {
      _id: supportUser._id,
      firstName: supportUser.firstName,
      lastName: supportUser.lastName,
      email: supportUser.email,
    },
  });
});

// @desc    Get conversations for current user
// @route   GET /api/messages/conversations
// @access  Private
const getConversations = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  let participantId = null;

  // Get participant ID based on role
  if (req.user.role === 'client') {
    const client = await Client.findOne({ userId });
    if (client && client.assignedTherapist) {
      const therapist = await Therapist.findById(client.assignedTherapist);
      if (therapist) {
        participantId = therapist.userId;
      }
    }
    
    // Also check for support chat (messages with any admin)
    const supportUser = await User.findOne({ 
      role: 'admin',
      email: { $regex: /support/i }
    });
    
    // Check if there are messages with any admin user
    const adminUsers = await User.find({ role: 'admin' }).select('_id');
    const adminIds = adminUsers.map(u => u._id);
    
    if (adminIds.length > 0) {
      const supportMessages = await Message.findOne({
        $or: [
          { senderId: userId, receiverId: { $in: adminIds } },
          { senderId: { $in: adminIds }, receiverId: userId },
        ],
      });
      
      if (supportMessages) {
        // Get all messages with any admin
        const messages = await Message.find({
          $or: [
            { senderId: userId, receiverId: { $in: adminIds } },
            { senderId: { $in: adminIds }, receiverId: userId },
          ],
        })
          .populate('senderId', 'firstName lastName avatar')
          .populate('receiverId', 'firstName lastName avatar')
          .sort({ createdAt: 1 });

        const unreadCount = await Message.countDocuments({
          receiverId: userId,
          senderId: { $in: adminIds },
          isRead: false,
        });

        // Use support user for participant info, or first admin if support user doesn't exist
        const participantUser = supportUser || adminUsers[0];

        return res.json({
          success: true,
          data: [{
            participant: {
              _id: participantUser._id,
              firstName: participantUser.firstName,
              lastName: participantUser.lastName,
              avatar: participantUser.avatar,
            },
            messages,
            unreadCount,
            isSupport: true,
          }],
        });
      }
    }
  } else if (req.user.role === 'therapist') {
    const therapist = await Therapist.findOne({ userId });
    if (therapist) {
      // Check for support chat first
      const supportUser = await User.findOne({ 
        role: 'admin',
        email: { $regex: /support/i }
      });
      
      // Get all admin users (for support chat)
      const adminUsers = await User.find({ role: 'admin' }).select('_id');
      const adminIds = adminUsers.map(u => u._id);
      
      // Get all clients assigned to this therapist
      const clients = await Client.find({ assignedTherapist: therapist._id });
      const clientUserIds = clients.map(c => c.userId);
      
      // Get all unique conversations (including support from any admin)
      const allUserIds = [...clientUserIds, ...adminIds];
      
      const conversations = await Message.aggregate([
        {
          $match: {
            $or: [
              { senderId: userId },
              { receiverId: userId },
              { senderId: { $in: allUserIds } },
              { receiverId: { $in: allUserIds } },
            ],
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ['$senderId', userId] },
                '$receiverId',
                '$senderId',
              ],
            },
            lastMessage: { $max: '$createdAt' },
            unreadCount: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$receiverId', userId] }, { $eq: ['$isRead', false] }] },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { lastMessage: -1 } },
      ]);

      // Populate participant info
      const populatedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const participant = await User.findById(conv._id).select('firstName lastName avatar email role');
          // Check if participant is any admin (support)
          const isSupport = participant && participant.role === 'admin';
          return {
            ...conv,
            participant,
            isSupport,
          };
        })
      );

      return res.json({
        success: true,
        data: populatedConversations,
      });
    }
  }

  // For single conversation (client-therapist)
  if (participantId) {
    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: participantId },
        { senderId: participantId, receiverId: userId },
      ],
      isDeleted: { $ne: true },
    })
      .populate('senderId', 'firstName lastName avatar')
      .populate('receiverId', 'firstName lastName avatar')
      .sort({ createdAt: 1 });

    const unreadCount = await Message.countDocuments({
      receiverId: userId,
      senderId: participantId,
      isRead: false,
    });

    return res.json({
      success: true,
      data: [{
        participant: await User.findById(participantId).select('firstName lastName avatar'),
        messages,
        unreadCount,
      }],
    });
  }

  res.json({
    success: true,
    data: [],
  });
});

// @desc    Get messages with a specific user
// @route   GET /api/messages/:userId
// @access  Private
const getMessages = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const otherUserId = req.params.userId;

  // Check if other user is support/admin (allow messaging support)
  const otherUser = await User.findById(otherUserId);
  const isSupportChat = otherUser && otherUser.role === 'admin';

  // Verify authorization (skip for support chat)
  if (!isSupportChat) {
  if (req.user.role === 'client') {
    const client = await Client.findOne({ userId });
    if (client && client.assignedTherapist) {
      const therapist = await Therapist.findById(client.assignedTherapist);
      if (therapist && therapist.userId.toString() !== otherUserId) {
        return res.status(403).json({
          success: false,
          message: 'You can only message your assigned therapist',
        });
      }
    }
  } else if (req.user.role === 'therapist') {
    const therapist = await Therapist.findOne({ userId });
    if (therapist) {
      const client = await Client.findOne({ userId: otherUserId });
      if (client && client.assignedTherapist.toString() !== therapist._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only message your assigned clients',
        });
        }
      }
    }
  }

  // If this is a support chat, get messages from any admin, not just the specific admin
  let messageQuery;
  if (isSupportChat) {
    // Get all admin user IDs
    const adminUsers = await User.find({ role: 'admin' }).select('_id');
    const adminIds = adminUsers.map(u => u._id);
    
    messageQuery = {
      $or: [
        { senderId: userId, receiverId: { $in: adminIds } },
        { senderId: { $in: adminIds }, receiverId: userId },
      ],
      isDeleted: { $ne: true },
    };
  } else {
    messageQuery = {
      $or: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
      isDeleted: { $ne: true },
    };
  }

  const messages = await Message.find(messageQuery)
    .populate('senderId', 'firstName lastName avatar')
    .populate('receiverId', 'firstName lastName avatar')
    .sort({ createdAt: 1 });

  // Mark messages as read
  if (isSupportChat) {
    // Mark all unread messages from any admin as read
    const adminUsers = await User.find({ role: 'admin' }).select('_id');
    const adminIds = adminUsers.map(u => u._id);
    await Message.updateMany(
      {
        senderId: { $in: adminIds },
        receiverId: userId,
        isRead: false,
      },
      { isRead: true, readAt: new Date() }
    );
  } else {
    await Message.updateMany(
      {
        senderId: otherUserId,
        receiverId: userId,
        isRead: false,
      },
      { isRead: true, readAt: new Date() }
    );
  }

  res.json({
    success: true,
    data: messages,
  });
});

// @desc    Send message
// @route   POST /api/messages
// @access  Private
const sendMessage = asyncHandler(async (req, res) => {
  const { receiverId, content, type = 'text', attachments: attachmentsData } = req.body;
  const senderId = req.user._id;
  
  // Handle file uploads
  let attachments = attachmentsData || [];
  if (req.files && req.files.length > 0) {
    attachments = req.files.map(file => ({
      fileName: file.originalname,
      fileUrl: `${req.protocol}://${req.get('host')}/uploads/attachments/${file.filename}`,
      fileType: file.mimetype,
      fileSize: file.size,
    }));
  }

  if (!receiverId || !content) {
    return res.status(400).json({
      success: false,
      message: 'Receiver ID and content are required',
    });
  }

  // Check if receiver is support/admin (special handling for support chat)
  const receiverUser = await User.findById(receiverId);
  const isSupportChat = receiverUser && receiverUser.role === 'admin';

  // Verify authorization (skip for support chat)
  if (!isSupportChat) {
    if (req.user.role === 'client') {
      const client = await Client.findOne({ userId: senderId });
      if (client && client.assignedTherapist) {
        const therapist = await Therapist.findById(client.assignedTherapist);
        if (therapist && therapist.userId.toString() !== receiverId) {
          return res.status(403).json({
            success: false,
            message: 'You can only message your assigned therapist',
          });
        }
      }
    } else if (req.user.role === 'therapist') {
      const therapist = await Therapist.findOne({ userId: senderId });
      if (therapist) {
        const client = await Client.findOne({ userId: receiverId });
        if (!client || client.assignedTherapist.toString() !== therapist._id.toString()) {
          return res.status(403).json({
            success: false,
            message: 'You can only message your assigned clients',
          });
        }
      }
    }
  }

  const message = await Message.create({
    senderId,
    receiverId,
    content,
    type,
    attachments,
    isRead: false,
  });

  const populatedMessage = await Message.findById(message._id)
    .populate('senderId', 'firstName lastName avatar')
    .populate('receiverId', 'firstName lastName avatar');

  // Emit socket event for real-time messaging
  const { getIO } = require('../config/socket');
  try {
    const io = getIO();
    
    // Check if receiver is admin - emit to all admins
    if (receiverUser && receiverUser.role === 'admin') {
      // Emit to specific admin user
      io.to(`user:${receiverId}`).emit('new-message', populatedMessage);
      // Also emit to all admins room so any admin viewing support chat gets the message
      io.to('admin:all').emit('new-message', populatedMessage);
    } else {
      // Regular user - emit to specific receiver
    io.to(`user:${receiverId}`).emit('new-message', populatedMessage);
    }
    
    // Also emit to sender for confirmation
    io.to(`user:${senderId}`).emit('message-sent', populatedMessage);
  } catch (error) {
    console.log('Socket.io not available for real-time messaging');
  }

  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: populatedMessage,
  });
});

// @desc    Mark messages as read
// @route   PUT /api/messages/read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
  const { messageIds, senderId } = req.body;
  const userId = req.user._id;

  let updateFilter = {
    receiverId: userId,
    isRead: false,
  };

  if (messageIds && Array.isArray(messageIds)) {
    updateFilter._id = { $in: messageIds };
  } else if (senderId) {
    updateFilter.senderId = senderId;
  } else {
    return res.status(400).json({
      success: false,
      message: 'Either messageIds or senderId is required',
    });
  }

  await Message.updateMany(updateFilter, {
    isRead: true,
    readAt: new Date(),
  });

  res.json({
    success: true,
    message: 'Messages marked as read',
  });
});

// @desc    Delete message
// @route   DELETE /api/messages/:id
// @access  Private (Sender only)
const deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);

  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found',
    });
  }

  if (message.senderId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  await Message.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Message deleted successfully',
  });
});

// @desc    Get all support conversations (Admin only)
// @route   GET /api/messages/admin/support-conversations
// @access  Private/Admin
const getSupportConversations = asyncHandler(async (req, res) => {
  const adminId = req.user._id; // Use current admin's ID
  
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Only admins can access support conversations',
    });
  }

  // Get all admin user IDs (so we can see messages sent to any admin)
  const allAdmins = await User.find({ role: 'admin' }).select('_id');
  const adminIds = allAdmins.map(admin => admin._id);

  // Get all unique conversations where admin is sender or receiver
  const conversations = await Message.aggregate([
    {
      $match: {
        $or: [
          { senderId: { $in: adminIds } },
          { receiverId: { $in: adminIds } },
        ],
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: {
          $cond: [
            { $in: ['$senderId', adminIds] },
            '$receiverId',
            '$senderId',
          ],
        },
        lastMessage: { $max: '$createdAt' },
        unreadCount: {
          $sum: {
            $cond: [
              { $and: [{ $in: ['$receiverId', adminIds] }, { $eq: ['$isRead', false] }] },
              1,
              0,
            ],
          },
        },
        lastMessageContent: { $last: '$content' },
      },
    },
    { $sort: { lastMessage: -1 } },
  ]);

  // Populate user info for each conversation
  const populatedConversations = await Promise.all(
    conversations.map(async (conv) => {
      const user = await User.findById(conv._id)
        .select('firstName lastName avatar email role');
      
      // Get user's role-specific info
      let roleInfo = {};
      if (user.role === 'therapist') {
        const therapist = await Therapist.findOne({ userId: user._id })
          .select('credentials specializations');
        roleInfo = { therapist };
      } else if (user.role === 'client') {
        const client = await Client.findOne({ userId: user._id })
          .select('assignedTherapist');
        roleInfo = { client };
      }

      return {
        userId: conv._id,
        user: {
          ...user.toObject(),
          ...roleInfo,
        },
        lastMessage: conv.lastMessage,
        lastMessageContent: conv.lastMessageContent,
        unreadCount: conv.unreadCount,
      };
    })
  );

  res.json({
    success: true,
    data: populatedConversations,
  });
});

// @desc    Get messages with a specific user (Admin view)
// @route   GET /api/messages/admin/conversation/:userId
// @access  Private/Admin
const getAdminConversation = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const adminId = req.user._id; // Use current admin's ID
  
  // Verify admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Only admins can access this conversation',
    });
  }

  // Get all admin user IDs (so we can see messages sent to any admin)
  const allAdmins = await User.find({ role: 'admin' }).select('_id');
  const adminIds = allAdmins.map(admin => admin._id);

  const messages = await Message.find({
    $or: [
      { senderId: userId, receiverId: { $in: adminIds } },
      { senderId: { $in: adminIds }, receiverId: userId },
    ],
    isDeleted: { $ne: true },
  })
    .populate('senderId', 'firstName lastName avatar email role')
    .populate('receiverId', 'firstName lastName avatar email role')
    .sort({ createdAt: 1 });

  // Mark messages as read (from admin's perspective) - mark messages sent to any admin
  await Message.updateMany(
    {
      senderId: userId,
      receiverId: { $in: adminIds },
      isRead: false,
    },
    { isRead: true, readAt: new Date() }
  );

  // Get user info (the other participant in the conversation)
  const user = await User.findById(userId)
    .select('firstName lastName avatar email role phone');
  
  let roleInfo = {};
  if (user.role === 'therapist') {
    const therapist = await Therapist.findOne({ userId: user._id })
      .select('credentials specializations hourlyRate');
    roleInfo = { therapist };
  } else if (user.role === 'client') {
    const client = await Client.findOne({ userId: user._id })
      .select('assignedTherapist dateOfBirth');
    if (client && client.assignedTherapist) {
      const therapist = await Therapist.findById(client.assignedTherapist)
        .populate('userId', 'firstName lastName');
      roleInfo = { client, assignedTherapist: therapist };
    } else {
      roleInfo = { client };
    }
  }

  res.json({
    success: true,
    data: {
      user: {
        ...user.toObject(),
        ...roleInfo,
      },
      messages,
    },
  });
});

// @desc    Send message as admin/support
// @route   POST /api/messages/admin/reply
// @access  Private/Admin
const sendAdminReply = asyncHandler(async (req, res) => {
  const { userId, content, type = 'text', attachments: attachmentsData } = req.body;
  const adminId = req.user._id;

  // Verify admin is support or has admin role
  const adminUser = await User.findById(adminId);
  if (adminUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Only admins can send support replies',
    });
  }

  // Handle file uploads
  let attachments = attachmentsData || [];
  if (req.files && req.files.length > 0) {
    attachments = req.files.map(file => ({
      fileName: file.originalname,
      fileUrl: `${req.protocol}://${req.get('host')}/uploads/attachments/${file.filename}`,
      fileType: file.mimetype,
      fileSize: file.size,
    }));
  }

  if (!userId || !content) {
    return res.status(400).json({
      success: false,
      message: 'User ID and content are required',
    });
  }

  const message = await Message.create({
    senderId: adminId,
    receiverId: userId,
    content,
    type,
    attachments,
    isRead: false,
  });

  const populatedMessage = await Message.findById(message._id)
    .populate('senderId', 'firstName lastName avatar email')
    .populate('receiverId', 'firstName lastName avatar email');

  // Emit socket event for real-time messaging
  const { getIO } = require('../config/socket');
  try {
    const io = getIO();
    // Emit to receiver
    io.to(`user:${userId}`).emit('new-message', populatedMessage);
    // Emit to sender (admin) so they see their own message immediately
    io.to(`user:${adminId}`).emit('new-message', populatedMessage);
    io.to(`user:${adminId}`).emit('message-sent', populatedMessage);
  } catch (error) {
    console.log('Socket.io not available for real-time messaging');
  }

  res.status(201).json({
    success: true,
    message: 'Reply sent successfully',
    data: populatedMessage,
  });
});

module.exports = {
  getSupportAgent,
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  deleteMessage,
  getSupportConversations,
  getAdminConversation,
  sendAdminReply,
};

