import api from './api'

export const performanceApi = {
  // 手动同步 Meta 数据 (长操作，需要更长超时)
  sync: (data?: { startDate?: string; endDate?: string; level?: string }) =>
    api.post('/performance/sync', data, { timeout: 120000 }),

  // 获取表现数据列表
  list: (params?: {
    level?: string
    campaignId?: string
    startDate?: string
    endDate?: string
    limit?: number
  }) =>
    api.get('/performance', { params }),

  // Dashboard 概览
  dashboard: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/performance/dashboard', { params }),

  // 素材表现排行（支持筛选）
  creativeRanking: (params?: {
    startDate?: string
    endDate?: string
    limit?: number
    sortBy?: 'conversions' | 'spend' | 'ctr' | 'cpa' | 'score'
    designer?: string
    country?: string
    type?: string
  }) =>
    api.get('/performance/creative-ranking', { params }),

  // 素材表现总览统计
  creativeSummary: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/performance/creative-summary', { params }),

  // 单个素材的每日趋势
  creativeDetail: (creativeId: string, params?: { startDate?: string; endDate?: string }) =>
    api.get(`/performance/creative-detail/${creativeId}`, { params }),

  // 广告系列表现详情（含 AdSet/Ad 下钻）
  campaignDetail: (campaignId: string, params?: { startDate?: string; endDate?: string }) =>
    api.get(`/performance/campaign/${campaignId}`, { params }),

  // 投放数据多维度分析
  deliveryAnalysis: (params?: {
    startDate?: string
    endDate?: string
    dimension?: 'campaign' | 'country' | 'designer'
    campaignId?: string
  }) =>
    api.get('/performance/delivery-analysis', { params }),
}
