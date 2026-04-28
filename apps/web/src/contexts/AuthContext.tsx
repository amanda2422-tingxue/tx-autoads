/**
 * Auth Context — 全局认证状态管理
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, UserInfo } from '../utils/api/auth';
import { message } from 'antd';

interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initialized: boolean;        // 系统是否已初始化 (至少有一个用户)
  systemCheckDone: boolean;    // 是否完成了初始化检查
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
  isOwner: (ownerId?: string | null) => boolean;
  canWrite: (ownerId?: string | null) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'autoads_access_token';
const REFRESH_TOKEN_KEY = 'autoads_refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    initialized: true,
    systemCheckDone: false,
  });

  // 检查系统初始化状态
  useEffect(() => {
    checkSystemInit();
  }, []);

  const checkSystemInit = async () => {
    try {
      const res = await authApi.checkInit();
      const data = res.data || res;
      setState(prev => ({
        ...prev,
        initialized: data.initialized,
        systemCheckDone: true,
      }));

      // 如果已初始化且有本地 token，尝试恢复会话
      if (data.initialized && localStorage.getItem(TOKEN_KEY)) {
        await restoreSession();
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch {
      setState(prev => ({ ...prev, isLoading: false, systemCheckDone: true }));
    }
  };

  const restoreSession = async () => {
    try {
      const res = await authApi.me();
      const userData = res.data || res;
      setState(prev => ({
        ...prev,
        user: userData,
        isAuthenticated: true,
        isLoading: false,
      }));
    } catch {
      // Token 失效，尝试刷新
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        try {
          const res = await authApi.refresh(refreshToken);
          const data = res.data || res;
          localStorage.setItem(TOKEN_KEY, data.accessToken);
          localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
          // 重新获取用户信息
          const userRes = await authApi.me();
          const userData = userRes.data || userRes;
          setState(prev => ({
            ...prev,
            user: userData,
            isAuthenticated: true,
            isLoading: false,
          }));
          return;
        } catch {
          // 刷新也失败了
        }
      }
      // 清除失效的 token
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await authApi.login({ username, password });
      const data = res.data || res;
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      setState(prev => ({
        ...prev,
        user: data.user,
        isAuthenticated: true,
        initialized: true,
      }));
      message.success(`欢迎回来，${data.user.displayName}`);
      return true;
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.error || '登录失败';
      message.error(errMsg);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setState(prev => ({
      ...prev,
      user: null,
      isAuthenticated: false,
    }));
    message.info('已退出登录');
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.me();
      const userData = res.data || res;
      setState(prev => ({ ...prev, user: userData }));
    } catch {
      // ignore
    }
  }, []);

  const hasRole = useCallback((...roles: string[]) => {
    if (!state.user) return false;
    return roles.includes(state.user.role);
  }, [state.user]);

  const isOwner = useCallback((ownerId?: string | null) => {
    if (!state.user) return false;
    if (state.user.role === 'admin') return true;
    return ownerId === state.user.id;
  }, [state.user]);

  const canWrite = useCallback((ownerId?: string | null) => {
    if (!state.user) return false;
    if (state.user.role === 'admin') return true;
    if (!ownerId) return true; // 无 owner 的资源允许操作
    return ownerId === state.user.id;
  }, [state.user]);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      logout,
      refreshUser,
      hasRole,
      isOwner,
      canWrite,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
