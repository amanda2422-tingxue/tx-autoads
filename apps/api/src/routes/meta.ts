import { Router } from 'express';
import { query } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getMetaApiClient } from '../services/metaApi.service';
import { getMetaCredentialForUser } from './metaCredentials';
import axios from 'axios';

const router = Router();

/**
 * 用当前用户的个人凭据构建一个一次性 axios client
 * 若用户未配置凭据则返回 null
 */
async function getPersonalClient(userId: string) {
  const cred = await getMetaCredentialForUser(userId);
  if (!cred) return null;
  const client = axios.create({
    baseURL: `https://graph.facebook.com/${cred.apiVersion}`,
    timeout: 60000,
  });
  client.interceptors.request.use((reqConfig) => {
    reqConfig.params = reqConfig.params || {};
    reqConfig.params.access_token = cred.accessToken;
    return reqConfig;
  });
  return { client, cred };
}

// GET /api/meta/health - Check Meta API connection (global system token only)
// 职责：验证全局 .env 中的 META_ACCESS_TOKEN 是否可用
// 不再暴露 adAccountId / pageId（这些属于个人凭据，非系统职责）
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const hasGlobalToken = !!process.env.META_ACCESS_TOKEN;

    if (!hasGlobalToken) {
      return res.status(503).json({
        status: 'error',
        message: 'Meta API not configured. Please set META_ACCESS_TOKEN environment variable.',
        configured: {
          accessToken: false,
          apiVersion: process.env.META_API_VERSION || 'v21.0',
        },
      });
    }

    try {
      const client = getMetaApiClient();
      const response = await client.get('/me', {
        params: { fields: 'id,name' }
      });

      // Also check pages access
      let pages: any[] = [];
      try {
        const pagesResponse = await client.get('/me/accounts', {
          params: { fields: 'id,name,access_token' }
        });
        pages = pagesResponse.data?.data || [];
      } catch { /* pages access might not be available */ }

      res.json({
        status: 'ok',
        connected: true,
        user: response.data,
        pages: pages.map((p: any) => ({ id: p.id, name: p.name })),
        config: {
          apiVersion: process.env.META_API_VERSION || 'v21.0',
        },
      });
    } catch (error: any) {
      logger.error('Meta API health check failed:', error.message);
      res.status(503).json({
        status: 'error',
        connected: false,
        message: error.response?.data?.error?.message || error.message,
      });
    }
  })
);

// 以下路由需要认证
router.use(authenticate);

// GET /api/meta/accounts - Get ad accounts (使用当前用户的个人凭据)
router.get(
  '/accounts',
  asyncHandler(async (req: any, res) => {
    try {
      const personal = await getPersonalClient(req.user!.userId);
      if (!personal) {
        return res.status(400).json({
          error: '未配置个人 Meta API 凭据',
          message: '请在「设置」页面配置 Meta 凭据后再使用此功能。',
        });
      }

      const response = await personal.client.get('/me/adaccounts', {
        params: {
          fields: 'id,name,account_status,currency,timezone_name'
        }
      });

      res.json({
        data: response.data.data,
        paging: response.data.paging
      });
    } catch (error: any) {
      logger.error('Failed to fetch ad accounts:', error.message);
      res.status(500).json({
        error: 'Failed to fetch ad accounts',
        message: error.response?.data?.error?.message || error.message
      });
    }
  })
);

// GET /api/meta/pages - Get Facebook pages the user manages (使用个人凭据)
router.get(
  '/pages',
  asyncHandler(async (req: any, res) => {
    try {
      const personal = await getPersonalClient(req.user!.userId);
      if (!personal) {
        return res.status(400).json({
          error: '未配置个人 Meta API 凭据',
          message: '请在「设置」页面配置 Meta 凭据后再使用此功能。',
        });
      }

      const response = await personal.client.get('/me/accounts', {
        params: {
          fields: 'id,name,category,access_token,picture{url}'
        }
      });

      res.json({
        data: response.data.data,
        paging: response.data.paging
      });
    } catch (error: any) {
      logger.error('Failed to fetch pages:', error.message);
      res.status(500).json({
        error: 'Failed to fetch pages',
        message: error.response?.data?.error?.message || error.message
      });
    }
  })
);

