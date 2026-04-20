import api from './api'

export const performanceApi = {
  list: (params?: {
    level?: string
    campaignId?: string
    startDate?: string
    endDate?: string
    limit?: number
  }) =>
    api.get('/performance', { params }),

  dashboard: () =>
    api.get('/performance/dashboard'),
}
