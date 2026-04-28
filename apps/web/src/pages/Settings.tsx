import React, { useState, useEffect } from 'react'
import {
  Card, Form, Input, Button, Space, Divider, Select, Switch, Tabs, message,
  Alert, Tag, Spin, Row, Col, Table, InputNumber, Popconfirm, Modal, Badge,
} from 'antd'
import {
  SaveOutlined, ApiOutlined, CheckCircleOutlined, CloseCircleOutlined,
  GlobalOutlined, ReloadOutlined, FlagOutlined, DatabaseOutlined,
  DeleteOutlined, LockOutlined, KeyOutlined, EyeOutlined, PlusOutlined,
  EditOutlined, StarOutlined, StarFilled, SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'
import { countryBenchmarksApi, CountryBenchmark } from '../utils/api/countryBenchmarks'
import {
  metaCredentialsApi, adminApi,
  CredentialOverviewItem, MetaCredentialItem,
} from '../utils/api/auth'

const { Option } = Select

/**
 * Token 过期倒计时组件
 */
interface TokenExpiryCountdownProps {
  expiresAt: string | Date | null | undefined
}

const TokenExpiryCountdown: React.FC<TokenExpiryCountdownProps> = ({ expiresAt }) => {
  if (!expiresAt) return null

  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  const now = new Date()
  const diffMs = expiry.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return (
      <span style={{ color: '#ff4d4f', fontWeight: 500 }}>
        Token 已过期 {Math.abs(diffDays)} 天，请立即重新授权
      </span>
    )
  }

  if (diffDays <= 7) {
    return (
      <span style={{ color: '#faad14', fontWeight: 500 }}>
        即将过期：剩余 {diffDays} 天（建议尽快刷新 Token）
      </span>
    )
  }

  return (
    <span style={{ color: '#52c41a' }}>
      有效期剩余 {diffDays} 天
    </span>
  )
}

/**
 * 账户总览表格组件
 */
interface CredentialsOverviewTableProps {
  data: CredentialOverviewItem[]
  loading: boolean
}

const CredentialsOverviewTable: React.FC<CredentialsOverviewTableProps> = ({ data, loading }) => {
  const tokenStatusRender = (status: string) => {
    if (status === 'valid') return <Tag color="success" icon={<CheckCircleOutlined />}>有效</Tag>
    if (status === 'expired') return <Tag color="error" icon={<CloseCircleOutlined />}>过期</Tag>
    return <Tag color="default">未配置</Tag>
  }

  const tokenTypeRender = (type: string) => {
    if (type === 'system_user') return <Tag color="blue">System User</Tag>
    if (type === 'user_token') return <Tag color="purple">User Token</Tag>
    return <Tag>—</Tag>
  }

  return (
    <Table
      dataSource={data}
      rowKey={(record) => record.credentialId}
      loading={loading}
      pagination={false}
      size="small"
      columns={[
        { title: '用户', dataIndex: 'userName', width: 120 },
        {
          title: '角色',
          dataIndex: 'role',
          width: 90,
          render: (role: string) => {
            const color = role === 'admin' ? 'red' : role === 'optimizer' ? 'orange' : 'default'
            return <Tag color={color}>{role}</Tag>
          },
        },
        {
          title: '凭据别名',
          dataIndex: 'alias',
          width: 140,
          render: (alias: string, record: CredentialOverviewItem) => (
            <Space>
              <span>{alias}</span>
              {record.isDefault && <Tag color="gold" style={{ marginLeft: 4 }}>默认</Tag>}
            </Space>
          ),
        },
        { title: 'App ID', dataIndex: 'appId', ellipsis: true },
        { title: '广告账户', dataIndex: 'adAccountId', ellipsis: true },
        { title: '粉丝页', dataIndex: 'pageId', ellipsis: true },
        { title: 'Token 类型', dataIndex: 'tokenType', width: 120, render: tokenTypeRender },
        { title: 'Token 状态', dataIndex: 'tokenStatus', width: 100, render: tokenStatusRender },
        {
          title: '上次验证',
          dataIndex: 'lastVerifiedAt',
          width: 160,
          render: (val: string | null) => val ? new Date(val).toLocaleString('zh-CN') : '—',
        },
      ]}
    />
  )
}

