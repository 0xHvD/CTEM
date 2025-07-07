const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         role:
 *           type: string
 *           enum: [ADMIN, ANALYST, VIEWER]
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *         isActive:
 *           type: boolean
 *         lastLogin:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         avatar:
 *           type: string
 *         department:
 *           type: string
 *         phoneNumber:
 *           type: string
 *         mfaEnabled:
 *           type: boolean
 *         passwordLastChanged:
 *           type: string
 *           format: date-time
 *     UserCreateRequest:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - role
 *       properties:
 *         name:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         role:
 *           type: string
 *           enum: [ADMIN, ANALYST, VIEWER]
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *         department:
 *           type: string
 *         phoneNumber:
 *           type: string
 *         sendWelcomeEmail:
 *           type: boolean
 *           default: true
 *     UserUpdateRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         role:
 *           type: string
 *           enum: [ADMIN, ANALYST, VIEWER]
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *         department:
 *           type: string
 *         phoneNumber:
 *           type: string
 *         isActive:
 *           type: boolean
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users with filtering and pagination
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [ADMIN, ANALYST, VIEWER]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, email, role, lastLogin, createdAt]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get('/', [
  authenticateToken,
  requirePermission('users:read'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().trim().escape(),
  query('role').optional().isIn(['ADMIN', 'ANALYST', 'VIEWER']),
  query('isActive').optional().isBoolean().toBoolean(),
  query('department').optional().trim(),
  query('sortBy').optional().isIn(['name', 'email', 'role', 'lastLogin', 'createdAt']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      page = 1,
      limit = 20,
      search,
      role,
      isActive,
      department,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build where clause
    const whereClause = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role) {
      whereClause.role = role;
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive;
    }

    if (department) {
      whereClause.department = { contains: department, mode: 'insensitive' };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build order by clause
    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          permissions: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          avatar: true,
          department: true,
          phoneNumber: true,
          mfaEnabled: true,
          passwordLastChanged: true
        },
        orderBy,
        skip,
        take: limit
      }),
      prisma.user.count({ where: whereClause })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        users,
        total,
        page,
        totalPages
      }
    });

  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get a specific user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get('/:id', [
  authenticateToken,
  requirePermission('users:read'),
  param('id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        avatar: true,
        department: true,
        phoneNumber: true,
        mfaEnabled: true,
        passwordLastChanged: true,
        _count: {
          select: {
            createdAssets: true,
            createdRisks: true,
            createdReports: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCreateRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Insufficient permissions
 */
router.post('/', [
  authenticateToken,
  requireRole('ADMIN'),
  auditLog('CREATE', 'USER'),
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('role').isIn(['ADMIN', 'ANALYST', 'VIEWER']).withMessage('Valid role is required'),
  body('permissions').optional().isArray().withMessage('Permissions must be an array'),
  body('department').optional().trim().isLength({ max: 100 }),
  body('phoneNumber').optional().trim().isLength({ max: 20 }),
  body('sendWelcomeEmail').optional().isBoolean().toBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      name,
      email,
      role,
      permissions = [],
      department,
      phoneNumber,
      sendWelcomeEmail = true
    } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(12).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        permissions,
        department,
        phoneNumber,
        isActive: true,
        passwordLastChanged: new Date()
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
        department: true,
        phoneNumber: true,
        createdAt: true
      }
    });

    // Log audit trail using logger.audit
    if (req.user) {
      logger.audit(
        req.user.id,
        'CREATE',
        'USER',
        user.id,
        null,
        { name, email, role, department },
        req.ip,
        req.get('User-Agent')
      );
    }

    // Send welcome email if requested
    if (sendWelcomeEmail) {
      try {
        await sendWelcomeEmail(user, tempPassword);
      } catch (emailError) {
        logger.warn('Failed to send welcome email:', emailError);
        // Don't fail user creation if email fails
      }
    }

    res.status(201).json({
      success: true,
      data: {
        user,
        ...(sendWelcomeEmail && { tempPassword }) // Only include if email wasn't sent
      },
      message: 'User created successfully'
    });

  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', [
  authenticateToken,
  requireRole('ADMIN'),
  auditLog('UPDATE', 'USER'),
  param('id').isUUID(),
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['ADMIN', 'ANALYST', 'VIEWER']),
  body('permissions').optional().isArray(),
  body('department').optional().trim().isLength({ max: 100 }),
  body('phoneNumber').optional().trim().isLength({ max: 20 }),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if email is being changed and already exists
    if (updateData.email && updateData.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: updateData.email }
      });

      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Prevent user from deactivating themselves
    if (id === req.user.id && updateData.isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
        department: true,
        phoneNumber: true,
        updatedAt: true
      }
    });

    // Log audit trail using logger.audit
    if (req.user) {
      logger.audit(
        req.user.id,
        'UPDATE',
        'USER',
        user.id,
        existingUser,
        updateData,
        req.ip,
        req.get('User-Agent')
      );
    }

    res.json({
      success: true,
      data: user,
      message: 'User updated successfully'
    });

  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', [
  authenticateToken,
  requireRole('ADMIN'),
  auditLog('DELETE', 'USER'),
  param('id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;

    // Prevent user from deleting themselves
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Instead of hard delete, deactivate the user to preserve audit trail
    await prisma.user.update({
      where: { id },
      data: { 
        isActive: false,
        email: `deleted_${Date.now()}_${user.email}` // Prevent email conflicts
      }
    });

    // Remove all refresh tokens for this user
    await prisma.refreshToken.deleteMany({
      where: { userId: id }
    });

    // Log audit trail using logger.audit
    if (req.user) {
      logger.audit(
        req.user.id,
        'DELETE',
        'USER',
        user.id,
        user,
        { isActive: false },
        req.ip,
        req.get('User-Agent')
      );
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/users/{id}/reset-password:
 *   post:
 *     summary: Reset user password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/reset-password', [
  authenticateToken,
  requireRole('ADMIN'),
  auditLog('RESET_PASSWORD', 'USER'),
  param('id').isUUID(),
  body('sendEmail').optional().isBoolean().toBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { sendEmail = true } = req.body;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reset password for inactive user'
      });
    }

    // Generate new temporary password
    const tempPassword = crypto.randomBytes(12).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    // Update password
    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        passwordLastChanged: new Date()
      }
    });

    // Remove all refresh tokens for this user
    await prisma.refreshToken.deleteMany({
      where: { userId: id }
    });

    // Log audit trail using logger.audit
    if (req.user) {
      logger.audit(
        req.user.id,
        'RESET_PASSWORD',
        'USER',
        user.id,
        null,
        { passwordReset: true },
        req.ip,
        req.get('User-Agent')
      );
    }

    // Send password reset email if requested
    if (sendEmail) {
      try {
        await sendPasswordResetEmail(user, tempPassword);
      } catch (emailError) {
        logger.warn('Failed to send password reset email:', emailError);
        // Don't fail the operation if email fails
      }
    }

    res.json({
      success: true,
      data: {
        ...(sendEmail ? {} : { tempPassword }) // Only include password if email wasn't sent
      },
      message: 'Password reset successfully'
    });

  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/users/{id}/toggle-status:
 *   patch:
 *     summary: Toggle user active status
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/toggle-status', [
  authenticateToken,
  requireRole('ADMIN'),
  auditLog('TOGGLE_STATUS', 'USER'),
  param('id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;

    // Prevent user from deactivating themselves
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own account status'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, isActive: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true
      }
    });

    // Remove all refresh tokens if user is being deactivated
    if (!updatedUser.isActive) {
      await prisma.refreshToken.deleteMany({
        where: { userId: id }
      });
    }

    // Log audit trail using logger.audit
    if (req.user) {
      logger.audit(
        req.user.id,
        'TOGGLE_STATUS',
        'USER',
        user.id,
        { isActive: user.isActive },
        { isActive: updatedUser.isActive },
        req.ip,
        req.get('User-Agent')
      );
    }

    res.json({
      success: true,
      data: updatedUser,
      message: `User ${updatedUser.isActive ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    logger.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/users/bulk-update:
 *   patch:
 *     summary: Bulk update users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/bulk-update', [
  authenticateToken,
  requireRole('ADMIN'),
  auditLog('BULK_UPDATE', 'USER'),
  body('userIds').isArray({ min: 1 }),
  body('userIds.*').isUUID(),
  body('updates').isObject(),
  body('updates.role').optional().isIn(['ADMIN', 'ANALYST', 'VIEWER']),
  body('updates.isActive').optional().isBoolean(),
  body('updates.department').optional().trim().isLength({ max: 100 }),
  body('updates.permissions').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userIds, updates } = req.body;

    // Prevent bulk operations on current user
    if (userIds.includes(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot perform bulk operations on your own account'
      });
    }

    const updatedUsers = await prisma.user.updateMany({
      where: {
        id: {
          in: userIds
        }
      },
      data: updates
    });

    // Log audit trail using logger.audit
    if (req.user) {
      logger.audit(
        req.user.id,
        'BULK_UPDATE',
        'USER',
        userIds.join(','),
        null,
        updates,
        req.ip,
        req.get('User-Agent')
      );
    }

    res.json({
      success: true,
      data: {
        updatedCount: updatedUsers.count
      },
      message: `${updatedUsers.count} users updated successfully`
    });

  } catch (error) {
    logger.error('Bulk update users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     summary: Get user statistics
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', [
  authenticateToken,
  requirePermission('users:read')
], async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      usersByRole,
      recentLogins,
      inactiveUsers
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.groupBy({
        by: ['role'],
        _count: true
      }),
      prisma.user.count({
        where: {
          lastLogin: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      }),
      prisma.user.count({
        where: {
          OR: [
            { lastLogin: null },
            {
              lastLogin: {
                lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // More than 30 days ago
              }
            }
          ]
        }
      })
    ]);

    const roleStats = usersByRole.reduce((acc, role) => {
      acc[role.role.toLowerCase()] = role._count;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        roleStats,
        recentLogins,
        longTermInactiveUsers: inactiveUsers
      }
    });

  } catch (error) {
    logger.error('Get user statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/users/activity:
 *   get:
 *     summary: Get user activity log
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/activity', [
  authenticateToken,
  requirePermission('users:read'),
  query('userId').optional().isUUID(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('days').optional().isInt({ min: 1, max: 365 }).toInt()
], async (req, res) => {
  try {
    const { userId, limit = 50, days = 30 } = req.query;

    const whereClause = {
      createdAt: {
        gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      }
    };

    if (userId) {
      whereClause.userId = userId;
    }

    const activities = await prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    res.json({
      success: true,
      data: activities
    });

  } catch (error) {
    logger.error('Get user activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Helper function to send welcome email
async function sendWelcomeEmail(user, tempPassword) {
  const settings = await getEmailSettings();
  if (!settings.enabled) {
    throw new Error('Email notifications not configured');
  }

  const transporter = nodemailer.createTransporter({
    host: settings.smtpServer,
    port: settings.smtpPort,
    secure: settings.smtpPort === 465,
    auth: {
      user: settings.username,
      pass: settings.password
    }
  });

  const mailOptions = {
    from: settings.fromEmail,
    to: user.email,
    subject: 'Welcome to CTEM System',
    html: `
      <h2>Welcome to CTEM System</h2>
      <p>Hello ${user.name},</p>
      <p>Your account has been created successfully. Here are your login credentials:</p>
      <ul>
        <li><strong>Email:</strong> ${user.email}</li>
        <li><strong>Temporary Password:</strong> ${tempPassword}</li>
        <li><strong>Role:</strong> ${user.role}</li>
      </ul>
      <p><strong>Important:</strong> Please change your password after your first login.</p>
      <p>You can access the system at: <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}">${process.env.FRONTEND_URL || 'http://localhost:5173'}</a></p>
      <hr>
      <p><small>This is an automated message from CTEM System. Please do not reply to this email.</small></p>
    `
  };

  await transporter.sendMail(mailOptions);
}

// Helper function to send password reset email
async function sendPasswordResetEmail(user, tempPassword) {
  const settings = await getEmailSettings();
  if (!settings.enabled) {
    throw new Error('Email notifications not configured');
  }

  const transporter = nodemailer.createTransporter({
    host: settings.smtpServer,
    port: settings.smtpPort,
    secure: settings.smtpPort === 465,
    auth: {
      user: settings.username,
      pass: settings.password
    }
  });

  const mailOptions = {
    from: settings.fromEmail,
    to: user.email,
    subject: 'CTEM System - Password Reset',
    html: `
      <h2>Password Reset</h2>
      <p>Hello ${user.name},</p>
      <p>Your password has been reset by an administrator. Here are your new login credentials:</p>
      <ul>
        <li><strong>Email:</strong> ${user.email}</li>
        <li><strong>New Temporary Password:</strong> ${tempPassword}</li>
      </ul>
      <p><strong>Important:</strong> Please change your password immediately after logging in.</p>
      <p>You can access the system at: <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}">${process.env.FRONTEND_URL || 'http://localhost:5173'}</a></p>
      <p>If you did not request this password reset, please contact your administrator immediately.</p>
      <hr>
      <p><small>This is an automated message from CTEM System. Please do not reply to this email.</small></p>
    `
  };

  await transporter.sendMail(mailOptions);
}

// Helper function to get email settings
async function getEmailSettings() {
  const emailSettings = await prisma.systemSetting.findMany({
    where: {
      key: {
        startsWith: 'notifications.email'
      }
    }
  });

  const settings = {
    enabled: false,
    smtpServer: '',
    smtpPort: 587,
    username: '',
    password: '',
    fromEmail: ''
  };

  emailSettings.forEach(setting => {
    const key = setting.key.replace('notifications.email.', '');
    try {
      settings[key] = JSON.parse(setting.value);
    } catch (e) {
      settings[key] = setting.value;
    }
  });

  return settings;
}

module.exports = router;