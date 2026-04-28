/**
 * 认证路由 — 注册/登录/刷新Token/当前用户
 */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '@autoads/database';
import { signToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { authenticate, optionalAuth } from '../middleware/auth';
import { logAudit, extractAuditContext } from '../services/audit.service';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * POST /api/auth/register
 * 用户注册 (仅 admin 可调用，或系统初始化时无用户可注册第一个 admin)
 */
router.post('/register', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, displayName, role } = req.body;

  // 参数校验
  if (!username || !email || !password || !displayName) {
    return res.status(400).json({ error: '用户名、邮箱、密码和显示名称不能为空' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度至少 6 位' });
  }

  // 检查是否是第一个用户（系统初始化）
  const userCount = await prisma.user.count();
  const isFirstUser = userCount === 0;

  // 非首个用户时需要 admin 权限
  if (!isFirstUser) {
    if (!req.user) {
      return res.status(401).json({ error: '请先登录' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '仅管理员可创建用户' });
    }
  }

  // 检查用户名和邮箱唯一性
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] }
  });
  if (existing) {
    return res.status(409).json({
      error: existing.username === username ? '用户名已被使用' : '邮箱已被注册'
    });
  }

  // 创建用户
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      displayName,
      role: isFirstUser ? 'admin' : (role || 'optimizer'),
    },
    select: { id: true, username: true, email: true, displayName: true, role: true, createdAt: true },
  });

  // 审计日志
  await logAudit({
    ...extractAuditContext(req),
    userId: req.user?.userId || user.id,
    action: 'create_user',
    resourceType: 'user',
    resourceId: user.id,
    resourceName: user.displayName,
    details: { username, email, role: user.role, isFirstUser },
    severity: 'info',
  });

  res.status(201).json({
    data: user,
    message: isFirstUser ? '管理员账户创建成功' : '用户创建成功',
  });
}));

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  // 查找用户 (支持用户名或邮箱登录)
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: username },
        { email: username },
      ],
    },
  });

  if (!user) {
    await logAudit({
      ...extractAuditContext(req),
      action: 'login_failed',
      resourceType: 'auth',
      details: { username, reason: 'user_not_found' },
      result: 'failed',
      severity: 'warning',
    });
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  if (!user.isActive) {
    await logAudit({
      ...extractAuditContext(req),
      userId: user.id,
      action: 'login_failed',
      resourceType: 'auth',
      details: { reason: 'account_disabled' },
      result: 'denied',
      severity: 'warning',
    });
    return res.status(403).json({ error: '账户已被禁用，请联系管理员' });
  }

  // 验证密码
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    await logAudit({
      ...extractAuditContext(req),
      userId: user.id,
      action: 'login_failed',
      resourceType: 'auth',
      details: { reason: 'invalid_password' },
      result: 'failed',
      severity: 'warning',
    });
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  // 签发 Token
  const payload = { userId: user.id, username: user.username, role: user.role };
  const accessToken = signToken(payload);
  const refreshToken = signRefreshToken(payload);

  // 更新登录记录
  const loginIp = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress;
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: loginIp || null },
  });

  // 审计日志
  await logAudit({
    ...extractAuditContext(req),
    userId: user.id,
    action: 'login',
    resourceType: 'auth',
    result: 'success',
  });

  res.json({
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    }
  });
}));

/**
 * POST /api/auth/refresh
 * 刷新 Token
 */
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: '缺少刷新令牌' });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);

    // 确认用户仍然存在且活跃
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: '用户已不存在或已禁用' });
    }

    // 重新签发（使用最新的角色信息）
    const newPayload = { userId: user.id, username: user.username, role: user.role };
    const newAccessToken = signToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload);

    res.json({
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      }
    });
  } catch (error) {
    return res.status(401).json({ error: '刷新令牌无效或已过期' });
  }
}));

/**
 * GET /api/auth/me
 * 获取当前登录用户信息
 */
router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true, username: true, email: true, displayName: true,
      role: true, avatar: true, isActive: true,
      lastLoginAt: true, createdAt: true,
      metaCredentials: {
        where: { isDefault: true },
        take: 1,
        select: {
          id: true,
          alias: true,
          isDefault: true,
          metaAdAccountId: true,
          metaPageId: true,
          tokenStatus: true,
          lastVerifiedAt: true,
        }
      }
    }
  });

  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  // 不返回加密的凭据原文，只返回 "是否已配置" 状态
  const defaultCred = user.metaCredentials?.[0];
  const metaStatus = defaultCred ? {
    configured: true,
    hasToken: !!defaultCred.metaAdAccountId,
    tokenStatus: defaultCred.tokenStatus,
    lastVerifiedAt: defaultCred.lastVerifiedAt,
    alias: defaultCred.alias,
  } : { configured: false };

  res.json({
    data: {
      ...user,
      metaCredentials: undefined,
      metaStatus,
    }
  });
}));

/**
 * POST /api/auth/change-password
 * 修改密码
 */
router.post('/change-password', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '当前密码和新密码不能为空' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密码长度至少 6 位' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return res.status(400).json({ error: '当前密码错误' });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  await logAudit({
    ...extractAuditContext(req),
    userId: user.id,
    action: 'change_password',
    resourceType: 'user',
    resourceId: user.id,
  });

  res.json({ message: '密码修改成功' });
}));

/**
 * GET /api/auth/check-init
 * 检查系统是否已初始化 (是否有用户)
 */
router.get('/check-init', asyncHandler(async (_req: Request, res: Response) => {
  const userCount = await prisma.user.count();
  res.json({
    data: {
      initialized: userCount > 0,
      userCount,
    }
  });
}));

export { router as authRouter };
