import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from 'antd'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import Dashboard from './pages/Dashboard'
import Creatives from './pages/Creatives'
import Campaigns from './pages/Campaigns'
import Performance from './pages/Performance'
import Rules from './pages/Rules'
import Settings from './pages/Settings'

const { Content } = Layout

function App() {
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
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
