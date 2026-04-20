# @autoads/database

AutoAds Platform 数据库模块，使用 Prisma ORM 管理 PostgreSQL 数据库。

## 数据库设计概览

基于 PRD v2.0 设计，包含以下核心表：

### 核心表

| 表名 | 说明 | 对应模块 |
|------|------|----------|
| `creatives` | 素材表 | M1 素材库 |
| `creative_variations` | 素材变体表 | M5 文案迭代 |
| `ad_campaigns` | 广告活动表 | M2 广告搭建 |
| `ad_sets` | 广告组表 | M2 广告搭建 / M7 国家雷达 |
| `ads` | 广告表 | M2 广告搭建 / M6 头部素材 |
| `ad_performance` | 表现数据表 | M3 数据看板 |
| `automation_rules` | 自动化规则表 | M4 规则引擎 |
| `rule_execution_logs` | 规则执行日志 | M4 规则引擎 |

### 辅助表

| 表名 | 说明 |
|------|------|
| `ad_accounts` | 广告账户 |
| `ad_account_creatives` | 账户素材关联 |
| `campaign_rules` | 活动规则关联 |
| `scheduled_jobs` | 定时任务配置 |

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 配置数据库连接
```

### 3. 生成 Prisma Client

```bash
pnpm db:generate
```

### 4. 运行数据库迁移

```bash
# 开发环境（会创建迁移文件）
pnpm db:migrate

# 生产环境（只应用已有迁移）
pnpm db:deploy
```

### 5. 初始化数据（可选）

```bash
pnpm db:seed
```

### 6. 打开数据库管理界面

```bash
pnpm db:studio
```

## 常用命令

```bash
# 创建新的迁移
npx prisma migrate dev --name add_new_field

# 重置数据库（会删除数据）
pnpm db:reset

# 查看数据库
pnpm db:studio

# 生成客户端（schema 变更后）
pnpm db:generate
```

## 在代码中使用

```typescript
import { prisma, testConnection } from '@autoads/database';

// 测试连接
await testConnection();

// 查询素材
const creatives = await prisma.creative.findMany({
  where: { status: 'active' },
  include: { variations: true },
});

// 创建广告活动
const campaign = await prisma.adCampaign.create({
  data: {
    name: '测试活动',
    objective: 'CONVERSIONS',
    budgetAmount: 100,
    startDate: new Date(),
    adAccount: { connect: { id: accountId } },
  },
});
```

## 数据库关系图

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   ad_accounts   │────<│ ad_account_      │>────│   creatives     │
│                 │     │ creatives        │     │                 │
└────────┬────────┘     └──────────────────┘     └────────┬────────┘
         │                                                │
         │         ┌──────────────────┐                   │
         │         │ creative_        │                   │
         │         │ variations       │                   │
         │         └──────────────────┘                   │
         │                                                │
         ▼                                                ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  ad_campaigns   │────<│    ad_sets       │>────│      ads        │
│                 │     │                  │     │                 │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                        │
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ campaign_rules  │     │  ad_performance  │     │   (meta api)    │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         ▲
         │
┌─────────────────┐
│automation_rules │
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│rule_execution_  │
│logs             │
└─────────────────┘
```

## 注意事项

1. **不要直接修改数据库** - 始终使用 Prisma Migrate 进行结构变更
2. **敏感数据加密** - access_token 等敏感字段应在应用层加密后存储
3. **索引优化** - 已为常用查询字段添加索引，如需添加新索引请修改 schema
4. **数据清理** - ad_performance 表数据量大，建议定期归档历史数据
