import React from 'react'
import { Layout, Space, Avatar, Button } from 'antd'
import { BellOutlined, UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'

const { Header: AntHeader } = Layout

interface HeaderProps {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

const Header: React.FC<HeaderProps> = ({ collapsed, setCollapsed }) => {
  return (
    <AntHeader
      style={{
        padding: '0 24px',
        background: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 64,
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
      }}
    >
      <Button
        type="text"
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={() => setCollapsed(!collapsed)}
        style={{
          fontSize: '16px',
          width: 64,
          height: 64,
        }}
      />
      <Space size={24}>
        <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
        <Space>
          <Avatar icon={<UserOutlined />} />
          <span>管理员</span>
        </Space>
      </Space>
    </AntHeader>
  )
}

export default Header
