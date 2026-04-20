import React, { useState } from 'react'
import { Table, Button, Space, Tag, Input, Select } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, CopyOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

const { Option } = Select

interface Campaign {
  id: string
  name: string
  objective: string
  status: 'draft' | 'active' | 'paused' | 'ended'
  budget: number
  budgetType: 'daily' | 'lifetime'
  adSetCount: number
  createdAt: string
}

const mockData: Campaign[] = [
  { id: '1', name: '问卷调研-美国', objective: 'CONVERSIONS', status: 'active', budget: 500, budgetType: 'daily', adSetCount: 3, createdAt: '2026-04-15' },
  { id: '2', name: '问卷调研-加拿大', objective: 'CONVERSIONS', status: 'active', budget: 300, budgetType: 'daily', adSetCount: 2, createdAt: '2026-04-16' },
  { id: '3', name: '品牌认知度提升', objective: 'BRAND_AWARENESS', status: 'paused', budget: 1000, budgetType: 'lifetime', adSetCount: 1, createdAt: '2026-04-10' },
]

const statusMap: Record<string, { color: string; text: string }> = {
  active: { color: 'success', text: '活跃' },
  paused: { color: 'warning', text: '暂停' },
  draft: { color: 'default', text: '草稿' },
  ended: { color: 'default', text: '已结束' },
}

const objectiveMap: Record<string, string> = {
  CONVERSIONS: '转化',
  BRAND_AWARENESS: '品牌认知',
  TRAFFIC: '流量',
  LEAD_GENERATION: '潜在客户',
}

const Campaigns: React.FC = () => {
  const [loading, setLoading] = useState(false)

  const columns: ColumnsType<Campaign> = [
    {
      title: '活动名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '目标',
      dataIndex: 'objective',
      key: 'objective',
      width: 120,
      render: (obj: string) => objectiveMap[obj] || obj,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config = statusMap[status] || { color: 'default', text: status }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: '预算',
      key: 'budget',
      width: 120,
      render: (_, record) => {
        const type = record.budgetType === 'daily' ? '/天' : '/总计'
        return `$${record.budget}${type}`
      },
    },
    {
      title: '广告组',
      dataIndex: 'adSetCount',
      key: 'adSetCount',
      width: 80,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" icon={<EditOutlined />} size="small">编辑</Button>
          <Button type="link" icon={<CopyOutlined />} size="small">复制</Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <div className="card-header">
        <h2 style={{ margin: 0 }}>广告活动</h2>
        <Button type="primary" icon={<PlusOutlined />}>
          创建新活动
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} size={8}>
        <Input
          placeholder="搜索活动..."
          prefix={<SearchOutlined />}
          style={{ width: 250 }}
        />
        <Select placeholder="状态" style={{ width: 120 }} allowClear>
          <Option value="active">活跃</Option>
          <Option value="paused">暂停</Option>
          <Option value="draft">草稿</Option>
          <Option value="ended">已结束</Option>
        </Select>
      </Space>

      <Table
        columns={columns}
        dataSource={mockData}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  )
}

export default Campaigns
