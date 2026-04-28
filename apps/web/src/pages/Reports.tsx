import { useState, useEffect, useCallback } from 'react'
import {
  Button, Card, Table, Tag, Space, message, Row, Col,
  Select, Checkbox, Typography, Empty, Tooltip, Popconfirm,
  Input,
} from 'antd'
import { DownloadOutlined, SaveOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import DateRangePicker from '../components/DateRangePicker'

const { Title, Text } = Typography

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

interface SavedReport {
  id: string
  name: string
  isSystem: boolean
  description?: string
  config: {
    dimensions: string[]
    metrics: string[]
    filters?: any
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }
}

const DIM_LABELS: Record<string, string> = {
  date: '日期', campaign: '广告活动', adset: '广告组', creative: '素材',
  country: '国家', audienceTemplate: '受众模板', radarType: '广告组类型',
}

const METRIC_LABELS: Record<string, string> = {
  spend: '花费', conversions: '转化数', clicks: '点击数', impressions: '展示数',
  ctr: 'CTR', cvr: 'CVR', cpc: 'CPC', cpm: 'CPM',
  frequency: '频次', cpa: 'CPA', epc: 'EPC', roas: 'ROAS',
  revenue: '收入', roi: 'ROI',
}

export default function ReportsPage() {
  const [dimensions, setDimensions] = useState<string[]>(['date', 'country'])
  const [metrics, setMetrics] = useState<string[]>(['spend', 'conversions', 'cvr', 'cpc'])
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(6, 'day'), dayjs()])
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [sortBy, setSortBy] = useState<string>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [loading, setLoading] = useState(false)

  const [savedReports, setSavedReports] = useState<SavedReport[]>([])
  const [saveName, setSaveName] = useState('')
  const [meta, setMeta] = useState<{ dimensions: any[]; metrics: any[] } | null>(null)
  const [filterOptions, setFilterOptions] = useState<any>(null)

  // 加载元数据和已保存报表
  useEffect(() => {
    axios.get(`${API_BASE}/reports/meta`).then(r => setMeta(r.data.data))
    axios.get(`${API_BASE}/reports/filter-options`).then(r => setFilterOptions(r.data.data))
    loadSavedReports()
  }, [])

  const loadSavedReports = () => {
    axios.get(`${API_BASE}/reports/saved`).then(r => setSavedReports(r.data.data || []))
  }

  // 执行查询
  const handleQuery = useCallback(async (targetPage = 1) => {
    if (dimensions.length === 0) { message.warning('请至少选择一个维度'); return }
    if (metrics.length === 0) { message.warning('请至少选择一个指标'); return }

    // EPC/ROAS/Revenue/ROI 校验
    const countryMetrics = ['epc', 'roas', 'revenue', 'roi']
    if (metrics.some(m => countryMetrics.includes(m)) && !dimensions.includes('country')) {
      message.warning('选择 收入/ROI 相关指标时必须同时选择"国家"维度')
      return
    }

    setLoading(true)
    try {
      const res = await axios.post(`${API_BASE}/reports/query`, {
        dimensions,
        metrics,
        filters: {
          dateFrom: dateRange[0].format('YYYY-MM-DD'),
          dateTo: dateRange[1].format('YYYY-MM-DD'),
          ...filters,
        },
        sortBy,
        sortOrder,
        page: targetPage,
        limit,
      })
      setData(res.data.data || [])
      setTotal(res.data.total || 0)
      setPage(targetPage)
    } catch (err: any) {
      message.error(err.response?.data?.error || '查询失败')
    } finally {
      setLoading(false)
    }
  }, [dimensions, metrics, dateRange, filters, sortBy, sortOrder, limit])

  // 导出 CSV
  const handleExport = () => {
    const params = new URLSearchParams({
      dimensions: JSON.stringify(dimensions),
      metrics: JSON.stringify(metrics),
      filters: JSON.stringify({
        dateFrom: dateRange[0].format('YYYY-MM-DD'),
        dateTo: dateRange[1].format('YYYY-MM-DD'),
        ...filters,
      }),
      sortBy,
      sortOrder,
    })
    window.open(`${API_BASE}/reports/export?${params.toString()}`, '_blank')
  }

  // 保存报表
  const handleSave = async () => {
    if (!saveName.trim()) { message.warning('请输入报表名称'); return }
    try {
      await axios.post(`${API_BASE}/reports/saved`, {
        name: saveName.trim(),
        config: { dimensions, metrics, filters, sortBy, sortOrder },
      })
      message.success('保存成功')
      setSaveName('')
      loadSavedReports()
    } catch (err: any) {
      message.error(err.response?.data?.error || '保存失败')
    }
  }

  // 加载已保存报表
  const loadReport = (report: SavedReport) => {
    const c = report.config
    setDimensions(c.dimensions)
    setMetrics(c.metrics)
    if (c.filters?.dateFrom && c.filters?.dateTo) {
      setDateRange([dayjs(c.filters.dateFrom), dayjs(c.filters.dateTo)])
    }
    setFilters(c.filters || {})
    setSortBy(c.sortBy || 'date')
    setSortOrder(c.sortOrder || 'desc')
    message.success(`已加载「${report.name}」`)
    // 延迟查询，等状态更新
    setTimeout(() => handleQuery(1), 100)
  }

  // 删除自定义报表
  const deleteReport = async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/reports/saved/${id}`)
      message.success('删除成功')
      loadSavedReports()
    } catch (err: any) {
      message.error(err.response?.data?.error || '删除失败')
    }
  }

  // 构建表格列
  const columns = [
    ...dimensions.map(d => ({
      title: DIM_LABELS[d] || d,
      dataIndex: d === 'campaign' ? 'campaign_name'
        : d === 'adset' ? 'adset_name'
        : d === 'creative' ? 'creative_name'
        : d,
      key: d,
      fixed: d === 'date' ? ('left' as const) : undefined,
      render: (val: any, record: any) => {
        if (d === 'creative' && record.creative_file_url) {
          return (
            <Space>
              {val || '未命名'}
              <a href={record.creative_file_url} target="_blank" rel="noreferrer">预览</a>
            </Space>
          )
        }
        if (d === 'date' && val) return dayjs(val).format('MM-DD')
        return val || '-'
      },
    })),
    ...metrics.map(m => ({
      title: METRIC_LABELS[m] || m,
      dataIndex: m,
      key: m,
      align: 'right' as const,
      render: (val: any) => {
        if (val === null || val === undefined) return '-'
        if (m === 'roas' || m === 'roi') {
          const color = val >= (m === 'roas' ? 100 : 0) ? '#52c41a' : '#f5222d'
          return <span style={{ color, fontWeight: 600 }}>{val}%</span>
        }
        if (['spend', 'cpc', 'cpm', 'cpa', 'epc', 'revenue'].includes(m)) {
          return `$${Number(val).toFixed(2)}`
        }
        if (['ctr', 'cvr'].includes(m)) return `${val}%`
        return Number(val).toLocaleString()
      },
    })),
  ]

  const availableDims = meta?.dimensions || []
  const availableMetrics = meta?.metrics || []

  return (
    <div>

      <Row gutter={[16, 16]}>
        {/* 左侧：已保存报表 */}
        <Col span={5}>
          <Card title="报表模板" size="small" bodyStyle={{ padding: 12 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {savedReports.map(r => (
                <div key={r.id} style={{
                  padding: '8px 10px', borderRadius: 6,
                  background: r.isSystem ? '#f0f9ff' : '#f6ffed',
                  border: '1px solid ' + (r.isSystem ? '#bae0ff' : '#b7eb8f'),
                  cursor: 'pointer',
                }} onClick={() => loadReport(r)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ fontSize: 13 }}>{r.name}</Text>
                    {!r.isSystem && (
                      <Popconfirm title="确定删除？" onConfirm={(e) => { e?.stopPropagation(); deleteReport(r.id) }}>
                        <DeleteOutlined style={{ color: '#999', fontSize: 12 }} onClick={e => e.stopPropagation()} />
                      </Popconfirm>
                    )}
                  </div>
                  {r.description && <Text type="secondary" style={{ fontSize: 11 }}>{r.description}</Text>}
                </div>
              ))}
              {savedReports.length === 0 && (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无报表" />
              )}
            </Space>
          </Card>
        </Col>

        {/* 右侧：查询配置 + 结果 */}
        <Col span={19}>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 12]}>
              <Col span={24}>
                <Text type="secondary" style={{ fontSize: 12 }}>维度（GROUP BY）：</Text>
                <Checkbox.Group
                  options={availableDims.map(d => ({ label: d.label, value: d.key }))}
                  value={dimensions}
                  onChange={(v: any[]) => setDimensions(v)}
                  style={{ marginLeft: 8 }}
                />
              </Col>
              <Col span={24}>
                <Text type="secondary" style={{ fontSize: 12 }}>指标：</Text>
                <Checkbox.Group
                  options={availableMetrics.map(m => ({
                    label: m.requiresDimension
                      ? <Tooltip title={`需包含「${DIM_LABELS[m.requiresDimension]}」维度`}>{m.label}</Tooltip>
                      : m.label,
                    value: m.key,
                    disabled: m.requiresDimension ? !dimensions.includes(m.requiresDimension) : false,
                  }))}
                  value={metrics}
                  onChange={(v: any[]) => setMetrics(v)}
                  style={{ marginLeft: 8 }}
                />
              </Col>
              <Col span={8}>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              </Col>
              <Col span={16}>
                <Space wrap>
                  <Select
                    mode="multiple"
                    placeholder="过滤国家"
                    style={{ width: 150 }}
                    allowClear
                    value={filters.countryCodes}
                    onChange={v => setFilters({ ...filters, countryCodes: v })}
                    options={filterOptions?.countries}
                  />
                  <Select
                    mode="multiple"
                    placeholder="过滤广告活动"
                    style={{ width: 180 }}
                    allowClear
                    value={filters.campaignIds}
                    onChange={v => setFilters({ ...filters, campaignIds: v })}
                    options={filterOptions?.campaigns}
                    maxTagCount="responsive"
                  />
                  <Select
                    mode="multiple"
                    placeholder="过滤素材"
                    style={{ width: 150 }}
                    allowClear
                    value={filters.creativeIds}
                    onChange={v => setFilters({ ...filters, creativeIds: v })}
                    options={filterOptions?.creatives}
                    maxTagCount="responsive"
                  />
                  <Select
                    placeholder="排序字段"
                    value={sortBy}
                    onChange={setSortBy}
                    style={{ width: 140 }}
                    options={[...dimensions, ...metrics].map(k => ({
                      label: DIM_LABELS[k] || METRIC_LABELS[k] || k,
                      value: k,
                    }))}
                  />
                  <Select
                    value={sortOrder}
                    onChange={setSortOrder}
                    style={{ width: 100 }}
                    options={[{ label: '降序', value: 'desc' }, { label: '升序', value: 'asc' }]}
                  />
                  <Button type="primary" icon={<ReloadOutlined />} onClick={() => handleQuery(1)} loading={loading}>查询</Button>
                  <Button icon={<DownloadOutlined />} onClick={handleExport}>导出 CSV</Button>
                </Space>
              </Col>
            </Row>

            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>保存当前配置：</Text>
              <Input
                placeholder="报表名称"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                style={{ width: 200 }}
                onPressEnter={handleSave}
              />
              <Button icon={<SaveOutlined />} size="small" onClick={handleSave}>保存</Button>
            </div>
          </Card>

          <Table
            columns={columns}
            dataSource={data.map((d, i) => ({ ...d, key: i }))}
            loading={loading}
            pagination={{
              current: page,
              pageSize: limit,
              total,
              showSizeChanger: false,
              showTotal: t => `共 ${t} 条`,
              onChange: p => handleQuery(p),
            }}
            scroll={{ x: 'max-content' }}
            size="small"
            locale={{ emptyText: <Empty description="请选择维度/指标并点击查询" /> }}
          />
        </Col>
      </Row>
    </div>
  )
}
