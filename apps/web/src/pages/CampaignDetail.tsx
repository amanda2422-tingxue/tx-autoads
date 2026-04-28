import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Row, Col, Statistic, Space, Spin, Empty,
  Button, Table, Tag, message, Tooltip, Result, Descriptions, Badge, Progress,
} from 'antd'
import {
  ArrowLeftOutlined, DollarOutlined, EyeOutlined, ThunderboltOutlined,
  RiseOutlined, SyncOutlined, PauseCircleOutlined, PlayCircleOutlined,
  PictureOutlined, VideoCameraOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { performanceApi } from '../utils/api/performance'
import { campaignsApi } from '../utils/api/campaigns'
import DateRangePicker from '../components/DateRangePicker'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts'
import dayjs from 'dayjs'

const STATUS_MAP: Record<string, { color: string; text: string }> = {
  active: { color: 'green', text: '投放中' },
  paused: { color: 'orange', text: '已暂停' },
  draft: { color: 'default', text: '草稿' },
  scheduled: { color: 'blue', text: '已排期' },
  ended: { color: 'red', text: '已结束' },
  archived: { color: 'default', text: '已归档' },
  disapproved: { color: 'red', text: '被拒' },
}

const OBJECTIVE_MAP: Record<string, string> = {
  CONVERSIONS: '转化',
  TRAFFIC: '流量',
  AWARENESS: '品牌认知',
  ENGAGEMENT: '互动',
  LEADS: '线索收集',
  APP_PROMOTION: '应用推广',
  SALES: '销售',
}

const CampaignDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ])

  const dateParams = {
    startDate: dateRange[0].format('YYYY-MM-DD'),
    endDate: dateRange[1].format('YYYY-MM-DD'),
  }

  // 获取广告系列表现详情
  const { data: detailData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['campaign-detail', id, dateParams.startDate, dateParams.endDate],
    queryFn: async () => {
      if (!id) return null
      const res = await performanceApi.campaignDetail(id, dateParams)
      return res.data
    },
    enabled: !!id,
    retry: 1,
    staleTime: 60_000,
  })

  // 状态切换
  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!id) return
      const res = await campaignsApi.updateStatus(id, newStatus)
      return res.data
    },
    onSuccess: () => {
      message.success('状态更新成功')
      queryClient.invalidateQueries({ queryKey: ['campaign-detail', id] })
    },
    onError: () => { message.error('状态更新失败') },
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="加载广告系列数据..." />
      </div>
    )
  }

  if (isError || !detailData) {
    return (
      <div className="page-container">
        <Result
          status="warning"
          title="数据加载失败"
          subTitle={(error as any)?.message || '无法获取广告系列数据'}
          extra={
            <Space>
              <Button onClick={() => navigate('/campaigns')}>返回列表</Button>
              <Button type="primary" onClick={() => refetch()}>重试</Button>
            </Space>
          }
        />
      </div>
    )
  }

  const { campaign, totals, dailyTrend, adSets } = detailData
  const statusInfo = STATUS_MAP[campaign.status] || STATUS_MAP.draft

  // 趋势图数据
  const trendData = (dailyTrend || []).map((d: any) => ({
    date: dayjs(d.date).format('MM-DD'),
    spend: d.spend,
    conversions: d.conversions,
    clicks: d.clicks,
    impressions: d.impressions,
  }))

  // AdSet 展开的 Ad 表格列
  const adColumns = [
    {
      title: '广告',
      key: 'ad',
      width: 240,
      render: (_: any, record: any) => (
        <Space>
          <div style={{
            width: 36, height: 36, borderRadius: 4, overflow: 'hidden',
            border: '1px solid #f0f0f0', background: '#fafafa', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {record.creative?.fileUrl ? (
              <img src={record.creative.fileUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <PictureOutlined style={{ color: '#ccc' }} />
            )}
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{record.name || '未命名广告'}</div>
            {record.creative && (
              <span style={{ fontSize: 11, color: '#999' }}>{record.creative.name}</span>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (s: string) => {
        const info = STATUS_MAP[s] || STATUS_MAP.draft
        return <Badge status={info.color as any} text={info.text} />
      },
    },
    {
      title: '花费',
      key: 'spend',
      width: 90,
      render: (_: any, r: any) => r.performance ? `$${r.performance.spend.toFixed(2)}` : '—',
    },
    {
      title: '转化',
      key: 'conversions',
      width: 70,
      render: (_: any, r: any) => r.performance?.conversions ?? '—',
    },
    {
      title: '展示',
      key: 'impressions',
      width: 90,
      render: (_: any, r: any) => r.performance ? r.performance.impressions.toLocaleString() : '—',
    },
    {
      title: 'CTR',
      key: 'ctr',
      width: 75,
      render: (_: any, r: any) => r.performance?.ctr ? `${(r.performance.ctr * 100).toFixed(2)}%` : '—',
    },
    {
      title: 'CPA',
      key: 'cpa',
      width: 75,
      render: (_: any, r: any) => r.performance?.cpa ? `$${r.performance.cpa.toFixed(2)}` : '—',
    },
    {
      title: 'ROI',
      key: 'roi',
      width: 75,
      render: (_: any, r: any) => {
        if (r.performance?.roi === undefined || r.performance?.roi === null) return '—'
        const color = r.performance.roi >= 0 ? '#52c41a' : '#f5222d'
        return <span style={{ color, fontWeight: 600 }}>{(r.performance.roi * 100).toFixed(1)}%</span>
      },
    },
    {
      title: '评分',
      key: 'score',
      width: 65,
      render: (_: any, r: any) => {
        const score = r.creative?.score
        if (score == null) return '—'
        const color = score >= 70 ? '#52c41a' : score >= 40 ? '#faad14' : '#f5222d'
        return <Tag color={color}>{score.toFixed(0)}</Tag>
      },
    },
  ]

  // AdSet 表格列
  const adSetColumns = [
    {
      title: '广告组',
      key: 'name',
      width: 220,
      render: (_: any, record: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.name || '未命名广告组'}</div>
          <Space size={4} style={{ marginTop: 2 }}>
            {record.countryCode && <Tag style={{ fontSize: 11, margin: 0 }}>{record.countryCode}</Tag>}
            {record.optimizationGoal && (
              <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>{record.optimizationGoal}</Tag>
            )}
          </Space>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string) => {
        const info = STATUS_MAP[s] || STATUS_MAP.draft
        return <Badge status={info.color as any} text={info.text} />
      },
    },
    {
      title: '预算',
      key: 'budget',
      width: 90,
      render: (_: any, r: any) => r.budgetAmount ? `$${r.budgetAmount.toFixed(2)}` : '—',
    },
    {
      title: '花费',
      key: 'spend',
      width: 100,
      sorter: (a: any, b: any) => (a.performance?.spend || 0) - (b.performance?.spend || 0),
      render: (_: any, r: any) => r.performance
        ? <span style={{ fontWeight: 500 }}>${r.performance.spend.toFixed(2)}</span>
        : '—',
    },
    {
      title: '转化',
      key: 'conversions',
      width: 80,
      sorter: (a: any, b: any) => (a.performance?.conversions || 0) - (b.performance?.conversions || 0),
      render: (_: any, r: any) => r.performance
        ? <span style={{ color: '#52c41a', fontWeight: 500 }}>{r.performance.conversions}</span>
        : '—',
    },
    {
      title: '展示',
      key: 'impressions',
      width: 100,
      render: (_: any, r: any) => r.performance ? r.performance.impressions.toLocaleString() : '—',
    },
    {
      title: 'CTR',
      key: 'ctr',
      width: 80,
      render: (_: any, r: any) => {
        if (!r.performance?.ctr) return '—'
        const pct = r.performance.ctr * 100
        const color = pct >= 3 ? '#52c41a' : pct >= 1 ? '#faad14' : '#f5222d'
        return <span style={{ color }}>{pct.toFixed(2)}%</span>
      },
    },
    {
      title: 'CPA',
      key: 'cpa',
      width: 80,
      render: (_: any, r: any) => {
        if (!r.performance?.cpa) return '—'
        const color = r.performance.cpa <= 5 ? '#52c41a' : r.performance.cpa <= 10 ? '#faad14' : '#f5222d'
        return <span style={{ color }}>${r.performance.cpa.toFixed(2)}</span>
      },
    },
    {
      title: 'ROI',
      key: 'roi',
      width: 80,
      render: (_: any, r: any) => {
        if (r.performance?.roi === undefined || r.performance?.roi === null) return '—'
        const color = r.performance.roi >= 0 ? '#52c41a' : '#f5222d'
        return <span style={{ color, fontWeight: 600 }}>{(r.performance.roi * 100).toFixed(1)}%</span>
      },
    },
    {
      title: '广告数',
      key: 'adCount',
      width: 70,
      render: (_: any, r: any) => <Tag>{r.ads?.length || 0}</Tag>,
    },
  ]

  return (
    <div className="page-container">
      {/* 头部导航 */}
      <div style={{ marginBottom: 16 }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/campaigns')}
          style={{ padding: 0, marginBottom: 8 }}
        >
          返回广告活动
        </Button>

        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0 }}>{campaign.name}</h2>
            <Badge
              status={statusInfo.color as any}
              text={<span style={{ fontWeight: 500 }}>{statusInfo.text}</span>}
            />
          </div>
          <Space>
            <DateRangePicker
              value={dateRange}
              onChange={(dates) => { if (dates) setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs]) }}
            />
            {campaign.status === 'active' ? (
              <Tooltip title="暂停投放">
                <Button
                  icon={<PauseCircleOutlined />}
                  loading={statusMutation.isPending}
                  onClick={() => statusMutation.mutate('paused')}
                >
                  暂停
                </Button>
              </Tooltip>
            ) : campaign.status === 'paused' ? (
              <Tooltip title="恢复投放">
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={statusMutation.isPending}
                  onClick={() => statusMutation.mutate('active')}
                >
                  启用
                </Button>
              </Tooltip>
            ) : null}
            <Button icon={<SyncOutlined />} onClick={() => refetch()}>刷新</Button>
          </Space>
        </div>
      </div>

      {/* Campaign 基本信息 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions size="small" column={{ xs: 1, sm: 2, md: 4 }}>
          <Descriptions.Item label="目标">
            <Tag color="blue">{OBJECTIVE_MAP[campaign.objective] || campaign.objective}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="预算">
            ${campaign.budgetAmount?.toFixed(2)} {campaign.budgetCurrency}
            <Tag style={{ marginLeft: 4, fontSize: 11 }}>{campaign.budgetType === 'daily' ? '日预算' : '总预算'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="广告账户">{campaign.adAccountName || '—'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{dayjs(campaign.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          {campaign.startDate && (
            <Descriptions.Item label="投放周期">
              {dayjs(campaign.startDate).format('YYYY-MM-DD')}
              {campaign.endDate ? ` ~ ${dayjs(campaign.endDate).format('YYYY-MM-DD')}` : ' ~ 持续投放'}
            </Descriptions.Item>
          )}
          {campaign.metaCampaignId && (
            <Descriptions.Item label="Meta ID">{campaign.metaCampaignId}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* KPI 卡片 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} lg={3}>
          <Card size="small">
            <Statistic
              title="总花费"
              value={totals.spend}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ fontSize: 16, color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={3}>
          <Card size="small">
            <Statistic
              title="转化"
              value={totals.conversions}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ fontSize: 16, color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={3}>
          <Card size="small">
            <Statistic
              title="ROI"
              value={(totals.roi || 0) * 100}
              precision={1}
              suffix="%"
              valueStyle={{ fontSize: 16, color: (totals.roi || 0) >= 0 ? '#3f8600' : '#cf1322', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={3}>
          <Card size="small">
            <Statistic
              title="CPA"
              value={totals.cpa}
              precision={2}
              prefix="$"
              valueStyle={{ fontSize: 16, color: totals.cpa > 10 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={3}>
          <Card size="small">
            <Statistic
              title="展示"
              value={totals.impressions}
              valueStyle={{ fontSize: 16 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={3}>
          <Card size="small">
            <Statistic
              title="CTR"
              value={(totals.ctr || 0) * 100}
              precision={2}
              suffix="%"
              prefix={<RiseOutlined />}
              valueStyle={{ fontSize: 16, color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={3}>
          <Card size="small">
            <Statistic
              title="ROAS"
              value={totals.roas}
              precision={2}
              valueStyle={{ fontSize: 16 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={3}>
          <Card size="small">
            <Statistic
              title="总收入"
              value={totals.revenue || 0}
              precision={2}
              prefix="$"
              valueStyle={{ fontSize: 16, color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 每日趋势 */}
      <Card title="每日趋势" size="small" style={{ marginBottom: 16 }}>
        <div style={{ height: 300 }}>
          {trendData.length > 0 ? (
            <ResponsiveContainer>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="campSpendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1890ff" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="campConvGrad" x1="0" y1="0" x2="0" y2="1">
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
                <Area yAxisId="left" type="monotone" dataKey="spend" name="花费" stroke="#1890ff" fill="url(#campSpendGrad)" />
                <Area yAxisId="right" type="monotone" dataKey="conversions" name="转化" stroke="#52c41a" fill="url(#campConvGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Empty description="暂无趋势数据" style={{ marginTop: 80 }} />
          )}
        </div>
      </Card>

      {/* AdSet / Ad 层级表格 */}
      <Card
        title={`广告组 (${adSets?.length || 0})`}
        size="small"
        extra={
          <span style={{ color: '#999', fontSize: 12 }}>
            点击行展开查看广告明细
          </span>
        }
      >
        <Table
          columns={adSetColumns}
          dataSource={adSets || []}
          rowKey="id"
          size="middle"
          pagination={false}
          scroll={{ x: 900 }}
          expandable={{
            expandedRowRender: (adSet: any) => (
              <Table
                columns={adColumns}
                dataSource={adSet.ads || []}
                rowKey="id"
                size="small"
                pagination={false}
                locale={{ emptyText: '该广告组下无广告' }}
                style={{ margin: '0 0 0 24px' }}
              />
            ),
            rowExpandable: (record: any) => record.ads?.length > 0,
          }}
          locale={{ emptyText: '暂无广告组数据' }}
        />
      </Card>
    </div>
  )
}

export default CampaignDetail
