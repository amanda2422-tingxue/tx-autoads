# AutoAds Platform - 产品需求文档 (PRD)

**文档版本**: V4.3  
**更新日期**: 2026-04-28  
**编写者**: QoderWork  
**保密级别**: 内部机密

---

## 版本历史

| 版本 | 日期 | 变更说明 | 作者 |
|------|------|----------|------|
| V1.0 | 2026-04-15 | 初始版本，定义 MVP 功能范围 | — |
| V2.0 | 2026-04-18 | 参考 Smartly.io 架构重构，增加国家雷达、文案迭代、头部素材模块 | — |
| V3.0 | 2026-04-21 | **重大更新**：完成批量广告创建向导重构、Meta API 推送全链路打通、CBO/ABO 预算策略、粉丝页授权、受众预置模板、文案库双列选择 | QoderWork |
| V4.0 | 2026-04-23 | M3 数据看板 Meta Insights 真实数据同步上线、CountryBenchmark 国家基准表上线、M4 规则引擎框架搭建 | QoderWork |
| V4.1 | 2026-04-24 | **M4 规则引擎核心上线**：R1 低ROI/零转化自动关停、R2 单日消耗超限自动关停；EPC/盈利比指标体系；自动发现目标机制；Cron 同步→规则链式执行 | QoderWork |
| V4.2 | 2026-04-27 | **Meta API 凭据个人化改造**：全局 `.env` Token → 用户级 `MetaCredential` 模型（AES-256 加密）；`resolveCredentialConfig()` 凭据调度引擎按 Campaign ownerId 分发凭据；`/api/meta-credentials` 个人凭据 CRUD + Token 验证；Meta 路由端点迁移至个人凭据；审计日志集成 | QoderWork |
| V4.3 | 2026-04-28 | **运行时稳定性固化**：修复 `createCampaignStructure` 函数 `req` 作用域越界（ownerId 参数化）；Campaign/Creative 接口属性补全（owner, pushStatus, metaPushError）；清除 `isMetaConfigured()` / `inspectGlobalToken()` 死代码；修复前端硬编码 `localhost:3001` 地址（统一相对路径 + JWT header）；创建 `vite-env.d.ts` 类型声明；移除 Ant Design 5.x 不兼容属性 | QoderWork |

---

## 目录

