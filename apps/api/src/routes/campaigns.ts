import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { prisma } from '@autoads/database';
import { asyncHandler } from '../middleware/errorHandler';
import { requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';
import * as metaApiService from '../services/metaApi.service';
import dayjs from 'dayjs';

const router = Router();

// Campaigns 和 Rules 只有优化师和管理员可以访问
router.use(requireRole('admin', 'optimizer'));

// ===================== 受众模板配置 =====================
const AUDIENCE_TEMPLATES: Record<string, { name: string; description: string; targeting: object }> = {
  T1: {
    name: '宽泛流量',
    description: '年龄 25-55，全性别，无兴趣词，冷启动测素材',
    targeting: {
      age_min: 25,
      age_max: 55,
      genders: [0], // 0=全性别
      interests: [],
    },
  },
  T2: {
    name: '调研兴趣',
    description: '年龄 25-50，兴趣：问卷/调研/奖励，转化优化阶段',
    targeting: {
      age_min: 25,
      age_max: 50,
      genders: [0],
      interests: ['survey', 'questionnaire', 'reward', 'earn money'],
    },
  },
  T3: {
    name: '再营销',
    description: '30天内访问过落地页但未完成的用户，追投优质素材',
    targeting: {
      age_min: 18,
      age_max: 65,
      genders: [0],
      custom_audiences: ['website_visitors_30d'],
      excluded_audiences: ['converters_30d'],
    },
  },
};

// ===================== 国家模板配置 =====================
const COUNTRY_TEMPLATES: Record<string, { name: string; region: string; defaultBudget: number; defaultAudience: string }> = {
  VN: { name: '越南', region: '东南亚', defaultBudget: 10, defaultAudience: 'T1' },
  ID: { name: '印度尼西亚', region: '东南亚', defaultBudget: 10, defaultAudience: 'T1' },
  PH: { name: '菲律宾', region: '东南亚', defaultBudget: 10, defaultAudience: 'T1' },
  TH: { name: '泰国', region: '东南亚', defaultBudget: 8, defaultAudience: 'T1' },
  BD: { name: '孟加拉', region: '南亚', defaultBudget: 8, defaultAudience: 'T1' },
  HI: { name: '印度', region: '南亚', defaultBudget: 10, defaultAudience: 'T1' },
  JP: { name: '日本', region: '东亚', defaultBudget: 15, defaultAudience: 'T2' },
  KR: { name: '韩国', region: '东亚', defaultBudget: 12, defaultAudience: 'T2' },
  EN: { name: '英语区(US/UK)', region: '欧美', defaultBudget: 20, defaultAudience: 'T1' },
  AR: { name: '阿拉伯语区', region: '中东', defaultBudget: 12, defaultAudience: 'T1' },
  PT: { name: '葡萄牙语区(BR)', region: '南美', defaultBudget: 10, defaultAudience: 'T1' },
  ES: { name: '西班牙语区', region: '南美', defaultBudget: 10, defaultAudience: 'T1' },
  DE: { name: '德国', region: '欧洲', defaultBudget: 15, defaultAudience: 'T2' },
  FR: { name: '法国', region: '欧洲', defaultBudget: 15, defaultAudience: 'T2' },
  RU: { name: '俄罗斯', region: '欧亚', defaultBudget: 8, defaultAudience: 'T1' },
  TR: { name: '土耳其', region: '欧亚', defaultBudget: 8, defaultAudience: 'T1' },
  MY: { name: '马来西亚', region: '东南亚', defaultBudget: 8, defaultAudience: 'T1' },
};

// ===================== 辅助函数 =====================

// 获取或创建默认广告账户
async function getDefaultAdAccount(): Promise<string> {
  const account = await prisma.adAccount.findFirst({
    where: { status: 'active' },
    orderBy: { createdAt: 'asc' },
  });
  if (account) return account.id;

  // 创建一个默认账户
  const newAccount = await prisma.adAccount.create({
    data: {
      name: 'AutoAds 默认账户',
      metaAccountId: `act_default_${Date.now()}`,
      status: 'active',
      currency: 'USD',
      timezone: 'Asia/Shanghai',
    },
  });
  return newAccount.id;
}

// ===================== API 路由 =====================

// 推送状态锁（内存中），防止并发推送导致的任务堆积或重复创建
const pushLocks = new Set<string>();

// GET /api/campaigns/templates - 获取国家模板和受众模板
router.get(
  '/templates',
  asyncHandler(async (_req, res) => {
    res.json({
      data: {
        countryTemplates: Object.entries(COUNTRY_TEMPLATES).map(([code, tpl]) => ({
          code,
          ...tpl,
        })),
        audienceTemplates: Object.entries(AUDIENCE_TEMPLATES).map(([code, tpl]) => ({
          code,
          name: tpl.name,
          description: tpl.description,
        })),
      },
    });
  })
);

// POST /api/campaigns/sync-status - 从 Meta 同步状态到本地
router.post(
  '/sync-status',
  asyncHandler(async (_req, res) => {
    const syncResult = await metaApiService.syncStatusFromMeta();
    logger.info(`[SyncStatus] Completed: ${syncResult.syncedCampaigns} campaigns, ${syncResult.syncedAdSets} adsets, ${syncResult.syncedAds} ads synced`);
    res.json({ data: syncResult });
  })
);

// POST /api/campaigns/auto-create - 核心：批量自动创建广告（支持 1-1-N 结构）
router.post(
  '/auto-create',
  asyncHandler(async (req: any, res: any) => {
    try {
      const {
        creativeIds,       // string[] - 素材ID列表
        countries,         // { code: string, dailyBudget?: number, audienceTemplate?: string, copyId?: string }[]
        structure,         // '1-1-1' | '1-1-N' - 广告结构模式
        adsPerAdSet,       // number - 每个AdSet包含的Ad数量（N值，默认1）
        audienceTemplate,  // string - 默认受众模板
        alias,             // string? - 自定义标签（优化师姓名等）
        primaryText,       // string - 广告正文（单条，向后兼容）
        headline,          // string - 广告标题（单条，向后兼容）
        primaryTexts,      // string[] - 多条广告正文（按点击顺序）
        headlines,         // string[] - 多条广告标题（按点击顺序）
        landingUrl,        // string - 落地页URL
        ctaType,           // string - CTA 类型
        pushToMeta,        // boolean - 是否同时推送到 Meta/Facebook
        // Campaign Settings
        objective,             // string - 前端使用的 objective 字段（与 campaignObjective 同义）
        campaignObjective,   // string - 广告目标 (OUTCOME_SALES, OUTCOME_TRAFFIC, etc.)
        effectiveObjective = objective || campaignObjective,
        budgetStrategy,      // 'CBO' | 'ABO' - 预算策略
        budgetMode,          // 'CBO' | 'ABO' - 前端使用的预算策略字段（与 budgetStrategy 同义）
        bidStrategy,         // string - 出价策略 (LOWEST_COST_WITHOUT_CAP, COST_CAP, etc.)
        costPerResultGoal,   // number - 单次成效费用目标
        // Conversion Settings
        conversionLocation,  // string - 转化位置 (WEBSITE, APP, etc.)
        optimizationGoal,    // string - 优化目标 (OFFSITE_CONVERSIONS, LINK_CLICKS, etc.)
        pixelId,             // string - Pixel ID
        conversionEvent,     // string - 转化事件 (PURCHASE, LEAD, etc.)
        // Targeting Settings
        ageMin,              // number - 最小年龄
        ageMax,              // number - 最大年龄
        targetGender,        // number - 性别 (0=不限, 1=男, 2=女)
        devicePlatforms,     // string[] - 设备平台 ['mobile', 'desktop']
        publisherPlatforms,  // string[] - 投放平台 ['facebook', 'instagram', ...]
        userOs,              // string[] - 操作系统 ['Android', 'iOS']
        placementType,       // 'automatic' | 'manual' - 版位类型
      } = req.body;

      // --- 参数校验 ---
      if (!creativeIds || !Array.isArray(creativeIds) || creativeIds.length === 0) {
        return res.status(400).json({ error: '请至少选择一个素材' });
      }
      if (creativeIds.length > 20) {
        return res.status(400).json({ error: '单次最多选择 20 个素材' });
      }
      if (!countries || !Array.isArray(countries) || countries.length === 0) {
        return res.status(400).json({ error: '请至少选择一个投放国家' });
      }

      // 确定结构模式
      const structureMode = structure || '1-1-1';
      const adsCount = structureMode === '1-1-N' ? (adsPerAdSet || creativeIds.length) : 1;
      
      // 如果是 1-1-N 模式，素材数量至少需要 1 个
      if (structureMode === '1-1-N' && creativeIds.length === 0) {
        return res.status(400).json({ error: `1-1-N 模式需要至少 1 个素材` });
      }

      // --- 验证素材是否存在 ---
      const creatives = await prisma.creative.findMany({
        where: { id: { in: creativeIds } },
      });
      if (creatives.length !== creativeIds.length) {
        const foundIds = creatives.map(c => c.id);
        const missingIds = creativeIds.filter((id: string) => !foundIds.includes(id));
        return res.status(400).json({ error: `以下素材不存在: ${missingIds.join(', ')}` });
      }

      // --- 获取国家文案（如果有）---
      const copyIds = countries.map((c: any) => c.copyId).filter(Boolean);
      const countryCopies = copyIds.length > 0 
        ? await prisma.countryCopy.findMany({ where: { id: { in: copyIds } } })
        : [];
      const copyMap = new Map(countryCopies.map(c => [c.id, c]));

      // --- 获取默认广告账户 ---
      const adAccountId = await getDefaultAdAccount();
      const dateStr = dayjs().format('YYYYMMDD');
      const defaultAudience = audienceTemplate || 'T1';

      // --- 构建通用的 Campaign & AdSet 设置 ---
      const effectiveBudgetStrategy = budgetStrategy || budgetMode || 'CBO';
      const campaignSettings = {
        objective: effectiveObjective || 'OUTCOME_SALES',
        budgetStrategy: effectiveBudgetStrategy,
        bidStrategy: bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
        costPerResultGoal: costPerResultGoal || null,
        conversionLocation: conversionLocation || 'WEBSITE',
        optimizationGoal: optimizationGoal || 'OFFSITE_CONVERSIONS',
        pixelId: pixelId || null,
        conversionEvent: conversionEvent || 'PURCHASE',
        placementType: placementType || 'automatic',
        publisherPlatforms: publisherPlatforms || ['facebook', 'instagram'],
      };

      // 构建受众定向（合并模板定向 + 用户自定义定向）
      const buildTargeting = (audienceTpl: any, countryCode: string) => {
        const base = audienceTpl?.targeting || {};
        const targeting: any = {};

        // 复制模板中的有效字段（跳过空数组和无效值）
        if (base.age_min !== undefined && base.age_min !== null) targeting.age_min = base.age_min;
        if (base.age_max !== undefined && base.age_max !== null) targeting.age_max = base.age_max;
        // genders: Meta API 只接受 1(男) 或 2(女)，0(不限) 不应传递
        if (Array.isArray(base.genders) && base.genders.length > 0 && !base.genders.includes(0)) {
          targeting.genders = base.genders;
        }
        // interests: 空数组会导致 Invalid parameter，跳过
        if (Array.isArray(base.interests) && base.interests.length > 0) {
          targeting.interests = base.interests.map((name: string) => ({ name }));
        }
        if (base.custom_audiences && base.custom_audiences.length > 0) {
          targeting.custom_audiences = base.custom_audiences;
        }
        if (base.excluded_audiences && base.excluded_audiences.length > 0) {
          targeting.excluded_custom_audiences = base.excluded_audiences;
        }

        // 用户自定义年龄覆盖模板
        if (ageMin !== undefined && ageMin !== null) targeting.age_min = ageMin;
        if (ageMax !== undefined && ageMax !== null) targeting.age_max = ageMax;

        // 性别：Meta API 中 1=男, 2=女，0=不限（不传）
        if (targetGender === 1 || targetGender === 2) targeting.genders = [targetGender];

        // 国家
        targeting.geo_locations = { countries: [countryCode] };

        // 设备平台
        if (devicePlatforms && devicePlatforms.length > 0) targeting.device_platforms = devicePlatforms;
        // 操作系统
        if (userOs && userOs.length > 0) targeting.user_os = userOs;
        // 投放平台
        if (campaignSettings.placementType === 'manual' && campaignSettings.publisherPlatforms?.length > 0) {
          targeting.publisher_platforms = campaignSettings.publisherPlatforms;
        }

        // 清理：移除任何 null/undefined 值
        Object.keys(targeting).forEach(key => {
          if (targeting[key] === null || targeting[key] === undefined) delete targeting[key];
        });

        // Meta API v21.0 必填：必须设置赋能型受众标记 (advantage_audience)。
        // 使用 0（禁用）以保留用户自定义的年龄等受众限制
        targeting.targeting_automation = { advantage_audience: 0 };

        return targeting;
      };

      // 文案循环分配辅助函数：根据全局广告索引分配文案
      // 逻辑：texts[globalAdIndex % texts.length]
      // 例：8个广告 + 4个primaryText → 每个文案用2次；8个广告 + 6个headlines → 前2个用2次，后4个用1次
      const getTextForAd = (texts: string[] | undefined, globalAdIndex: number, fallbackText: string | undefined): string => {
        if (texts && texts.length > 0) {
          return texts[globalAdIndex % texts.length];
        }
        return fallbackText || '';
      };

      // 追踪全局广告索引（跨所有campaign/group/country）
      let globalAdIndex = 0;

      // --- 批量创建三层结构 ---
      const results: any[] = [];
      const errors: any[] = [];

      for (const country of countries) {
        const countryCode = country.code;
        const countryTpl = COUNTRY_TEMPLATES[countryCode];
        const dailyBudget = country.dailyBudget || countryTpl?.defaultBudget || 10;
        const audienceCode = country.audienceTemplate || defaultAudience;
        const audienceTpl = AUDIENCE_TEMPLATES[audienceCode];

        // 获取该国家的文案（优先使用 copyId，否则使用传入的文案）
        // 多条文案模式：使用数组的第一条作为兜底（实际分配在创建 Ad 时按 globalAdIndex 循环）
        let countryPrimaryText = primaryText || (primaryTexts && primaryTexts.length > 0 ? primaryTexts[0] : undefined);
        let countryHeadline = headline || (headlines && headlines.length > 0 ? headlines[0] : undefined);
        let countryCtaType = ctaType || 'LEARN_MORE';
        
        if (country.copyId) {
          const copy = copyMap.get(country.copyId);
          if (copy) {
            countryPrimaryText = copy.primaryText;
            countryHeadline = copy.headline;
            countryCtaType = copy.ctaType;
          }
        }

        // 校验：至少有一条文案（单条或数组），且有落地页
        const hasPrimaryText = !!countryPrimaryText || (primaryTexts && primaryTexts.length > 0);
        const hasHeadline = !!countryHeadline || (headlines && headlines.length > 0);
        if ((!hasPrimaryText && !hasHeadline) || !landingUrl) {
          errors.push({
            countryCode,
            error: '缺少广告文案或落地页链接',
          });
          continue;
        }

        try {
          if (structureMode === '1-1-1') {
            // ===== 1-1-1 模式：每个素材独立创建 Campaign + AdSet + Ad =====
            for (let creativeIdx = 0; creativeIdx < creatives.length; creativeIdx++) {
              const creative = creatives[creativeIdx];
              const targeting = buildTargeting(audienceTpl, countryCode);
              // 使用全局索引分配文案
              const adPrimaryText = getTextForAd(primaryTexts, globalAdIndex, countryPrimaryText);
              const adHeadline = getTextForAd(headlines, globalAdIndex, countryHeadline);
              globalAdIndex++;

              const result = await createCampaignStructure({
                adAccountId,
                countryCode,
                countryTpl,
                dailyBudget,
                audienceCode,
                audienceTpl,
                creative,
                primaryText: adPrimaryText,
                headline: adHeadline,
                landingUrl,
                ctaType: countryCtaType,
                dateStr,
                isAutoCreated: true,
                ownerId: req.user?.userId,
                alias,
                campaignSettings,
                targeting,
                adSetIndex: creativeIdx + 1,
              });
              results.push(result);
              logger.info(`1-1-1 广告创建成功: ${result.campaignName}`);
            }
          } else {
            // ===== 1-1-N 模式：将所有素材按 N 个一组分片，每组创建 1 Campaign + 1 AdSet + M Ads =====
            // 例：6个素材 + N=3 → 2组(3,3)；20个素材 + N=3 → 7组(3,3,3,3,3,3,2)
            const chunks: typeof creatives[] = [];
            for (let i = 0; i < creatives.length; i += adsCount) {
              chunks.push(creatives.slice(i, i + adsCount));
            }

            for (let groupIdx = 0; groupIdx < chunks.length; groupIdx++) {
              const chunkCreatives = chunks[groupIdx];
              const actualN = chunkCreatives.length;
              const groupLabel = chunks.length > 1 ? `G${groupIdx + 1}` : '';

              // 1. 创建 Campaign
              const campaignName = alias
                ? `${alias}_${countryCode}_${dateStr}${chunks.length > 1 ? `_G${groupIdx + 1}` : ''}`
                : `FB_Zeydoo_${countryCode}_Amanda_${dateStr}${chunks.length > 1 ? `_G${groupIdx + 1}` : ''}`;
              const campaign = await prisma.adCampaign.create({
                data: {
                  name: campaignName,
                  alias: alias || null,
                  objective: campaignSettings.objective,
                  status: 'paused',
                  budgetType: 'daily',
                  budgetAmount: dailyBudget,
                  budgetCurrency: 'USD',
                  startDate: new Date(),
                  adAccountId,
                  isAutoCreated: true,
                  ownerId: req.user?.userId,
                  countryRadarConfig: {
                    countryCode,
                    countryName: countryTpl?.name || countryCode,
                    audienceTemplate: audienceCode,
                    structure: `1-1-${actualN}`,
                    creativeCount: actualN,
                    groupIndex: groupIdx + 1,
                    totalGroups: chunks.length,
                    campaignSettings,
                  },
                },
              });

              // 2. 创建 AdSet
              const targeting = buildTargeting(audienceTpl, countryCode);
              // 根据 objective 映射优化目标名称（与 metaApi.service.ts 一致）
              const obj = campaignSettings.objective || 'OUTCOME_SALES';
              let optGoalLabel: string;
              if (obj === 'OUTCOME_TRAFFIC') optGoalLabel = 'TRAFFIC';
              else if (obj === 'OUTCOME_AWARENESS') optGoalLabel = 'REACH';
              else if (obj === 'OUTCOME_ENGAGEMENT') optGoalLabel = 'ENGAGEMENT';
              else if (obj === 'OUTCOME_APP_PROMOTION') optGoalLabel = 'APP';
              else if (obj === 'OUTCOME_LEADS') optGoalLabel = 'LEADS';
              else optGoalLabel = 'SALES';
              const adSetName = `${countryCode}_${optGoalLabel}_${String(groupIdx + 1).padStart(2, '0')}`;
              const adSet = await prisma.adSet.create({
                data: {
                  name: adSetName,
                  status: 'active',
                  campaignId: campaign.id,
                  targeting,
                  audienceTemplate: audienceCode,
                  placements: campaignSettings.placementType === 'manual' ? campaignSettings.publisherPlatforms : ['facebook', 'instagram'],
                  budgetAmount: campaignSettings.budgetStrategy === 'ABO' ? dailyBudget : undefined,
                  bidStrategy: campaignSettings.bidStrategy,
                  optimizationGoal: campaignSettings.optimizationGoal,
                  billingEvent: 'IMPRESSIONS',
                  countryCode,
                },
              });

              // 3. 创建 M 个 Ads（M = 该分组的素材数量），Ad名直接使用素材名
              const createdAds: any[] = [];
              for (let i = 0; i < chunkCreatives.length; i++) {
                const creative = chunkCreatives[i];
                // 使用全局索引分配文案
                const adPrimaryText = getTextForAd(primaryTexts, globalAdIndex, countryPrimaryText);
                const adHeadline = getTextForAd(headlines, globalAdIndex, countryHeadline);
                globalAdIndex++;

                const ad = await prisma.ad.create({
                  data: {
                    name: creative.name,
                    status: 'active',
                    adSetId: adSet.id,
                    creativeId: creative.id,
                    urlParameters: JSON.stringify({
                      primaryText: adPrimaryText,
                      headline: adHeadline,
                      landingUrl,
                      ctaType: countryCtaType,
                    }),
                  },
                });
                createdAds.push({
                  adId: ad.id,
                  adName: ad.name,
                  creativeName: creative.name,
                  creativeId: creative.id,
                });
              }

              results.push({
                campaignId: campaign.id,
                campaignName: campaign.name,
                adSetId: adSet.id,
                adSetName: adSet.name,
                countryCode,
                countryName: countryTpl?.name || countryCode,
                dailyBudget,
                audienceTemplate: audienceCode,
                structure: `1-1-${actualN}`,
                ads: createdAds,
              });

              logger.info(`1-1-${actualN} 广告创建成功: ${campaignName} (${countryTpl?.name || countryCode}) [分组 ${groupIdx + 1}/${chunks.length}]`);
            }
          }
        } catch (err: any) {
          errors.push({
            countryCode,
            error: err.message,
          });
          logger.error(`广告创建失败: ${countryCode}`, err);
        }
      }

      const totalCreated = results.length;
      const totalFailed = errors.length;

      // ===================== Meta API 推送 =====================
      let metaPushResults: any[] = [];
      const shouldPushToMeta = pushToMeta === true;

      // 检查当前用户是否有默认个人凭据（推送强制使用个人凭据，不再读取全局 .env）
      const defaultCredential = await prisma.metaCredential.findFirst({
        where: { userId: req.user!.userId, isDefault: true },
      });
      const hasPersonalCredential = defaultCredential && !!defaultCredential.metaAccessToken;
      const hasPageId = !!defaultCredential?.metaPageId;

      if (shouldPushToMeta && totalCreated > 0) {

        if (!hasPersonalCredential) {
          logger.warn(`[MetaPush] User ${req.user!.userId} has no personal Meta credential configured. Skipping push.`);
          metaPushResults.push({
            status: 'failed',
            error: '未配置个人 Meta API 凭据。请在「设置」页面配置凭据后再推送。',
          });
        } else if (!hasPageId) {
          logger.error('[MetaPush] Personal credential has no Page ID configured.');
          metaPushResults.push({
            status: 'failed',
            error: '个人凭据未配置粉丝页 ID。请在「设置」页面配置 Page ID。',
          });
        } else {
          logger.info(`[MetaPush] Starting push for ${totalCreated} campaigns to Meta Ads...`);

          for (let pushIdx = 0; pushIdx < results.length; pushIdx++) {
            const result = results[pushIdx];
            const campaignId = result.campaignId;
            if (!campaignId) continue;

            // 每个 Campaign 之间间隔 5 秒，避免触发 Meta rate limit
            if (pushIdx > 0) {
              await new Promise(resolve => setTimeout(resolve, 5000));
            }

            try {
              // Re-fetch campaign with full relations for Meta API push
              const localCampaign = await prisma.adCampaign.findUnique({
                where: { id: campaignId },
                include: {
                  adSets: {
                    include: {
                      ads: {
                        include: { creative: true },
                      },
                    },
                  },
                },
              });

              if (!localCampaign) {
                metaPushResults.push({
                  campaignId,
                  campaignName: result.campaignName,
                  status: 'skipped',
                  reason: 'Campaign not found in local database',
                });
                continue;
              }

              // Pass campaignSettings to pushCampaignToMeta for CBO/ABO, bid strategy, etc.
              const pushResult = await metaApiService.pushCampaignToMeta(
                localCampaign as any,
                { campaignSettings }
              );

              if (pushResult.campaign) {
                // Count successful ad pushes
                const totalAdsPushed = pushResult.adSets.reduce((sum, as_) =>
                  sum + as_.ads.filter(a => a.ad).length, 0);
                const totalAdsFailed = pushResult.adSets.reduce((sum, as_) =>
                  sum + as_.ads.filter(a => a.error).length, 0);

                metaPushResults.push({
                  campaignId,
                  campaignName: result.campaignName,
                  status: 'success',
                  metaCampaignId: pushResult.campaign.id,
                  adSetsPushed: pushResult.adSets.filter(as_ => as_.adSet).length,
                  adsPushed: totalAdsPushed,
                  adsFailed: totalAdsFailed,
                });
                logger.info(`[MetaPush] Campaign ${result.campaignName} -> Meta ID: ${pushResult.campaign.id} (${totalAdsPushed} ads)`);
              } else if (pushResult.error) {
                metaPushResults.push({
                  campaignId,
                  campaignName: result.campaignName,
                  status: 'failed',
                  error: pushResult.error.message,
                  errorCode: pushResult.error.code,
                });
                logger.error(`[MetaPush] Campaign ${result.campaignName} failed: ${pushResult.error.message}`);
              } else {
                metaPushResults.push({
                  campaignId,
                  campaignName: result.campaignName,
                  status: 'skipped',
                  reason: 'Unknown push result',
                });
              }
            } catch (pushErr: any) {
              metaPushResults.push({
                campaignId,
                campaignName: result.campaignName,
                status: 'failed',
                error: pushErr.message,
              });
              logger.error(`[MetaPush] Unexpected error pushing ${result.campaignName}:`, pushErr);
            }
          }

          const successCount = metaPushResults.filter(r => r.status === 'success').length;
          const failedCount = metaPushResults.filter(r => r.status === 'failed').length;
          logger.info(`[MetaPush] Completed. Success: ${successCount}, Failed: ${failedCount}`);
        }
      } else if (shouldPushToMeta && totalCreated === 0) {
        logger.warn('[MetaPush] pushToMeta=true but no campaigns were created successfully.');
      }

      res.status(201).json({
        data: {
          summary: {
            totalCreated,
            totalFailed,
            totalCampaigns: totalCreated,
            totalAdSets: structureMode === '1-1-N' ? totalCreated : totalCreated,
            totalAds: structureMode === '1-1-N'
              ? results.reduce((sum, r) => sum + (r.ads?.length || 1), 0)
              : totalCreated,
            structure: structureMode,
            metaPush: {
              enabled: shouldPushToMeta,
              configured: hasPersonalCredential && hasPageId,
              totalPushed: metaPushResults.filter(r => r.status === 'success').length,
              totalFailed: metaPushResults.filter(r => r.status === 'failed').length,
            },
          },
          campaigns: results,
          metaPushResults: metaPushResults.length > 0 ? metaPushResults : undefined,
          errors: errors.length > 0 ? errors : undefined,
        },
      });
    } catch (err: any) {
      logger.error('批量创建广告失败:', err);
      res.status(500).json({ error: '批量创建广告失败', details: err.message });
    }
  })
);

// 辅助函数：创建 1-1-1 结构
async function createCampaignStructure(params: {
  adAccountId: string;
  countryCode: string;
  countryTpl: any;
  dailyBudget: number;
  audienceCode: string;
  audienceTpl: any;
  creative: any;
  primaryText: string;
  headline: string;
  landingUrl: string;
  ctaType: string;
  dateStr: string;
  isAutoCreated: boolean;
  ownerId?: string;
  alias?: string;
  campaignSettings?: any;
  targeting?: any;
  adSetIndex?: number;
}) {
  const {
    adAccountId, countryCode, countryTpl, dailyBudget,
    audienceCode, audienceTpl, creative,
    primaryText, headline, landingUrl, ctaType,
    dateStr, isAutoCreated,
    alias,
    campaignSettings = {},
    targeting = {},
    adSetIndex = 1,
  } = params;

  const objective = campaignSettings.objective || 'OUTCOME_SALES';
  const bidStrat = campaignSettings.bidStrategy || 'LOWEST_COST_WITHOUT_CAP';
  const optGoal = campaignSettings.optimizationGoal || 'OFFSITE_CONVERSIONS';
  const placements = campaignSettings.placementType === 'manual' 
    ? (campaignSettings.publisherPlatforms || ['facebook', 'instagram'])
    : ['facebook', 'instagram'];

  // 1. 创建 Campaign
  const campaignName = alias
    ? `${alias}_${countryCode}_${dateStr}`
    : `FB_Zeydoo_${countryCode}_Amanda_${dateStr}`;
  const campaign = await prisma.adCampaign.create({
    data: {
      name: campaignName,
      alias: alias || null,
      objective,
      status: 'paused',
      budgetType: 'daily',
      budgetAmount: dailyBudget,
      budgetCurrency: 'USD',
      startDate: new Date(),
      adAccountId,
      isAutoCreated,
      ownerId: params.ownerId || null,
      countryRadarConfig: {
        countryCode,
        countryName: countryTpl?.name || countryCode,
        audienceTemplate: audienceCode,
        structure: '1-1-1',
        campaignSettings,
      },
    },
  });

  // 2. 创建 AdSet
  const obj11 = campaignSettings.objective || 'OUTCOME_SALES';
  let optGoalLabel11: string;
  if (obj11 === 'OUTCOME_TRAFFIC') optGoalLabel11 = 'TRAFFIC';
  else if (obj11 === 'OUTCOME_AWARENESS') optGoalLabel11 = 'REACH';
  else if (obj11 === 'OUTCOME_ENGAGEMENT') optGoalLabel11 = 'ENGAGEMENT';
  else if (obj11 === 'OUTCOME_APP_PROMOTION') optGoalLabel11 = 'APP';
  else if (obj11 === 'OUTCOME_LEADS') optGoalLabel11 = 'LEADS';
  else optGoalLabel11 = 'SALES';
  const adSetName = `${countryCode}_${optGoalLabel11}_${String(adSetIndex).padStart(2, '0')}`;
  const adSet = await prisma.adSet.create({
    data: {
      name: adSetName,
      status: 'active',
      campaignId: campaign.id,
      targeting: Object.keys(targeting).length > 0 ? targeting : (audienceTpl?.targeting || {}),
      audienceTemplate: audienceCode,
      placements,
      budgetAmount: campaignSettings.budgetStrategy === 'ABO' ? dailyBudget : undefined,
      bidStrategy: bidStrat,
      optimizationGoal: optGoal,
      billingEvent: 'IMPRESSIONS',
      countryCode,
    },
  });

  // 3. 创建 Ad（直接使用素材名）
  const ad = await prisma.ad.create({
    data: {
      name: creative.name,
      status: 'active',
      adSetId: adSet.id,
      creativeId: creative.id,
      urlParameters: JSON.stringify({
        primaryText,
        headline,
        landingUrl,
        ctaType,
      }),
    },
  });

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    adSetId: adSet.id,
    adSetName: adSet.name,
    adId: ad.id,
    adName: ad.name,
    countryCode,
    countryName: countryTpl?.name || countryCode,
    creativeName: creative.name,
    dailyBudget,
    audienceTemplate: audienceCode,
    structure: '1-1-1',
  };
}

