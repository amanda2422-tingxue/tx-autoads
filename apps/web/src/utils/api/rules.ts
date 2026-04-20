import api from './api'

export interface Rule {
  id: string
  name: string
  ruleType: 'budget' | 'bid' | 'status' | 'notification'
  status: string
  isActive: boolean
  conditions: any
  actions: any
  executionCount: number
  createdAt: string
}

export const rulesApi = {
  list: (params?: { status?: string; ruleType?: string; isActive?: boolean }) =>
    api.get('/rules', { params }),

  getById: (id: string) =>
    api.get(`/rules/${id}`),

  create: (data: Partial<Rule>) =>
    api.post('/rules', data),

  update: (id: string, data: Partial<Rule>) =>
    api.put(`/rules/${id}`, data),

  activate: (id: string) =>
    api.post(`/rules/${id}/activate`),

  deactivate: (id: string) =>
    api.post(`/rules/${id}/deactivate`),

  delete: (id: string) =>
    api.delete(`/rules/${id}`),

  getLogs: (id: string, params?: { limit?: number; offset?: number }) =>
    api.get(`/rules/${id}/logs`, { params }),
}
