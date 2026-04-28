/**
 * Meta API 凭据管理路由
 * 个人化 Meta 凭据的 CRUD + Token 验证
 * 支持一人多凭据（1:N）
 */
import { Router, Request, Response } from 'express';
import { prisma } from '@autoads/database';
import { authenticate, requireRole } from '../middleware/auth';
import { encrypt, decrypt } from '../utils/encryption';
import { auditFromReq } from '../services/audit.service';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import axios from 'axios';

const router = Router();

// 只有优化师和管理员可以管理 Meta 凭据
router.use(authenticate, requireRole('admin', 'optimizer'));

/**
 * 调用 Meta debug_token 解析 Token 元数据
 * 返回 expiresAt（0 表示永不过期）、tokenSource、scopes 等
 */
async function inspectToken(
  accessToken: string,
  appId?: string,
  appSecret?: string,
  apiVersion: string = 'v21.0'
): Promise<{
  isValid: boolean;
  tokenSource: string;
  expiresAt: Date | null;
  scopes: string[];
  type: string;
  userId?: string;
} | null> {
  const appAccessToken = appId && appSecret ? `${appId}|${appSecret}` : undefined;
  if (!appAccessToken) {
    logger.warn('[TokenInspect] No app_id/app_secret provided, skipping debug_token inspection');
    return null;
  }

  try {
    const response = await axios.get(
      `https://graph.facebook.com/${apiVersion}/debug_token`,
      {
        params: {
          input_token: accessToken,
          access_token: appAccessToken,
        },
        timeout: 10000,
      }
    );

    const data = response.data?.data;
    if (!data) return null;

    const isValid = data.is_valid === true;
    const expiresAtTimestamp = data.expires_at;
    const expiresAt = expiresAtTimestamp === 0 ? null : new Date(expiresAtTimestamp * 1000);
    const tokenSource = expiresAtTimestamp === 0 ? 'system_user_token' : 'user_token';

    return {
      isValid,
      tokenSource,
      expiresAt,
      scopes: data.scopes || [],
      type: data.type || 'UNKNOWN',
      userId: data.user_id,
    };
  } catch (error: any) {
    logger.error('[TokenInspect] debug_token failed:', error.response?.data?.error?.message || error.message);
    return null;
  }
}

// ===================== 工具函数 =====================

/** 验证凭据归属当前用户 */
async function findOwnedCredential(credentialId: string, userId: string) {
  const credential = await prisma.metaCredential.findUnique({
    where: { id: credentialId },
  });
  if (!credential || credential.userId !== userId) return null;
  return credential;
}

/** 脱敏显示 */
const maskValue = (val: string | null): string | null => {
  if (!val) return null;
  try {
    const decrypted = decrypt(val);
    if (decrypted.length <= 8) return '****';
    return decrypted.substring(0, 4) + '****' + decrypted.substring(decrypted.length - 4);
  } catch {
    return '****';
  }
};

// ===================== 路由 =====================

