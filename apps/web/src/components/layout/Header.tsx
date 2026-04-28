import React from 'react'
import { Layout, Space, Avatar, Button, Dropdown, Tag } from 'antd'
import {
  BellOutlined, UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  LogoutOutlined, SettingOutlined, KeyOutlined,
} from '@ant-design/icons'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import type { MenuProps } from 'antd'

const { Header: AntHeader } = Layout

const ROLE_LABELS: Record<string, { text: string; color: string }> = {
  admin: { text: '管理员', color: 'red' },
  optimizer: { text: '优化师', color: 'blue' },
  designer: { text: '设计师', color: 'green' },
}

interface HeaderProps {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

const Header: React.FC<HeaderProps> = ({ collapsed, setCollapsed }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const roleConfig = ROLE_LABELS[user?.role || ''] || { text: '未知', color: 'default' }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <SettingOutlined />,
      label: '个人设置',
      onClick: () => navigate('/settings'),
    },
    {
      key: 'change-password',
      icon: <KeyOutlined />,
      label: '修改密码',
      onClick: () => navigate('/settings'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: () => {
        logout()
        navigate('/login', { replace: true })
      },
    },
  ]

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
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer' }}>
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: roleConfig.color === 'red' ? '#f5222d' : roleConfig.color === 'blue' ? '#1890ff' : '#52c41a' }} />
            <span>{user?.displayName || '用户'}</span>
            <Tag color={roleConfig.color} style={{ marginLeft: -4 }}>{roleConfig.text}</Tag>
          </Space>
        </Dropdown>
      </Space>
    </AntHeader>
  )
}

export default Header
