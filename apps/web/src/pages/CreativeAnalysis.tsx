import React, { useState } from 'react'
import {
  Card, Row, Col, Statistic, Select, Space, Spin, Empty,
  Button, Table, Tag, message, Tooltip, Result, Modal, Drawer, Progress, Badge,
} from 'antd'
import {
  FireOutlined, TrophyOutlined, EyeOutlined, DollarOutlined,
  RiseOutlined, SyncOutlined, FilterOutlined, PictureOutlined,
  VideoCameraOutlined, AppstoreOutlined, LineChartOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { performanceApi } from '../utils/api/performance'
import DateRangePicker from '../components/DateRangePicker'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend, ScatterChart, Scatter, ZAxis,
} from 'recharts'
import dayjs from 'dayjs'

const { Option } = Select

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16']
const SCORE_COLORS = { high: '#52c41a', mid: '#faad14', low: '#f5222d' }

const getScoreColor = (score: number | null) => {
  if (!score) return SCORE_COLORS.low
  if (score >= 70) return SCORE_COLORS.high
  if (score >= 40) return SCORE_COLORS.mid
  return SCORE_COLORS.low
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'video': return <VideoCameraOutlined />
    case 'carousel': return <AppstoreOutlined />
    default: return <PictureOutlined />
  }
}

