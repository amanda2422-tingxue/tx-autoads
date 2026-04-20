# Meta Marketing API 申请详细指南

## 概述

本指南将帮助您申请 Meta Marketing API 权限，用于 AutoAds 平台与 Facebook 广告系统的对接。

**预计时间**: 3-14 天（取决于审核速度）  
**申请难度**: 中等（需要准备业务说明材料）

---

## 前置条件

在开始申请前，请确保您已准备好：

- [ ] Facebook 个人账号（需实名认证）
- [ ] 公司营业执照（企业申请）或身份证（个人申请）
- [ ] 一个已创建的 Facebook 商务管理平台（BM）
- [ ] 至少一个活跃的广告账户

---

## 第一步：创建 Meta 开发者账号

### 1.1 注册开发者账号

1. 访问 [Meta for Developers](https://developers.facebook.com/)
2. 点击右上角 **"Get Started"** 或 **"我的应用"**
3. 使用您的 Facebook 账号登录
4. 接受开发者条款

### 1.2 验证身份

1. 进入 [开发者设置](https://developers.facebook.com/settings/profile/)
2. 点击 **"验证身份"**
3. 选择验证方式：
   - **企业**: 上传营业执照
   - **个人**: 上传身份证
4. 等待审核（通常 1-3 个工作日）

> **提示**: 身份验证是申请 API 权限的必要条件，建议尽早完成。

---

## 第二步：创建 Facebook 商务管理平台

### 2.1 创建 BM

1. 访问 [Business Manager](https://business.facebook.com/)
2. 点击 **"创建账户"**
3. 填写信息：
   - 企业名称：您的公司名称
   - 您的姓名：真实姓名
   - 企业邮箱：公司邮箱
4. 完成创建

### 2.2 添加广告账户

1. 进入 BM 设置
2. 选择 **"广告账户"** → **"添加广告账户"**
3. 选择以下方式之一：
   - **申请新的广告账户**（推荐）
   - **添加已有广告账户**（需要账户 ID）
4. 完成账户设置

---

## 第三步：创建 Meta 应用

### 3.1 创建应用

1. 访问 [Meta App Dashboard](https://developers.facebook.com/apps/)
2. 点击 **"创建应用"**
3. 选择应用类型：**"商务"**
4. 填写应用信息：
   - **显示名称**: `AutoAds Platform`
   - **应用联系邮箱**: 您的邮箱
   - **业务账户**: 选择刚创建的 BM
5. 点击 **"创建应用"**

### 3.2 添加 Marketing API 产品

1. 在应用仪表板中，找到 **"添加产品"**
2. 找到 **Marketing API**，点击 **"设置"**
3. 系统会自动添加该产品到您的应用

---

## 第四步：配置应用设置

### 4.1 基本设置

1. 左侧菜单选择 **"设置"** → **"基本"**
2. 填写以下信息：
   - **应用域名**: 您的平台域名（如 `autoads.yourcompany.com`）
   - **隐私政策网址**: `https://yourdomain.com/privacy`
   - **服务条款网址**: `https://yourdomain.com/terms`
   - **应用图标**: 上传 1024x1024 的 PNG 图标
   - **类别**: 选择 **"广告与营销"**

> **注意**: 如果没有现成的隐私政策页面，可以先创建一个简单的占位页面。

### 4.2 添加平台

1. 在基本设置页面，滚动到 **"平台"** 部分
2. 点击 **"添加平台"**
3. 选择 **"网站"**
4. 填写网站 URL: `https://yourdomain.com`

---

## 第五步：申请 API 权限

这是最关键的一步，需要申请以下权限：

### 5.1 必需权限列表

| 权限 | 用途 | 重要性 |
|------|------|--------|
| `ads_read` | 读取广告数据 | ⭐⭐⭐ 必需 |
| `ads_management` | 管理广告（创建/修改/暂停） | ⭐⭐⭐ 必需 |
| `business_management` | 管理商务平台 | ⭐⭐ 推荐 |
| `pages_read_engagement` | 读取主页互动数据 | ⭐⭐ 推荐 |

### 5.2 申请步骤

1. 在应用仪表板，点击 **"应用审核"** → **"权限和功能"**
2. 找到 `ads_read`，点击 **"申请高级访问权限"**
3. 填写申请表格：

#### 申请表格填写指南

**使用场景说明**（英文填写）：

```
Our application, AutoAds Platform, is an automated advertising management 
system designed for internal media buying teams. The platform helps our 
team:

1. Automatically sync advertising performance data from Meta Ads
2. Create and manage ad campaigns, ad sets, and ads through API
3. Implement automated optimization rules based on performance metrics
4. Generate performance reports and insights

The ads_read permission is required to:
- Retrieve campaign performance metrics (impressions, clicks, conversions)
- Monitor ad spend and budget utilization
- Analyze creative performance for optimization decisions

The ads_management permission is required to:
- Create new campaigns and ads based on predefined templates
- Pause underperforming ads automatically
- Adjust budgets based on performance rules
- Update ad creative variations for A/B testing

All data is used internally within our company and is not shared with 
third parties. We comply with Meta Platform Terms and Data Processing 
Terms.
```

**上传材料**：
- 屏幕录制：展示应用界面（如已有）
- 业务流程图：说明数据流向
- 公司资质：营业执照扫描件

### 5.3 重复申请其他权限

对 `ads_management`、`business_management` 等权限重复上述步骤。

---

## 第六步：配置测试环境

在等待审核期间，可以配置测试环境：

### 6.1 添加测试用户

1. 应用仪表板 → **"角色"** → **"测试用户"**
2. 点击 **"添加测试用户"**
3. 创建测试用户并分配广告账户权限

### 6.2 获取测试访问令牌

1. 应用仪表板 → **"营销 API"** → **"工具"**
2. 选择 **Access Token Generator**
3. 选择您的广告账户
4. 生成测试 Token（有效期 1 小时）
5. 或使用 Graph API Explorer 生成长期 Token

---

## 第七步：验证 API 连接

### 7.1 测试 API 调用

使用生成的 Token 测试 API：

```bash
# 获取广告账户信息
curl -G \
  -d "access_token=YOUR_ACCESS_TOKEN" \
  "https://graph.facebook.com/v18.0/me/adaccounts"

# 获取广告活动列表
curl -G \
  -d "access_token=YOUR_ACCESS_TOKEN" \
  -d "fields=id,name,status" \
  "https://graph.facebook.com/v18.0/act_YOUR_AD_ACCOUNT_ID/campaigns"
```

### 7.2 常见问题

| 问题 | 解决方案 |
|------|----------|
| "Invalid Token" | Token 已过期，重新生成 |
| "Permission Denied" | 权限未批准，检查权限申请状态 |
| "Rate Limit" | 降低请求频率，实现重试机制 |
| "Account ID Not Found" | 检查账户 ID 格式（需加 `act_` 前缀）|

---

## 第八步：生产环境配置

### 8.1 获取长期访问令牌

测试 Token 只有 1 小时有效期，生产环境需要长期 Token：

```bash
# 1. 获取短期 Token（从开发者工具）
SHORT_LIVED_TOKEN="your_short_token"

# 2. 交换长期 Token
curl -X GET \
  "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=$SHORT_LIVED_TOKEN"
```

### 8.2 存储访问令牌

将 Token 安全存储在环境变量中：

```bash
# .env 文件
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_ACCESS_TOKEN=your_long_lived_token
META_AD_ACCOUNT_ID=act_123456789
```

---

## 申请时间线参考

| 阶段 | 预计时间 | 状态检查 |
|------|----------|----------|
| 身份验证 | 1-3 天 | 开发者设置页面 |
| 应用创建 | 即时 | 应用仪表板 |
| ads_read 审核 | 1-3 天 | 应用审核页面 |
| ads_management 审核 | 3-7 天 | 应用审核页面 |
| 全部完成 | 7-14 天 | - |

---

## 重要注意事项

### ⚠️ 合规要求

1. **隐私政策**: 必须有完整的隐私政策页面
2. **数据使用**: 不得将 Meta 数据用于未声明的用途
3. **用户授权**: 需要用户明确授权才能访问其数据
4. **定期审核**: Meta 会定期审核应用合规性

### ⚠️ 技术限制

1. **API 速率限制**:
   - 读取: 200 次/小时/用户
   - 写入: 100 次/小时/用户
2. **数据保留**: 建议本地缓存数据，减少 API 调用
3. **错误处理**: 必须实现完善的错误处理和重试机制

---

## 下一步

完成 API 申请后，您可以：

1. **配置后端 API** - 创建 Express 路由与 Meta API 对接
2. **实现数据同步** - 定时任务同步广告数据到本地数据库
3. **开发自动化功能** - 实现规则引擎自动优化广告

如需帮助，请参考：
- [Meta Marketing API 官方文档](https://developers.facebook.com/docs/marketing-api/)
- [Graph API 参考](https://developers.facebook.com/docs/graph-api/)
- [错误代码说明](https://developers.facebook.com/docs/marketing-api/error-reference/)