/**
 * GET /api/meta-credentials
 * 获取当前用户的所有 Meta 凭据列表（不返回明文密钥）
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const credentials = await prisma.metaCredential.findMany({
    where: { userId: req.user!.userId },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  });

  const data = credentials.map((cred) => ({
    id: cred.id,
    alias: cred.alias,
    isDefault: cred.isDefault,
    configured: !!cred.metaAccessToken,
    metaAppId: maskValue(cred.metaAppId),
    metaAdAccountId: maskValue(cred.metaAdAccountId),
    metaPageId: maskValue(cred.metaPageId),
    tokenSource: cred.tokenSource,
    tokenStatus: cred.tokenStatus,
    tokenExpiresAt: cred.tokenExpiresAt,
    lastVerifiedAt: cred.lastVerifiedAt,
    hasAccessToken: !!cred.metaAccessToken,
    hasAppSecret: !!cred.metaAppSecret,
    createdAt: cred.createdAt,
    updatedAt: cred.updatedAt,
  }));

  res.json({ data });
}));

/**
 * POST /api/meta-credentials
 * 创建新的 Meta 凭据（支持一人多凭据）
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { alias, metaAppId, metaAppSecret, metaAccessToken, metaAdAccountId, metaPageId } = req.body;

  const credentialAlias = alias || '默认账户';

  // 检查别名是否已存在
  const existing = await prisma.metaCredential.findUnique({
    where: { userId_alias: { userId: req.user!.userId, alias: credentialAlias } },
  });
  if (existing) {
    return res.status(409).json({ error: `凭据别名「${credentialAlias}」已存在` });
  }

  // 如果是用户的第一条凭据，自动设为默认
  const count = await prisma.metaCredential.count({ where: { userId: req.user!.userId } });
  const isDefault = count === 0;

  // 加密所有敏感字段
  const encryptedData: any = {};
  if (metaAppId) encryptedData.metaAppId = encrypt(metaAppId);
  if (metaAppSecret) encryptedData.metaAppSecret = encrypt(metaAppSecret);
  if (metaAccessToken) encryptedData.metaAccessToken = encrypt(metaAccessToken);
  if (metaAdAccountId) encryptedData.metaAdAccountId = encrypt(metaAdAccountId);
  if (metaPageId) encryptedData.metaPageId = encrypt(metaPageId);

  const credential = await prisma.metaCredential.create({
    data: {
      userId: req.user!.userId,
      alias: credentialAlias,
      isDefault,
      ...encryptedData,
      tokenStatus: 'unknown',
    },
  });

  // 自动解析 Token 过期时间和来源
  let tokenSource = 'unknown';
  let tokenExpiresAt: Date | null = null;
  if (metaAccessToken && metaAppId && metaAppSecret) {
    const inspection = await inspectToken(metaAccessToken, metaAppId, metaAppSecret);
    if (inspection) {
      tokenSource = inspection.tokenSource;
      tokenExpiresAt = inspection.expiresAt;
      await prisma.metaCredential.update({
        where: { id: credential.id },
        data: { tokenSource, tokenExpiresAt },
      });
    }
  }

  await auditFromReq(req, 'create_meta_credential', 'meta_credential', {
    resourceId: credential.id,
    details: { alias: credentialAlias, isDefault, tokenSource },
  });

  res.status(201).json({
    message: 'Meta API 凭据已创建',
    data: { id: credential.id, alias: credentialAlias, isDefault, tokenSource, tokenExpiresAt },
  });
}));

/**
 * PUT /api/meta-credentials/:id
 * 更新指定凭据（验证归属）
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const credential = await findOwnedCredential(req.params.id, req.user!.userId);
  if (!credential) {
    return res.status(404).json({ error: '凭据不存在或无权访问' });
  }

  const { alias, metaAppId, metaAppSecret, metaAccessToken, metaAdAccountId, metaPageId } = req.body;

  // 检查别名冲突
  if (alias !== undefined && alias !== credential.alias) {
    const existing = await prisma.metaCredential.findUnique({
      where: { userId_alias: { userId: req.user!.userId, alias } },
    });
    if (existing) {
      return res.status(409).json({ error: `凭据别名「${alias}」已存在` });
    }
  }

  // 加密更新字段
  const encryptedData: any = {};
  if (alias !== undefined) encryptedData.alias = alias;
  if (metaAppId !== undefined) encryptedData.metaAppId = metaAppId ? encrypt(metaAppId) : null;
  if (metaAppSecret !== undefined) encryptedData.metaAppSecret = metaAppSecret ? encrypt(metaAppSecret) : null;
  if (metaAccessToken !== undefined) encryptedData.metaAccessToken = metaAccessToken ? encrypt(metaAccessToken) : null;
  if (metaAdAccountId !== undefined) encryptedData.metaAdAccountId = metaAdAccountId ? encrypt(metaAdAccountId) : null;
  if (metaPageId !== undefined) encryptedData.metaPageId = metaPageId ? encrypt(metaPageId) : null;

  await prisma.metaCredential.update({
    where: { id: credential.id },
    data: {
      ...encryptedData,
      tokenStatus: 'unknown', // 更新后需要重新验证
    },
  });

  // 自动解析 Token 过期时间和来源
  let tokenSource = 'unknown';
  let tokenExpiresAt: Date | null = null;
  if (metaAccessToken && metaAppId && metaAppSecret) {
    const inspection = await inspectToken(metaAccessToken, metaAppId, metaAppSecret);
    if (inspection) {
      tokenSource = inspection.tokenSource;
      tokenExpiresAt = inspection.expiresAt;
      await prisma.metaCredential.update({
        where: { id: credential.id },
        data: { tokenSource, tokenExpiresAt },
      });
    }
  }

  await auditFromReq(req, 'update_meta_credential', 'meta_credential', {
    resourceId: credential.id,
    details: { fieldsUpdated: Object.keys(encryptedData), tokenSource, tokenExpiresAt },
  });

  res.json({
    message: 'Meta API 凭据已更新（加密存储）',
    data: { id: credential.id, tokenSource, tokenExpiresAt },
  });
}));

/**
 * DELETE /api/meta-credentials/:id
 * 删除指定凭据（验证归属）
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const credential = await findOwnedCredential(req.params.id, req.user!.userId);
  if (!credential) {
    return res.status(404).json({ error: '凭据不存在或无权访问' });
  }

  const wasDefault = credential.isDefault;

  await prisma.metaCredential.delete({ where: { id: credential.id } });

  // 如果删除的是默认凭据，自动将最新的一条设为默认
  if (wasDefault) {
    const next = await prisma.metaCredential.findFirst({
      where: { userId: req.user!.userId },
      orderBy: { updatedAt: 'desc' },
    });
    if (next) {
      await prisma.metaCredential.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  await auditFromReq(req, 'delete_meta_credential', 'meta_credential', {
    resourceId: credential.id,
    severity: 'warning',
    details: { alias: credential.alias },
  });

  res.json({ message: 'Meta API 凭据已删除' });
}));

/**
 * POST /api/meta-credentials/:id/verify
 * 验证指定凭据的 Token 有效性
 */
