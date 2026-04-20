import { Router } from 'express';
import { query } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import axios from 'axios';

const router = Router();

const META_API_VERSION = process.env.META_API_VERSION || 'v18.0';
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;

// Meta API client
const metaApi = axios.create({
  baseURL: `https://graph.facebook.com/${META_API_VERSION}`,
  timeout: 30000,
});

// Add token to requests
metaApi.interceptors.request.use((config) => {
  if (META_ACCESS_TOKEN) {
    config.params = config.params || {};
    config.params.access_token = META_ACCESS_TOKEN;
  }
  return config;
});

// GET /api/meta/health - Check Meta API connection
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    if (!META_ACCESS_TOKEN) {
      return res.status(503).json({
        status: 'error',
        message: 'Meta API not configured. Please set META_ACCESS_TOKEN environment variable.'
      });
    }

    try {
      const response = await metaApi.get('/me', {
        params: { fields: 'id,name' }
      });

      res.json({
        status: 'ok',
        connected: true,
        user: response.data
      });
    } catch (error: any) {
      logger.error('Meta API health check failed:', error.message);
      res.status(503).json({
        status: 'error',
        connected: false,
        message: error.response?.data?.error?.message || error.message
      });
    }
  })
);

// GET /api/meta/accounts - Get ad accounts
router.get(
  '/accounts',
  asyncHandler(async (req, res) => {
    try {
      const response = await metaApi.get('/me/adaccounts', {
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

// GET /api/meta/campaigns - Get campaigns from Meta
router.get(
  '/campaigns',
  [
    query('accountId').optional(),
    query('status').optional(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const { accountId, status, limit = 25 } = req.query;
    const targetAccountId = accountId || META_AD_ACCOUNT_ID;

    if (!targetAccountId) {
      return res.status(400).json({
        error: 'Missing accountId',
        message: 'Please provide accountId query parameter or set META_AD_ACCOUNT_ID environment variable'
      });
    }

    try {
      const params: any = {
        fields: 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time'
      };

      if (status) {
        params.effective_status = status;
      }

      const response = await metaApi.get(`/${targetAccountId}/campaigns`, {
        params: {
          ...params,
          limit
        }
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

// GET /api/meta/insights - Get campaign insights
router.get(
  '/insights',
  [
    query('campaignId').optional(),
    query('adSetId').optional(),
    query('adId').optional(),
    query('since').optional().isISO8601(),
    query('until').optional().isISO8601(),
  ],
  asyncHandler(async (req, res) => {
    const { campaignId, adSetId, adId, since, until } = req.query;

    // Determine the object to query
    let objectId = META_AD_ACCOUNT_ID;
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
    }

    if (!objectId) {
      return res.status(400).json({
        error: 'Missing object ID',
        message: 'Please provide campaignId, adSetId, adId, or set META_AD_ACCOUNT_ID'
      });
    }

    try {
      const params: any = {
        fields: 'impressions,clicks,spend,ctr,cpc,cpp,reach,frequency,conversions,cost_per_conversion',
        level
      };

      if (since && until) {
        params.time_range = {
          since,
          until
        };
      } else {
        params.date_preset = 'last_30d';
      }

      const response = await metaApi.get(`/${objectId}/insights`, { params });

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
    // TODO: Implement data sync logic
    // This would fetch campaigns, adsets, ads, and insights from Meta
    // and store them in the local database

    logger.info('Starting Meta data sync');

    res.json({
      status: 'started',
      message: 'Data sync initiated',
      timestamp: new Date().toISOString()
    });
  })
);

export { router as metaRouter };
