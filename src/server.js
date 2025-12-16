require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

// Import config
const connectDB = require('./config/database');
const { initSocket } = require('./config/socket');
const { errorHandler, notFound } = require('./middlewares/errorHandler');
const { apiLimiter } = require('./middlewares/rateLimiter');

// Import routes
const routes = require('./routes');

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Middleware
app.use(helmet()); // Security headers

// CORS configuration - allow multiple origins
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  process.env.ADMIN_PANEL_URL || 'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5173',
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(morgan('dev')); // Logging

// Stripe webhook must be before body parser (needs raw body)
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json()); // Body parser
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Cookie parser
app.use(mongoSanitize()); // Sanitize data

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Apply rate limiting to API routes (except webhook)
app.use('/api', (req, res, next) => {
  if (req.path === '/stripe/webhook') {
    return next(); // Skip rate limiting for webhook
  }
  apiLimiter(req, res, next);
});

// Mount API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Rooted Voices API',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Only start server if not in serverless environment (Vercel)
// Vercel will handle the serverless function execution
let server = null;

if (process.env.VERCEL !== '1' && !process.env.VERCEL_ENV) {
  // Start server
  const PORT = process.env.PORT || 5000;

  server = app.listen(PORT, () => {
    console.log('');
    console.log('🚀 ================================ 🚀');
    console.log(`✅  Server running in ${process.env.NODE_ENV} mode`);
    console.log(`✅  API listening on port ${PORT}`);
    console.log(`🌐  API URL: http://localhost:${PORT}`);
    console.log(`🏥  Health check: http://localhost:${PORT}/api/health`);
    console.log('🚀 ================================ 🚀');
    console.log('');
  });

  // Initialize Socket.io (only in non-serverless environment)
  const io = initSocket(server);

  // Set up session reminder cron job (only in non-serverless environment)
  if (process.env.ENABLE_SESSION_REMINDERS !== 'false') {
    const cron = require('node-cron');
    const { sendSessionReminders } = require('./utils/sessionReminder');
    const { initTwilio } = require('./utils/smsService');
    const { initWebPush } = require('./utils/pushNotificationService');
    
    // Initialize SMS and Push services
    initTwilio();
    initWebPush();
    
    // Run every 15 minutes to check for reminders
    // This ensures we catch sessions at the right time for 45-minute reminders
    cron.schedule('*/15 * * * *', async () => {
      try {
        await sendSessionReminders();
      } catch (error) {
        console.error('Error in scheduled reminder job:', error);
      }
    });
    
    // Run once on startup (after 10 seconds to allow DB connection)
    setTimeout(async () => {
      try {
        await sendSessionReminders();
      } catch (error) {
        console.error('Error in startup reminder check:', error);
      }
    }, 10000);
    
    console.log('✅ Session reminder service initialized (runs every 15 minutes)');
  }

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err, promise) => {
    console.error(`❌ Unhandled Rejection: ${err.message}`);
    // Close server & exit process
    if (server) {
      server.close(() => process.exit(1));
    } else {
      process.exit(1);
    }
  });
} else {
  // Serverless environment
  console.log('🚀 Running in serverless mode (Vercel)');
}

// Always export app (and server if available)
module.exports = server ? { app, server } : { app };

