import axios, { AxiosError } from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { logger } from '../utils/logger';
import { decrypt } from '../utils/encryption';
import { logAudit } from './audit.service';
import { prisma, AdCampaign, AdSet, Ad, Creative } from '@autoads/database';
import { getMetaCredentialForCampaign } from '../routes/metaCredentials';

// ==================================================================
// FIX #1 & #5: Lazy env-var reading + API version upgrade to v21.0
// All process.env reads happen at CALL TIME, not module-load time,
// so dotenv.config() order no longer matters.
// ==================================================================

export interface CredentialConfig {
  apiVersion: string;
  accessToken: string;
  adAccountId: string;
  pageId: string;
  appId: string;
  appSecret: string;
}

function getConfig(): CredentialConfig {
  return {
    apiVersion: process.env.META_API_VERSION || 'v21.0',
    accessToken: process.env.META_ACCESS_TOKEN || '',
    adAccountId: process.env.META_AD_ACCOUNT_ID || '',
    pageId: process.env.META_PAGE_ID || '',          // FIX #2
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
  };
}

/**
 * 凭据调度引擎 — 强制使用个人凭据
 * 1. 查询 Campaign owner 的默认 MetaCredential (isDefault=true)
 * 2. 检查 Token 是否已过期，过期则抛出明确错误
 * 3. 无个人凭据 → 拒绝操作并提示用户配置
 * 全局 .env 不再用于广告投放操作
 */
export async function resolveCredentialConfig(campaignId: string): Promise<CredentialConfig> {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    select: { ownerId: true, name: true },
  });

  if (!campaign?.ownerId) {
    throw new Error(
      `Campaign「${campaignId}」没有关联的创建者，无法获取 Meta 凭据。请确认该 Campaign 已分配 Owner。`
    );
  }

  const credential = await prisma.metaCredential.findFirst({
    where: { userId: campaign.ownerId, isDefault: true },
  });

  if (!credential?.metaAccessToken) {
    await logAudit({
      userId: campaign.ownerId,
      action: 'credential_dispatch',
      resourceType: 'meta_credential',
      resourceId: campaignId,
      details: {
        credentialType: 'personal',
        userId: campaign.ownerId,
        reason: 'No personal Meta credential configured',
      },
      result: 'failed',
      severity: 'warning',
    });
    throw new Error(
      `Campaign「${campaign.name || campaignId}」的创建者尚未配置 Meta API 凭据。` +
      `请前往「设置」页面配置个人 Meta 凭据后再试。`
    );
  }

  // ---- Token 过期检查 ----
  if (credential.tokenStatus === 'expired') {
    await logAudit({
      userId: campaign.ownerId,
      action: 'credential_dispatch',
      resourceType: 'meta_credential',
      resourceId: campaignId,
      details: {
        credentialType: 'personal',
        userId: campaign.ownerId,
        credentialId: credential.id,
        alias: credential.alias,
        tokenSource: credential.tokenSource || 'unknown',
        tokenStatus: credential.tokenStatus,
        reason: 'Token status is expired',
      },
      result: 'failed',
      severity: 'warning',
    });
    throw new Error(
      `Campaign「${campaign.name || campaignId}」创建者的 Meta Access Token 已过期。请让该用户前往「设置」页面重新授权。`
    );
  }

  if (credential.tokenExpiresAt && credential.tokenExpiresAt <= new Date()) {
    // 过期时间已到但状态未更新，自动修正
    await prisma.metaCredential.update({
      where: { id: credential.id },
      data: { tokenStatus: 'expired' },
    });
    await logAudit({
      userId: campaign.ownerId,
      action: 'credential_dispatch',
      resourceType: 'meta_credential',
      resourceId: campaignId,
      details: {
        credentialType: 'personal',
        userId: campaign.ownerId,
        credentialId: credential.id,
        alias: credential.alias,
        tokenSource: credential.tokenSource || 'unknown',
        tokenStatus: 'expired',
        tokenExpiresAt: credential.tokenExpiresAt.toISOString(),
        reason: 'Token expired at dispatch time',
      },
      result: 'failed',
      severity: 'warning',
    });
    throw new Error(
      `Campaign「${campaign.name || campaignId}」创建者的 Meta Access Token 已过期。请让该用户前往「设置」页面重新授权。`
    );
  }

  const accessToken = decrypt(credential.metaAccessToken);
  const personalAppId = credential.metaAppId ? decrypt(credential.metaAppId) : '';
  const adAccountId = credential.metaAdAccountId ? decrypt(credential.metaAdAccountId) : '';
  const pageId = credential.metaPageId ? decrypt(credential.metaPageId) : '';

  logger.info(
    `[CredentialDispatch] Using personal credentials for campaign ${campaignId} ` +
    `(user: ${campaign.ownerId}, alias: ${credential.alias}, appId: ${personalAppId || '(not set)'})`
  );

  // ---- Audit Log: 个人凭据调度成功 ----
  await logAudit({
    userId: campaign.ownerId,
    action: 'credential_dispatch',
    resourceType: 'meta_credential',
    resourceId: campaignId,
    details: {
      credentialType: 'personal',
      credentialId: credential.id,
      alias: credential.alias,
      userId: campaign.ownerId,
      appId: personalAppId || '(not set)',
      tokenSource: credential.tokenSource || 'unknown',
      tokenStatus: credential.tokenStatus,
      tokenExpiresAt: credential.tokenExpiresAt?.toISOString() || null,
    },
    result: 'success',
    severity: 'info',
  });

  return {
    apiVersion: 'v21.0',
    accessToken,
    adAccountId,
    pageId,
    appId: personalAppId,
    appSecret: credential.metaAppSecret ? decrypt(credential.metaAppSecret) : '',
  };
}

/**
 * getResolvedConfig 是 resolveCredentialConfig 的别名
 * 统一对外暴露的凭据调度入口：强制个人凭据，无 fallback
 */
export const getResolvedConfig = resolveCredentialConfig;

/** Build a one-shot axios client with the given credentials. */
function metaApi(cfg: CredentialConfig) {
  const config = cfg;
  const client = axios.create({
    baseURL: `https://graph.facebook.com/${config.apiVersion}`,
    timeout: 60000,
  });
  client.interceptors.request.use((reqConfig) => {
    reqConfig.params = reqConfig.params || {};
    reqConfig.params.access_token = config.accessToken;
    return reqConfig;
  });
  return client;
}

/** Public accessor — returns a client using global .env token (for /health endpoint ONLY). */
export function getMetaApiClient() {
  return metaApi(getConfig());
}

// ==================== Helpers ====================



