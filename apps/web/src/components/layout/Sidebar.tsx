import React from 'react'
import { Layout, Menu } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  PictureOutlined,
  RocketOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useAuth } from '../../contexts/AuthContext'

const { Sider } = Layout

interface SidebarProps {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, hasRole } = useAuth()

  // 根据角色动态构建菜单
  const menuItems: MenuProps['items'] = React.useMemo(() => {
    const items: MenuProps['items'] = [
      {
        key: 'dashboard',
        icon: <DashboardOutlined />,
        label: '数据看板',
      },
      {
        key: 'creatives',
        icon: <PictureOutlined />,
        label: '素材库',
      },
    ]

    // 优化师和管理员可以看到广告活动
    if (hasRole('admin', 'optimizer')) {
      items.push({
        key: 'campaigns',
        icon: <RocketOutlined />,
        label: '广告活动',
      })
    }

    items.push({
      key: 'performance',
      icon: <BarChartOutlined />,
      label: '数据分析',
    })

    // 优化师和管理员可以看到自动化规则
    if (hasRole('admin', 'optimizer')) {
      items.push({
        key: 'rules',
        icon: <ThunderboltOutlined />,
        label: '自动化规则',
      })
    }

    // 管理员可以看到用户管理
    if (hasRole('admin')) {
      items.push({
        key: 'users',
        icon: <TeamOutlined />,
        label: '用户管理',
      })
    }

    items.push({
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
    })

    return items
  }, [user, hasRole])

  // 根据当前路径设置选中的菜单项
  const selectedKeys = React.useMemo(() => {
    const path = location.pathname
    if (path === '/') return ['dashboard']
    const segment = path.slice(1).split('/')[0]
    return [segment]
  }, [location.pathname])

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    const pathMap: Record<string, string> = {
      dashboard: '/',
      creatives: '/creatives',
      campaigns: '/campaigns',
      performance: '/performance',
      rules: '/rules',
      users: '/users',
      settings: '/settings',
    }
    const path = pathMap[e.key]
    if (path) {
      navigate(path)
    }
  }

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      width={200}
      collapsedWidth={80}
      style={{
        background: '#001529',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 24px',
          color: '#fff',
          fontSize: collapsed ? 14 : 18,
          fontWeight: 'bold',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {collapsed ? 'A' : 'AutoAds'}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={selectedKeys}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ borderRight: 0 }}
      />
    </Sider>
  )
}

export default Sidebar
