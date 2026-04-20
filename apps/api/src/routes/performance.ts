import { Router } from 'express';
import { param, query } from 'express-validator';
import { prisma } from '@autoads/database';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/performance - Get performance data
router.get(
  '/',
  [
    query('level').optional().isIn(['campaign', 'adset', 'ad']),
    query('campaignId').optional().isUUID(),
    query('adSetId').optional().isUUID(),
    query('adId').optional().isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const { 
      level, 
      campaignId, 
      adSetId, 
      adId, 
      startDate, 
      endDate,
      limit = 100 
    } = req.query;

    const where: any = {};
    
    if (level) where.level = level;
    if (campaignId) where.campaignId = campaignId;
    if (adSetId) where.adSetId = adSetId;
    if (adId) where.adId = adId;
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    const performance = await prisma.adPerformance.findMany({
      where,
      take: Number(limit),
      orderBy: { date: 'desc' },
    });

    // Calculate aggregates
    const aggregates = performance.reduce((acc, curr) => ({
      totalSpend: acc.totalSpend + curr.spend,
      totalImpressions: acc.totalImpressions + curr.impressions,
      totalClicks: acc.totalClicks + curr.clicks,
      totalConversions: acc.totalConversions + curr.conversions,
    }), {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
    });

    const avgCtr = aggregates.totalImpressions > 0 
      ? (aggregates.totalClicks / aggregates.totalImpressions * 100).toFixed(2)
      : '0.00';
    
    const avgCpa = aggregates.totalConversions > 0
      ? (aggregates.totalSpend / aggregates.totalConversions).toFixed(2)
      : '0.00';

    res.json({
      data: performance,
      aggregates: {
        ...aggregates,
        avgCtr: `${avgCtr}%`,
        avgCpa: `$${avgCpa}`,
        avgCpc: aggregates.totalClicks > 0 
          ? `$${(aggregates.totalSpend / aggregates.totalClicks).toFixed(2)}`
          : '$0.00'
      }
    });
  })
);

// GET /api/performance/dashboard - Dashboard summary
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get summary for last 30 days
    const [summary, topCampaigns, dailyTrend] = await Promise.all([
      // Overall summary
      prisma.adPerformance.aggregate({
        where: {
          date: {
            gte: thirtyDaysAgo,
            lte: today
          }
        },
        _sum: {
          spend: true,
          impressions: true,
          clicks: true,
          conversions: true,
        },
        _avg: {
          ctr: true,
          cpa: true,
        }
      }),

      // Top campaigns by spend
      prisma.adPerformance.groupBy({
        by: ['campaignId'],
        where: {
          date: {
            gte: thirtyDaysAgo,
            lte: today
          },
          campaignId: { not: null }
        },
        _sum: {
          spend: true,
          conversions: true,
        },
        orderBy: {
          _sum: {
            spend: 'desc'
          }
        },
        take: 5
      }),

      // Daily trend
      prisma.adPerformance.groupBy({
        by: ['date'],
        where: {
          date: {
            gte: thirtyDaysAgo,
            lte: today
          }
        },
        _sum: {
          spend: true,
          impressions: true,
          clicks: true,
          conversions: true,
        },
        orderBy: {
          date: 'asc'
        }
      })
    ]);

    res.json({
      summary: {
        totalSpend: summary._sum.spend || 0,
        totalImpressions: summary._sum.impressions || 0,
        totalClicks: summary._sum.clicks || 0,
        totalConversions: summary._sum.conversions || 0,
        avgCtr: summary._avg.ctr || 0,
        avgCpa: summary._avg.cpa || 0,
      },
      topCampaigns,
      dailyTrend
    });
  })
);

// GET /api/performance/:id - Get specific performance record
router.get(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const performance = await prisma.adPerformance.findUnique({
      where: { id }
    });

    if (!performance) {
      return res.status(404).json({ error: 'Performance record not found' });
    }

    res.json({ data: performance });
  })
);

export { router as performanceRouter };