export function getAdAccountId(accountId?: string, cfg?: CredentialConfig): string {
  const id = accountId || cfg?.adAccountId;
  if (!id) {
    throw new Error('广告账户 ID 未配置。请在个人凭据中设置 Ad Account ID。');
  }
  return id.startsWith('act_') ? id : `act_${id}`;
}

export function getPageId(pageId?: string, cfg?: CredentialConfig): string {
  const id = pageId || cfg?.pageId;
  if (!id) {
    throw new Error(
      'Facebook Page ID 未配置。请在个人凭据中设置 Page ID。' +
      'Page ID 是创建 Facebook 广告素材的必要参数。'
    );
  }
  return id;
}

// ==================== Error Handling ====================

export interface MetaApiError {
  message: string;
  code?: number;
  type?: string;
  fbtrace_id?: string;
}

export function parseMetaError(error: unknown): MetaApiError {
  const axiosError = error as AxiosError<{ error?: MetaApiError }>;
  const metaError = axiosError.response?.data?.error;
  if (metaError) {
    return {
      message: metaError.message || 'Unknown Meta API error',
      code: metaError.code,
      type: metaError.type,
      fbtrace_id: metaError.fbtrace_id,
    };
  }
  if (axiosError.message) return { message: axiosError.message };
  return { message: 'An unexpected error occurred' };
}

// ==================== Rate-limit aware helper ====================

const RATE_LIMIT_CODE = 80004;
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 30000; // 30 seconds — Meta rate limits need minutes to recover

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function metaApiCall<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<{ success: true; data: T } | { success: false; error: MetaApiError }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      const parsedError = parseMetaError(error);
      const axiosError = error as AxiosError<{ error?: any }>;

      // Check if it's a rate limit error
      const isRateLimit = parsedError.code === RATE_LIMIT_CODE;

      // Check if it's an auth error (code 190: Invalid OAuth 2.0 Access Token)
      if (parsedError.code === 190) {
        parsedError.message = 'Meta Access Token 已过期或无效，请前往「设置」页面重新授权';
        logger.error(`[MetaApi] Auth error (code 190) detected during ${operation}`);
        return { success: false, error: parsedError };
      }

      if (isRateLimit && attempt < MAX_RETRIES) {
        // Capped exponential backoff: 30s, 60s, 120s, 120s, 120s
        const delayMs = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), 120000);
        logger.warn(`[MetaApi] ${operation} hit rate limit (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Retrying in ${delayMs / 1000}s...`);
        await sleep(delayMs);
        continue;
      }

      // Final attempt or non-rate-limit error — log and return failure
      if (axiosError.response?.data?.error) {
        const fullErr = axiosError.response.data.error;
        logger.error(`[MetaApi] ${operation} full error: ${JSON.stringify(fullErr, null, 2)}`);
      }
      if (axiosError.config?.data) {
        logger.error(`[MetaApi] ${operation} request payload: ${typeof axiosError.config.data === 'string' ? axiosError.config.data : JSON.stringify(axiosError.config.data)}`);
      }
      logger.error(`[MetaApi] ${operation} failed: ${JSON.stringify(parsedError)}`);
      return { success: false, error: parsedError };
    }
  }
  // Should never reach here, but TypeScript needs it
  return { success: false, error: { message: 'Max retries exceeded' } };
}

// ==================== Interfaces ====================

export interface CreateCampaignParams {
  name: string;
  objective?: string;
  status?: string;
  special_ad_categories?: string[];
  daily_budget?: number;     // dollars (converted to cents internally)
  isCBO?: boolean;           // FIX #4: when true, budget is at campaign level
  bid_strategy?: string;
}

export interface CampaignResponse {
  id: string;
  name: string;
  status: string;
}

export interface CreateAdSetParams {
  name: string;
  campaign_id: string;
  daily_budget?: number;     // dollars — only set when ABO
  billing_event?: string;
  optimization_goal?: string;
  bid_strategy?: string;
  bid_amount?: number;
  targeting: {
    geo_locations?: { countries?: string[]; regions?: Array<{ key: string }> };
    age_min?: number;
    age_max?: number;
    genders?: number[];
    device_platforms?: string[];
    publisher_platforms?: string[];
    user_os?: string[];
    [key: string]: unknown;
  };
  status?: string;
  promoted_object?: Record<string, unknown>;
}

export interface AdSetResponse {
  id: string;
  name: string;
  status: string;
}

export interface CreateAdCreativeParams {
  name: string;
  page_id: string;
  image_hash?: string;       // FIX #3: use uploaded image hash instead of URL
  image_url?: string;        // fallback if image is already public
  video_id?: string;         // FIX #5: support video materials
  link: string;
  message: string;
  headline?: string;
  description?: string;
  cta_type: string;
}

export interface AdCreativeResponse {
  id: string;
  name: string;
}

export interface CreateAdParams {
  name: string;
  adset_id: string;
  creative: { creative_id: string };
  status?: string;
}

export interface AdResponse {
  id: string;
  name: string;
  status: string;
}

export interface PushCampaignResult {
  campaign?: CampaignResponse;
  adSets: Array<{
    localId: string;
    adSet?: AdSetResponse;
    ads: Array<{
      localId: string;
      adCreative?: AdCreativeResponse;
      ad?: AdResponse;
      error?: MetaApiError;
    }>;
    error?: MetaApiError;
  }>;
  error?: MetaApiError;
}

export type LocalCampaignWithRelations = AdCampaign & {
  adSets: Array<AdSet & { ads: Array<Ad & { creative: Creative }> }>;
};

// ==================================================================
// FIX #3: Upload local images to Facebook before creating creatives
// ==================================================================

interface ImageUploadResult {
  hash: string;
  url: string;
}

/**
 * Upload a local image file to Facebook Ad Account's image library.
 * Returns the image_hash which is used in ad creatives.
 */
export async function uploadAdImage(
  localFilePath: string,
  accountId?: string,
  cfg?: CredentialConfig
): Promise<ImageUploadResult> {
  if (!cfg) throw new Error('uploadAdImage 需要传入个人凭据配置 (cfg)，不允许使用全局配置。');
  const adAccountId = getAdAccountId(accountId, cfg);
  const config = cfg;

  // Resolve the absolute path from the relative /uploads/... path
  let absolutePath = localFilePath;
  if (localFilePath.startsWith('/uploads/')) {
    absolutePath = path.join(process.cwd(), localFilePath);
  }

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Image file not found: ${absolutePath}`);
  }

  const form = new FormData();
  form.append('filename', fs.createReadStream(absolutePath));

  const response = await axios.post(
    `https://graph.facebook.com/${config.apiVersion}/${adAccountId}/adimages`,
    form,
    {
      headers: { ...form.getHeaders() },
      params: { access_token: config.accessToken },
      timeout: 120000, // images can be large
    }
  );

  // Response format: { images: { "filename.png": { hash: "abc123", url: "https://..." } } }
  const images = response.data?.images;
  if (!images) {
    throw new Error('Unexpected response from Facebook adimages endpoint');
  }
  const firstImage = Object.values(images)[0] as any;
  if (!firstImage?.hash) {
    throw new Error('No image hash returned from Facebook');
  }

  logger.info(`[MetaApi] Image uploaded: ${path.basename(absolutePath)} -> hash=${firstImage.hash}`);
  return { hash: firstImage.hash, url: firstImage.url || '' };
}