// GET /api/campaigns - 获取广告活动列表
router.get(
  '/',
  [
    query('status').optional().isIn(['draft', 'scheduled', 'active', 'paused', 'ended', 'archived']),
    query('countryCode').optional().trim(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const { status, countryCode, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.status = status;
    // 通过 countryRadarConfig 中的 countryCode 筛选
    if (countryCode) {
      where.countryRadarConfig = { path: ['countryCode'], equals: countryCode };
    }

    const [campaigns, total] = await Promise.all([
      prisma.adCampaign.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: { createdAt: 'desc' },
        include: {
          adAccount: {
            select: { id: true, name: true, metaAccountId: true },
          },
          adSets: {
            include: {
              ads: {
                include: {
                  creative: {
                    select: { id: true, name: true, type: true, fileUrl: true, width: true, height: true },
                  },
                },
              },
              _count: {
                select: { ads: true },
              },
            },
          },
          _count: {
            select: { adSets: true },
          },
          owner: { select: { id: true, displayName: true, username: true } }
        },
      }),
      prisma.adCampaign.count({ where }),
    ]);

    // 计算 pushStatus 虚拟字段
    const campaignsWithPushStatus = campaigns.map(c => {
      let pushStatus = 'pending';
      let metaPushError = null;
      
      if (c.metaCampaignId) {
        pushStatus = 'success';
      } else {
        const config = c.countryRadarConfig as any;
        if (config?.pushError) {
          pushStatus = config.isAuthError ? 'auth_failed' : 'failed';
          metaPushError = config.pushError;
        }
      }
      
      return {
        ...c,
        pushStatus,
        metaPushError
      };
    });

    res.json({
      data: campaignsWithPushStatus,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + campaigns.length < total,
      },
    });
  })
);