// GET /api/meta/campaigns - Get campaigns from Meta (使用个人凭据)
router.get(
  '/campaigns',
  [
    query('accountId').optional(),
    query('status').optional(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  asyncHandler(async (req: any, res) => {
    const { accountId, status, limit = 25 } = req.query;

    const personal = await getPersonalClient(req.user!.userId);
    if (!personal) {
      return res.status(400).json({
        error: '未配置个人 Meta API 凭据',
        message: '请在「设置」页面配置 Meta 凭据后再使用此功能。',
      });
    }

    const targetAccountId = accountId || personal.cred.adAccountId;
    if (!targetAccountId) {
      return res.status(400).json({
        error: 'Missing accountId',
        message: '请提供 accountId 参数或在个人凭据中配置 Ad Account ID',
      });
    }

    const formattedAccountId = targetAccountId.startsWith('act_') ? targetAccountId : `act_${targetAccountId}`;

    try {
      const params: any = {
        fields: 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time'
      };

      if (status) {
        params.effective_status = status;
      }

      const response = await personal.client.get(`/${formattedAccountId}/campaigns`, {
        params: { ...params, limit }
      });

      res.json({
        data: response.data.data,
        paging: response.data.paging
      });
    } catch (error: any) {
      logger.error('Failed to fetch campaigns:', error.message);
      res.status(500).json({
        error: 'Failed to fetch campaigns',
        message: error.response?.data?.error?.message || error.message
      });
    }
  })
);

// GET /api/meta/insights - Get campaign insights (使用个人凭据)
router.get(
  '/insights',
  [
    query('campaignId').optional(),
    query('adSetId').optional(),
    query('adId').optional(),
    query('since').optional().isISO8601(),
    query('until').optional().isISO8601(),
  ],
  asyncHandler(async (req: any, res) => {
    const { campaignId, adSetId, adId, since, until } = req.query;

    const personal = await getPersonalClient(req.user!.userId);
    if (!personal) {
      return res.status(400).json({
        error: '未配置个人 Meta API 凭据',
        message: '请在「设置」页面配置 Meta 凭据后再使用此功能。',
      });
    }

    let objectId: string | undefined;
    let level = 'account';

    if (adId) {
      objectId = adId as string;
      level = 'ad';
    } else if (adSetId) {
      objectId = adSetId as string;
      level = 'adset';
    } else if (campaignId) {
      objectId = campaignId as string;
      level = 'campaign';
    } else {
      // 默认使用个人凭据中的 adAccountId
      const acctId = personal.cred.adAccountId;
      if (!acctId) {
        return res.status(400).json({
          error: 'Missing object ID',
          message: '请提供 campaignId、adSetId 或 adId，或在个人凭据中配置 Ad Account ID',
        });
      }
      objectId = acctId.startsWith('act_') ? acctId : `act_${acctId}`;
    }

    try {
      const params: any = {
        fields: 'impressions,clicks,spend,ctr,cpc,cpp,reach,frequency,conversions,cost_per_conversion',
        level
      };

      if (since && until) {
        params.time_range = { since, until };
      } else {
        params.date_preset = 'last_30d';
      }

      const response = await personal.client.get(`/${objectId}/insights`, { params });

      res.json({
        data: response.data.data,
        paging: response.data.paging
      });
    } catch (error: any) {
      logger.error('Failed to fetch insights:', error.message);
      res.status(500).json({
        error: 'Failed to fetch insights',
        message: error.response?.data?.error?.message || error.message
      });
    }
  })
);

// POST /api/meta/sync - Sync data from Meta to local database
router.post(
  '/sync',
  asyncHandler(async (req, res) => {
    logger.info('Starting Meta data sync');
    res.json({
      status: 'started',
      message: 'Data sync initiated',
      timestamp: new Date().toISOString()
    });
  })
);

export { router as metaRouter };
