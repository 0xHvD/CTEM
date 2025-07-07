const express = require('express');
const { query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * components:
 *   schemas:
 *     DashboardStats:
 *       type: object
 *       properties:
 *         totalAssets:
 *           type: integer
 *         activeAssets:
 *           type: integer
 *         criticalVulnerabilities:
 *           type: integer
 *         highRiskAssets:
 *           type: integer
 *         averageRiskScore:
 *           type: number
 *         complianceScore:
 *           type: number
 *         recentAlerts:
 *           type: integer
 *         patchingEfficiency:
 *           type: number
 */

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DashboardStats'
 */
router.get('/stats', [
  authenticateToken,
  requirePermission('dashboard:read')
], async (req, res) => {
  try {
    // Get all dashboard statistics in parallel
    const [
      assetStats,
      vulnerabilityStats,
      riskStats,
      complianceStats,
      recentAlerts,
      patchingStats
    ] = await Promise.all([
      // Asset statistics
      Promise.all([
        prisma.asset.count(),
        prisma.asset.count({ where: { status: 'ACTIVE' } }),
        prisma.asset.aggregate({ _avg: { riskScore: true } }),
        prisma.asset.count({ where: { riskScore: { gte: 7.0 } } })
      ]),

      // Vulnerability statistics
      Promise.all([
        prisma.vulnerability.count({ where: { severity: 'CRITICAL' } }),
        prisma.vulnerability.count({ where: { severity: 'HIGH' } }),
        prisma.vulnerability.count({ where: { severity: 'MEDIUM' } }),
        prisma.vulnerability.count({ where: { severity: 'LOW' } }),
        prisma.assetVulnerability.count({ where: { status: 'OPEN' } }),
        prisma.assetVulnerability.count({ where: { status: 'MITIGATED' } }),
        prisma.vulnerability.aggregate({ _avg: { cvssScore: true } })
      ]),

      // Risk statistics
      Promise.all([
        prisma.risk.count(),
        prisma.risk.count({ where: { status: 'MITIGATED' } }),
        prisma.risk.aggregate({ _avg: { riskScore: true } })
      ]),

      // Compliance statistics
      Promise.all([
        prisma.complianceFramework.aggregate({
          _avg: { complianceScore: true }
        }),
        prisma.complianceFramework.count({ where: { status: 'ACTIVE' } })
      ]),

      // Recent alerts
      prisma.notification.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          },
          type: 'ALERT'
        }
      }),

      // Patching efficiency
      Promise.all([
        prisma.vulnerability.count({ where: { patchAvailable: true } }),
        prisma.assetVulnerability.count({
          where: {
            status: 'MITIGATED',
            vulnerability: { patchAvailable: true }
          }
        })
      ])
    ]);

    // Process stats
    const [totalAssets, activeAssets, avgRiskScore, highRiskAssets] = assetStats;
    const [criticalVulns, highVulns, mediumVulns, lowVulns, openVulns, mitigatedVulns, avgCvssScore] = vulnerabilityStats;
    const [totalRisks, mitigatedRisks, avgRiskScoreRisks] = riskStats;
    const [avgComplianceScore, activeFrameworks] = complianceStats;
    const [patchableVulns, patchedVulns] = patchingStats;

    const patchingEfficiency = patchableVulns > 0 ? (patchedVulns / patchableVulns) * 100 : 0;

    const dashboardStats = {
      totalAssets,
      activeAssets,
      criticalVulnerabilities: criticalVulns,
      highRiskAssets,
      averageRiskScore: Number((avgRiskScore._avg.riskScore || 0).toFixed(1)),
      complianceScore: Number((avgComplianceScore._avg.complianceScore || 0).toFixed(1)),
      recentAlerts,
      patchingEfficiency: Number(patchingEfficiency.toFixed(1))
    };

    res.json({
      success: true,
      data: dashboardStats
    });

  } catch (error) {
    logger.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/dashboard/trends/assets:
 *   get:
 *     summary: Get asset trends data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 */
router.get('/trends/assets', [
  authenticateToken,
  requirePermission('dashboard:read'),
  query('timeframe').optional().isIn(['7d', '30d', '90d'])
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

    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
    const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Get asset counts grouped by date
    const assetTrends = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as value
      FROM assets
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    res.json({
      success: true,
      data: assetTrends
    });

  } catch (error) {
    logger.error('Get asset trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/dashboard/trends/vulnerabilities:
 *   get:
 *     summary: Get vulnerability trends data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 */
router.get('/trends/vulnerabilities', [
  authenticateToken,
  requirePermission('dashboard:read'),
  query('timeframe').optional().isIn(['7d', '30d', '90d'])
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

    const { timeframe = '30d' } = req.query;
    
    const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const vulnerabilityTrends = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as value
      FROM vulnerabilities
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    res.json({
      success: true,
      data: vulnerabilityTrends
    });

  } catch (error) {
    logger.error('Get vulnerability trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/dashboard/trends/risks:
 *   get:
 *     summary: Get risk trends data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 */
router.get('/trends/risks', [
  authenticateToken,
  requirePermission('dashboard:read'),
  query('timeframe').optional().isIn(['7d', '30d', '90d'])
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

    const { timeframe = '30d' } = req.query;
    
    const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const riskTrends = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        AVG(risk_score) as value
      FROM risks
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    res.json({
      success: true,
      data: riskTrends
    });

  } catch (error) {
    logger.error('Get risk trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/dashboard/top-risks:
 *   get:
 *     summary: Get top risks for dashboard
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 5
 */
router.get('/top-risks', [
  authenticateToken,
  requirePermission('dashboard:read'),
  query('limit').optional().isInt({ min: 1, max: 20 }).toInt()
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

    const { limit = 5 } = req.query;

    const topRisks = await prisma.risk.findMany({
      take: limit,
      orderBy: { riskScore: 'desc' },
      where: {
        status: { not: 'MITIGATED' }
      },
      select: {
        id: true,
        title: true,
        description: true,
        riskScore: true,
        status: true,
        category: true,
        dueDate: true,
        owner: {
          select: { 
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            relatedAssets: true,
            relatedVulnerabilities: true
          }
        }
      }
    });

    const enrichedRisks = topRisks.map(risk => ({
      ...risk,
      isOverdue: risk.dueDate ? new Date(risk.dueDate) < new Date() : false,
      daysUntilDue: risk.dueDate ? Math.ceil((new Date(risk.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null,
      riskLevel: risk.riskScore >= 8 ? 'critical' : risk.riskScore >= 6 ? 'high' : risk.riskScore >= 4 ? 'medium' : 'low'
    }));

    res.json({
      success: true,
      data: enrichedRisks
    });

  } catch (error) {
    logger.error('Get top risks error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/dashboard/recent-vulnerabilities:
 *   get:
 *     summary: Get recent vulnerabilities for dashboard
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 10
 */
router.get('/recent-vulnerabilities', [
  authenticateToken,
  requirePermission('dashboard:read'),
  query('limit').optional().isInt({ min: 1, max: 20 }).toInt()
], async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const recentVulnerabilities = await prisma.vulnerability.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        cveId: true,
        title: true,
        severity: true,
        cvssScore: true,
        exploitAvailable: true,
        patchAvailable: true,
        createdAt: true,
        _count: {
          select: {
            affectedAssets: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: recentVulnerabilities
    });

  } catch (error) {
    logger.error('Get recent vulnerabilities error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/dashboard/activity-feed:
 *   get:
 *     summary: Get recent activity feed
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 */
router.get('/activity-feed', [
  authenticateToken,
  requirePermission('dashboard:read'),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
], async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const activities = await prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        changes: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: activities
    });

  } catch (error) {
    logger.error('Get activity feed error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/dashboard/compliance-summary:
 *   get:
 *     summary: Get compliance summary for dashboard
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get('/compliance-summary', [
  authenticateToken,
  requirePermission('dashboard:read')
], async (req, res) => {
  try {
    const frameworks = await prisma.complianceFramework.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        version: true,
        complianceScore: true,
        lastAssessedAt: true,
        _count: {
          select: {
            controls: true
          }
        },
        controls: {
          select: {
            status: true
          }
        }
      }
    });

    const summary = frameworks.map(framework => {
      const controlCounts = framework.controls.reduce((acc, control) => {
        acc[control.status] = (acc[control.status] || 0) + 1;
        return acc;
      }, {});

      return {
        id: framework.id,
        name: framework.name,
        version: framework.version,
        score: framework.complianceScore,
        lastAssessed: framework.lastAssessedAt,
        totalControls: framework._count.controls,
        implementedControls: controlCounts.IMPLEMENTED || 0,
        partialControls: controlCounts.PARTIAL || 0,
        notImplementedControls: controlCounts.NOT_IMPLEMENTED || 0
      };
    });

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    logger.error('Get compliance summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/dashboard/scan-summary:
 *   get:
 *     summary: Get scan summary for dashboard
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get('/scan-summary', [
  authenticateToken,
  requirePermission('dashboard:read')
], async (req, res) => {
  try {
    const [recentScans, scanStats] = await Promise.all([
      // Recent scans
      prisma.scanResult.findMany({
        take: 5,
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          scanType: true,
          status: true,
          startedAt: true,
          completedAt: true,
          findingsCount: true,
          asset: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),

      // Scan statistics
      Promise.all([
        prisma.scanResult.count({
          where: {
            status: 'COMPLETED',
            startedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        }),
        prisma.scanResult.count({
          where: {
            status: 'FAILED',
            startedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        }),
        prisma.scanResult.count({
          where: {
            status: 'IN_PROGRESS'
          }
        })
      ])
    ]);

    const [completedScans, failedScans, inProgressScans] = scanStats;

    res.json({
      success: true,
      data: {
        recentScans,
        stats: {
          completedThisWeek: completedScans,
          failedThisWeek: failedScans,
          inProgress: inProgressScans,
          successRate: (completedScans + failedScans) > 0 
            ? (completedScans / (completedScans + failedScans) * 100).toFixed(1) 
            : 100
        }
      }
    });

  } catch (error) {
    logger.error('Get scan summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;