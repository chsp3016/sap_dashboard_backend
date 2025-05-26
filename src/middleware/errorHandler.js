const logger = require('../utils/logger');

// Track recent requests to detect loops
const requestTracker = new Map();
const REQUEST_WINDOW = 5000; // 5 seconds
const MAX_REQUESTS_PER_WINDOW = 10;

/**
 * Request tracking middleware to detect potential infinite loops
 */
const requestTrackingMiddleware = (req, res, next) => {
  const key = `${req.ip}-${req.method}-${req.url}`;
  const now = Date.now();
  
  // Clean old entries
  for (const [trackKey, timestamps] of requestTracker.entries()) {
    const filteredTimestamps = timestamps.filter(timestamp => now - timestamp < REQUEST_WINDOW);
    if (filteredTimestamps.length === 0) {
      requestTracker.delete(trackKey);
    } else {
      requestTracker.set(trackKey, filteredTimestamps);
    }
  }
  
  // Track current request
  if (!requestTracker.has(key)) {
    requestTracker.set(key, []);
  }
  
  const timestamps = requestTracker.get(key);
  timestamps.push(now);
  
  // Check for potential loop
  if (timestamps.length > MAX_REQUESTS_PER_WINDOW) {
    logger.warn('Potential infinite loop detected', {
      ip: req.ip,
      method: req.method,
      url: req.url,
      requestCount: timestamps.length,
      timeWindow: REQUEST_WINDOW
    });
    
    // Rate limit the request
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Potential infinite loop detected. Please wait before making more requests.',
      retryAfter: Math.ceil(REQUEST_WINDOW / 1000)
    });
  }
  
  next();
};

/**
 * Enhanced error handling middleware with loop prevention
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  // Prevent multiple error responses
  if (res.headersSent) {
    logger.warn('Headers already sent, cannot send error response', {
      error: err.message,
      path: req.path,
      method: req.method
    });
    return next(err);
  }

  // Log the error with detailed context
  logger.error('Error in request processing', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    query: req.query,
    body: req.body,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  
  // Determine status code
  let statusCode = err.statusCode || err.status || 500;
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
  } else if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
  }
  
  // Prepare error response
  const errorResponse = {
    error: statusCode === 500 ? 'Internal Server Error' : err.message,
    status: statusCode,
    timestamp: new Date().toISOString()
  };
  
  // Add development-specific details
  if (process.env.NODE_ENV === 'development') {
    errorResponse.message = err.message;
    errorResponse.stack = err.stack;
    errorResponse.path = req.path;
    errorResponse.method = req.method;
  }
  
  // Send response
  try {
    res.status(statusCode).json(errorResponse);
  } catch (responseError) {
    logger.error('Failed to send error response', {
      originalError: err.message,
      responseError: responseError.message
    });
    // Last resort - try to send a basic response
    try {
      res.status(500).end();
    } catch (finalError) {
      logger.error('Failed to send any response', {
        error: finalError.message
      });
    }
  }
};

/**
 * Custom error class with status code
 */
class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not found error handler middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const notFoundHandler = (req, res, next) => {
  if (res.headersSent) {
    return next();
  }
  
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  const err = new ApiError(`Not Found - ${req.originalUrl}`, 404);
  next(err);
};

/**
 * Async error wrapper to catch async errors in route handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Database error handler
 * @param {Error} error - Database error
 * @param {string} context - Context where error occurred
 * @returns {Error} Formatted error
 */
const handleDatabaseError = (error, context = 'database operation') => {
  logger.error(`Database error during ${context}`, {
    error: error.message,
    name: error.name,
    constraint: error.constraint,
    table: error.table,
    column: error.column,
    detail: error.detail,
    stack: error.stack
  });

  if (error.name === 'SequelizeForeignKeyConstraintError') {
    return new ApiError('Foreign key constraint violation', 400);
  } else if (error.name === 'SequelizeUniqueConstraintError') {
    return new ApiError('Unique constraint violation', 409);
  } else if (error.name === 'SequelizeValidationError') {
    const messages = error.errors.map(err => err.message).join(', ');
    return new ApiError(`Validation error: ${messages}`, 400);
  } else if (error.name === 'SequelizeConnectionError') {
    return new ApiError('Database connection error', 503);
  } else if (error.name === 'SequelizeTimeoutError') {
    return new ApiError('Database operation timeout', 504);
  }

  return new ApiError('Database operation failed', 500);
};

module.exports = {
  errorHandler,
  ApiError,
  notFoundHandler,
  asyncHandler,
  handleDatabaseError,
  requestTrackingMiddleware
};