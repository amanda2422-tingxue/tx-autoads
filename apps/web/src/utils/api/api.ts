import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000, // 30s default for normal requests
  headers: {
    'Content-Type': 'application/json',
  },
})

const TOKEN_KEY = 'autoads_access_token'

// 请求拦截器 — 自动挂载 JWT Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    if (error.response) {
      const status = error.response.status
      const code = error.response.data?.code

      // Token 过期或无效 — 跳转登录页
      if (status === 401 && (code === 'TOKEN_EXPIRED' || code === 'INVALID_TOKEN')) {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem('autoads_refresh_token')
        // 避免在登录页面触发跳转
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login'
        }
      }

      const message = error.response.data?.error || '请求失败'
      console.error('API Error:', message)
    }
    return Promise.reject(error)
  }
)

export default api
