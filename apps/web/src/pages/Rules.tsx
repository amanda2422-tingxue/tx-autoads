import React, { useState } from 'react'
import { Table, Button, Space, Tag, Switch, Tooltip } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined, CheckCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

interface Rule {
  id: string
  name: string
  ruleType: 'budget' | 'status' | 'notification'
  status: 'active' | 'paused' | 'draft'
  isActive: boolean
  executionCount: number
  lastExecuted: string
}

const mockData: Rule[] = [
  { id: '1', name: '高 CPA 自动暂停', ruleType: 'status', status: 'active', isActive: true, executionCount: 12, lastExecuted: '2026-04-20 10:30' },
  { id: '2', name: '低 CTR 预算减少', ruleType: 'budget', status: 'active', isActive: true, executionCount: 8, lastExecuted: '2026-04-20 09:15' },
  { id: '3', name: '每日报告通知', ruleType: 'notification', status: 'paused', isActive: false, executionCount: 30, lastExecuted: '2026-04-19' },
]

const ruleTypeMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
  budget: { color: 'orange', text: '预算规则', icon: <ThunderboltOutlined /> },
  status: { color: 'red', text: '状态规则', icon: <CheckCircleOutlined /> },
  notification: { color: 'blue', text: '通知规则', icon: <ThunderboltOutlined /> },
}

const Rules: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(mockData)

  const handleToggle = (record: Rule, checked: boolean) => {
    setData(prev =>
      prev.map(item =>
        item.id === record.id
          ? { ...item, isActive: checked, status: checked ? 'active' as const : 'paused' as const }
          : item
      )
    )
  }

  const columns: ColumnsType<Rule> = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'ruleType',
      key: 'ruleType',
      width: 120,
      render: (type: string) => {
        const config = ruleTypeMap[type] || { color: 'default', text: type, icon: null }
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        )
      },
    },
    {
      title: '执行次数',
      dataIndex: 'executionCount',
      key: 'executionCount',
      width: 100,
    },
    {
      title: '最后执行',
      dataIndex: 'lastExecuted',
      key: 'lastExecuted',
      width: 160,
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: (_, record) => (
        <Switch
          checked={record.isActive}
          onChange={(checked) => handleToggle(record, checked)}
          checkedChildren="开"
          unCheckedChildren="关"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="link" icon={<EditOutlined />} size="small" />
          </Tooltip>
          <Tooltip title="删除">
            <Button type="link" icon={<DeleteOutlined />} danger size="small" />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <div className="card-header">
        <h2 style={{ margin: 0 }}>自动化规则</h2>
        <Button type="primary" icon={<PlusOutlined />}>
          创建规则
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  )
}

export default Rules
