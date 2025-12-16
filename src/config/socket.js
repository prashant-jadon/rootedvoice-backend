const socketIO = require('socket.io');
const { verifyAccessToken } = require('./jwt');

let io;

const initSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Middleware to authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = verifyAccessToken(token);
      socket.userId = decoded.userId;
      socket.role = decoded.role;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // If user is admin, also join admin room for receiving support messages
    if (socket.role === 'admin') {
      socket.join('admin:all');
      console.log(`Admin ${socket.userId} joined admin room`);
    }

    // Handle joining conversation rooms
    socket.on('join-conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`User ${socket.userId} joined conversation ${conversationId}`);
    });

    // Handle leaving conversation rooms
    socket.on('leave-conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`User ${socket.userId} left conversation ${conversationId}`);
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      socket.to(`conversation:${data.conversationId}`).emit('user-typing', {
        userId: socket.userId,
        isTyping: data.isTyping,
      });
    });

    // Handle sending messages via socket (for real-time delivery)
    socket.on('send-message', async (data) => {
      try {
        const Message = require('../models/Message');
        const message = await Message.create({
          senderId: socket.userId,
          receiverId: data.receiverId,
          content: data.content,
          type: data.type || 'text',
          attachments: data.attachments || [],
          isRead: false,
        });

        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'firstName lastName avatar')
          .populate('receiverId', 'firstName lastName avatar');

        // Check if receiver is admin
        const User = require('../models/User');
        const receiverUser = await User.findById(data.receiverId);
        
        if (receiverUser && receiverUser.role === 'admin') {
          // Emit to specific admin user
          io.to(`user:${data.receiverId}`).emit('new-message', populatedMessage);
          // Also emit to all admins room
          io.to('admin:all').emit('new-message', populatedMessage);
        } else {
          // Regular user - emit to specific receiver
        io.to(`user:${data.receiverId}`).emit('new-message', populatedMessage);
        }
        
        // Also emit to sender for confirmation
        socket.emit('message-sent', populatedMessage);
      } catch (error) {
        console.error('Error sending message via socket:', error);
        socket.emit('message-error', { error: 'Failed to send message' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.userId}`);
    });
  });

  return io;
};

// Helper functions to emit events
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

const emitToConversation = (conversationId, event, data) => {
  if (io) {
    io.to(`conversation:${conversationId}`).emit(event, data);
  }
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  emitToConversation,
};