// Image hash cache to avoid re-uploading the same image
const imageHashCache = new Map<string, string>();

async function getOrUploadImageHash(fileUrl: string, accountId?: string, cfg?: CredentialConfig): Promise<string> {
  if (imageHashCache.has(fileUrl)) {
    return imageHashCache.get(fileUrl)!;
  }
  const result = await uploadAdImage(fileUrl, accountId, cfg);
  imageHashCache.set(fileUrl, result.hash);
  return result.hash;
}

// ==================================================================
// FIX #5: Support video material uploads
// ==================================================================

/**
 * Upload a local video file to Facebook Ad Account.
 * Returns the video_id which is used in ad creatives.
 */
export async function uploadAdVideo(
  localFilePath: string,
  accountId?: string,
  cfg?: CredentialConfig
): Promise<{ id: string }> {
  if (!cfg) throw new Error('uploadAdVideo 需要传入个人凭据配置 (cfg)，不允许使用全局配置。');
  const adAccountId = getAdAccountId(accountId, cfg);
  const config = cfg;

  let absolutePath = localFilePath;
  if (localFilePath.startsWith('/uploads/')) {
    absolutePath = path.join(process.cwd(), localFilePath);
  }

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Video file not found: ${absolutePath}`);
  }

  const form = new FormData();
  // For videos, the field name is usually 'source'
  form.append('source', fs.createReadStream(absolutePath));

  const response = await axios.post(
    `https://graph.facebook.com/${config.apiVersion}/${adAccountId}/advideos`,
    form,
    {
      headers: { ...form.getHeaders() },
      params: { access_token: config.accessToken },
      timeout: 300000, // videos can be very large
    }
  );

  if (!response.data?.id) {
    throw new Error('No video ID returned from Facebook');
  }

  logger.info(`[MetaApi] Video uploaded: ${path.basename(absolutePath)} -> id=${response.data.id}`);
  return { id: response.data.id };
}

const videoIdCache = new Map<string, string>();

async function getOrUploadVideoId(fileUrl: string, accountId?: string, cfg?: CredentialConfig): Promise<string> {
  if (videoIdCache.has(fileUrl)) {
    return videoIdCache.get(fileUrl)!;
  }
  const result = await uploadAdVideo(fileUrl, accountId, cfg);
  videoIdCache.set(fileUrl, result.id);
  return result.id;
}

// ==================================================================
// FIX #4: Campaign creation — CBO puts budget at Campaign level
// ==================================================================

export async function createCampaign(
  params: CreateCampaignParams,
  accountId?: string,
  cfg?: CredentialConfig
): Promise<CampaignResponse> {
  const adAccountId = getAdAccountId(accountId, cfg);

  const payload: Record<string, unknown> = {
    name: params.name,
    objective: params.objective || 'OUTCOME_SALES',
    status: params.status || 'PAUSED',
    special_ad_categories: params.special_ad_categories || [],
  };

  // CBO: budget lives on the campaign
  if (params.isCBO && params.daily_budget !== undefined) {
    payload.daily_budget = Math.round(params.daily_budget * 100); // cents
  }

  // ABO: Meta API v21.0 requires is_adset_budget_sharing_enabled
  if (!params.isCBO) {
    payload.is_adset_budget_sharing_enabled = false;
  }

  // Bid strategy at campaign level (for CBO)
  if (params.bid_strategy) {
    payload.bid_strategy = params.bid_strategy;
  }

  const response = await metaApi(cfg).post<{ id: string }>(`/${adAccountId}/campaigns`, payload);

  return {
    id: response.data.id,
    name: params.name,
    status: payload.status as string,
  };
}

// ==================================================================
// FIX #4: AdSet creation — ABO puts budget at AdSet level
// ==================================================================

export async function createAdSet(
  params: CreateAdSetParams,
  accountId?: string,
  cfg?: CredentialConfig
): Promise<AdSetResponse> {
  const adAccountId = getAdAccountId(accountId, cfg);

  const payload: Record<string, unknown> = {
    name: params.name,
    campaign_id: params.campaign_id,
    billing_event: params.billing_event || 'IMPRESSIONS',
    optimization_goal: params.optimization_goal || 'OFFSITE_CONVERSIONS',
    targeting: params.targeting,
    status: params.status || 'PAUSED',
  };

  // ABO: budget lives on the ad set; CBO: NO budget on ad set
  if (params.daily_budget !== undefined && params.daily_budget > 0) {
    payload.daily_budget = Math.round(params.daily_budget * 100); // cents
  }

  if (params.bid_strategy) {
    payload.bid_strategy = params.bid_strategy;
  }
  if (params.bid_amount !== undefined) {
    payload.bid_amount = Math.round(params.bid_amount * 100);
  }

  if (params.promoted_object) {
    payload.promoted_object = params.promoted_object;
  }

  const response = await metaApi(cfg).post<{ id: string }>(`/${adAccountId}/adsets`, payload);

  return {
    id: response.data.id,
    name: params.name,
    status: payload.status as string,
  };
}

// ==================================================================
// FIX #2 & #3: AdCreative — require page_id, use image_hash
// ==================================================================

