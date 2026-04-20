import React from 'react'
import { Layout, Menu } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import type { MenuProps } from 'antd'

const { Sider } = Layout

interface SidebarProps {
  menuItems: MenuProps['items']
}

const Sidebar: React.FC<SidebarProps> = ({ menuItems }) => {
  const navigate = useNavigate()
  const location = useLocation()

  // 根据当前路径设置选中的菜单项
  const selectedKeys = React.useMemo(() => {
    const path = location.pathname
    if (path === '/') return ['dashboard']
    const key = path.slice(1)
    return [key]
  }, [location.pathname])

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    const menuItem = menuItems?.find((item: any) => item.key === e.key)
    if (menuItem?.path) {
      navigate(menuItem.path)
    }
  }

  return (
    <Sider
      breakpoint="lg"
      collapsedWidth="80"
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
      }}
    >
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 18,
          fontWeight: 'bold',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        AutoAds
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
