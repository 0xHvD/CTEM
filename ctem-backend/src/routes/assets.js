const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
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
 *     Asset:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         type:
 *           type: string
 *           enum: [SERVER, WORKSTATION, NETWORK_DEVICE, APPLICATION, DATABASE, CLOUD_RESOURCE]
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, MAINTENANCE]
 *         criticality:
 *           type: string
 *           enum: [CRITICAL, HIGH, MEDIUM, LOW]
 *         ipAddress:
 *           type: string
 *         hostname:
 *           type: string
 *         operatingSystem:
 *           type: string
 *         version:
 *           type: string
 *         location:
 *           type: string
 *         owner:
 *           type: string
 *         department:
 *           type: string
 *         description:
 *           type: string
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         riskScore:
 *           type: number
 *           format: float
 *         lastSeen:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/assets:
 *   get:
 *     summary: Get all assets with filtering and pagination
 *     tags: [Assets]
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
 *         name: type
 *         schema:
 *           type: string
 *           enum: [SERVER, WORKSTATION, NETWORK_DEVICE, APPLICATION, DATABASE, CLOUD_RESOURCE]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, MAINTENANCE]
 *       - in: query
 *         name: criticality
 *         schema:
 *           type: string
 *           enum: [CRITICAL, HIGH, MEDIUM, LOW]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, type, status, criticality, riskScore, lastSeen, createdAt]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of assets
 */
