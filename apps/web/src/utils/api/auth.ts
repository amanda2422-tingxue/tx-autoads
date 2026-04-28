/**
 * Auth API 工具
 */
import api from './api';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    username: string;
    email: string;
    displayName: string;
    role: 'admin' | 'optimizer' | 'designer';
    avatar: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  displayName: string;
  role?: 'admin' | 'optimizer' | 'designer';
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: 'admin' | 'optimizer' | 'designer';
  avatar: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  metaStatus?: {
    configured: boolean;
    hasToken?: boolean;
    tokenStatus?: string;
    lastVerifiedAt?: string | null;
    apiVersion?: string;
  };
}

export interface UserListItem {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
  avatar: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
  metaCredential: { tokenStatus: string; lastVerifiedAt: string | null } | null;
  _count: { creatives: number; campaigns: number; automationRules: number };
}

export const authApi = {
  checkInit: () => api.get('/auth/check-init'),
  register: (data: RegisterRequest) => api.post('/auth/register', data),
  login: (data: LoginRequest) => api.post('/auth/login', data),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

export const usersApi = {
  list: () => api.get('/users'),
  getById: (id: string) => api.get(`/users/${id}`),
  update: (id: string, data: Partial<{ displayName: string; email: string; role: string; isActive: boolean }>) =>
    api.put(`/users/${id}`, data),
  resetPassword: (id: string, newPassword: string) =>
    api.post(`/users/${id}/reset-password`, { newPassword }),
  delete: (id: string) => api.delete(`/users/${id}`),
};

export interface MetaCredentialItem {
  id: string;
  alias: string;
  isDefault: boolean;
  configured: boolean;
  metaAppId: string | null;
  metaAdAccountId: string | null;
  metaPageId: string | null;
  tokenSource: string;
  tokenStatus: string;
  tokenExpiresAt: string | null;
  lastVerifiedAt: string | null;
  hasAccessToken: boolean;
  hasAppSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

export const metaCredentialsApi = {
  /** 获取当前用户所有凭据列表 */
  list: () => api.get('/meta-credentials'),
  /** 创建新凭据 */
  create: (data: {
    alias?: string;
    metaAppId?: string;
    metaAppSecret?: string;
    metaAccessToken?: string;
    metaAdAccountId?: string;
    metaPageId?: string;
  }) => api.post('/meta-credentials', data),
  /** 更新指定凭据 */
  update: (id: string, data: {
    alias?: string;
    metaAppId?: string;
    metaAppSecret?: string;
    metaAccessToken?: string;
    metaAdAccountId?: string;
    metaPageId?: string;
  }) => api.put(`/meta-credentials/${id}`, data),
  /** 验证指定凭据 Token */
  verify: (id: string) => api.post(`/meta-credentials/${id}/verify`),
  /** 删除指定凭据 */
  delete: (id: string) => api.delete(`/meta-credentials/${id}`),
  /** 设置指定凭据为默认 */
  setDefault: (id: string) => api.put(`/meta-credentials/${id}/set-default`),
};

export const auditLogsApi = {
  list: (params?: {
    userId?: string;
    action?: string;
    resourceType?: string;
    severity?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/audit-logs', { params }),
  alerts: (limit?: number) => api.get('/audit-logs/alerts', { params: { limit } }),
};

export interface CredentialOverviewItem {
  credentialId: string;
  userName: string;
  userId: string;
  role: string;
  alias: string;
  isDefault: boolean;
  appId: string;
  adAccountId: string;
  pageId: string;
  tokenType: 'system_user' | 'user_token' | 'unconfigured';
  tokenStatus: 'valid' | 'expired' | 'unconfigured';
  lastVerifiedAt: string | null;
  updatedAt: string | null;
}

export const adminApi = {
  credentialsOverview: () => api.get<{ data: CredentialOverviewItem[] }>('/admin/credentials-overview'),
};