router.post('/:id/verify', asyncHandler(async (req: Request, res: Response) => {
  const credential = await findOwnedCredential(req.params.id, req.user!.userId);
  if (!credential) {
    return res.status(404).json({ error: '凭据不存在或无权访问' });
  }

  if (!credential.metaAccessToken) {
    return res.status(400).json({ error: '尚未配置 Meta Access Token' });
  }

  let accessToken: string;
  let appId: string | undefined;
  let appSecret: string | undefined;

  try {
    accessToken = decrypt(credential.metaAccessToken);
    appId = credential.metaAppId ? decrypt(credential.metaAppId) : undefined;
    appSecret = credential.metaAppSecret ? decrypt(credential.metaAppSecret) : undefined;
  } catch (decryptErr: any) {
    logger.error('[Verify] Decrypt failed:', decryptErr.message);
    try {
      await prisma.metaCredential.update({
        where: { id: credential.id },
        data: { tokenStatus: 'invalid', lastVerifiedAt: new Date() },
      });
    } catch { /* ignore */ }
    return res.json({
      data: { valid: false, tokenStatus: 'invalid', error: '凭据解密失败，请重新配置' },
    });
  }

  try {
    // 调用 Meta API 验证 Token
    const response = await axios.get(`https://graph.facebook.com/v21.0/me`, {
      params: { access_token: accessToken, fields: 'id,name' },
      timeout: 10000,
    });

    // 同时调用 debug_token 解析 Token 元数据
    const inspection = appId && appSecret
      ? await inspectToken(accessToken, appId, appSecret)
      : null;

    const updateData: any = {
      tokenStatus: 'valid',
      lastVerifiedAt: new Date(),
    };
    if (inspection) {
      updateData.tokenSource = inspection.tokenSource;
      updateData.tokenExpiresAt = inspection.expiresAt;
    }

    await prisma.metaCredential.update({
      where: { id: credential.id },
      data: updateData,
    });

    res.json({
      data: {
        valid: true,
        metaUser: response.data,
        tokenStatus: 'valid',
        tokenSource: inspection?.tokenSource || credential.tokenSource,
        tokenExpiresAt: inspection?.expiresAt?.toISOString() || null,
      }
    });
  } catch (error: any) {
    const errorData = error.response?.data?.error;
    const tokenStatus = errorData?.code === 190 ? 'expired' : 'invalid';

    try {
      await prisma.metaCredential.update({
        where: { id: credential.id },
        data: { tokenStatus, lastVerifiedAt: new Date() },
      });
    } catch (dbUpdateErr: any) {
      logger.error('[Verify] Failed to update token status:', dbUpdateErr.message);
    }

    try {
      await auditFromReq(req, 'meta_token_verify_failed', 'meta_credential', {
        resourceId: credential.id,
        result: 'failed',
        severity: 'warning',
        errorMessage: errorData?.message || error.message,
      });
    } catch (auditErr: any) {
      logger.error('[Verify] Audit log failed:', auditErr.message);
    }

    res.json({
      data: {
        valid: false,
        tokenStatus,
        error: errorData?.message || '验证失败',
      }
    });
  }
}));

