import { Layout, Typography, Card, Divider, Space } from 'antd'
import { SafetyOutlined } from '@ant-design/icons'

const { Header, Content, Footer } = Layout
const { Title, Text, Paragraph } = Typography

function Privacy() {
  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Top Header Bar */}
      <Header
        style={{
          background: '#fff',
          borderBottom: '1px solid #e8e8e8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 64,
          padding: '0 24px',
        }}
      >
        <Space>
          <SafetyOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Text strong style={{ fontSize: 18 }}>
            AutoAds Platform
          </Text>
          <Divider type="vertical" style={{ height: 24 }} />
          <Text style={{ fontSize: 16 }}>
            隐私政策 / Privacy Policy
          </Text>
        </Space>
      </Header>

      {/* Main Content */}
      <Content style={{ padding: '40px 24px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Typography>
            {/* 生效日期 / Effective Date */}
            <Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: 32 }}>
              <Text strong>生效日期 / Effective Date:</Text>{' '}
              2026年4月20日 / April 20, 2026
            </Paragraph>

            <Divider />

            {/* 1. 引言 / Introduction */}
            <Title level={4}>1. 引言 / Introduction</Title>
            <Paragraph>
              本隐私政策说明 AutoAds Platform（"我们"、"本平台"）如何收集、使用和保护您的个人信息。
            </Paragraph>
            <Paragraph type="secondary">
              This Privacy Policy explains how AutoAds Platform ("we", "the Platform") collects, uses, and protects your personal information.
            </Paragraph>

            <Divider />

            {/* 2. 信息收集 / Information Collection */}
            <Title level={4}>2. 信息收集 / Information Collection</Title>

            <Title level={5}>2.1 我们收集的信息 / Information We Collect</Title>
            <Paragraph>
              <ul>
                <li>
                  <Text strong>账户信息 / Account Information:</Text> Facebook 广告账户 ID、商务管理平台信息 / Facebook Ad Account ID, Business Manager information
                </li>
                <li>
                  <Text strong>广告数据 / Ad Data:</Text> 广告活动、广告组、广告的投放数据 / Campaign, ad set, and ad performance data
                </li>
                <li>
                  <Text strong>使用数据 / Usage Data:</Text> 您在本平台的操作记录 / Your operation records on this platform
                </li>
              </ul>
            </Paragraph>

            <Title level={5}>2.2 信息来源 / Information Sources</Title>
            <Paragraph>
              <ul>
                <li>
                  <Text strong>Meta Marketing API:</Text> 通过授权获取您的 Facebook 广告数据 / Obtained through authorized access to your Facebook advertising data
                </li>
                <li>
                  <Text strong>直接提供 / Directly Provided:</Text> 您在使用本平台时主动输入的信息 / Information you actively enter while using this platform
                </li>
              </ul>
            </Paragraph>

            <Divider />

            {/* 3. 信息使用 / Information Use */}
            <Title level={4}>3. 信息使用 / Information Use</Title>
            <Paragraph>
              我们使用收集的信息用于：
            </Paragraph>
            <Paragraph type="secondary">
              We use the collected information to:
            </Paragraph>
            <Paragraph>
              <ul>
                <li>提供广告自动化管理服务 / Provide advertising automation management services</li>
                <li>生成广告投放分析报告 / Generate advertising performance analysis reports</li>
                <li>优化广告投放策略 / Optimize advertising placement strategies</li>
                <li>改进平台功能和服务 / Improve platform features and services</li>
              </ul>
            </Paragraph>

            <Divider />

            {/* 4. 信息共享 / Information Sharing */}
            <Title level={4}>4. 信息共享 / Information Sharing</Title>
            <Paragraph>
              <Text strong style={{ color: '#cf1322' }}>
                我们不会出售您的数据给第三方。 / We do not sell your data to third parties.
              </Text>
            </Paragraph>
            <Paragraph>
              仅在以下情况下共享信息：
            </Paragraph>
            <Paragraph type="secondary">
              We only share information in the following circumstances:
            </Paragraph>
            <Paragraph>
              <ul>
                <li>经您明确同意 / With your explicit consent</li>
                <li>法律法规要求 / As required by laws and regulations</li>
                <li>保护我们的合法权益 / To protect our legitimate rights and interests</li>
              </ul>
            </Paragraph>

            <Divider />

            {/* 5. 数据安全 / Data Security */}
            <Title level={4}>5. 数据安全 / Data Security</Title>
            <Paragraph>
              我们采取以下措施保护您的数据：
            </Paragraph>
            <Paragraph type="secondary">
              We take the following measures to protect your data:
            </Paragraph>
            <Paragraph>
              <ul>
                <li>加密存储敏感信息 / Encrypt sensitive information in storage</li>
                <li>限制数据访问权限 / Restrict data access permissions</li>
                <li>定期安全审计 / Conduct regular security audits</li>
                <li>遵守 Meta 平台数据使用政策 / Comply with Meta Platform Data Use Policies</li>
              </ul>
            </Paragraph>

            <Divider />

            {/* 6. 用户权利 / Your Rights */}
            <Title level={4}>6. 用户权利 / Your Rights</Title>
            <Paragraph>
              您有权：
            </Paragraph>
            <Paragraph type="secondary">
              You have the right to:
            </Paragraph>
            <Paragraph>
              <ul>
                <li>查看您的数据 / Access your data</li>
                <li>更正不准确的信息 / Correct inaccurate information</li>
                <li>删除您的账户和数据 / Delete your account and data</li>
                <li>撤销 API 授权 / Revoke API authorization</li>
              </ul>
            </Paragraph>

            <Divider />

            {/* 7. 联系我们 / Contact Us */}
            <Title level={4}>7. 联系我们 / Contact Us</Title>
            <Paragraph>
              如有隐私相关问题，请联系：
            </Paragraph>
            <Paragraph type="secondary">
              If you have any privacy-related questions, please contact:
            </Paragraph>
            <Paragraph>
              <ul>
                <li>
                  邮箱 / Email:{" "}
                  <a href="mailto:privacy@zeydoo.com">privacy@zeydoo.com</a>
                </li>
              </ul>
            </Paragraph>

            <Divider />

            {/* 8. 政策更新 / Policy Updates */}
            <Title level={4}>8. 政策更新 / Policy Updates</Title>
            <Paragraph>
              我们可能不时更新本政策，更新后将通过平台通知您。
            </Paragraph>
            <Paragraph type="secondary">
              We may update this policy from time to time, and you will be notified through the platform after any updates.
            </Paragraph>
          </Typography>
        </Card>
      </Content>

      {/* Footer */}
      <Footer style={{ textAlign: 'center', background: '#fff', borderTop: '1px solid #e8e8e8' }}>
        <Text type="secondary">
          AutoAds Platform &copy; {new Date().getFullYear()} |{" "}
          <a href="mailto:privacy@zeydoo.com">privacy@zeydoo.com</a>
        </Text>
      </Footer>
    </Layout>
  )
}

export default Privacy