export async function createAdCreative(
  params: CreateAdCreativeParams,
  accountId?: string,
  cfg?: CredentialConfig
): Promise<AdCreativeResponse> {
  const adAccountId = getAdAccountId(accountId, cfg);
  const pageId = params.page_id; // already validated by caller

  const linkData: Record<string, unknown> = {
    link: params.link,
    message: params.message,
    call_to_action: {
      type: params.cta_type || 'LEARN_MORE',
      value: { link: params.link },
    },
  };

  if (params.headline) linkData.name = params.headline;         // Meta calls it "name"
  if (params.description) linkData.description = params.description;

  // Handle Video vs Image
  let objectStorySpec: Record<string, any>;

  if (params.video_id) {
    // FIX #5: Video creative uses video_data
    const videoData: Record<string, any> = {
      video_id: params.video_id,
      message: params.message,
      call_to_action: {
        type: params.cta_type || 'LEARN_MORE',
        value: { link: params.link },
      },
    };
    if (params.headline) videoData.title = params.headline;
    if (params.image_url) videoData.image_url = params.image_url; // Use as thumbnail if provided

    objectStorySpec = {
      page_id: pageId,
      video_data: videoData,
    };
  } else {
    // Default: Image creative uses link_data
    // Prefer image_hash (from upload), fall back to image_url (public URL)
    if (params.image_hash) {
      linkData.image_hash = params.image_hash;
    } else if (params.image_url) {
      linkData.image_url = params.image_url;
    }

    objectStorySpec = {
      page_id: pageId,
      link_data: linkData,
    };
  }

  const response = await metaApi(cfg).post<{ id: string }>(`/${adAccountId}/adcreatives`, {
    name: params.name,
    object_story_spec: objectStorySpec,
  });

  return {
    id: response.data.id,
    name: params.name,
  };
}

// ==================== Ad Operations ====================

export async function createAd(
  params: CreateAdParams,
  accountId?: string,
  cfg?: CredentialConfig
): Promise<AdResponse> {
  const adAccountId = getAdAccountId(accountId, cfg);

  const payload: Record<string, unknown> = {
    name: params.name,
    adset_id: params.adset_id,
    creative: params.creative,
    status: params.status || 'PAUSED',
  };

  const response = await metaApi(cfg).post<{ id: string }>(`/${adAccountId}/ads`, payload);

  return {
    id: response.data.id,
    name: params.name,
    status: payload.status as string,
  };
}

// ==================================================================
// MAIN: Push a locally created campaign to Meta Ads
// ALL 5 FIXES integrated here
// ==================================================================

export interface PushOptions {
  accountId?: string;
  pageId?: string;
  campaignSettings?: {
    objective?: string;
    budgetStrategy?: string;     // 'CBO' | 'ABO'
    bidStrategy?: string;
    costPerResultGoal?: number;
    conversionLocation?: string;
    optimizationGoal?: string;
    pixelId?: string;
    conversionEvent?: string;
    placementType?: string;
    publisherPlatforms?: string[];
  };
}

