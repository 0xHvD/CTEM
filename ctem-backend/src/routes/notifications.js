const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');
const logger = require('../utils/logger');
const nodemailer = require('nodemailer');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         type:
 *           type: string
 *           enum: [alert, info, warning, success, system]
 *         title:
 *           type: string
 *         message:
 *           type: string
 *         data:
 *           type: object
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         isRead:
 *           type: boolean
 *         readAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         expiresAt:
 *           type: string
 *           format: date-time
 *         userId:
 *           type: string
 *         category:
 *           type: string
 *         actionUrl:
 *           type: string
 *         actionText:
 *           type: string
 *     NotificationSettings:
 *       type: object
 *       properties:
 *         emailNotifications:
 *           type: boolean
 *         pushNotifications:
 *           type: boolean
 *         smsNotifications:
 *           type: boolean
 *         notificationTypes:
 *           type: object
 *           properties:
 *             vulnerabilities:
 *               type: boolean
 *             risks:
 *               type: boolean
 *             compliance:
 *               type: boolean
 *             system:
 *               type: boolean
 *             reports:
 *               type: boolean
 *         frequency:
 *           type: string
 *           enum: [immediate, hourly, daily, weekly]
 *         quietHours:
 *           type: object
 *           properties:
 *             enabled:
 *               type: boolean
 *             startTime:
 *               type: string
 *             endTime:
 *               type: string
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get notifications for current user
 *     tags: [Notifications]
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
 *         name: type
 *         schema:
 *           type: string
 *           enum: [alert, info, warning, success, system]
 *       - in: query
 *         name: read
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of notifications
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
 *                     notifications:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Notification'
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     unreadCount:
 *                       type: integer
 */
