import React, { useState, useEffect } from 'react'
import {
  Table, Button, Space, Tag, Switch, Tooltip, Modal, Form, Input, Select,
  InputNumber, notification, Card, Drawer, Radio, Divider, Badge, Timeline,
  Empty, Popconfirm, message, Row, Col, Dropdown
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined,
  PlayCircleOutlined, PauseCircleOutlined, FileTextOutlined,
  EyeOutlined, BugOutlined, HistoryOutlined, CheckCircleOutlined,
  CloseCircleOutlined, WarningOutlined, DownOutlined, RobotOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rulesApi, Rule, Condition, Action, ExecutionLog } from '../utils/api/rules'
import { campaignsApi } from '../utils/api/campaigns'
import { performanceApi } from '../utils/api/performance'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input

const RULE_TYPE_MAP: Record<string, { color: string; text: string }> = {
  budget: { color: 'orange', text: '预算规则' },
  bid: { color: 'purple', text: '出价规则' },
  status: { color: 'red', text: '状态规则' },
  notification: { color: 'blue', text: '通知规则' },
}

const APPLY_TO_MAP: Record<string, string> = {
  campaign: '广告系列',
  adset: '广告组',
  ad: '广告',
}

const METRIC_MAP: Record<string, string> = {
  spend: '花费',
  cpa: 'CPA',
  ctr: '点击率',
  roas: 'ROAS',
  conversions: '转化数',
  impressions: '展示数',
  clicks: '点击数',
  cpc: 'CPC',
  cpm: 'CPM',
  frequency: '频次',
  epc: 'EPC (每点击收益)',
  payout: '国家单价',
  profitability: '盈利系数 (EPC/CPC)',
}

const ACTION_MAP: Record<string, string> = {
  pause: '暂停对象',
  unpause: '启用对象',
  adjust_budget: '调整预算',
  adjust_bid: '调整出价',
  notify: '发送通知',
}

const TIME_WINDOW_OPTIONS = [
  { value: '1h', label: '最近 1 小时' },
  { value: '24h', label: '最近 24 小时' },
  { value: '7d', label: '最近 7 天' },
  { value: '30d', label: '最近 30 天' },
]

