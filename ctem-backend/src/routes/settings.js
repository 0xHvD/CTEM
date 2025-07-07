const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * components:
 *   schemas:
 *     SystemSettings:
 *       type: object
 *       properties:
 *         general:
 *           type: object
 *           properties:
 *             organizationName:
 *               type: string
 *             timezone:
 *               type: string
 *             dateFormat:
 *               type: string
 *             language:
 *               type: string
 *             defaultPageSize:
 *               type: integer
 *             darkMode:
 *               type: boolean
 *             autoRefresh:
 *               type: boolean
 *         security:
 *           type: object
 *           properties:
 *             requireMFA:
 *               type: boolean
 *             sessionTimeout:
 *               type: integer
 *             passwordExpiry:
 *               type: integer
 *             ipWhitelist:
 *               type: object
 *               properties:
 *                 enabled:
 *                   type: boolean
 *                 addresses:
 *                   type: string
 *             apiRateLimit:
 *               type: object
 *               properties:
 *                 enabled:
 *                   type: boolean
 *                 limit:
 *                   type: integer
 *         notifications:
 *           type: object
 *           properties:
 *             email:
 *               type: object
 *               properties:
 *                 enabled:
 *                   type: boolean
 *                 smtpServer:
 *                   type: string
 *                 smtpPort:
 *                   type: integer
 *                 username:
 *                   type: string
 *                 password:
 *                   type: string
 *                 fromEmail:
 *                   type: string
 *             thresholds:
 *               type: object
 *               properties:
 *                 criticalVulns:
 *                   type: integer
 *                 riskScore:
 *                   type: number
 *             types:
 *               type: object
 *               properties:
 *                 newVulnerabilities:
 *                   type: boolean
 *                 riskChanges:
 *                   type: boolean
 *                 complianceChanges:
 *                   type: boolean
 *                 systemAlerts:
 *                   type: boolean
 *         scanning:
 *           type: object
 *           properties:
 *             automated:
 *               type: object
 *               properties:
 *                 enabled:
 *                   type: boolean
 *                 frequency:
 *                   type: string
 *                 time:
 *                   type: string
 *             timeout:
 *               type: integer
 *             concurrentScans:
 *               type: integer
 *             deepScan:
 *               type: boolean
 *             autoRemediation:
 *               type: boolean
 *     SystemInfo:
 *       type: object
 *       properties:
 *         version:
 *           type: string
 *         build:
 *           type: string
 *         uptime:
 *           type: string
 *         database:
 *           type: string
 *         cpuUsage:
 *           type: number
 *         memoryUsage:
 *           type: number
 *         diskUsage:
 *           type: number
 *         activeUsers:
 *           type: integer
 */

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Get system settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SystemSettings'
 */
