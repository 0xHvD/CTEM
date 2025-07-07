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

// Store for tracking report generation progress
const reportProgress = new Map();

/**
 * @swagger
 * components:
 *   schemas:
 *     Report:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         type:
 *           type: string
 *           enum: [assets, vulnerabilities, risks, compliance]
 *         status:
 *           type: string
 *           enum: [pending, generating, completed, failed, scheduled]
 *         format:
 *           type: string
 *           enum: [pdf, excel, csv, html]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         completedAt:
 *           type: string
 *           format: date-time
 *         createdBy:
 *           type: string
 *         size:
 *           type: integer
 *         downloadUrl:
 *           type: string
 *         progress:
 *           type: integer
 *         parameters:
 *           type: object
 *         schedule:
 *           type: object
 *           properties:
 *             frequency:
 *               type: string
 *               enum: [once, daily, weekly, monthly]
 *             nextRun:
 *               type: string
 *               format: date-time
 *             lastRun:
 *               type: string
 *               format: date-time
 *         recipients:
 *           type: array
 *           items:
 *             type: string
 *         error:
 *           type: string
 */

/**
 * @swagger
 * /api/reports:
 *   get:
 *     summary: Get all reports with filtering and pagination
 *     tags: [Reports]
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
 *           enum: [assets, vulnerabilities, risks, compliance]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, generating, completed, failed, scheduled]
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [pdf, excel, csv, html]
 *       - in: query
 *         name: createdBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, completedAt, name, type]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of reports
 */
