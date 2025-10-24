// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    user: req.user?.id || 'Anonymous'
  });

  // Default error response
  // Normalize status into a safe numeric HTTP status code
  const resolveStatus = (s) => {
    // If it's already a finite number, use it
    if (typeof s === 'number' && Number.isFinite(s)) return s;
    // If it's a numeric string, parse it
    if (typeof s === 'string' && /^\d+$/.test(s)) return parseInt(s, 10);
    // Otherwise fallback to 500
    return 500;
  }

  let error = {
    message: err.message || 'Internal Server Error',
    status: resolveStatus(err.status || err.statusCode) || 500
  };

  // Handle specific error types
  if (err.code === 'ER_DUP_ENTRY') {
    error = {
      message: 'Duplicate entry. Resource already exists.',
      status: 409
    };
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    error = {
      message: 'Referenced resource not found.',
      status: 400
    };
  } else if (err.code === 'ER_DATA_TOO_LONG') {
    error = {
      message: 'Data too long for field.',
      status: 400
    };
  } else if (err.code === 'ER_BAD_NULL_ERROR') {
    error = {
      message: 'Required field cannot be null.',
      status: 400
    };
  } else if (err.name === 'ValidationError') {
    error = {
      message: 'Validation failed: ' + err.message,
      status: 400
    };
  } else if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Invalid authentication token.',
      status: 401
    };
  } else if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Authentication token expired.',
      status: 401
    };
  } else if (err.name === 'CastError') {
    error = {
      message: 'Invalid ID format.',
      status: 400
    };
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && error.status === 500) {
    error.message = 'Internal Server Error';
  }

  // Ensure the status is a valid integer between 100 and 599
  let safeStatus = Number(error.status) || 500
  if (!Number.isFinite(safeStatus) || safeStatus < 100 || safeStatus > 599) safeStatus = 500

  res.status(safeStatus).json({
    success: false,
    message: error.message,
    error: {
      message: error.message,
      code: err.code || 'UNKNOWN_ERROR',
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: err
      })
    }
  });
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.status = statusCode;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  AppError
};