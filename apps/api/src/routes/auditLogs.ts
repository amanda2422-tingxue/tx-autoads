/**
 * 审计日志路由
 */
import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { queryAuditLogs, getRecentAlerts } from '../services/audit.service';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.use(authenticate);

/**
 * GET /api/audit-logs
 * 查询审计日志 (Admin 查全部, 其他角色只看自己)
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { userId, action, resourceType, severity, startDate, endDate, limit, offset } = req.query;

  const params: any = {
    limit: parseInt(limit as string) || 50,
    offset: parseInt(offset as string) || 0,
  };

  // 非 admin 只能看自己的日志
  if (req.user!.role !== 'admin') {
    params.userId = req.user!.userId;
  } else {
    if (userId) params.userId = userId as string;
  }

  if (action) params.action = action as string;
  if (resourceType) params.resourceType = resourceType as string;
  if (severity) params.severity = severity as string;
  if (startDate) params.startDate = new Date(startDate as string);
  if (endDate) params.endDate = new Date(endDate as string);

  const result = await queryAuditLogs(params);
  res.json(result);
}));

/**
 * GET /api/audit-logs/alerts
 * 获取最近异常告警 (供 Dashboard 显示)
 */
router.get('/alerts', asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const alerts = await getRecentAlerts(limit);
  res.json({ data: alerts });
}));

export { router as auditLogsRouter };
