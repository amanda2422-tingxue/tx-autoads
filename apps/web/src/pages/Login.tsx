/**
 * 登录页 + 系统初始化（首次注册管理员）
 */
import React, { useState, useEffect } from 'react'
import { Form, Input, Button, Card, Typography, Space, message, Divider, Select } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined, TeamOutlined } from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'
import { authApi } from '../utils/api/auth'
import { useNavigate } from 'react-router-dom'

const { Title, Text, Paragraph } = Typography
const { Option } = Select

const Login: React.FC = () => {
  const { login, initialized, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'init'>('login')
  const [form] = Form.useForm()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    if (!initialized) {
      setMode('init')
    }
  }, [initialized])

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const success = await login(values.username, values.password)
      if (success) {
        navigate('/', { replace: true })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleInit = async (values: any) => {
    setLoading(true)
    try {
      await authApi.register({
        username: values.username,
        email: values.email,
        password: values.password,
        displayName: values.displayName,
      })
      message.success('管理员账户创建成功，请登录')
      setMode('login')
      form.setFieldsValue({ username: values.username, password: values.password })
    } catch (err: any) {
      message.error(err.response?.data?.error || err.error || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card
        style={{
          width: 420,
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        bodyStyle={{ padding: '40px 32px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ margin: 0, color: '#1a1a2e' }}>
            AutoAds Platform
          </Title>
          <Text type="secondary">
            {mode === 'init' ? '系统初始化 — 创建管理员账户' : 'Facebook 广告自动化管理系统'}
          </Text>
        </div>

        {mode === 'init' ? (
          <Form form={form} onFinish={handleInit} layout="vertical" size="large">
            <Paragraph type="warning" style={{ textAlign: 'center', marginBottom: 24 }}>
              首次使用，请创建第一个管理员账户
            </Paragraph>
            <Form.Item name="displayName" rules={[{ required: true, message: '请输入显示名称' }]}>
              <Input prefix={<TeamOutlined />} placeholder="显示名称（如：张三）" />
            </Form.Item>
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名（用于登录）" />
            </Form.Item>
            <Form.Item name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
              <Input prefix={<MailOutlined />} placeholder="邮箱地址" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, min: 6, message: '密码至少 6 位' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="设置密码" />
            </Form.Item>
            <Form.Item name="confirmPassword" dependencies={['password']} rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次密码不一致'));
                },
              }),
            ]}>
              <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading} size="large">
                创建管理员账户
              </Button>
            </Form.Item>
          </Form>
        ) : (
          <Form form={form} onFinish={handleLogin} layout="vertical" size="large">
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名或邮箱' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名或邮箱" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading} size="large">
                登 录
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  )
}

export default Login