// ===================== 国家文案库 API（必须在 /:id 路由之前定义）=====================

// GET /api/campaigns/country-copies - 获取国家文案列表
router.get(
  '/country-copies',
  [
    query('countryCode').optional().trim(),
    query('isActive').optional().isBoolean().toBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  asyncHandler(async (req, res) => {
    const { countryCode, isActive, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    if (countryCode) where.countryCode = countryCode;
    if (isActive !== undefined) where.isActive = isActive;

    const [copies, total] = await Promise.all([
      prisma.countryCopy.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: [
          { isDefault: 'desc' },
          { useCount: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
      prisma.countryCopy.count({ where }),
    ]);

    res.json({
      data: copies,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + copies.length < total,
      },
    });
  })
);

// GET /api/campaigns/country-copies/:id - 获取单个文案
router.get(
  '/country-copies/:id',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const copy = await prisma.countryCopy.findUnique({ where: { id } });
    if (!copy) {
      return res.status(404).json({ error: '文案不存在' });
    }
    res.json({ data: copy });
  })
);

// POST /api/campaigns/country-copies - 创建文案
router.post(
  '/country-copies',
  [
    body('countryCode').notEmpty().trim().isLength({ min: 2, max: 5 }),
    body('countryName').notEmpty().trim(),
    body('name').notEmpty().trim(),
    body('primaryText').notEmpty().trim(),
    body('headline').notEmpty().trim(),
    body('ctaType').optional().isIn(['LEARN_MORE', 'SIGN_UP', 'GET_OFFER', 'APPLY_NOW']),
    body('isDefault').optional().isBoolean(),
    body('tags').optional().isArray(),
  ],
  asyncHandler(async (req: any, res: any) => {
    const { countryCode } = req.body;
    
    // 如果设为默认，取消该国家其他默认文案
    if (req.body.isDefault) {
      await prisma.countryCopy.updateMany({
        where: { countryCode, isDefault: true },
        data: { isDefault: false },
      });
    }

    const copy = await prisma.countryCopy.create({
      data: req.body,
    });

    logger.info(`国家文案创建成功: ${copy.id} (${copy.countryCode})`);
    res.status(201).json({ data: copy });
  })
);

// PUT /api/campaigns/country-copies/:id - 更新文案
router.put(
  '/country-copies/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim(),
    body('primaryText').optional().trim(),
    body('headline').optional().trim(),
    body('ctaType').optional().isIn(['LEARN_MORE', 'SIGN_UP', 'GET_OFFER', 'APPLY_NOW']),
    body('isActive').optional().isBoolean(),
    body('isDefault').optional().isBoolean(),
  ],
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { isDefault, countryCode } = req.body;

    // 如果设为默认，取消该国家其他默认文案
    if (isDefault && countryCode) {
      await prisma.countryCopy.updateMany({
        where: { countryCode, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const copy = await prisma.countryCopy.update({
      where: { id },
      data: req.body,
    });

    logger.info(`国家文案更新成功: ${id}`);
    res.json({ data: copy });
  })
);

// DELETE /api/campaigns/country-copies/:id - 删除文案
router.delete(
  '/country-copies/:id',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.countryCopy.delete({ where: { id } });
    logger.info(`国家文案删除成功: ${id}`);
    res.status(204).send();
  })
);

