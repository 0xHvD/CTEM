const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define the custom format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
    if (stack) {
      return `${timestamp} ${level}: ${message} ${stack} ${metaString}`;
    }
    return `${timestamp} ${level}: ${message} ${metaString}`;
  })
);

// Define the console format (for development)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
    if (stack) {
      return `${timestamp} ${level}: ${message}\n${stack}${metaString ? '\n' + metaString : ''}`;
    }
    return `${timestamp} ${level}: ${message}${metaString ? '\n' + metaString : ''}`;
  })
);

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: logFormat,
  defaultMeta: { 
    service: 'ctem-api',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Write all logs with importance level of 'error' or less to 'error.log'
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Write all logs with importance level of 'info' or less to 'combined.log'
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    }),
    
    // Write all logs with importance level of 'warn' or less to 'app.log'
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'app.log'),
      level: 'warn',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ],
  
  // Handle exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 3
    })
  ],
  
  // Handle promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'rejections.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 3
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Add custom logging methods
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Security logging
logger.security = (message, meta = {}) => {
  logger.warn(message, {
    type: 'security',
    ...meta
  });
};

// Audit logging
logger.audit = (action, resource, userId, details = {}) => {
  logger.info(`AUDIT: ${action} ${resource}`, {
    type: 'audit',
    action,
    resource,
    userId,
    ...details
  });
};

// Performance logging
logger.performance = (operation, duration, meta = {}) => {
  logger.info(`PERFORMANCE: ${operation} took ${duration}ms`, {
    type: 'performance',
    operation,
    duration,
    ...meta
  });
};

// Database logging
logger.database = (query, duration, meta = {}) => {
  logger.debug(`DATABASE: ${query} (${duration}ms)`, {
    type: 'database',
    query,
    duration,
    ...meta
  });
};

// API logging
logger.api = (method, url, statusCode, duration, meta = {}) => {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  logger.log(level, `API: ${method} ${url} ${statusCode} (${duration}ms)`, {
    type: 'api',
    method,
    url,
    statusCode,
    duration,
    ...meta
  });
};

// System logging
logger.system = (event, meta = {}) => {
  logger.info(`SYSTEM: ${event}`, {
    type: 'system',
    event,
    ...meta
  });
};

// Business logic logging
logger.business = (event, meta = {}) => {
  logger.info(`BUSINESS: ${event}`, {
    type: 'business',
    event,
    ...meta
  });
};

// Create a middleware for request logging
logger.middleware = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.http(`${req.method} ${req.url}`, {
    type: 'request',
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id
  });
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - start;
    
    logger.api(req.method, req.url, res.statusCode, duration, {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id,
      responseSize: chunk ? chunk.length : 0
    });
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// Error logging helper
logger.logError = (error, req = null, additionalInfo = {}) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...additionalInfo
  };
  
  if (req) {
    errorInfo.request = {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id,
      body: req.body,
      query: req.query,
      params: req.params
    };
  }
  
  logger.error('Application Error', errorInfo);
};

// Query logging helper for database operations
logger.queryLogger = (query, params = [], duration = null) => {
  const logData = {
    query: query.replace(/\s+/g, ' ').trim(),
    params,
    duration
  };
  
  if (duration !== null) {
    logData.message = `Query executed in ${duration}ms`;
  }
  
  logger.debug('Database Query', logData);
};

// Sanitize sensitive data for logging
logger.sanitize = (data) => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'auth',
    'authorization',
    'cookie',
    'session',
    'csrf'
  ];
  
  const sanitized = { ...data };
  
  for (const key in sanitized) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = logger.sanitize(sanitized[key]);
    }
  }
  
  return sanitized;
};

// Log application startup
logger.system('Application logger initialized', {
  logLevel: process.env.LOG_LEVEL || 'info',
  environment: process.env.NODE_ENV || 'development',
  logsDirectory: logsDir
});

module.exports = logger;