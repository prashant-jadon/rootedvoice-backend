// Error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging (always log the full error server-side)
  if (process.env.NODE_ENV === 'production') {
    console.error('Error:', err.message, err.stack);
  } else {
    console.error('Error:', err);
  }

  // CORS errors — return a JSON response instead of crashing
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'Origin not allowed',
    });
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { statusCode: 404, message };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    // In production, don't leak field names
    const message = process.env.NODE_ENV === 'production'
      ? 'A record with that value already exists'
      : `${Object.keys(err.keyValue)[0]} already exists`;
    error = { statusCode: 400, message };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = process.env.NODE_ENV === 'production'
      ? 'Validation failed. Please check your input.'
      : Object.values(err.errors).map(val => val.message).join(', ');
    error = { statusCode: 400, message };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { statusCode: 401, message };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { statusCode: 401, message };
  }

  // Multer file upload errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const message = 'File size too large. Maximum allowed size is 10MB.';
      error = { statusCode: 400, message };
    } else {
      const message = err.message;
      error = { statusCode: 400, message };
    }
  }

  // Payload too large
  if (err.type === 'entity.too.large') {
    error = { statusCode: 413, message: 'Request payload too large' };
  }

  const statusCode = error.statusCode || 500;
  const responseBody = {
    success: false,
    message: statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (error.message || 'Server Error'),
  };

  // Only include stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    responseBody.stack = err.stack;
  }

  res.status(statusCode).json(responseBody);
};

// 404 handler
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, notFound, asyncHandler };
