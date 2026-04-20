import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { prisma } from '@autoads/database';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/rules - List all automation rules
router.get(
  '/',
  [
    query('status').optional().isIn(['draft', 'active', 'paused', 'archived']),
    query('ruleType').optional().isIn(['budget', 'bid', 'status', 'notification']),
    query('isActive').optional().isBoolean(),
  ],
  asyncHandler(async (req, res) => {
    const { status, ruleType, isActive } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (ruleType) where.ruleType = ruleType;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const rules = await prisma.automationRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { executionLogs: true }
        }
      }
    });

    res.json({ data: rules });
  })
);

// GET /api/rules/:id - Get rule by ID
router.get(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const rule = await prisma.automationRule.findUnique({
      where: { id },
      include: {
        executionLogs: {
          orderBy: { executedAt: 'desc' },
          take: 50
        }
      }
    });

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({ data: rule });
  })
);

// POST /api/rules - Create new rule
router.post(
  '/',
  [
    body('name').notEmpty().trim(),
    body('description').optional().trim(),
    body('ruleType').isIn(['budget', 'bid', 'status', 'notification']),
    body('applyTo').isIn(['campaign', 'adset', 'ad']),
    body('targetIds').isArray(),
    body('conditions').isObject(),
    body('actions').isObject(),
    body('notifyEmails').optional().isArray(),
  ],
  asyncHandler(async (req, res) => {
    const rule = await prisma.automationRule.create({
      data: {
        ...req.body,
        status: 'draft',
        isActive: false,
        executionCount: 0
      }
    });

    logger.info(`Automation rule created: ${rule.id}`);
    res.status(201).json({ data: rule });
  })
);

// PUT /api/rules/:id - Update rule
router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim(),
    body('description').optional().trim(),
    body('status').optional().isIn(['draft', 'active', 'paused', 'archived']),
    body('isActive').optional().isBoolean(),
    body('conditions').optional().isObject(),
    body('actions').optional().isObject(),
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const rule = await prisma.automationRule.update({
      where: { id },
      data: req.body
    });

    logger.info(`Automation rule updated: ${id}`);
    res.json({ data: rule });
  })
);

// POST /api/rules/:id/activate - Activate rule
router.post(
  '/:id/activate',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const rule = await prisma.automationRule.update({
      where: { id },
      data: { 
        status: 'active',
        isActive: true 
      }
    });

    logger.info(`Automation rule activated: ${id}`);
    res.json({ data: rule });
  })
);

// POST /api/rules/:id/deactivate - Deactivate rule
router.post(
  '/:id/deactivate',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const rule = await prisma.automationRule.update({
      where: { id },
      data: { 
        status: 'paused',
        isActive: false 
      }
    });

    logger.info(`Automation rule deactivated: ${id}`);
    res.json({ data: rule });
  })
);

// DELETE /api/rules/:id - Delete rule
router.delete(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await prisma.automationRule.delete({
      where: { id }
    });

    logger.info(`Automation rule deleted: ${id}`);
    res.status(204).send();
  })
);

// GET /api/rules/:id/logs - Get rule execution logs
router.get(
  '/:id/logs',
  [
    param('id').isUUID(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const [logs, total] = await Promise.all([
      prisma.ruleExecutionLog.findMany({
        where: { ruleId: id },
        take: Number(limit),
        skip: Number(offset),
        orderBy: { executedAt: 'desc' }
      }),
      prisma.ruleExecutionLog.count({ where: { ruleId: id } })
    ]);

    res.json({
      data: logs,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + logs.length < total
      }
    });
  })
);

// POST /api/rules/:id/test - Test rule conditions
router.post(
  '/:id/test',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const rule = await prisma.automationRule.findUnique({
      where: { id }
    });

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    // TODO: Implement rule condition testing logic
    // This would check if the conditions are met without executing actions

    res.json({
      data: {
        ruleId: id,
        testedAt: new Date().toISOString(),
        result: 'pending',
        message: 'Rule test functionality to be implemented'
      }
    });
  })
);

export { router as rulesRouter };
