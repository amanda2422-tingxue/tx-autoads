import { Router } from 'express';
import { param, query } from 'express-validator';
import { prisma } from '@autoads/database';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import * as metaApiService from '../services/metaApi.service';
import dayjs from 'dayjs';

const router = Router();

// ===== 辅助函数：过滤 Mock/Unknown 数据 =====

function isMockCampaignName(name: string | null | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return (
    lower.startsWith('camp_test') ||
    lower.startsWith('meta_camp_') ||
    lower === 'unknown'
  );
}

async function getValidCampaignFilters(prismaInstance: typeof prisma) {
  const allCampaigns = await prismaInstance.adCampaign.findMany({
    select: { id: true, name: true },
  });

  const validCampaignIds = allCampaigns
    .filter((c) => !isMockCampaignName(c.name))
    .map((c) => c.id);

  const validAdSets =
    validCampaignIds.length > 0
      ? await prismaInstance.adSet.findMany({
          where: { campaignId: { in: validCampaignIds } },
          select: { id: true },
        })
      : [];
  const validAdSetIds = validAdSets.map((a) => a.id);

  const validAds =
    validAdSetIds.length > 0
      ? await prismaInstance.ad.findMany({
          where: { adSetId: { in: validAdSetIds } },
          select: { id: true },
        })
      : [];
  const validAdIds = validAds.map((a) => a.id);

  return { validCampaignIds, validAdSetIds, validAdIds };
}

// POST /api/performance/sync - 从 Meta API 同步表现数据
router.post(
  '/sync',
  asyncHandler(async (req, res) => {
    const { startDate, endDate, level } = req.body;

    // syncInsightsFromMeta 内部通过 resolveCredentialConfig 按 campaign 逐个获取个人凭据
    // 无需全局 isMetaConfigured 前置判断

    const syncResult = await metaApiService.syncInsightsFromMeta({
      startDate: startDate || dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
      endDate: endDate || dayjs().format('YYYY-MM-DD'),
      level,
    });

    logger.info(`[PerformanceSync] Synced ${syncResult.synced} records, ${syncResult.errors.length} errors`);

    res.json({
      data: {
        synced: syncResult.synced,
        errors: syncResult.errors,
        message: `成功同步 ${syncResult.synced} 条记录`,
      },
    });
  })
);

// GET /api/performance - 获取表现数据列表
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

