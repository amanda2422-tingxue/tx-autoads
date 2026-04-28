/**
 * 用户管理页 (Admin only)
 */
import React, { useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select, Switch,
  Card, message, Popconfirm, Badge, Tooltip
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined,
  UserOutlined, SafetyOutlined
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi, authApi, UserListItem } from '../utils/api/auth'
import dayjs from 'dayjs'

const { Option } = Select

const ROLE_MAP: Record<string, { color: string; text: string }> = {
  admin: { color: 'red', text: '管理员' },
  optimizer: { color: 'blue', text: '优化师' },
  designer: { color: 'green', text: '设计师' },
}

const UserManagement: React.FC = () => {
  const queryClient = useQueryClient()
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false)
  const [isEditModalVisible, setIsEditModalVisible] = useState(false)
  const [isResetPwModalVisible, setIsResetPwModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [resetPwForm] = Form.useForm()

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await usersApi.list()
      return (res.data || res) as UserListItem[]
    },
  })

  const createMutation = useMutation({
    mutationFn: (values: any) => authApi.register(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      message.success('用户创建成功')
      setIsCreateModalVisible(false)
      createForm.resetFields()
    },
    onError: (err: any) => message.error(err.response?.data?.error || err.error || '创建失败'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      message.success('用户信息已更新')
      setIsEditModalVisible(false)
    },
    onError: (err: any) => message.error(err.response?.data?.error || err.error || '更新失败'),
  })

  const resetPwMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      usersApi.resetPassword(id, password),
    onSuccess: () => {
      message.success('密码已重置')
      setIsResetPwModalVisible(false)
      resetPwForm.resetFields()
    },
    onError: (err: any) => message.error(err.response?.data?.error || err.error || '重置失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      message.success('用户已删除')
    },
    onError: (err: any) => message.error(err.response?.data?.error || err.error || '删除失败'),
  })

  const columns = [
    {
      title: '用户',
      key: 'user',
      render: (_: any, record: UserListItem) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.displayName}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>@{record.username}</div>
        </div>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string) => {
        const config = ROLE_MAP[role] || { color: 'default', text: role }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: (_: any, record: UserListItem) => (
        <Badge status={record.isActive ? 'success' : 'default'} text={record.isActive ? '活跃' : '禁用'} />
      ),
    },
    {
      title: 'Meta 状态',
      key: 'meta',
      width: 100,
      render: (_: any, record: UserListItem) => {
        if (record.role === 'designer') return <Tag>无需配置</Tag>
        if (!record.metaCredential) return <Tag color="warning">未配置</Tag>
        const status = record.metaCredential.tokenStatus
        if (status === 'valid') return <Tag color="success">已连接</Tag>
        if (status === 'expired') return <Tag color="error">已过期</Tag>
        return <Tag color="warning">待验证</Tag>
      },
    },
    {
      title: '资源',
      key: 'resources',
      width: 200,
      render: (_: any, record: UserListItem) => (
        <Space size={4}>
          <Tooltip title="素材数"><Tag>{record._count.creatives} 素材</Tag></Tooltip>
          <Tooltip title="广告系列数"><Tag>{record._count.campaigns} 系列</Tag></Tooltip>
          <Tooltip title="规则数"><Tag>{record._count.automationRules} 规则</Tag></Tooltip>
        </Space>
      ),
    },
    {
      title: '最后登录',
      key: 'lastLogin',
      width: 150,
      render: (_: any, record: UserListItem) => (
        <span style={{ fontSize: 12 }}>
          {record.lastLoginAt ? dayjs(record.lastLoginAt).format('MM-DD HH:mm') : '从未登录'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: any, record: UserListItem) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="link" icon={<EditOutlined />} size="small" onClick={() => {
              setEditingUser(record)
              editForm.setFieldsValue({
                displayName: record.displayName,
                email: record.email,
                role: record.role,
                isActive: record.isActive,
              })
              setIsEditModalVisible(true)
            }} />
          </Tooltip>
          <Tooltip title="重置密码">
            <Button type="link" icon={<KeyOutlined />} size="small" onClick={() => {
              setEditingUser(record)
              setIsResetPwModalVisible(true)
            }} />
          </Tooltip>
          <Popconfirm title={`确认删除用户 "${record.displayName}"？`} onConfirm={() => deleteMutation.mutate(record.id)}>
            <Tooltip title="删除">
              <Button type="link" icon={<DeleteOutlined />} danger size="small" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}><SafetyOutlined style={{ marginRight: 8 }} />用户管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)}>
          创建用户
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        size="middle"
      />

      {/* 创建用户 Modal */}
      <Modal
        title="创建用户"
        open={isCreateModalVisible}
        onOk={() => createForm.validateFields().then(values => createMutation.mutate(values))}
        onCancel={() => { setIsCreateModalVisible(false); createForm.resetFields() }}
        confirmLoading={createMutation.isPending}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="displayName" label="显示名称" rules={[{ required: true }]}>
            <Input placeholder="如：张三" />
          </Form.Item>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input placeholder="用于登录" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="邮箱地址" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]} initialValue="optimizer">
            <Select>
              <Option value="admin">管理员 — 全局管理权限</Option>
              <Option value="optimizer">优化师 — 投放操作全权限</Option>
              <Option value="designer">设计师 — 素材管理+数据查阅</Option>
            </Select>
          </Form.Item>
          <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder="至少 6 位" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑用户 Modal */}
      <Modal
        title={`编辑用户 — ${editingUser?.displayName}`}
        open={isEditModalVisible}
        onOk={() => editForm.validateFields().then(values =>
          updateMutation.mutate({ id: editingUser!.id, data: values })
        )}
        onCancel={() => setIsEditModalVisible(false)}
        confirmLoading={updateMutation.isPending}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="displayName" label="显示名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select>
              <Option value="admin">管理员</Option>
              <Option value="optimizer">优化师</Option>
              <Option value="designer">设计师</Option>
            </Select>
          </Form.Item>
          <Form.Item name="isActive" label="账户状态" valuePropName="checked">
            <Switch checkedChildren="活跃" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置密码 Modal */}
      <Modal
        title={`重置密码 — ${editingUser?.displayName}`}
        open={isResetPwModalVisible}
        onOk={() => resetPwForm.validateFields().then(values =>
          resetPwMutation.mutate({ id: editingUser!.id, password: values.newPassword })
        )}
        onCancel={() => { setIsResetPwModalVisible(false); resetPwForm.resetFields() }}
        confirmLoading={resetPwMutation.isPending}
      >
        <Form form={resetPwForm} layout="vertical">
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 6, message: '至少 6 位' }]}>
            <Input.Password placeholder="输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default UserManagement
