import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import {
  DashboardOutlined,
  PictureOutlined,
  RocketOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import Dashboard from './pages/Dashboard'
import Creatives from './pages/Creatives'
import Campaigns from './pages/Campaigns'
import Performance from './pages/Performance'
import Rules from './pages/Rules'
import Settings from './pages/Settings'

const { Sider, Content } = Layout

const menuItems: MenuProps['items'] = [
  {
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: '数据看板',
    path: '/',
  },
  {
    key: 'creatives',
    icon: <PictureOutlined />,
    label: '素材库',
    path: '/creatives',
  },
  {
    key: 'campaigns',
    icon: <RocketOutlined />,
    label: '广告活动',
    path: '/campaigns',
  },
  {
    key: 'performance',
    icon: <BarChartOutlined />,
    label: '数据分析',
    path: '/performance',
  },
  {
    key: 'rules',
    icon: <ThunderboltOutlined />,
    label: '自动化规则',
    path: '/rules',
  },
  {
    key: 'settings',
    icon: <SettingOutlined />,
    label: '设置',
    path: '/settings',
  },
]

function App() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar menuItems={menuItems} />
      <Layout>
        <Header />
        <Content style={{ margin: '16px' }}>
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
