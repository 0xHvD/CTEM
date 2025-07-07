const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');
const logger = require('../utils/logger');
const cron = require('cron');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const prisma = new PrismaClient();

// Store for tracking scan progress
const scanProgress = new Map();
const activeScanJobs = new Map();

/**
 * @swagger
 * components:
 *   schemas:
 *     ScanResult:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         scanType:
 *           type: string
 *           enum: [network, vulnerability, compliance, full]
 *         status:
 *           type: string
 *           enum: [pending, running, completed, failed, cancelled]
 *         startedAt:
 *           type: string
 *           format: date-time
 *         completedAt:
 *           type: string
 *           format: date-time
 *         duration:
 *           type: integer
 *         progress:
 *           type: integer
 *         findingsCount:
 *           type: integer
 *         assetsScanned:
 *           type: integer
 *         vulnerabilitiesFound:
 *           type: integer
 *         criticalFindings:
 *           type: integer
 *         highFindings:
 *           type: integer
 *         mediumFindings:
 *           type: integer
 *         lowFindings:
 *           type: integer
 *         asset:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             name:
 *               type: string
 *         configuration:
 *           type: object
 *         findings:
 *           type: array
 *           items:
 *             type: object
 *         error:
 *           type: string
 *         createdBy:
 *           type: string
 *     ScanConfiguration:
 *       type: object
 *       properties:
 *         scanType:
 *           type: string
 *           enum: [network, vulnerability, compliance, full]
 *         targets:
 *           type: array
 *           items:
 *             type: string
 *         assetIds:
 *           type: array
 *           items:
 *             type: string
 *         deepScan:
 *           type: boolean
 *         skipPorts:
 *           type: array
 *           items:
 *             type: integer
 *         includePorts:
 *           type: array
 *           items:
 *             type: integer
 *         timeout:
 *           type: integer
 *         maxConcurrent:
 *           type: integer
 *         schedule:
 *           type: object
 *           properties:
 *             enabled:
 *               type: boolean
 *             frequency:
 *               type: string
 *               enum: [daily, weekly, monthly]
 *             time:
 *               type: string
 *             dayOfWeek:
 *               type: integer
 *             dayOfMonth:
 *               type: integer
 */

/**
 * @swagger
 * /api/scan/start:
 *   post:
 *     summary: Start a new scan
 *     tags: [Scanning]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScanConfiguration'
 *     responses:
 *       201:
 *         description: Scan started successfully
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
 *                     scanId:
 *                       type: string
 */