// POST /api/campaigns/country-copies/:id/use - 记录文案使用（更新统计）
router.post(
  '/country-copies/:id/use',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const copy = await prisma.countryCopy.update({
      where: { id },
      data: {
        useCount: { increment: 1 },
      },
    });
    res.json({ data: copy });
  })
);

// GET /api/campaigns/:id - 获取广告活动详情（必须在静态路由之后）
router.get(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const campaign = await prisma.adCampaign.findUnique({
      where: { id },
      include: {
        adAccount: true,
        adSets: {
          include: {
            ads: {
              include: {
                creative: true,
              },
            },
          },
        },
        autoRules: true,
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ data: campaign });
  })
);

// PUT /api/campaigns/:id/status - 更新广告活动状态（暂停/恢复）+ 同步到 Meta
router.put(
  '/:id/status',
  [
    param('id').isUUID(),
    body('status').isIn(['active', 'paused']),
  ],
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { status } = req.body;

    // 更新 Campaign 状态
    const campaign = await prisma.adCampaign.update({
      where: { id },
      data: { status },
    });

    // 级联更新所有 AdSet 和 Ad 状态
    const adSets = await prisma.adSet.findMany({ where: { campaignId: id } });
    for (const adSet of adSets) {
      await prisma.adSet.update({ where: { id: adSet.id }, data: { status } });
      await prisma.ad.updateMany({ where: { adSetId: adSet.id }, data: { status } });
    }

    // 同步状态到 Meta（非阻塞，失败只记录日志不影响前端响应）
    try {
      const syncResult = await metaApiService.syncStatusToMeta(id, status);
      if (!syncResult.success) {
        logger.warn(`[StatusSync] Campaign ${id} sync to Meta had errors: ${syncResult.errors.join('; ')}`);
      } else {
        logger.info(`[StatusSync] Campaign ${id} synced to Meta: ${status}`);
      }
    } catch (syncErr: any) {
      logger.warn(`[StatusSync] Campaign ${id} sync skipped: ${syncErr.message}`);
    }

    logger.info(`Campaign ${id} status -> ${status}`);
    res.json({ data: campaign });
  })
);