const Rules: React.FC = () => {
  const queryClient = useQueryClient()
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isLogsDrawerVisible, setIsLogsDrawerVisible] = useState(false)
  const [isTestModalVisible, setIsTestModalVisible] = useState(false)
  const [isDetailDrawerVisible, setIsDetailDrawerVisible] = useState(false)
  const [form] = Form.useForm()
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null)
  const [testResult, setTestResult] = useState<any>(null)

  // Fetch rules
  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ['rules'],
    queryFn: async () => {
      const res = await rulesApi.list()
      return res.data.data as Rule[]
    }
  })

  // Fetch campaigns for target selector
  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns', 'list'],
    queryFn: async () => {
      const res = await campaignsApi.list()
      return res.data.data || []
    },
    enabled: isModalVisible,
  })

  // Fetch execution logs
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['rule-logs', selectedRule?.id],
    queryFn: async () => {
      if (!selectedRule) return { data: [], pagination: { total: 0 } }
      const res = await rulesApi.getLogs(selectedRule.id, { limit: 50 })
      return res.data
    },
    enabled: !!selectedRule && isLogsDrawerVisible,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (values: any) => rulesApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      message.success('规则创建成功')
      setIsModalVisible(false)
      form.resetFields()
    },
    onError: (err: any) => message.error(err.response?.data?.error || '创建失败')
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => rulesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      message.success('规则更新成功')
      setIsModalVisible(false)
      setEditingRule(null)
      form.resetFields()
    },
    onError: (err: any) => message.error(err.response?.data?.error || '更新失败')
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rulesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      message.success('规则已删除')
    }
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? rulesApi.activate(id) : rulesApi.deactivate(id),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      message.success(vars.active ? '规则已激活' : '规则已暂停')
    }
  })

  const testMutation = useMutation({
    mutationFn: (id: string) => rulesApi.test(id),
    onSuccess: (res) => {
      setTestResult(res.data.data)
      setIsTestModalVisible(true)
      message.success('规则测试完成')
    },
    onError: (err: any) => message.error(err.response?.data?.error || '测试失败')
  })

  const executeMutation = useMutation({
    mutationFn: (id: string) => rulesApi.execute(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      queryClient.invalidateQueries({ queryKey: ['rule-logs'] })
      Modal.success({
        title: '规则执行完成',
        content: (
          <div>
            <p>{res.data.data.message}</p>
            <p>检查目标数: {res.data.data.targetsChecked}</p>
            <p>触发目标数: {res.data.data.targetsTriggered}</p>
            <p>执行动作数: {res.data.data.actionsExecuted}</p>
          </div>
        )
      })
    },
    onError: (err: any) => message.error(err.response?.data?.error || '执行失败')
  })

  const handleAdd = () => {
    setEditingRule(null)
    form.resetFields()
    form.setFieldsValue({
      ruleType: 'status',
      applyTo: 'campaign',
      conditionLogic: 'AND',
      cooldownMinutes: 60,
      conditions: [{ metric: 'cpa', operator: '>', value: 0.25, timeWindow: '24h' }],
      actions: [{ type: 'pause', params: {} }],
      targetIds: [],
      notifyEmails: [],
    })
    setIsModalVisible(true)
  }

  const PRESETS: Record<string, any> = {
    r1: {
      name: 'R1-低ROI/零转化自动关停',
      description: '当广告24h花费超过3倍国家单价（$0.75）且0转化时自动暂停，防止无效烧钱。目标留空=应用到所有活跃广告。',
      ruleType: 'status',
      applyTo: 'ad',
      conditionLogic: 'AND',
      cooldownMinutes: 0,
      conditions: [
        { metric: 'spend', operator: '>=', value: 0.75, timeWindow: '24h' },
        { metric: 'conversions', operator: '==', value: 0, timeWindow: '24h' },
      ],
      actions: [{ type: 'pause', params: {} }],
      targetIds: [],
      notifyEmails: [],
    },
    r2: {
      name: 'R2-单日消耗超限自动关停',
      description: '当广告24h花费超过$3且CPA超过国家单价（$0.25）时自动暂停，止损不盈利广告。目标留空=应用到所有活跃广告。',
      ruleType: 'status',
      applyTo: 'ad',
      conditionLogic: 'AND',
      cooldownMinutes: 1440,
      conditions: [
        { metric: 'spend', operator: '>=', value: 3.0, timeWindow: '24h' },
        { metric: 'cpa', operator: '>', value: 0.25, timeWindow: '24h' },
      ],
      actions: [{ type: 'pause', params: {} }],
      targetIds: [],
      notifyEmails: [],
    },
  }

  // 记住待加载的预设 key，供 afterOpenChange 兜底使用
  const [pendingPresetKey, setPendingPresetKey] = useState<string | null>(null)

  const handleCreateFromPreset = (presetKey: string) => {
    setEditingRule(null)
    const preset = PRESETS[presetKey]
    if (preset) {
      // 与 handleAdd 保持一致：先设值，再开弹窗
      form.resetFields()
      form.setFieldsValue(preset)
      setPendingPresetKey(presetKey)
      setIsModalVisible(true)
      message.info(`已加载预设规则: ${preset.name}，请选择目标对象后保存`)
    }
  }

  // Modal 动画完成后兜底：如果表单值在动画过程中丢失，重新填充
  const handleModalAfterOpenChange = (open: boolean) => {
    if (open && pendingPresetKey) {
      const preset = PRESETS[pendingPresetKey]
      if (preset) {
        const currentName = form.getFieldValue('name')
        // 如果表单值为空（被动画/渲染冲掉了），重新设置
        if (!currentName) {
          form.setFieldsValue(preset)
        }
      }
      setPendingPresetKey(null)
    }
  }

  const handleEdit = (record: Rule) => {
    setEditingRule(record)
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      ruleType: record.ruleType,
      applyTo: record.applyTo,
      targetIds: record.targetIds || [],
      conditions: record.conditions || [{ metric: 'cpa', operator: '>', value: 0.25 }],
      actions: record.actions || [{ type: 'pause', params: {} }],
      conditionLogic: record.conditionLogic || 'AND',
      cooldownMinutes: record.cooldownMinutes || 60,
      maxExecutions: record.maxExecutions,
      notifyEmails: record.notifyEmails || [],
    })
    setIsModalVisible(true)
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id)
  }

  const handleModalOk = () => {
    form.validateFields().then(values => {
      const formattedData = {
        name: values.name,
        description: values.description,
        ruleType: values.ruleType,
        applyTo: values.applyTo,
        targetIds: values.targetIds || [],
        conditions: values.conditions || [],
        actions: values.actions || [],
        conditionLogic: values.conditionLogic || 'AND',
        cooldownMinutes: values.cooldownMinutes || 60,
        maxExecutions: values.maxExecutions,
        notifyEmails: values.notifyEmails || [],
      }

      if (editingRule) {
        updateMutation.mutate({ id: editingRule.id, data: formattedData })
      } else {
        createMutation.mutate(formattedData)
      }
    })
  }

  const showLogs = (rule: Rule) => {
    setSelectedRule(rule)
    setIsLogsDrawerVisible(true)
  }

  const showDetail = (rule: Rule) => {
    setSelectedRule(rule)
    setIsDetailDrawerVisible(true)
  }

  const showTest = (rule: Rule) => {
    setSelectedRule(rule)
    testMutation.mutate(rule.id)
  }

  const showExecute = (rule: Rule) => {
    Modal.confirm({
      title: '确认手动执行规则',
      content: `确定要立即执行规则 "${rule.name}" 吗？这将实际执行规则中配置的动作。`,
      okText: '执行',
      cancelText: '取消',
      onOk: () => executeMutation.mutate(rule.id)
    })
  }

  // Get target name by ID
  const getTargetName = (rule: Rule, targetId: string) => {
    if (rule.applyTo === 'campaign') {
      const campaign = campaignsData?.find((c: any) => c.id === targetId)
      return campaign?.name || targetId.slice(0, 8)
    }
    return targetId.slice(0, 8)
  }

  // Format condition summary
  const formatCondition = (cond: Condition) => {
    const metric = METRIC_MAP[cond.metric] || cond.metric
    const window = TIME_WINDOW_OPTIONS.find(t => t.value === cond.timeWindow)?.label || ''
    return `${metric} ${cond.operator} ${cond.value}${window ? ` (${window})` : ''}`
  }

  const columns: ColumnsType<Rule> = [
    {
      title: '规则',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
            {record.description || `${APPLY_TO_MAP[record.applyTo]} 层级 · ${record._count?.executionLogs || 0} 次执行`}
          </div>
        </div>
      )
    },
    {
      title: '类型',
      dataIndex: 'ruleType',
      key: 'ruleType',
      width: 110,
      render: (type: string) => {
        const config = RULE_TYPE_MAP[type] || { color: 'default', text: type }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: '条件',
      key: 'conditions',
      width: 240,
      render: (_, record) => (
        <div style={{ fontSize: 12 }}>
          {record.conditions?.map((cond, i) => (
            <div key={i} style={{ marginBottom: 2 }}>
              <Tag size="small" color="blue">{formatCondition(cond)}</Tag>
              {i < (record.conditions?.length || 0) - 1 && (
                <span style={{ color: '#1890ff', margin: '0 4px' }}>
                  {record.conditionLogic === 'OR' ? '或' : '且'}
                </span>
              )}
            </div>
          ))}
        </div>
      )
    },
    {
      title: '动作',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <div style={{ fontSize: 12 }}>
          {record.actions?.map((action, i) => (
            <Tag key={i} size="small" color="volcano">
              {ACTION_MAP[action.type] || action.type}
            </Tag>
          ))}
        </div>
      )
    },
    {
      title: '执行',
      key: 'execution',
      width: 120,
      render: (_, record) => (
        <div style={{ fontSize: 12 }}>
          <div>已执行: {record.executionCount} 次</div>
          {record.maxExecutions && (
            <div style={{ color: '#8c8c8c' }}>上限: {record.maxExecutions}</div>
          )}
        </div>
      )
    },
    {
      title: '状态',
      key: 'status',
      width: 90,
      render: (_, record) => (
        <Switch
          checked={record.isActive}
          loading={toggleMutation.isPending}
          onChange={(checked) => toggleMutation.mutate({ id: record.id, active: checked })}
          checkedChildren="开"
          unCheckedChildren="关"
        />
      ),
    },
    {
      title: '创建者',
      dataIndex: 'owner',
      key: 'owner',
      width: 100,
      render: (owner: any) => owner ? <Tag color="geekblue">{owner.displayName || owner.username}</Tag> : <span>-</span>
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="测试规则">
            <Button type="link" icon={<BugOutlined />} size="small" onClick={() => showTest(record)} loading={testMutation.isPending && selectedRule?.id === record.id} />
          </Tooltip>
          <Tooltip title="手动执行">
            <Button type="link" icon={<PlayCircleOutlined />} size="small" onClick={() => showExecute(record)} loading={executeMutation.isPending && selectedRule?.id === record.id} />
          </Tooltip>
          <Tooltip title="执行日志">
            <Button type="link" icon={<HistoryOutlined />} size="small" onClick={() => showLogs(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm title="确认删除这条规则？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" icon={<DeleteOutlined />} danger size="small" />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <div className="card-header" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}><ThunderboltOutlined style={{ marginRight: 8 }} />自动化规则</h2>
        <Space>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'r1', label: 'R1 - 低ROI/零转化自动关停', icon: <RobotOutlined /> },
                { key: 'r2', label: 'R2 - 单日消耗超限自动关停', icon: <RobotOutlined /> },
              ],
              onClick: (e) => handleCreateFromPreset(e.key),
            }}
          >
            <Button icon={<DownOutlined />}>
              从预设创建
            </Button>
          </Dropdown>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            创建规则
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={rulesData}
        rowKey="id"
        loading={rulesLoading}
        pagination={{ pageSize: 10 }}
        size="middle"
        locale={{ emptyText: '暂无规则，点击右上角创建' }}
      />

      {/* Create/Edit Modal */}
      <Modal
        title={editingRule ? '编辑自动化规则' : '创建自动化规则'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => { setIsModalVisible(false); setEditingRule(null); setPendingPresetKey(null); form.resetFields() }}
        width={720}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={editingRule ? '保存' : '创建'}
        forceRender
        afterOpenChange={handleModalAfterOpenChange}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="例如：高 CPA 自动暂停" />
          </Form.Item>

          <Form.Item name="description" label="规则描述">
            <TextArea rows={2} placeholder="描述这条规则的作用（可选）" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="ruleType" label="规则分类" rules={[{ required: true }]}>
                <Select placeholder="选择分类">
                  <Option value="status">状态规则</Option>
                  <Option value="budget">预算规则</Option>
                  <Option value="bid">出价规则</Option>
                  <Option value="notification">通知规则</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="applyTo" label="应用对象层级" rules={[{ required: true }]}>
                <Select placeholder="选择层级">
                  <Option value="campaign">广告系列 (Campaign)</Option>
                  <Option value="adset">广告组 (AdSet)</Option>
                  <Option value="ad">广告 (Ad)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="conditionLogic" label="条件逻辑">
                <Radio.Group buttonStyle="solid" size="small">
                  <Radio.Button value="AND">全部满足</Radio.Button>
                  <Radio.Button value="OR">任一满足</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          {/* Target Selection */}
          <Card size="small" title="目标对象" extra={<span style={{ fontSize: 12, color: '#8c8c8c' }}>留空 = 应用到所有活跃对象</span>} style={{ marginBottom: 16 }}>
            <Form.Item name="targetIds">
              <Select
                mode="multiple"
                placeholder="留空则自动应用到所有活跃对象"
                showSearch
                optionFilterProp="children"
                style={{ width: '100%' }}
                allowClear
              >
                {campaignsData?.map((c: any) => (
                  <Option key={c.id} value={c.id}>{c.name}</Option>
                ))}
              </Select>
            </Form.Item>
          </Card>

          {/* Conditions */}
          <Card size="small" title="触发条件" style={{ marginBottom: 16 }}>
            <Form.List name="conditions">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Row key={key} gutter={8} style={{ marginBottom: 8 }} align="middle">
                      <Col span={6}>
                        <Form.Item {...restField} name={[name, 'metric']} rules={[{ required: true }]} noStyle>
                          <Select placeholder="指标">
                            <Option value="spend">花费 (Spend)</Option>
                            <Option value="cpa">CPA</Option>
                            <Option value="ctr">点击率 (CTR)</Option>
                            <Option value="roas">ROAS</Option>
                            <Option value="conversions">转化数</Option>
                            <Option value="impressions">展示数</Option>
                            <Option value="clicks">点击数</Option>
                            <Option value="cpc">CPC</Option>
                            <Option value="epc">EPC (每点击收益)</Option>
                            <Option value="profitability">盈利系数 (EPC/CPC)</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item {...restField} name={[name, 'operator']} rules={[{ required: true }]} noStyle>
                          <Select placeholder="比较">
                            <Option value=">">{'>'}</Option>
                            <Option value="<">{'<'}</Option>
                            <Option value=">=">{'≥'}</Option>
                            <Option value="<=">{'≤'}</Option>
                            <Option value="==">{'='}</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={5}>
                        <Form.Item {...restField} name={[name, 'value']} rules={[{ required: true }]} noStyle>
                          <InputNumber style={{ width: '100%' }} placeholder="阈值" />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item {...restField} name={[name, 'timeWindow']} noStyle>
                          <Select placeholder="时间窗口">
                            {TIME_WINDOW_OPTIONS.map(o => (
                              <Option key={o.value} value={o.value}>{o.label}</Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={3}>
                        <Button type="link" danger onClick={() => remove(name)}>删除</Button>
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    添加条件
                  </Button>
                </>
              )}
            </Form.List>
          </Card>

          {/* Actions */}
          <Card size="small" title="执行动作" style={{ marginBottom: 16 }}>
            <Form.List name="actions">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Row key={key} gutter={8} style={{ marginBottom: 8 }} align="middle">
                      <Col span={8}>
                        <Form.Item {...restField} name={[name, 'type']} rules={[{ required: true }]} noStyle>
                          <Select placeholder="动作类型">
                            <Option value="pause">暂停对象</Option>
                            <Option value="unpause">启用对象</Option>
                            <Option value="adjust_budget">调整预算</Option>
                            <Option value="adjust_bid">调整出价</Option>
                            <Option value="notify">发送通知</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={13}>
                        <Form.Item shouldUpdate={(prev, curr) => prev.actions?.[name]?.type !== curr.actions?.[name]?.type} noStyle>
                          {({ getFieldValue }) => {
                            const actionType = getFieldValue(['actions', name, 'type'])
                            if (actionType === 'adjust_budget') {
                              return (
                                <Row gutter={8}>
                                  <Col span={12}>
                                    <Form.Item {...restField} name={[name, 'params', 'changePercent']} noStyle>
                                      <InputNumber style={{ width: '100%' }} placeholder="调整百分比 %" />
                                    </Form.Item>
                                  </Col>
                                  <Col span={12}>
                                    <Form.Item {...restField} name={[name, 'params', 'changeAmount']} noStyle>
                                      <InputNumber style={{ width: '100%' }} placeholder="或调整金额 $" />
                                    </Form.Item>
                                  </Col>
                                </Row>
                              )
                            }
                            if (actionType === 'adjust_bid') {
                              return (
                                <Form.Item {...restField} name={[name, 'params', 'changePercent']} noStyle>
                                  <InputNumber style={{ width: '100%' }} placeholder="调整百分比 %" />
                                </Form.Item>
                              )
                            }
                            return <span style={{ color: '#999', fontSize: 12 }}>无需额外参数</span>
                          }}
                        </Form.Item>
                      </Col>
                      <Col span={3}>
                        <Button type="link" danger onClick={() => remove(name)}>删除</Button>
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" onClick={() => add({ type: 'pause', params: {} })} block icon={<PlusOutlined />}>
                    添加动作
                  </Button>
                </>
              )}
            </Form.List>
          </Card>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="cooldownMinutes" label="冷却时间（分钟）">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="两次执行之间的最小间隔" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxExecutions" label="最大执行次数">
                <InputNumber min={1} style={{ width: '100%' }} placeholder="留空表示无限制" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notifyEmails" label="通知邮箱">
            <Select mode="tags" placeholder="输入邮箱地址，按回车添加" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Test Result Modal */}
      <Modal
        title="规则测试结果"
        open={isTestModalVisible}
        onCancel={() => setIsTestModalVisible(false)}
        footer={[<Button key="close" onClick={() => setIsTestModalVisible(false)}>关闭</Button>]}
        width={700}
      >
        {testResult && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Badge
                status={testResult.targetsThatWouldTrigger > 0 ? 'success' : 'default'}
                text={`${testResult.targetsThatWouldTrigger} / ${testResult.targetsTested} 个目标将触发规则`}
              />
            </div>
            {testResult.results?.map((r: any, i: number) => (
              <Card
                key={i}
                size="small"
                title={`目标: ${r.targetId.slice(0, 8)}...`}
                style={{ marginBottom: 8 }}
                extra={
                  r.conditionsMet
                    ? <Tag color="green">将触发</Tag>
                    : <Tag>不触发</Tag>
                }
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <div style={{ fontSize: 12, color: '#666' }}>性能数据</div>
                    <div style={{ fontSize: 12 }}>
                      花费: ${r.performanceData?.spend?.toFixed(2) || 0}<br />
                      CPA: ${r.performanceData?.cpa?.toFixed(2) || 0}<br />
                      CTR: {(r.performanceData?.ctr * 100)?.toFixed(2) || 0}%<br />
                      CPC: ${r.performanceData?.cpc?.toFixed(4) || 0}<br />
                      EPC: ${r.performanceData?.epc?.toFixed(4) || 0}<br />
                      盈利系数: {r.performanceData?.profitability?.toFixed(2) || 0}<br />
                      转化: {r.performanceData?.conversions || 0}<br />
                      国家: {r.performanceData?.countryCode || '-'}
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: 12, color: '#666' }}>将执行动作</div>
                    {r.actionsThatWouldExecute?.length > 0 ? (
                      r.actionsThatWouldExecute.map((a: string, j: number) => (
                        <Tag key={j} color="volcano">{ACTION_MAP[a] || a}</Tag>
                      ))
                    ) : (
                      <span style={{ fontSize: 12, color: '#999' }}>无</span>
                    )}
                  </Col>
                </Row>
              </Card>
            ))}
          </div>
        )}
      </Modal>

      {/* Logs Drawer */}
      <Drawer
        title={`执行日志 - ${selectedRule?.name || ''}`}
        width={600}
        open={isLogsDrawerVisible}
        onClose={() => setIsLogsDrawerVisible(false)}
      >
        {logsLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : logsData?.data?.length > 0 ? (
          <Timeline mode="left">
            {logsData.data.map((log: ExecutionLog) => (
              <Timeline.Item
                key={log.id}
                dot={
                  log.status === 'success'
                    ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    : log.status === 'failed'
                      ? <CloseCircleOutlined style={{ color: '#f5222d' }}
 />
                      : <WarningOutlined style={{ color: '#faad14' }} />
                }
                label={dayjs(log.executedAt).format('MM-DD HH:mm:ss')}
              >
                <div>
                  <Tag color={log.status === 'success' ? 'green' : log.status === 'failed' ? 'red' : 'orange'}>
                    {log.status === 'success' ? '成功' : log.status === 'failed' ? '失败' : '跳过'}
                  </Tag>
                  {log.triggerData && (
                    <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>
                      检查: {log.triggerData.targetsChecked} · 触发: {log.triggerData.targetsTriggered} · 动作: {log.triggerData.actionsExecuted}
                    </span>
                  )}
                  {log.errorMessage && (
                    <div style={{ fontSize: 12, color: '#f5222d', marginTop: 4 }}>
                      {log.errorMessage}
                    </div>
                  )}
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        ) : (
          <Empty description="暂无执行日志" />
        )}
      </Drawer>

      {/* Detail Drawer */}
      <Drawer
        title="规则详情"
        width={500}
        open={isDetailDrawerVisible}
        onClose={() => setIsDetailDrawerVisible(false)}
      >
        {selectedRule && (
          <div>
            <h3>{selectedRule.name}</h3>
            <p style={{ color: '#666' }}>{selectedRule.description || '无描述'}</p>
            <Divider />
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>基本信息</div>
              <div style={{ fontSize: 13 }}>类型: {RULE_TYPE_MAP[selectedRule.ruleType]?.text || selectedRule.ruleType}</div>
              <div style={{ fontSize: 13 }}>层级: {APPLY_TO_MAP[selectedRule.applyTo]}</div>
              <div style={{ fontSize: 13 }}>状态: {selectedRule.isActive ? '激活' : '暂停'}</div>
              <div style={{ fontSize: 13 }}>执行次数: {selectedRule.executionCount}</div>
              <div style={{ fontSize: 13 }}>冷却时间: {selectedRule.cooldownMinutes} 分钟</div>
            </div>
            <Divider />
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>触发条件</div>
              {selectedRule.conditions?.map((cond, i) => (
                <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>
                  {i + 1}. {formatCondition(cond)}
                  {i < (selectedRule.conditions?.length || 0) - 1 && (
                    <span style={{ color: '#1890ff' }}> {selectedRule.conditionLogic === 'OR' ? '或' : '且'} </span>
                  )}
                </div>
              ))}
            </div>
            <Divider />
            <div>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>执行动作</div>
              {selectedRule.actions?.map((action, i) => (
                <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>
                  {i + 1}. {ACTION_MAP[action.type] || action.type}
                  {action.params && Object.keys(action.params).length > 0 && (
                    <span style={{ color: '#666' }}> ({JSON.stringify(action.params)})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default Rules