interface MetaHealthStatus {
  status: string
  connected: boolean
  user?: { id: string; name: string }
  pages?: { id: string; name: string }[]
  config?: { apiVersion: string }
  message?: string
}

const Settings: React.FC = () => {
  const { user, hasRole } = useAuth()
  const role = user?.role || 'designer'
  const isAdmin = role === 'admin'
  const isOperator = role === 'optimizer'
  const isDesigner = role === 'designer'

  const [editForm] = Form.useForm()
  const [activeTab, setActiveTab] = useState(isDesigner ? 'benchmarks' : 'api')
  const [healthStatus, setHealthStatus] = useState<MetaHealthStatus | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)

  // Meta credentials state (1:N)
  const [credentials, setCredentials] = useState<MetaCredentialItem[]>([])
  const [credentialsLoading, setCredentialsLoading] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingCredential, setEditingCredential] = useState<MetaCredentialItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)

  // Country benchmarks state
  const [benchmarks, setBenchmarks] = useState<CountryBenchmark[]>([])
  const [benchmarksLoading, setBenchmarksLoading] = useState(false)
  const [benchmarksEditing, setBenchmarksEditing] = useState<Record<string, Partial<CountryBenchmark>>>({})
  const [benchmarksSeedLoading, setBenchmarksSeedLoading] = useState(false)

  // Credentials overview state
  const [overviewData, setOverviewData] = useState<CredentialOverviewItem[]>([])
  const [overviewLoading, setOverviewLoading] = useState(false)

  // ===================== API 调用 =====================

  const fetchCredentials = async () => {
    if (isDesigner) return
    setCredentialsLoading(true)
    try {
      const res: any = await metaCredentialsApi.list()
      const payload = res?.data || res
      setCredentials(Array.isArray(payload) ? payload : [])
    } catch (err: any) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        message.error('加载 Meta 凭据失败: ' + err.message)
      }
    } finally {
      setCredentialsLoading(false)
    }
  }

  const handleCreateCredential = () => {
    setEditingCredential(null)
    editForm.resetFields()
    editForm.setFieldsValue({ alias: '' })
    setEditModalVisible(true)
  }

  const handleEditCredential = (cred: MetaCredentialItem) => {
    setEditingCredential(cred)
    editForm.resetFields()
    editForm.setFieldsValue({ alias: cred.alias })
    setEditModalVisible(true)
  }

  const handleSaveCredential = async () => {
    const values = editForm.getFieldsValue()
    const payload: Record<string, string> = {}

    if (values.alias) payload.alias = values.alias
    if (values.metaAppId) payload.metaAppId = values.metaAppId
    if (values.metaAppSecret) payload.metaAppSecret = values.metaAppSecret
    if (values.metaAccessToken) payload.metaAccessToken = values.metaAccessToken
    if (values.metaAdAccountId) payload.metaAdAccountId = values.metaAdAccountId
    if (values.metaPageId) payload.metaPageId = values.metaPageId

    if (!editingCredential && !payload.alias) {
      payload.alias = '默认账户'
    }

    setSaving(true)
    try {
      if (editingCredential) {
        // 更新已有凭据
        await metaCredentialsApi.update(editingCredential.id, payload)
        message.success('凭据已更新')
      } else {
        // 创建新凭据
        if (Object.keys(payload).length <= 1 && payload.alias) {
          message.warning('请至少填写一项凭据配置')
          setSaving(false)
          return
        }
        await metaCredentialsApi.create(payload)
        message.success('凭据已创建')
      }
      setEditModalVisible(false)
      fetchCredentials()
    } catch (err: any) {
      message.error('保存失败: ' + (err.response?.data?.error || err.error || err.message))
    } finally {
      setSaving(false)
    }
  }

  const handleVerify = async (credId: string) => {
    setVerifyingId(credId)
    try {
      const res: any = await metaCredentialsApi.verify(credId)
      const data = res?.data || res
      if (data.valid) {
        message.success(`Token 验证成功！Meta 用户: ${data.metaUser?.name} (${data.metaUser?.id})`)
      } else {
        message.error(`Token 无效: ${data.error}`)
      }
      fetchCredentials()
    } catch (err: any) {
      message.error('验证失败: ' + (err.response?.data?.error || err.error || err.message))
    } finally {
      setVerifyingId(null)
    }
  }

  const handleSetDefault = async (credId: string) => {
    try {
      await metaCredentialsApi.setDefault(credId)
      message.success('已设为默认凭据')
      fetchCredentials()
    } catch (err: any) {
      message.error('设置失败: ' + (err.response?.data?.error || err.error || err.message))
    }
  }

  const handleDeleteCredential = async (credId: string) => {
    try {
      await metaCredentialsApi.delete(credId)
      message.success('凭据已删除')
      fetchCredentials()
    } catch (err: any) {
      message.error('删除失败: ' + (err.response?.data?.error || err.error || err.message))
    }
  }

  const checkHealth = async () => {
    if (isDesigner || (!isAdmin && !isOperator)) return
    setHealthLoading(true)
    try {
      const token = localStorage.getItem('autoads_access_token')
      const response = await fetch('/api/meta/health', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      const data = await response.json()
      setHealthStatus(data)
    } catch (error: any) {
      setHealthStatus({ status: 'error', connected: false, message: error.message })
    } finally {
      setHealthLoading(false)
    }
  }

  const fetchBenchmarks = async () => {
    setBenchmarksLoading(true)
    try {
      const res: any = await countryBenchmarksApi.list()
      const payload = res?.data || res
      setBenchmarks(Array.isArray(payload) ? payload : payload?.data || [])
    } catch (err: any) {
      message.error('加载国家基准数据失败: ' + err.message)
    } finally {
      setBenchmarksLoading(false)
    }
  }

  const seedBenchmarks = async () => {
    if (isDesigner) return
    setBenchmarksSeedLoading(true)
    try {
      const res: any = await countryBenchmarksApi.seed()
      const payload = res?.data || res
      const items = Array.isArray(payload) ? payload : payload?.data || []
      setBenchmarks(items)
      message.success(`已初始化 ${items.length} 个国家基准数据`)
    } catch (err: any) {
      message.error('初始化基准数据失败: ' + err.message)
    } finally {
      setBenchmarksSeedLoading(false)
    }
  }

  const saveBenchmark = async (countryCode: string) => {
    if (isDesigner) return
    const changes = benchmarksEditing[countryCode]
    if (!changes || Object.keys(changes).length === 0) {
      message.info('没有修改')
      return
    }
    try {
      await countryBenchmarksApi.update(countryCode, changes)
      message.success(`${countryCode} 基准数据已更新`)
      setBenchmarksEditing(prev => {
        const next = { ...prev }
        delete next[countryCode]
        return next
      })
      fetchBenchmarks()
    } catch (err: any) {
      message.error('更新失败: ' + err.message)
    }
  }

  const handleBenchmarkChange = (countryCode: string, field: string, value: any) => {
    if (isDesigner) return
    setBenchmarksEditing(prev => ({
      ...prev,
      [countryCode]: {
        ...prev[countryCode],
        [field]: value,
      },
    }))
  }

  const fetchCredentialsOverview = async () => {
    if (isDesigner) return
    setOverviewLoading(true)
    try {
      const res: any = await adminApi.credentialsOverview()
      const payload = res?.data || res
      setOverviewData(Array.isArray(payload) ? payload : payload?.data || [])
    } catch (err: any) {
      message.error('加载凭据总览失败: ' + (err.response?.data?.error || err.message))
    } finally {
      setOverviewLoading(false)
    }
  }

  useEffect(() => {
    if (!isDesigner) {
      checkHealth()
      fetchCredentials()
      fetchCredentialsOverview()
    }
    fetchBenchmarks()
  }, [])

  // ===================== 凭据列表 Token 状态渲染 =====================

  const renderTokenStatus = (cred: MetaCredentialItem) => {
    if (!cred.configured) return <Tag color="default">未配置</Tag>
    if (cred.tokenStatus === 'valid') return <Tag color="success" icon={<CheckCircleOutlined />}>有效</Tag>
    if (cred.tokenStatus === 'expired') return <Tag color="error" icon={<CloseCircleOutlined />}>过期</Tag>
    if (cred.tokenStatus === 'invalid') return <Tag color="error" icon={<CloseCircleOutlined />}>无效</Tag>
    return <Tag color="warning">未验证</Tag>
  }

  const renderTokenSource = (cred: MetaCredentialItem) => {
    if (cred.tokenSource === 'system_user_token') return <Tag color="blue">System User</Tag>
    if (cred.tokenSource === 'user_token') return <Tag color="purple">User Token</Tag>
    return null
  }

  // ===================== 按角色构建 Tab =====================

  // --- API 配置 Tab 内容 ---
  const apiTabContent = (
    <div>
      {/* 全局连接状态卡片 — admin 可见 */}
      {isAdmin && (
        <Card
          title={
            <Space>
              <GlobalOutlined />
              Meta API 全局连接状态
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={checkHealth}
                loading={healthLoading}
              >
                刷新
              </Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          {healthLoading ? (
            <Spin tip="检测连接中..." />
          ) : healthStatus ? (
            <div>
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ marginBottom: 12 }}>
                    <strong>连接状态：</strong>
                    {healthStatus.connected ? (
                      <Tag color="success" icon={<CheckCircleOutlined />}>已连接</Tag>
                    ) : (
                      <Tag color="error" icon={<CloseCircleOutlined />}>未连接</Tag>
                    )}
                  </div>
                </Col>
                {healthStatus.user && (
                  <Col span={8}>
                    <div style={{ marginBottom: 12 }}>
                      <strong>Facebook 用户：</strong>
                      <span>{healthStatus.user.name} ({healthStatus.user.id})</span>
                    </div>
                  </Col>
                )}
                {healthStatus.config && (
                  <Col span={8}>
                    <div style={{ marginBottom: 12 }}>
                      <strong>API 版本：</strong>
                      <Tag>{healthStatus.config.apiVersion}</Tag>
                    </div>
                  </Col>
                )}
              </Row>

              {healthStatus.pages && healthStatus.pages.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong>可用粉丝页（{healthStatus.pages.length} 个）：</strong>
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {healthStatus.pages.map(p => (
                      <Tag key={p.id} style={{ cursor: 'default' }}>
                        {p.name} ({p.id})
                      </Tag>
                    ))}
                  </div>
                </div>
              )}

              {!healthStatus.connected && healthStatus.message && (
                <Alert
                  message="连接失败"
                  description={healthStatus.message}
                  type="error"
                  showIcon
                  style={{ marginTop: 12 }}
                />
              )}
            </div>
          ) : (
            <Alert message="尚未检测连接状态" type="info" showIcon />
          )}
        </Card>
      )}

      {/* 个人 Meta 凭据列表 — admin / operator 可见 */}
      {(isAdmin || isOperator) && (
        <Card
          title={
            <Space>
              <KeyOutlined />
              个人 Meta API 凭据
              <Spin spinning={credentialsLoading} size="small" />
            </Space>
          }
          extra={
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleCreateCredential}
            >
              新增凭据
            </Button>
          }
        >
          {credentials.length === 0 && !credentialsLoading ? (
            <Alert
              message="尚未配置个人 Meta 凭据"
              description="点击「新增凭据」配置您的 Meta API 密钥，用于广告投放操作。每个凭据包含独立的 App ID、Access Token 和广告账户信息。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          ) : null}

          <Table
            dataSource={credentials}
            rowKey="id"
            loading={credentialsLoading}
            pagination={false}
            size="small"
            locale={{ emptyText: '暂无凭据，请点击「新增凭据」开始配置' }}
            columns={[
              {
                title: '凭据别名',
                dataIndex: 'alias',
                width: 160,
                render: (alias: string, record: MetaCredentialItem) => (
                  <Space>
                    {record.isDefault ? (
                      <StarFilled style={{ color: '#faad14' }} />
                    ) : (
                      <StarOutlined style={{ color: '#d9d9d9' }} />
                    )}
                    <span style={{ fontWeight: record.isDefault ? 600 : 400 }}>{alias}</span>
                    {record.isDefault && <Tag color="gold" style={{ fontSize: 11 }}>默认</Tag>}
                  </Space>
                ),
              },
              {
                title: 'Token 状态',
                width: 200,
                render: (_: any, record: MetaCredentialItem) => (
                  <Space direction="vertical" size={0}>
                    <Space>
                      {renderTokenStatus(record)}
                      {renderTokenSource(record)}
                    </Space>
                    {record.tokenSource === 'user_token' && record.tokenExpiresAt && (
                      <TokenExpiryCountdown expiresAt={record.tokenExpiresAt} />
                    )}
                  </Space>
                ),
              },
              {
                title: 'App ID',
                dataIndex: 'metaAppId',
                ellipsis: true,
                width: 140,
                render: (val: string | null) => val || <span style={{ color: '#ccc' }}>未配置</span>,
              },
              {
                title: '广告账户',
                dataIndex: 'metaAdAccountId',
                ellipsis: true,
                width: 150,
                render: (val: string | null) => val || <span style={{ color: '#ccc' }}>未配置</span>,
              },
              {
                title: '粉丝页',
                dataIndex: 'metaPageId',
                ellipsis: true,
                width: 140,
                render: (val: string | null) => val || <span style={{ color: '#ccc' }}>未配置</span>,
              },
              {
                title: '上次验证',
                dataIndex: 'lastVerifiedAt',
                width: 150,
                render: (val: string | null) => val ? new Date(val).toLocaleString('zh-CN') : '—',
              },
              {
                title: '操作',
                width: 260,
                render: (_: any, record: MetaCredentialItem) => (
                  <Space size="small">
                    <Button
                      size="small"
                      icon={<SafetyCertificateOutlined />}
                      onClick={() => handleVerify(record.id)}
                      loading={verifyingId === record.id}
                      disabled={!record.configured}
                    >
                      验证
                    </Button>
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEditCredential(record)}
                    >
                      编辑
                    </Button>
                    {!record.isDefault && (
                      <Button
                        size="small"
                        icon={<StarOutlined />}
                        onClick={() => handleSetDefault(record.id)}
                      >
                        设为默认
                      </Button>
                    )}
                    <Popconfirm
                      title="确认删除此凭据？"
                      description="删除后不可恢复，已关联此凭据的投放任务将无法推送。"
                      onConfirm={() => handleDeleteCredential(record.id)}
                      okText="确认删除"
                      cancelText="取消"
                    >
                      <Button size="small" danger icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* 凭据编辑 Modal */}
      <Modal
        title={editingCredential ? `编辑凭据: ${editingCredential.alias}` : '新增 Meta 凭据'}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleSaveCredential}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" preserve={false}>
          <Form.Item
            name="alias"
            label="凭据别名"
            extra="用于区分多个 Meta 账户，例如「TX Autoads」「AutoAds-02」"
          >
            <Input placeholder="输入凭据别名（默认: 默认账户）" />
          </Form.Item>

          <Divider style={{ margin: '12px 0' }} />

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="metaAppId"
                label="App ID"
                extra={editingCredential?.metaAppId ? `当前: ${editingCredential.metaAppId}` : undefined}
              >
                <Input placeholder="输入 Meta App ID" prefix={<ApiOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="metaAppSecret"
                label="App Secret"
                extra={editingCredential?.hasAppSecret ? '已配置（输入新值将覆盖）' : undefined}
              >
                <Input.Password
                  placeholder="输入 Meta App Secret"
                  prefix={<LockOutlined />}
                  autoComplete="new-password"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="metaAccessToken"
            label="Access Token"
            extra={
              editingCredential?.hasAccessToken
                ? '已配置（输入新值将覆盖）。建议使用 System User Token（永不过期）'
                : '建议使用 Business Manager 的 System User Token（永不过期）。个人 User Token 最多 60 天有效'
            }
          >
            <Input.TextArea rows={3} placeholder="输入 Meta Access Token" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="metaAdAccountId"
                label="广告账户 ID"
                extra={editingCredential?.metaAdAccountId ? `当前: ${editingCredential.metaAdAccountId}` : '格式如 act_123456789'}
              >
                <Input placeholder="输入广告账户 ID" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="metaPageId"
                label="默认粉丝页 ID (Page ID)"
                extra={editingCredential?.metaPageId ? `当前: ${editingCredential.metaPageId}` : 'Facebook 广告必须关联粉丝页'}
              >
                <Input placeholder="输入 Facebook Page ID" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )

  // --- 国家基准 Tab 内容 ---
  const benchmarksTabContent = (
    <div>
      <Card
        title={
          <Space>
            <DatabaseOutlined />
            国家基准配置
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={fetchBenchmarks}
              loading={benchmarksLoading}
            >
              刷新
            </Button>
          </Space>
        }
        extra={
          !isDesigner && (
            <Button
              type="primary"
              size="small"
              icon={<DatabaseOutlined />}
              onClick={seedBenchmarks}
              loading={benchmarksSeedLoading}
            >
              重置为默认值
            </Button>
          )
        }
      >
        <Alert
          message="国家基准数据说明"
          description="以下数据用于自动化规则的阈值判断。各国家的单价（Payout）和盈亏线 CVR 不同，PK 由于单价极低（$0.08），对 CPC 和 CVR 的敏感度远高于其他国家。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          dataSource={benchmarks}
          rowKey="countryCode"
          loading={benchmarksLoading}
          pagination={false}
          size="small"
          columns={[
            {
              title: '国家',
              dataIndex: 'countryCode',
              width: 100,
              render: (code: string, record: CountryBenchmark) => (
                <Space>
                  <Tag color="blue">{code}</Tag>
                  <span>{record.countryName}</span>
                </Space>
              ),
            },
            {
              title: '单价 (USD)',
              dataIndex: 'payout',
              width: 120,
              render: (val: number, record: CountryBenchmark) => (
                <InputNumber
                  size="small"
                  min={0}
                  step={0.01}
                  precision={2}
                  defaultValue={val}
                  style={{ width: 90 }}
                  onChange={(v) => handleBenchmarkChange(record.countryCode, 'payout', v)}
                  disabled={isDesigner}
                />
              ),
            },
            {
              title: '盈亏线 CVR (%)',
              dataIndex: 'breakEvenCvr',
              width: 130,
              render: (val: number, record: CountryBenchmark) => (
                <InputNumber
                  size="small"
                  min={0}
                  step={0.1}
                  precision={1}
                  defaultValue={val}
                  style={{ width: 90 }}
                  onChange={(v) => handleBenchmarkChange(record.countryCode, 'breakEvenCvr', v)}
                  disabled={isDesigner}
                />
              ),
            },
            {
              title: '目标 CVR (%)',
              dataIndex: 'targetCvr',
              width: 120,
              render: (val: number, record: CountryBenchmark) => (
                <InputNumber
                  size="small"
                  min={0}
                  step={0.1}
                  precision={1}
                  defaultValue={val}
                  style={{ width: 90 }}
                  onChange={(v) => handleBenchmarkChange(record.countryCode, 'targetCvr', v)}
                  disabled={isDesigner}
                />
              ),
            },
            {
              title: 'CTR 警戒线 (%)',
              dataIndex: 'ctrThreshold',
              width: 130,
              render: (val: number, record: CountryBenchmark) => (
                <InputNumber
                  size="small"
                  min={0}
                  step={0.1}
                  precision={1}
                  defaultValue={val}
                  style={{ width: 90 }}
                  onChange={(v) => handleBenchmarkChange(record.countryCode, 'ctrThreshold', v)}
                  disabled={isDesigner}
                />
              ),
            },
            {
              title: 'CPC 上限 (USD)',
              dataIndex: 'cpcCeiling',
              width: 130,
              render: (val: number, record: CountryBenchmark) => (
                <InputNumber
                  size="small"
                  min={0}
                  step={0.001}
                  precision={3}
                  defaultValue={val}
                  style={{ width: 90 }}
                  onChange={(v) => handleBenchmarkChange(record.countryCode, 'cpcCeiling', v)}
                  disabled={isDesigner}
                />
              ),
            },
            {
              title: 'ROAS 缓冲系数',
              dataIndex: 'roasBuffer',
              width: 130,
              render: (val: number, record: CountryBenchmark) => (
                <InputNumber
                  size="small"
                  min={0}
                  max={2}
                  step={0.05}
                  precision={2}
                  defaultValue={val}
                  style={{ width: 90 }}
                  onChange={(v) => handleBenchmarkChange(record.countryCode, 'roasBuffer', v)}
                  disabled={isDesigner}
                />
              ),
            },
            {
              title: '状态',
              dataIndex: 'isActive',
              width: 80,
              render: (val: boolean, record: CountryBenchmark) => (
                <Switch
                  size="small"
                  defaultChecked={val}
                  onChange={(v) => handleBenchmarkChange(record.countryCode, 'isActive', v)}
                  disabled={isDesigner}
                />
              ),
            },
            {
              title: '操作',
              width: 100,
              render: (_: any, record: CountryBenchmark) => (
                <Button
                  type="primary"
                  size="small"
                  icon={<SaveOutlined />}
                  onClick={() => saveBenchmark(record.countryCode)}
                  disabled={isDesigner}
                >
                  保存
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )

  // --- 账户总览 Tab 内容 — admin/optimizer 可见 ---
  const overviewTabContent = (isAdmin || isOperator) ? (
    <div>
      <Card
        title={
          <Space>
            <EyeOutlined />
            凭据账户总览
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={fetchCredentialsOverview}
              loading={overviewLoading}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Alert
          message="凭据总览说明"
          description={
            isAdmin
              ? '以下表格展示系统中所有用户配置的 Meta 凭据状态。每位用户可拥有多条凭据，标记为「默认」的凭据将用于广告投放。'
              : '以下表格展示您个人配置的 Meta 凭据状态。标记为「默认」的凭据将用于广告投放。'
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <CredentialsOverviewTable data={overviewData} loading={overviewLoading} />
      </Card>
    </div>
  ) : null

  // 构建 Tabs 数组
  const tabItems = []

  if (!isDesigner) {
    tabItems.push({
      key: 'api',
      label: (
        <span>
          <ApiOutlined /> API 配置
        </span>
      ),
      children: apiTabContent,
    })
  }

  tabItems.push({
    key: 'benchmarks',
    label: (
      <span>
        <FlagOutlined /> 国家基准
      </span>
    ),
    children: benchmarksTabContent,
  })

  if (isAdmin || isOperator) {
    tabItems.push({
      key: 'overview',
      label: (
        <span>
          <EyeOutlined /> 账户总览
        </span>
      ),
      children: overviewTabContent,
    })
  }

  return (
    <div className="page-container">
      <h2 style={{ marginBottom: 24 }}>设置</h2>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </div>
  )
}

export default Settings
