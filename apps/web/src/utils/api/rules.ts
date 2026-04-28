import api from './api'

export interface Condition {
  metric: string
  operator: '>' | '<' | '>=' | '<=' | '==' | '!='
  value: number
  timeWindow?: string
}

export interface Action {
  type: 'pause' | 'unpause' | 'adjust_budget' | 'adjust_bid' | 'notify'
  params?: Record<string, any>
}

export interface Rule {
  id: string
  name: string
  description?: string
  ruleType: 'budget' | 'bid' | 'status' | 'notification'
  status: string
  isActive: boolean
  applyTo: 'campaign' | 'adset' | 'ad'
  targetIds: string[]
  conditions: Condition[]
  actions: Action[]
  conditionLogic: 'AND' | 'OR'
  executionCount: number
  maxExecutions?: number
  cooldownMinutes: number
  notifyEmails: string[]
  createdAt: string
  updatedAt: string
  _count?: { executionLogs: number }
}

export interface ExecutionLog {
  id: string
  ruleId: string
  executedAt: string
  status: 'success' | 'failed' | 'skipped'
  triggerData?: any
  actionsTaken?: any
  errorMessage?: string
}

export const rulesApi = {
  list: (params?: { status?: string; ruleType?: string; isActive?: boolean }) =>
    api.get('/rules', { params }),

  getById: (id: string) =>
    api.get(`/rules/${id}`),

  create: (data: any) =>
    api.post('/rules', data),

  update: (id: string, data: any) =>
    api.put(`/rules/${id}`, data),

  activate: (id: string) =>
    api.post(`/rules/${id}/activate`),

  deactivate: (id: string) =>
    api.post(`/rules/${id}/deactivate`),

  delete: (id: string) =>
    api.delete(`/rules/${id}`),

  getLogs: (id: string, params?: { limit?: number; offset?: number }) =>
    api.get(`/rules/${id}/logs`, { params }),

  test: (id: string) =>
    api.post(`/rules/${id}/test`),

  execute: (id: string) =>
    api.post(`/rules/${id}/execute`),
}
