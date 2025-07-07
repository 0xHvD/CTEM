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
 *     Vulnerability:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         cveId:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         severity:
 *           type: string
 *           enum: [CRITICAL, HIGH, MEDIUM, LOW, INFO]
 *         cvssScore:
 *           type: number
 *           format: float
 *         cvssVector:
 *           type: string
 *         category:
 *           type: string
 *         publishedDate:
 *           type: string
 *           format: date-time
 *         lastModifiedDate:
 *           type: string
 *           format: date-time
 *         solution:
 *           type: string
 *         references:
 *           type: array
 *           items:
 *             type: string
 *         exploitAvailable:
 *           type: boolean
 *         patchAvailable:
 *           type: boolean
 */

/**
 * @swagger
 * /api/vulnerabilities:
 *   get:
 *     summary: Get all vulnerabilities with filtering and pagination
 *     tags: [Vulnerabilities]
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
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [CRITICAL, HIGH, MEDIUM, LOW, INFO]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, INVESTIGATING, MITIGATED, FALSE_POSITIVE, RISK_ACCEPTED]
 *       - in: query
 *         name: assetId
 *         schema:
 *           type: string
 *       - in: query
 *         name: exploitAvailable
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: patchAvailable
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [title, severity, cvssScore, publishedDate, lastModifiedDate]
 *           default: cvssScore
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of vulnerabilities
 */