router.get('/', [
  authenticateToken,
  requirePermission('assets:read'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().trim(),
  query('type').optional().isIn(['SERVER', 'WORKSTATION', 'NETWORK_DEVICE', 'APPLICATION', 'DATABASE', 'CLOUD_RESOURCE']),
  query('status').optional().isIn(['ACTIVE', 'INACTIVE', 'MAINTENANCE']),
  query('criticality').optional().isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  query('sortBy').optional().isIn(['name', 'type', 'status', 'criticality', 'riskScore', 'lastSeen', 'createdAt']),
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
      type,
      status,
      criticality,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { hostname: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
        { owner: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (type) where.type = type;
    if (status) where.status = status;
    if (criticality) where.criticality = criticality;

    // Get total count
    const total = await prisma.asset.count({ where });

    // Get assets
    const assets = await prisma.asset.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        vulnerabilities: {
          include: {
            vulnerability: {
              select: { id: true, severity: true, status: true }
            }
          }
        },
        _count: {
          select: {
            vulnerabilities: true,
            risks: true
          }
        }
      }
    });

    // Calculate vulnerability count for each asset
    const assetsWithStats = assets.map(asset => ({
      ...asset,
      vulnerabilityCount: asset.vulnerabilities.length,
      vulnerabilities: undefined, // Remove detailed vulnerabilities from response
      _count: undefined
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        assets: assetsWithStats,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('Get assets error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/assets/{id}:
 *   get:
 *     summary: Get asset by ID
 *     tags: [Assets]
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
 *         description: Asset details
 *       404:
 *         description: Asset not found
 */
router.get('/:id', [
  authenticateToken,
  requirePermission('assets:read'),
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

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        vulnerabilities: {
          include: {
            vulnerability: {
              select: {
                id: true,
                cveId: true,
                title: true,
                severity: true,
                cvssScore: true,
                publishedDate: true
              }
            }
          },
          orderBy: {
            vulnerability: {
              cvssScore: 'desc'
            }
          }
        },
        risks: {
          include: {
            risk: {
              select: {
                id: true,
                title: true,
                riskScore: true,
                status: true,
                dueDate: true
              }
            }
          }
        },
        scanResults: {
          orderBy: { startedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            scanType: true,
            status: true,
            startedAt: true,
            completedAt: true
          }
        }
      }
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    res.json({
      success: true,
      data: { asset }
    });

  } catch (error) {
    logger.error('Get asset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/assets:
 *   post:
 *     summary: Create new asset
 *     tags: [Assets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - owner
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [SERVER, WORKSTATION, NETWORK_DEVICE, APPLICATION, DATABASE, CLOUD_RESOURCE]
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, MAINTENANCE]
 *               criticality:
 *                 type: string
 *                 enum: [CRITICAL, HIGH, MEDIUM, LOW]
 *               ipAddress:
 *                 type: string
 *               hostname:
 *                 type: string
 *               operatingSystem:
 *                 type: string
 *               version:
 *                 type: string
 *               location:
 *                 type: string
 *               owner:
 *                 type: string
 *               department:
 *                 type: string
 *               description:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 */
router.post('/', [
  authenticateToken,
  requirePermission('assets:write'),
  body('name').trim().notEmpty().isLength({ max: 255 }),
  body('type').isIn(['SERVER', 'WORKSTATION', 'NETWORK_DEVICE', 'APPLICATION', 'DATABASE', 'CLOUD_RESOURCE']),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'MAINTENANCE']),
  body('criticality').optional().isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  body('ipAddress').optional().isIP(),
  body('hostname').optional().trim().isLength({ max: 255 }),
  body('operatingSystem').optional().trim().isLength({ max: 255 }),
  body('version').optional().trim().isLength({ max: 100 }),
  body('location').optional().trim().isLength({ max: 255 }),
  body('owner').trim().notEmpty().isLength({ max: 255 }),
  body('department').optional().trim().isLength({ max: 255 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('tags').optional().isArray(),
  body('tags.*').optional().trim().isLength({ max: 50 })
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

    const assetData = {
      ...req.body,
      createdById: req.user.id,
      tags: req.body.tags || [],
      status: req.body.status || 'ACTIVE',
      criticality: req.body.criticality || 'MEDIUM'
    };

    // Check for duplicate hostname or IP address
    if (assetData.hostname || assetData.ipAddress) {
      const existing = await prisma.asset.findFirst({
        where: {
          OR: [
            assetData.hostname ? { hostname: assetData.hostname } : {},
            assetData.ipAddress ? { ipAddress: assetData.ipAddress } : {}
          ].filter(condition => Object.keys(condition).length > 0)
        }
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Asset with this hostname or IP address already exists'
        });
      }
    }

    const asset = await prisma.asset.create({
      data: assetData,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    await auditLog(
      req.user.id,
      'ASSET_CREATED',
      'Asset',
      asset.id,
      null,
      assetData,
      req.ip,
      req.get('User-Agent')
    );

    res.status(201).json({
      success: true,
      message: 'Asset created successfully',
      data: { asset }
    });

  } catch (error) {
    logger.error('Create asset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/assets/{id}:
 *   put:
 *     summary: Update asset
 *     tags: [Assets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Asset'
 */
router.put('/:id', [
  authenticateToken,
  requirePermission('assets:write'),
  param('id').isUUID(),
  body('name').optional().trim().notEmpty().isLength({ max: 255 }),
  body('type').optional().isIn(['SERVER', 'WORKSTATION', 'NETWORK_DEVICE', 'APPLICATION', 'DATABASE', 'CLOUD_RESOURCE']),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'MAINTENANCE']),
  body('criticality').optional().isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  body('ipAddress').optional().isIP(),
  body('hostname').optional().trim().isLength({ max: 255 }),
  body('operatingSystem').optional().trim().isLength({ max: 255 }),
  body('version').optional().trim().isLength({ max: 100 }),
  body('location').optional().trim().isLength({ max: 255 }),
  body('owner').optional().trim().notEmpty().isLength({ max: 255 }),
  body('department').optional().trim().isLength({ max: 255 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('tags').optional().isArray(),
  body('tags.*').optional().trim().isLength({ max: 50 }),
  body('riskScore').optional().isFloat({ min: 0, max: 10 })
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

    // Get current asset for audit log
    const currentAsset = await prisma.asset.findUnique({
      where: { id }
    });

    if (!currentAsset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    // Check for duplicate hostname or IP address (excluding current asset)
    if (req.body.hostname || req.body.ipAddress) {
      const existing = await prisma.asset.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                req.body.hostname ? { hostname: req.body.hostname } : {},
                req.body.ipAddress ? { ipAddress: req.body.ipAddress } : {}
              ].filter(condition => Object.keys(condition).length > 0)
            }
          ]
        }
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Asset with this hostname or IP address already exists'
        });
      }
    }

    const updateData = { ...req.body };
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.createdById;

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    await auditLog(
      req.user.id,
      'ASSET_UPDATED',
      'Asset',
      asset.id,
      currentAsset,
      updateData,
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      message: 'Asset updated successfully',
      data: { asset }
    });

  } catch (error) {
    logger.error('Update asset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/assets/{id}:
 *   delete:
 *     summary: Delete asset
 *     tags: [Assets]
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
 *         description: Asset deleted successfully
 *       404:
 *         description: Asset not found
 */
router.delete('/:id', [
  authenticateToken,
  requirePermission('assets:delete'),
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

    // Check if asset exists
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            vulnerabilities: true,
            risks: true,
            scanResults: true
          }
        }
      }
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    // Check if asset has dependencies
    const hasVulnerabilities = asset._count.vulnerabilities > 0;
    const hasRisks = asset._count.risks > 0;
    const hasScanResults = asset._count.scanResults > 0;

    if (hasVulnerabilities || hasRisks || hasScanResults) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete asset with existing vulnerabilities, risks, or scan results',
        details: {
          vulnerabilities: asset._count.vulnerabilities,
          risks: asset._count.risks,
          scanResults: asset._count.scanResults
        }
      });
    }

    await prisma.asset.delete({
      where: { id }
    });

    await auditLog(
      req.user.id,
      'ASSET_DELETED',
      'Asset',
      id,
      asset,
      null,
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      message: 'Asset deleted successfully'
    });

  } catch (error) {
    logger.error('Delete asset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/assets/stats:
 *   get:
 *     summary: Get asset statistics
 *     tags: [Assets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Asset statistics
 */
router.get('/stats', [
  authenticateToken,
  requirePermission('assets:read')
], async (req, res) => {
  try {
    const [
      total,
      byStatus,
      byType,
      byCriticality,
      averageRiskScore,
      recentAssets
    ] = await Promise.all([
      // Total count
      prisma.asset.count(),
      
      // Count by status
      prisma.asset.groupBy({
        by: ['status'],
        _count: { status: true }
      }),
      
      // Count by type
      prisma.asset.groupBy({
        by: ['type'],
        _count: { type: true }
      }),
      
      // Count by criticality
      prisma.asset.groupBy({
        by: ['criticality'],
        _count: { criticality: true }
      }),
      
      // Average risk score
      prisma.asset.aggregate({
        _avg: { riskScore: true }
      }),
      
      // Recent assets (last 7 days)
      prisma.asset.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    const stats = {
      total,
      active: byStatus.find(s => s.status === 'ACTIVE')?._count?.status || 0,
      inactive: byStatus.find(s => s.status === 'INACTIVE')?._count?.status || 0,
      maintenance: byStatus.find(s => s.status === 'MAINTENANCE')?._count?.status || 0,
      critical: byCriticality.find(c => c.criticality === 'CRITICAL')?._count?.criticality || 0,
      high: byCriticality.find(c => c.criticality === 'HIGH')?._count?.criticality || 0,
      medium: byCriticality.find(c => c.criticality === 'MEDIUM')?._count?.criticality || 0,
      low: byCriticality.find(c => c.criticality === 'LOW')?._count?.criticality || 0,
      averageRiskScore: averageRiskScore._avg.riskScore || 0,
      recentAssets,
      byType: byType.map(t => ({
        type: t.type,
        count: t._count.type
      })),
      byStatus: byStatus.map(s => ({
        status: s.status,
        count: s._count.status
      })),
      byCriticality: byCriticality.map(c => ({
        criticality: c.criticality,
        count: c._count.criticality
      }))
    };

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    logger.error('Get asset stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/assets/{id}/vulnerabilities:
 *   get:
 *     summary: Get vulnerabilities for specific asset
 *     tags: [Assets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:id/vulnerabilities', [
  authenticateToken,
  requirePermission('assets:read'),
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

    // Check if asset exists
    const asset = await prisma.asset.findUnique({
      where: { id },
      select: { id: true, name: true }
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    const vulnerabilities = await prisma.assetVulnerability.findMany({
      where: { assetId: id },
      include: {
        vulnerability: {
          select: {
            id: true,
            cveId: true,
            title: true,
            description: true,
            severity: true,
            cvssScore: true,
            cvssVector: true,
            category: true,
            publishedDate: true,
            lastModifiedDate: true,
            exploitAvailable: true,
            patchAvailable: true,
            solution: true,
            references: true
          }
        }
      },
      orderBy: {
        vulnerability: {
          cvssScore: 'desc'
        }
      }
    });

    res.json({
      success: true,
      data: {
        asset,
        vulnerabilities: vulnerabilities.map(av => ({
          ...av.vulnerability,
          assetVulnerabilityId: av.id,
          status: av.status,
          firstDetected: av.firstDetected,
          lastDetected: av.lastDetected,
          notes: av.notes
        }))
      }
    });

  } catch (error) {
    logger.error('Get asset vulnerabilities error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;