// PUT /api/campaigns/batch-status - 批量更新状态 + 同步到 Meta
router.put(
  '/batch-status',
  [
    body('ids').isArray({ min: 1 }).withMessage('请至少选择一个广告活动'),
    body('status').isIn(['active', 'paused']),
  ],
  asyncHandler(async (req: any, res: any) => {
    const { ids, status } = req.body as { ids: string[]; status: 'active' | 'paused' };

    // 批量更新 Campaign 状态
    await prisma.adCampaign.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });

    // 获取这些 Campaign 的 AdSet IDs
    const adSets = await prisma.adSet.findMany({
      where: { campaignId: { in: ids } },
      select: { id: true },
    });
    const adSetIds = adSets.map(a => a.id);

    // 级联更新 AdSet 状态
    if (adSetIds.length > 0) {
      await prisma.adSet.updateMany({
        where: { id: { in: adSetIds } },
        data: { status },
      });
      // 级联更新 Ad 状态
      await prisma.ad.updateMany({
        where: { adSetId: { in: adSetIds } },
        data: { status },
      });
    }

    // 同步状态到 Meta（逐个 campaign 同步，错误只记录不阻塞）
    const syncErrors: string[] = [];
    for (const campaignId of ids) {
      try {
        const syncResult = await metaApiService.syncStatusToMeta(campaignId, status);
        if (!syncResult.success) {
          syncErrors.push(...syncResult.errors);
        }
      } catch (syncErr: any) {
        syncErrors.push(`Campaign ${campaignId}: ${syncErr.message}`);
      }
    }
    if (syncErrors.length > 0) {
      logger.warn(`[BatchStatusSync] Errors: ${syncErrors.join('; ')}`);
    } else {
      logger.info(`[BatchStatusSync] ${ids.length} campaigns synced to Meta: ${status}`);
    }

    logger.info(`Batch status update: ${ids.length} campaigns -> ${status}`);
    res.json({ data: { updated: ids.length, status } });
  })
);