/**
 * PUT /api/meta-credentials/:id/set-default
 * 设置指定凭据为默认（取消其他默认标记）
 */
router.put('/:id/set-default', asyncHandler(async (req: Request, res: Response) => {
  const credential = await findOwnedCredential(req.params.id, req.user!.userId);
  if (!credential) {
    return res.status(404).json({ error: '凭据不存在或无权访问' });
  }

  // 先将当前用户的所有凭据标记为非默认
  await prisma.metaCredential.updateMany({
    where: { userId: req.user!.userId },
    data: { isDefault: false },
  });

  // 再将目标凭据标记为默认
  await prisma.metaCredential.update({
    where: { id: credential.id },
    data: { isDefault: true },
  });

  await auditFromReq(req, 'set_default_meta_credential', 'meta_credential', {
    resourceId: credential.id,
    details: { alias: credential.alias },
  });

  res.json({ message: `凭据「${credential.alias}」已设为默认` });
}));

export { router as metaCredentialsRouter };

// ===================== 内部服务调用 =====================

/**
 * 获取用户的默认凭据（供推送逻辑调用）
 * 只返回 isDefault=true 的那条
 */
export async function getMetaCredentialForUser(userId: string): Promise<{
  accessToken: string;
  adAccountId: string;
  pageId: string;
  appId: string;
  appSecret: string;
  apiVersion: string;
} | null> {
  const credential = await prisma.metaCredential.findFirst({
    where: { userId, isDefault: true },
  });

  if (!credential || !credential.metaAccessToken) {
    return null;
  }

  try {
    return {
      accessToken: decrypt(credential.metaAccessToken),
      adAccountId: credential.metaAdAccountId ? decrypt(credential.metaAdAccountId) : '',
      pageId: credential.metaPageId ? decrypt(credential.metaPageId) : '',
      appId: credential.metaAppId ? decrypt(credential.metaAppId) : '',
      appSecret: credential.metaAppSecret ? decrypt(credential.metaAppSecret) : '',
      apiVersion: 'v21.0',
    };
  } catch (error) {
    logger.error(`[TokenDispatch] Failed to decrypt credentials for user ${userId}:`, error);
    return null;
  }
}

/**
 * 根据 Campaign Owner 获取默认 Meta 凭据
 * 先查 Campaign -> ownerId -> MetaCredential (isDefault=true)
 */
export async function getMetaCredentialForCampaign(campaignId: string): Promise<ReturnType<typeof getMetaCredentialForUser>> {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    select: { ownerId: true },
  });

  if (!campaign?.ownerId) {
    logger.warn(`[TokenDispatch] Campaign ${campaignId} has no owner, falling back to env credentials`);
    return null;
  }

  return getMetaCredentialForUser(campaign.ownerId);
}