1. [产品概述](#1-产品概述)
2. [系统架构](#2-系统架构)
3. [用户画像与故事](#3-用户画像与故事)
4. [功能模块总览](#4-功能模块总览)
5. [M1 素材库 (Creative Library)](#5-m1-素材库)
6. [M2 广告搭建引擎 (Campaign Builder)](#6-m2-广告搭建引擎)
7. [M3 数据看板 (Analytics Dashboard)](#7-m3-数据看板)
8. [M4 自动化规则引擎 (Rule Engine)](#8-m4-自动化规则引擎)
9. [M5 素材文案迭代 (Copy Iteration)](#9-m5-素材文案迭代)
10. [M6 头部素材自动迭代 (Top Creative Auto-Iteration)](#10-m6-头部素材自动迭代)
11. [M7 国家雷达监测组 (Country Radar)](#11-m7-国家雷达监测组)
12. [Meta Marketing API 集成](#12-meta-marketing-api-集成)
13. [数据库设计](#13-数据库设计)
14. [API 接口规范](#14-api-接口规范)
15. [前端设计规范](#15-前端设计规范)
16. [安全与合规](#16-安全与合规)
17. [开发路线图](#17-开发路线图)
18. [附录：已完成 vs 待完成清单](#18-附录已完成-vs-待完成清单)

---

## 1. 产品概述

### 1.1 产品定位

AutoAds 是一款面向 Facebook/Meta 广告投放团队的**自动化广告管理平台**，灵感来源于 Smartly.io 的模板化自动化架构。核心目标是通过系统化的素材管理、批量广告搭建、数据驱动的自动化规则，帮助投放团队降低重复劳动、提升广告效率、规模化测试和迭代。

### 1.2 核心价值主张

- **批量搭建效率提升 10x**：一次配置，自动生成数百个广告组合（素材 × 国家 × 文案）
- **数据驱动的自动优化**：基于 CPA、CTR、转化率等指标的自动化规则，7×24 小时执行
- **素材生命周期管理**：从上传、评分、测试、迭代到归档的完整闭环
- **国家维度精细化运营**：监测组 → 跑量组的自动扩量漏斗

### 1.3 目标用户

- **主要用户**：Facebook 广告投放专员/经理（负责 5-50 个国家、数百个 Campaign 的日常管理）
- **次要用户**：创意设计师（上传素材、查看表现反馈）、团队负责人（数据看板、规则审核）

### 1.4 竞品参考

| 维度 | Smartly.io | Revealbot | AutoAds（我们） |
|------|-----------|-----------|----------------|
| 批量创建 | 模板驱动，Feed 自动化 | 规则驱动 | **向导式 4 步批量创建** + 预置模板 |
| 预算策略 | CBO/ABO 全自动 | 规则调整 | **CBO/ABO 手动配置** + 自动规则 |
| 素材迭代 | 预测性预算分配 | 无 | **评分 + 自动衍生**（规划中） |
| 定价 | $300+/月 | $99+/月 | **自托管，按使用量** |
| 部署 | SaaS | SaaS | **私有化部署** |

---

## 2. 系统架构

### 2.1 技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 前端 | React 18 + TypeScript + Vite 5 | 函数组件 + Hooks |
| UI 组件库 | Ant Design 5 | 企业级组件 |
| 状态管理 | TanStack Query + React State | 服务端状态 + 本地状态 |
| 后端 | Node.js + Express + TypeScript | RESTful API |
| 数据库 | PostgreSQL 14 + Prisma ORM | 关系型数据 |
| 任务调度 | node-cron | 定时任务 |
| 外部 API | Meta Marketing API v21.0 | Facebook 广告管理 |
| 部署 | Docker（规划中） | 容器化 |

### 2.2 项目结构（Monorepo）

```
autoads-platform/
├── apps/
│   ├── web/                 # React 前端（localhost:3000）
│   │   ├── src/pages/       # 6 个页面组件
│   │   ├── src/utils/api/   # API 调用封装
│   │   └── vite.config.ts   # Vite + 代理配置
│   └── api/                 # Express 后端（localhost:3001）
│       ├── src/routes/      # REST API 路由
│       ├── src/services/    # 业务逻辑服务
│       ├── src/jobs/        # 定时任务
│       └── .env             # 环境变量配置
├── packages/
│   ├── database/            # Prisma Schema + 迁移
│   └── shared/              # 共享类型/工具
├── docs/                    # 文档（PRD、进度、隐私政策等）
└── scripts/                 # 部署/数据脚本
```

### 2.3 部署架构

```
[浏览器] ←──→ [Nginx / Vite DevServer] ←──→ [Express API]
                                              ↓
                                         [PostgreSQL]
                                              ↓
                                    [Meta Marketing API v21.0]
```

---

## 3. 用户画像与故事

### 3.1 用户画像：投放专员 Alex

- **年龄**：28 岁
- **角色**：Facebook 广告投放专员
- **日常工作**：管理 30 个国家的问卷调研广告，每天需要创建 50-100 个新广告组合
- **痛点**：
  - 手动在 Facebook Ads Manager 中逐个创建 Campaign 极其耗时
  - 无法快速测试同一素材在不同国家的表现
  - 优质素材发现后，手动复制修改容易出错
  - 不同国家的文案需要分别维护，容易搞混

### 3.2 核心用户故事

**US-1：批量创建广告**
> 作为 Alex，我希望选择 10 个素材 + 5 个国家 + 1 套文案，一键生成 50 个广告，省去手动创建的重复劳动。

**US-2：自动化规则**
> 作为 Alex，我希望设置规则：当某个 Campaign 的 CPA > $0.30 持续 3 小时时，自动暂停并通知我。

**US-3：素材评分与迭代**
> 作为 Alex，我希望系统自动给素材打分，并自动为高分素材生成变体文案进行 A/B 测试。

**US-4：国家维度扩量**
> 作为 Alex，我希望系统自动用小预算监测新国家的表现，当 CPA < $0.10 时自动建立正式跑量 Campaign。

**US-5：Meta 账户打通（V3 新增）**
> 作为 Alex，我希望在 AutoAds 创建的广告能直接推送到我的 Facebook 广告账户，不需要在 Ads Manager 里再操作一遍。

---

## 4. 功能模块总览

| 模块 | 英文代号 | 功能描述 | 当前状态 |
|------|----------|----------|----------|
| M1 | Creative Library | 素材库管理（上传、评分、变体、生命周期） | 🟡 部分完成 |
| M2 | Campaign Builder | 广告搭建引擎（批量创建、受众模板、CBO/ABO） | 🟢 核心完成 |
| M3 | Analytics Dashboard | 数据看板（三层视图、趋势图表、实时数据） | 🟢 核心完成 |
| M4 | Rule Engine | 自动化规则引擎（条件触发、执行动作、日志） | 🟡 部分完成 |
| M5 | Copy Iteration | 素材文案自动迭代（触发条件、变体生成、A/B 测试） | 🔴 待开发 |
| M6 | Top Creative Auto-Iteration | 头部素材自动衍生上新（评分、复制、预算保护） | 🔴 待开发 |
| M7 | Country Radar | 国家雷达监测组（监测组→跑量组自动扩量） | 🔴 待开发 |
| Meta API | Meta Integration | Meta Marketing API 全链路集成 | 🟢 核心完成 |

---

## 5. M1 素材库 (Creative Library)

### 5.1 功能描述

素材库是广告创意的中央仓库，管理图片、视频等素材的全生命周期。每个素材关联设计师、语言、尺寸、评分等信息。

### 5.2 核心功能

#### 5.2.1 素材上传（待完善）

- 支持图片（JPG/PNG，建议 1200×628）和视频（MP4）上传
- **文件名自动解析**：从文件名提取设计师缩写、语言代码、日期
  - 示例：`XZH-BN-0320-8.png` → 设计师 XZH、孟加拉语、3 月 20 日、第 8 版
- **SHA-256 去重**：上传时计算哈希，防止重复上传
- **尺寸自动检测**：读取图片 width/height 存入数据库
- 上传后状态为 `draft`

#### 5.2.2 素材生命周期

```
draft（草稿） → pending（待审核） → active（投放中）
                                   ↓
                              paused（暂停）
                                   ↓
                              archived（归档）
```

#### 5.2.3 素材评分模型（规划中）

- 综合评分 0-100，基于多维度加权：
  - CTR 权重 30%
  - 转化率权重 25%
  - 花费效率权重 20%
  - 留存率权重 15%
  - 素材新鲜度权重 10%
- `scoreFactors` JSON 字段存储各维度明细

#### 5.2.4 素材变体（A/B 测试）

- `CreativeVariation` 表支持同一素材的多版本测试
- 变体类型：文案变体、图片变体、组合变体
- 状态：`testing`（测试中） / `winner`（胜出） / `loser`（淘汰）
- 测试指标：impressions, clicks, spend, CPA

### 5.3 前端页面

- **素材列表页** (`/creatives`)：表格展示，支持筛选、排序
- **素材详情**：预览图、评分、变体列表、使用历史

---

## 6. M2 广告搭建引擎 (Campaign Builder)

### 6.1 功能描述

**V3 重大升级**：从简单的表单提交升级为完整的 4 步向导式批量创建流程，支持 Campaign/AdSet/Ad 全层级配置，可直接推送到 Facebook。

### 6.2 广告结构模式

支持两种 Campaign 结构模式：

| 模式 | 结构 | 适用场景 | 创建数量 |
|------|------|----------|----------|
| 1-1-1 | 1 Campaign : 1 AdSet : 1 Ad | 精细化测试每个素材在每个国家的独立表现 | 素材数 × 国家数 |
| 1-1-N | 1 Campaign : 1 AdSet : N Ads | 同一国家多素材组合测试 | 国家数 |

### 6.3 批量创建向导（4 步流程）—— V3 新增/重构

#### Step 1: 选择素材

- 从素材库勾选要使用的素材（Checkbox 多选）
- 显示素材缩略图、名称、尺寸
- 选中的素材显示序号（1, 2, 3...）
- 1-1-N 模式下可配置每个 AdSet 包含的 Ad 数量（2-10）

#### Step 2: Campaign 设置

**Campaign 目标与预算**

| 字段 | 选项 | 说明 |
|------|------|------|
| Campaign Objective | OUTCOME_SALES / OUTCOME_TRAFFIC / OUTCOME_ENGAGEMENT / OUTCOME_LEADS / OUTCOME_APP_PROMOTION / OUTCOME_AWARENESS | 广告目标 |
| Budget Strategy | CBO / ABO | CBO = Campaign 预算自动分配；ABO = 各 AdSet 独立预算 |
| Daily Budget | $1-$10,000 | 日预算（USD） |
| Bid Strategy | LOWEST_COST_WITHOUT_CAP / COST_CAP / BID_CAP / MINIMUM_ROAS | 出价策略 |
| Cost Per Result Goal | 数值（可选） | 当使用 COST_CAP / BID_CAP / MINIMUM_ROAS 时必填 |

**Conversion 转化设置**（当 Objective 为 SALES 或 LEADS 时显示）

| 字段 | 选项 |
|------|------|
| Conversion Location | WEBSITE / APP / MESSAGING / CALLS |
| Performance Goal | 根据 Objective 动态变化（如 OFFSITE_CONVERSIONS, LINK_CLICKS 等） |
| Conversion Event | PURCHASE / ADD_TO_CART / COMPLETE_REGISTRATION / LEAD / 等 |
| Pixel ID | 输入框（可选） |

**广告结构模式**
- 1-1-1（每个素材独立）
- 1-1-N（多素材组合）

**落地页链接（必填）**
- 输入框，验证必须以 `http` 开头
- 这是唯一必填的默认设置项

**预置模板（V3 新增）**
- Campaign 设置 Tab 顶部显示已保存的预置模板列表（金色 Tag）
- 点击模板一键加载所有 Campaign 设置、定向设置、版位设置、国家选择
- 预置模板保存在浏览器 localStorage 中，包含：
  - Campaign Objective, Budget Strategy, Daily Budget, Bid Strategy
  - Conversion Location, Optimization Goal, Pixel ID, Conversion Event
  - Age, Gender, Device, OS, Placements, Country Selection

#### Step 3: 定向与版位

**Audience 受众定向**

| 字段 | 默认值 | 范围 |
|------|--------|------|
| Minimum Age | 18 | 13-65 |
| Maximum Age | 65 | 13-65 |
| Gender | 不限 | 不限 / 男 / 女 |

**Devices 设备与系统**

| 字段 | 选项 |
|------|------|
| Device Platform | 全部设备 / 仅移动端 / 仅桌面端 |
| Operating System | 全部系统 / 仅 Android / 仅 iOS |

**Placements 版位设置**

| 字段 | 选项 |
|------|------|
| Placement Type | Advantage+ 自动版位（推荐） / 手动选择 |
| Publisher Platforms（手动时） | Facebook / Instagram / Messenger / Audience Network |

**投放国家选择（V3 从独立 Tab 合并至此）**

- 按地区分组（东南亚、南亚、东亚、欧美、中东、南美、欧亚）
- 支持全选/取消全选某个地区
- 点击国家 Tag 切换选中状态
- 选中后显示蓝色高亮
- **不显示预算**（预算统一在 Step 2 设置）

**保存预置模板按钮（V3 新增）**
- 位于 Step 3 底部
- 点击后弹出模态框，输入模板名称
- 保存当前所有 Campaign 设置 + 定向设置 + 国家选择到 localStorage

#### Step 4: 广告文案

**输入模式切换**
- 手动输入 / 使用文案库

**手动输入模式**
- 广告正文 (Primary Text)：TextArea，最多 125 字符，显示字数统计
- 标题 (Headline)：Input，最多 25 字符
- CTA 按钮：LEARN_MORE / SIGN_UP / GET_OFFER / APPLY_NOW

**文案库模式（V3 重构）**

- **两列布局**：
  - 左列：Primary Text 选择（蓝色主题）
  - 右列：Headline 选择（紫色主题）
- 每列为可滚动的卡片列表
- 点击卡片选中（蓝色/紫色边框 + 背景高亮）
- 再次点击取消选中
- 卡片显示：国家代码 Tag、文案名称、文案内容
- 允许只选 PT 或只选 HL（Meta API 允许素材没有 headline）

### 6.4 底部操作栏

- **左下角**：推送 Meta 开关（"推送 Meta" / "仅本地"）
- **右下角**：
  - 第 1-3 步：「上一步」+「下一步」
  - 第 4 步：「上一步」+「开始创建」
- **创建预览条**：显示将创建的 Campaign 数量、Ad 数量、总日预算

### 6.5 后端处理逻辑

1. 接收前端 payload（包含所有 Campaign/AdSet/Ad 层级配置）
2. 校验：素材 ≥1、国家 ≥1、落地页 URL 有效
3. 根据 structure 模式循环创建：
   - 1-1-1：每个素材 × 每个国家 = 独立 Campaign
   - 1-1-N：每个国家 = 1 个 Campaign，内含 N 个 Ad
4. 创建完成后，如果 `pushToMeta=true`：
   - 调用 `pushCampaignToMeta()` 推送到 Facebook
   - Campaign → AdSet → 上传图片 → AdCreative → Ad
   - 所有创建状态为 `PAUSED`（安全策略）
   - 回写 Meta ID 到本地数据库
5. 返回创建结果摘要

---

## 7. M3 数据看板 (Analytics Dashboard)

### 7.1 功能描述

三层视图的数据分析平台：Account 层总览 → Campaign 层趋势 → Ad 层细节。

### 7.2 核心指标

| 指标 | 说明 | 计算方式 |
|------|------|----------|
| Spend | 总花费 | SUM(spend) |
| Impressions | 展示次数 | SUM(impressions) |
| Clicks | 点击次数 | SUM(clicks) |
| CTR | 点击率 | clicks / impressions |
| CPC | 单次点击成本 | spend / clicks |
| CPA | 单次转化成本 | spend / conversions |
| Conversions | 转化次数 | SUM(conversions) |
| ROAS | 广告支出回报率 | revenue / spend |
| Frequency | 展示频次 | impressions / reach |

### 7.3 前端页面

- **Dashboard 首页** (`/`)：KPI 统计卡片 + 趋势 AreaChart + Top Campaigns BarChart
- **Performance 详情页** (`/performance`)：三层下钻表格（Account → Campaign → AdSet → Ad）
- 支持日期范围选择、状态筛选

### 7.4 数据同步（V4.0 已实现）

- 定时任务每 15 分钟从 Meta API 拉取 insights 数据（Cron 链式执行）
- 通过 `resolveCredentialConfig()` 按 Campaign 逐个分发用户个人凭据获取数据
- 写入 `AdPerformance` 表（time-series），支持 campaign / adset / ad 三个层级
- 增量同步，避免重复拉取
- `GET /api/performance/dashboard` 端点返回四大数据板块：`summary`（汇总指标）、`topCampaigns`（花费 Top5）、`dailyTrend`（每日趋势）、`creativePerformance`（素材排行 Top10）
- 自动过滤 Mock/Unknown 测试数据

---

## 8. M4 自动化规则引擎 (Rule Engine)

### 8.1 功能描述

基于条件的自动化执行系统，支持预算、出价、状态、通知四种类型的规则。V4.1 版本实现了 R1（低ROI/零转化自动关停）和 R2（单日消耗超限自动关停）两条核心规则，集成 EPC/盈利比指标体系，支持自动发现目标和 Meta API 实时状态推送。

### 8.2 规则类型

| 类型 | 触发条件示例 | 执行动作 |
|------|-------------|----------|
| budget | CPA > $0.30 持续 3h | 将预算降低 50% |
| bid | CTR < 1% 持续 6h | 将出价提高 20% |
| status | 花费 > $0.75 零转化 | 暂停广告（R1） |
| status | 花费 > $3.00 且 CPA > 国家单价 | 暂停广告（R2） |
| notification | 规则触发事件 | 发送日志/邮件通知 |

### 8.3 核心指标体系（V4.1 新增）

| 指标 | 计算公式 | 用途 |
|------|----------|------|
| EPC (Earnings Per Click) | `conversions × payout / clicks` | 衡量每次点击的预期收益 |
| CPC (Cost Per Click) | `spend / clicks` | 衡量每次点击成本 |
| Profitability Ratio | `EPC / CPC` | >1 盈利, <1 亏损, =1 盈亏平衡 |
| CPA (Cost Per Acquisition) | `spend / conversions` | 单次转化成本 |
| payout | 来自 CountryBenchmark 表 | 每个国家的单次转化收益基准 |

`CountryBenchmark` 表按国家存储: `payout`, `ctrThreshold`, `cpcCeiling`, `breakEvenCvr`, `isActive`。

### 8.4 R1 — 低ROI/零转化自动关停

**规则 ID**: `R1-低ROI/零转化自动关停`  
**适用日期**: 2026-04-24  
**类型**: status  
**作用级别**: ad

**触发条件** (AND 逻辑):
1. `spend >= $0.75` (24h 窗口) — 花费达到 3 倍国家单价（以 $0.25 为基准）
2. `conversions == 0` (24h 窗口) — 该时间窗口内无任何转化

**执行动作**:
1. 调用 Meta Graph API `POST /{ad_id}?status=PAUSED`，将广告实时暂停
2. 更新本地数据库 `ad.status = 'paused'`
3. 记录 RuleExecutionLog（含 spend, conversions, CPC, EPC, country）

**保护机制**:
- 若广告已为 paused 状态，跳过执行（防重复）
- Meta API 失败时仍更新本地状态，日志记录错误详情
- `cooldownMinutes: 0`（无冷却，每个执行周期都检查）

**设计依据**: 04-23 真实数据分析显示，BD/PH 两国平均单价 $0.25，当广告花费 $0.75（3x 单价）仍无转化时，继续投放的概率极低，应立即止损。

### 8.5 R2 — 单日消耗超限自动关停

**规则 ID**: `R2-单日消耗超限自动关停`  
**适用日期**: 2026-04-24  
**类型**: status  
**作用级别**: ad

**触发条件** (AND 逻辑):
1. `spend >= $3.00` (24h 窗口) — 单条广告花费达到 12 倍国家单价
2. `cpa > $0.25` (24h 窗口) — CPA 超过国家基准单价

**执行动作**: 同 R1

**保护机制**:
- `cooldownMinutes: 1440`（24 小时冷却期，防止 unpause 后立即被再次暂停）
- `maxExecutions: null`（无上限，持续监控）

**设计依据**: 当广告花费显著但 CPA 仍高于盈亏平衡点时，说明受众匹配度差或竞争激烈，应暂停止损。24 小时冷却期允许投手手动恢复后观察效果。

### 8.6 自动发现目标机制（V4.1 新增）

当规则的 `targetIds` 为空数组时，引擎自动查询所有活跃对象：

```
targetIds = [] → 查询 ad.status='active' 的所有广告
               → 返回本地 UUID 列表
               → 逐一评估条件
```

这使得规则不需要手动指定每条广告 ID，新创建的广告自动纳入监控范围。

### 8.7 执行架构（V4.1 新增）

**Cron 链式执行**: 每 15 分钟触发一次 Cron 周期，执行顺序为:

```
syncPerformanceData() → checkAutomationRules()
     ↑ Meta Insights 同步       ↑ 基于最新数据评估规则
```

确保规则永远基于最新同步数据做决策，避免旧数据误判。

**单次执行流程**:

```
1. 加载所有 isActive=true, status='active' 的规则
2. 对每条规则:
   a. 检查冷却期（上次成功执行时间 vs cooldownMinutes）
   b. 检查最大执行次数
   c. 获取目标列表（显式 targetIds 或自动发现）
   d. 取所有 conditions 中最大的 timeWindow
   e. 对每个目标:
      - 聚合 AdPerformance 数据（按 timeWindow）
      - 查询目标国家 → CountryBenchmark.payout → 计算 EPC/profitability
      - 评估 AND/OR 条件逻辑
      - 条件满足 → 执行 actions（pause/unpause/adjust/notify）
   f. 记录 RuleExecutionLog
   g. 更新 executionCount
3. 汇总结果: totalRules / executedRules / skippedRules / totalTriggers / totalActions
```

### 8.8 规则数据结构

- `conditions`: JSON 数组，每个条件含 `{metric, operator, value, timeWindow}`
- `conditionLogic`: `AND` | `OR`
- `actions`: JSON 数组，每个动作含 `{type, params}`
- `applyTo`: `campaign` | `adset` | `ad`
- `targetIds`: 具体目标 UUID 列表（空 = 应用到所有活跃对象）
- `cooldownMinutes`: 执行间隔冷却时间（分钟）
- `maxExecutions`: 最大执行次数（null = 无限）

支持的 metric: `spend`, `impressions`, `clicks`, `conversions`, `ctr`, `cpa`, `cpc`, `cpm`, `roas`, `reach`, `frequency`, `epc`, `payout`, `profitability`

支持的 operator: `>`, `<`, `>=`, `<=`, `==`, `!=`

支持的 timeWindow: `1h`, `6h`, `12h`, `24h`, `3d`, `7d`, `30d`

### 8.9 API 端点（V4.1 完整）

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/rules` | GET | 列出所有规则（支持 status/ruleType/isActive 过滤） |
| `/api/rules` | POST | 创建新规则 |
| `/api/rules/:id` | GET | 获取规则详情 + 最近 20 条执行日志 |
| `/api/rules/:id` | PUT | 更新规则 |
| `/api/rules/:id` | DELETE | 删除规则 |
| `/api/rules/:id/activate` | POST | 激活规则 |
| `/api/rules/:id/deactivate` | POST | 停用规则 |
| `/api/rules/:id/test` | POST | Dry-run 测试（不执行动作，返回评估结果） |
| `/api/rules/:id/execute` | POST | 手动执行规则 |
| `/api/rules/:id/logs` | GET | 查询执行日志（分页） |
| `/api/rules/run-all` | POST | 运行所有活跃规则 |

### 8.10 前端页面（V4.1 更新）

- **Rules 列表页** (`/rules`)：表格展示所有规则，支持启用/停用开关
- **规则创建/编辑**：Modal 表单，配置条件和动作
- **预设规则模板**: R1（零转化关停）和 R2（超限关停）一键创建
- **目标选择器**: targetIds 留空 = 应用到所有活跃对象，带提示"留空 = 应用到所有活跃对象"
- **Dry-run 测试结果弹窗**: 展示每个目标的 spend, conversions, CPC, EPC, profitability, country

---

## 9. M5 素材文案迭代 (Copy Iteration)

### 9.1 功能描述（规划中）

当素材表现不佳时，系统自动生成文案变体进行 A/B 测试。

### 9.2 触发条件

- CPA 超过目标值 50% 以上
- CTR 低于行业均值
- 花费达到预算上限但转化不足

### 9.3 变体生成规则

| 变体类型 | 生成方式 |
|----------|----------|
| 标题变体 | 同义词替换、句式调整、emoji 添加 |
| 正文变体 | 卖点重组、CTA 位置调整、长度变化 |
| CTA 变体 | 按钮文案轮换（Learn More → Sign Up → Get Offer） |

### 9.4 A/B 测试流程

1. 原始素材标记为 `control`
2. 生成 2-3 个变体，状态 `testing`
3. 各分配 20% 流量，原始保留 40%
4. 运行 48-72 小时后统计结果
5. 胜出变体标记为 `winner`，其他标记为 `loser`
6. `winner` 替换原始素材继续投放

---

## 10. M6 头部素材自动迭代 (Top Creative Auto-Iteration)

### 10.1 功能描述（规划中）

自动识别表现优异的素材，为其生成衍生版本并上新，同时控制预算风险。

### 10.2 头部素材识别标准

素材需同时满足：
- CTR > 2%
- CPA < $0.15
- 综合评分 > 80
- 投放时间 > 24 小时

### 10.3 自动衍生逻辑

1. 复制头部素材的创意参数
2. 生成 3-5 个变体（文案微调、配色调整、CTA 变化）
3. 创建新的 Campaign/AdSet，预算设为原 Campaign 的 30%
4. 标记 `parentAdId` 建立血缘关系

### 10.4 三重预算保护

| 保护层级 | 预算上限 | 触发动作 |
|----------|----------|----------|
| 每日 | $50/组 | 达到后自动暂停 |
| 每周 | $300/组 | 达到后通知管理员 |
| 每月 | $1000/组 | 达到后需手动审核才能继续 |

### 10.5 疲劳检测

- 当 Frequency > 3 时，标记素材为 `fatigue`
- 自动降低预算 30%
- 触发文案迭代流程

---

## 11. M7 国家雷达监测组 (Country Radar)

### 11.1 功能描述（规划中）

国家维度的自动监测和扩量系统。用小预算快速测试新国家，表现达标后自动建立正式跑量 Campaign。

### 11.2 监测组设计

- **预算**：$5-10/天
- **目标国家**：新国家或表现下滑的国家
- **素材**：复用已验证的优质素材
- **时长**：3-5 天

### 11.3 触发信号（三重判定）

监测组同时满足以下条件时，触发扩量：
- CPA < $0.10
- CTR > 3%
- 转化次数 > 10

### 11.4 自动建立跑量组

触发后自动执行：
1. 创建正式 Campaign，预算 $50-100/天
2. 复制监测组的优质素材和文案
3. 启用 CBO 预算策略
4. 通知管理员

---

## 12. Meta Marketing API 集成

### 12.1 概述（V3 核心完成）

AutoAds 通过 Meta Marketing API v21.0 与 Facebook 广告账户打通，支持读取账户信息、创建/修改广告、同步表现数据。

### 12.2 认证方式

**V4.2 架构升级：用户级个人凭据隔离**

V4.2 版本将 Meta API 认证从全局 `.env` Token 升级为用户级个人凭据模型，实现多投手独立 Token 管理。

**核心变更**:

- 每个用户通过 `MetaCredential` 模型管理自己的 Meta API 凭据（1:N 关系，支持多套凭据）
- 每个 Campaign 通过 `ownerId` 关联其创建者，Meta 操作时由 `resolveCredentialConfig()` 引擎自动调度对应用户的默认凭据
- 全局 `.env` 中的 `META_ACCESS_TOKEN` 仅保留用于 `/api/meta/health` 健康检查，不再参与广告投放操作
- 所有凭据字段使用 AES-256 加密存储，读取时即时解密

**凭据调度引擎 `resolveCredentialConfig(campaignId)`**:

```
1. 查询 Campaign 的 ownerId
2. 若无 ownerId → 抛出错误「Campaign 无关联创建者」
3. 查询该用户的 isDefault=true 的 MetaCredential
4. 若无凭据 → 记录审计日志 + 抛出错误「请前往设置页面配置个人凭据」
5. 检查 Token 是否过期（tokenExpiresAt）
6. 过期 → 抛出 auth_failed 错误 + 标记 tokenStatus='expired'
7. 解密 AES-256 字段 → 返回 CredentialConfig
```

**对比：全局 Token 模式 vs 个人凭据模式（V4.2）**

| 维度 | V4.1 全局 Token | V4.2 个人凭据 |
|------|----------------|--------------|
| Token 归属 | 单一全局 .env | 每用户独立存储 |
| 多投手支持 | 不支持（共享同一 Token） | 支持（按 ownerId 分发） |
| Token 过期处理 | 无检测 | 自动检测 + 友好提示 |
| 安全性 | 明文 .env | AES-256 加密存储 |
| 审计追踪 | 无 | 完整审计日志（AuditLog） |
| 故障隔离 | 一个 Token 失效影响全部 | 仅影响对应用户的 Campaign |

**推荐方案（保留参考）：Business Manager System User Token**

- System User 是 BM 层面的系统用户，不绑定任何个人账号
- Token **永不过期**（除非主动 revoke）
- 适合服务端自动化工具，不受个人账号封禁影响
- 权限管理精细，可精确控制访问的广告账户和粉丝页

**对比：个人 User Token**

| 维度 | System User Token | 个人 User Token |
|------|-------------------|-----------------|
| 有效期 | 永久 | 60 天（需刷新） |
| 账号依赖 | 无（BM 层面） | 绑定个人 FB 账号 |
| 封号风险 | 低 | 高（个人号被封则 Token 失效） |
| 权限粒度 | 精细（按账户/页面） | 粗粒度 |
| 官方推荐 | ✅ 服务端集成推荐 | ⚠️ 仅适合开发测试 |

### 12.3 环境变量配置

**全局 `.env`（仅用于健康检查和 App 级别配置）**

```env
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_ACCESS_TOKEN=EAAL...          # 全局 Health Check 用（V4.2 起不再用于投放操作）
META_AD_ACCOUNT_ID=act_123456789   # 默认广告账户（健康检查用）
META_PAGE_ID=123456789             # 默认粉丝页（健康检查用）
META_API_VERSION=v21.0             # API 版本
ENCRYPTION_KEY=...                 # AES-256 加密密钥（32 字节 hex）
```

**用户级个人凭据（V4.2 新增，存储在 `MetaCredential` 表）**

每个用户通过 Settings 页面配置：`metaAppId`、`metaAppSecret`、`metaAccessToken`、`metaAdAccountId`、`metaPageId`，全部 AES-256 加密入库。

### 12.4 推送流程

当用户在 AutoAds 创建广告并开启「推送 Meta」开关时，系统执行以下流程：

```
1. 创建 Campaign（Meta API）
   └── 参数：name, objective, status=PAUSED, daily_budget（CBO 时）
   └── 回写 metaCampaignId 到本地数据库

2. 创建 AdSet（Meta API）
   └── 参数：campaign_id, targeting, daily_budget（ABO 时）, optimization_goal, bid_strategy
   └── 回写 metaAdSetId 到本地数据库

3. 上传图片到 Facebook（Meta API）—— 仅本地图片需要
   └── 调用 /{ad_account_id}/adimages
   └── 获取 image_hash

4. 创建 AdCreative（Meta API）
   └── 参数：page_id（必需）, object_story_spec.link_data
   └── link_data 包含：image_hash/image_url, message, name(headline), call_to_action

5. 创建 Ad（Meta API）
   └── 参数：adset_id, creative_id, status=PAUSED
   └── 回写 metaAdId 到本地数据库
```

### 12.5 API 端点

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/meta/health` | GET | 检测 Meta API 连接状态（使用全局 Token） |
| `/api/meta/accounts` | GET | 获取当前用户的广告账户列表（V4.2 改用个人凭据） |
| `/api/meta/pages` | GET | 获取当前用户的 Facebook 粉丝页列表（V4.2 改用个人凭据） |
| `/api/meta/campaigns` | GET | 从 Meta 拉取 Campaign 列表（V4.2 改用个人凭据） |
| `/api/meta/insights` | GET | 获取 Campaign/AdSet/Ad 的表现数据（V4.2 改用个人凭据） |
| `/api/meta-credentials` | GET | 获取当前用户的所有 Meta 凭据列表 |
| `/api/meta-credentials` | POST | 创建新的 Meta 凭据（含 Token 验证 + AES-256 加密） |
| `/api/meta-credentials/:id` | PUT | 更新凭据信息 |
| `/api/meta-credentials/:id` | DELETE | 删除凭据 |
| `/api/meta-credentials/:id/verify` | POST | 验证凭据 Token 有效性（调用 debug_token） |
| `/api/meta-credentials/:id/set-default` | POST | 设为默认凭据 |
| `/api/campaigns/auto-create` | POST | 批量创建广告（本地 + 可选 Meta 推送） |
| `/api/campaigns/re-push` | POST | 重新推送失败的 Campaign 到 Meta（V4.2 新增） |

### 12.6 关键设计决策

**图片处理方式**：
- 本地图片（fileUrl 以 `/uploads/` 开头）：先调用 Facebook `adimages` 端点上传，获取 `image_hash`，再用 hash 创建 AdCreative
- 公网图片（fileUrl 以 `http` 开头）：直接在 AdCreative 中使用 `image_url`
- 实现图片 hash 缓存，避免同一图片重复上传

**预算策略处理**：
- CBO 模式：`daily_budget` 仅在 Campaign 层设置，AdSet 层不设置预算
- ABO 模式：`daily_budget` 仅在 AdSet 层设置，Campaign 层不设置预算

**安全策略**：
- 所有推送到 Meta 的广告默认创建为 `PAUSED` 状态
- 用户需在 Facebook Ads Manager 中手动开启投放
- 防止自动化工具意外产生花费

---

## 13. 数据库设计

### 13.1 核心实体关系

```
AdAccount (1) ───< (N) AdCampaign (1) ───< (N) AdSet (1) ───< (N) Ad
      │                    │                │                    │
      │                    │ ownerId        │                    │
      │                    ↓                │                    │
      │              User (1) ──< (N) MetaCredential             │
      │                                                          │
      └────────< (N) AdAccountCreative >────────────────────────┘
                                                                │
Creative (1) ───────────────────────────────────────────────────┘
      │
      └──< (N) CreativeVariation

AutomationRule (N) ───< (N) CampaignRule >─── (N) AdCampaign
      │
      └──< (N) RuleExecutionLog

AuditLog ──→ User (操作人追踪)

CountryCopy (独立文案库)
```

### 13.2 核心表字段摘要

#### creatives（素材表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (UUID) | 主键 |
| name | String | 素材名称 |
| type | Enum | image / video / carousel / collection |
| status | Enum | draft / pending / active / paused / archived |
| fileUrl | String | 文件路径（本地或公网 URL） |
| fileHash | String | SHA-256 哈希（去重用） |
| width / height | Int | 尺寸 |
| primaryText / headline / description / callToAction | String | 文案内容 |
| score | Float | 综合评分 0-100 |
| scoreFactors | Json | 评分维度明细 |
| designer | String | 设计师 |
| country | String | 语言/国家代码 |
| tags / labels | String[] | 标签 |

#### adCampaigns（广告活动表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (UUID) | 主键 |
| metaCampaignId | String | Meta Campaign ID |
| name | String | 活动名称 |
| objective | String | 广告目标 |
| status | Enum | draft / scheduled / active / paused / ended / archived |
| budgetType / budgetAmount / budgetCurrency | — | 预算设置 |
| adAccountId | String | 所属广告账户 |
| isAutoCreated | Boolean | 是否由系统自动创建 |
| ownerId | String (FK→User) | Campaign 创建者 ID（V4.2 新增，用于凭据调度） |
| pushStatus | Enum | Meta 推送状态：pending / pushing / success / failed / auth_failed / skipped（V4.2 新增） |
| metaPushError | String | 推送失败错误信息（V4.2 新增） |
| countryRadarConfig | Json | 国家雷达配置（国家、受众模板、结构模式、Campaign 设置快照） |

#### adSets（广告组表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (UUID) | 主键 |
| metaAdSetId | String | Meta AdSet ID |
| campaignId | String | 所属 Campaign |
| targeting | Json | 定向设置（年龄、性别、国家、设备、兴趣等） |
| audienceTemplate | String | 受众模板代码（T1/T2/T3） |
| placements | String[] | 版位（facebook, instagram, messenger, audience_network） |
| budgetAmount | Float | 日预算（ABO 模式） |
| bidStrategy | String | 出价策略 |
| optimizationGoal | String | 优化目标 |
| radarType | String | monitor（监测组）/ scaling（跑量组） |
| countryCode | String | 国家代码 |

#### ads（广告表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (UUID) | 主键 |
| metaAdId | String | Meta Ad ID |
| adSetId | String | 所属 AdSet |
| creativeId | String | 关联素材 |
| urlParameters | String | JSON 字符串（primaryText, headline, landingUrl, ctaType） |
| isTopCreative | Boolean | 是否为头部素材 |
| topCreativeRank | Int | 头部素材排名 |
| parentAdId | String | 父广告 ID（迭代血缘） |
| iterationCount | Int | 迭代次数 |

#### countryCopies（国家文案库）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (UUID) | 主键 |
| countryCode | String | 国家代码 |
| primaryText / headline / description | String | 文案内容 |
| ctaType | String | CTA 类型 |
| useCount / totalSpend / totalConversions / avgCpa | — | 表现统计 |
| isActive / isDefault | Boolean | 状态标记 |
| tags | String[] | 标签 |

#### metaCredentials（Meta 凭据表）—— V4.2 新增

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (UUID) | 主键 |
| userId | String (FK→User) | 所属用户 |
| alias | String | 账户别名（如"默认账户"） |
| isDefault | Boolean | 是否为默认凭据 |
| metaAppId | String (加密) | Meta App ID（AES-256） |
| metaAppSecret | String (加密) | Meta App Secret（AES-256） |
| metaAccessToken | String (加密) | Meta Access Token（AES-256） |
| metaAdAccountId | String (加密) | 广告账户 ID（AES-256） |
| metaPageId | String (加密) | Facebook 粉丝页 ID（AES-256） |
| tokenSource | String | Token 来源：user_token / system_user_token / unknown |
| tokenExpiresAt | DateTime | Token 过期时间（null 表示永不过期） |
| tokenStatus | String | Token 状态：valid / expired / invalid / unknown |
| lastVerifiedAt | DateTime | 最后一次验证时间 |

唯一约束：`(userId, alias)`，同一用户下不允许重名凭据。

#### auditLogs（审计日志表）—— V4.2 新增

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (UUID) | 主键 |
| userId | String (FK→User) | 操作人 |
| action | String | 操作类型（create, update, delete, credential_dispatch, push_meta 等） |
| resourceType | String | 资源类型（campaign, meta_credential, ad 等） |
| resourceId | String | 资源 ID |
| details | Json | 操作详情 |
| result | String | 操作结果（success / failed） |
| severity | String | 严重级别（info / warning / error） |

---

## 14. API 接口规范

### 14.1 核心接口列表

| 端点 | 方法 | 功能 | 模块 |
|------|------|------|------|
| `/api/creatives` | CRUD | 素材管理 | M1 |
| `/api/campaigns` | CRUD | 广告活动管理 | M2 |
| `/api/campaigns/auto-create` | POST | 批量自动创建广告 | M2 |
| `/api/campaigns/templates` | GET | 获取国家/受众模板 | M2 |
| `/api/campaigns/country-copies` | GET | 获取国家文案库 | M2 |
| `/api/performance/dashboard` | GET | 看板数据聚合 | M3 |
| `/api/performance` | GET | 性能数据查询 | M3 |
| `/api/rules` | CRUD | 规则管理 | M4 |
| `/api/rules/:id/execute` | POST | 手动执行规则 | M4 |
| `/api/meta/health` | GET | Meta API 健康检查（全局 Token） | Meta |
| `/api/meta/accounts` | GET | 广告账户列表（个人凭据） | Meta |
| `/api/meta/pages` | GET | 粉丝页列表（个人凭据） | Meta |
| `/api/meta/campaigns` | GET | Meta Campaign 列表（个人凭据） | Meta |
| `/api/meta/insights` | GET | 表现数据 Insights（个人凭据） | Meta |
| `/api/meta/sync` | POST | 手动触发数据同步 | Meta |
| `/api/meta-credentials` | CRUD | 个人 Meta 凭据管理（AES-256 加密） | Meta V4.2 |
| `/api/meta-credentials/:id/verify` | POST | 验证凭据 Token 有效性 | Meta V4.2 |
| `/api/meta-credentials/:id/set-default` | POST | 设为默认凭据 | Meta V4.2 |
| `/api/campaigns/re-push` | POST | 重新推送失败 Campaign | M2 V4.2 |

### 14.2 批量创建广告接口详情

**POST /api/campaigns/auto-create**

请求体（V3 完整版）：

```typescript
{
  creativeIds: string[];              // 素材 ID 列表
  countries: {
    code: string;
    dailyBudget?: number;
    audienceTemplate?: string;
    copyId?: string;
  }[];
  structure: '1-1-1' | '1-1-N';       // 广告结构模式
  adsPerAdSet?: number;               // 1-1-N 时的 N 值
  audienceTemplate: string;           // 默认受众模板
  primaryText?: string;               // 广告正文
  headline?: string;                  // 广告标题
  landingUrl: string;                 // 落地页链接（必填）
  ctaType: string;                    // CTA 类型
  pushToMeta?: boolean;               // 是否推送到 Facebook

  // Campaign Settings（V3 新增）
  campaignObjective?: string;          // OUTCOME_SALES / TRAFFIC / ...
  budgetStrategy?: 'CBO' | 'ABO';     // 预算策略
  bidStrategy?: string;               // LOWEST_COST_WITHOUT_CAP / ...
  costPerResultGoal?: number;         // 出价目标
  conversionLocation?: string;        // WEBSITE / APP / ...
  optimizationGoal?: string;          // OFFSITE_CONVERSIONS / ...
  pixelId?: string;                   // Pixel/Dataset ID
  conversionEvent?: string;           // PURCHASE / LEAD / ...

  // Targeting Settings（V3 新增）
  ageMin?: number;
  ageMax?: number;
  targetGender?: number;              // 0=不限, 1=男, 2=女
  devicePlatforms?: string[];         // mobile / desktop
  publisherPlatforms?: string[];      // facebook / instagram / ...
  userOs?: string[];                  // Android / iOS
  placementType?: 'automatic' | 'manual';
}
```

---

## 15. 前端设计规范

### 15.1 页面结构

| 页面 | 路由 | 功能描述 | 状态 |
|------|------|----------|------|
| Dashboard | `/` | KPI 总览 + 趋势图表 | ✅ 完成 |
| Creatives | `/creatives` | 素材库列表 + 管理 | 🟡 待完善上传 |
| Campaigns | `/campaigns` | 广告活动列表 + **4 步批量创建向导** | ✅ 完成 |
| Performance | `/performance` | 数据详情三层下钻 | 🟡 基础完成 |
| Rules | `/rules` | 自动化规则管理 | 🟡 基础完成 |
| Settings | `/settings` | **Meta API 配置 + 个人凭据管理（V4.2）+ 连接状态面板** | ✅ 完成 |
| Privacy | `/privacy` | 隐私政策（独立页面） | ✅ 完成 |

### 15.2 批量创建向导 UI 规范

- **Modal 宽度**：960px
- **步骤导航**：吸顶设计（position: sticky, zIndex: 10）
- **内容区域**：maxHeight 58vh，overflow-y: auto
- **步骤样式**：底部边框指示当前步骤，蓝色激活 / 灰色未激活
- **步骤徽标**：Step 1 显示已选素材数，Step 3 显示已选国家数
- **底部操作栏**：padding 12px 24px，borderTop 分隔线

### 15.3 设计原则

- 所有推送到 Facebook 的操作明确标注（"推送 Meta" 开关）
- 创建预览实时显示（Campaign 数 / Ad 数 / 总预算）
- 错误信息精确定位到步骤（"请在 Step 2 填写落地页链接"）
- 预置模板使用金色 Tag 区分，可点击加载、可删除

---

## 16. 安全与合规

### 16.1 数据安全

- ~~Access Token 存储在服务端环境变量，不暴露给前端~~ **V4.2 升级**：用户个人 Meta 凭据使用 AES-256 加密存储于 `MetaCredential` 表，全局 `.env` Token 仅保留用于健康检查
- 凭据字段（metaAppId, metaAppSecret, metaAccessToken, metaAdAccountId, metaPageId）全部 AES-256-CBC 加密，密钥由 `ENCRYPTION_KEY` 环境变量管理
- Token 有效性自动检测：`resolveCredentialConfig()` 在每次调用时检查 `tokenExpiresAt`，过期自动标记 `tokenStatus='expired'` 并拒绝操作
- 审计日志（`AuditLog`）记录所有凭据操作和 Meta API 调用
- 数据库连接使用独立账号，最小权限原则
- 用户上传素材存储在本地文件系统，限制文件类型和大小
- 前端 API 调用统一使用相对路径 + JWT Bearer Token 认证（V4.3 修复，消除硬编码地址）

### 16.2 Meta API 合规

- 所有广告创建为 `PAUSED` 状态，需用户手动开启
- 遵守 Meta 广告政策，自动创建时标记 `special_ad_categories: []`
- 隐私政策页面已创建（`/privacy`）
- 服务条款页面已创建（`/terms`）

### 16.3 错误处理

- Meta API 调用失败时，本地数据仍然保留，不删除已创建记录
- 错误信息记录到日志（含 fbtrace_id），方便排查
- 部分失败时返回成功/失败明细，便于手动处理

---

## 17. 开发路线图

### Phase 0: 基础架构 + Meta API 打通（第 1-2 周）✅ 完成

| 任务 | 状态 |
|------|------|
| 开发环境搭建 | ✅ |
| Monorepo 项目骨架 | ✅ |
| PostgreSQL + Prisma 初始化 | ✅ |
| Express API 框架 | ✅ |
| React + Vite 前端框架 | ✅ |
| Meta API v21.0 集成 | ✅ |
| 图片上传到 Facebook | ✅ |
| 粉丝页授权（System User Token） | ✅ |

### Phase 1: M1 素材库 + M2 广告搭建（第 3-4 周）✅ 核心完成

| 任务 | 状态 |
|------|------|
| 素材 CRUD API | ✅ |
| 素材上传（文件名解析、去重、尺寸检测） | 🟡 后端完成，前端待完善 |
| 国家文案库 | ✅ |
| 批量创建向导（4 步） | ✅ |
| Campaign 层级配置（Objective/CBO/ABO/Bid） | ✅ |
| 定向配置（年龄/性别/设备/版位） | ✅ |
| 受众预置模板（保存/加载） | ✅ |
| Meta API 推送全链路 | ✅ |

### Phase 2: M3 数据看板 + M4 规则引擎（第 5-6 周）✅ 核心完成

| 任务 | 状态 |
|------|------|
| Dashboard KPI + 图表 | ✅ |
| Dashboard API（summary/topCampaigns/dailyTrend/creativePerformance） | ✅ V4.3 确认 |
| Performance 三层下钻 | 🟡 |
| Meta Insights 数据同步 | ✅ 15分钟自动同步 |
| 规则 CRUD | ✅ |
| 规则条件解析器 | ✅ V4.1 完成 |
| 规则自动执行 | ✅ R1/R2 上线 |
| 规则 Dry-run 测试 | ✅ |
| EPC/盈利比指标体系 | ✅ V4.1 新增 |
| **凭据隔离架构** | ✅ V4.2 新增 |
| **运行时稳定性固化** | ✅ V4.3 新增 |

### Phase 3: M5 文案迭代 + M6 头部素材 + M7 国家雷达（第 7-10 周）🔴 未开始

| 任务 | 状态 |
|------|------|
| M5 文案触发条件 + 变体生成 | 🔴 |
| M5 A/B 测试框架 | 🔴 |
| M6 头部素材识别算法 | 🔴 |
| M6 自动衍生上新 | 🔴 |
| M6 三重预算保护 | 🔴 |
| M7 监测组设计 | 🔴 |
| M7 触发信号判定 | 🔴 |
| M7 自动扩量 | 🔴 |

### Phase 4: 稳定性 + 上线（第 11-12 周）

| 任务 | 状态 |
|------|------|
| 性能优化 | 🔴 |
| 监控告警 | 🔴 |
| 完整测试覆盖 | 🔴 |
| 部署文档 | 🟡 |

---

## 18. 附录：已完成 vs 待完成清单

### 18.1 已完成（V3.0 版本）

**基础设施**
- ✅ Monorepo 结构（pnpm workspace）
- ✅ PostgreSQL + Prisma ORM
- ✅ Express + TypeScript 后端
- ✅ React + Vite + Ant Design 前端
- ✅ API 代理配置
- ✅ 定时任务框架（node-cron）

**M1 素材库**
- ✅ Creative 模型（含评分字段、文案字段）
- ✅ CreativeVariation 模型（A/B 测试）
- ✅ 素材 CRUD API
- ✅ 素材列表页
- 🟡 素材上传（后端文件处理完成，前端 Upload 组件待完善）

**M2 广告搭建引擎**
- ✅ Campaign / AdSet / Ad 三层结构
- ✅ 批量创建向导（4 步：素材 → Campaign 设置 → 定向 → 文案）
- ✅ Campaign 目标设置（6 种 Objective）
- ✅ CBO / ABO 预算策略
- ✅ 出价策略（4 种）+ Cost Per Result Goal
- ✅ 转化设置（Location / Goal / Event / Pixel）
- ✅ 定向设置（年龄、性别、设备、系统）
- ✅ 版位设置（自动 / 手动）
- ✅ 国家选择（按地区分组，无预算）
- ✅ 受众预置模板（保存/加载/删除，localStorage）
- ✅ 文案库双列选择（PT / HL 独立点击选中）
- ✅ 1-1-1 和 1-1-N 结构模式
- ✅ 创建预览实时计算
- ✅ 落地页链接必填校验

**M3 数据看板**
- ✅ Dashboard 页面（KPI + 趋势图 + Top Campaigns）
- ✅ Performance API（聚合查询）
- 🟡 实时数据同步（框架已建，待 Meta API 数据填充）

**M4 规则引擎**
- ✅ 规则 CRUD API
- ✅ 规则列表页（启用/停用开关）
- ✅ 规则执行日志
- ✅ 规则条件解析器（JSON 条件 → 执行逻辑，支持 AND/OR）
- ✅ R1 低ROI/零转化自动关停（spend ≥ $0.75 AND conversions == 0）
- ✅ R2 单日消耗超限自动关停（spend ≥ $3.00 AND CPA > $0.25）
- ✅ EPC/盈利比指标体系（EPC = conv × payout / clicks）
- ✅ 自动发现目标机制（targetIds 空 = 全量活跃对象）
- ✅ Cron 同步→规则链式执行（15 分钟周期）
- ✅ Meta API 实时 pause/unpause 推送
- ✅ Dry-run 测试端点（含自动发现）
- ✅ 规则预设模板（R1/R2 一键创建）

**Meta API 集成**
- ✅ Meta Marketing API v21.0 连接
- ✅ 环境变量懒加载（修复加载时序问题）
- ✅ 广告账户信息读取
- ✅ Facebook 粉丝页列表读取
- ✅ 图片上传到 Facebook（adimages 端点）
- ✅ Campaign 创建（含 CBO 预算）
- ✅ AdSet 创建（含 ABO 预算、定向、出价）
- ✅ AdCreative 创建（含 page_id、image_hash）
- ✅ Ad 创建
- ✅ 全链路错误处理
- ✅ Meta ID 回写本地数据库
- ✅ 推送结果明细返回
- ✅ Settings 页面连接状态面板
- ✅ **V4.2** 用户级个人凭据模型（MetaCredential，AES-256 加密）
- ✅ **V4.2** `resolveCredentialConfig()` 凭据调度引擎
- ✅ **V4.2** 个人凭据 CRUD API（/api/meta-credentials）
- ✅ **V4.2** Token 有效性验证（debug_token + 过期检测）
- ✅ **V4.2** Meta 路由端点迁移至个人凭据（accounts/pages/campaigns/insights）
- ✅ **V4.2** 审计日志集成（凭据操作追踪）
- ✅ **V4.2** Campaign re-push 端点（推送失败重试）

**代码质量 & 稳定性（V4.3 新增）**
- ✅ 清除 `isMetaConfigured()` 全局判断（campaigns.ts 4 处）
- ✅ 清除 `inspectGlobalToken()` 死代码（metaApi.service.ts）
- ✅ 修复 `createCampaignStructure` 函数 `req` 作用域越界（ownerId 参数化）
- ✅ Campaign 接口补全：`owner`, `pushStatus`, `metaPushError`, `metaCampaignId` 属性
- ✅ Creative 接口补全：`owner` 属性
- ✅ 前端硬编码 `localhost:3001` 修复为相对路径 + JWT header（Campaigns.tsx、Settings.tsx）
- ✅ 创建 `vite-env.d.ts` 类型声明（解决 `import.meta.env` 类型错误）
- ✅ 移除 Ant Design 5.x 不兼容属性（`visibilityToggle.defaultVisible`）
- ✅ 添加缺失的 Ant Design 图标导入（`PlayCircleOutlined`）
- ✅ Prisma 关系字段名修正（`metaCredential` → `metaCredentials`）

### 18.2 待完成

**M1 素材库**
- 🔴 前端素材上传组件（Ant Design Upload）
- 🔴 素材评分算法实现
- 🔴 素材变体管理页面

**M2 广告搭建引擎**
- 🟡 受众模板从硬编码改为数据库配置
- 🟡 支持为不同国家配置不同文案（当前统一文案）

**M3 数据看板**
- ✅ Meta Insights 定时同步任务（15 分钟 Cron 周期）
- ✅ Dashboard API（summary / topCampaigns / dailyTrend / creativePerformance）
- 🟡 数据下钻详情页完善
- 🟡 历史 Campaign 缺少 ownerId 导致 Insights 同步失败（待数据迁移修复）

**M4 规则引擎**
- 🟡 更多规则模板（R3 疲劳检测、R4 预算自动调整等）
- 🟡 规则通知功能（邮件/Slack 实际推送）
- 🟡 规则冲突检测（多规则同时触发同一目标时的优先级）

**M5 素材文案迭代**
- 🔴 触发条件配置
- 🔴 变体生成算法
- 🔴 A/B 测试框架
- 🔴 胜出变体自动替换

**M6 头部素材自动迭代**
- 🔴 头部素材识别算法
- 🔴 自动衍生上新逻辑
- 🔴 三重预算保护
- 🔴 疲劳检测

**M7 国家雷达监测组**
- 🔴 监测组自动创建
- 🔴 触发信号三重判定
- 🔴 跑量组自动建立
- 🔴 国家维度分析报告

**性能与稳定性**
- 🔴 单元测试覆盖
- 🔴 集成测试（含 Meta API Mock）
- 🔴 性能优化（数据库索引、查询优化）
- 🔴 Docker 容器化部署
- 🔴 监控告警系统

---

## 19. V4.2 → V4.3 核心变更总结

### 19.1 V4.2 — Meta API 凭据个人化改造（2026-04-27）

| # | 变更项 | 变更前 | 变更后 | 影响 |
|---|--------|--------|--------|------|
| 1 | 凭据存储 | 全局 `.env` 单一 Token | `MetaCredential` 表，每用户独立，AES-256 加密 | 多投手独立管理 |
| 2 | 凭据调度 | 直接读 `process.env.META_ACCESS_TOKEN` | `resolveCredentialConfig(campaignId)` 按 ownerId 分发 | 凭据隔离、故障隔离 |
| 3 | Token 验证 | 无验证 | `debug_token` 自动检测 + `tokenExpiresAt` 过期判断 | 提前发现失效 Token |
| 4 | Meta 路由 | 4 个端点直接使用全局 Token | 4 个端点（accounts/pages/campaigns/insights）改用个人凭据 | 各投手看到自己的账户数据 |
| 5 | Campaign 归属 | 无 ownerId 字段 | 新增 `ownerId` + `pushStatus` + `metaPushError` | 支持追踪推送状态和创建者 |
| 6 | 新增 API | 无 | `/api/meta-credentials` CRUD + verify + set-default | 前端 Settings 页面可管理凭据 |
| 7 | 审计日志 | 无 | `AuditLog` 模型，凭据操作全量记录 | 安全合规 |
| 8 | Re-push | 无 | `POST /api/campaigns/re-push` 批量重推失败 Campaign | 推送失败可一键重试 |

### 19.2 V4.3 — 运行时稳定性固化（2026-04-28）

| # | 变更项 | 问题描述 | 修复方式 | 文件 |
|---|--------|----------|----------|------|
| 1 | `createCampaignStructure` 作用域 | 独立函数无法访问 `req` 对象 → `req is not defined` | 添加 `ownerId?: string` 参数，调用处传入 `req.user?.userId` | campaigns.ts |
| 2 | `metaApiConfigured` 未定义 | 变量在 if 块内声明，外部引用 → ReferenceError | 将 `hasPersonalCredential` / `hasPageId` 提升到 if 块外 | campaigns.ts |
| 3 | `isMetaConfigured()` 全局判断 | 4 处 Meta 操作前置全局 Token 判断，与个人凭据架构冲突 | 全部移除，改为 try-catch + `resolveCredentialConfig` | campaigns.ts |
| 4 | `isMetaConfigured()` 函数 | 函数本身成为死代码，无任何调用者 | 从 metaApi.service.ts 删除 | metaApi.service.ts |
| 5 | `inspectGlobalToken()` 函数 | 全局 Token 检查函数，个人凭据架构下无意义 | 从 metaApi.service.ts 删除 | metaApi.service.ts |
| 6 | Campaign 接口属性缺失 | TS 类型缺少 `owner`, `pushStatus`, `metaPushError`, `metaCampaignId` | 补全接口定义 | campaigns.ts (前端) |
| 7 | Creative 接口属性缺失 | TS 类型缺少 `owner` 属性 | 补全接口定义 | creatives.ts (前端) |
| 8 | 硬编码 `localhost:3001` | re-push 和 health-check 使用绝对地址 → 部署后无法访问 | 改为相对路径 `/api/...` + JWT Bearer Token | Campaigns.tsx, Settings.tsx |
| 9 | `import.meta.env` 类型错误 | 缺少 Vite 类型声明 → TS 编译警告 | 新建 `vite-env.d.ts` | vite-env.d.ts |
| 10 | `visibilityToggle.defaultVisible` | Ant Design 5.x 移除该属性 → 控制台警告 | 移除不兼容属性 | Settings.tsx |
| 11 | `PlayCircleOutlined` 未导入 | 使用图标但未 import → ReferenceError | 添加导入语句 | Creatives.tsx |
| 12 | Prisma 字段名错误 | `metaCredential`（单数）→ Prisma 关系名为 `metaCredentials`（复数） | 修正字段名 | users.ts |

---

**文档结束**
