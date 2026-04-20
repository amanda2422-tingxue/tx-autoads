# AutoAds Platform

Facebook 广告自动化平台 - 基于 Smartly.io 架构参考

## 项目结构

```
autoads-platform/
├── apps/
│   ├── web/          # React 前端应用
│   └── api/          # Node.js 后端 API
├── packages/
│   ├── shared/       # 共享类型定义和工具
│   └── database/     # Prisma schema 和数据库迁移
├── docs/             # 文档
└── scripts/          # 脚本工具
```

## 快速开始

### 前置要求

- Node.js 18+
- PostgreSQL 14+
- Git

### 安装步骤

```bash
# 1. 进入项目目录
cd autoads-platform

# 2. 安装 pnpm
npm install -g pnpm

# 3. 安装依赖
pnpm install

# 4. 配置环境变量
cp apps/api/.env.example apps/api/.env
# 编辑 apps/api/.env 配置数据库和 API 密钥

# 5. 初始化数据库
pnpm db:migrate

# 6. 启动开发服务器
pnpm dev
```

## 开发规范

- 使用 TypeScript
- 遵循 ESLint 和 Prettier 代码规范
- 提交前运行测试: `pnpm test`

## 文档

- [产品需求文档](./docs/PRD.md)
- [API 文档](./docs/API.md)
- [数据库设计](./docs/Database.md)

## 许可证

Private
