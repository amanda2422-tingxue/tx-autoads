import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Card, Row, Col, Statistic, Select, Space, Spin, Empty,
  Button, Table, Tag, message, Tooltip, Result, Tabs, Badge, Radio,
} from 'antd'
import {
  DollarOutlined, EyeOutlined, ThunderboltOutlined, RiseOutlined,
  SyncOutlined, GlobalOutlined, UserOutlined, RocketOutlined,
  BarChartOutlined, FireOutlined, LineChartOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { performanceApi } from '../utils/api/performance'
import DateRangePicker from '../components/DateRangePicker'
import CreativeAnalysis from './CreativeAnalysis'
import Reports from './Reports'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts'
import dayjs from 'dayjs'

const { Option } = Select

// ======== 投放分析子组件 ========

const DIMENSION_OPTIONS = [
  { key: 'campaign', label: '广告系列', icon: <RocketOutlined /> },
  { key: 'country', label: '国家', icon: <GlobalOutlined /> },
  { key: 'designer', label: '优化师', icon: <UserOutlined /> },
]

const STATUS_MAP: Record<string, { color: string; text: string }> = {
  active: { color: 'green', text: '投放中' },
  paused: { color: 'orange', text: '已暂停' },
  draft: { color: 'default', text: '草稿' },
  ended: { color: 'red', text: '已结束' },
}

interface DeliveryAnalysisProps {
  initialCampaignId?: string | null
  initialDate?: string | null
}

const DeliveryAnalysis: React.FC<DeliveryAnalysisProps> = ({ initialCampaignId, initialDate }) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [trendCollapsed, setTrendCollapsed] = useState(false)

  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => {
    if (initialDate) {
      return [dayjs(initialDate), dayjs(initialDate)]
    }
    return [dayjs().subtract(30, 'day'), dayjs()]
  })
  const [dimension, setDimension] = useState<string>('campaign')
  const [campaignId, setCampaignId] = useState<string | undefined>(initialCampaignId || undefined)

  // 当 initialCampaignId 变化时更新
  useEffect(() => {
    if (initialCampaignId) {
      setCampaignId(initialCampaignId)
    }
  }, [initialCampaignId])

  useEffect(() => {
    if (initialDate) {
      setDateRange([dayjs(initialDate), dayjs(initialDate)])
    }
  }, [initialDate])

  const dateParams = {
    startDate: dateRange[0].format('YYYY-MM-DD'),
    endDate: dateRange[1].format('YYYY-MM-DD'),
  }

  // 同步
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await performanceApi.sync(dateParams)
      return res.data
    },
    onSuccess: (data: any) => {
      message.success(data.message || '同步完成')
      queryClient.invalidateQueries({ queryKey: ['delivery-analysis'] })
    },
    onError: () => { message.error('同步失败') },
  })

  // 数据查询
  const { data: analysisRes, isLoading, isError } = useQuery({
    queryKey: ['delivery-analysis', dateParams.startDate, dateParams.endDate, dimension, campaignId],
    queryFn: async () => {
      const res = await performanceApi.deliveryAnalysis({
        ...dateParams,
        dimension: dimension as any,
        campaignId,
      })
      return res.data
    },
    retry: 1,
    staleTime: 60_000,
  })

  const { summary, dailyTrend, breakdown, campaignOptions } = analysisRes || {} as any

  // 趋势图数据
  const trendData = useMemo(() =>
    (dailyTrend || []).map((d: any) => ({
      date: dayjs(d.date).format('MM-DD'),
      spend: d.spend,
      conversions: d.conversions,
      clicks: d.clicks,
    })),
    [dailyTrend]
  )

  // 根据维度动态生成表格列
  const columns = useMemo(() => {
    const nameCol: any = {
      title: dimension === 'campaign' ? '广告系列' : dimension === 'country' ? '国家' : '优化师',
      key: 'name',
      width: 220,
      fixed: 'left',
      render: (_: any, record: any) => {
        if (dimension === 'campaign') {
          return (
            <div>
              <a onClick={() => navigate(`/campaigns/${record.id}`)} style={{ fontWeight: 500 }}>
                {record.name}
              </a>
              <div style={{ marginTop: 2 }}>
                {record.status && (
                  <Badge
                    status={(STATUS_MAP[record.status]?.color || 'default') as any}
                    text={<span style={{ fontSize: 11, color: '#999' }}>{STATUS_MAP[record.status]?.text || record.status}</span>}
                  />
                )}
              </div>
            </div>
          )
        }
        return <span style={{ fontWeight: 500 }}>{record.name}</span>
      },
    }

    const metricCols = [
      {
        title: '花费',
        dataIndex: 'spend',
        key: 'spend',
        width: 110,
        sorter: (a: any, b: any) => a.spend - b.spend,
        defaultSortOrder: 'descend' as const,
        render: (v: number) => v ? <span style={{ fontWeight: 500 }}>${v.toFixed(2)}</span> : '—',
      },
      {
        title: '转化',
        dataIndex: 'conversions',
        key: 'conversions',
        width: 80,
        sorter: (a: any, b: any) => a.conversions - b.conversions,
        render: (v: number) => v ? <span style={{ color: '#52c41a', fontWeight: 500 }}>{v}</span> : '—',
      },
      {
        title: '展示',
        dataIndex: 'impressions',
        key: 'impressions',
        width: 100,
        sorter: (a: any, b: any) => a.impressions - b.impressions,
        render: (v: number) => v ? v.toLocaleString() : '—',
      },
      {
        title: '点击',
        dataIndex: 'clicks',
        key: 'clicks',
        width: 80,
        sorter: (a: any, b: any) => a.clicks - b.clicks,
        render: (v: number) => v ? v.toLocaleString() : '—',
      },
      {
        title: 'CTR',
        dataIndex: 'ctr',
        key: 'ctr',
        width: 85,
        sorter: (a: any, b: any) => a.ctr - b.ctr,
        render: (v: number) => {
          if (!v) return '—'
          const pct = v * 100
          const color = pct >= 3 ? '#52c41a' : pct >= 1 ? '#faad14' : '#f5222d'
          return <span style={{ color }}>{pct.toFixed(2)}%</span>
        },
      },
      {
        title: 'CPA',
        dataIndex: 'cpa',
        key: 'cpa',
        width: 85,
        sorter: (a: any, b: any) => a.cpa - b.cpa,
        render: (v: number) => {
          if (!v) return '—'
          const color = v <= 5 ? '#52c41a' : v <= 10 ? '#faad14' : '#f5222d'
          return <span style={{ color }}>${v.toFixed(2)}</span>
        },
      },
      {
        title: 'ROI',
        dataIndex: 'roi',
        key: 'roi',
        width: 85,
        sorter: (a: any, b: any) => a.roi - b.roi,
        render: (v: number) => {
          if (v === undefined || v === null) return '—'
          const pct = v * 100
          const color = pct >= 0 ? '#52c41a' : '#f5222d'
          return <span style={{ color, fontWeight: 600 }}>{pct.toFixed(1)}%</span>
        },
      },
    ]

    // campaign 维度额外显示预算
    if (dimension === 'campaign') {
      metricCols.splice(0, 0, {
        title: '预算',
        dataIndex: 'budgetAmount',
        key: 'budget',
        width: 90,
        sorter: (a: any, b: any) => (a.budgetAmount || 0) - (b.budgetAmount || 0),
        render: (v: number) => v ? `$${v.toFixed(2)}` : '—',
      } as any)
    }

    // designer 维度额外显示广告数
    if (dimension === 'designer') {
      metricCols.push({
        title: '广告数',
        dataIndex: 'adCount',
        key: 'adCount',
        width: 75,
        sorter: (a: any, b: any) => (a.adCount || 0) - (b.adCount || 0),
        render: (v: number) => <Tag>{v || 0}</Tag>,
      } as any)
    }

    return [nameCol, ...metricCols]
  }, [dimension, navigate])

  if (isError) {
    return (
      <Result
        status="warning"
        title="数据加载失败"
        extra={<Button type="primary" onClick={() => queryClient.invalidateQueries({ queryKey: ['delivery-analysis'] })}>重试</Button>}
      />
    )
  }

  return (
    <div>
      {/* 筛选栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Space wrap>
          <Radio.Group
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            size="middle"
          >
            {DIMENSION_OPTIONS.map(d => (
              <Radio.Button key={d.key} value={d.key}>
                {d.icon} <span style={{ marginLeft: 4 }}>{d.label}</span>
              </Radio.Button>
            ))}
          </Radio.Group>
          <Select
            placeholder="筛选广告系列"
            allowClear
            showSearch
            optionFilterProp="children"
            value={campaignId}
            onChange={setCampaignId}
            style={{ width: 220 }}
          >
            {(campaignOptions || []).map((c: any) => (
              <Option key={c.id} value={c.id}>{c.name}</Option>
            ))}
          </Select>
        </Space>
        <Space>
          <DateRangePicker
            value={dateRange}
            onChange={(dates) => { if (dates) setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs]) }}
          />
          <Tooltip title="从 Facebook 同步最新数据">
            <Button
              icon={<SyncOutlined spin={syncMutation.isPending} />}
              loading={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              同步
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* KPI 卡片 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} lg={3}>
          <Card size="small" loading={isLoading}>
            <Statistic title="总花费" value={summary?.totalSpend || 0} precision={2} prefix={<DollarOutlined />} suffix="USD" valueStyle={{ fontSize: 16, color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={3}>
          <Card size="small" loading={isLoading}>
            <Statistic title="转化" value={summary?.totalConversions || 0} prefix={<ThunderboltOutlined />} valueStyle={{ fontSize: 16, color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={3}>
          <Card size="small" loading={isLoading}>
            <Statistic title="ROI" value={(summary?.avgRoi || 0) * 100} precision={1} suffix="%" valueStyle={{ fontSize: 16, color: (summary?.avgRoi || 0) >= 0 ? '#3f8600' : '#cf1322', fontWeight: 600 }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={3}>
          <Card size="small" loading={isLoading}>
            <Statistic title="CPA" value={summary?.avgCpa || 0} precision={2} prefix="$" valueStyle={{ fontSize: 16, color: (summary?.avgCpa || 0) > 10 ? '#cf1322' : '#3f8600' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={3}>
          <Card size="small" loading={isLoading}>
            <Statistic title="展示" value={summary?.totalImpressions || 0} valueStyle={{ fontSize: 16 }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={3}>
          <Card size="small" loading={isLoading}>
            <Statistic title="点击" value={summary?.totalClicks || 0} valueStyle={{ fontSize: 16 }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={3}>
          <Card size="small" loading={isLoading}>
            <Statistic title="CTR" value={(summary?.avgCtr || 0) * 100} precision={2} suffix="%" prefix={<RiseOutlined />} valueStyle={{ fontSize: 16, color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={3}>
          <Card size="small" loading={isLoading}>
            <Statistic title="总收入" value={summary?.totalRevenue || 0} precision={2} prefix="$" valueStyle={{ fontSize: 16, color: '#722ed1' }} />
          </Card>
        </Col>
      </Row>

      {/* 趋势图（可折叠） */}
      <Card
        title={
          <span
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setTrendCollapsed(!trendCollapsed)}
          >
            {trendCollapsed ? '▶' : '▼'} 投放趋势
          </span>
        }
        size="small"
        style={{ marginBottom: 16 }}
        extra={
          <Button type="link" size="small" onClick={() => setTrendCollapsed(!trendCollapsed)}>
            {trendCollapsed ? '展开' : '收起'}
          </Button>
        }
      >
        {!trendCollapsed && (
          <div style={{ height: 280 }}>
            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Spin /></div>
            ) : trendData.length > 0 ? (
              <ResponsiveContainer>
                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="perfSpendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1890ff" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="perfConvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#52c41a" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <RechartsTooltip
                    formatter={(value: any, name: string) => {
                      if (name === '花费') return [`$${Number(value).toFixed(2)}`, name]
                      return [value, name]
                    }}
                  />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="spend" name="花费" stroke="#1890ff" fill="url(#perfSpendGrad)" />
                  <Area yAxisId="right" type="monotone" dataKey="conversions" name="转化" stroke="#52c41a" fill="url(#perfConvGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="暂无趋势数据" style={{ marginTop: 60 }} />
            )}
          </div>
        )}
      </Card>

      {/* 维度明细表 */}
      <Card
        title={`${DIMENSION_OPTIONS.find(d => d.key === dimension)?.label || ''}明细`}
        size="small"
      >
        <Table
          columns={columns}
          dataSource={breakdown || []}
          rowKey={(r: any) => r.id || r.name}
          loading={isLoading}
          size="middle"
          scroll={{ x: 800 }}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
          locale={{ emptyText: '暂无数据，请先同步' }}
          summary={() => {
            if (!breakdown || breakdown.length === 0) return null
            const totals = breakdown.reduce(
              (acc: any, row: any) => ({
                spend: acc.spend + (row.spend || 0),
                conversions: acc.conversions + (row.conversions || 0),
                impressions: acc.impressions + (row.impressions || 0),
                clicks: acc.clicks + (row.clicks || 0),
              }),
              { spend: 0, conversions: 0, impressions: 0, clicks: 0 }
            )
            const totalCtr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0
            const totalCpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0
            const totalRevenue = breakdown.reduce((sum: number, r: any) => sum + (r.revenue || 0), 0)
            const totalRoi = totals.spend > 0 ? (totalRevenue - totals.spend) / totals.spend : 0

            return (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
                  <Table.Summary.Cell index={0}>
                    汇总
                  </Table.Summary.Cell>
                  {dimension === 'campaign' && (
                    <Table.Summary.Cell index={1}>—</Table.Summary.Cell>
                  )}
                  <Table.Summary.Cell index={dimension === 'campaign' ? 2 : 1}>
                    <span style={{ fontWeight: 600 }}>${totals.spend.toFixed(2)}</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={dimension === 'campaign' ? 3 : 2}>
                    <span style={{ color: '#52c41a', fontWeight: 600 }}>{totals.conversions}</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={dimension === 'campaign' ? 4 : 3}>
                    {totals.impressions.toLocaleString()}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={dimension === 'campaign' ? 5 : 4}>
                    {totals.clicks.toLocaleString()}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={dimension === 'campaign' ? 6 : 5}>
                    <span style={{ color: totalCtr * 100 >= 3 ? '#52c41a' : totalCtr * 100 >= 1 ? '#faad14' : '#f5222d' }}>
                      {(totalCtr * 100).toFixed(2)}%
                    </span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={dimension === 'campaign' ? 7 : 6}>
                    <span style={{ color: totalCpa <= 5 ? '#52c41a' : totalCpa <= 10 ? '#faad14' : '#f5222d' }}>
                      ${totalCpa.toFixed(2)}
                    </span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={dimension === 'campaign' ? 8 : 7}>
                    <span style={{ color: totalRoi >= 0 ? '#52c41a' : '#f5222d' }}>
                      {(totalRoi * 100).toFixed(1)}%
                    </span>
                  </Table.Summary.Cell>
                  {dimension === 'designer' && (
                    <Table.Summary.Cell index={9}>
                      <Tag>{breakdown.reduce((sum: number, r: any) => sum + (r.adCount || 0), 0)}</Tag>
                    </Table.Summary.Cell>
                  )}
                </Table.Summary.Row>
              </Table.Summary>
            )
          }}
        />
      </Card>
    </div>
  )
}

// ======== 主页面：双 Tab 结构 ========

const Performance: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = searchParams.get('tab') || 'delivery'
  const initialCampaignId = searchParams.get('campaignId')
  const initialDate = searchParams.get('date')

  const handleTabChange = (key: string) => {
    // 切换 Tab 时保留最少参数
    const params = new URLSearchParams()
    params.set('tab', key)
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="page-container">
      <div className="card-header" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          数据分析
        </h2>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={[
          {
            key: 'delivery',
            label: (
              <span><LineChartOutlined style={{ marginRight: 4 }} />投放分析</span>
            ),
            children: (
              <DeliveryAnalysis
                initialCampaignId={initialCampaignId}
                initialDate={initialDate}
              />
            ),
          },
          {
            key: 'creative',
            label: (
              <span><FireOutlined style={{ marginRight: 4 }} />素材分析</span>
            ),
            children: <CreativeAnalysis />,
          },
          {
            key: 'reports',
            label: (
              <span><FileTextOutlined style={{ marginRight: 4 }} />自定义报表</span>
            ),
            children: <Reports />,
          },
        ]}
      />
    </div>
  )
}

export default Performance