router.get('/', [
  authenticateToken,
  requirePermission('reports:read'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('type').optional().isIn(['assets', 'vulnerabilities', 'risks', 'compliance']),
  query('status').optional().isIn(['pending', 'generating', 'completed', 'failed', 'scheduled']),
  query('format').optional().isIn(['pdf', 'excel', 'csv', 'html']),
  query('createdBy').optional().isUUID(),
  query('sortBy').optional().isIn(['createdAt', 'completedAt', 'name', 'type']),
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
      type,
      status,
      format,
      createdBy,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build where clause
    const whereClause = {};

    if (type) {
      whereClause.type = type.toUpperCase();
    }

    if (status) {
      whereClause.status = status.toUpperCase();
    }

    if (format) {
      whereClause.format = format.toUpperCase();
    }

    if (createdBy) {
      whereClause.createdById = createdBy;
    }

    // Non-admin users can only see their own reports
    if (req.user.role !== 'ADMIN') {
      whereClause.createdById = req.user.id;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build order by clause
    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where: whereClause,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy,
        skip,
        take: limit
      }),
      prisma.report.count({ where: whereClause })
    ]);

    // Add progress information for generating reports
    const enrichedReports = reports.map(report => ({
      ...report,
      progress: reportProgress.get(report.id) || 0,
      type: report.type.toLowerCase(),
      status: report.status.toLowerCase(),
      format: report.format.toLowerCase()
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        reports: enrichedReports,
        total,
        page,
        totalPages
      }
    });

  } catch (error) {
    logger.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/reports/{id}:
 *   get:
 *     summary: Get a specific report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', [
  authenticateToken,
  requirePermission('reports:read'),
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

    const whereClause = { id };

    // Non-admin users can only see their own reports
    if (req.user.role !== 'ADMIN') {
      whereClause.createdById = req.user.id;
    }

    const report = await prisma.report.findUnique({
      where: whereClause,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Add progress information
    const enrichedReport = {
      ...report,
      progress: reportProgress.get(report.id) || 0,
      type: report.type.toLowerCase(),
      status: report.status.toLowerCase(),
      format: report.format.toLowerCase()
    };

    res.json({
      success: true,
      data: enrichedReport
    });

  } catch (error) {
    logger.error('Get report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/reports/generate:
 *   post:
 *     summary: Generate a new report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.post('/generate', [
  authenticateToken,
  requirePermission('reports:create'),
  auditLog('CREATE', 'REPORT'),
  body('type').isIn(['assets', 'vulnerabilities', 'risks', 'compliance']),
  body('format').optional().isIn(['pdf', 'excel', 'csv', 'html']),
  body('name').optional().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('parameters').optional().isObject(),
  body('recipients').optional().isArray()
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
      type,
      format = 'pdf',
      name,
      description,
      parameters = {},
      recipients = []
    } = req.body;

    // Generate report name if not provided
    const reportName = name || `${type.charAt(0).toUpperCase() + type.slice(1)} Report - ${new Date().toISOString().split('T')[0]}`;

    // Create report record
    const report = await prisma.report.create({
      data: {
        name: reportName,
        description,
        type: type.toUpperCase(),
        format: format.toUpperCase(),
        status: 'PENDING',
        parameters,
        recipients,
        createdById: req.user.id
      }
    });

    // Start report generation asynchronously
    generateReportAsync(report.id, type, format, parameters, req.user.id);

    res.status(201).json({
      success: true,
      data: {
        reportId: report.id,
        status: 'pending'
      },
      message: 'Report generation started'
    });

  } catch (error) {
    logger.error('Generate report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/reports/{id}/download:
 *   get:
 *     summary: Download a completed report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/download', [
  authenticateToken,
  requirePermission('reports:read'),
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

    const whereClause = { id };

    // Non-admin users can only download their own reports
    if (req.user.role !== 'ADMIN') {
      whereClause.createdById = req.user.id;
    }

    const report = await prisma.report.findUnique({
      where: whereClause
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    if (report.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Report is not ready for download'
      });
    }

    if (!report.downloadUrl) {
      return res.status(400).json({
        success: false,
        message: 'Download URL not available'
      });
    }

    // In a real implementation, you would serve the file from storage
    // For now, we'll generate a sample report content
    const reportContent = await generateReportContent(report.type, report.format, report.parameters);

    const contentType = getContentType(report.format);
    const filename = `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}.${report.format.toLowerCase()}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(reportContent);

  } catch (error) {
    logger.error('Download report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/reports/{id}/cancel:
 *   post:
 *     summary: Cancel a pending report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/cancel', [
  authenticateToken,
  requirePermission('reports:update'),
  auditLog('CANCEL', 'REPORT'),
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

    const whereClause = { id };

    // Non-admin users can only cancel their own reports
    if (req.user.role !== 'ADMIN') {
      whereClause.createdById = req.user.id;
    }

    const report = await prisma.report.findUnique({
      where: whereClause
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    if (!['PENDING', 'GENERATING'].includes(report.status)) {
      return res.status(400).json({
        success: false,
        message: 'Report cannot be cancelled'
      });
    }

    await prisma.report.update({
      where: { id },
      data: {
        status: 'FAILED',
        error: 'Cancelled by user'
      }
    });

    // Remove from progress tracking
    reportProgress.delete(id);

    res.json({
      success: true,
      message: 'Report cancelled successfully'
    });

  } catch (error) {
    logger.error('Cancel report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/reports/{id}:
 *   delete:
 *     summary: Delete a report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', [
  authenticateToken,
  requirePermission('reports:delete'),
  auditLog('DELETE', 'REPORT'),
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

    const whereClause = { id };

    // Non-admin users can only delete their own reports
    if (req.user.role !== 'ADMIN') {
      whereClause.createdById = req.user.id;
    }

    const report = await prisma.report.findUnique({
      where: whereClause
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    await prisma.report.delete({
      where: { id }
    });

    // Remove from progress tracking
    reportProgress.delete(id);

    // TODO: Delete actual report file from storage

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });

  } catch (error) {
    logger.error('Delete report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/reports/schedule:
 *   post:
 *     summary: Schedule a recurring report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.post('/schedule', [
  authenticateToken,
  requirePermission('reports:create'),
  auditLog('SCHEDULE', 'REPORT'),
  body('type').isIn(['assets', 'vulnerabilities', 'risks', 'compliance']),
  body('name').trim().isLength({ min: 1, max: 200 }),
  body('format').optional().isIn(['pdf', 'excel', 'csv', 'html']),
  body('schedule.frequency').isIn(['daily', 'weekly', 'monthly']),
  body('schedule.time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('schedule.dayOfWeek').optional().isInt({ min: 0, max: 6 }),
  body('schedule.dayOfMonth').optional().isInt({ min: 1, max: 31 }),
  body('parameters').optional().isObject(),
  body('recipients').optional().isArray()
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
      type,
      name,
      format = 'pdf',
      schedule,
      parameters = {},
      recipients = []
    } = req.body;

    // Calculate next run time
    const nextRun = calculateNextRun(schedule);

    // Create scheduled report
    const report = await prisma.report.create({
      data: {
        name,
        type: type.toUpperCase(),
        format: format.toUpperCase(),
        status: 'SCHEDULED',
        parameters,
        recipients,
        schedule: {
          frequency: schedule.frequency,
          time: schedule.time || '09:00',
          dayOfWeek: schedule.dayOfWeek,
          dayOfMonth: schedule.dayOfMonth,
          nextRun: nextRun.toISOString()
        },
        createdById: req.user.id
      }
    });

    // Set up cron job for scheduled report
    setupScheduledReport(report);

    res.status(201).json({
      success: true,
      data: report,
      message: 'Report scheduled successfully'
    });

  } catch (error) {
    logger.error('Schedule report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/reports/stats:
 *   get:
 *     summary: Get report statistics
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', [
  authenticateToken,
  requirePermission('reports:read')
], async (req, res) => {
  try {
    const whereClause = req.user.role !== 'ADMIN' ? { createdById: req.user.id } : {};

    const [
      totalReports,
      reportsByType,
      reportsByStatus,
      reportsByFormat,
      recentReports
    ] = await Promise.all([
      prisma.report.count({ where: whereClause }),
      prisma.report.groupBy({
        by: ['type'],
        _count: true,
        where: whereClause
      }),
      prisma.report.groupBy({
        by: ['status'],
        _count: true,
        where: whereClause
      }),
      prisma.report.groupBy({
        by: ['format'],
        _count: true,
        where: whereClause
      }),
      prisma.report.count({
        where: {
          ...whereClause,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      })
    ]);

    const typeStats = reportsByType.reduce((acc, item) => {
      acc[item.type.toLowerCase()] = item._count;
      return acc;
    }, {});

    const statusStats = reportsByStatus.reduce((acc, item) => {
      acc[item.status.toLowerCase()] = item._count;
      return acc;
    }, {});

    const formatStats = reportsByFormat.reduce((acc, item) => {
      acc[item.format.toLowerCase()] = item._count;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalReports,
        recentReports,
        typeStats,
        statusStats,
        formatStats
      }
    });

  } catch (error) {
    logger.error('Get report statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Helper functions

async function generateReportAsync(reportId, type, format, parameters, userId) {
  try {
    // Update status to generating
    await prisma.report.update({
      where: { id: reportId },
      data: { status: 'GENERATING' }
    });

    // Initialize progress
    reportProgress.set(reportId, 0);

    // Simulate report generation with progress updates
    for (let i = 0; i <= 100; i += 10) {
      reportProgress.set(reportId, i);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Generate report content
    const content = await generateReportContent(type, format, parameters);
    const size = Buffer.byteLength(content);

    // In a real implementation, you would save the file to storage
    // and get the actual download URL
    const downloadUrl = `/api/reports/${reportId}/download`;

    // Update report as completed
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        size,
        downloadUrl
      }
    });

    // Clean up progress tracking
    reportProgress.delete(reportId);

    logger.info(`Report ${reportId} generated successfully`);

  } catch (error) {
    logger.error(`Report generation failed for ${reportId}:`, error);

    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'FAILED',
        error: error.message
      }
    });

    reportProgress.delete(reportId);
  }
}

async function generateReportContent(type, format, parameters) {
  // This is a simplified report generation
  // In a real implementation, you would use proper reporting libraries
  
  const data = await getReportData(type, parameters);
  
  switch (format.toLowerCase()) {
    case 'csv':
      return generateCSV(data);
    case 'html':
      return generateHTML(data, type);
    case 'pdf':
      return generatePDF(data, type);
    case 'excel':
      return generateExcel(data, type);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

async function getReportData(type, parameters) {
  // Fetch data based on report type and parameters
  switch (type.toLowerCase()) {
    case 'assets':
      return await prisma.asset.findMany({
        include: {
          vulnerabilities: true
        }
      });
    case 'vulnerabilities':
      return await prisma.vulnerability.findMany({
        include: {
          affectedAssets: true
        }
      });
    case 'risks':
      return await prisma.risk.findMany({
        include: {
          relatedAssets: true,
          relatedVulnerabilities: true
        }
      });
    case 'compliance':
      return await prisma.complianceFramework.findMany({
        include: {
          controls: true
        }
      });
    default:
      throw new Error(`Unsupported report type: ${type}`);
  }
}

function generateCSV(data) {
  if (!data || data.length === 0) {
    return 'No data available';
  }

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

function generateHTML(data, type) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${type.charAt(0).toUpperCase() + type.slice(1)} Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .header { text-align: center; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${type.charAt(0).toUpperCase() + type.slice(1)} Report</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
      </div>
      <table>
        <thead>
          <tr>
            ${data.length > 0 ? Object.keys(data[0]).map(key => `<th>${key}</th>`).join('') : '<th>No data</th>'}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `<tr>${Object.values(row).map(value => `<td>${value}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
}

function generatePDF(data, type) {
  // In a real implementation, you would use a PDF library like puppeteer or pdfkit
  // For now, return a simple text representation
  return `${type.charAt(0).toUpperCase() + type.slice(1)} Report\n\nGenerated on: ${new Date().toLocaleString()}\n\nData:\n${JSON.stringify(data, null, 2)}`;
}

function generateExcel(data, type) {
  // In a real implementation, you would use a library like exceljs
  // For now, return CSV format
  return generateCSV(data);
}

function getContentType(format) {
  const contentTypes = {
    'pdf': 'application/pdf',
    'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'csv': 'text/csv',
    'html': 'text/html'
  };
  return contentTypes[format.toLowerCase()] || 'application/octet-stream';
}

function calculateNextRun(schedule) {
  const now = new Date();
  const nextRun = new Date(now);
  
  const [hours, minutes] = (schedule.time || '09:00').split(':').map(Number);
  nextRun.setHours(hours, minutes, 0, 0);
  
  switch (schedule.frequency) {
    case 'daily':
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;
    case 'weekly':
      const dayOfWeek = schedule.dayOfWeek || 1; // Default to Monday
      const daysUntilNext = (dayOfWeek - nextRun.getDay() + 7) % 7;
      nextRun.setDate(nextRun.getDate() + (daysUntilNext || 7));
      break;
    case 'monthly':
      const dayOfMonth = schedule.dayOfMonth || 1;
      nextRun.setDate(dayOfMonth);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;
  }
  
  return nextRun;
}

function setupScheduledReport(report) {
  // In a real implementation, you would set up proper cron jobs
  // For now, we'll just log the scheduled report
  logger.info(`Scheduled report setup: ${report.name} (${report.id})`);
}

module.exports = router;