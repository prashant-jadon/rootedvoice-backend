// Vercel serverless function wrapper for Express app
// This file is required for Vercel deployment

// Only import the app, not the server (Socket.io and cron jobs won't work in serverless)
const { app } = require('../src/server');

// Export the Express app as a serverless function
// Vercel will automatically handle the function configuration
module.exports = app;
