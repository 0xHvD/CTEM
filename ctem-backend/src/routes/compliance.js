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
 *     ComplianceFramework:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         version:
 *           type: string
 *         description:
 *           type: string
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *         complianceScore:
 *           type: number
 *         lastAssessedAt:
 *           type: string
 *           format: date-time
 *         controls:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ComplianceControl'
 *     ComplianceControl:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         controlId:
 *           type: string
 *         frameworkId:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         category:
 *           type: string
 *         status:
 *           type: string
 *           enum: [implemented, partial, not_implemented]
 *         lastAssessedAt:
 *           type: string
 *           format: date-time
 *         evidence:
 *           type: array
 *           items:
 *             type: string
 *         notes:
 *           type: string
 *     ComplianceGap:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         frameworkId:
 *           type: string
 *         controlId:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         severity:
 *           type: string
 *           enum: [critical, high, medium, low]
 *         recommendation:
 *           type: string
 */

/**
 * @swagger
 * /api/compliance/frameworks:
 *   get:
 *     summary: Get all compliance frameworks
 *     tags: [Compliance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *     responses:
 *       200:
 *         description: List of compliance frameworks
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
 *                     $ref: '#/components/schemas/ComplianceFramework'
 */
router.get('/frameworks', [
  authenticateToken,
  requirePermission('compliance:read'),
  query('status').optional().isIn(['active', 'inactive'])
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

    const { status } = req.query;
    
    const whereClause = status ? { status: status.toUpperCase() } : {};

    const frameworks = await prisma.complianceFramework.findMany({
      where: whereClause,
      include: {
        controls: {
          select: {
            id: true,
            status: true
          }
        },
        _count: {
          select: {
            controls: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Enrich frameworks with control statistics
    const enrichedFrameworks = frameworks.map(framework => {
      const controlCounts = framework.controls.reduce((acc, control) => {
        const status = control.status.toLowerCase();
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      return {
        id: framework.id,
        name: framework.name,
        version: framework.version,
        description: framework.description,
        status: framework.status.toLowerCase(),
        score: framework.complianceScore,
        lastAssessed: framework.lastAssessedAt?.toISOString(),
        controls: {
          total: framework._count.controls,
          implemented: controlCounts.implemented || 0,
          partial: controlCounts.partial || 0,
          missing: controlCounts.not_implemented || 0
        },
        createdAt: framework.createdAt,
        updatedAt: framework.updatedAt
      };
    });

    res.json({
      success: true,
      data: enrichedFrameworks
    });

  } catch (error) {
    logger.error('Get compliance frameworks error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/compliance/frameworks/{id}:
 *   get:
 *     summary: Get a specific compliance framework
 *     tags: [Compliance]
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
 *         description: Compliance framework details
 *       404:
 *         description: Framework not found
 */
router.get('/frameworks/:id', [
  authenticateToken,
  requirePermission('compliance:read'),
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

    const framework = await prisma.complianceFramework.findUnique({
      where: { id },
      include: {
        controls: {
          orderBy: { controlId: 'asc' }
        }
      }
    });

    if (!framework) {
      return res.status(404).json({
        success: false,
        message: 'Compliance framework not found'
      });
    }

    res.json({
      success: true,
      data: framework
    });

  } catch (error) {
    logger.error('Get compliance framework error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/compliance/frameworks:
 *   post:
 *     summary: Create a new compliance framework
 *     tags: [Compliance]
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
 *               - version
 *             properties:
 *               name:
 *                 type: string
 *               version:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Framework created successfully
 *       400:
 *         description: Validation error
 */
router.post('/frameworks', [
  authenticateToken,
  requirePermission('compliance:create'),
  auditLog('CREATE', 'COMPLIANCE_FRAMEWORK'),
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
  body('version').trim().isLength({ min: 1, max: 20 }).withMessage('Version must be between 1 and 20 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters')
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

    const { name, version, description } = req.body;

    // Check if framework with same name and version already exists
    const existingFramework = await prisma.complianceFramework.findFirst({
      where: {
        name,
        version
      }
    });

    if (existingFramework) {
      return res.status(400).json({
        success: false,
        message: 'Framework with this name and version already exists'
      });
    }

    const framework = await prisma.complianceFramework.create({
      data: {
        name,
        version,
        description,
        status: 'ACTIVE',
        complianceScore: 0,
        createdById: req.user.id
      }
    });

    res.status(201).json({
      success: true,
      data: framework,
      message: 'Compliance framework created successfully'
    });

  } catch (error) {
    logger.error('Create compliance framework error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/compliance/frameworks/{id}:
 *   put:
 *     summary: Update a compliance framework
 *     tags: [Compliance]
 *     security:
 *       - bearerAuth: []
 */
router.put('/frameworks/:id', [
  authenticateToken,
  requirePermission('compliance:update'),
  auditLog('UPDATE', 'COMPLIANCE_FRAMEWORK'),
  param('id').isUUID(),
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('version').optional().trim().isLength({ min: 1, max: 20 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('status').optional().isIn(['active', 'inactive'])
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

    // Convert status to uppercase if provided
    if (updateData.status) {
      updateData.status = updateData.status.toUpperCase();
    }

    const framework = await prisma.complianceFramework.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      data: framework,
      message: 'Compliance framework updated successfully'
    });

  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Compliance framework not found'
      });
    }
    logger.error('Update compliance framework error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/compliance/frameworks/{id}:
 *   delete:
 *     summary: Delete a compliance framework
 *     tags: [Compliance]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/frameworks/:id', [
  authenticateToken,
  requirePermission('compliance:delete'),
  auditLog('DELETE', 'COMPLIANCE_FRAMEWORK'),
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

    // Delete all controls first (cascade delete)
    await prisma.complianceControl.deleteMany({
      where: { frameworkId: id }
    });

    // Then delete the framework
    await prisma.complianceFramework.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Compliance framework deleted successfully'
    });

  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Compliance framework not found'
      });
    }
    logger.error('Delete compliance framework error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/compliance/frameworks/{id}/controls:
 *   get:
 *     summary: Get controls for a specific framework
 *     tags: [Compliance]
 *     security:
 *       - bearerAuth: []
 */
router.get('/frameworks/:id/controls', [
  authenticateToken,
  requirePermission('compliance:read'),
  param('id').isUUID(),
  query('status').optional().isIn(['implemented', 'partial', 'not_implemented']),
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

    const { id } = req.params;
    const { status, category } = req.query;

    const whereClause = { frameworkId: id };
    
    if (status) {
      whereClause.status = status.toUpperCase();
    }
    
    if (category) {
      whereClause.category = { contains: category, mode: 'insensitive' };
    }

    const controls = await prisma.complianceControl.findMany({
      where: whereClause,
      include: {
        framework: {
          select: {
            name: true,
            version: true
          }
        }
      },
      orderBy: { controlId: 'asc' }
    });

    // Transform controls to match frontend format
    const transformedControls = controls.map(control => ({
      id: control.id,
      controlId: control.controlId,
      framework: control.framework.name,
      title: control.title,
      description: control.description,
      category: control.category,
      status: control.status.toLowerCase(),
      lastAssessed: control.lastAssessedAt?.toISOString(),
      evidence: control.evidence || [],
      notes: control.notes
    }));

    res.json({
      success: true,
      data: transformedControls
    });

  } catch (error) {
    logger.error('Get compliance controls error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/compliance/frameworks/{frameworkId}/controls/{controlId}/assess:
 *   post:
 *     summary: Assess a compliance control
 *     tags: [Compliance]
 *     security:
 *       - bearerAuth: []
 */
router.post('/frameworks/:frameworkId/controls/:controlId/assess', [
  authenticateToken,
  requirePermission('compliance:update'),
  auditLog('UPDATE', 'COMPLIANCE_CONTROL'),
  param('frameworkId').isUUID(),
  param('controlId').isUUID(),
  body('status').isIn(['implemented', 'partial', 'not_implemented']),
  body('evidence').optional().isArray(),
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

    const { frameworkId, controlId } = req.params;
    const { status, evidence, notes } = req.body;

    const control = await prisma.complianceControl.update({
      where: { 
        id: controlId,
        frameworkId: frameworkId
      },
      data: {
        status: status.toUpperCase(),
        evidence: evidence || [],
        notes,
        lastAssessedAt: new Date(),
        assessedById: req.user.id
      },
      include: {
        framework: {
          select: {
            name: true
          }
        }
      }
    });

    // Recalculate framework compliance score
    await recalculateFrameworkScore(frameworkId);

    res.json({
      success: true,
      data: control,
      message: 'Control assessment updated successfully'
    });

  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Control not found'
      });
    }
    logger.error('Assess compliance control error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/compliance/status:
 *   get:
 *     summary: Get overall compliance status
 *     tags: [Compliance]
 *     security:
 *       - bearerAuth: []
 */
router.get('/status', [
  authenticateToken,
  requirePermission('compliance:read'),
  query('frameworkId').optional().isUUID()
], async (req, res) => {
  try {
    const { frameworkId } = req.query;

    const whereClause = frameworkId ? { id: frameworkId } : { status: 'ACTIVE' };

    const frameworks = await prisma.complianceFramework.findMany({
      where: whereClause,
      include: {
        controls: {
          select: {
            status: true
          }
        }
      }
    });

    const statusData = frameworks.map(framework => {
      const controlCounts = framework.controls.reduce((acc, control) => {
        const status = control.status.toLowerCase();
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      return {
        frameworkId: framework.id,
        frameworkName: framework.name,
        overallScore: framework.complianceScore,
        controlCounts: {
          total: framework.controls.length,
          implemented: controlCounts.implemented || 0,
          partial: controlCounts.partial || 0,
          missing: controlCounts.not_implemented || 0
        }
      };
    });

    res.json({
      success: true,
      data: statusData
    });

  } catch (error) {
    logger.error('Get compliance status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/compliance/gaps:
 *   get:
 *     summary: Get compliance gaps
 *     tags: [Compliance]
 *     security:
 *       - bearerAuth: []
 */
router.get('/gaps', [
  authenticateToken,
  requirePermission('compliance:read'),
  query('frameworkId').optional().isUUID(),
  query('severity').optional().isIn(['critical', 'high', 'medium', 'low'])
], async (req, res) => {
  try {
    const { frameworkId, severity } = req.query;

    // Build query to find controls that are not fully implemented
    const whereClause = {
      status: { in: ['PARTIAL', 'NOT_IMPLEMENTED'] }
    };

    if (frameworkId) {
      whereClause.frameworkId = frameworkId;
    }

    const nonCompliantControls = await prisma.complianceControl.findMany({
      where: whereClause,
      include: {
        framework: {
          select: {
            name: true,
            version: true
          }
        }
      },
      orderBy: [
        { status: 'desc' }, // NOT_IMPLEMENTED first
        { controlId: 'asc' }
      ]
    });

    // Transform to gaps format
    const gaps = nonCompliantControls.map(control => {
      // Determine severity based on control status and category
      let gapSeverity = 'medium';
      if (control.status === 'NOT_IMPLEMENTED') {
        gapSeverity = control.category?.toLowerCase().includes('security') ? 'high' : 'medium';
      } else if (control.status === 'PARTIAL') {
        gapSeverity = 'low';
      }

      return {
        id: control.id,
        framework: control.framework.name,
        control: `${control.controlId} - ${control.title}`,
        description: control.description,
        severity: gapSeverity,
        recommendation: generateRecommendation(control.status, control.category)
      };
    });

    // Filter by severity if specified
    const filteredGaps = severity 
      ? gaps.filter(gap => gap.severity === severity)
      : gaps;

    res.json({
      success: true,
      data: filteredGaps
    });

  } catch (error) {
    logger.error('Get compliance gaps error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/compliance/assessments:
 *   get:
 *     summary: Get recent compliance assessments
 *     tags: [Compliance]
 *     security:
 *       - bearerAuth: []
 */
router.get('/assessments', [
  authenticateToken,
  requirePermission('compliance:read'),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
], async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const recentAssessments = await prisma.complianceControl.findMany({
      where: {
        lastAssessedAt: { not: null }
      },
      take: limit,
      orderBy: { lastAssessedAt: 'desc' },
      include: {
        framework: {
          select: {
            name: true,
            version: true
          }
        },
        assessedBy: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    // Group by framework and date
    const assessmentsByFramework = {};
    recentAssessments.forEach(control => {
      const frameworkKey = `${control.framework.name}_${control.lastAssessedAt.toDateString()}`;
      if (!assessmentsByFramework[frameworkKey]) {
        assessmentsByFramework[frameworkKey] = {
          id: `${control.frameworkId}_${control.lastAssessedAt.getTime()}`,
          framework: control.framework.name,
          date: control.lastAssessedAt.toISOString(),
          assessor: control.assessedBy?.name || 'Unknown',
          controlsAssessed: 0
        };
      }
      assessmentsByFramework[frameworkKey].controlsAssessed++;
    });

    const assessments = Object.values(assessmentsByFramework);

    res.json({
      success: true,
      data: assessments
    });

  } catch (error) {
    logger.error('Get compliance assessments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Helper function to recalculate framework compliance score
async function recalculateFrameworkScore(frameworkId) {
  try {
    const controls = await prisma.complianceControl.findMany({
      where: { frameworkId },
      select: { status: true }
    });

    if (controls.length === 0) {
      return;
    }

    const implementedCount = controls.filter(c => c.status === 'IMPLEMENTED').length;
    const partialCount = controls.filter(c => c.status === 'PARTIAL').length;
    
    // Calculate weighted score (implemented = 1, partial = 0.5, not_implemented = 0)
    const score = Math.round(((implementedCount + (partialCount * 0.5)) / controls.length) * 100);

    await prisma.complianceFramework.update({
      where: { id: frameworkId },
      data: { 
        complianceScore: score,
        lastAssessedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('Recalculate framework score error:', error);
  }
}

// Helper function to generate recommendations
function generateRecommendation(status, category) {
  const recommendations = {
    'NOT_IMPLEMENTED': {
      'Access Control': 'Implement proper access controls and authentication mechanisms',
      'Security': 'Establish security policies and procedures',
      'Operations': 'Implement operational security measures',
      'Risk Management': 'Develop risk assessment and mitigation strategies',
      'default': 'Implement the required control measures'
    },
    'PARTIAL': {
      'Access Control': 'Review and complete access control implementation',
      'Security': 'Enhance existing security measures',
      'Operations': 'Improve operational procedures',
      'Risk Management': 'Strengthen risk management processes',
      'default': 'Complete the implementation of control measures'
    }
  };

  return recommendations[status]?.[category] || recommendations[status]?.default || 'Review and implement required measures';
}

module.exports = router;