router.get('/', [
  authenticateToken,
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('type').optional().isIn(['alert', 'info', 'warning', 'success', 'system']),
  query('read').optional().isBoolean().toBoolean(),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  query('category').optional().trim()
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
      type,
      read,
      priority,
      category
    } = req.query;

    // Build where clause
    const whereClause = {
      userId: req.user.id,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    };

    if (type) {
      whereClause.type = type.toUpperCase();
    }

    if (read !== undefined) {
      whereClause.isRead = read;
    }

    if (priority) {
      whereClause.priority = priority.toUpperCase();
    }

    if (category) {
      whereClause.category = { contains: category, mode: 'insensitive' };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.notification.count({ where: whereClause }),
      prisma.notification.count({
        where: {
          userId: req.user.id,
          isRead: false,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      })
    ]);

    // Transform notifications for frontend
    const transformedNotifications = notifications.map(notification => ({
      ...notification,
      type: notification.type.toLowerCase(),
      priority: notification.priority.toLowerCase()
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        notifications: transformedNotifications,
        total,
        page,
        totalPages,
        unreadCount
      }
    });

  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/notifications/{id}:
 *   get:
 *     summary: Get a specific notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', [
  authenticateToken,
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

    const notification = await prisma.notification.findUnique({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...notification,
        type: notification.type.toLowerCase(),
        priority: notification.priority.toLowerCase()
      }
    });

  } catch (error) {
    logger.error('Get notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   put:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id/read', [
  authenticateToken,
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

    const notification = await prisma.notification.findUnique({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({
      success: true,
      data: {
        ...updatedNotification,
        type: updatedNotification.type.toLowerCase(),
        priority: updatedNotification.priority.toLowerCase()
      },
      message: 'Notification marked as read'
    });

  } catch (error) {
    logger.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/notifications/read-all:
 *   put:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.put('/read-all', [
  authenticateToken
], async (req, res) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({
      success: true,
      data: {
        updatedCount: result.count
      },
      message: `${result.count} notifications marked as read`
    });

  } catch (error) {
    logger.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', [
  authenticateToken,
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

    const notification = await prisma.notification.findUnique({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await prisma.notification.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    logger.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/notifications/bulk-action:
 *   post:
 *     summary: Perform bulk actions on notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/bulk-action', [
  authenticateToken,
  body('notificationIds').isArray({ min: 1 }),
  body('notificationIds.*').isUUID(),
  body('action').isIn(['read', 'unread', 'delete'])
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

    const { notificationIds, action } = req.body;

    const whereClause = {
      id: { in: notificationIds },
      userId: req.user.id
    };

    let result;
    switch (action) {
      case 'read':
        result = await prisma.notification.updateMany({
          where: whereClause,
          data: {
            isRead: true,
            readAt: new Date()
          }
        });
        break;
      case 'unread':
        result = await prisma.notification.updateMany({
          where: whereClause,
          data: {
            isRead: false,
            readAt: null
          }
        });
        break;
      case 'delete':
        result = await prisma.notification.deleteMany({
          where: whereClause
        });
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action'
        });
    }

    res.json({
      success: true,
      data: {
        affectedCount: result.count
      },
      message: `${result.count} notifications ${action === 'delete' ? 'deleted' : `marked as ${action}`}`
    });

  } catch (error) {
    logger.error('Bulk notification action error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/notifications/create:
 *   post:
 *     summary: Create a new notification (Admin only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.post('/create', [
  authenticateToken,
  requirePermission('notifications:create'),
  auditLog('CREATE', 'NOTIFICATION'),
  body('title').trim().isLength({ min: 1, max: 200 }),
  body('message').trim().isLength({ min: 1, max: 1000 }),
  body('type').optional().isIn(['alert', 'info', 'warning', 'success', 'system']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('category').optional().trim().isLength({ max: 100 }),
  body('targetUsers').optional().isArray(),
  body('targetUsers.*').optional().isUUID(),
  body('targetRoles').optional().isArray(),
  body('targetRoles.*').optional().isIn(['ADMIN', 'ANALYST', 'VIEWER']),
  body('expiresAt').optional().isISO8601(),
  body('actionUrl').optional().isURL(),
  body('actionText').optional().trim().isLength({ max: 50 }),
  body('data').optional().isObject(),
  body('sendEmail').optional().isBoolean()
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
      title,
      message,
      type = 'info',
      priority = 'medium',
      category,
      targetUsers = [],
      targetRoles = [],
      expiresAt,
      actionUrl,
      actionText,
      data = {},
      sendEmail = false
    } = req.body;

    // Determine target users
    let userIds = [...targetUsers];

    if (targetRoles.length > 0) {
      const roleUsers = await prisma.user.findMany({
        where: {
          role: { in: targetRoles },
          isActive: true
        },
        select: { id: true }
      });
      userIds.push(...roleUsers.map(user => user.id));
    }

    // Remove duplicates
    userIds = [...new Set(userIds)];

    // If no specific users/roles, send to all active users
    if (userIds.length === 0) {
      const allUsers = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true }
      });
      userIds = allUsers.map(user => user.id);
    }

    // Create notifications for each user
    const notifications = await Promise.all(
      userIds.map(userId =>
        prisma.notification.create({
          data: {
            title,
            message,
            type: type.toUpperCase(),
            priority: priority.toUpperCase(),
            category,
            userId,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            actionUrl,
            actionText,
            data
          }
        })
      )
    );

    // Send email notifications if requested
    if (sendEmail) {
      try {
        await sendEmailNotifications(notifications, { title, message, actionUrl });
      } catch (emailError) {
        logger.warn('Failed to send email notifications:', emailError);
      }
    }

    res.status(201).json({
      success: true,
      data: {
        notificationCount: notifications.length,
        targetUsers: userIds.length
      },
      message: `${notifications.length} notifications created successfully`
    });

  } catch (error) {
    logger.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/notifications/settings:
 *   get:
 *     summary: Get notification settings for current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.get('/settings', [
  authenticateToken
], async (req, res) => {
  try {
    const settings = await prisma.userNotificationSettings.findUnique({
      where: { userId: req.user.id }
    });

    const defaultSettings = {
      emailNotifications: true,
      pushNotifications: true,
      smsNotifications: false,
      notificationTypes: {
        vulnerabilities: true,
        risks: true,
        compliance: true,
        system: true,
        reports: true
      },
      frequency: 'immediate',
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00'
      }
    };

    res.json({
      success: true,
      data: settings ? { ...defaultSettings, ...settings.settings } : defaultSettings
    });

  } catch (error) {
    logger.error('Get notification settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/notifications/settings:
 *   put:
 *     summary: Update notification settings for current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.put('/settings', [
  authenticateToken,
  body('emailNotifications').optional().isBoolean(),
  body('pushNotifications').optional().isBoolean(),
  body('smsNotifications').optional().isBoolean(),
  body('notificationTypes').optional().isObject(),
  body('frequency').optional().isIn(['immediate', 'hourly', 'daily', 'weekly']),
  body('quietHours').optional().isObject()
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

    const settings = await prisma.userNotificationSettings.upsert({
      where: { userId: req.user.id },
      update: {
        settings: req.body
      },
      create: {
        userId: req.user.id,
        settings: req.body
      }
    });

    res.json({
      success: true,
      data: settings.settings,
      message: 'Notification settings updated successfully'
    });

  } catch (error) {
    logger.error('Update notification settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/notifications/stats:
 *   get:
 *     summary: Get notification statistics
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', [
  authenticateToken,
  requirePermission('notifications:read')
], async (req, res) => {
  try {
    const [
      totalNotifications,
      unreadNotifications,
      notificationsByType,
      notificationsByPriority,
      recentNotifications
    ] = await Promise.all([
      prisma.notification.count({
        where: req.user.role === 'ADMIN' ? {} : { userId: req.user.id }
      }),
      prisma.notification.count({
        where: {
          ...(req.user.role === 'ADMIN' ? {} : { userId: req.user.id }),
          isRead: false
        }
      }),
      prisma.notification.groupBy({
        by: ['type'],
        _count: true,
        where: req.user.role === 'ADMIN' ? {} : { userId: req.user.id }
      }),
      prisma.notification.groupBy({
        by: ['priority'],
        _count: true,
        where: req.user.role === 'ADMIN' ? {} : { userId: req.user.id }
      }),
      prisma.notification.count({
        where: {
          ...(req.user.role === 'ADMIN' ? {} : { userId: req.user.id }),
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    const typeStats = notificationsByType.reduce((acc, item) => {
      acc[item.type.toLowerCase()] = item._count;
      return acc;
    }, {});

    const priorityStats = notificationsByPriority.reduce((acc, item) => {
      acc[item.priority.toLowerCase()] = item._count;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalNotifications,
        unreadNotifications,
        recentNotifications,
        typeStats,
        priorityStats
      }
    });

  } catch (error) {
    logger.error('Get notification statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Helper functions

async function sendEmailNotifications(notifications, content) {
  try {
    // Get email settings
    const emailSettings = await getEmailSettings();
    if (!emailSettings.enabled) {
      throw new Error('Email notifications not configured');
    }

    const transporter = nodemailer.createTransporter({
      host: emailSettings.smtpServer,
      port: emailSettings.smtpPort,
      secure: emailSettings.smtpPort === 465,
      auth: {
        user: emailSettings.username,
        pass: emailSettings.password
      }
    });

    // Group notifications by user
    const userNotifications = {};
    for (const notification of notifications) {
      if (!userNotifications[notification.userId]) {
        userNotifications[notification.userId] = [];
      }
      userNotifications[notification.userId].push(notification);
    }

    // Send emails
    for (const userId in userNotifications) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true }
      });

      if (user && user.email) {
        const mailOptions = {
          from: emailSettings.fromEmail,
          to: user.email,
          subject: `CTEM Notification: ${content.title}`,
          html: `
            <h2>${content.title}</h2>
            <p>Hello ${user.name},</p>
            <p>${content.message}</p>
            ${content.actionUrl ? `<p><a href="${content.actionUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Details</a></p>` : ''}
            <hr>
            <p><small>This notification was sent from the CTEM System. You can manage your notification preferences in your account settings.</small></p>
          `
        };

        await transporter.sendMail(mailOptions);
      }
    }
  } catch (error) {
    logger.error('Send email notifications error:', error);
    throw error;
  }
}

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