router.get('/', [
  authenticateToken,
  requirePermission('vulnerabilities:read'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().trim(),
  query('severity').optional().isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
  query('status').optional().isIn(['OPEN', 'INVESTIGATING', 'MITIGATED', 'FALSE_POSITIVE', 'RISK_ACCEPTED']),
  query('assetId').optional().isUUID(),
  query('exploitAvailable').optional().isBoolean().toBoolean(),
  query('patchAvailable').optional().isBoolean().toBoolean(),
  query('sortBy').optional().isIn(['title', 'severity', 'cvssScore', 'publishedDate', 'lastModifiedDate']),
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
      severity,
      status,
      assetId,
      exploitAvailable,
      patchAvailable,
      sortBy = 'cvssScore',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;

    // Build where clause for vulnerabilities
    const vulnerabilityWhere = {};

    if (search) {
      vulnerabilityWhere.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { cveId: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (severity) vulnerabilityWhere.severity = severity;
    if (exploitAvailable !== undefined) vulnerabilityWhere.exploitAvailable = exploitAvailable;
    if (patchAvailable !== undefined) vulnerabilityWhere.patchAvailable = patchAvailable;

    // Build where clause for asset vulnerabilities
    const assetVulnWhere = {};
    if (status) assetVulnWhere.status = status;
    if (assetId) assetVulnWhere.assetId = assetId;

    // If filtering by asset-specific criteria, use assetVulnerability as main query
    let vulnerabilities, total;

    if (status || assetId) {
      // Query through AssetVulnerability when filtering by status or specific asset
      total = await prisma.assetVulnerability.count({
        where: {
          ...assetVulnWhere,
          vulnerability: vulnerabilityWhere
        }
      });

      const assetVulnerabilities = await prisma.assetVulnerability.findMany({
        where: {
          ...assetVulnWhere,
          vulnerability: vulnerabilityWhere
        },
        skip,
        take: limit,
        include: {
          vulnerability: true,
          asset: {
            select: { id: true, name: true, type: true, criticality: true }
          }
        },
        orderBy: {
          vulnerability: { [sortBy]: sortOrder }
        }
      });

      vulnerabilities = assetVulnerabilities.map(av => ({
        ...av.vulnerability,
        assetVulnerabilityId: av.id,
        assetStatus: av.status,
        firstDetected: av.firstDetected,
        lastDetected: av.lastDetected,
        notes: av.notes,
        affectedAssets: [av.asset]
      }));

    } else {
      // Direct vulnerability query
      total = await prisma.vulnerability.count({ where: vulnerabilityWhere });

      vulnerabilities = await prisma.vulnerability.findMany({
        where: vulnerabilityWhere,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          affectedAssets: {
            include: {
              asset: {
                select: { id: true, name: true, type: true, criticality: true }
              }
            }
          }
        }
      });

      // Transform to include affected assets
      vulnerabilities = vulnerabilities.map(vuln => ({
        ...vuln,
        affectedAssets: vuln.affectedAssets.map(av => av.asset)
      }));
    }

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        vulnerabilities,
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
    logger.error('Get vulnerabilities error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/vulnerabilities/{id}:
 *   get:
 *     summary: Get vulnerability by ID
 *     tags: [Vulnerabilities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:id', [
  authenticateToken,
  requirePermission('vulnerabilities:read'),
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

    const vulnerability = await prisma.vulnerability.findUnique({
      where: { id },
      include: {
        affectedAssets: {
          include: {
            asset: {
              select: {
                id: true,
                name: true,
                type: true,
                status: true,
                criticality: true,
                ipAddress: true,
                hostname: true,
                owner: true
              }
            }
          },
          orderBy: {
            asset: { criticality: 'asc' }
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
                owner: true
              }
            }
          }
        }
      }
    });

    if (!vulnerability) {
      return res.status(404).json({
        success: false,
        message: 'Vulnerability not found'
      });
    }

    // Transform the response
    const responseData = {
      ...vulnerability,
      affectedAssets: vulnerability.affectedAssets.map(av => ({
        ...av.asset,
        vulnerabilityStatus: av.status,
        firstDetected: av.firstDetected,
        lastDetected: av.lastDetected,
        notes: av.notes
      })),
      relatedRisks: vulnerability.risks.map(rv => rv.risk)
    };

    res.json({
      success: true,
      data: { vulnerability: responseData }
    });

  } catch (error) {
    logger.error('Get vulnerability error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/vulnerabilities:
 *   post:
 *     summary: Create new vulnerability
 *     tags: [Vulnerabilities]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - severity
 *               - cvssScore
 *               - category
 *               - publishedDate
 *             properties:
 *               cveId:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               severity:
 *                 type: string
 *                 enum: [CRITICAL, HIGH, MEDIUM, LOW, INFO]
 *               cvssScore:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 maximum: 10
 *               cvssVector:
 *                 type: string
 *               category:
 *                 type: string
 *               publishedDate:
 *                 type: string
 *                 format: date-time
 *               lastModifiedDate:
 *                 type: string
 *                 format: date-time
 *               solution:
 *                 type: string
 *               references:
 *                 type: array
 *                 items:
 *                   type: string
 *               exploitAvailable:
 *                 type: boolean
 *               patchAvailable:
 *                 type: boolean
 */
router.post('/', [
  authenticateToken,
  requirePermission('vulnerabilities:write'),
  body('cveId').optional().trim().matches(/^CVE-\d{4}-\d{4,}$/),
  body('title').trim().notEmpty().isLength({ max: 500 }),
  body('description').trim().notEmpty().isLength({ max: 5000 }),
  body('severity').isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
  body('cvssScore').isFloat({ min: 0, max: 10 }),
  body('cvssVector').optional().trim(),
  body('category').trim().notEmpty().isLength({ max: 100 }),
  body('publishedDate').isISO8601().toDate(),
  body('lastModifiedDate').optional().isISO8601().toDate(),
  body('solution').optional().trim().isLength({ max: 5000 }),
  body('references').optional().isArray(),
  body('references.*').optional().isURL(),
  body('exploitAvailable').optional().isBoolean(),
  body('patchAvailable').optional().isBoolean()
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

    const vulnerabilityData = {
      ...req.body,
      lastModifiedDate: req.body.lastModifiedDate || req.body.publishedDate,
      references: req.body.references || [],
      exploitAvailable: req.body.exploitAvailable || false,
      patchAvailable: req.body.patchAvailable || false
    };

    // Check for duplicate CVE ID if provided
    if (vulnerabilityData.cveId) {
      const existing = await prisma.vulnerability.findUnique({
        where: { cveId: vulnerabilityData.cveId }
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Vulnerability with this CVE ID already exists'
        });
      }
    }

    const vulnerability = await prisma.vulnerability.create({
      data: vulnerabilityData
    });

    await auditLog(
      req.user.id,
      'VULNERABILITY_CREATED',
      'Vulnerability',
      vulnerability.id,
      null,
      vulnerabilityData,
      req.ip,
      req.get('User-Agent')
    );

    res.status(201).json({
      success: true,
      message: 'Vulnerability created successfully',
      data: { vulnerability }
    });

  } catch (error) {
    logger.error('Create vulnerability error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/vulnerabilities/{id}:
 *   put:
 *     summary: Update vulnerability
 *     tags: [Vulnerabilities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.put('/:id', [
  authenticateToken,
  requirePermission('vulnerabilities:write'),
  param('id').isUUID(),
  body('cveId').optional().trim().matches(/^CVE-\d{4}-\d{4,}$/),
  body('title').optional().trim().notEmpty().isLength({ max: 500 }),
  body('description').optional().trim().notEmpty().isLength({ max: 5000 }),
  body('severity').optional().isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
  body('cvssScore').optional().isFloat({ min: 0, max: 10 }),
  body('cvssVector').optional().trim(),
  body('category').optional().trim().notEmpty().isLength({ max: 100 }),
  body('publishedDate').optional().isISO8601().toDate(),
  body('lastModifiedDate').optional().isISO8601().toDate(),
  body('solution').optional().trim().isLength({ max: 5000 }),
  body('references').optional().isArray(),
  body('references.*').optional().isURL(),
  body('exploitAvailable').optional().isBoolean(),
  body('patchAvailable').optional().isBoolean()
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

    // Get current vulnerability for audit log
    const currentVulnerability = await prisma.vulnerability.findUnique({
      where: { id }
    });

    if (!currentVulnerability) {
      return res.status(404).json({
        success: false,
        message: 'Vulnerability not found'
      });
    }

    // Check for duplicate CVE ID (excluding current vulnerability)
    if (req.body.cveId) {
      const existing = await prisma.vulnerability.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { cveId: req.body.cveId }
          ]
        }
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Vulnerability with this CVE ID already exists'
        });
      }
    }

    const updateData = { ...req.body };
    delete updateData.id;
    delete updateData.createdAt;

    // Set lastModifiedDate to now if not provided
    if (!updateData.lastModifiedDate) {
      updateData.lastModifiedDate = new Date();
    }

    const vulnerability = await prisma.vulnerability.update({
      where: { id },
      data: updateData
    });

    await auditLog(
      req.user.id,
      'VULNERABILITY_UPDATED',
      'Vulnerability',
      vulnerability.id,
      currentVulnerability,
      updateData,
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      message: 'Vulnerability updated successfully',
      data: { vulnerability }
    });

  } catch (error) {
    logger.error('Update vulnerability error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/vulnerabilities/{id}/status:
 *   patch:
 *     summary: Update vulnerability status for an asset
 *     tags: [Vulnerabilities]
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
 *             type: object
 *             required:
 *               - status
 *               - assetId
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [OPEN, INVESTIGATING, MITIGATED, FALSE_POSITIVE, RISK_ACCEPTED]
 *               assetId:
 *                 type: string
 *               notes:
 *                 type: string
 */
router.patch('/:id/status', [
  authenticateToken,
  requirePermission('vulnerabilities:write'),
  param('id').isUUID(),
  body('status').isIn(['OPEN', 'INVESTIGATING', 'MITIGATED', 'FALSE_POSITIVE', 'RISK_ACCEPTED']),
  body('assetId').isUUID(),
  body('notes').optional().trim().isLength({ max: 1000 })
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
    const { status, assetId, notes } = req.body;

    // Check if vulnerability exists
    const vulnerability = await prisma.vulnerability.findUnique({
      where: { id },
      select: { id: true, title: true }
    });

    if (!vulnerability) {
      return res.status(404).json({
        success: false,
        message: 'Vulnerability not found'
      });
    }

    // Check if asset vulnerability relationship exists
    const assetVulnerability = await prisma.assetVulnerability.findUnique({
      where: {
        assetId_vulnerabilityId: {
          assetId,
          vulnerabilityId: id
        }
      }
    });

    if (!assetVulnerability) {
      return res.status(404).json({
        success: false,
        message: 'Vulnerability not found for this asset'
      });
    }

    // Update the status
    const updatedAssetVuln = await prisma.assetVulnerability.update({
      where: {
        assetId_vulnerabilityId: {
          assetId,
          vulnerabilityId: id
        }
      },
      data: {
        status,
        notes,
        lastDetected: new Date()
      },
      include: {
        asset: {
          select: { id: true, name: true }
        },
        vulnerability: {
          select: { id: true, title: true, cveId: true }
        }
      }
    });

    await auditLog(
      req.user.id,
      'VULNERABILITY_STATUS_UPDATED',
      'AssetVulnerability',
      assetVulnerability.id,
      { status: assetVulnerability.status },
      { status, notes },
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      message: 'Vulnerability status updated successfully',
      data: { assetVulnerability: updatedAssetVuln }
    });

  } catch (error) {
    logger.error('Update vulnerability status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/vulnerabilities/{id}:
 *   delete:
 *     summary: Delete vulnerability
 *     tags: [Vulnerabilities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.delete('/:id', [
  authenticateToken,
  requirePermission('vulnerabilities:delete'),
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

    // Check if vulnerability exists and get asset count
    const vulnerability = await prisma.vulnerability.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            affectedAssets: true,
            risks: true
          }
        }
      }
    });

    if (!vulnerability) {
      return res.status(404).json({
        success: false,
        message: 'Vulnerability not found'
      });
    }

    // Check if vulnerability has dependencies
    if (vulnerability._count.affectedAssets > 0 || vulnerability._count.risks > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete vulnerability with existing asset associations or risks',
        details: {
          affectedAssets: vulnerability._count.affectedAssets,
          risks: vulnerability._count.risks
        }
      });
    }

    await prisma.vulnerability.delete({
      where: { id }
    });

    await auditLog(
      req.user.id,
      'VULNERABILITY_DELETED',
      'Vulnerability',
      id,
      vulnerability,
      null,
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      message: 'Vulnerability deleted successfully'
    });

  } catch (error) {
    logger.error('Delete vulnerability error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/vulnerabilities/stats:
 *   get:
 *     summary: Get vulnerability statistics
 *     tags: [Vulnerabilities]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', [
  authenticateToken,
  requirePermission('vulnerabilities:read')
], async (req, res) => {
  try {
    const [
      total,
      bySeverity,
      byStatus,
      byCategory,
      averageCvssScore,
      exploitableCount,
      patchableCount,
      recentCount
    ] = await Promise.all([
      // Total count
      prisma.vulnerability.count(),
      
      // Count by severity
      prisma.vulnerability.groupBy({
        by: ['severity'],
        _count: { severity: true }
      }),
      
      // Count by status (from AssetVulnerability)
      prisma.assetVulnerability.groupBy({
        by: ['status'],
        _count: { status: true }
      }),
      
      // Count by category
      prisma.vulnerability.groupBy({
        by: ['category'],
        _count: { category: true }
      }),
      
      // Average CVSS score
      prisma.vulnerability.aggregate({
        _avg: { cvssScore: true }
      }),
      
      // Exploitable vulnerabilities
      prisma.vulnerability.count({
        where: { exploitAvailable: true }
      }),
      
      // Patchable vulnerabilities
      prisma.vulnerability.count({
        where: { patchAvailable: true }
      }),
      
      // Recent vulnerabilities (last 30 days)
      prisma.vulnerability.count({
        where: {
          publishedDate: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    const stats = {
      total,
      critical: bySeverity.find(s => s.severity === 'CRITICAL')?._count?.severity || 0,
      high: bySeverity.find(s => s.severity === 'HIGH')?._count?.severity || 0,
      medium: bySeverity.find(s => s.severity === 'MEDIUM')?._count?.severity || 0,
      low: bySeverity.find(s => s.severity === 'LOW')?._count?.severity || 0,
      info: bySeverity.find(s => s.severity === 'INFO')?._count?.severity || 0,
      open: byStatus.find(s => s.status === 'OPEN')?._count?.status || 0,
      investigating: byStatus.find(s => s.status === 'INVESTIGATING')?._count?.status || 0,
      mitigated: byStatus.find(s => s.status === 'MITIGATED')?._count?.status || 0,
      withExploits: exploitableCount,
      withPatches: patchableCount,
      averageCvssScore: averageCvssScore._avg.cvssScore || 0,
      recentVulnerabilities: recentCount,
      bySeverity: bySeverity.map(s => ({
        severity: s.severity,
        count: s._count.severity
      })),
      byStatus: byStatus.map(s => ({
        status: s.status,
        count: s._count.status
      })),
      byCategory: byCategory.map(c => ({
        category: c.category,
        count: c._count.category
      }))
    };

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    logger.error('Get vulnerability stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/vulnerabilities/import:
 *   post:
 *     summary: Import vulnerabilities from external source
 *     tags: [Vulnerabilities]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - source
 *               - vulnerabilities
 *             properties:
 *               source:
 *                 type: string
 *                 enum: [nist, mitre, custom]
 *               vulnerabilities:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Vulnerability'
 */
router.post('/import', [
  authenticateToken,
  requirePermission('vulnerabilities:write'),
  body('source').isIn(['nist', 'mitre', 'custom']),
  body('vulnerabilities').isArray({ min: 1, max: 1000 }),
  body('vulnerabilities.*.title').trim().notEmpty(),
  body('vulnerabilities.*.description').trim().notEmpty(),
  body('vulnerabilities.*.severity').isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
  body('vulnerabilities.*.cvssScore').isFloat({ min: 0, max: 10 }),
  body('vulnerabilities.*.category').trim().notEmpty(),
  body('vulnerabilities.*.publishedDate').isISO8601()
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

    const { source, vulnerabilities } = req.body;

    const importResults = {
      total: vulnerabilities.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    for (const vulnData of vulnerabilities) {
      try {
        // Check if vulnerability already exists by CVE ID
        let existingVuln = null;
        if (vulnData.cveId) {
          existingVuln = await prisma.vulnerability.findUnique({
            where: { cveId: vulnData.cveId }
          });
        }

        const processedData = {
          ...vulnData,
          lastModifiedDate: vulnData.lastModifiedDate || vulnData.publishedDate,
          references: vulnData.references || [],
          exploitAvailable: vulnData.exploitAvailable || false,
          patchAvailable: vulnData.patchAvailable || false,
          publishedDate: new Date(vulnData.publishedDate),
          lastModifiedDate: vulnData.lastModifiedDate ? new Date(vulnData.lastModifiedDate) : new Date(vulnData.publishedDate)
        };

        if (existingVuln) {
          // Update existing vulnerability
          await prisma.vulnerability.update({
            where: { id: existingVuln.id },
            data: processedData
          });
          importResults.updated++;
        } else {
          // Create new vulnerability
          await prisma.vulnerability.create({
            data: processedData
          });
          importResults.imported++;
        }

      } catch (error) {
        importResults.errors.push({
          vulnerability: vulnData.title || vulnData.cveId,
          error: error.message
        });
        importResults.skipped++;
      }
    }

    await auditLog(
      req.user.id,
      'VULNERABILITIES_IMPORTED',
      'Vulnerability',
      null,
      null,
      { source, ...importResults },
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      message: 'Vulnerability import completed',
      data: { importResults }
    });

  } catch (error) {
    logger.error('Import vulnerabilities error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;