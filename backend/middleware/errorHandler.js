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
  let error = {
    message: err.message || 'Internal Server Error',
    status: err.status || 500
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

  res.status(error.status).json({
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