router.get('/', [
  authenticateToken,
  requirePermission('settings:read')
], async (req, res) => {
  try {
    // Get all settings from database
    const settingsData = await prisma.systemSetting.findMany({
      select: {
        key: true,
        value: true,
        category: true
      }
    });

    // Transform settings to nested object structure
    const settings = {
      general: {
        organizationName: 'ACME Corporation',
        timezone: 'Europe/Berlin',
        dateFormat: 'DD/MM/YYYY',
        language: 'en',
        defaultPageSize: 20,
        darkMode: false,
        autoRefresh: true
      },
      security: {
        requireMFA: false,
        sessionTimeout: 60,
        passwordExpiry: 90,
        ipWhitelist: {
          enabled: false,
          addresses: ''
        },
        apiRateLimit: {
          enabled: true,
          limit: 1000
        }
      },
      notifications: {
        email: {
          enabled: false,
          smtpServer: '',
          smtpPort: 587,
          username: '',
          password: '',
          fromEmail: ''
        },
        thresholds: {
          criticalVulns: 1,
          riskScore: 8.0
        },
        types: {
          newVulnerabilities: true,
          riskChanges: true,
          complianceChanges: true,
          systemAlerts: true
        }
      },
      scanning: {
        automated: {
          enabled: true,
          frequency: 'daily',
          time: '02:00'
        },
        timeout: 60,
        concurrentScans: 3,
        deepScan: false,
        autoRemediation: false
      }
    };

    // Override with database values
    settingsData.forEach(setting => {
      const keys = setting.key.split('.');
      let current = settings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      // Parse value based on type
      let value = setting.value;
      try {
        value = JSON.parse(setting.value);
      } catch (e) {
        // Keep as string if not valid JSON
      }
      
      current[keys[keys.length - 1]] = value;
    });

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/settings:
 *   put:
 *     summary: Update system settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SystemSettings'
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *       403:
 *         description: Insufficient permissions
 */
router.put('/', [
  authenticateToken,
  requirePermission('settings:update'),
  auditLog('UPDATE', 'SETTINGS'),
  body('general').optional().isObject(),
  body('security').optional().isObject(),
  body('notifications').optional().isObject(),
  body('scanning').optional().isObject()
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

    const settingsData = req.body;

    // Flatten the nested object to key-value pairs
    const flattenSettings = (obj, prefix = '') => {
      let result = [];
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const newKey = prefix ? `${prefix}.${key}` : key;
          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            result = result.concat(flattenSettings(obj[key], newKey));
          } else {
            result.push({
              key: newKey,
              value: JSON.stringify(obj[key]),
              category: prefix.split('.')[0] || key
            });
          }
        }
      }
      return result;
    };

    const flattenedSettings = flattenSettings(settingsData);

    // Update or create settings in database
    for (const setting of flattenedSettings) {
      await prisma.systemSetting.upsert({
        where: { key: setting.key },
        update: {
          value: setting.value,
          updatedById: req.user.id
        },
        create: {
          key: setting.key,
          value: setting.value,
          category: setting.category,
          createdById: req.user.id
        }
      });
    }

    res.json({
      success: true,
      message: 'Settings updated successfully'
    });

  } catch (error) {
    logger.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/settings/reset:
 *   post:
 *     summary: Reset settings to defaults
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings reset successfully
 *       403:
 *         description: Insufficient permissions
 */
router.post('/reset', [
  authenticateToken,
  requirePermission('settings:update'),
  auditLog('RESET', 'SETTINGS')
], async (req, res) => {
  try {
    // Delete all existing settings
    await prisma.systemSetting.deleteMany({});

    // Insert default settings
    const defaultSettings = [
      { key: 'general.organizationName', value: '""', category: 'general' },
      { key: 'general.timezone', value: '"UTC"', category: 'general' },
      { key: 'general.dateFormat', value: '"DD/MM/YYYY"', category: 'general' },
      { key: 'general.language', value: '"en"', category: 'general' },
      { key: 'general.defaultPageSize', value: '20', category: 'general' },
      { key: 'general.darkMode', value: 'false', category: 'general' },
      { key: 'general.autoRefresh', value: 'true', category: 'general' },
      { key: 'security.requireMFA', value: 'false', category: 'security' },
      { key: 'security.sessionTimeout', value: '60', category: 'security' },
      { key: 'security.passwordExpiry', value: '90', category: 'security' },
      { key: 'security.ipWhitelist.enabled', value: 'false', category: 'security' },
      { key: 'security.ipWhitelist.addresses', value: '""', category: 'security' },
      { key: 'security.apiRateLimit.enabled', value: 'true', category: 'security' },
      { key: 'security.apiRateLimit.limit', value: '1000', category: 'security' },
      { key: 'notifications.email.enabled', value: 'false', category: 'notifications' },
      { key: 'notifications.thresholds.criticalVulns', value: '1', category: 'notifications' },
      { key: 'notifications.thresholds.riskScore', value: '8.0', category: 'notifications' },
      { key: 'scanning.automated.enabled', value: 'true', category: 'scanning' },
      { key: 'scanning.automated.frequency', value: '"daily"', category: 'scanning' },
      { key: 'scanning.automated.time', value: '"02:00"', category: 'scanning' },
      { key: 'scanning.timeout', value: '60', category: 'scanning' },
      { key: 'scanning.concurrentScans', value: '3', category: 'scanning' },
      { key: 'scanning.deepScan', value: 'false', category: 'scanning' },
      { key: 'scanning.autoRemediation', value: 'false', category: 'scanning' }
    ];

    await prisma.systemSetting.createMany({
      data: defaultSettings.map(setting => ({
        ...setting,
        createdById: req.user.id
      }))
    });

    res.json({
      success: true,
      message: 'Settings reset to defaults successfully'
    });

  } catch (error) {
    logger.error('Reset settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/settings/test-email:
 *   post:
 *     summary: Test email configuration
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               smtpServer:
 *                 type: string
 *               smtpPort:
 *                 type: integer
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               fromEmail:
 *                 type: string
 *               testEmail:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email sent successfully
 *       400:
 *         description: Email configuration error
 */
router.post('/test-email', [
  authenticateToken,
  requirePermission('settings:update'),
  body('smtpServer').trim().isLength({ min: 1 }),
  body('smtpPort').isInt({ min: 1, max: 65535 }),
  body('username').trim().isLength({ min: 1 }),
  body('password').trim().isLength({ min: 1 }),
  body('fromEmail').isEmail(),
  body('testEmail').isEmail()
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

    const { smtpServer, smtpPort, username, password, fromEmail, testEmail } = req.body;

    // Create transporter
    const transporter = nodemailer.createTransporter({
      host: smtpServer,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: username,
        pass: password
      }
    });

    // Send test email
    await transporter.sendMail({
      from: fromEmail,
      to: testEmail,
      subject: 'CTEM System - Email Configuration Test',
      html: `
        <h2>Email Configuration Test</h2>
        <p>This is a test email to verify your SMTP configuration.</p>
        <p>If you receive this email, your email settings are configured correctly.</p>
        <hr>
        <p><small>Sent from CTEM System at ${new Date().toISOString()}</small></p>
      `
    });

    res.json({
      success: true,
      message: 'Test email sent successfully'
    });

  } catch (error) {
    logger.error('Test email error:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to send test email: ' + error.message
    });
  }
});

/**
 * @swagger
 * /api/settings/backup:
 *   post:
 *     summary: Create settings backup
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backup created successfully
 *       403:
 *         description: Insufficient permissions
 */
router.post('/backup', [
  authenticateToken,
  requirePermission('settings:backup')
], async (req, res) => {
  try {
    const settings = await prisma.systemSetting.findMany({
      select: {
        key: true,
        value: true,
        category: true
      }
    });

    const backup = {
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      settings: settings
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ctem-settings-backup-${new Date().toISOString().split('T')[0]}.json"`);
    res.json({
      success: true,
      data: backup
    });

  } catch (error) {
    logger.error('Backup settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/settings/restore:
 *   post:
 *     summary: Restore settings from backup
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               backup:
 *                 type: object
 *                 properties:
 *                   settings:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         key:
 *                           type: string
 *                         value:
 *                           type: string
 *                         category:
 *                           type: string
 *     responses:
 *       200:
 *         description: Settings restored successfully
 *       403:
 *         description: Insufficient permissions
 */
router.post('/restore', [
  authenticateToken,
  requirePermission('settings:restore'),
  auditLog('RESTORE', 'SETTINGS'),
  body('backup.settings').isArray()
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

    const { backup } = req.body;

    // Validate backup structure
    if (!backup.settings || !Array.isArray(backup.settings)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid backup format'
      });
    }

    // Delete existing settings
    await prisma.systemSetting.deleteMany({});

    // Restore settings from backup
    const settingsToRestore = backup.settings.map(setting => ({
      key: setting.key,
      value: setting.value,
      category: setting.category,
      createdById: req.user.id
    }));

    await prisma.systemSetting.createMany({
      data: settingsToRestore
    });

    res.json({
      success: true,
      message: `Settings restored successfully. ${settingsToRestore.length} settings imported.`
    });

  } catch (error) {
    logger.error('Restore settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/settings/system-info:
 *   get:
 *     summary: Get system information
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SystemInfo'
 */
router.get('/system-info', [
  authenticateToken,
  requirePermission('settings:read')
], async (req, res) => {
  try {
    const os = require('os');
    const { execSync } = require('child_process');

    // Get system information
    const uptime = process.uptime();
    const uptimeFormatted = formatUptime(uptime);

    // Get database version
    let dbVersion = 'Unknown';
    try {
      const result = await prisma.$queryRaw`SELECT version() as version`;
      dbVersion = result[0]?.version?.split(' ')[0] || 'PostgreSQL';
    } catch (error) {
      logger.warn('Could not get database version:', error);
    }

    // Get active users count
    const activeUsers = await prisma.user.count({
      where: {
        lastLoginAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    // System metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = Math.round((usedMemory / totalMemory) * 100);

    // CPU usage (simplified)
    const cpuUsage = Math.round(os.loadavg()[0] * 10);

    // Disk usage (simplified - would need proper implementation)
    const diskUsage = 45; // Placeholder

    const systemInfo = {
      version: process.env.npm_package_version || '1.0.0',
      build: process.env.BUILD_NUMBER || new Date().toISOString().split('T')[0],
      uptime: uptimeFormatted,
      database: dbVersion,
      cpuUsage: Math.min(cpuUsage, 100),
      memoryUsage,
      diskUsage,
      activeUsers,
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      totalMemory: Math.round(totalMemory / 1024 / 1024 / 1024), // GB
      freeMemory: Math.round(freeMemory / 1024 / 1024 / 1024), // GB
      cpuCount: os.cpus().length
    };

    res.json({
      success: true,
      data: systemInfo
    });

  } catch (error) {
    logger.error('Get system info error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}, ${hours} hour${hours > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}, ${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}

module.exports = router;