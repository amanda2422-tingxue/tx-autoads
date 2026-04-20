import React from 'react'
import { Layout, Space, Avatar } from 'antd'
import { BellOutlined, UserOutlined } from '@ant-design/icons'

const { Header: AntHeader } = Layout

const Header: React.FC = () => {
  return (
    <AntHeader
      style={{
        padding: '0 24px',
        background: '#fff',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        height: 64,
        marginLeft: 200,
      }}
    >
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
