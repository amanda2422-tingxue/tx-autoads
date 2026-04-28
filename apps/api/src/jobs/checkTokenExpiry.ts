/**
 * Token 过期预警定时任务
 * 每天检查一次所有个人 Meta 凭据的过期状态
 * 对 7 天内即将过期的 Token 记录告警日志
 */
import { prisma } from '@autoads/database';
import { logger } from '../utils/logger';

const WARNING_DAYS = 7;

export async function checkTokenExpiry(): Promise<{
  checked: number;
  expiringSoon: number;
  alreadyExpired: number;
  warnings: string[];
}> {
  const result = {
    checked: 0,
    expiringSoon: 0,
    alreadyExpired: 0,
    warnings: [] as string[],
  };

  const now = new Date();
  const warningThreshold = new Date(now.getTime() + WARNING_DAYS * 24 * 60 * 60 * 1000);

  // 获取所有已配置 Access Token 的凭据
  const credentials = await prisma.metaCredential.findMany({
    where: {
      metaAccessToken: { not: null },
      tokenSource: { not: 'system_user_token' }, // System User Token 永不过期，跳过
    },
    include: {
      user: { select: { username: true, displayName: true, email: true } },
    },
  });

  result.checked = credentials.length;

  for (const cred of credentials) {
    const userName = cred.user?.displayName || cred.user?.username || 'unknown';

    // 情况1：已明确过期
    if (cred.tokenExpiresAt && cred.tokenExpiresAt <= now) {
      result.alreadyExpired++;
      result.warnings.push(
        `[TokenExpiry] ${userName} 的 Token 已过期（过期时间: ${cred.tokenExpiresAt.toISOString()}）`
      );
      logger.warn(`[TokenExpiry] ${userName}'s token has EXPIRED at ${cred.tokenExpiresAt.toISOString()}`);

      // 更新数据库状态为 expired
      if (cred.tokenStatus !== 'expired') {
        await prisma.metaCredential.update({
          where: { id: cred.id },
          data: { tokenStatus: 'expired' },
        });
      }
      continue;
    }

    // 情况2：即将过期（7天内）
    if (cred.tokenExpiresAt && cred.tokenExpiresAt <= warningThreshold) {
      const daysLeft = Math.ceil((cred.tokenExpiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      result.expiringSoon++;
      result.warnings.push(
        `[TokenExpiry] ${userName} 的 Token 将在 ${daysLeft} 天后过期（过期时间: ${cred.tokenExpiresAt.toISOString()}）`
      );
      logger.warn(
        `[TokenExpiry] ${userName}'s token expires in ${daysLeft} days (${cred.tokenExpiresAt.toISOString()})`
      );
      continue;
    }

    // 情况3：tokenExpiresAt 为空但 tokenSource 不是 system_user_token
    // 说明凭据是在添加 inspectToken 功能之前保存的，需要提醒用户重新验证
    if (!cred.tokenExpiresAt && cred.tokenStatus !== 'expired' && cred.tokenStatus !== 'unknown') {
      logger.info(
        `[TokenExpiry] ${userName}'s token has no expiry info. Recommend re-verifying to update metadata.`
      );
    }
  }

  if (result.expiringSoon > 0 || result.alreadyExpired > 0) {
    logger.warn(
      `[TokenExpiry] Summary: checked=${result.checked}, expiringSoon=${result.expiringSoon}, expired=${result.alreadyExpired}`
    );
  } else {
    logger.info(`[TokenExpiry] All ${result.checked} tokens are healthy`);
  }

  return result;
}