export async function pushCampaignToMeta(
  localCampaign: LocalCampaignWithRelations,
  options?: PushOptions
): Promise<PushCampaignResult> {
  // ---- Credential Dispatch: 强制个人凭据 ----
  const credentialConfig = await resolveCredentialConfig(localCampaign.id);
  const accountId = options?.accountId || credentialConfig.adAccountId;
  const pageId = getPageId(options?.pageId, credentialConfig);
  const cs = options?.campaignSettings || {};
  const isCBO = (cs.budgetStrategy || 'CBO') === 'CBO';

  const result: PushCampaignResult = { adSets: [] };

  // ---- Step 1: Create Campaign ----
  const campaignResult = await metaApiCall('createCampaign', () =>
    createCampaign(
      {
        name: localCampaign.name,
        objective: cs.objective || localCampaign.objective || 'OUTCOME_SALES',
        status: 'PAUSED',
        daily_budget: isCBO ? localCampaign.budgetAmount : undefined,  // FIX #4
        isCBO,
        bid_strategy: isCBO ? (cs.bidStrategy || undefined) : undefined,
      },
      accountId,
      credentialConfig
    )
  );

  if (!campaignResult.success) {
    result.error = campaignResult.error;
    return result;
  }
  result.campaign = campaignResult.data;

  // Update local DB
  try {
    await prisma.adCampaign.update({
      where: { id: localCampaign.id },
      data: { metaCampaignId: campaignResult.data.id },
    });
  } catch (dbError) {
    logger.error(`[MetaApi] Failed to update local campaign with metaCampaignId:`, dbError);
  }

  // ---- Step 2: Create AdSets ----
  for (const localAdSet of localCampaign.adSets) {
    const adSetResultItem: PushCampaignResult['adSets'][number] = {
      localId: localAdSet.id,
      ads: [],
    };

    const targeting = (localAdSet.targeting as CreateAdSetParams['targeting']) || {
      geo_locations: { countries: [localAdSet.countryCode || 'US'] },
    };

    // Build promoted_object for conversion campaigns
    let promoted_object: Record<string, unknown> | undefined;
    if (cs.pixelId && (cs.conversionEvent || cs.optimizationGoal === 'OFFSITE_CONVERSIONS')) {
      promoted_object = {
        pixel_id: cs.pixelId,
        custom_event_type: cs.conversionEvent || 'PURCHASE',
      };
    }

    // 根据 Campaign Objective 强制映射 optimization_goal（忽略本地 DB 中的默认值）
    const campaignObjective = cs.objective || localCampaign.objective || 'OUTCOME_SALES';
    let mappedOptimizationGoal: string;
    if (campaignObjective === 'OUTCOME_TRAFFIC') {
      mappedOptimizationGoal = 'LINK_CLICKS';
    } else if (campaignObjective === 'OUTCOME_AWARENESS') {
      mappedOptimizationGoal = 'REACH';
    } else if (campaignObjective === 'OUTCOME_ENGAGEMENT') {
      mappedOptimizationGoal = 'POST_ENGAGEMENT';
    } else if (campaignObjective === 'OUTCOME_APP_PROMOTION') {
      mappedOptimizationGoal = 'APP_INSTALLS';
    } else if (campaignObjective === 'OUTCOME_LEADS') {
      mappedOptimizationGoal = 'LEAD_GENERATION';
    } else {
      // OUTCOME_SALES -> OFFSITE_CONVERSIONS (需要 promoted_object + pixel_id)
      // 如果没有提供 pixelId，降级为 LINK_CLICKS 以确保 AdSet 能成功创建
      if (!promoted_object) {
        logger.warn(`[MetaApi] OUTCOME_SALES without pixelId — falling back to LINK_CLICKS optimization`);
        mappedOptimizationGoal = 'LINK_CLICKS';
      } else {
        mappedOptimizationGoal = 'OFFSITE_CONVERSIONS';
      }
    }

    // 根据 Campaign Objective 自动映射 billing_event
    // 新广告账户（如 AutoAds-02）不支持 LINK_CLICKS 计费，统一使用 IMPRESSIONS 最安全
    const mappedBillingEvent = 'IMPRESSIONS';

    const adSetResult = await metaApiCall('createAdSet', () =>
      createAdSet(
        {
          name: localAdSet.name,
          campaign_id: campaignResult.data.id,
          // FIX #4: only set budget at AdSet level when ABO
          daily_budget: !isCBO ? (localAdSet.budgetAmount || localCampaign.budgetAmount) : undefined,
          billing_event: mappedBillingEvent,
          optimization_goal: mappedOptimizationGoal,
          bid_strategy: !isCBO ? (cs.bidStrategy || undefined) : undefined,
          bid_amount: cs.costPerResultGoal || undefined,
          targeting,
          status: 'ACTIVE',
          promoted_object,
        },
        accountId,
        credentialConfig
      )
    );

    if (!adSetResult.success) {
      adSetResultItem.error = adSetResult.error;
      result.adSets.push(adSetResultItem);
      continue;
    }
    adSetResultItem.adSet = adSetResult.data;

    // Update local DB
    try {
      await prisma.adSet.update({
        where: { id: localAdSet.id },
        data: { metaAdSetId: adSetResult.data.id },
      });
    } catch (dbError) {
      logger.error(`[MetaApi] Failed to update local adSet with metaAdSetId:`, dbError);
    }

    // ---- Step 3 & 4: Upload Image -> Create AdCreative -> Create Ad ----
    for (const localAd of localAdSet.ads) {
      const adResultItem: PushCampaignResult['adSets'][number]['ads'][number] = {
        localId: localAd.id,
      };

      const creative = localAd.creative;

      // Parse ad text from urlParameters (where the frontend stores it)
      let adText = { primaryText: '', headline: '', landingUrl: '', ctaType: 'LEARN_MORE' };
      try {
        adText = JSON.parse(localAd.urlParameters || '{}');
      } catch { /* use defaults */ }

      // Use ad-level text, fall back to creative-level fields
      const primaryText = adText.primaryText || creative.primaryText || localAd.name;
      const headline = adText.headline || creative.headline || '';
      const landingUrl = adText.landingUrl || '';
      const ctaType = adText.ctaType || creative.callToAction || 'LEARN_MORE';

      // FIX #3 & #5: Upload local image/video to Facebook first
      let imageHash: string | undefined;
      let imageUrl: string | undefined;
      let videoId: string | undefined;

      if (creative.fileUrl) {
        if (creative.fileUrl.startsWith('http')) {
          // Already a public URL — use directly
          imageUrl = creative.fileUrl;
        } else {
          // Local file — upload to Facebook based on type
          if (creative.type === 'video') {
            const uploadResult = await metaApiCall('uploadAdVideo', () =>
              getOrUploadVideoId(creative.fileUrl, accountId, credentialConfig)
            );
            if (uploadResult.success) {
              videoId = uploadResult.data;
            } else {
              adResultItem.error = uploadResult.error;
              adSetResultItem.ads.push(adResultItem);
              logger.error(`[MetaApi] Video upload failed for ${creative.name}: ${uploadResult.error.message}`);
              continue;
            }
          } else {
            // Default to image
            const uploadResult = await metaApiCall('uploadAdImage', () =>
              getOrUploadImageHash(creative.fileUrl, accountId, credentialConfig)
            );
            if (uploadResult.success) {
              imageHash = uploadResult.data;
            } else {
              adResultItem.error = uploadResult.error;
              adSetResultItem.ads.push(adResultItem);
              logger.error(`[MetaApi] Image upload failed for ${creative.name}: ${uploadResult.error.message}`);
              continue;
            }
          }
        }
      }

      // FIX #2: Always include page_id in ad creative
      const adCreativeResult = await metaApiCall('createAdCreative', () =>
        createAdCreative(
          {
            name: `${localAd.name}_Creative`,
            page_id: pageId,
            image_hash: imageHash,
            image_url: imageUrl,
            video_id: videoId,
            link: landingUrl,
            message: primaryText,
            headline: headline,
            cta_type: ctaType,
          },
          accountId,
          credentialConfig
        )
      );

      if (!adCreativeResult.success) {
        adResultItem.error = adCreativeResult.error;
        adSetResultItem.ads.push(adResultItem);
        continue;
      }
      adResultItem.adCreative = adCreativeResult.data;

      // Create Ad
      const adResult = await metaApiCall('createAd', () =>
        createAd(
          {
            name: localAd.name,
            adset_id: adSetResult.data.id,
            creative: { creative_id: adCreativeResult.data.id },
            status: 'ACTIVE',
          },
          accountId,
          credentialConfig
        )
      );

      if (!adResult.success) {
        adResultItem.error = adResult.error;
        adSetResultItem.ads.push(adResultItem);
        continue;
      }
      adResultItem.ad = adResult.data;

      // Update local DB
      try {
        await prisma.ad.update({
          where: { id: localAd.id },
          data: { metaAdId: adResult.data.id },
        });
      } catch (dbError) {
        logger.error(`[MetaApi] Failed to update local ad with metaAdId:`, dbError);
      }

      adSetResultItem.ads.push(adResultItem);
    }

    result.adSets.push(adSetResultItem);
  }

  return result;
}

// ==================== Status Updates ====================

export async function updateCampaignStatus(
  metaCampaignId: string,
  status: string,
  cfg?: CredentialConfig
): Promise<CampaignResponse> {
  await metaApi(cfg).post<{ success: boolean }>(`/${metaCampaignId}`, { status });
  return { id: metaCampaignId, name: '', status };
}

export async function updateAdSetStatus(
  metaAdSetId: string,
  status: string,
  cfg?: CredentialConfig
): Promise<AdSetResponse> {
  await metaApi(cfg).post<{ success: boolean }>(`/${metaAdSetId}`, { status });
  return { id: metaAdSetId, name: '', status };
}

export async function updateAdStatus(
  metaAdId: string,
  status: string,
  cfg?: CredentialConfig
): Promise<AdResponse> {
  await metaApi(cfg).post<{ success: boolean }>(`/${metaAdId}`, { status });
  return { id: metaAdId, name: '', status };
}

// ==================== Delete Operations ====================

/**
 * Delete a campaign on Meta. This cascading-deletes all child adsets and ads on Meta's side.
 */
export async function deleteMetaCampaign(
  metaCampaignId: string,
  cfg?: CredentialConfig
): Promise<void> {
  await metaApi(cfg).delete(`/${metaCampaignId}`);
  logger.info(`[MetaApi] Deleted campaign on Meta: ${metaCampaignId}`);
}

/**
 * Push local status change to Meta for a campaign and all its children.
 * Non-blocking: errors are logged but don't throw.
 */
