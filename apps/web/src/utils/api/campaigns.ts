import api from './api'

// ===================== 类型定义 =====================

export interface Campaign {
  id: string
  name: string
  alias?: string
  objective: string
  status: string
  budgetType: 'daily' | 'lifetime'
  budgetAmount: number
  budgetCurrency: string
  startDate: string
  endDate?: string
  isAutoCreated: boolean
  metaCampaignId?: string
  countryRadarConfig?: {
    countryCode: string
    countryName: string
    audienceTemplate: string
    structure?: string
    creativeCount?: number
  }
  adAccount?: { id: string; name: string; metaAccountId: string }
  owner?: { id: string; displayName: string; username: string; avatar?: string | null }
  pushStatus?: 'pending' | 'pushing' | 'success' | 'failed' | 'auth_failed' | 'skipped'
  metaPushError?: string
  adSets?: AdSet[]
  _count?: { adSets: number }
  createdAt: string
  updatedAt: string
}

export interface AdSet {
  id: string
  name: string
  status: string
  campaignId: string
  targeting?: any
  audienceTemplate?: string
  placements: string[]
  budgetAmount?: number
  bidStrategy?: string
  optimizationGoal: string
  billingEvent: string
  countryCode?: string
  ads?: Ad[]
  _count?: { ads: number }
}

export interface Ad {
  id: string
  name: string
  status: string
  adSetId: string
  creativeId: string
  creative?: {
    id: string
    name: string
    type: string
    fileUrl: string
    width?: number
    height?: number
  }
  urlParameters?: string
}

export interface CountryTemplate {
  code: string
  name: string
  region: string
  defaultBudget: number
  defaultAudience: string
}

export interface AudienceTemplate {
  code: string
  name: string
  description: string
}

export interface CountryCopy {
  id: string
  countryCode: string
  countryName: string
  name: string
  primaryText: string
  headline: string
  description?: string
  ctaType: string
  useCount: number
  totalSpend: number
  totalConversions: number
  avgCpa?: number
  isActive: boolean
  isDefault: boolean
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface AutoCreatePayload {
  creativeIds: string[]
  countries: { 
    code: string
    dailyBudget?: number
    audienceTemplate?: string
    copyId?: string
  }[]
  structure?: '1-1-1' | '1-1-N'
  adsPerAdSet?: number
  audienceTemplate: string
  alias?: string
  // 单条文案（向后兼容）
  primaryText?: string
  headline?: string
  // 多条文案（按顺序分配给各广告）
  primaryTexts?: string[]
  headlines?: string[]
  landingUrl: string
  ctaType: string
  pushToMeta?: boolean
  // Campaign Settings
  campaignObjective?: string
  budgetStrategy?: 'CBO' | 'ABO'
  bidStrategy?: string
  costPerResultGoal?: number
  // Conversion Settings
  conversionLocation?: string
  optimizationGoal?: string
  pixelId?: string
  conversionEvent?: string
  // Targeting Settings
  ageMin?: number
  ageMax?: number
  targetGender?: number
  devicePlatforms?: string[]
  publisherPlatforms?: string[]
  userOs?: string[]
  placementType?: 'automatic' | 'manual'
}

export interface AutoCreateResult {
  summary: {
    totalCreated: number
    totalFailed: number
    totalCampaigns: number
    totalAdSets: number
    totalAds: number
    structure: string
  }
  campaigns: {
    campaignId: string
    campaignName: string
    adSetId?: string
    adSetName?: string
    adId?: string
    adName?: string
    countryCode: string
    countryName: string
    creativeName?: string
    dailyBudget: number
    audienceTemplate: string
    structure?: string
    ads?: {
      adId: string
      adName: string
      creativeName: string
      creativeId: string
    }[]
  }[]
  errors?: { countryCode: string; error: string }[]
  metaPushResults?: {
    campaignId: string
    campaignName: string
    status: 'success' | 'failed' | 'skipped'
    metaCampaignId?: string
    metaCampaignName?: string
    adSetsPushed?: number
    error?: string
    errorCode?: number
    reason?: string
  }[]
}

// ===================== API 调用 =====================

export const campaignsApi = {
  // 获取模板配置
  getTemplates: () =>
    api.get('/campaigns/templates'),

  // 批量自动创建广告 (长操作，需要更长超时)
  autoCreate: (data: AutoCreatePayload) =>
    api.post('/campaigns/auto-create', data, { timeout: 120000 }),

  // 列表
  list: (params?: { status?: string; countryCode?: string; limit?: number; offset?: number }) =>
    api.get('/campaigns', { params }),

  // 详情
  getById: (id: string) =>
    api.get(`/campaigns/${id}`),

  // 更新状态
  updateStatus: (id: string, status: 'active' | 'paused') =>
    api.put(`/campaigns/${id}/status`, { status }),

  // 删除
  delete: (id: string) =>
    api.delete(`/campaigns/${id}`),

  // 复制
  duplicate: (id: string) =>
    api.post(`/campaigns/${id}/duplicate`),

  // 批量更新状态
  batchUpdateStatus: (ids: string[], status: 'active' | 'paused') =>
    api.put('/campaigns/batch-status', { ids, status }),

  // 批量删除
  batchDelete: (ids: string[]) =>
    api.post('/campaigns/batch-delete', { ids }),

  // 同步状态（从 Meta 拉取最新状态）
  syncStatus: () =>
    api.post('/campaigns/sync-status'),

  // 重新推送到 Meta（针对推送失败的 Campaign）
  rePush: (campaignIds: string[], campaignSettings?: any) =>
    api.post('/campaigns/re-push', { campaignIds, campaignSettings }, { timeout: 300000 }),

  // ===================== 国家文案库 API =====================
  
  // 获取文案列表
  getCountryCopies: (params?: { countryCode?: string; isActive?: boolean; limit?: number; offset?: number }) =>
    api.get('/campaigns/country-copies', { params }),

  // 获取单个文案
  getCountryCopy: (id: string) =>
    api.get(`/campaigns/country-copies/${id}`),

  // 创建文案
  createCountryCopy: (data: Partial<CountryCopy>) =>
    api.post('/campaigns/country-copies', data),

  // 更新文案
  updateCountryCopy: (id: string, data: Partial<CountryCopy>) =>
    api.put(`/campaigns/country-copies/${id}`, data),

  // 删除文案
  deleteCountryCopy: (id: string) =>
    api.delete(`/campaigns/country-copies/${id}`),

  // 记录文案使用
  useCountryCopy: (id: string) =>
    api.post(`/campaigns/country-copies/${id}/use`),
}