// POST /api/campaigns/re-push - 重新推送本地已创建但未推送到 Meta 的 Campaign（SSE 实时进度）
router.post(
  '/re-push',
  body('campaignIds').isArray({ min: 1 }),
  asyncHandler(async (req, res) => {
    const { campaignIds } = req.body;
    const campaignSettings = req.body.campaignSettings || {};

    // 检查并发锁
    const activeLock = campaignIds.find(id => pushLocks.has(id));
    if (activeLock) {
      return res.status(409).json({ error: '选中的广告活动中，有任务正在推送中，请勿重复操作' });
    }

    // 加锁（不再做全局 .env 前置检查，改为在推送循环中按 campaign owner 检查个人凭据）
    campaignIds.forEach(id => pushLocks.add(id));

    // 设置 SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // 先发初始化事件
      sendEvent('init', { total: campaignIds.length });

      const results: any[] = [];
      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < campaignIds.length; i++) {
        const campaignId = campaignIds[i];

        // 每个 Campaign 之间间隔 5 秒
        if (i > 0) {
          sendEvent('waiting', { index: i, delay: 5 });
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

        try {
          const localCampaign = await prisma.adCampaign.findUnique({
            where: { id: campaignId },
            include: {
              adSets: {
                include: {
                  ads: {
                    include: { creative: true },
                  },
                },
              },
            },
          });

          if (!localCampaign) {
            const item = { campaignId, status: 'skipped', reason: 'Campaign not found' };
            results.push(item);
            sendEvent('progress', { index: i, ...item });
            continue;
          }

          if (localCampaign.metaCampaignId) {
            const item = { campaignId, campaignName: localCampaign.name, status: 'skipped', reason: '已推送到 Meta', metaCampaignId: localCampaign.metaCampaignId };
            results.push(item);
            sendEvent('progress', { index: i, ...item });
            continue;
          }

          // 前置检查：campaign owner 是否有个人凭据
          if (!localCampaign.ownerId) {
            const item = { campaignId, campaignName: localCampaign.name, status: 'failed', error: 'Campaign 未分配创建者，无法获取个人 Meta 凭据' };
            results.push(item);
            sendEvent('progress', { index: i, ...item });
            continue;
          }
          const ownerCredential = await prisma.metaCredential.findFirst({
            where: { userId: localCampaign.ownerId, isDefault: true },
          });
          if (!ownerCredential?.metaAccessToken) {
            const item = { campaignId, campaignName: localCampaign.name, status: 'failed', error: 'Campaign 创建者尚未配置个人 Meta API 凭据' };
            results.push(item);
            sendEvent('progress', { index: i, ...item });
            continue;
          }

          // 发送正在推送事件
          sendEvent('progress', { index: i, campaignId, campaignName: localCampaign.name, status: 'pushing' });

          const radarConfig = (localCampaign.countryRadarConfig as any) || {};
          const cs = campaignSettings.objective ? campaignSettings : (radarConfig.campaignSettings || {});

          const pushResult = await metaApiService.pushCampaignToMeta(
            localCampaign as any,
            { campaignSettings: cs }
          );

          if (pushResult.campaign) {
            const totalAdsPushed = pushResult.adSets.reduce((sum, as_) =>
              sum + as_.ads.filter(a => a.ad).length, 0);
            const totalAdsFailed = pushResult.adSets.reduce((sum, as_) =>
              sum + as_.ads.filter(a => a.error).length, 0);
            const item = {
              campaignId,
              campaignName: localCampaign.name,
              status: 'success',
              metaCampaignId: pushResult.campaign.id,
              adsPushed: totalAdsPushed,
              adsFailed: totalAdsFailed,
            };
            results.push(item);
            successCount++;
            sendEvent('progress', { index: i, ...item });
            logger.info(`[RePush] Campaign ${localCampaign.name} -> Meta ID: ${pushResult.campaign.id} (${totalAdsPushed} ads pushed, ${totalAdsFailed} failed)`);
          } else {
            const isAuthError = pushResult.error?.code === 190;
            const errorMsg = pushResult.error?.message || 'Unknown error';
            const item = {
              campaignId,
              campaignName: localCampaign.name,
              status: isAuthError ? 'auth_failed' : 'failed',
              error: errorMsg,
            };
            
            // 将错误信息持久化到数据库的 JSON 字段中
            try {
              const currentConfig = (localCampaign.countryRadarConfig as any) || {};
              await prisma.adCampaign.update({
                where: { id: campaignId },
                data: {
                  countryRadarConfig: {
                    ...currentConfig,
                    pushError: errorMsg,
                    isAuthError: isAuthError
                  }
                }
              });
            } catch (dbErr) {
              logger.error(`[RePush] Failed to persist push error for ${campaignId}:`, dbErr);
            }

            results.push(item);
            failedCount++;
            sendEvent('progress', { index: i, ...item });
            logger.error(`[RePush] Campaign ${localCampaign.name} failed (${item.status}): ${errorMsg}`);
            
            // 如果是鉴权失败，后续也不用推了
            if (isAuthError) {
              logger.warn(`[RePush] Auth error detected, aborting remaining tasks.`);
              break;
            }
          }
        } catch (err: any) {
          const item = { campaignId, status: 'failed', error: err.message };
          results.push(item);
          failedCount++;
          sendEvent('progress', { index: i, ...item });
          logger.error(`[RePush] Unexpected error:`, err);
        }
      }

      logger.info(`[RePush] Completed. Success: ${successCount}, Failed: ${failedCount}`);
      sendEvent('done', {
        summary: { success: successCount, failed: failedCount, total: campaignIds.length },
        results,
      });
    } finally {
      // 解锁
      campaignIds.forEach(id => pushLocks.delete(id));
      res.end();
    }
  })
);

