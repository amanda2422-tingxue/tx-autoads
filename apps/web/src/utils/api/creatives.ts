import api from './api'

export interface CountryStat {
  countryCode: string
  totalSpend: number
  totalConversions: number
  avgCpa?: number
}

export interface Creative {
  id: string
  name: string
  type: 'image' | 'video' | 'carousel' | 'collection'
  status: string
  owner?: { id: string; displayName: string; username: string; avatar?: string | null }
  score?: number
  designer?: string
  country?: string
  uploadedAt?: string
  tags?: string[]
  createdAt: string
  fileUrl?: string
  width?: number
  height?: number
  _count?: {
    ads: number
  }
  // 统计数据（当 withStats=true 时返回）
  countryStats?: CountryStat[]
  totalSpend?: number
  totalConversions?: number
}

export interface CreativeStats {
  creativeId: string
  creativeName: string
  overall: {
    total_ads: number
    total_spend: number
    total_impressions: number
    total_clicks: number
    total_conversions: number
    ctr: number
    cvr: number
    avg_cpa?: number
  }
  byCountry: {
    country_code: string
    ad_count: number
    total_spend: number
    total_impressions: number
    total_clicks: number
    total_conversions: number
    cvr: number
    avg_cpa?: number
    last_active_date?: string
  }[]
}

export const creativesApi = {
  list: (params?: { status?: string; type?: string; limit?: number; offset?: number; withStats?: boolean }) =>
    api.get('/creatives', { params }),

  getById: (id: string) =>
    api.get(`/creatives/${id}`),

  getStats: (id: string) =>
    api.get(`/creatives/${id}/stats`),

  create: (data: Partial<Creative>) =>
    api.post('/creatives', data),

  update: (id: string, data: Partial<Creative>) =>
    api.put(`/creatives/${id}`, data),

  delete: (id: string) =>
    api.delete(`/creatives/${id}`),

  upload: (formData: FormData) =>
    api.post('/creatives/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
}
