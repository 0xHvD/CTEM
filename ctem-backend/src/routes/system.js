const express = require('express');
const { query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const logger = require('../utils/logger');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * components:
 *   schemas:
 *     SystemInfo:
 *       type: object
 *       properties:
 *         version:
 *           type: string
 *         build:
 *           type: string
 *         uptime:
 *           type: string
 *         environment:
 *           type: string
 *         nodeVersion:
 *           type: string
 *         platform:
 *           type: string
 *         architecture:
 *           type: string
 *         hostname:
 *           type: string
 *         totalMemory:
 *           type: number
 *         freeMemory:
 *           type: number
 *         cpuCount:
 *           type: integer
 *         loadAverage:
 *           type: array
 *           items:
 *             type: number
 *     SystemHealth:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [healthy, warning, critical]
 *         database:
 *           type: object
 *           properties:
 *             status:
 *               type: string
 *             responseTime:
 *               type: number
 *             connections:
 *               type: integer
 *         redis:
 *           type: object
 *           properties:
 *             status:
 *               type: string
 *             responseTime:
 *               type: number
 *             memory:
 *               type: number
 *         disk:
 *           type: object
 *           properties:
 *             status:
 *               type: string
 *             usage:
 *               type: number
 *             free:
 *               type: number
 *             total:
 *               type: number
 *         memory:
 *           type: object
 *           properties:
 *             status:
 *               type: string
 *             usage:
 *               type: number
 *             free:
 *               type: number
 *             total:
 *               type: number
 *         cpu:
 *           type: object
 *           properties:
 *             status:
 *               type: string
 *             usage:
 *               type: number
 *             loadAverage:
 *               type: array
 *               items:
 *                 type: number
 *     SystemLog:
 *       type: object
 *       properties:
 *         timestamp:
 *           type: string
 *           format: date-time
 *         level:
 *           type: string
 *           enum: [error, warn, info, debug]
 *         message:
 *           type: string
 *         meta:
 *           type: object
 *         service:
 *           type: string
 */

/**
 * @swagger
 * /api/system/info:
 *   get:
 *     summary: Get system information
 *     tags: [System]
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
router.get('/info', [
  authenticateToken,
  requirePermission('system:read')
], async (req, res) => {
  try {
    const systemInfo = {
      // Application info
      version: process.env.npm_package_version || '1.0.0',
      build: process.env.BUILD_NUMBER || new Date().toISOString().split('T')[0],
      environment: process.env.NODE_ENV || 'development',
      
      // Node.js info
      nodeVersion: process.version,
      
      // System info
      platform: os.platform(),
      architecture: os.arch(),
      hostname: os.hostname(),
      
      // Memory info (in GB)
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100,
      freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100,
      
      // CPU info
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg(),
      
      // Process info
      uptime: formatUptime(process.uptime()),
      processUptime: process.uptime(),
      
      // Additional system stats
      cpuUsage: Math.round(os.loadavg()[0] * 100 / os.cpus().length),
      memoryUsage: Math.round((os.totalmem() - os.freemem()) / os.totalmem() * 100),
      
      // Database info
      databaseVersion: await getDatabaseVersion(),
      
      // Application metrics
      activeUsers: await getActiveUsersCount(),
      totalUsers: await getTotalUsersCount(),
      totalAssets: await getTotalAssetsCount(),
      totalVulnerabilities: await getTotalVulnerabilitiesCount(),
      totalRisks: await getTotalRisksCount()
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

/**
 * @swagger
 * /api/system/health:
 *   get:
 *     summary: Get system health status
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SystemHealth'
 */
router.get('/health', [
  authenticateToken,
  requirePermission('system:read')
], async (req, res) => {
  try {
    const healthChecks = await Promise.allSettled([
      checkDatabase(),
      checkRedis(),
      checkDisk(),
      checkMemory(),
      checkCPU()
    ]);

    const [databaseHealth, redisHealth, diskHealth, memoryHealth, cpuHealth] = healthChecks.map(result => 
      result.status === 'fulfilled' ? result.value : { status: 'critical', error: result.reason.message }
    );

    // Determine overall system status
    const allChecks = [databaseHealth, redisHealth, diskHealth, memoryHealth, cpuHealth];
    const criticalCount = allChecks.filter(check => check.status === 'critical').length;
    const warningCount = allChecks.filter(check => check.status === 'warning').length;
    
    let overallStatus = 'healthy';
    if (criticalCount > 0) {
      overallStatus = 'critical';
    } else if (warningCount > 0) {
      overallStatus = 'warning';
    }

    const systemHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: {
        database: databaseHealth,
        redis: redisHealth,
        disk: diskHealth,
        memory: memoryHealth,
        cpu: cpuHealth
      }
    };

    res.json({
      success: true,
      data: systemHealth
    });

  } catch (error) {
    logger.error('Get system health error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/system/logs:
 *   get:
 *     summary: Get system logs
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [error, warn, info, debug]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: service
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: System logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SystemLog'
 */
router.get('/logs', [
  authenticateToken,
  requirePermission('system:read'),
  query('level').optional().isIn(['error', 'warn', 'info', 'debug']),
  query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('service').optional().trim()
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
      level,
      limit = 100,
      startDate,
      endDate,
      service
    } = req.query;

    // Build where clause for log filtering
    const whereClause = {};

    if (level) {
      whereClause.level = level.toUpperCase();
    }

    if (startDate) {
      whereClause.timestamp = { gte: new Date(startDate) };
    }

    if (endDate) {
      whereClause.timestamp = { 
        ...whereClause.timestamp,
        lte: new Date(endDate) 
      };
    }

    if (service) {
      whereClause.service = { contains: service, mode: 'insensitive' };
    }

    // Get logs from database (if you're storing them there)
    // For now, we'll simulate reading from log files
    const logs = await getSystemLogs(whereClause, limit);

    res.json({
      success: true,
      data: logs
    });

  } catch (error) {
    logger.error('Get system logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/system/metrics:
 *   get:
 *     summary: Get system metrics
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: 24h
 *     responses:
 *       200:
 *         description: System metrics
 */
router.get('/metrics', [
  authenticateToken,
  requirePermission('system:read'),
  query('timeframe').optional().isIn(['1h', '24h', '7d', '30d'])
], async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;

    // Calculate time range
    const timeframes = {
      '1h': 1 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const startTime = new Date(Date.now() - timeframes[timeframe]);

    // Get metrics from database or monitoring system
    const metrics = await getSystemMetrics(startTime, timeframe);

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    logger.error('Get system metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/system/backup:
 *   post:
 *     summary: Create system backup
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backup initiated
 */
router.post('/backup', [
  authenticateToken,
  requirePermission('system:backup')
], async (req, res) => {
  try {
    const backupId = await initiateSystemBackup(req.user.id);

    res.json({
      success: true,
      data: {
        backupId,
        message: 'System backup initiated'
      }
    });

  } catch (error) {
    logger.error('Create system backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/system/maintenance:
 *   post:
 *     summary: Toggle maintenance mode
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Maintenance mode updated
 */
router.post('/maintenance', [
  authenticateToken,
  requirePermission('system:maintenance')
], async (req, res) => {
  try {
    const { enabled = false, message = 'System maintenance in progress' } = req.body;

    // Update maintenance mode setting
    await prisma.systemSetting.upsert({
      where: { key: 'system.maintenanceMode' },
      update: { 
        value: JSON.stringify({
          enabled,
          message,
          enabledAt: enabled ? new Date().toISOString() : null,
          enabledBy: enabled ? req.user.id : null
        })
      },
      create: {
        key: 'system.maintenanceMode',
        value: JSON.stringify({
          enabled,
          message,
          enabledAt: enabled ? new Date().toISOString() : null,
          enabledBy: enabled ? req.user.id : null
        }),
        category: 'system',
        createdById: req.user.id
      }
    });

    logger.info(`Maintenance mode ${enabled ? 'enabled' : 'disabled'} by ${req.user.name}`);

    res.json({
      success: true,
      data: {
        maintenanceMode: enabled,
        message
      }
    });

  } catch (error) {
    logger.error('Toggle maintenance mode error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/system/cache/clear:
 *   post:
 *     summary: Clear system cache
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 */
router.post('/cache/clear', [
  authenticateToken,
  requirePermission('system:maintenance')
], async (req, res) => {
  try {
    // Clear Redis cache
    const redis = require('../config/redis');
    await redis.flushall();

    logger.info(`System cache cleared by ${req.user.name}`);

    res.json({
      success: true,
      message: 'System cache cleared successfully'
    });

  } catch (error) {
    logger.error('Clear cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Helper functions

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

async function getDatabaseVersion() {
  try {
    const result = await prisma.$queryRaw`SELECT version() as version`;
    return result[0]?.version?.split(' ')[0] || 'Unknown';
  } catch (error) {
    logger.warn('Could not get database version:', error);
    return 'Unknown';
  }
}

async function getActiveUsersCount() {
  try {
    return await prisma.user.count({
      where: {
        lastLogin: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });
  } catch (error) {
    logger.warn('Could not get active users count:', error);
    return 0;
  }
}

async function getTotalUsersCount() {
  try {
    return await prisma.user.count();
  } catch (error) {
    logger.warn('Could not get total users count:', error);
    return 0;
  }
}

async function getTotalAssetsCount() {
  try {
    return await prisma.asset.count();
  } catch (error) {
    logger.warn('Could not get total assets count:', error);
    return 0;
  }
}

async function getTotalVulnerabilitiesCount() {
  try {
    return await prisma.vulnerability.count();
  } catch (error) {
    logger.warn('Could not get total vulnerabilities count:', error);
    return 0;
  }
}

async function getTotalRisksCount() {
  try {
    return await prisma.risk.count();
  } catch (error) {
    logger.warn('Could not get total risks count:', error);
    return 0;
  }
}

async function checkDatabase() {
  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;
    
    return {
      status: responseTime < 100 ? 'healthy' : responseTime < 500 ? 'warning' : 'critical',
      responseTime,
      message: `Database responding in ${responseTime}ms`
    };
  } catch (error) {
    return {
      status: 'critical',
      error: error.message,
      message: 'Database connection failed'
    };
  }
}

async function checkRedis() {
  try {
    const redis = require('../config/redis');
    const startTime = Date.now();
    await redis.ping();
    const responseTime = Date.now() - startTime;
    
    const info = await redis.info('memory');
    const memoryUsage = parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0');
    
    return {
      status: responseTime < 10 ? 'healthy' : responseTime < 50 ? 'warning' : 'critical',
      responseTime,
      memoryUsage,
      message: `Redis responding in ${responseTime}ms`
    };
  } catch (error) {
    return {
      status: 'critical',
      error: error.message,
      message: 'Redis connection failed'
    };
  }
}

async function checkDisk() {
  try {
    const stats = await fs.stat('./');
    // This is a simplified disk check - in production you'd use proper disk monitoring
    const totalSpace = 100 * 1024 * 1024 * 1024; // 100GB placeholder
    const freeSpace = 50 * 1024 * 1024 * 1024; // 50GB placeholder
    const usedSpace = totalSpace - freeSpace;
    const usage = (usedSpace / totalSpace) * 100;
    
    return {
      status: usage < 80 ? 'healthy' : usage < 90 ? 'warning' : 'critical',
      usage: Math.round(usage),
      free: Math.round(freeSpace / 1024 / 1024 / 1024),
      total: Math.round(totalSpace / 1024 / 1024 / 1024),
      message: `Disk usage: ${Math.round(usage)}%`
    };
  } catch (error) {
    return {
      status: 'critical',
      error: error.message,
      message: 'Disk check failed'
    };
  }
}

async function checkMemory() {
  try {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usage = (usedMemory / totalMemory) * 100;
    
    return {
      status: usage < 80 ? 'healthy' : usage < 90 ? 'warning' : 'critical',
      usage: Math.round(usage),
      free: Math.round(freeMemory / 1024 / 1024 / 1024),
      total: Math.round(totalMemory / 1024 / 1024 / 1024),
      message: `Memory usage: ${Math.round(usage)}%`
    };
  } catch (error) {
    return {
      status: 'critical',
      error: error.message,
      message: 'Memory check failed'
    };
  }
}

async function checkCPU() {
  try {
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    const usage = (loadAvg[0] / cpuCount) * 100;
    
    return {
      status: usage < 70 ? 'healthy' : usage < 90 ? 'warning' : 'critical',
      usage: Math.round(usage),
      loadAverage: loadAvg,
      cpuCount,
      message: `CPU usage: ${Math.round(usage)}%`
    };
  } catch (error) {
    return {
      status: 'critical',
      error: error.message,
      message: 'CPU check failed'
    };
  }
}

async function getSystemLogs(whereClause, limit) {
  // In a real implementation, you would read from actual log files or a logging service
  // For now, we'll return mock log data
  const mockLogs = [
    {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'System started successfully',
      service: 'system',
      meta: {}
    },
    {
      timestamp: new Date(Date.now() - 60000).toISOString(),
      level: 'warn',
      message: 'High memory usage detected',
      service: 'monitor',
      meta: { memoryUsage: 85 }
    },
    {
      timestamp: new Date(Date.now() - 120000).toISOString(),
      level: 'error',
      message: 'Database connection timeout',
      service: 'database',
      meta: { timeout: 5000 }
    }
  ];

  return mockLogs.slice(0, limit);
}

async function getSystemMetrics(startTime, timeframe) {
  // In a real implementation, you would fetch from a monitoring system
  // For now, we'll return mock metrics
  const dataPoints = timeframe === '1h' ? 12 : timeframe === '24h' ? 24 : timeframe === '7d' ? 7 : 30;
  const interval = timeframe === '1h' ? 5 * 60 * 1000 : timeframe === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  
  const metrics = {
    cpu: [],
    memory: [],
    disk: [],
    network: []
  };

  for (let i = 0; i < dataPoints; i++) {
    const timestamp = new Date(startTime.getTime() + i * interval).toISOString();
    
    metrics.cpu.push({
      timestamp,
      value: Math.random() * 100
    });
    
    metrics.memory.push({
      timestamp,
      value: 60 + Math.random() * 30
    });
    
    metrics.disk.push({
      timestamp,
      value: 40 + Math.random() * 20
    });
    
    metrics.network.push({
      timestamp,
      inbound: Math.random() * 1000,
      outbound: Math.random() * 800
    });
  }

  return metrics;
}

async function initiateSystemBackup(userId) {
  try {
    const backupId = require('uuid').v4();
    
    // Create backup record
    await prisma.systemBackup.create({
      data: {
        id: backupId,
        status: 'IN_PROGRESS',
        type: 'FULL',
        createdById: userId
      }
    });

    // Start backup process asynchronously
    performSystemBackup(backupId);

    return backupId;
  } catch (error) {
    throw new Error('Failed to initiate system backup');
  }
}

async function performSystemBackup(backupId) {
  try {
    // Simulate backup process
    logger.info(`Starting system backup: ${backupId}`);
    
    // In a real implementation, you would:
    // 1. Backup database
    // 2. Backup uploaded files
    // 3. Backup configuration
    // 4. Create archive
    
    await new Promise(resolve => setTimeout(resolve, 5000)); // Simulate backup time
    
    await prisma.systemBackup.update({
      where: { id: backupId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        size: Math.floor(Math.random() * 1000000000), // Random size
        location: `/backups/${backupId}.tar.gz`
      }
    });

    logger.info(`System backup completed: ${backupId}`);
  } catch (error) {
    logger.error(`System backup failed: ${backupId}`, error);
    
    await prisma.systemBackup.update({
      where: { id: backupId },
      data: {
        status: 'FAILED',
        error: error.message
      }
    });
  }
}

module.exports = router;