// POST /api/campaigns/batch-delete - 批量删除（先删 Meta 再删本地）
router.post(
  '/batch-delete',
  [
    body('ids').isArray({ min: 1 }).withMessage('请至少选择一个广告活动'),
  ],
  asyncHandler(async (req: any, res: any) => {
    const { ids } = req.body as { ids: string[] };

    // 先在 Meta 上删除（错误只记录不阻塞本地删除）
    for (const campaignId of ids) {
      try {
        const deleteResult = await metaApiService.deleteFromMeta(campaignId);
        if (!deleteResult.success) {
          logger.warn(`[BatchDelete] Failed to delete campaign ${campaignId} from Meta: ${deleteResult.error}`);
        }
      } catch (deleteErr: any) {
        logger.warn(`[BatchDelete] Skipped campaign ${campaignId}: ${deleteErr.message}`);
      }
    }

    // Prisma 的 onDelete: Cascade 会处理级联
    const result = await prisma.adCampaign.deleteMany({ where: { id: { in: ids } } });

    logger.info(`Batch delete: ${result.count} campaigns deleted (local + Meta)`);
    res.json({ data: { deleted: result.count } });
  })
);

// DELETE /api/campaigns/:id - 删除广告活动（先删 Meta，再级联删除本地 AdSet + Ad）
router.delete(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // 先在 Meta 上删除（错误只记录不阻塞本地删除）
    try {
      const deleteResult = await metaApiService.deleteFromMeta(id);
      if (!deleteResult.success) {
        logger.warn(`[Delete] Failed to delete campaign ${id} from Meta: ${deleteResult.error}`);
      }
    } catch (deleteErr: any) {
      logger.warn(`[Delete] Skipped campaign ${id}: ${deleteErr.message}`);
    }

    // Prisma 的 onDelete: Cascade 会处理级联
    await prisma.adCampaign.delete({ where: { id } });

    logger.info(`Campaign deleted: ${id} (local + Meta)`);
    res.status(204).send();
  })
);