router.post('/start', [
  authenticateToken,
  requirePermission('scans:create'),
  auditLog('START', 'SCAN'),
  body('scanType').isIn(['network', 'vulnerability', 'compliance', 'full']),
  body('targets').optional().isArray(),
  body('assetIds').optional().isArray(),
  body('deepScan').optional().isBoolean(),
  body('timeout').optional().isInt({ min: 30, max: 3600 }),
  body('maxConcurrent').optional().isInt({ min: 1, max: 10 })
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
      scanType,
      targets = [],
      assetIds = [],
      deepScan = false,
      timeout = 300,
      maxConcurrent = 3
    } = req.body;

    // Validate that we have targets or assets
    if (targets.length === 0 && assetIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Either targets or assetIds must be provided'
      });
    }

    // Check concurrent scan limit
    const runningScanCount = await prisma.scanResult.count({
      where: {
        status: { in: ['PENDING', 'RUNNING'] }
      }
    });

    const maxConcurrentScans = await getSystemSetting('scanning.concurrentScans', 3);
    if (runningScanCount >= maxConcurrentScans) {
      return res.status(429).json({
        success: false,
        message: 'Maximum concurrent scans reached. Please wait for existing scans to complete.'
      });
    }

    // Create scan record
    const scanResult = await prisma.scanResult.create({
      data: {
        scanType: scanType.toUpperCase(),
        status: 'PENDING',
        configuration: {
          targets,
          assetIds,
          deepScan,
          timeout,
          maxConcurrent
        },
        createdById: req.user.id
      }
    });

    // Start scan asynchronously
    startScanAsync(scanResult.id, scanType, {
      targets,
      assetIds,
      deepScan,
      timeout,
      maxConcurrent
    });

    res.status(201).json({
      success: true,
      data: {
        scanId: scanResult.id
      },
      message: 'Scan started successfully'
    });

  } catch (error) {
    logger.error('Start scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/scan/{id}/status:
 *   get:
 *     summary: Get scan status
 *     tags: [Scanning]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/status', [
  authenticateToken,
  requirePermission('scans:read'),
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

    const scan = await prisma.scanResult.findUnique({
      where: { id },
      include: {
        asset: {
          select: {
            id: true,
            name: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found'
      });
    }

    // Add real-time progress information
    const enrichedScan = {
      ...scan,
      progress: scanProgress.get(id) || 0,
      status: scan.status.toLowerCase(),
      scanType: scan.scanType.toLowerCase()
    };

    res.json({
      success: true,
      data: enrichedScan
    });

  } catch (error) {
    logger.error('Get scan status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/scan/history:
 *   get:
 *     summary: Get scan history
 *     tags: [Scanning]
 *     security:
 *       - bearerAuth: []
 */
router.get('/history', [
  authenticateToken,
  requirePermission('scans:read'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('scanType').optional().isIn(['network', 'vulnerability', 'compliance', 'full']),
  query('status').optional().isIn(['pending', 'running', 'completed', 'failed', 'cancelled']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('assetId').optional().isUUID()
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
      scanType,
      status,
      startDate,
      endDate,
      assetId
    } = req.query;

    // Build where clause
    const whereClause = {};

    if (scanType) {
      whereClause.scanType = scanType.toUpperCase();
    }

    if (status) {
      whereClause.status = status.toUpperCase();
    }

    if (startDate || endDate) {
      whereClause.startedAt = {};
      if (startDate) {
        whereClause.startedAt.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.startedAt.lte = new Date(endDate);
      }
    }

    if (assetId) {
      whereClause.assetId = assetId;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    const [scans, total] = await Promise.all([
      prisma.scanResult.findMany({
        where: whereClause,
        include: {
          asset: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.scanResult.count({ where: whereClause })
    ]);

    // Add progress information for running scans
    const enrichedScans = scans.map(scan => ({
      ...scan,
      progress: scanProgress.get(scan.id) || 0,
      status: scan.status.toLowerCase(),
      scanType: scan.scanType.toLowerCase()
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        scans: enrichedScans,
        total,
        page,
        totalPages
      }
    });

  } catch (error) {
    logger.error('Get scan history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/scan/{id}/cancel:
 *   post:
 *     summary: Cancel a running scan
 *     tags: [Scanning]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/cancel', [
  authenticateToken,
  requirePermission('scans:update'),
  auditLog('CANCEL', 'SCAN'),
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

    const scan = await prisma.scanResult.findUnique({
      where: { id }
    });

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found'
      });
    }

    if (!['PENDING', 'RUNNING'].includes(scan.status)) {
      return res.status(400).json({
        success: false,
        message: 'Scan cannot be cancelled'
      });
    }

    // Cancel the scan job if it exists
    const scanJob = activeScanJobs.get(id);
    if (scanJob) {
      scanJob.cancelled = true;
      activeScanJobs.delete(id);
    }

    // Update scan status
    await prisma.scanResult.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        error: 'Cancelled by user'
      }
    });

    // Clean up progress tracking
    scanProgress.delete(id);

    res.json({
      success: true,
      message: 'Scan cancelled successfully'
    });

  } catch (error) {
    logger.error('Cancel scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/scan/{id}/results:
 *   get:
 *     summary: Get detailed scan results
 *     tags: [Scanning]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/results', [
  authenticateToken,
  requirePermission('scans:read'),
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

    const scan = await prisma.scanResult.findUnique({
      where: { id },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found'
      });
    }

    if (scan.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Scan results not available yet'
      });
    }

    res.json({
      success: true,
      data: {
        ...scan,
        status: scan.status.toLowerCase(),
        scanType: scan.scanType.toLowerCase()
      }
    });

  } catch (error) {
    logger.error('Get scan results error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/scan/stats:
 *   get:
 *     summary: Get scan statistics
 *     tags: [Scanning]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', [
  authenticateToken,
  requirePermission('scans:read'),
  query('timeframe').optional().isIn(['24h', '7d', '30d', '90d'])
], async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;

    // Calculate date range
    const timeframes = {
      '24h': 1 * 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000
    };

    const startDate = new Date(Date.now() - timeframes[timeframe]);

    const [
      totalScans,
      completedScans,
      failedScans,
      scansByType,
      scansByStatus,
      avgScanDuration,
      totalVulnerabilities,
      criticalVulnerabilities
    ] = await Promise.all([
      prisma.scanResult.count({
        where: {
          startedAt: { gte: startDate }
        }
      }),
      prisma.scanResult.count({
        where: {
          startedAt: { gte: startDate },
          status: 'COMPLETED'
        }
      }),
      prisma.scanResult.count({
        where: {
          startedAt: { gte: startDate },
          status: 'FAILED'
        }
      }),
      prisma.scanResult.groupBy({
        by: ['scanType'],
        _count: true,
        where: {
          startedAt: { gte: startDate }
        }
      }),
      prisma.scanResult.groupBy({
        by: ['status'],
        _count: true,
        where: {
          startedAt: { gte: startDate }
        }
      }),
      prisma.scanResult.aggregate({
        _avg: { duration: true },
        where: {
          startedAt: { gte: startDate },
          status: 'COMPLETED'
        }
      }),
      prisma.scanResult.aggregate({
        _sum: { vulnerabilitiesFound: true },
        where: {
          startedAt: { gte: startDate },
          status: 'COMPLETED'
        }
      }),
      prisma.scanResult.aggregate({
        _sum: { criticalFindings: true },
        where: {
          startedAt: { gte: startDate },
          status: 'COMPLETED'
        }
      })
    ]);

    const successRate = totalScans > 0 ? Math.round((completedScans / totalScans) * 100) : 0;

    const typeStats = scansByType.reduce((acc, item) => {
      acc[item.scanType.toLowerCase()] = item._count;
      return acc;
    }, {});

    const statusStats = scansByStatus.reduce((acc, item) => {
      acc[item.status.toLowerCase()] = item._count;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalScans,
        completedScans,
        failedScans,
        successRate,
        avgScanDuration: Math.round(avgScanDuration._avg.duration || 0),
        totalVulnerabilities: totalVulnerabilities._sum.vulnerabilitiesFound || 0,
        criticalVulnerabilities: criticalVulnerabilities._sum.criticalFindings || 0,
        typeStats,
        statusStats
      }
    });

  } catch (error) {
    logger.error('Get scan statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/scan/schedule:
 *   post:
 *     summary: Schedule recurring scans
 *     tags: [Scanning]
 *     security:
 *       - bearerAuth: []
 */
router.post('/schedule', [
  authenticateToken,
  requirePermission('scans:create'),
  auditLog('SCHEDULE', 'SCAN'),
  body('name').trim().isLength({ min: 1, max: 200 }),
  body('scanType').isIn(['network', 'vulnerability', 'compliance', 'full']),
  body('schedule.enabled').isBoolean(),
  body('schedule.frequency').isIn(['daily', 'weekly', 'monthly']),
  body('schedule.time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('targets').optional().isArray(),
  body('assetIds').optional().isArray()
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
      scanType,
      schedule,
      targets = [],
      assetIds = [],
      deepScan = false,
      timeout = 300
    } = req.body;

    // Create scheduled scan configuration
    const scheduledScan = await prisma.scheduledScan.create({
      data: {
        name,
        scanType: scanType.toUpperCase(),
        enabled: schedule.enabled,
        frequency: schedule.frequency,
        time: schedule.time || '02:00',
        dayOfWeek: schedule.dayOfWeek,
        dayOfMonth: schedule.dayOfMonth,
        configuration: {
          targets,
          assetIds,
          deepScan,
          timeout
        },
        createdById: req.user.id
      }
    });

    // Set up cron job if enabled
    if (schedule.enabled) {
      setupScheduledScan(scheduledScan);
    }

    res.status(201).json({
      success: true,
      data: scheduledScan,
      message: 'Scan scheduled successfully'
    });

  } catch (error) {
    logger.error('Schedule scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/scan/scheduled:
 *   get:
 *     summary: Get scheduled scans
 *     tags: [Scanning]
 *     security:
 *       - bearerAuth: []
 */
router.get('/scheduled', [
  authenticateToken,
  requirePermission('scans:read')
], async (req, res) => {
  try {
    const scheduledScans = await prisma.scheduledScan.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: scheduledScans
    });

  } catch (error) {
    logger.error('Get scheduled scans error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Helper functions

async function startScanAsync(scanId, scanType, config) {
  try {
    // Create scan job object
    const scanJob = {
      id: scanId,
      cancelled: false,
      startTime: new Date()
    };

    activeScanJobs.set(scanId, scanJob);

    // Update scan status to running
    await prisma.scanResult.update({
      where: { id: scanId },
      data: {
        status: 'RUNNING',
        startedAt: new Date()
      }
    });

    // Initialize progress
    scanProgress.set(scanId, 0);

    // Simulate scan execution
    const results = await executeScan(scanId, scanType, config, scanJob);

    // Check if scan was cancelled
    if (scanJob.cancelled) {
      return;
    }

    // Calculate duration
    const duration = Math.floor((new Date() - scanJob.startTime) / 1000);

    // Update scan as completed
    await prisma.scanResult.update({
      where: { id: scanId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        duration,
        findingsCount: results.findings.length,
        assetsScanned: results.assetsScanned,
        vulnerabilitiesFound: results.vulnerabilitiesFound,
        criticalFindings: results.criticalFindings,
        highFindings: results.highFindings,
        mediumFindings: results.mediumFindings,
        lowFindings: results.lowFindings,
        findings: results.findings
      }
    });

    // Clean up
    activeScanJobs.delete(scanId);
    scanProgress.delete(scanId);

    logger.info(`Scan ${scanId} completed successfully`);

  } catch (error) {
    logger.error(`Scan ${scanId} failed:`, error);

    await prisma.scanResult.update({
      where: { id: scanId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        error: error.message
      }
    });

    // Clean up
    activeScanJobs.delete(scanId);
    scanProgress.delete(scanId);
  }
}

async function executeScan(scanId, scanType, config, scanJob) {
  const results = {
    findings: [],
    assetsScanned: 0,
    vulnerabilitiesFound: 0,
    criticalFindings: 0,
    highFindings: 0,
    mediumFindings: 0,
    lowFindings: 0
  };

  // Get targets (assets or IP addresses)
  const targets = await getTargets(config);
  const totalTargets = targets.length;

  for (let i = 0; i < totalTargets; i++) {
    // Check if scan was cancelled
    if (scanJob.cancelled) {
      throw new Error('Scan was cancelled');
    }

    const target = targets[i];
    const progress = Math.floor((i / totalTargets) * 100);
    scanProgress.set(scanId, progress);

    // Simulate scanning delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Execute scan based on type
    const targetResults = await scanTarget(target, scanType, config);
    
    // Aggregate results
    results.findings.push(...targetResults.findings);
    results.assetsScanned++;
    results.vulnerabilitiesFound += targetResults.vulnerabilitiesFound;
    results.criticalFindings += targetResults.criticalFindings;
    results.highFindings += targetResults.highFindings;
    results.mediumFindings += targetResults.mediumFindings;
    results.lowFindings += targetResults.lowFindings;
  }

  // Final progress
  scanProgress.set(scanId, 100);

  return results;
}

async function getTargets(config) {
  const targets = [];

  // Add IP/hostname targets
  if (config.targets && config.targets.length > 0) {
    targets.push(...config.targets.map(target => ({ type: 'ip', value: target })));
  }

  // Add asset targets
  if (config.assetIds && config.assetIds.length > 0) {
    const assets = await prisma.asset.findMany({
      where: {
        id: { in: config.assetIds }
      },
      select: {
        id: true,
        name: true,
        ipAddress: true,
        hostname: true
      }
    });

    targets.push(...assets.map(asset => ({
      type: 'asset',
      value: asset.ipAddress || asset.hostname || asset.name,
      assetId: asset.id
    })));
  }

  return targets;
}

async function scanTarget(target, scanType, config) {
  // This is a simulation of actual scanning
  // In a real implementation, you would integrate with actual scanning tools
  
  const results = {
    findings: [],
    vulnerabilitiesFound: 0,
    criticalFindings: 0,
    highFindings: 0,
    mediumFindings: 0,
    lowFindings: 0
  };

  // Simulate different scan types
  switch (scanType) {
    case 'network':
      return await performNetworkScan(target, config);
    case 'vulnerability':
      return await performVulnerabilityScan(target, config);
    case 'compliance':
      return await performComplianceScan(target, config);
    case 'full':
      const networkResults = await performNetworkScan(target, config);
      const vulnResults = await performVulnerabilityScan(target, config);
      const complianceResults = await performComplianceScan(target, config);
      
      // Combine all results
      results.findings.push(...networkResults.findings, ...vulnResults.findings, ...complianceResults.findings);
      results.vulnerabilitiesFound = networkResults.vulnerabilitiesFound + vulnResults.vulnerabilitiesFound + complianceResults.vulnerabilitiesFound;
      results.criticalFindings = networkResults.criticalFindings + vulnResults.criticalFindings + complianceResults.criticalFindings;
      results.highFindings = networkResults.highFindings + vulnResults.highFindings + complianceResults.highFindings;
      results.mediumFindings = networkResults.mediumFindings + vulnResults.mediumFindings + complianceResults.mediumFindings;
      results.lowFindings = networkResults.lowFindings + vulnResults.lowFindings + complianceResults.lowFindings;
      
      return results;
    default:
      throw new Error(`Unsupported scan type: ${scanType}`);
  }
}

async function performNetworkScan(target, config) {
  // Simulate network scanning
  const findings = [];
  const openPorts = [22, 80, 443, 3389]; // Simulated open ports
  
  openPorts.forEach(port => {
    findings.push({
      type: 'network',
      severity: 'info',
      title: `Open Port ${port}`,
      description: `Port ${port} is open on ${target.value}`,
      target: target.value,
      port: port,
      protocol: 'tcp'
    });
  });

  return {
    findings,
    vulnerabilitiesFound: 0,
    criticalFindings: 0,
    highFindings: 0,
    mediumFindings: 0,
    lowFindings: findings.length
  };
}

async function performVulnerabilityScan(target, config) {
  // Simulate vulnerability scanning
  const findings = [];
  
  // Simulate some vulnerabilities
  const vulnerabilities = [
    { severity: 'critical', title: 'Remote Code Execution', cve: 'CVE-2024-1234' },
    { severity: 'high', title: 'SQL Injection', cve: 'CVE-2024-5678' },
    { severity: 'medium', title: 'Cross-Site Scripting', cve: 'CVE-2024-9012' }
  ];

  // Randomly select some vulnerabilities
  const selectedVulns = vulnerabilities.filter(() => Math.random() > 0.7);
  
  selectedVulns.forEach(vuln => {
    findings.push({
      type: 'vulnerability',
      severity: vuln.severity,
      title: vuln.title,
      description: `${vuln.title} vulnerability found on ${target.value}`,
      target: target.value,
      cve: vuln.cve,
      cvssScore: vuln.severity === 'critical' ? 9.0 : vuln.severity === 'high' ? 7.5 : 5.0
    });
  });

  const criticalFindings = findings.filter(f => f.severity === 'critical').length;
  const highFindings = findings.filter(f => f.severity === 'high').length;
  const mediumFindings = findings.filter(f => f.severity === 'medium').length;

  return {
    findings,
    vulnerabilitiesFound: findings.length,
    criticalFindings,
    highFindings,
    mediumFindings,
    lowFindings: 0
  };
}

async function performComplianceScan(target, config) {
  // Simulate compliance scanning
  const findings = [];
  
  // Simulate compliance checks
  const complianceChecks = [
    { severity: 'high', title: 'Password Policy Violation', framework: 'ISO 27001' },
    { severity: 'medium', title: 'Encryption Not Enabled', framework: 'NIST' },
    { severity: 'low', title: 'Audit Logging Disabled', framework: 'SOC 2' }
  ];

  // Randomly select some compliance issues
  const selectedChecks = complianceChecks.filter(() => Math.random() > 0.6);
  
  selectedChecks.forEach(check => {
    findings.push({
      type: 'compliance',
      severity: check.severity,
      title: check.title,
      description: `${check.title} detected on ${target.value}`,
      target: target.value,
      framework: check.framework
    });
  });

  const criticalFindings = findings.filter(f => f.severity === 'critical').length;
  const highFindings = findings.filter(f => f.severity === 'high').length;
  const mediumFindings = findings.filter(f => f.severity === 'medium').length;
  const lowFindings = findings.filter(f => f.severity === 'low').length;

  return {
    findings,
    vulnerabilitiesFound: findings.length,
    criticalFindings,
    highFindings,
    mediumFindings,
    lowFindings
  };
}

async function getSystemSetting(key, defaultValue) {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key }
    });
    return setting ? JSON.parse(setting.value) : defaultValue;
  } catch (error) {
    logger.warn(`Failed to get system setting ${key}:`, error);
    return defaultValue;
  }
}

function setupScheduledScan(scheduledScan) {
  // In a real implementation, you would set up proper cron jobs
  // For now, we'll just log the scheduled scan
  logger.info(`Scheduled scan setup: ${scheduledScan.name} (${scheduledScan.id})`);
  
  // Example cron pattern generation
  const { frequency, time, dayOfWeek, dayOfMonth } = scheduledScan;
  const [hours, minutes] = time.split(':').map(Number);
  
  let cronPattern;
  switch (frequency) {
    case 'daily':
      cronPattern = `${minutes} ${hours} * * *`;
      break;
    case 'weekly':
      cronPattern = `${minutes} ${hours} * * ${dayOfWeek || 1}`;
      break;
    case 'monthly':
      cronPattern = `${minutes} ${hours} ${dayOfMonth || 1} * *`;
      break;
    default:
      cronPattern = `${minutes} ${hours} * * *`;
  }
  
  logger.info(`Cron pattern for ${scheduledScan.name}: ${cronPattern}`);
}

module.exports = router;