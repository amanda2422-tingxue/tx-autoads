import api from './api'

export const metaApi = {
  health: () =>
    api.get('/meta/health'),

  accounts: () =>
    api.get('/meta/accounts'),

  campaigns: (params?: { accountId?: string; status?: string; limit?: number }) =>
    api.get('/meta/campaigns', { params }),

  insights: (params?: {
    campaignId?: string
    adSetId?: string
    adId?: string
    since?: string
    until?: string
  }) =>
    api.get('/meta/insights', { params }),

  sync: () =>
    api.post('/meta/sync'),
}
