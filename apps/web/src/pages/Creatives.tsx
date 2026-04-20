import React, { useState } from 'react'
import { Table, Button, Space, Tag, Input } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

interface Creative {
  id: string
  name: string
  type: 'image' | 'video' | 'carousel'
  status: 'draft' | 'active' | 'paused' | 'archived'
  score: number
  tags: string[]
  createdAt: string
}

const mockData: Creative[] = [
  { id: '1', name: '问卷调研广告-A', type: 'image', status: 'active', score: 85.5, tags: ['survey', 'high-ctr'], createdAt: '2026-04-15' },
  { id: '2', name: '问卷调研广告-B', type: 'video', status: 'active', score: 72.3, tags: ['survey', 'new'], createdAt: '2026-04-16' },
  { id: '3', name: '产品推广广告', type: 'carousel', status: 'paused', score: 45.1, tags: ['product'], createdAt: '2026-04-10' },
]

const statusMap: Record<string, { color: string; text: string }> = {
  active: { color: 'success', text: '活跃' },
  paused: { color: 'warning', text: '暂停' },
  draft: { color: 'default', text: '草稿' },
  archived: { color: 'default', text: '归档' },
}

const typeMap: Record<string, string> = {
  image: '图片',
  video: '视频',
  carousel: '轮播',
}

const Creatives: React.FC = () => {
  const [loading, setLoading] = useState(false)

  const columns: ColumnsType<Creative> = [
    {
      title: '素材名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => <Tag>{typeMap[type] || type}</Tag>,
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
      title: '评分',
      dataIndex: 'score',
      key: 'score',
      width: 100,
      render: (score: number) => (
        <span style={{ color: score >= 80 ? '#52c41a' : score >= 60 ? '#faad14' : '#ff4d4f' }}>
          {score}
        </span>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <>
          {tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </>
      ),
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
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" icon={<EditOutlined />} size="small">编辑</Button>
          <Button type="link" icon={<DeleteOutlined />} danger size="small">删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <div className="card-header">
        <h2 style={{ margin: 0 }}>素材库</h2>
        <Button type="primary" icon={<PlusOutlined />}>
          上传素材
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} size={8}>
        <Input
          placeholder="搜索素材..."
          prefix={<SearchOutlined />}
          style={{ width: 250 }}
        />
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

export default Creatives
