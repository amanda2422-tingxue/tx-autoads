import api from './api'

export interface Campaign {
  id: string
  name: string
  objective: string
  status: string
  budgetType: 'daily' | 'lifetime'
  budgetAmount: number
  startDate: string
  endDate?: string
}

export const campaignsApi = {
  list: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get('/campaigns', { params }),

  getById: (id: string) =>
    api.get(`/campaigns/${id}`),

  create: (data: Partial<Campaign>) =>
    api.post('/campaigns', data),

  update: (id: string, data: Partial<Campaign>) =>
    api.put(`/campaigns/${id}`, data),

  duplicate: (id: string) =>
    api.post(`/campaigns/${id}/duplicate`),
}
