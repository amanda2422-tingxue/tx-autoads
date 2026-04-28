/**
 * 用户管理路由 (Admin only)
 */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '@autoads/database';
import { authenticate, requireRole } from '../middleware/auth';
import { auditFromReq } from '../services/audit.service';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// 所有用户管理接口需要 admin 权限
router.use(authenticate, requireRole('admin'));

/**
 * GET /api/users
 * 获取用户列表
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true, username: true, email: true, displayName: true,
      role: true, isActive: true, avatar: true,
      lastLoginAt: true, lastLoginIp: true,
      createdAt: true, updatedAt: true,
      metaCredentials: {
        where: { isDefault: true },
        take: 1,
        select: { tokenStatus: true, lastVerifiedAt: true }
      },
      _count: {
        select: { creatives: true, campaigns: true, automationRules: true }
      }
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json({ data: users });
}));

/**
 * GET /api/users/:id
 * 获取单个用户详情
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true, username: true, email: true, displayName: true,
      role: true, isActive: true, avatar: true,
      lastLoginAt: true, lastLoginIp: true,
      createdAt: true, updatedAt: true,
      _count: {
        select: { creatives: true, campaigns: true, automationRules: true, auditLogs: true }
      }
    },
  });

  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  res.json({ data: user });
}));

/**
 * PUT /api/users/:id
 * 更新用户信息 (角色、状态、显示名称等)
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { displayName, email, role, isActive } = req.body;

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  // 不能禁用自己
  if (req.params.id === req.user!.userId && isActive === false) {
    return res.status(400).json({ error: '不能禁用自己的账户' });
  }

  // 不能更改自己的角色
  if (req.params.id === req.user!.userId && role && role !== user.role) {
    return res.status(400).json({ error: '不能更改自己的角色' });
  }

  const updateData: any = {};
  if (displayName !== undefined) updateData.displayName = displayName;
  if (email !== undefined) updateData.email = email;
  if (role !== undefined) updateData.role = role;
  if (isActive !== undefined) updateData.isActive = isActive;

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: updateData,
    select: {
      id: true, username: true, email: true, displayName: true,
      role: true, isActive: true, avatar: true,
    },
  });

  await auditFromReq(req, 'update_user', 'user', {
    resourceId: user.id,
    resourceName: user.displayName,
    details: { before: { role: user.role, isActive: user.isActive }, after: updateData },
  });

  res.json({ data: updated, message: '用户信息更新成功' });
}));

/**
 * POST /api/users/:id/reset-password
 * 重置用户密码 (Admin)
 */
router.post('/:id/reset-password', asyncHandler(async (req: Request, res: Response) => {
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: '新密码长度至少 6 位' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash },
  });

  await auditFromReq(req, 'reset_password', 'user', {
    resourceId: user.id,
    resourceName: user.displayName,
    severity: 'warning',
  });

  res.json({ message: `用户 ${user.displayName} 的密码已重置` });
}));

/**
 * DELETE /api/users/:id
 * 删除用户
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  if (req.params.id === req.user!.userId) {
    return res.status(400).json({ error: '不能删除自己' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  await prisma.user.delete({ where: { id: req.params.id } });

  await auditFromReq(req, 'delete_user', 'user', {
    resourceId: user.id,
    resourceName: user.displayName,
    severity: 'warning',
    details: { username: user.username, role: user.role },
  });

  res.json({ message: `用户 ${user.displayName} 已删除` });
}));

export { router as usersRouter };
