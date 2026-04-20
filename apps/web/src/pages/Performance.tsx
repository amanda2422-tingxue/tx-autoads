import React from 'react'
import { Card, Row, Col, Table, DatePicker, Space } from 'antd'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

const trendData = [
  { date: '4/14', spend: 120, impressions: 45000, clicks: 980 },
  { date: '4/15', spend: 145, impressions: 52000, clicks: 1150 },
  { date: '4/16', spend: 138, impressions: 48000, clicks: 1080 },
  { date: '4/17', spend: 165, impressions: 61000, clicks: 1320 },
  { date: '4/18', spend: 152, impressions: 55000, clicks: 1200 },
  { date: '4/19', spend: 178, impressions: 68000, clicks: 1480 },
  { date: '4/20', spend: 195, impressions: 72000, clicks: 1620 },
]

const Performance: React.FC = () => {
  return (
    <div className="page-container">
      <div className="card-header">
        <h2 style={{ margin: 0 }}>数据分析</h2>
        <RangePicker defaultValue={[dayjs().subtract(7, 'day'), dayjs()]} />
      </div>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="花费趋势">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1890ff" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="spend"
                  stroke="#1890ff"
                  fillOpacity={1}
                  fill="url(#colorSpend)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="展示 vs 点击">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="impressions" fill="#1890ff" name="展示" radius={[4, 4, 0, 0]} />
                <Bar dataKey="clicks" fill="#52c41a" name="点击" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Performance
