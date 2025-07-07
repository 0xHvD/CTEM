const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Audit logging middleware
 * Creates a middleware function that logs user actions to both database and winston logger
 * 
 * @param {string} action - The action being performed (CREATE, UPDATE, DELETE, etc.)
 * @param {string} resource - The resource being acted upon (USER, ASSET, RISK, etc.)
 * @returns {Function} Express middleware function
 */
const auditLog = (action, resource) => {
  return async (req, res, next) => {
    try {
      // Store original res.json to intercept response
      const originalJson = res.json;
      
      // Override res.json to capture response data
      res.json = function(data) {
        // Call original res.json
        const result = originalJson.call(this, data);
        
        // Log audit trail after successful response (only for successful operations)
        if (req.user && (res.statusCode < 400)) {
          setImmediate(async () => {
            try {
              // Determine resource ID from different sources
              let resourceId = null;
              
              // Try to get ID from params first
              if (req.params.id) {
                resourceId = req.params.id;
              }
              // For bulk operations, use comma-separated IDs
              else if (req.body.userIds && Array.isArray(req.body.userIds)) {
                resourceId = req.body.userIds.join(',');
              }
              // For create operations, try to extract ID from response
              else if (data && data.data && data.data.user && data.data.user.id) {
                resourceId = data.data.user.id;
              }
              // For other create operations
              else if (data && data.data && data.data.id) {
                resourceId = data.data.id;
              }

              // Prepare audit data
              const auditData = {
                userId: req.user.id,
                action: action,
                resource: resource,
                resourceId: resourceId || 'unknown',
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent') || 'unknown',
                method: req.method,
                endpoint: req.originalUrl,
                timestamp: new Date()
              };

              // Add request body for context (excluding sensitive data)
              if (req.body && Object.keys(req.body).length > 0) {
                const sanitizedBody = { ...req.body };
                // Remove sensitive fields
                delete sanitizedBody.password;
                delete sanitizedBody.tempPassword;
                delete sanitizedBody.currentPassword;
                delete sanitizedBody.newPassword;
                
                auditData.requestData = sanitizedBody;
              }

              // Add query parameters if present
              if (req.query && Object.keys(req.query).length > 0) {
                auditData.queryParams = req.query;
              }

              // Save to database if auditLog table exists
              try {
                await prisma.auditLog.create({
                  data: {
                    userId: auditData.userId,
                    action: auditData.action,
                    resource: auditData.resource,
                    resourceId: auditData.resourceId,
                    details: {
                      ip: auditData.ip,
                      userAgent: auditData.userAgent,
                      method: auditData.method,
                      endpoint: auditData.endpoint,
                      requestData: auditData.requestData,
                      queryParams: auditData.queryParams
                    },
                    createdAt: auditData.timestamp
                  }
                });
              } catch (dbError) {
                // If database save fails, log the error but don't break the flow
                logger.warn('Failed to save audit log to database:', dbError);
              }

              // Always log to winston logger as backup
              logger.audit(
                auditData.userId,
                auditData.action,
                auditData.resource,
                auditData.resourceId,
                null, // oldValues - can be enhanced later
                auditData.requestData, // newValues
                auditData.ip,
                auditData.userAgent
              );

            } catch (auditError) {
              logger.error('Audit logging error:', auditError);
            }
          });
        }
        
        return result;
      };
      
      next();
    } catch (error) {
      logger.error('Audit middleware error:', error);
      next(); // Continue even if audit setup fails
    }
  };
};

/**
 * Security event logging middleware
 * Logs security-related events like failed logins, unauthorized access attempts, etc.
 * 
 * @param {string} event - The security event type
 * @returns {Function} Express middleware function
 */
const securityLog = (event) => {
  return (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json;
    
    res.json = function(data) {
      const result = originalJson.call(this, data);
      
      // Log security events for failed operations or specific events
      if (res.statusCode >= 400 || event === 'LOGIN_ATTEMPT') {
        setImmediate(() => {
          logger.security(event, {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            method: req.method,
            endpoint: req.originalUrl,
            statusCode: res.statusCode,
            userId: req.user ? req.user.id : null,
            email: req.body ? req.body.email : null,
            timestamp: new Date().toISOString()
          });
        });
      }
      
      return result;
    };
    
    next();
  };
};

/**
 * Performance logging middleware
 * Logs request performance metrics
 * 
 * @param {string} label - Label for the performance log
 * @returns {Function} Express middleware function
 */
const performanceLog = (label) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Store original res.end to capture when response finishes
    const originalEnd = res.end;
    
    res.end = function(...args) {
      const result = originalEnd.apply(this, args);
      
      // Log performance after response is sent
      setImmediate(() => {
        logger.performance(`${label} - ${req.method} ${req.originalUrl}`, startTime);
      });
      
      return result;
    };
    
    next();
  };
};

/**
 * Enhanced audit log function for direct use (without middleware)
 * Can be called directly from route handlers for more detailed logging
 * 
 * @param {Object} options - Audit log options
 * @param {string} options.userId - ID of the user performing the action
 * @param {string} options.action - Action being performed
 * @param {string} options.resource - Resource being acted upon
 * @param {string} options.resourceId - ID of the resource
 * @param {Object} options.oldValues - Previous values (for updates)
 * @param {Object} options.newValues - New values
 * @param {string} options.ip - IP address
 * @param {string} options.userAgent - User agent string
 * @param {Object} options.additional - Additional metadata
 */
const createAuditLog = async (options) => {
  try {
    const {
      userId,
      action,
      resource,
      resourceId,
      oldValues = null,
      newValues = null,
      ip = 'unknown',
      userAgent = 'unknown',
      additional = {}
    } = options;

    // Save to database
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          resourceId: resourceId?.toString() || 'unknown',
          details: {
            oldValues,
            newValues,
            ip,
            userAgent,
            ...additional
          },
          createdAt: new Date()
        }
      });
    } catch (dbError) {
      logger.warn('Failed to save direct audit log to database:', dbError);
    }

    // Always log to winston as backup
    logger.audit(userId, action, resource, resourceId, oldValues, newValues, ip, userAgent);

  } catch (error) {
    logger.error('Direct audit logging error:', error);
  }
};

module.exports = {
  auditLog,
  securityLog,
  performanceLog,
  createAuditLog
};