const CreativeAnalysis: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ])
  const [sortBy, setSortBy] = useState<string>('conversions')
  const [filterDesigner, setFilterDesigner] = useState<string | undefined>()
  const [filterCountry, setFilterCountry] = useState<string | undefined>()
  const [filterType, setFilterType] = useState<string | undefined>()
  const [selectedCreativeId, setSelectedCreativeId] = useState<string | null>(null)
  const queryClient = useQueryClient()

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
      queryClient.invalidateQueries({ queryKey: ['creative-ranking'] })
      queryClient.invalidateQueries({ queryKey: ['creative-summary'] })
    },
    onError: () => { message.error('同步失败') },
  })

  // 素材总览
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['creative-summary', dateParams.startDate, dateParams.endDate],
    queryFn: async () => {
      const res = await performanceApi.creativeSummary(dateParams)
      return res.data
    },
    retry: 1,
    staleTime: 60_000,
  })

  // 素材排行
  const { data: rankingRes, isLoading: rankingLoading, isError, error } = useQuery({
    queryKey: ['creative-ranking', dateParams.startDate, dateParams.endDate, sortBy, filterDesigner, filterCountry, filterType],
    queryFn: async () => {
      const res = await performanceApi.creativeRanking({
        ...dateParams,
        sortBy: sortBy as any,
        limit: 50,
        designer: filterDesigner,
        country: filterCountry,
        type: filterType,
      })
      return res
    },
    retry: 1,
    staleTime: 60_000,
  })

  const rankingData = rankingRes?.data || []
  const summary = summaryData || {}

  // 素材详情
  const { data: detailRes, isLoading: detailLoading } = useQuery({
    queryKey: ['creative-detail', selectedCreativeId, dateParams.startDate, dateParams.endDate],
    queryFn: async () => {
      if (!selectedCreativeId) return null
      const res = await performanceApi.creativeDetail(selectedCreativeId, dateParams)
      return res.data
    },
    enabled: !!selectedCreativeId,
    retry: 1,
  })

  // 评分分布数据
  const scoreDistribution = React.useMemo(() => {
    if (!rankingData?.length) return []
    const buckets = [
      { range: '0-20', min: 0, max: 20, count: 0, color: '#f5222d' },
      { range: '21-40', min: 21, max: 40, count: 0, color: '#fa8c16' },
      { range: '41-60', min: 41, max: 60, count: 0, color: '#faad14' },
      { range: '61-80', min: 61, max: 80, count: 0, color: '#52c41a' },
      { range: '81-100', min: 81, max: 100, count: 0, color: '#1890ff' },
    ]
    rankingData.forEach((item: any) => {
      const score = item.creativeScore || 0
      const bucket = buckets.find(b => score >= b.min && score <= b.max)
      if (bucket) bucket.count++
    })
    return buckets
  }, [rankingData])

  // 表格列
  const columns = [
    {
      title: '#',
      key: 'rank',
      width: 50,
      render: (_: any, __: any, index: number) => {
        if (index < 3) {
          const colors = ['#FFD700', '#C0C0C0', '#CD7F32']
          return <TrophyOutlined style={{ color: colors[index], fontSize: 18 }} />
        }
        return <span style={{ color: '#999' }}>{index + 1}</span>
      },
    },
    {
      title: '素材',
      key: 'creative',
      width: 260,
      render: (_: any, record: any) => (
        <Space>
          <div style={{
            width: 48, height: 48, borderRadius: 6, overflow: 'hidden',
            border: '1px solid #f0f0f0', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#fafafa',
          }}>
            {record.fileUrl ? (
              <img src={record.fileUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              getTypeIcon(record.creativeType)
            )}
          </div>
          <div>
            <div style={{ fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {record.creativeName || '未命名'}
            </div>
            <Space size={4}>
              <Tag style={{ fontSize: 11, margin: 0 }}>{record.creativeType || 'image'}</Tag>
              {record.designer && <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>{record.designer}</Tag>}
              {record.country && <Tag style={{ fontSize: 11, margin: 0 }}>{record.country}</Tag>}
            </Space>
          </div>
        </Space>
      ),
    },
    {
      title: '评分',
      dataIndex: 'creativeScore',
      key: 'score',
      width: 90,
      sorter: (a: any, b: any) => (a.creativeScore || 0) - (b.creativeScore || 0),
      render: (score: number) => {
        if (!score && score !== 0) return <span style={{ color: '#ccc' }}>—</span>
        return (
          <Progress
            type="circle"
            percent={score}
            size={38}
            strokeColor={getScoreColor(score)}
            format={() => score.toFixed(0)}
          />
        )
      },
    },
    {
      title: '花费',
      dataIndex: 'totalSpend',
      key: 'spend',
      width: 100,
      sorter: (a: any, b: any) => (a.totalSpend || 0) - (b.totalSpend || 0),
      render: (v: number) => v ? <span style={{ fontWeight: 500 }}>${v.toFixed(2)}</span> : '—',
    },
    {
      title: '转化',
      dataIndex: 'totalConversions',
      key: 'conversions',
      width: 80,
      sorter: (a: any, b: any) => (a.totalConversions || 0) - (b.totalConversions || 0),
      render: (v: number) => v ? <span style={{ fontWeight: 500, color: '#52c41a' }}>{v}</span> : '—',
    },
    {
      title: '展示',
      dataIndex: 'totalImpressions',
      key: 'impressions',
      width: 100,
      sorter: (a: any, b: any) => (a.totalImpressions || 0) - (b.totalImpressions || 0),
      render: (v: number) => v ? v.toLocaleString() : '—',
    },
    {
      title: 'CTR',
      dataIndex: 'avgCtr',
      key: 'ctr',
      width: 85,
      sorter: (a: any, b: any) => (a.avgCtr || 0) - (b.avgCtr || 0),
      render: (v: number) => {
        if (!v) return '—'
        const pct = v * 100
        const color = pct >= 3 ? '#52c41a' : pct >= 1 ? '#faad14' : '#f5222d'
        return <span style={{ color }}>{pct.toFixed(2)}%</span>
      },
    },
    {
      title: 'CPA',
      dataIndex: 'avgCpa',
      key: 'cpa',
      width: 85,
      sorter: (a: any, b: any) => (a.avgCpa || 0) - (b.avgCpa || 0),
      render: (v: number) => {
        if (!v) return '—'
        const color = v <= 5 ? '#52c41a' : v <= 10 ? '#faad14' : '#f5222d'
        return <span style={{ color }}>${v.toFixed(2)}</span>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 70,
      render: (_: any, record: any) => (
        <Tooltip title="查看详情趋势">
          <Button
            type="link"
            icon={<LineChartOutlined />}
            onClick={() => setSelectedCreativeId(record.creativeId)}
          />
        </Tooltip>
      ),
    },
  ]

  if (isError) {
    return (
      <Result
        status="warning"
        title="数据加载失败"
        subTitle={(error as any)?.message || '无法连接到后端服务'}
        extra={<Button type="primary" onClick={() => queryClient.invalidateQueries()}>重试</Button>}
      />
    )
  }

  return (
    <div>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Space wrap>
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
              同步数据
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* KPI 卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={summaryLoading}>
            <Statistic
              title="活跃素材数"
              value={summary.totalCreatives || 0}
              prefix={<PictureOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={summaryLoading}>
            <Statistic
              title="平均评分"
              value={summary.avgScore || 0}
              precision={1}
              prefix={<TrophyOutlined />}
              suffix="/ 100"
              valueStyle={{ color: getScoreColor(summary.avgScore) }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={summaryLoading}>
            <Statistic
              title="素材总花费"
              value={summary.totalSpend || 0}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="USD"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={summaryLoading}>
            <Statistic
              title="素材平均 CPA"
              value={summary.avgCpa || 0}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: (summary.avgCpa || 0) > 10 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="评分分布" size="small">
            <div style={{ height: 250 }}>
              {scoreDistribution.some(b => b.count > 0) ? (
                <ResponsiveContainer>
                  <BarChart data={scoreDistribution} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <RechartsTooltip formatter={(value: any) => [`${value} 个素材`, '数量']} />
                    <Bar dataKey="count" name="素材数" barSize={36} radius={[4, 4, 0, 0]}>
                      {scoreDistribution.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="暂无评分数据" style={{ marginTop: 40 }} />
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="维度分布" size="small">
            <div style={{ height: 250 }}>
              {summary.byType?.length > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={(summary.byType || []).map((t: any) => ({
                        name: t.name === 'image' ? '图片' : t.name === 'video' ? '视频' : t.name,
                        value: t.conversions,
                      }))}
                      cx="30%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={40}
                      dataKey="value"
                      label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {(summary.byType || []).map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Pie
                      data={(summary.byDesigner || []).map((d: any) => ({
                        name: d.name,
                        value: d.conversions,
                      }))}
                      cx="70%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={40}
                      dataKey="value"
                      label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {(summary.byDesigner || []).map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <RechartsTooltip formatter={(value: any, name: string) => [`${value} 转化`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="暂无维度数据" style={{ marginTop: 40 }} />
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 筛选 + 排行表格 */}
      <Card
        title={<span><TrophyOutlined style={{ marginRight: 6 }} />素材表现排行</span>}
        style={{ marginTop: 16 }}
        extra={
          <Space wrap>
            <FilterOutlined style={{ color: '#999' }} />
            <Select
              placeholder="排序方式"
              value={sortBy}
              onChange={setSortBy}
              style={{ width: 120 }}
              size="small"
            >
              <Option value="conversions">转化数</Option>
              <Option value="spend">花费</Option>
              <Option value="ctr">CTR</Option>
              <Option value="cpa">CPA</Option>
              <Option value="score">评分</Option>
            </Select>
            <Select
              placeholder="设计师"
              allowClear
              value={filterDesigner}
              onChange={setFilterDesigner}
              style={{ width: 100 }}
              size="small"
            >
              {(summary.byDesigner || []).map((d: any) => (
                <Option key={d.name} value={d.name}>{d.name}</Option>
              ))}
            </Select>
            <Select
              placeholder="国家"
              allowClear
              value={filterCountry}
              onChange={setFilterCountry}
              style={{ width: 80 }}
              size="small"
            >
              {(summary.byCountry || []).map((c: any) => (
                <Option key={c.name} value={c.name}>{c.name}</Option>
              ))}
            </Select>
            <Select
              placeholder="类型"
              allowClear
              value={filterType}
              onChange={setFilterType}
              style={{ width: 90 }}
              size="small"
            >
              <Option value="image">图片</Option>
              <Option value="video">视频</Option>
              <Option value="carousel">轮播</Option>
            </Select>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={rankingData}
          rowKey="creativeId"
          loading={rankingLoading}
          pagination={{ pageSize: 15, showSizeChanger: false, showTotal: (t) => `共 ${t} 个素材` }}
          size="middle"
          scroll={{ x: 900 }}
          locale={{ emptyText: '暂无素材表现数据，请先同步数据' }}
          onRow={(record: any) => ({
            style: { cursor: 'pointer' },
            onClick: () => setSelectedCreativeId(record.creativeId),
          })}
        />
      </Card>

      {/* 素材详情抽屉 */}
      <Drawer
        title="素材详情"
        placement="right"
        width={640}
        open={!!selectedCreativeId}
        onClose={() => setSelectedCreativeId(null)}
        destroyOnClose
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" tip="加载中..." />
          </div>
        ) : detailRes ? (
          <CreativeDetailContent data={detailRes} />
        ) : (
          <Empty description="未找到素材数据" />
        )}
      </Drawer>
    </div>
  )
}

// 素材详情内容组件
const CreativeDetailContent: React.FC<{ data: any }> = ({ data }) => {
  const { creative, dailyTrend, totals, ads } = data

  const trendData = (dailyTrend || []).map((d: any) => ({
    date: dayjs(d.date).format('MM-DD'),
    spend: d.spend,
    conversions: d.conversions,
    clicks: d.clicks,
    impressions: d.impressions,
    ctr: d.ctr ? (d.ctr * 100) : 0,
  }))

  return (
    <div>
      {/* 素材基本信息 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={6}>
            <div style={{
              width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden',
              border: '1px solid #f0f0f0', background: '#fafafa',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {creative.fileUrl ? (
                <img src={creative.fileUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <PictureOutlined style={{ fontSize: 32, color: '#ccc' }} />
              )}
            </div>
          </Col>
          <Col span={18}>
            <h3 style={{ margin: '0 0 8px' }}>{creative.name || '未命名'}</h3>
            <Space wrap size={4}>
              <Tag>{creative.type || 'image'}</Tag>
              {creative.designer && <Tag color="blue">{creative.designer}</Tag>}
              {creative.country && <Tag color="green">{creative.country}</Tag>}
              {creative.width && creative.height && (
                <Tag>{creative.width}x{creative.height}</Tag>
              )}
            </Space>
            {creative.score != null && (
              <div style={{ marginTop: 8 }}>
                <span style={{ marginRight: 8, color: '#666' }}>评分:</span>
                <Progress
                  type="circle"
                  percent={creative.score}
                  size={42}
                  strokeColor={getScoreColor(creative.score)}
                  format={() => creative.score.toFixed(0)}
                />
              </div>
            )}
            {creative.headline && (
              <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
                <strong>标题:</strong> {creative.headline}
              </div>
            )}
          </Col>
        </Row>
      </Card>

      {/* 汇总指标 */}
      {totals && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic title="花费" value={totals.totalSpend} precision={2} prefix="$" valueStyle={{ fontSize: 16 }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="转化" value={totals.totalConversions} valueStyle={{ fontSize: 16, color: '#52c41a' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="CTR" value={(totals.avgCtr || 0) * 100} precision={2} suffix="%" valueStyle={{ fontSize: 16 }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="CPA" value={totals.avgCpa || 0} precision={2} prefix="$" valueStyle={{ fontSize: 16 }} />
            </Card>
          </Col>
        </Row>
      )}

      {/* 每日趋势图 */}
      <Card title="每日趋势" size="small" style={{ marginBottom: 16 }}>
        <div style={{ height: 280 }}>
          {trendData.length > 0 ? (
            <ResponsiveContainer>
              <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="detailSpendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1890ff" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="detailConvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#52c41a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="spend" name="花费 ($)" stroke="#1890ff" fill="url(#detailSpendGrad)" />
                <Area yAxisId="right" type="monotone" dataKey="conversions" name="转化" stroke="#52c41a" fill="url(#detailConvGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Empty description="暂无趋势数据" style={{ marginTop: 60 }} />
          )}
        </div>
      </Card>

      {/* 关联广告 */}
      {ads?.length > 0 && (
        <Card title={`关联广告 (${ads.length})`} size="small">
          {ads.map((ad: any) => (
            <Tag key={ad.id} style={{ marginBottom: 4 }}>{ad.name || ad.id.slice(0, 8)}</Tag>
          ))}
        </Card>
      )}
    </div>
  )
}

export default CreativeAnalysis
