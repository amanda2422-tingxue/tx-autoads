/**
 * 凭据总览接口
 * 提供全局视角的凭据总览、系统状态等
 * - admin: 可见所有人的所有凭据
 * - optimizer: 只能看到自己的凭据
 */
import { Router } from 'express';
import { prisma } from '@autoads/database';
import { authenticate, requireRole } from '../middleware/auth';
import { decrypt } from '../utils/encryption';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
const router = Router();

// admin + optimizer 均可访问（operator 只读自己的数据）
router.use(authenticate, requireRole('admin', 'optimizer'));

/**
 * GET /api/admin/credentials-overview
 * 返回凭据总览（无全局行，仅展示个人凭据）
 * - admin: 所有用户的所有凭据
 * - optimizer: 仅自己的凭据
 */
router.get(
  '/credentials-overview',
  asyncHandler(async (req, res) => {
    const isAdmin = req.user!.role === 'admin';

    // 非 admin 只能查看自己的记录
    const whereClause = isAdmin ? {} : { userId: req.user!.userId };

    const credentials = await prisma.metaCredential.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
          },
        },
      },
      orderBy: [{ userId: 'asc' }, { isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    // 构建凭据行（一人多行，每条凭据一行）
    const rows = credentials.map((cred) => {
      let appId = '';
      let adAccountId = '';
      let pageId = '';

      try {
        if (cred.metaAppId) appId = decrypt(cred.metaAppId);
      } catch { appId = '(decrypt failed)'; }

      try {
        if (cred.metaAdAccountId) adAccountId = decrypt(cred.metaAdAccountId);
      } catch { adAccountId = '(decrypt failed)'; }

      try {
        if (cred.metaPageId) pageId = decrypt(cred.metaPageId);
      } catch { pageId = '(decrypt failed)'; }

      // tokenSource -> tokenType
      let tokenType: 'system_user' | 'user_token' | 'unconfigured';
      if (!cred.metaAccessToken) {
        tokenType = 'unconfigured';
      } else if (cred.tokenSource === 'system_user_token') {
        tokenType = 'system_user';
      } else {
        tokenType = 'user_token';
      }

      // tokenStatus 映射
      let tokenStatus: 'valid' | 'expired' | 'unconfigured';
      if (!cred.metaAccessToken) {
        tokenStatus = 'unconfigured';
      } else if (cred.tokenStatus === 'expired' || cred.tokenStatus === 'invalid') {
        tokenStatus = 'expired';
      } else {
        tokenStatus = 'valid';
      }

      return {
        credentialId: cred.id,
        userName: cred.user?.displayName || cred.user?.username || 'Unknown',
        userId: cred.userId,
        role: cred.user?.role || 'unknown',
        alias: cred.alias,
        isDefault: cred.isDefault,
        appId: appId || '(not set)',
        adAccountId: adAccountId || '(not set)',
        pageId: pageId || '(not set)',
        tokenType,
        tokenStatus,
        lastVerifiedAt: cred.lastVerifiedAt?.toISOString() || null,
        updatedAt: cred.updatedAt?.toISOString() || null,
      };
    });

    res.json({ data: rows });
  })
);

export { router as adminRouter };
