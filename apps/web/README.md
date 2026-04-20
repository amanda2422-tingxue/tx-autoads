# @autoads/web

AutoAds Platform 前端应用，基于 React + TypeScript + Ant Design 构建。

## 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Ant Design 5** - UI 组件库
- **Vite 5** - 构建工具
- **React Router 6** - 路由管理
- **TanStack Query** - 数据获取
- **Recharts** - 图表库
- **Axios** - HTTP 客户端
- **Zustand** - 状态管理

## 项目结构

```
web/
├── src/
│   ├── components/          # 可复用组件
│   │   └── layout/          # 布局组件
│   │       ├── Header.tsx
│   │       └── Sidebar.tsx
│   ├── pages/               # 页面组件
│   │   ├── Dashboard.tsx    # 数据看板
│   │   ├── Creatives.tsx    # 素材库
│   │   ├── Campaigns.tsx    # 广告活动
│   │   ├── Performance.tsx  # 数据分析
│   │   ├── Rules.tsx        # 自动化规则
│   │   └── Settings.tsx     # 设置
│   ├── utils/
│   │   └── api/             # API 调用
│   │       ├── index.ts
│   │       ├── creatives.ts
│   │       ├── campaigns.ts
│   │       ├── performance.ts
│   │       ├── rules.ts
│   │       └── meta.ts
│   ├── App.tsx              # 主应用组件
│   ├── index.tsx            # 入口文件
│   └── index.css            # 全局样式
├── index.html               # HTML 模板
├── vite.config.ts           # Vite 配置
├── tsconfig.json            # TypeScript 配置
└── package.json             # 依赖配置
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件（如有需要）
```

### 3. 启动开发服务器

```bash
npm run dev
```

前端将在 http://localhost:3000 启动

### 4. 构建生产版本

```bash
npm run build
```

## 页面功能

| 页面 | 路由 | 功能 |
|------|------|------|
| 数据看板 | `/` | 总览广告数据、花费、CPA、CTR 等核心指标 |
| 素材库 | `/creatives` | 管理素材、上传、评分、变体 |
| 广告活动 | `/campaigns` | 创建、编辑、复制广告活动 |
| 数据分析 | `/performance` | 查看详细性能数据、趋势图表 |
| 自动化规则 | `/rules` | 配置和管理自动化规则 |
| 设置 | `/settings` | 配置 Meta API、同步设置 |

## API 代理

开发环境下，API 请求会自动代理到后端服务（`http://localhost:3001`）：

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
}
```

## 状态管理

使用 **TanStack Query** 管理服务端状态：

```typescript
import { useQuery } from '@tanstack/react-query'
import { creativesApi } from '@/utils/api/creatives'

function CreativesList() {
  const { data, isLoading } = useQuery({
    queryKey: ['creatives'],
    queryFn: creativesApi.list,
  })

  // ...
}
```

## 组件规范

- 使用函数组件 + TypeScript
- 使用 Ant Design 组件库
- 遵循 React 18 最佳实践
- 使用 CSS 类名进行样式定制

## 许可证

Private
