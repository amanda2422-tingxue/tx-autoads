import React from 'react'
import { Card, Form, Input, Button, Space, Divider, Select, Switch } from 'antd'
import { SaveOutlined, ApiOutlined } from '@ant-design/icons'

const { Option } = Select

const Settings: React.FC = () => {
  const [form] = Form.useForm()

  const onFinish = (values: any) => {
    console.log('Settings saved:', values)
  }

  return (
    <div className="page-container">
      <h2 style={{ marginBottom: 24 }}>设置</h2>

      <Card title="Meta API 配置" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="metaAppId"
            label="App ID"
            rules={[{ required: true, message: '请输入 App ID' }]}
          >
            <Input placeholder="输入 Meta App ID" prefix={<ApiOutlined />} />
          </Form.Item>

          <Form.Item
            name="metaAppSecret"
            label="App Secret"
            rules={[{ required: true, message: '请输入 App Secret' }]}
          >
            <Input.Password placeholder="输入 Meta App Secret" />
          </Form.Item>

          <Form.Item
            name="metaAccessToken"
            label="Access Token"
            rules={[{ required: true, message: '请输入 Access Token' }]}
          >
            <Input.TextArea rows={3} placeholder="输入 Meta Access Token" />
          </Form.Item>

          <Form.Item
            name="metaAdAccountId"
            label="广告账户 ID"
            rules={[{ required: true, message: '请输入广告账户 ID' }]}
          >
            <Input placeholder="输入广告账户 ID，如 act_123456789" />
          </Form.Item>

          <Divider />

          <Form.Item label="数据同步">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item name="enableSync" valuePropName="checked" noStyle>
                <Switch />
              </Form.Item>
              <span> 启用自动数据同步</span>
            </Space>
          </Form.Item>

          <Form.Item name="syncInterval" label="同步间隔（分钟）">
            <Select style={{ width: 200 }}>
              <Option value={5}>5 分钟</Option>
              <Option value={15}>15 分钟</Option>
              <Option value={30}>30 分钟</Option>
              <Option value={60}>1 小时</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default Settings