// GET /api/performance/delivery-analysis - 投放数据多维度分析
router.get(
  '/delivery-analysis',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('dimension').optional().isIn(['campaign', 'country', 'designer']),
    query('campaignId').optional().isUUID(),
  ],
  asyncHandler(async (req, res) => {
    const { startDate, endDate, dimension = 'campaign', campaignId } = req.query;

    const today = new Date();
    const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const start = startDate ? new Date(startDate as string) : defaultStart;
    const end = endDate ? new Date(endDate as string) : today;

    // 过滤掉 Mock/Unknown 广告系列
    const { validCampaignIds, validAdSetIds, validAdIds } = await getValidCampaignFilters(prisma);
    const campaignIdFilter =
      validCampaignIds.length > 0 ? { in: validCampaignIds } : { in: [] as string[] };
    const adSetIdFilter =
      validAdSetIds.length > 0 ? { in: validAdSetIds } : { in: [] as string[] };
    const adIdFilter =
      validAdIds.length > 0 ? { in: validAdIds } : { in: [] as string[] };

    // 特定 campaign 请求时校验
    const requestedCampaignId = campaignId as string | undefined;
    if (requestedCampaignId && !validCampaignIds.includes(requestedCampaignId)) {
      return res.json({
        data: {
          summary: { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalConversions: 0, avgCtr: 0, avgCpa: 0 },
          dailyTrend: [],
          breakdown: [],
          campaignOptions: [],
        },
      });
    }

    // ===== 1. 总体汇总 =====
    const summaryWhere: any = {
      date: { gte: start, lte: end },
      level: 'campaign',
      campaignId: campaignIdFilter,
    };
    if (requestedCampaignId) summaryWhere.campaignId = requestedCampaignId;

    const summary = await prisma.adPerformance.aggregate({
      where: summaryWhere,
      _sum: { spend: true, impressions: true, clicks: true, conversions: true },
      _avg: { ctr: true, cpa: true },
    });

    // ===== 2. 每日趋势 =====
    const trendWhere: any = {
      date: { gte: start, lte: end },
      level: 'campaign',
      campaignId: campaignIdFilter,
    };
    if (requestedCampaignId) trendWhere.campaignId = requestedCampaignId;

    const dailyTrend = await prisma.adPerformance.groupBy({
      by: ['date'],
      where: trendWhere,
      _sum: { spend: true, impressions: true, clicks: true, conversions: true },
      _avg: { ctr: true, cpa: true },
      orderBy: { date: 'asc' },
    });

    // ===== 3. 按维度聚合 =====
    let breakdown: any[] = [];
    const benchmarks = await prisma.countryBenchmark.findMany();
    const benchmarkMap = new Map(benchmarks.map(b => [b.countryCode, b]));

    if (dimension === 'campaign') {
      // 按广告系列
      const campaignGroupWhere: any = {
        date: { gte: start, lte: end },
        level: 'campaign',
        campaignId: requestedCampaignId || campaignIdFilter,
      };
      const byCampaign = await prisma.adPerformance.groupBy({
        by: ['campaignId'],
        where: campaignGroupWhere,
        _sum: { spend: true, impressions: true, clicks: true, conversions: true },
        _avg: { ctr: true, cpa: true },
        orderBy: { _sum: { spend: 'desc' } },
      });
      const cIds = byCampaign.map(b => b.campaignId).filter(Boolean) as string[];
      // 获取 Campaign 的关联国家
      const campaigns = cIds.length > 0
        ? await prisma.adCampaign.findMany({ 
            where: { id: { in: cIds } }, 
            select: { id: true, name: true, status: true, objective: true, budgetAmount: true, budgetType: true, adSets: { select: { countryCode: true } } } 
          })
        : [];
      const cMap = new Map(campaigns.map(c => [c.id, c]));
      breakdown = byCampaign
        .map(b => {
          const c = cMap.get(b.campaignId!);
          // 计算该 Campaign 的 Payout (取第一个 AdSet 的国家)
          const countryCode = c?.adSets?.[0]?.countryCode;
          const payout = countryCode ? benchmarkMap.get(countryCode)?.payout || 0 : 0;
          
          const spend = b._sum.spend || 0;
          const conversions = b._sum.conversions || 0;
          const revenue = conversions * payout;
          const roi = spend > 0 ? (revenue - spend) / spend : 0;

          return {
            id: b.campaignId,
            name: c?.name || 'Unknown',
            status: c?.status,
            objective: c?.objective,
            budgetAmount: c?.budgetAmount,
            budgetType: c?.budgetType,
            spend,
            impressions: b._sum.impressions || 0,
            clicks: b._sum.clicks || 0,
            conversions,
            ctr: b._avg.ctr || 0,
            cpa: b._avg.cpa || 0,
            revenue,
            roi,
          };
        })
        .filter((b: any) => !isMockCampaignName(b.name));

    } else if (dimension === 'country') {
      // 按国家：通过 adset 的 countryCode 聚合
      const adSetPerf = await prisma.adPerformance.groupBy({
        by: ['adSetId'],
        where: {
          date: { gte: start, lte: end },
          level: 'adset',
          adSetId: adSetIdFilter,
          ...(requestedCampaignId ? { campaignId: requestedCampaignId } : {}),
        },
        _sum: { spend: true, impressions: true, clicks: true, conversions: true },
        _avg: { ctr: true, cpa: true },
      });
      const asIds = adSetPerf.map(a => a.adSetId).filter(Boolean) as string[];
      const adSets = asIds.length > 0
        ? await prisma.adSet.findMany({ where: { id: { in: asIds } }, select: { id: true, countryCode: true } })
        : [];
      const asMap = new Map(adSets.map(a => [a.id, a.countryCode || '未知']));
      // 按 country 合并
      const countryAgg: Record<string, any> = {};
      for (const p of adSetPerf) {
        const country = asMap.get(p.adSetId!) || '未知';
        if (!countryAgg[country]) countryAgg[country] = { name: country, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
        countryAgg[country].spend += p._sum.spend || 0;
        countryAgg[country].impressions += p._sum.impressions || 0;
        countryAgg[country].clicks += p._sum.clicks || 0;
        countryAgg[country].conversions += p._sum.conversions || 0;
      }
      breakdown = Object.values(countryAgg).map((c: any) => {
        const payout = benchmarkMap.get(c.name)?.payout || 0;
        const revenue = c.conversions * payout;
        return {
          ...c,
          ctr: c.impressions > 0 ? c.clicks / c.impressions : 0,
          cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
          revenue,
          roi: c.spend > 0 ? (revenue - c.spend) / c.spend : 0,
        };
      });
      breakdown.sort((a: any, b: any) => b.spend - a.spend);

    } else if (dimension === 'designer') {
      // 按设计师/优化师：通过 ad → creative.designer 聚合
      const adPerf = await prisma.adPerformance.groupBy({
        by: ['adId'],
        where: {
          date: { gte: start, lte: end },
          level: 'ad',
          adId: adIdFilter,
          ...(requestedCampaignId ? { campaignId: requestedCampaignId } : {}),
        },
        _sum: { spend: true, impressions: true, clicks: true, conversions: true },
        _avg: { ctr: true, cpa: true },
      });
      const adIdsFiltered = adPerf.map(a => a.adId).filter(Boolean) as string[];
      const ads = adIdsFiltered.length > 0
        ? await prisma.ad.findMany({ 
            where: { id: { in: adIdsFiltered } }, 
            include: { 
              creative: { select: { designer: true } },
              adSet: { select: { countryCode: true } }
            } 
          })
        : [];
      const adInfoMap = new Map(ads.map(a => [a.id, { designer: a.creative?.designer || '未知', countryCode: a.adSet?.countryCode }]));
      const designerAgg: Record<string, any> = {};
      for (const p of adPerf) {
        const info = adInfoMap.get(p.adId!) || { designer: '未知', countryCode: null };
        const designer = info.designer;
        if (!designerAgg[designer]) designerAgg[designer] = { name: designer, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, adCount: 0 };
        
        const spend = p._sum.spend || 0;
        const conversions = p._sum.conversions || 0;
        const payout = info.countryCode ? benchmarkMap.get(info.countryCode)?.payout || 0 : 0;
        const revenue = conversions * payout;

        designerAgg[designer].spend += spend;
        designerAgg[designer].impressions += p._sum.impressions || 0;
        designerAgg[designer].clicks += p._sum.clicks || 0;
        designerAgg[designer].conversions += conversions;
        designerAgg[designer].revenue += revenue;
        designerAgg[designer].adCount++;
      }
      breakdown = Object.values(designerAgg).map((d: any) => ({
        ...d,
        ctr: d.impressions > 0 ? d.clicks / d.impressions : 0,
        cpa: d.conversions > 0 ? d.spend / d.conversions : 0,
        roi: d.spend > 0 ? (d.revenue - d.spend) / d.spend : 0,
      }));
      breakdown.sort((a: any, b: any) => b.spend - a.spend);
    }

    // ===== 4. 可选的 campaign 列表（用于前端筛选器） =====
    const campaignOptions = await prisma.adCampaign.findMany({
      where: { id: campaignIdFilter },
      select: { id: true, name: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // 重新计算总体的汇总 ROI
    const totalRevenue = breakdown.reduce((sum, b) => sum + (b.revenue || 0), 0);
    const totalSpend = summary._sum.spend || 0;
    const avgRoi = totalSpend > 0 ? (totalRevenue - totalSpend) / totalSpend : 0;

    res.json({
      data: {
        summary: {
          totalSpend,
          totalImpressions: summary._sum.impressions || 0,
          totalClicks: summary._sum.clicks || 0,
          totalConversions: summary._sum.conversions || 0,
          avgCtr: summary._avg.ctr || 0,
          avgCpa: summary._avg.cpa || 0,
          totalRevenue,
          avgRoi,
        },
        dailyTrend: dailyTrend.map(d => ({
          date: d.date,
          spend: d._sum.spend || 0,
          impressions: d._sum.impressions || 0,
          clicks: d._sum.clicks || 0,
          conversions: d._sum.conversions || 0,
          ctr: d._avg.ctr || 0,
          cpa: d._avg.cpa || 0,
        })),
        breakdown,
        campaignOptions,
      },
    });
  })
);

// GET /api/performance/dashboard - Dashboard 概览数据
router.get(
  '/dashboard',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const today = new Date();
    const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const start = startDate ? new Date(startDate as string) : defaultStart;
    const end = endDate ? new Date(endDate as string) : today;

    // 过滤掉 Mock/Unknown 广告系列
    const { validCampaignIds, validAdIds } = await getValidCampaignFilters(prisma);
    const campaignIdFilter =
      validCampaignIds.length > 0 ? { in: validCampaignIds } : { in: [] as string[] };
    const adIdFilter =
      validAdIds.length > 0 ? { in: validAdIds } : { in: [] as string[] };

    // 只取 campaign 层级的数据作为汇总（避免重复计算）
    const [summary, topCampaigns, dailyTrend, creativePerformance] = await Promise.all([
      // 总体汇总
      prisma.adPerformance.aggregate({
        where: {
          date: { gte: start, lte: end },
          level: 'campaign',
          campaignId: campaignIdFilter,
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
          date: { gte: start, lte: end },
          level: 'campaign',
          campaignId: campaignIdFilter,
        },
        _sum: {
          spend: true,
          conversions: true,
          impressions: true,
          clicks: true,
        },
        _avg: {
          ctr: true,
          cpa: true,
        },
        orderBy: {
          _sum: { spend: 'desc' }
        },
        take: 5
      }),

      // 每日趋势
      prisma.adPerformance.groupBy({
        by: ['date'],
        where: {
          date: { gte: start, lte: end },
          level: 'campaign',
          campaignId: campaignIdFilter,
        },
        _sum: {
          spend: true,
          impressions: true,
          clicks: true,
          conversions: true,
        },
        orderBy: { date: 'asc' }
      }),

      // 素材表现排行（通过 ad 关联到 creative）
      prisma.adPerformance.groupBy({
        by: ['adId'],
        where: {
          date: { gte: start, lte: end },
          level: 'ad',
          adId: adIdFilter,
        },
        _sum: {
          spend: true,
          conversions: true,
          impressions: true,
          clicks: true,
        },
        _avg: {
          ctr: true,
          cpa: true,
        },
        orderBy: {
          _sum: { conversions: 'desc' }
        },
        take: 10
      }),
    ]);

    // 获取 Top campaigns 的名称
    const campaignIds = topCampaigns.map(tc => tc.campaignId).filter(Boolean) as string[];
    const campaignNames = campaignIds.length > 0
      ? await prisma.adCampaign.findMany({
          where: { id: { in: campaignIds } },
          select: { id: true, name: true },
        })
      : [];
    const campaignNameMap = new Map(campaignNames.map(c => [c.id, c.name]));

    // 获取 Top ads 的素材信息
    const adIds = creativePerformance.map(cp => cp.adId).filter(Boolean) as string[];
    const adDetails = adIds.length > 0
      ? await prisma.ad.findMany({
          where: { id: { in: adIds } },
          include: { creative: { select: { id: true, name: true, score: true, fileUrl: true } } },
        })
      : [];
    const adCreativeMap = new Map(adDetails.map(a => [a.id, a]));

    // 过滤掉名称是 Mock/Unknown 的 campaign
    const filteredTopCampaigns = topCampaigns
      .map(tc => ({
        ...tc,
        campaignName: campaignNameMap.get(tc.campaignId!) || 'Unknown',
      }))
      .filter(tc => !isMockCampaignName(tc.campaignName));

    res.json({
      data: {
        summary: {
          totalSpend: summary._sum.spend || 0,
          totalImpressions: summary._sum.impressions || 0,
          totalClicks: summary._sum.clicks || 0,
          totalConversions: summary._sum.conversions || 0,
          avgCtr: summary._avg.ctr || 0,
          avgCpa: summary._avg.cpa || 0,
        },
        topCampaigns: filteredTopCampaigns,
        dailyTrend,
        creativePerformance: creativePerformance.map(cp => {
          const adDetail = adCreativeMap.get(cp.adId!);
          const creative = adDetail?.creative || null;
          return {
            creativeName: creative?.name || adDetail?.name || '未命名',
            creativeScore: creative?.score ?? null,
            fileUrl: creative?.fileUrl || null,
            totalSpend: cp._sum.spend || 0,
            totalConversions: cp._sum.conversions || 0,
            totalImpressions: cp._sum.impressions || 0,
            totalClicks: cp._sum.clicks || 0,
            avgCtr: cp._avg.ctr || 0,
            avgCpa: cp._avg.cpa || 0,
          };
        }),
      }
    });
  })
);

// GET /api/performance/creative-ranking - 素材表现排行
router.get(
  '/creative-ranking',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('sortBy').optional().isIn(['conversions', 'spend', 'ctr', 'cpa', 'score']),
    query('designer').optional().isString(),
    query('country').optional().isString(),
    query('type').optional().isIn(['image', 'video', 'carousel', 'collection']),
  ],
  asyncHandler(async (req, res) => {
    const { startDate, endDate, limit = 20, sortBy = 'conversions', designer, country, type } = req.query;

    const today = new Date();
    const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const start = startDate ? new Date(startDate as string) : defaultStart;
    const end = endDate ? new Date(endDate as string) : today;

    // 过滤掉 Mock/Unknown 广告系列关联的素材
    const { validAdIds } = await getValidCampaignFilters(prisma);
    const adIdFilter =
      validAdIds.length > 0 ? { in: validAdIds } : { in: [] as string[] };

    // 按素材聚合表现数据
    const performanceByCreative = await prisma.adPerformance.groupBy({
      by: ['adId'],
      where: {
        date: { gte: start, lte: end },
        level: 'ad',
        adId: adIdFilter,
      },
      _sum: {
        spend: true,
        conversions: true,
        impressions: true,
        clicks: true,
      },
      _avg: {
        ctr: true,
        cpa: true,
      },
    });

    // 获取关联的 Ad 和 Creative（带筛选条件）
    const adIds = performanceByCreative.map(p => p.adId).filter(Boolean) as string[];
    const creativeWhere: any = {};
    if (designer) creativeWhere.designer = designer;
    if (country) creativeWhere.country = country;
    if (type) creativeWhere.type = type;

    const ads = adIds.length > 0
      ? await prisma.ad.findMany({
          where: { id: { in: adIds } },
          include: {
            creative: {
              where: Object.keys(creativeWhere).length > 0 ? creativeWhere : undefined,
            },
          },
        })
      : [];
    const adMap = new Map(ads.map(a => [a.id, a]));

    // 合并数据
    const ranking = performanceByCreative
      .map(p => {
        const ad = adMap.get(p.adId!);
        if (!ad || !ad.creative) return null;
        return {
          creativeId: ad.creative.id,
          creativeName: ad.creative.name,
          creativeScore: ad.creative.score,
          creativeType: ad.creative.type,
          fileUrl: ad.creative.fileUrl,
          designer: ad.creative.designer,
          country: ad.creative.country,
          width: ad.creative.width,
          height: ad.creative.height,
          totalSpend: p._sum.spend || 0,
          totalConversions: p._sum.conversions || 0,
          totalImpressions: p._sum.impressions || 0,
          totalClicks: p._sum.clicks || 0,
          avgCtr: p._avg.ctr || 0,
          avgCpa: p._avg.cpa || 0,
        };
      })
      .filter(Boolean);

    // 排序
    const sortFn: Record<string, (a: any, b: any) => number> = {
      conversions: (a, b) => (b.totalConversions || 0) - (a.totalConversions || 0),
      spend: (a, b) => (b.totalSpend || 0) - (a.totalSpend || 0),
      ctr: (a, b) => (b.avgCtr || 0) - (a.avgCtr || 0),
      cpa: (a, b) => (a.avgCpa || Infinity) - (b.avgCpa || Infinity),
      score: (a, b) => (b.creativeScore || 0) - (a.creativeScore || 0),
    };

    ranking.sort(sortFn[sortBy as string] || sortFn.conversions);

    res.json({
      data: ranking.slice(0, Number(limit)),
      total: ranking.length,
    });
  })
);