export async function syncStatusToMeta(
  campaignId: string,
  status: 'active' | 'paused'
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  const metaStatus = status === 'active' ? 'ACTIVE' : 'PAUSED';

  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    include: {
      adSets: {
        include: { ads: true },
      },
    },
  });

  if (!campaign) {
    return { success: false, errors: ['Campaign not found in local DB'] };
  }

  // ---- Credential Dispatch: 个人优先，全局兜底 ----
  const credentialConfig = await resolveCredentialConfig(campaign.id);

  // Update Campaign on Meta
  if (campaign.metaCampaignId) {
    const result = await metaApiCall('updateCampaignStatus', () =>
      metaApi(credentialConfig).post<{ success: boolean }>(`/${campaign.metaCampaignId}`, { status: metaStatus })
        .then(() => ({ id: campaign.metaCampaignId!, name: '', status: metaStatus }))
    );
    if (!result.success) {
      errors.push(`Campaign ${campaign.name}: ${result.error.message}`);
    }
  }

  // Update AdSets on Meta
  for (const adSet of campaign.adSets) {
    if (adSet.metaAdSetId) {
      const result = await metaApiCall('updateAdSetStatus', () =>
        metaApi(credentialConfig).post<{ success: boolean }>(`/${adSet.metaAdSetId}`, { status: metaStatus })
          .then(() => ({ id: adSet.metaAdSetId!, name: '', status: metaStatus }))
      );
      if (!result.success) {
        errors.push(`AdSet ${adSet.name}: ${result.error.message}`);
      }
    }

    // Update Ads on Meta
    for (const ad of adSet.ads) {
      if (ad.metaAdId) {
        const result = await metaApiCall('updateAdStatus', () =>
          metaApi(credentialConfig).post<{ success: boolean }>(`/${ad.metaAdId}`, { status: metaStatus })
            .then(() => ({ id: ad.metaAdId!, name: '', status: metaStatus }))
        );
        if (!result.success) {
          errors.push(`Ad ${ad.name}: ${result.error.message}`);
        }
      }
    }
  }

  if (errors.length > 0) {
    logger.warn(`[MetaApi] syncStatusToMeta partial errors: ${errors.join('; ')}`);
  }
  return { success: errors.length === 0, errors };
}

/**
 * Delete a campaign from Meta (by local campaign ID).
 * Non-blocking: errors are logged but don't throw.
 */
export async function deleteFromMeta(campaignId: string): Promise<{ success: boolean; error?: string }> {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign?.metaCampaignId) {
    return { success: true }; // Nothing to delete on Meta
  }

  // ---- Credential Dispatch: 个人优先，全局兜底 ----
  const credentialConfig = await resolveCredentialConfig(campaign.id);

  const result = await metaApiCall('deleteMetaCampaign', () =>
    metaApi(credentialConfig).delete(`/${campaign.metaCampaignId}`).then(() => {
      logger.info(`[MetaApi] Deleted campaign on Meta: ${campaign.metaCampaignId}`);
    })
  );
  if (!result.success) {
    return { success: false, error: result.error.message };
  }
  return { success: true };
}

// ==================== Status Sync from Meta ====================

export interface SyncStatusResult {
  syncedCampaigns: number;
  syncedAdSets: number;
  syncedAds: number;
  errors: string[];
}

/**
 * Sync campaign/adset/ad statuses from Meta to local DB.
 * Only campaigns with metaCampaignId are synced.
 * Uses stored metaAdSetId/metaAdId for direct API lookup (more reliable than name matching).
 */
export async function syncStatusFromMeta(): Promise<SyncStatusResult> {
  const result: SyncStatusResult = {
    syncedCampaigns: 0,
    syncedAdSets: 0,
    syncedAds: 0,
    errors: [],
  };

  // Fetch all campaigns that have been pushed to Meta
  const campaigns = await prisma.adCampaign.findMany({
    where: { metaCampaignId: { not: null } },
    include: {
      adSets: {
        include: { ads: true },
      },
    },
  });

  if (campaigns.length === 0) {
    return result;
  }

  for (const campaign of campaigns) {
    try {
      // ---- Credential Dispatch per campaign: 强制个人凭据 ----
      const credentialConfig = await resolveCredentialConfig(campaign.id);
      const client = metaApi(credentialConfig);

      // Fetch campaign status from Meta
      const metaCampaign = await client.get(`/${campaign.metaCampaignId}`, {
        params: { fields: 'id,status' },
      });
      const metaStatus = metaCampaign.data.status?.toLowerCase();

      // Map Meta status to local status
      const localStatus = metaStatus === 'active' ? 'active' : 'paused';

      if (campaign.status !== localStatus) {
        await prisma.adCampaign.update({
          where: { id: campaign.id },
          data: { status: localStatus },
        });
        result.syncedCampaigns++;
        logger.info(`[SyncStatus] Campaign ${campaign.name}: ${campaign.status} -> ${localStatus}`);
      }

      // Sync each AdSet using stored metaAdSetId (direct lookup, no name matching)
      for (const adSet of campaign.adSets) {
        if (adSet.metaAdSetId) {
          try {
            const metaAdSetResp = await client.get(`/${adSet.metaAdSetId}`, {
              params: { fields: 'id,status' },
            });
            const metaAdSetStatus = metaAdSetResp.data.status?.toLowerCase();
            const localAdSetStatus = metaAdSetStatus === 'active' ? 'active' : 'paused';

            if (adSet.status !== localAdSetStatus) {
              await prisma.adSet.update({
                where: { id: adSet.id },
                data: { status: localAdSetStatus },
              });
              result.syncedAdSets++;
            }
          } catch (adSetErr: any) {
            const msg = `AdSet ${adSet.name} (${adSet.metaAdSetId}): ${adSetErr.response?.data?.error?.message || adSetErr.message}`;
            result.errors.push(msg);
            logger.error(`[SyncStatus] ${msg}`);
          }
        }

        // Sync each Ad using stored metaAdId (direct lookup)
        for (const ad of adSet.ads) {
          if (ad.metaAdId) {
            try {
              const metaAdResp = await client.get(`/${ad.metaAdId}`, {
                params: { fields: 'id,status' },
              });
              const metaAdStatus = metaAdResp.data.status?.toLowerCase();
              const localAdStatus = metaAdStatus === 'active' ? 'active' : 'paused';

              if (ad.status !== localAdStatus) {
                await prisma.ad.update({
                  where: { id: ad.id },
                  data: { status: localAdStatus },
                });
                result.syncedAds++;
              }
            } catch (adErr: any) {
              const msg = `Ad ${ad.name} (${ad.metaAdId}): ${adErr.response?.data?.error?.message || adErr.message}`;
              result.errors.push(msg);
              logger.error(`[SyncStatus] ${msg}`);
            }
          }
        }
      }
    } catch (error: any) {
      const errMsg = `Campaign ${campaign.name} (${campaign.metaCampaignId}): ${error.response?.data?.error?.message || error.message}`;
      result.errors.push(errMsg);
      logger.error(`[SyncStatus] ${errMsg}`);
    }
  }

  return result;
}

