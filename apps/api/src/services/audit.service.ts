/**
 * 审计日志服务
 * 记录所有关键操作，支持异常告警
 */
import { prisma } from '@autoads/database';
import { logger } from '../utils/logger';
import { Request } from 'express';

export interface AuditEntry {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  details?: any;
  result?: 'success' | 'failed' | 'denied';
  errorMessage?: string;
  severity?: 'info' | 'warning' | 'critical';
  ipAddress?: string;
  userAgent?: string;
}

/**
 * 记录审计日志
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId || null,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId || null,
        resourceName: entry.resourceName || null,
        details: entry.details || null,
        result: entry.result || 'success',
        errorMessage: entry.errorMessage || null,
        severity: entry.severity || 'info',
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
      }
    });

    // 高风险事件打 warning 日志
    if (entry.severity === 'critical' || entry.severity === 'warning') {
      logger.warn(`[AUDIT:${entry.severity.toUpperCase()}] ${entry.action} on ${entry.resourceType}:${entry.resourceId} by user:${entry.userId} — ${entry.errorMessage || 'N/A'}`);
    }
  } catch (err) {
    // 审计日志写入失败不应影响主流程，但要记录
    logger.error('[AUDIT] Failed to write audit log:', err);
  }
}

/**
 * 从 Express Request 提取审计上下文
 */
export function extractAuditContext(req: Request): Pick<AuditEntry, 'userId' | 'ipAddress' | 'userAgent'> {
  return {
    userId: req.user?.userId,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'] as string,
  };
}

/**
 * 便捷函数：从 Request 创建完整审计条目
 */
export function auditFromReq(
  req: Request,
  action: string,
  resourceType: string,
  extra?: Partial<AuditEntry>
): Promise<void> {
  const ctx = extractAuditContext(req);
  return logAudit({
    ...ctx,
    action,
    resourceType,
    ...extra,
  });
}

/**
 * 获取最近的异常告警 (供 Dashboard 显示)
 */
export async function getRecentAlerts(limit: number = 20) {
  return prisma.auditLog.findMany({
    where: {
      severity: { in: ['warning', 'critical'] },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: { select: { id: true, displayName: true, username: true } }
    }
  });
}

/**
 * 查询审计日志 (管理员)
 */
export async function queryAuditLogs(params: {
  userId?: string;
  action?: string;
  resourceType?: string;
  severity?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};

  if (params.userId) where.userId = params.userId;
  if (params.action) where.action = params.action;
  if (params.resourceType) where.resourceType = params.resourceType;
  if (params.severity) where.severity = params.severity;
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) where.createdAt.gte = params.startDate;
    if (params.endDate) where.createdAt.lte = params.endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit || 50,
      skip: params.offset || 0,
      include: {
        user: { select: { id: true, displayName: true, username: true, role: true } }
      }
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { data: logs, total };
}
