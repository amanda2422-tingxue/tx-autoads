import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Statistic, Select, Space, Spin, Empty, Button, Table, Tag, message, Tooltip, Alert, Result } from 'antd'
import {
  DollarOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  RiseOutlined,
  SyncOutlined,
  TrophyOutlined,
  FireOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { performanceApi } from '../utils/api/performance'
import DateRangePicker from '../components/DateRangePicker'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  Cell,
} from 'recharts'
import dayjs from 'dayjs'

const { Option } = Select

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1']

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ])
  const [trendCollapsed, setTrendCollapsed] = useState(false)
  const queryClient = useQueryClient()

  // 同步 Mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await performanceApi.sync({
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
      })
      return res.data
    },
    onSuccess: (data) => {
      message.success(data.message || `成功同步 ${data.synced} 条记录`)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '同步失败')
    },
  })

  // Dashboard 查询
  const { data: dashboardData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD')],
    queryFn: async () => {
      const res = await performanceApi.dashboard({
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
      })
      return res.data
    },
    retry: 1,
    retryDelay: 1000,
    staleTime: 60_000,
  })

  const { summary, dailyTrend = [], topCampaigns = [], creativePerformance = [] } = dashboardData || {}

  // Format trend data for Recharts
  const trendData = dailyTrend.map((item: any) => ({
    date: dayjs(item.date).format('MM-DD'),
    spend: item._sum?.spend || 0,
    conversions: item._sum?.conversions || 0,
    clicks: item._sum?.clicks || 0,
  }))

  // 素材排行汇总行
  const creativeSummary = creativePerformance.length > 0 ? {
    creativeName: '汇总',
    isSummary: true,
    totalSpend: creativePerformance.reduce((s: number, r: any) => s + (r.totalSpend || 0), 0),
    totalConversions: creativePerformance.reduce((s: number, r: any) => s + (r.totalConversions || 0), 0),
    totalImpressions: creativePerformance.reduce((s: number, r: any) => s + (r.totalImpressions || 0), 0),
    totalClicks: creativePerformance.reduce((s: number, r: any) => s + (r.totalClicks || 0), 0),
    avgCtr: (() => {
      const imp = creativePerformance.reduce((s: number, r: any) => s + (r.totalImpressions || 0), 0)
      const clk = creativePerformance.reduce((s: number, r: any) => s + (r.totalClicks || 0), 0)
      return imp > 0 ? clk / imp : 0
    })(),
    avgCpa: (() => {
      const sp = creativePerformance.reduce((s: number, r: any) => s + (r.totalSpend || 0), 0)
      const cv = creativePerformance.reduce((s: number, r: any) => s + (r.totalConversions || 0), 0)
      return cv > 0 ? sp / cv : 0
    })(),
    roi: (() => {
      const sp = creativePerformance.reduce((s: number, r: any) => s + (r.totalSpend || 0), 0)
      const cv = creativePerformance.reduce((s: number, r: any) => s + (r.totalConversions || 0), 0)
      return sp > 0 && cv > 0 ? ((cv * 0.25 - sp) / sp * 100) : 0
    })(),
  } : null

  const creativeDataWithSummary = creativeSummary
    ? [...creativePerformance, creativeSummary]
    : creativePerformance

  // 素材排行表格列
  const creativeColumns = [
    {
      title: '素材',
      dataIndex: 'creativeName',
      key: 'creativeName',
      render: (_: any, record: any) => {
        if (record.isSummary) return <span style={{ fontWeight: 700 }}>{record.creativeName}</span>
        return (
          <Space>
            {record.fileUrl && (
              <img src={record.fileUrl.startsWith('http') ? record.fileUrl : `http://localhost:3001${record.fileUrl}`} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
            )}
            <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
              {record.creativeName || '未命名'}
            </span>
          </Space>
        )
      },
    },
    {
      title: '花费',
      dataIndex: 'totalSpend',
      key: 'totalSpend',
      width: 100,
      render: (v: number, record: any) => {
        const style = record.isSummary ? { fontWeight: 700 } : {}
        return <span style={style}>{v ? `$${v.toFixed(2)}` : '-'}</span>
      },
    },
    {
      title: '转化',
      dataIndex: 'totalConversions',
      key: 'totalConversions',
      width: 80,
      render: (v: number, record: any) => {
        const style = record.isSummary ? { fontWeight: 700 } : {}
        return <span style={style}>{v || '-'}</span>
      },
    },
    {
      title: 'ROI',
      key: 'roi',
      width: 90,
      render: (_: any, record: any) => {
        const spend = record.totalSpend || 0
        const conversions = record.totalConversions || 0
        const roi = spend > 0 && conversions > 0 ? ((conversions * 0.25 - spend) / spend * 100) : 0
        const color = roi > 0 ? '#52c41a' : roi < 0 ? '#f5222d' : '#8c8c8c'
        const style = record.isSummary ? { fontWeight: 700, color } : { color }
        return <span style={style}>{roi !== 0 ? `${roi.toFixed(1)}%` : '-'}</span>
      },
    },
    {
      title: '展示',
      dataIndex: 'totalImpressions',
      key: 'totalImpressions',
      width: 100,
      render: (v: number, record: any) => {
        const style = record.isSummary ? { fontWeight: 700 } : {}
        return <span style={style}>{v ? v.toLocaleString() : '-'}</span>
      },
    },
    {
      title: 'CTR',
      dataIndex: 'avgCtr',
      key: 'avgCtr',
      width: 80,
      render: (v: number, record: any) => {
        const style = record.isSummary ? { fontWeight: 700 } : {}
        return <span style={style}>{v ? `${(v * 100).toFixed(2)}%` : '-'}</span>
      },
    },
    {
      title: 'CPA',
      dataIndex: 'avgCpa',
      key: 'avgCpa',
      width: 80,
      render: (v: number, record: any) => {
        const style = record.isSummary ? { fontWeight: 700 } : {}
        return <span style={style}>{v ? `$${v.toFixed(2)}` : '-'}</span>
      },
    },
  ]

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="正在加载看板数据..." />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="page-container">
        <Result
          status="warning"
          title="数据加载失败"
          subTitle={(error as any)?.message || '无法连接到后端服务，请确认服务已启动'}
          extra={
            <Space>
              <Button type="primary" onClick={() => refetch()}>
                重试
              </Button>
              <Button onClick={() => syncMutation.mutate()}>
                同步数据
              </Button>
            </Space>
          }
        />
      </div>
    )
  }

  const hasData = summary && (summary.totalSpend > 0 || summary.totalConversions > 0)

  return (
    <div className="page-container">
      <div className="card-header" style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>数据看板</h2>
        <Space>
          <DateRangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates) setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])
            }}
          />
          <Tooltip title="从 Facebook 拉取最新数据">
            <Button
              icon={<SyncOutlined spin={syncMutation.isPending} />}
              loading={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              同步数据
            </Button>
          </Tooltip>
          <Button icon={<SyncOutlined />} onClick={() => refetch()}>刷新</Button>
          <Select defaultValue="all" style={{ width: 120 }}>
            <Option value="all">所有账户</Option>
          </Select>
        </Space>
      </div>

      {!hasData && !isLoading ? (
        <Empty
          description="暂无数据，点击「同步数据」从 Facebook 拉取广告表现"
          style={{ marginTop: 60 }}
        />
      ) : (
        <>
          {/* KPI 卡片 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="总花费"
                  value={summary?.totalSpend || 0}
                  precision={2}
                  prefix={<DollarOutlined />}
                  suffix="USD"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="平均 CPA"
                  value={summary?.avgCpa || 0}
                  precision={2}
                  prefix={<DollarOutlined />}
                  valueStyle={{ color: (summary?.avgCpa || 0) > 10 ? '#cf1322' : '#3f8600' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="转化次数"
                  value={summary?.totalConversions || 0}
                  prefix={<ThunderboltOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="点击率 (CTR)"
                  value={(summary?.avgCtr || 0) * 100}
                  precision={2}
                  suffix="%"
                  prefix={<RiseOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 图表区域 */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={16}>
              <Card
                title={
                  <span
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setTrendCollapsed(!trendCollapsed)}
                  >
                    {trendCollapsed ? '▶' : '▼'} 投放趋势
                  </span>
                }
                extra={
                  <Button type="link" size="small" onClick={() => setTrendCollapsed(!trendCollapsed)}>
                    {trendCollapsed ? '展开' : '收起'}
                  </Button>
                }
              >
                {!trendCollapsed && (
                  <div style={{ height: 350, width: '100%' }}>
                    {trendData.length > 0 ? (
                      <ResponsiveContainer>
                        <AreaChart data={trendData}>
                          <defs>
                            <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#1890ff" stopOpacity={0.1} />
                              <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="date" />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <RechartsTooltip />
                          <Legend />
                          <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="spend"
                            name="花费 (USD)"
                            stroke="#1890ff"
                            fillOpacity={1}
                            fill="url(#colorSpend)"
                          />
                          <Area
                            yAxisId="right"
                            type="monotone"
                            dataKey="conversions"
                            name="转化次数"
                            stroke="#52c41a"
                            fillOpacity={0}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <Empty description="暂无趋势数据" />
                    )}
                  </div>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title={<span><TrophyOutlined style={{ marginRight: 6 }} />Top 5 广告系列 (花费)</span>}>
                <div style={{ height: 350, width: '100%' }}>
                  {topCampaigns.length > 0 ? (
                    <ResponsiveContainer>
                      <BarChart data={topCampaigns} layout="vertical" margin={{ left: 20, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" hide />
                        <YAxis
                          dataKey="campaignName"
                          type="category"
                          width={160}
                          tick={{ fontSize: 11 }}
                          tickFormatter={(val: string) => val?.slice(0, 20) + (val?.length > 20 ? '...' : '')}
                        />
                        <RechartsTooltip
                          formatter={(value: any, name: string) => {
                            if (name === '_sum.spend') return [`$${value?.toFixed(2)}`, '花费']
                            if (name === '_sum.conversions') return [value, '转化']
                            return [value, name]
                          }}
                        />
                        <Bar dataKey="_sum.spend" name="花费" barSize={20}
                          cursor="pointer"
                          onClick={(data: any) => {
                            if (data?.campaignId) navigate(`/performance?tab=delivery&campaignId=${data.campaignId}&date=${dayjs().format('YYYY-MM-DD')}`)
                          }}
                        >
                          {topCampaigns.map((_entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="暂无排行数据" />
                  )}
                </div>
              </Card>
            </Col>
          </Row>

          {/* 素材表现排行 */}
          <Row style={{ marginTop: 16 }}>
            <Col xs={24}>
              <Card title={<span><FireOutlined style={{ marginRight: 6 }} />素材表现排行</span>}>
                <Table
                  columns={creativeColumns}
                  dataSource={creativeDataWithSummary}
                  rowKey={(record: any, index) => index.toString()}
                  pagination={false}
                  size="small"
                  locale={{ emptyText: '暂无素材表现数据' }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}

export default Dashboard
