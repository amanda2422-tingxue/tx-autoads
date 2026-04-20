# Meta API 申请话术模板

## 申请场景说明（英文）

### ads_read 权限申请

```
Application Purpose:
AutoAds Platform is an internal advertising automation tool developed 
for our media buying team to efficiently manage Facebook ad campaigns.

Specific Use Cases for ads_read:
1. Sync campaign performance data (impressions, clicks, conversions, spend)
2. Monitor budget utilization across multiple campaigns
3. Analyze creative performance to identify top-performing ads
4. Generate daily/weekly performance reports for team review
5. Track CPA (Cost Per Acquisition) metrics for survey campaigns

Data Handling:
- All data is processed internally within our company
- No data is shared with third parties
- Data is stored securely with encryption
- We comply with Meta's Platform Terms and Data Processing Terms

Technical Implementation:
- Data is synced via background jobs every 15 minutes
- Historical data is retained for 90 days for trend analysis
- Real-time data is used for automated alerting only
```

### ads_management 权限申请

```
Application Purpose:
AutoAds Platform automates routine advertising tasks to improve 
efficiency and reduce manual errors in campaign management.

Specific Use Cases for ads_management:
1. Create new campaigns based on predefined templates
2. Pause underperforming ads when CPA exceeds threshold ($0.50)
3. Adjust campaign budgets based on performance rules
4. Duplicate top-performing ads for scaling
5. Update ad creative variations for A/B testing

Automation Rules Examples:
- IF CPA > $0.50 FOR 3 days THEN pause ad
- IF CTR < 1% FOR 2 days THEN pause ad
- IF ROAS > 2.0 THEN increase budget by 20%

Safety Measures:
- All automated actions are logged for review
- Daily budget caps prevent overspending
- Manual approval required for budget increases > 50%
- Email notifications sent for all automated actions

Data Handling:
- Changes are tracked with audit logs
- Rollback capability for all automated actions
- No automated deletion of campaigns or ads
- Human oversight for all critical decisions
```

### business_management 权限申请

```
Application Purpose:
Manage multiple ad accounts and business assets across our 
organization's Business Manager.

Specific Use Cases:
1. Access multiple ad accounts under our Business Manager
2. Manage user permissions for team members
3. Track spend across all ad accounts
4. Consolidate reporting at business level

Security:
- Access limited to verified employees only
- Role-based permissions (Admin, Analyst, Viewer)
- Regular access reviews
```

---

## 常见问题回答模板

### Q: How will you use the data?

```
We use advertising data exclusively for:
1. Internal campaign performance analysis
2. Automated optimization based on predefined rules
3. Generating reports for our media buying team
4. Budget management and allocation decisions

We do NOT:
- Share data with third parties
- Use data for purposes outside stated use cases
- Retain data longer than necessary (90-day retention)
- Access data not related to our own ad accounts
```

### Q: Who will have access to the data?

```
Data access is strictly limited to:
- Authorized employees of our company
- Role-based access (Admin, Manager, Analyst)
- All access is logged and audited
- Access revoked immediately upon employee departure

Total estimated users: 5-10 internal team members
```

### Q: What is your data retention policy?

```
- Raw API data: 90 days
- Aggregated reports: 1 year
- Audit logs: 2 years
- User can request data deletion at any time
- Automatic purging of expired data
```

### Q: How do you ensure compliance?

```
We ensure compliance through:
1. Regular review of Meta Platform Terms
2. Data protection impact assessments
3. Employee training on data handling
4. Technical safeguards (encryption, access controls)
5. Annual third-party security audits
```

---

## 视频录制脚本

### 屏幕录制内容建议（3-5分钟）

**开场（30秒）**
```
"This is a demonstration of AutoAds Platform, our internal advertising 
management tool. I'll show you how we use Meta Marketing API to 
streamline our ad operations."
```

**功能展示（3分钟）**
1. **Dashboard 展示**
   - 展示广告数据总览
   - 说明数据来源（Meta API）

2. **数据同步演示**
   - 点击"同步数据"按钮
   - 展示从 Meta API 获取的数据
   - 强调这是只读操作

3. **自动化规则展示**
   - 展示规则配置界面
   - 说明规则触发条件
   - 强调人工审核机制

4. **报告生成**
   - 生成性能报告
   - 展示数据可视化

**结尾（30秒）**
```
"As you can see, AutoAds Platform is a secure internal tool that helps 
our team manage advertising more efficiently. All data stays within 
our organization and is used solely for campaign optimization."
```

---

## 申请检查清单

提交申请前请确认：

- [ ] 应用信息完整（名称、图标、描述）
- [ ] 隐私政策页面已发布
- [ ] 服务条款页面已发布
- [ ] 使用场景说明已填写
- [ ] 屏幕录制已上传（如需要）
- [ ] 公司资质已上传
- [ ] 所有信息真实准确

---

## 审核被拒常见原因

| 原因 | 解决方案 |
|------|----------|
| 隐私政策不完整 | 添加数据使用、保留、删除条款 |
| 使用场景不清晰 | 详细说明具体功能和使用方式 |
| 缺少测试用户 | 添加测试用户并配置权限 |
| 应用未完成 | 完善应用基本设置和平台配置 |
| 业务验证失败 | 提供完整的公司资质证明 |

---

## 审核状态查询

1. 登录 [Meta for Developers](https://developers.facebook.com/)
2. 进入您的应用
3. 点击 **"应用审核"** → **"权限和功能"**
4. 查看各权限的审核状态

状态说明：
- **灰色**: 未申请
- **蓝色**: 已申请，审核中
- **绿色**: 已通过
- **红色**: 被拒绝（可查看原因并重新申请）
