import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { prisma } from '@autoads/database';
import { asyncHandler } from '../middleware/errorHandler';
import { requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';
import { RuleEngineService } from '../services/ruleEngine.service';

const router = Router();

// Rules 只有优化师和管理员可以访问
router.use(requireRole('admin', 'optimizer'));

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
        },
        owner: { select: { id: true, displayName: true, username: true } }
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
          take: 20
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
    body('conditions').isArray(),
    body('actions').isArray(),
    body('conditionLogic').optional().isIn(['AND', 'OR']),
    body('notifyEmails').optional().isArray(),
    body('cooldownMinutes').optional().isInt({ min: 0 }),
    body('maxExecutions').optional().isInt({ min: 1 }),
  ],
  asyncHandler(async (req, res) => {
    const rule = await prisma.automationRule.create({
      data: {
        ...req.body,
        status: 'draft',
        isActive: false,
        executionCount: 0,
        ownerId: req.user?.userId,
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
    body('conditions').optional().isArray(),
    body('actions').optional().isArray(),
    body('targetIds').optional().isArray(),
    body('notifyEmails').optional().isArray(),
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

// POST /api/rules/:id/test - Test rule conditions (dry run, no actions executed)
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

    // Auto-discover targets when targetIds is empty (same as real execution)
    let targetIds = rule.targetIds || [];
    let autoDiscovered = false;
    if (targetIds.length === 0) {
      targetIds = await RuleEngineService.getAllActiveTargetIds(rule.applyTo);
      autoDiscovered = true;
      if (targetIds.length === 0) {
        return res.json({
          data: {
            ruleId: id,
            testedAt: new Date().toISOString(),
            result: 'skipped',
            message: `No active ${rule.applyTo} targets found for testing`
          }
        });
      }
    }

    // Use max time window across all conditions (matches real execution logic)
    const conditions = (rule.conditions as any[]) || [];
    const timeWindowHours = RuleEngineService.getMaxTimeWindow(conditions);

    const testResults = [];
    for (const targetId of targetIds) {
      const performanceData = await RuleEngineService.getPerformanceData(
        rule.applyTo,
        targetId,
        timeWindowHours
      );
      const conditionsMet = RuleEngineService.evaluateConditions(rule, performanceData);

      testResults.push({
        targetId,
        conditionsMet,
        performanceData,
        wouldTrigger: conditionsMet,
        actionsThatWouldExecute: conditionsMet
          ? (rule.actions as any[]).map(a => a.type)
          : []
      });
    }

    res.json({
      data: {
        ruleId: id,
        testedAt: new Date().toISOString(),
        autoDiscovered,
        targetsTested: testResults.length,
        targetsThatWouldTrigger: testResults.filter(r => r.conditionsMet).length,
        results: testResults
      }
    });
  })
);

// POST /api/rules/:id/execute - Manually execute a rule
router.post(
  '/:id/execute',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const rule = await prisma.automationRule.findUnique({
      where: { id }
    });

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    logger.info(`[RulesAPI] Manual execution triggered for rule ${id}`);

    const result = await RuleEngineService.executeRule(rule);

    // Record execution log
    await prisma.ruleExecutionLog.create({
      data: {
        ruleId: rule.id,
        status: result.errors.length > 0 && result.targetsTriggered === 0 ? 'failed' : 'success',
        triggerData: {
          targetsChecked: result.targetsChecked,
          targetsTriggered: result.targetsTriggered,
          actionsExecuted: result.actionsExecuted,
        },
        actionsTaken: result.logs,
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
      },
    });

    // Update execution count if any target triggered
    if (result.targetsTriggered > 0) {
      await prisma.automationRule.update({
        where: { id: rule.id },
        data: { executionCount: { increment: 1 } },
      });
    }

    res.json({
      data: {
        ...result,
        message: result.targetsTriggered > 0
          ? `Rule triggered for ${result.targetsTriggered} target(s), ${result.actionsExecuted} action(s) executed`
          : 'Rule checked but no targets met conditions'
      }
    });
  })
);

// POST /api/rules/run-all - Run all active rules (for cron jobs)
router.post(
  '/run-all',
  [],
  asyncHandler(async (req, res) => {
    logger.info('[RulesAPI] Running all active rules');

    const result = await RuleEngineService.runAllActiveRules();

    res.json({
      data: {
        ...result,
        runAt: new Date().toISOString(),
      }
    });
  })
);

export { router as rulesRouter };
