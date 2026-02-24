require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const hpp = require('hpp');
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

// ─── Trust Proxy (required for rate limiter behind reverse proxy / Vercel) ───
app.set('trust proxy', 1);

// ─── Security Headers ───
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:'],
      fontSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", 'https://meet.jit.si', 'https://js.stripe.com'],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding Jitsi, Stripe iframes
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

// ─── CORS ───
const buildAllowedOrigins = () => {
  const origins = [];

  if (process.env.FRONTEND_URL) origins.push(process.env.FRONTEND_URL);
  if (process.env.ADMIN_PANEL_URL) origins.push(process.env.ADMIN_PANEL_URL);

  // Only allow localhost in development
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000');
    origins.push('http://localhost:5173');
  }

  return origins;
};

const allowedOrigins = buildAllowedOrigins();

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ─── Logging ───
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// ─── Stripe webhook must be before body parser (needs raw body) ───
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// ─── Body Parsing (with size limits to prevent payload attacks) ───
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ─── Security Middleware ───
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(hpp());           // Prevent HTTP Parameter Pollution

// ─── Performance ───
app.use(compression());   // Gzip compression

// ─── Static Files (uploads) ───
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Rate Limiting (applied to all /api routes except webhook) ───
app.use('/api', (req, res, next) => {
  if (req.path === '/stripe/webhook') {
    return next();
  }
  apiLimiter(req, res, next);
});

// ─── API Routes ───
app.use('/api', routes);

// ─── Root Endpoint ───
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Rooted Voices API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─── 404 Handler ───
app.use(notFound);

// ─── Error Handler ───
app.use(errorHandler);

// ─── Server Startup (non-serverless only) ───
let server = null;

if (process.env.VERCEL !== '1' && !process.env.VERCEL_ENV) {
  const PORT = process.env.PORT || 5000;

  server = app.listen(PORT, () => {
    console.log('');
    console.log('🚀 ================================ 🚀');
    console.log(`✅  Server running in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`✅  API listening on port ${PORT}`);
    console.log(`🌐  API URL: http://localhost:${PORT}`);
    console.log(`🏥  Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔒  CORS origins: ${allowedOrigins.join(', ')}`);
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

  // Initialize evaluation cron jobs
  const { initCronJobs } = require('./utils/cronJobs');
  initCronJobs();

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err, promise) => {
    console.error(`❌ Unhandled Rejection: ${err.message}`);
    if (server) {
      server.close(() => process.exit(1));
    } else {
      process.exit(1);
    }
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error(`❌ Uncaught Exception: ${err.message}`);
    if (server) {
      server.close(() => process.exit(1));
    } else {
      process.exit(1);
    }
  });
} else {
  console.log('🚀 Running in serverless mode (Vercel)');
}

// Always export app (and server if available)
module.exports = server ? { app, server } : { app };
