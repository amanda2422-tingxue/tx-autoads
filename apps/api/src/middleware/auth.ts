/**
 * 认证与授权中间件
 * - authenticate: JWT Token 校验
 * - requireRole: 角色级访问控制
 * - requireOwnership: 资源所有权校验 (BOLA 防护)
 */
import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { prisma } from '@autoads/database';
import { logger } from '../utils/logger';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
        role: string;
      };
    }
  }
}

/**
 * JWT 认证中间件
 * 从 Authorization: Bearer <token> 头部提取并验证 Token
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: '未登录，请先登录',
      code: 'UNAUTHORIZED'
    });
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);
    req.user = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
    };
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: '登录已过期，请重新登录',
        code: 'TOKEN_EXPIRED'
      });
    }
    return res.status(401).json({
      error: '无效的认证令牌',
      code: 'INVALID_TOKEN'
    });
  }
}

/**
 * 可选认证中间件
 * 有 Token 就解析并挂载 req.user，没有则跳过（不返回 401）
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const payload = verifyToken(token);
      req.user = {
        userId: payload.userId,
        username: payload.username,
        role: payload.role,
      };
    } catch {
      // Token 无效时不设置 user，但不阻断请求
    }
  }

  next();
}

/**
 * 角色授权中间件
 * @param allowedRoles 允许的角色列表
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: '未登录', code: 'UNAUTHORIZED' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`[RBAC] 用户 ${req.user.username} (${req.user.role}) 尝试访问需要 [${allowedRoles.join(', ')}] 角色的资源`);
      return res.status(403).json({
        error: '权限不足，您的角色无法执行此操作',
        code: 'FORBIDDEN',
        requiredRoles: allowedRoles,
        currentRole: req.user.role,
      });
    }

    next();
  };
}

/**
 * 资源所有权校验中间件 (BOLA 防护)
 * 检查请求的资源是否属于当前用户 (admin 跳过)
 * @param modelName Prisma 模型名
 * @param paramKey  req.params 中的 ID 参数名
 * @param ownerField  模型中存放所有者 ID 的字段名
 */
export function requireOwnership(
  modelName: 'adCampaign' | 'creative' | 'automationRule' | 'savedReport',
  paramKey: string = 'id',
  ownerField: string = 'ownerId'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: '未登录', code: 'UNAUTHORIZED' });
    }

    // Admin 拥有全局写权限
    if (req.user.role === 'admin') {
      return next();
    }

    const resourceId = req.params[paramKey];
    if (!resourceId) {
      return next(); // 无具体资源 ID 的操作 (如列表/创建)
    }

    try {
      const model = prisma[modelName] as any;
      const resource = await model.findUnique({
        where: { id: resourceId },
        select: { [ownerField]: true },
      });

      if (!resource) {
        return res.status(404).json({ error: '资源不存在', code: 'NOT_FOUND' });
      }

      if (resource[ownerField] && resource[ownerField] !== req.user.userId) {
        logger.warn(
          `[BOLA] 用户 ${req.user.username} 试图操作不属于自己的 ${modelName}:${resourceId}，` +
          `实际所有者: ${resource[ownerField]}`
        );
        return res.status(403).json({
          error: '您只能操作自己创建的资源',
          code: 'OWNERSHIP_DENIED'
        });
      }

      next();
    } catch (error) {
      logger.error(`[Ownership Check] 校验失败:`, error);
      next(error);
    }
  };
}
