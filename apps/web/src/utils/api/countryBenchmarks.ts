import api from './api'

export interface CountryBenchmark {
  id: string
  countryCode: string
  countryName: string
  payout: number
  breakEvenCvr: number
  targetCvr: number
  ctrThreshold: number
  cpcCeiling: number
  roasBuffer: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export const countryBenchmarksApi = {
  list: () => api.get('/country-benchmarks'),

  getByCode: (countryCode: string) =>
    api.get(`/country-benchmarks/${countryCode}`),

  create: (data: Partial<CountryBenchmark>) =>
    api.post('/country-benchmarks', data),

  update: (countryCode: string, data: Partial<CountryBenchmark>) =>
    api.put(`/country-benchmarks/${countryCode}`, data),

  delete: (countryCode: string) =>
    api.delete(`/country-benchmarks/${countryCode}`),

  seed: () => api.post('/country-benchmarks/seed'),
}