// GET /api/performance/creative-summary - 素材表现总览统计
router.get(
  '/creative-summary',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const today = new Date();
    const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const start = startDate ? new Date(startDate as string) : defaultStart;
    const end = endDate ? new Date(endDate as string) : today;

    // 过滤掉 Mock/Unknown 广告系列关联的素材
    const { validAdIds } = await getValidCampaignFilters(prisma);
    const adIdFilter =
      validAdIds.length > 0 ? { in: validAdIds } : { in: [] as string[] };

    // 获取有表现数据的所有 ad 级记录
    const performanceByAd = await prisma.adPerformance.groupBy({
      by: ['adId'],
      where: {
        date: { gte: start, lte: end },
        level: 'ad',
        adId: adIdFilter,
      },
      _sum: { spend: true, conversions: true, impressions: true, clicks: true },
      _avg: { ctr: true, cpa: true },
    });

    const adIds = performanceByAd.map(p => p.adId).filter(Boolean) as string[];
    const ads = adIds.length > 0
      ? await prisma.ad.findMany({
          where: { id: { in: adIds } },
          include: { creative: { select: { id: true, score: true, type: true, designer: true, country: true } } },
        })
      : [];
    const adMap = new Map(ads.map(a => [a.id, a]));

    // 合并统计
    let totalCreatives = 0;
    let totalSpend = 0;
    let totalConversions = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let scoreSum = 0;
    let scoreCount = 0;
    let bestCreative: any = null;
    let bestConversions = -1;
    const byDesigner: Record<string, { spend: number; conversions: number; count: number }> = {};
    const byCountry: Record<string, { spend: number; conversions: number; count: number }> = {};
    const byType: Record<string, { spend: number; conversions: number; count: number }> = {};
    const seenCreativeIds = new Set<string>();

    for (const p of performanceByAd) {
      const ad = adMap.get(p.adId!);
      if (!ad || !ad.creative) continue;

      const c = ad.creative;
      const spend = p._sum.spend || 0;
      const conversions = p._sum.conversions || 0;
      const impressions = p._sum.impressions || 0;
      const clicks = p._sum.clicks || 0;

      totalSpend += spend;
      totalConversions += conversions;
      totalImpressions += impressions;
      totalClicks += clicks;

      if (!seenCreativeIds.has(c.id)) {
        seenCreativeIds.add(c.id);
        totalCreatives++;
        if (c.score != null) { scoreSum += c.score; scoreCount++; }
      }

      if (conversions > bestConversions) {
        bestConversions = conversions;
        bestCreative = { creativeId: c.id, conversions, spend };
      }

      // 按设计师统计
      const dKey = c.designer || '未知';
      if (!byDesigner[dKey]) byDesigner[dKey] = { spend: 0, conversions: 0, count: 0 };
      byDesigner[dKey].spend += spend;
      byDesigner[dKey].conversions += conversions;
      if (!seenCreativeIds.has(`d_${dKey}_${c.id}`)) { byDesigner[dKey].count++; seenCreativeIds.add(`d_${dKey}_${c.id}`); }

      // 按国家统计
      const cKey = c.country || '未知';
      if (!byCountry[cKey]) byCountry[cKey] = { spend: 0, conversions: 0, count: 0 };
      byCountry[cKey].spend += spend;
      byCountry[cKey].conversions += conversions;

      // 按类型统计
      const tKey = c.type || '未知';
      if (!byType[tKey]) byType[tKey] = { spend: 0, conversions: 0, count: 0 };
      byType[tKey].spend += spend;
      byType[tKey].conversions += conversions;
    }

    res.json({
      data: {
        totalCreatives,
        avgScore: scoreCount > 0 ? scoreSum / scoreCount : 0,
        totalSpend,
        totalConversions,
        totalImpressions,
        totalClicks,
        avgCpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
        avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
        bestCreative,
        byDesigner: Object.entries(byDesigner).map(([name, v]) => ({ name, ...v })),
        byCountry: Object.entries(byCountry).map(([name, v]) => ({ name, ...v })),
        byType: Object.entries(byType).map(([name, v]) => ({ name, ...v })),
      },
    });
  })
);