// ==================== Insights / Performance Data Sync ====================

/**
 * 从 Meta API 拉取广告表现数据并写入 ad_performance 表
 * 支持按 campaign/adset/ad 层级拉取指定日期范围的数据
 */
export async function syncInsightsFromMeta(
  options?: {
    startDate?: string;  // ISO date string, defaults to 7 days ago
    endDate?: string;    // ISO date string, defaults to today
    level?: 'campaign' | 'adset' | 'ad'; // 默认拉取所有层级
  }
): Promise<{ synced: number; errors: string[] }> {
  const result = { synced: 0, errors: [] as string[] };
  const startDate = options?.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = options?.endDate || new Date().toISOString().split('T')[0];
  const level = options?.level;

  // Meta Insights API 需要的指标
  const fields = [
    'campaign_id', 'adset_id', 'ad_id',
    'date_start', 'date_stop',
    'spend', 'impressions', 'clicks', 'ctr',
    'actions', 'action_values',
    'cpc', 'cpm', 'frequency', 'reach',
  ].join(',');

  logger.info(`[InsightsSync] Fetching from ${startDate} to ${endDate}, level: ${level || 'all'}`);

  // 获取所有已推送到 Meta 的 Campaign（有 metaCampaignId 的）
  const campaigns = await prisma.adCampaign.findMany({
    where: { metaCampaignId: { not: null } },
    include: {
      adSets: {
        where: { metaAdSetId: { not: null } },
        include: {
          ads: {
            where: { metaAdId: { not: null } },
          },
        },
      },
    },
  });

  if (campaigns.length === 0) {
    logger.info('[InsightsSync] No campaigns with metaCampaignId found');
    return result;
  }

  logger.info(`[InsightsSync] Found ${campaigns.length} campaigns to sync`);

  for (const campaign of campaigns) {
    if (!campaign.metaCampaignId) continue;

    try {
      // ---- Credential Dispatch per campaign: 强制个人凭据 ----
      const credentialConfig = await resolveCredentialConfig(campaign.id);

      // === Campaign Level ===
      logger.info(`[InsightsSync] [${campaign.name}] Fetching campaign insights...`);
      const campStart = Date.now();
      const insightsResult = await metaApi(credentialConfig).get(`/${campaign.metaCampaignId}/insights`, {
        timeout: 15000,
        params: {
          level: 'campaign',
          fields,
          time_range: JSON.stringify({ since: startDate, until: endDate }),
          limit: 1000,
        },
      });
      logger.info(`[InsightsSync] [${campaign.name}] Campaign insights fetched in ${Date.now() - campStart}ms, rows=${insightsResult.data.data?.length ?? 0}`);

      const dataRows = insightsResult.data.data || [];
      for (const row of dataRows) {
        const dateStr = row.date_start;
        if (!dateStr) continue;

        const date = new Date(dateStr);
        const spend = parseFloat(row.spend || '0');
        const impressions = parseInt(row.impressions || '0', 10);
        const clicks = parseInt(row.clicks || '0', 10);
        const ctr = row.ctr ? parseFloat(row.ctr) / 100 : null;
        const cpc = row.cpc ? parseFloat(row.cpc) : null;
        const cpm = row.cpm ? parseFloat(row.cpm) : null;
        const frequency = row.frequency ? parseFloat(row.frequency) : null;
        const reach = row.reach ? parseInt(row.reach, 10) : null;

        let conversions = 0;
        if (row.actions && Array.isArray(row.actions)) {
          const purchaseAction = row.actions.find((a: any) =>
            a.action_type === 'offsite_conversion.fb_pixel_purchase' ||
            a.action_type === 'offsite_conversion.fb_pixel_lead' ||
            a.action_type === 'onsite_conversion.purchase' ||
            a.action_type === 'complete_registration' ||
            a.action_type === 'lead'
          );
          if (purchaseAction) {
            conversions = parseInt(purchaseAction.value || '0', 10);
          }
        }

        const cpa = conversions > 0 ? spend / conversions : null;

        await prisma.adPerformance.upsert({
          where: {
            level_metaObjectId_date_hour: {
              level: 'campaign',
              metaObjectId: campaign.metaCampaignId,
              date,
              hour: 0,
            },
          },
          create: {
            level: 'campaign',
            metaObjectId: campaign.metaCampaignId,
            date,
            hour: 0,
            spend,
            impressions,
            clicks,
            ctr,
            conversions,
            cpa,
            cpc,
            cpm,
            frequency,
            reach,
            campaignId: campaign.id,
            rawData: row as any,
          },
          update: {
            spend,
            impressions,
            clicks,
            ctr,
            conversions,
            cpa,
            cpc,
            cpm,
            frequency,
            reach,
            rawData: row as any,
            syncedAt: new Date(),
          },
        });

        result.synced++;
      }

      // === AdSet Level (parallel) ===
      const adSetPromises = campaign.adSets.map(async (adSet) => {
        if (!adSet.metaAdSetId) return;

        try {
          logger.info(`[InsightsSync] [${campaign.name}] Fetching adset ${adSet.name} (${adSet.metaAdSetId}) insights...`);
          const asStart = Date.now();
          const adSetInsights = await metaApi(credentialConfig).get(`/${adSet.metaAdSetId}/insights`, {
            timeout: 15000,
            params: {
              level: 'adset',
              fields,
              time_range: JSON.stringify({ since: startDate, until: endDate }),
              limit: 1000,
            },
          });
          logger.info(`[InsightsSync] [${campaign.name}] AdSet ${adSet.metaAdSetId} insights fetched in ${Date.now() - asStart}ms, rows=${adSetInsights.data.data?.length ?? 0}`);

          let asSynced = 0;
          for (const row of adSetInsights.data.data || []) {
            const dateStr = row.date_start;
            if (!dateStr) continue;

            const date = new Date(dateStr);
            const spend = parseFloat(row.spend || '0');
            const impressions = parseInt(row.impressions || '0', 10);
            const clicks = parseInt(row.clicks || '0', 10);
            const ctr = row.ctr ? parseFloat(row.ctr) / 100 : null;
            const cpc = row.cpc ? parseFloat(row.cpc) : null;
            const cpm = row.cpm ? parseFloat(row.cpm) : null;
            const frequency = row.frequency ? parseFloat(row.frequency) : null;
            const reach = row.reach ? parseInt(row.reach, 10) : null;

            let conversions = 0;
            if (row.actions && Array.isArray(row.actions)) {
              const purchaseAction = row.actions.find((a: any) =>
                a.action_type === 'offsite_conversion.fb_pixel_purchase' ||
                a.action_type === 'offsite_conversion.fb_pixel_lead' ||
                a.action_type === 'onsite_conversion.purchase'
              );
              if (purchaseAction) conversions = parseInt(purchaseAction.value || '0', 10);
            }
            const cpa = conversions > 0 ? spend / conversions : null;

            await prisma.adPerformance.upsert({
              where: {
                level_metaObjectId_date_hour: {
                  level: 'adset',
                  metaObjectId: adSet.metaAdSetId,
                  date,
                  hour: 0,
                },
              },
              create: {
                level: 'adset',
                metaObjectId: adSet.metaAdSetId,
                date,
                hour: 0,
                spend,
                impressions,
                clicks,
                ctr,
                conversions,
                cpa,
                cpc,
                cpm,
                frequency,
                reach,
                adSetId: adSet.id,
                campaignId: campaign.id,
                rawData: row as any,
              },
              update: {
                spend,
                impressions,
                clicks,
                ctr,
                conversions,
                cpa,
                cpc,
                cpm,
                frequency,
                reach,
                rawData: row as any,
                syncedAt: new Date(),
              },
            });

            asSynced++;
          }
          result.synced += asSynced;
        } catch (adSetErr: any) {
          const msg = `AdSet ${adSet.metaAdSetId}: ${adSetErr.response?.data?.error?.message || adSetErr.message}`;
          result.errors.push(msg);
          logger.error(`[InsightsSync] [${campaign.name}] ${msg}`);
        }
      });

      await Promise.all(adSetPromises);

      // === Ad Level (parallel across all ads in campaign) ===
      const allAds = campaign.adSets.flatMap((as_) => as_.ads.map((ad) => ({ ad, adSet: as_ })));
      const adPromises = allAds.map(async ({ ad, adSet }) => {
        if (!ad.metaAdId) return;

        try {
          logger.info(`[InsightsSync] [${campaign.name}] Fetching ad ${ad.name} (${ad.metaAdId}) insights...`);
          const adStart = Date.now();
          const adInsights = await metaApi(credentialConfig).get(`/${ad.metaAdId}/insights`, {
            timeout: 15000,
            params: {
              level: 'ad',
              fields,
              time_range: JSON.stringify({ since: startDate, until: endDate }),
              limit: 1000,
            },
          });
          logger.info(`[InsightsSync] [${campaign.name}] Ad ${ad.metaAdId} insights fetched in ${Date.now() - adStart}ms, rows=${adInsights.data.data?.length ?? 0}`);

          let adSynced = 0;
          for (const row of adInsights.data.data || []) {
            const dateStr = row.date_start;
            if (!dateStr) continue;

            const date = new Date(dateStr);
            const spend = parseFloat(row.spend || '0');
            const impressions = parseInt(row.impressions || '0', 10);
            const clicks = parseInt(row.clicks || '0', 10);
            const ctr = row.ctr ? parseFloat(row.ctr) / 100 : null;
            const cpc = row.cpc ? parseFloat(row.cpc) : null;
            const cpm = row.cpm ? parseFloat(row.cpm) : null;
            const frequency = row.frequency ? parseFloat(row.frequency) : null;
            const reach = row.reach ? parseInt(row.reach, 10) : null;

            let conversions = 0;
            if (row.actions && Array.isArray(row.actions)) {
              const purchaseAction = row.actions.find((a: any) =>
                a.action_type === 'offsite_conversion.fb_pixel_purchase' ||
                a.action_type === 'offsite_conversion.fb_pixel_lead' ||
                a.action_type === 'onsite_conversion.purchase'
              );
              if (purchaseAction) conversions = parseInt(purchaseAction.value || '0', 10);
            }
            const cpa = conversions > 0 ? spend / conversions : null;

            await prisma.adPerformance.upsert({
              where: {
                level_metaObjectId_date_hour: {
                  level: 'ad',
                  metaObjectId: ad.metaAdId,
                  date,
                  hour: 0,
                },
              },
              create: {
                level: 'ad',
                metaObjectId: ad.metaAdId,
                date,
                hour: 0,
                spend,
                impressions,
                clicks,
                ctr,
                conversions,
                cpa,
                cpc,
                cpm,
                frequency,
                reach,
                adId: ad.id,
                adSetId: adSet.id,
                campaignId: campaign.id,
                rawData: row as any,
              },
              update: {
                spend,
                impressions,
                clicks,
                ctr,
                conversions,
                cpa,
                cpc,
                cpm,
                frequency,
                reach,
                rawData: row as any,
                syncedAt: new Date(),
              },
            });

            adSynced++;
          }
          result.synced += adSynced;
        } catch (adErr: any) {
          const msg = `Ad ${ad.metaAdId}: ${adErr.response?.data?.error?.message || adErr.message}`;
          result.errors.push(msg);
          logger.error(`[InsightsSync] [${campaign.name}] ${msg}`);
        }
      });

      await Promise.all(adPromises);

      logger.info(`[InsightsSync] [${campaign.name}] Done. Total synced so far: ${result.synced}`);
    } catch (err: any) {
      result.errors.push(`Campaign ${campaign.metaCampaignId}: ${err.response?.data?.error?.message || err.message}`);
      logger.error(`[InsightsSync] Failed for campaign ${campaign.name}:`, err);
    }
  }

  logger.info(`[InsightsSync] Done. Synced ${result.synced} records, ${result.errors.length} errors`);
  return result;
}

// ==================== Service Class ====================

export class MetaApiService {
  static createCampaign = createCampaign;
  static createAdSet = createAdSet;
  static createAdCreative = createAdCreative;
  static createAd = createAd;
  static uploadAdImage = uploadAdImage;
  static uploadAdVideo = uploadAdVideo;
  static pushCampaignToMeta = pushCampaignToMeta;
  static updateCampaignStatus = updateCampaignStatus;
  static updateAdSetStatus = updateAdSetStatus;
  static updateAdStatus = updateAdStatus;
  static deleteMetaCampaign = deleteMetaCampaign;
  static syncStatusToMeta = syncStatusToMeta;
  static deleteFromMeta = deleteFromMeta;
  static syncStatusFromMeta = syncStatusFromMeta;
  static syncInsightsFromMeta = syncInsightsFromMeta;
  static getAdAccountId = getAdAccountId;
  static getPageId = getPageId;
  static getMetaApiClient = getMetaApiClient;
  static resolveCredentialConfig = resolveCredentialConfig;
  static getResolvedConfig = getResolvedConfig;
}
