import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout, Spin } from 'antd'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import Dashboard from './pages/Dashboard'
import Creatives from './pages/Creatives'
import Campaigns from './pages/Campaigns'
import Performance from './pages/Performance'
import CampaignDetail from './pages/CampaignDetail'
import Rules from './pages/Rules'
import Settings from './pages/Settings'
import Privacy from './pages/Privacy'
import Login from './pages/Login'
import UserManagement from './pages/UserManagement'
import { useAuth } from './contexts/AuthContext'

const { Content } = Layout

/**
 * 路由守卫 — 已登录才能访问
 */
function RequireAuth({ children }: { children: React.ReactElement }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

/**
 * 角色守卫 — 指定角色才能访问
 */
function RequireRole({ roles, children }: { roles: string[]; children: React.ReactElement }) {
  const { user } = useAuth()
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return children
}

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <Layout
        style={{
          marginLeft: 0,
          transition: 'all 0.2s',
        }}
      >
        <Header collapsed={collapsed} setCollapsed={setCollapsed} />
        <Content
          style={{
            margin: '16px',
            padding: '24px',
            background: '#f5f5f5',
            minHeight: 'calc(100vh - 64px - 32px)',
          }}
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/creatives" element={<Creatives />} />
            <Route path="/campaigns" element={
              <RequireRole roles={['admin', 'optimizer']}>
                <Campaigns />
              </RequireRole>
            } />
            <Route path="/campaigns/:id" element={
              <RequireRole roles={['admin', 'optimizer']}>
                <CampaignDetail />
              </RequireRole>
            } />
            <Route path="/performance" element={<Performance />} />
            <Route path="/rules" element={
              <RequireRole roles={['admin', 'optimizer']}>
                <Rules />
              </RequireRole>
            } />
            <Route path="/users" element={
              <RequireRole roles={['admin']}>
                <UserManagement />
              </RequireRole>
            } />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/*" element={
        <RequireAuth>
          <AppLayout />
        </RequireAuth>
      } />
    </Routes>
  )
}

export default App