// GET /api/performance/creative-detail/:creativeId - 单个素材的每日趋势
router.get(
  '/creative-detail/:creativeId',
  [
    param('creativeId').isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  asyncHandler(async (req, res) => {
    const { creativeId } = req.params;
    const { startDate, endDate } = req.query;

    const today = new Date();
    const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const start = startDate ? new Date(startDate as string) : defaultStart;
    const end = endDate ? new Date(endDate as string) : today;

    // 获取素材信息
    const creative = await prisma.creative.findUnique({
      where: { id: creativeId },
      select: {
        id: true, name: true, type: true, score: true, scoreFactors: true,
        fileUrl: true, designer: true, country: true, width: true, height: true,
        primaryText: true, headline: true, callToAction: true,
        createdAt: true,
      },
    });

    if (!creative) {
      return res.status(404).json({ error: '素材不存在' });
    }

    // 找到使用该素材的所有 Ad
    const ads = await prisma.ad.findMany({
      where: { creativeId },
      select: { id: true, name: true },
    });
    const adIds = ads.map(a => a.id);

    if (adIds.length === 0) {
      return res.json({
        data: { creative, dailyTrend: [], totals: null, ads: [] },
      });
    }

    // 获取每日趋势
    const dailyTrend = await prisma.adPerformance.groupBy({
      by: ['date'],
      where: {
        adId: { in: adIds },
        level: 'ad',
        date: { gte: start, lte: end },
      },
      _sum: { spend: true, impressions: true, clicks: true, conversions: true },
      _avg: { ctr: true, cpa: true },
      orderBy: { date: 'asc' },
    });

    // 汇总
    const totals = await prisma.adPerformance.aggregate({
      where: {
        adId: { in: adIds },
        level: 'ad',
        date: { gte: start, lte: end },
      },
      _sum: { spend: true, impressions: true, clicks: true, conversions: true },
      _avg: { ctr: true, cpa: true },
    });

    res.json({
      data: {
        creative,
        dailyTrend: dailyTrend.map(d => ({
          date: d.date,
          spend: d._sum.spend || 0,
          impressions: d._sum.impressions || 0,
          clicks: d._sum.clicks || 0,
          conversions: d._sum.conversions || 0,
          ctr: d._avg.ctr || 0,
          cpa: d._avg.cpa || 0,
        })),
        totals: {
          totalSpend: totals._sum.spend || 0,
          totalImpressions: totals._sum.impressions || 0,
          totalClicks: totals._sum.clicks || 0,
          totalConversions: totals._sum.conversions || 0,
          avgCtr: totals._avg.ctr || 0,
          avgCpa: totals._avg.cpa || 0,
        },
        ads,
      },
    });
  })
);

// GET /api/performance/campaign/:campaignId - 广告系列表现详情（含 AdSet/Ad 下钻）
router.get(
  '/campaign/:campaignId',
  [
    param('campaignId').isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  asyncHandler(async (req, res) => {
    const { campaignId } = req.params;
    const { startDate, endDate } = req.query;

    const today = new Date();
    const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const start = startDate ? new Date(startDate as string) : defaultStart;
    const end = endDate ? new Date(endDate as string) : today;

    // 1. Campaign 基本信息
    const campaign = await prisma.adCampaign.findUnique({
      where: { id: campaignId },
      include: {
        adAccount: { select: { id: true, name: true, metaAccountId: true } },
        adSets: {
          include: {
            ads: {
              include: { creative: { select: { id: true, name: true, fileUrl: true, type: true, score: true } } },
            },
          },
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: '广告系列不存在' });
    }

    // 2. Campaign 级别汇总 & 每日趋势
    const [campaignTotals, campaignDailyTrend] = await Promise.all([
      prisma.adPerformance.aggregate({
        where: { campaignId, level: 'campaign', date: { gte: start, lte: end } },
        _sum: { spend: true, impressions: true, clicks: true, conversions: true },
        _avg: { ctr: true, cpa: true, cpc: true, cpm: true, roas: true },
      }),
      prisma.adPerformance.groupBy({
        by: ['date'],
        where: { campaignId, level: 'campaign', date: { gte: start, lte: end } },
        _sum: { spend: true, impressions: true, clicks: true, conversions: true },
        _avg: { ctr: true, cpa: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    // 3. AdSet 级别表现
    const adSetIds = campaign.adSets.map(a => a.id);
    const adSetPerf = adSetIds.length > 0
      ? await prisma.adPerformance.groupBy({
          by: ['adSetId'],
          where: { adSetId: { in: adSetIds }, level: 'adset', date: { gte: start, lte: end } },
          _sum: { spend: true, impressions: true, clicks: true, conversions: true },
          _avg: { ctr: true, cpa: true },
        })
      : [];
    const adSetPerfMap = new Map(adSetPerf.map(p => [p.adSetId, p]));

    // 4. Ad 级别表现
    const allAdIds = campaign.adSets.flatMap(as => as.ads.map(a => a.id));
    const adPerf = allAdIds.length > 0
      ? await prisma.adPerformance.groupBy({
          by: ['adId'],
          where: { adId: { in: allAdIds }, level: 'ad', date: { gte: start, lte: end } },
          _sum: { spend: true, impressions: true, clicks: true, conversions: true },
          _avg: { ctr: true, cpa: true },
        })
      : [];
    const adPerfMap = new Map(adPerf.map(p => [p.adId, p]));

    // 5. 组装 AdSet + Ad 层级数据
    const benchmarks = await prisma.countryBenchmark.findMany();
    const benchmarkMap = new Map(benchmarks.map(b => [b.countryCode, b]));

    const adSets = campaign.adSets.map(adSet => {
      const perf = adSetPerfMap.get(adSet.id);
      const benchmark = adSet.countryCode ? benchmarkMap.get(adSet.countryCode) : null;
      const payout = benchmark?.payout || 0;
      
      const conversions = perf?._sum.conversions || 0;
      const spend = perf?._sum.spend || 0;
      const revenue = conversions * payout;
      const roi = spend > 0 ? (revenue - spend) / spend : 0;
      const roas = spend > 0 ? revenue / spend : 0;

      return {
        id: adSet.id,
        name: adSet.name,
        status: adSet.status,
        targeting: adSet.targeting,
        placements: adSet.placements,
        budgetAmount: adSet.budgetAmount,
        bidStrategy: adSet.bidStrategy,
        optimizationGoal: adSet.optimizationGoal,
        countryCode: adSet.countryCode,
        performance: perf ? {
          spend: perf._sum.spend || 0,
          impressions: perf._sum.impressions || 0,
          clicks: perf._sum.clicks || 0,
          conversions: perf._sum.conversions || 0,
          ctr: perf._avg.ctr || 0,
          cpa: perf._avg.cpa || 0,
          revenue,
          roi,
          roas
        } : null,
        ads: adSet.ads.map(ad => {
          const aPerf = adPerfMap.get(ad.id);
          const aConversions = aPerf?._sum.conversions || 0;
          const aSpend = aPerf?._sum.spend || 0;
          const aRevenue = aConversions * payout;
          const aRoi = aSpend > 0 ? (aRevenue - aSpend) / aSpend : 0;
          const aRoas = aSpend > 0 ? aRevenue / aSpend : 0;

          return {
            id: ad.id,
            name: ad.name,
            status: ad.status,
            creative: ad.creative,
            performance: aPerf ? {
              spend: aPerf._sum.spend || 0,
              impressions: aPerf._sum.impressions || 0,
              clicks: aPerf._sum.clicks || 0,
              conversions: aPerf._sum.conversions || 0,
              ctr: aPerf._avg.ctr || 0,
              cpa: aPerf._avg.cpa || 0,
              revenue: aRevenue,
              roi: aRoi,
              roas: aRoas
            } : null,
          };
        }),
      };
    });

    // 重新计算 Campaign 级别的汇总 ROI
    const campaignConversions = campaignTotals._sum.conversions || 0;
    const campaignSpend = campaignTotals._sum.spend || 0;
    
    // 聚合所有 AdSet 的 Revenue
    const totalRevenue = adSets.reduce((sum, as) => sum + (as.performance?.revenue || 0), 0);
    const totalRoi = campaignSpend > 0 ? (totalRevenue - campaignSpend) / campaignSpend : 0;
    const totalRoas = campaignSpend > 0 ? totalRevenue / campaignSpend : 0;

    res.json({
      data: {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          objective: campaign.objective,
          budgetType: campaign.budgetType,
          budgetAmount: campaign.budgetAmount,
          budgetCurrency: campaign.budgetCurrency,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          adAccountId: campaign.adAccountId,
          adAccountName: campaign.adAccount?.name,
          metaCampaignId: campaign.metaCampaignId,
          isAutoCreated: campaign.isAutoCreated,
          createdAt: campaign.createdAt,
        },
        totals: {
          spend: campaignTotals._sum.spend || 0,
          impressions: campaignTotals._sum.impressions || 0,
          clicks: campaignTotals._sum.clicks || 0,
          conversions: campaignTotals._sum.conversions || 0,
          ctr: campaignTotals._avg.ctr || 0,
          cpa: campaignTotals._avg.cpa || 0,
          cpc: campaignTotals._avg.cpc || 0,
          cpm: campaignTotals._avg.cpm || 0,
          revenue: totalRevenue,
          roi: totalRoi,
          roas: totalRoas,
        },
        dailyTrend: campaignDailyTrend.map(d => ({
          date: d.date,
          spend: d._sum.spend || 0,
          impressions: d._sum.impressions || 0,
          clicks: d._sum.clicks || 0,
          conversions: d._sum.conversions || 0,
          ctr: d._avg.ctr || 0,
          cpa: d._avg.cpa || 0,
        })),
        adSets,
      },
    });
  })
);

// GET /api/performance/:id - 获取单条表现记录
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
