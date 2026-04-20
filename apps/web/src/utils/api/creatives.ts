import api from './api'

export interface Creative {
  id: string
  name: string
  type: 'image' | 'video' | 'carousel' | 'collection'
  status: string
  score?: number
  tags?: string[]
  createdAt: string
}

export const creativesApi = {
  list: (params?: { status?: string; type?: string; limit?: number; offset?: number }) =>
    api.get('/creatives', { params }),

  getById: (id: string) =>
    api.get(`/creatives/${id}`),

  create: (data: Partial<Creative>) =>
    api.post('/creatives', data),

  update: (id: string, data: Partial<Creative>) =>
    api.put(`/creatives/${id}`, data),

  delete: (id: string) =>
    api.delete(`/creatives/${id}`),
}
