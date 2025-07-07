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
 *     Risk:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         category:
 *           type: string
 *           enum: [technical, operational, compliance, strategic]
 *         likelihood:
 *           type: string
 *           enum: [very_low, low, medium, high, very_high]
 *         impact:
 *           type: string
 *           enum: [very_low, low, medium, high, very_high]
 *         riskScore:
 *           type: number
 *         status:
 *           type: string
 *           enum: [identified, assessed, mitigating, mitigated, accepted]
 *         owner:
 *           type: string
 *         dueDate:
 *           type: string
 *           format: date
 *         mitigationPlan:
 *           type: string
 *         relatedAssets:
 *           type: array
 *           items:
 *             type: string
 *         relatedVulnerabilities:
 *           type: array
 *           items:
 *             type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/risks:
 *   get:
 *     summary: Get all risks with filtering and pagination
 *     tags: [Risks]
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
 *         name: category
 *         schema:
 *           type: string
 *           enum: [technical, operational, compliance, strategic]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [identified, assessed, mitigating, mitigated, accepted]
 *       - in: query
 *         name: owner
 *         schema:
 *           type: string
 *       - in: query
 *         name: likelihood
 *         schema:
 *           type: string
 *           enum: [very_low, low, medium, high, very_high]
 *       - in: query
 *         name: impact
 *         schema:
 *           type: string
 *           enum: [very_low, low, medium, high, very_high]
 *       - in: query
 *         name: minRiskScore
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxRiskScore
 *         schema:
 *           type: number
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, riskScore, dueDate, title]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of risks
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
 *                     risks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Risk'
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get('/', [
  authenticateToken,
  requirePermission('risks:read'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().trim().escape(),
  query('category').optional().isIn(['technical', 'operational', 'compliance', 'strategic']),
  query('status').optional().isIn(['identified', 'assessed', 'mitigating', 'mitigated', 'accepted']),
  query('owner').optional().trim(),
  query('likelihood').optional().isIn(['very_low', 'low', 'medium', 'high', 'very_high']),
  query('impact').optional().isIn(['very_low', 'low', 'medium', 'high', 'very_high']),
  query('minRiskScore').optional().isFloat({ min: 0, max: 10 }).toFloat(),
  query('maxRiskScore').optional().isFloat({ min: 0, max: 10 }).toFloat(),
  query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'riskScore', 'dueDate', 'title']),
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
      category,
      status,
      owner,
      likelihood,
      impact,
      minRiskScore,
      maxRiskScore,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build where clause
    const whereClause = {};

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { mitigationPlan: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (category) {
      whereClause.category = category.toUpperCase();
    }

    if (status) {
      whereClause.status = status.toUpperCase();
    }

    if (owner) {
      whereClause.owner = { contains: owner, mode: 'insensitive' };
    }

    if (likelihood) {
      whereClause.likelihood = likelihood.toUpperCase();
    }

    if (impact) {
      whereClause.impact = impact.toUpperCase();
    }

    if (minRiskScore !== undefined || maxRiskScore !== undefined) {
      whereClause.riskScore = {};
      if (minRiskScore !== undefined) whereClause.riskScore.gte = minRiskScore;
      if (maxRiskScore !== undefined) whereClause.riskScore.lte = maxRiskScore;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build order by clause
    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [risks, total] = await Promise.all([
      prisma.risk.findMany({
        where: whereClause,
        include: {
          relatedAssets: {
            select: {
              id: true,
              name: true
            }
          },
          relatedVulnerabilities: {
            select: {
              id: true,
              title: true,
              cveId: true
            }
          },
          owner: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy,
        skip,
        take: limit
      }),
      prisma.risk.count({ where: whereClause })
    ]);

    // Transform risks for frontend
    const transformedRisks = risks.map(risk => ({
      id: risk.id,
      title: risk.title,
      description: risk.description,
      category: risk.category.toLowerCase(),
      likelihood: risk.likelihood.toLowerCase(),
      impact: risk.impact.toLowerCase(),
      riskScore: risk.riskScore,
      status: risk.status.toLowerCase(),
      owner: risk.owner?.name || risk.ownerName || 'Unassigned',
      dueDate: risk.dueDate ? risk.dueDate.toISOString().split('T')[0] : null,
      mitigationPlan: risk.mitigationPlan,
      relatedAssets: risk.relatedAssets.map(asset => asset.id),
      relatedVulnerabilities: risk.relatedVulnerabilities.map(vuln => vuln.id),
      createdAt: risk.createdAt,
      updatedAt: risk.updatedAt,
      isOverdue: risk.dueDate ? new Date(risk.dueDate) < new Date() : false,
      daysUntilDue: risk.dueDate ? Math.ceil((new Date(risk.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        risks: transformedRisks,
        total,
        page,
        totalPages
      }
    });

  } catch (error) {
    logger.error('Get risks error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/risks/{id}:
 *   get:
 *     summary: Get a specific risk
 *     tags: [Risks]
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
 *         description: Risk details
 *       404:
 *         description: Risk not found
 */
router.get('/:id', [
  authenticateToken,
  requirePermission('risks:read'),
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

    const risk = await prisma.risk.findUnique({
      where: { id },
      include: {
        relatedAssets: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true
          }
        },
        relatedVulnerabilities: {
          select: {
            id: true,
            title: true,
            cveId: true,
            severity: true,
            cvssScore: true
          }
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true
          }
        },
        updatedBy: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!risk) {
      return res.status(404).json({
        success: false,
        message: 'Risk not found'
      });
    }

    res.json({
      success: true,
      data: risk
    });

  } catch (error) {
    logger.error('Get risk error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/risks:
 *   post:
 *     summary: Create a new risk
 *     tags: [Risks]
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
 *               - category
 *               - likelihood
 *               - impact
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [technical, operational, compliance, strategic]
 *               likelihood:
 *                 type: string
 *                 enum: [very_low, low, medium, high, very_high]
 *               impact:
 *                 type: string
 *                 enum: [very_low, low, medium, high, very_high]
 *               owner:
 *                 type: string
 *               dueDate:
 *                 type: string
 *                 format: date
 *               mitigationPlan:
 *                 type: string
 *               relatedAssets:
 *                 type: array
 *                 items:
 *                   type: string
 *               relatedVulnerabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Risk created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', [
  authenticateToken,
  requirePermission('risks:create'),
  auditLog('CREATE', 'RISK'),
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters'),
  body('description').trim().isLength({ min: 1, max: 2000 }).withMessage('Description must be between 1 and 2000 characters'),
  body('category').isIn(['technical', 'operational', 'compliance', 'strategic']),
  body('likelihood').isIn(['very_low', 'low', 'medium', 'high', 'very_high']),
  body('impact').isIn(['very_low', 'low', 'medium', 'high', 'very_high']),
  body('owner').optional().trim().isLength({ max: 100 }),
  body('dueDate').optional().isISO8601().toDate(),
  body('mitigationPlan').optional().trim().isLength({ max: 2000 }),
  body('relatedAssets').optional().isArray(),
  body('relatedVulnerabilities').optional().isArray()
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
      description,
      category,
      likelihood,
      impact,
      owner,
      dueDate,
      mitigationPlan,
      relatedAssets = [],
      relatedVulnerabilities = []
    } = req.body;

    // Calculate risk score based on likelihood and impact
    const riskScore = calculateRiskScore(likelihood, impact);

    // Create risk with relations
    const risk = await prisma.risk.create({
      data: {
        title,
        description,
        category: category.toUpperCase(),
        likelihood: likelihood.toUpperCase(),
        impact: impact.toUpperCase(),
        riskScore,
        status: 'IDENTIFIED',
        ownerName: owner || null,
        dueDate: dueDate || null,
        mitigationPlan: mitigationPlan || null,
        createdById: req.user.id,
        relatedAssets: {
          connect: relatedAssets.map(assetId => ({ id: assetId }))
        },
        relatedVulnerabilities: {
          connect: relatedVulnerabilities.map(vulnId => ({ id: vulnId }))
        }
      },
      include: {
        relatedAssets: {
          select: {
            id: true,
            name: true
          }
        },
        relatedVulnerabilities: {
          select: {
            id: true,
            title: true,
            cveId: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: risk,
      message: 'Risk created successfully'
    });

  } catch (error) {
    logger.error('Create risk error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/risks/{id}:
 *   put:
 *     summary: Update a risk
 *     tags: [Risks]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', [
  authenticateToken,
  requirePermission('risks:update'),
  auditLog('UPDATE', 'RISK'),
  param('id').isUUID(),
  body('title').optional().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().trim().isLength({ min: 1, max: 2000 }),
  body('category').optional().isIn(['technical', 'operational', 'compliance', 'strategic']),
  body('likelihood').optional().isIn(['very_low', 'low', 'medium', 'high', 'very_high']),
  body('impact').optional().isIn(['very_low', 'low', 'medium', 'high', 'very_high']),
  body('status').optional().isIn(['identified', 'assessed', 'mitigating', 'mitigated', 'accepted']),
  body('owner').optional().trim().isLength({ max: 100 }),
  body('dueDate').optional().isISO8601().toDate(),
  body('mitigationPlan').optional().trim().isLength({ max: 2000 }),
  body('relatedAssets').optional().isArray(),
  body('relatedVulnerabilities').optional().isArray()
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
    const updateData = { ...req.body };

    // Convert string fields to uppercase if provided
    if (updateData.category) updateData.category = updateData.category.toUpperCase();
    if (updateData.likelihood) updateData.likelihood = updateData.likelihood.toUpperCase();
    if (updateData.impact) updateData.impact = updateData.impact.toUpperCase();
    if (updateData.status) updateData.status = updateData.status.toUpperCase();

    // Recalculate risk score if likelihood or impact changed
    if (updateData.likelihood || updateData.impact) {
      const currentRisk = await prisma.risk.findUnique({
        where: { id },
        select: { likelihood: true, impact: true }
      });

      if (!currentRisk) {
        return res.status(404).json({
          success: false,
          message: 'Risk not found'
        });
      }

      const likelihood = updateData.likelihood || currentRisk.likelihood;
      const impact = updateData.impact || currentRisk.impact;
      updateData.riskScore = calculateRiskScore(likelihood.toLowerCase(), impact.toLowerCase());
    }

    // Handle related assets and vulnerabilities
    const relatedAssets = updateData.relatedAssets;
    const relatedVulnerabilities = updateData.relatedVulnerabilities;
    delete updateData.relatedAssets;
    delete updateData.relatedVulnerabilities;

    updateData.updatedById = req.user.id;
    updateData.ownerName = updateData.owner;
    delete updateData.owner;

    const risk = await prisma.risk.update({
      where: { id },
      data: {
        ...updateData,
        ...(relatedAssets && {
          relatedAssets: {
            set: relatedAssets.map(assetId => ({ id: assetId }))
          }
        }),
        ...(relatedVulnerabilities && {
          relatedVulnerabilities: {
            set: relatedVulnerabilities.map(vulnId => ({ id: vulnId }))
          }
        })
      },
      include: {
        relatedAssets: {
          select: {
            id: true,
            name: true
          }
        },
        relatedVulnerabilities: {
          select: {
            id: true,
            title: true,
            cveId: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: risk,
      message: 'Risk updated successfully'
    });

  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Risk not found'
      });
    }
    logger.error('Update risk error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/risks/{id}/status:
 *   patch:
 *     summary: Update risk status
 *     tags: [Risks]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/status', [
  authenticateToken,
  requirePermission('risks:update'),
  auditLog('UPDATE', 'RISK'),
  param('id').isUUID(),
  body('status').isIn(['identified', 'assessed', 'mitigating', 'mitigated', 'accepted'])
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
    const { status } = req.body;

    const risk = await prisma.risk.update({
      where: { id },
      data: {
        status: status.toUpperCase(),
        updatedById: req.user.id
      }
    });

    res.json({
      success: true,
      data: risk,
      message: 'Risk status updated successfully'
    });

  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Risk not found'
      });
    }
    logger.error('Update risk status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/risks/{id}:
 *   delete:
 *     summary: Delete a risk
 *     tags: [Risks]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', [
  authenticateToken,
  requirePermission('risks:delete'),
  auditLog('DELETE', 'RISK'),
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

    await prisma.risk.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Risk deleted successfully'
    });

  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Risk not found'
      });
    }
    logger.error('Delete risk error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/risks/stats:
 *   get:
 *     summary: Get risk statistics
 *     tags: [Risks]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', [
  authenticateToken,
  requirePermission('risks:read')
], async (req, res) => {
  try {
    const [
      totalRisks,
      risksByCategory,
      risksByStatus,
      risksByScore,
      overDueRisks,
      avgRiskScore
    ] = await Promise.all([
      prisma.risk.count(),
      prisma.risk.groupBy({
        by: ['category'],
        _count: true
      }),
      prisma.risk.groupBy({
        by: ['status'],
        _count: true
      }),
      prisma.risk.groupBy({
        by: ['riskScore'],
        _count: true
      }),
      prisma.risk.count({
        where: {
          dueDate: {
            lt: new Date()
          },
          status: {
            notIn: ['MITIGATED', 'ACCEPTED']
          }
        }
      }),
      prisma.risk.aggregate({
        _avg: {
          riskScore: true
        }
      })
    ]);

    // Calculate risk score distribution
    const riskScoreDistribution = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    const risks = await prisma.risk.findMany({
      select: { riskScore: true }
    });

    risks.forEach(risk => {
      if (risk.riskScore >= 8) riskScoreDistribution.critical++;
      else if (risk.riskScore >= 6) riskScoreDistribution.high++;
      else if (risk.riskScore >= 4) riskScoreDistribution.medium++;
      else riskScoreDistribution.low++;
    });

    res.json({
      success: true,
      data: {
        totalRisks,
        risksByCategory: risksByCategory.map(item => ({
          category: item.category.toLowerCase(),
          count: item._count
        })),
        risksByStatus: risksByStatus.map(item => ({
          status: item.status.toLowerCase(),
          count: item._count
        })),
        riskScoreDistribution,
        overDueRisks,
        averageRiskScore: Number((avgRiskScore._avg.riskScore || 0).toFixed(2))
      }
    });

  } catch (error) {
    logger.error('Get risk statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/risks/matrix:
 *   get:
 *     summary: Get risk matrix data
 *     tags: [Risks]
 *     security:
 *       - bearerAuth: []
 */
router.get('/matrix', [
  authenticateToken,
  requirePermission('risks:read')
], async (req, res) => {
  try {
    const risks = await prisma.risk.findMany({
      select: {
        id: true,
        title: true,
        likelihood: true,
        impact: true,
        riskScore: true,
        status: true
      },
      where: {
        status: {
          notIn: ['MITIGATED', 'ACCEPTED']
        }
      }
    });

    const matrix = {};
    const likelihoodLevels = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
    const impactLevels = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];

    // Initialize matrix
    likelihoodLevels.forEach(likelihood => {
      matrix[likelihood] = {};
      impactLevels.forEach(impact => {
        matrix[likelihood][impact] = {
          count: 0,
          risks: []
        };
      });
    });

    // Populate matrix
    risks.forEach(risk => {
      const likelihood = risk.likelihood;
      const impact = risk.impact;
      
      if (matrix[likelihood] && matrix[likelihood][impact]) {
        matrix[likelihood][impact].count++;
        matrix[likelihood][impact].risks.push({
          id: risk.id,
          title: risk.title,
          riskScore: risk.riskScore,
          status: risk.status.toLowerCase()
        });
      }
    });

    res.json({
      success: true,
      data: {
        matrix,
        likelihoodLevels: likelihoodLevels.map(l => l.toLowerCase()),
        impactLevels: impactLevels.map(l => l.toLowerCase())
      }
    });

  } catch (error) {
    logger.error('Get risk matrix error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/risks/owners:
 *   get:
 *     summary: Get unique risk owners
 *     tags: [Risks]
 *     security:
 *       - bearerAuth: []
 */
router.get('/owners', [
  authenticateToken,
  requirePermission('risks:read')
], async (req, res) => {
  try {
    const owners = await prisma.risk.findMany({
      select: { ownerName: true },
      where: {
        ownerName: {
          not: null
        }
      },
      distinct: ['ownerName']
    });

    const uniqueOwners = owners
      .map(owner => owner.ownerName)
      .filter(name => name && name.trim() !== '')
      .sort();

    res.json({
      success: true,
      data: uniqueOwners
    });

  } catch (error) {
    logger.error('Get risk owners error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/risks/bulk-update:
 *   patch:
 *     summary: Bulk update risk statuses
 *     tags: [Risks]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/bulk-update', [
  authenticateToken,
  requirePermission('risks:update'),
  auditLog('BULK_UPDATE', 'RISK'),
  body('riskIds').isArray({ min: 1 }),
  body('riskIds.*').isUUID(),
  body('updates').isObject(),
  body('updates.status').optional().isIn(['identified', 'assessed', 'mitigating', 'mitigated', 'accepted']),
  body('updates.owner').optional().trim().isLength({ max: 100 }),
  body('updates.dueDate').optional().isISO8601().toDate()
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

    const { riskIds, updates } = req.body;

    // Prepare update data
    const updateData = { updatedById: req.user.id };
    
    if (updates.status) updateData.status = updates.status.toUpperCase();
    if (updates.owner !== undefined) updateData.ownerName = updates.owner;
    if (updates.dueDate !== undefined) updateData.dueDate = updates.dueDate;

    const updatedRisks = await prisma.risk.updateMany({
      where: {
        id: {
          in: riskIds
        }
      },
      data: updateData
    });

    res.json({
      success: true,
      data: {
        updatedCount: updatedRisks.count
      },
      message: `${updatedRisks.count} risks updated successfully`
    });

  } catch (error) {
    logger.error('Bulk update risks error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/risks/export:
 *   get:
 *     summary: Export risks to CSV
 *     tags: [Risks]
 *     security:
 *       - bearerAuth: []
 */
router.get('/export', [
  authenticateToken,
  requirePermission('risks:read'),
  query('format').optional().isIn(['csv', 'json']),
  query('category').optional().isIn(['technical', 'operational', 'compliance', 'strategic']),
  query('status').optional().isIn(['identified', 'assessed', 'mitigating', 'mitigated', 'accepted'])
], async (req, res) => {
  try {
    const { format = 'csv', category, status } = req.query;

    const whereClause = {};
    if (category) whereClause.category = category.toUpperCase();
    if (status) whereClause.status = status.toUpperCase();

    const risks = await prisma.risk.findMany({
      where: whereClause,
      include: {
        relatedAssets: {
          select: {
            name: true
          }
        },
        relatedVulnerabilities: {
          select: {
            title: true,
            cveId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="risks-export.json"');
      return res.json({
        success: true,
        data: risks,
        exportedAt: new Date().toISOString(),
        totalRecords: risks.length
      });
    }

    // CSV Export
    const csvHeaders = [
      'ID',
      'Title',
      'Description',
      'Category',
      'Likelihood',
      'Impact',
      'Risk Score',
      'Status',
      'Owner',
      'Due Date',
      'Mitigation Plan',
      'Related Assets',
      'Related Vulnerabilities',
      'Created At',
      'Updated At'
    ];

    const csvData = risks.map(risk => [
      risk.id,
      risk.title,
      risk.description?.replace(/"/g, '""') || '',
      risk.category.toLowerCase(),
      risk.likelihood.toLowerCase(),
      risk.impact.toLowerCase(),
      risk.riskScore,
      risk.status.toLowerCase(),
      risk.ownerName || '',
      risk.dueDate ? risk.dueDate.toISOString().split('T')[0] : '',
      risk.mitigationPlan?.replace(/"/g, '""') || '',
      risk.relatedAssets.map(asset => asset.name).join('; '),
      risk.relatedVulnerabilities.map(vuln => vuln.cveId || vuln.title).join('; '),
      risk.createdAt.toISOString(),
      risk.updatedAt.toISOString()
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="risks-export.csv"');
    res.send(csvContent);

  } catch (error) {
    logger.error('Export risks error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/risks/import:
 *   post:
 *     summary: Import risks from CSV
 *     tags: [Risks]
 *     security:
 *       - bearerAuth: []
 */
router.post('/import', [
  authenticateToken,
  requirePermission('risks:create'),
  auditLog('IMPORT', 'RISK'),
  body('risks').isArray({ min: 1 }),
  body('risks.*.title').trim().isLength({ min: 1, max: 200 }),
  body('risks.*.description').trim().isLength({ min: 1, max: 2000 }),
  body('risks.*.category').isIn(['technical', 'operational', 'compliance', 'strategic']),
  body('risks.*.likelihood').isIn(['very_low', 'low', 'medium', 'high', 'very_high']),
  body('risks.*.impact').isIn(['very_low', 'low', 'medium', 'high', 'very_high'])
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

    const { risks } = req.body;
    const importedRisks = [];
    const failedRisks = [];

    for (const riskData of risks) {
      try {
        const riskScore = calculateRiskScore(riskData.likelihood, riskData.impact);
        
        const risk = await prisma.risk.create({
          data: {
            title: riskData.title,
            description: riskData.description,
            category: riskData.category.toUpperCase(),
            likelihood: riskData.likelihood.toUpperCase(),
            impact: riskData.impact.toUpperCase(),
            riskScore,
            status: 'IDENTIFIED',
            ownerName: riskData.owner || null,
            dueDate: riskData.dueDate ? new Date(riskData.dueDate) : null,
            mitigationPlan: riskData.mitigationPlan || null,
            createdById: req.user.id
          }
        });

        importedRisks.push(risk);
      } catch (error) {
        failedRisks.push({
          title: riskData.title,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        imported: importedRisks.length,
        failed: failedRisks.length,
        failedRisks: failedRisks
      },
      message: `${importedRisks.length} risks imported successfully, ${failedRisks.length} failed`
    });

  } catch (error) {
    logger.error('Import risks error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Helper function to calculate risk score
function calculateRiskScore(likelihood, impact) {
  const likelihoodValues = {
    'very_low': 1,
    'low': 2,
    'medium': 3,
    'high': 4,
    'very_high': 5
  };

  const impactValues = {
    'very_low': 1,
    'low': 2,
    'medium': 3,
    'high': 4,
    'very_high': 5
  };

  const likelihoodScore = likelihoodValues[likelihood.toLowerCase()] || 3;
  const impactScore = impactValues[impact.toLowerCase()] || 3;

  // Calculate risk score (1-10 scale)
  const rawScore = likelihoodScore * impactScore;
  const maxScore = 25; // 5 * 5
  
  // Convert to 1-10 scale
  return Math.round((rawScore / maxScore) * 10 * 10) / 10;
}

module.exports = router;