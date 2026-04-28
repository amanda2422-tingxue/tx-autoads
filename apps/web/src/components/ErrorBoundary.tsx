import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Result, Button, Typography } from 'antd'

const { Paragraph, Text } = Typography

interface Props {
  children?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          height: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#f0f2f5',
          padding: '20px'
        }}>
          <Result
            status="error"
            title="页面出错了"
            subTitle="非常抱歉，应用程序遇到了一个意外错误。请尝试刷新页面或联系技术支持。"
            extra={[
              <Button type="primary" key="reload" onClick={this.handleReload}>
                刷新页面
              </Button>,
              <Button key="home" onClick={() => window.location.href = '/'}>
                返回首页
              </Button>,
            ]}
          >
            <div className="desc">
              <Paragraph>
                <Text strong style={{ fontSize: 16 }}>
                  错误详情：
                </Text>
              </Paragraph>
              <Paragraph copyable>
                <Text type="danger">{this.state.error?.toString()}</Text>
              </Paragraph>
              {(import.meta.env.DEV) && this.state.errorInfo && (
                <pre style={{ 
                  maxHeight: '300px', 
                  overflow: 'auto', 
                  background: '#fff', 
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #d9d9d9',
                  textAlign: 'left'
                }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
          </Result>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
