const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const redis = require('../config/redis');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Verify JWT token and attach user to request
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Check if token is blacklisted (in Redis)
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        isActive: true,
        lastLogin: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated'
      });
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * Check if user has required role
 */
const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userRole = req.user.role;
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Check if user has specific permission
 */
const requirePermission = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userPermissions = req.user.permissions || [];
    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

    // Admins have all permissions
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const hasPermission = permissions.some(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Optional authentication - attach user if token is valid, but don't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(); // Continue without user
    }

    // Check if token is blacklisted
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return next(); // Continue without user
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        isActive: true
      }
    });

    if (user && user.isActive) {
      req.user = user;
    }

    next();

  } catch (error) {
    // Ignore token errors for optional auth
    next();
  }
};

/**
 * Check if user owns the resource or has admin privileges
 */
const requireOwnershipOrAdmin = (resourceIdParam = 'id', userIdField = 'createdById') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Admins can access everything
    if (req.user.role === 'ADMIN') {
      return next();
    }

    try {
      const resourceId = req.params[resourceIdParam];
      
      // Check ownership based on the route
      let resource;
      const modelName = req.route.path.split('/')[1]; // Extract model from route
      
      switch (modelName) {
        case 'assets':
          resource = await prisma.asset.findUnique({
            where: { id: resourceId },
            select: { [userIdField]: true }
          });
          break;
        case 'risks':
          resource = await prisma.risk.findUnique({
            where: { id: resourceId },
            select: { ownerId: true }
          });
          break;
        case 'reports':
          resource = await prisma.report.findUnique({
            where: { id: resourceId },
            select: { [userIdField]: true }
          });
          break;
        default:
          return res.status(500).json({
            success: false,
            message: 'Ownership check not implemented for this resource'
          });
      }

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
      }

      const ownerId = resource[userIdField] || resource.ownerId;
      if (ownerId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: insufficient permissions'
        });
      }

      next();

    } catch (error) {
      logger.error('Ownership check error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking resource ownership'
      });
    }
  };
};

/**
 * Rate limiting per user
 */
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(); // Skip rate limiting for unauthenticated users
    }

    try {
      const key = `rate_limit:${req.user.id}`;
      const current = await redis.get(key);

      if (current && parseInt(current) >= maxRequests) {
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded. Please try again later.'
        });
      }

      await redis.incr(key);
      await redis.expire(key, Math.ceil(windowMs / 1000));

      next();

    } catch (error) {
      logger.error('User rate limit error:', error);
      next(); // Continue on Redis error
    }
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission,
  optionalAuth,
  requireOwnershipOrAdmin,
  userRateLimit
};