// POST /api/campaigns/:id/duplicate - 复制广告活动
router.post(
  '/:id/duplicate',
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const original = await prisma.adCampaign.findUnique({
      where: { id },
      include: {
        adSets: {
          include: { ads: true },
        },
      },
    });

    if (!original) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // 复制 Campaign
    const newCampaign = await prisma.adCampaign.create({
      data: {
        name: `${original.name} (副本)`,
        objective: original.objective,
        status: 'draft',
        budgetType: original.budgetType,
        budgetAmount: original.budgetAmount,
        budgetCurrency: original.budgetCurrency,
        startDate: new Date(),
        adAccountId: original.adAccountId,
        isAutoCreated: false,
        ownerId: req.user?.userId,
        countryRadarConfig: original.countryRadarConfig as any,
      },
    });

    // 复制 AdSets + Ads
    for (const adSet of original.adSets) {
      const newAdSet = await prisma.adSet.create({
        data: {
          name: adSet.name.replace(original.name, newCampaign.name),
          status: 'draft',
          campaignId: newCampaign.id,
          targeting: adSet.targeting as any,
          audienceTemplate: adSet.audienceTemplate,
          placements: adSet.placements,
          budgetAmount: adSet.budgetAmount,
          bidStrategy: adSet.bidStrategy,
          optimizationGoal: adSet.optimizationGoal,
          billingEvent: adSet.billingEvent,
          countryCode: adSet.countryCode,
        },
      });

      for (const ad of adSet.ads) {
        await prisma.ad.create({
          data: {
            name: ad.name,
            status: 'draft',
            adSetId: newAdSet.id,
            creativeId: ad.creativeId,
            urlParameters: ad.urlParameters,
          },
        });
      }
    }

    logger.info(`Campaign duplicated: ${id} -> ${newCampaign.id}`);
    res.status(201).json({ data: newCampaign });
  })
);

export { router as campaignsRouter };
