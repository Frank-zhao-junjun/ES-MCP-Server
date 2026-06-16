# Spec 006 — Admin Dashboard

> **Status**: 📋 Draft | **Version**: 0.6.0 | **Owner**: Full-Stack
>
> Covers: Admin UI (SPA), REST API, Authentication, Dashboard, API Key Management, Plugin Management, Session Monitoring, Tool Registry, System Config, Health Check

## 1. Overview

为 ES-MCP-Server 提供内嵌式管理后台，采用轻量 SPA 架构（原生 HTML/CSS/JS），零构建依赖，单进程部署。

### Goals
- 实时监控 MCP Server 运行状态
- 管理 API Key、插件、会话
- 查看工具注册信息和系统配置
- 独立于 MCP 协议的安全认证

### Non-Goals
- 不提供 SAP 数据写入/修改能力
- 不提供用户管理（仅单密码认证）
- 不提供日志持久化（仅实时查看）

## 2. Functional Requirements

### FR-001: Admin Authentication
- 独立密码认证：`MCP_ADMIN_PASSWORD` 环境变量
- 未配置时管理后台禁用，返回 503
- Session-based auth：登录成功后返回 `admin_session` cookie
- Session 有效期 8 小时，支持续期
- 所有 `/admin/api/*` 端点需要认证
- `/admin` 静态资源不需要认证（SPA 入口）

### FR-002: Dashboard
- 请求统计：总数、成功率、失败率、平均耗时
- 性能指标：p50/p95 耗时
- SAP 调用统计：总数、错误数、平均耗时
- 缓存统计：命中率、命中/未命中次数
- 运行时间：uptime 秒数
- 断路器状态：当前状态（CLOSED/OPEN/HALF_OPEN）
- 数据来源：`MetricsStore.getMetrics()`

### FR-003: API Key Management
- 列出所有已配置 API Key（脱敏显示：前 8 位 + `***`）
- 显示每个 Key 的角色（readonly/debug/admin）
- 显示失败次数和锁定状态
- 显示锁定剩余时间（如已锁定）
- 数据来源：`authContext.apiKeys` Map

### FR-004: Plugin Management
- 列出所有已加载插件：id、name、version、tool count
- 显示每个插件注册的工具列表
- 支持卸载插件（调用 `PluginManager.unregisterPlugin()`）
- 数据来源：`PluginManager.getPlugins()`

### FR-005: Session Monitoring
- 列出活跃 HTTP 会话：session ID、创建时间、最后活动时间
- 显示活跃会话总数
- 支持手动终止会话
- 数据来源：`httpSessions` Map（HTTP transport 模块）

### FR-006: Tool Registry
- 列出所有已注册工具（34 个内置 + 插件工具）
- 显示工具名称、描述、参数 schema
- 按业务域分类：采购、销售、主数据、生产、物流、财务、系统
- 数据来源：MCP SDK `server.listTools()` 或内部注册表

### FR-007: System Configuration
- 显示环境变量（脱敏：密码/Key 类变量显示 `***`）
- 显示运行时参数：Node 版本、平台、内存使用
- 显示版本信息：package.json version
- 只读展示，不支持修改

### FR-008: Health Check
- SAP 连接状态：`SAP_BASE_URL` 是否配置
- 断路器状态：当前状态、失败计数、上次失败时间
- 缓存状态：是否启用、TTL、当前条目数
- 自动分页状态：是否启用、最大记录数
- HTTP 传输状态：是否启用、端口、绑定地址

## 3. Technical Design

### Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    mcp-server.js                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ MCP Protocol│  │ HTTP/SSE    │  │ Admin Dashboard │ │
│  │ (stdio/SSE) │  │ Transport   │  │ (Express SPA)   │ │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         │                │                   │          │
│  ┌──────┴────────────────┴───────────────────┴────────┐ │
│  │              Shared Services                        │ │
│  │  MetricsStore │ AuthContext │ PluginManager │ Cache │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Route Structure
```
/admin                    → SPA 入口 (index.html)
/admin/css/*              → 静态样式
/admin/js/*               → 静态脚本

/admin/api/auth/login     → POST 登录
/admin/api/auth/logout    → POST 登出
/admin/api/auth/status    → GET 认证状态

/admin/api/dashboard      → GET 仪表盘数据
/admin/api/keys           → GET API Key 列表
/admin/api/plugins        → GET 插件列表
/admin/api/plugins/:id    → DELETE 卸载插件
/admin/api/sessions       → GET 会话列表
/admin/api/sessions/:id   → DELETE 终止会话
/admin/api/tools          → GET 工具列表
/admin/api/config         → GET 系统配置
/admin/api/health         → GET 健康状态
```

### File Structure
```
MCP Server/
├── lib/
│   ├── admin-api.js          # REST API 路由 (Express Router)
│   └── admin-auth.js         # 管理后台认证中间件
├── admin/
│   ├── index.html            # SPA 入口
│   ├── css/
│   │   └── style.css         # 样式（暗色主题）
│   └── js/
│       ├── app.js            # 路由 + 页面切换
│       ├── api.js            # API 调用层
│       └── pages/
│           ├── dashboard.js  # 仪表盘页面
│           ├── keys.js       # API Key 管理
│           ├── plugins.js    # 插件管理
│           ├── sessions.js   # 会话监控
│           ├── tools.js      # 工具列表
│           ├── config.js     # 系统配置
│           └── health.js     # 健康检查
└── tests/
    └── unit/
        ├── admin-api.test.js
        └── admin-auth.test.js
```

### Authentication Flow
```
POST /admin/api/auth/login
  Body: { "password": "xxx" }
  ├── password === MCP_ADMIN_PASSWORD
  │   ├── YES → generate session token, set cookie, return { ok: true }
  │   └── NO  → return 401 { ok: false, error: "Invalid password" }
  └── MCP_ADMIN_PASSWORD not set → return 503 { ok: false, error: "Admin disabled" }

GET /admin/api/*
  ├── Check admin_session cookie
  │   ├── Valid → continue to handler
  │   └── Invalid/Missing → return 401
  └── Handler returns data
```

### Data Sources
| API Endpoint | Data Source | Module |
|---|---|---|
| `/admin/api/dashboard` | `metrics.getMetrics()` | `lib/observability.js` |
| `/admin/api/keys` | `authContext.apiKeys` | `mcp-auth.js` |
| `/admin/api/plugins` | `pluginManager.getPlugins()` | `lib/plugin-system.js` |
| `/admin/api/sessions` | `httpSessions` Map | `mcp-server.js` |
| `/admin/api/tools` | `registeredTools` array | `mcp-server.js` |
| `/admin/api/config` | `process.env` + `process` | Node.js runtime |
| `/admin/api/health` | `circuitBreaker` + `sapCache` | `mcp-sap-core.js` |

### Security Considerations
- Admin password never logged or exposed in API responses
- API Keys masked: first 8 chars + `***`
- Sensitive env vars masked: `*PASSWORD*`, `*KEY*`, `*SECRET*`, `*TOKEN*`
- Session token: 32-byte random hex, stored in memory
- Cookie: `HttpOnly`, `SameSite=Strict`, `Path=/admin`
- Rate limiting: 10 login attempts per minute (prevent brute force)

## 4. UI Design

### Layout
```
┌──────────────────────────────────────────────────────────┐
│  ES-MCP-Server Admin                          [Logout]   │
├──────────┬───────────────────────────────────────────────┤
│          │                                               │
│ Dashboard│              Content Area                     │
│ API Keys │                                               │
│ Plugins  │                                               │
│ Sessions │                                               │
│ Tools    │                                               │
│ Config   │                                               │
│ Health   │                                               │
│          │                                               │
└──────────┴───────────────────────────────────────────────┘
```

### Theme
- Dark mode default (developer-friendly)
- Color palette: `#1a1a2e` (bg), `#16213e` (sidebar), `#0f3460` (accent), `#e94560` (alert)
- Monospace font for data display
- Responsive: sidebar collapses on mobile

### Dashboard Cards
```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   Requests  │ │  Success %  │ │   p50 (ms)  │ │   p95 (ms)  │
│    1,234    │ │    98.5%    │ │     45      │ │     120     │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

## 5. Acceptance Criteria

### Authentication
- [ ] `MCP_ADMIN_PASSWORD` not set → `/admin/api/*` returns 503
- [ ] Valid password → returns session cookie
- [ ] Invalid password → returns 401
- [ ] Expired session → returns 401
- [ ] Logout → clears session

### Dashboard
- [ ] Displays request count, success rate, p50/p95
- [ ] Displays SAP call stats
- [ ] Displays cache hit rate
- [ ] Displays uptime
- [ ] Auto-refresh every 5 seconds

### API Keys
- [ ] Lists all keys with masked values
- [ ] Shows role, failure count, lock status
- [ ] Locked keys show remaining lock time

### Plugins
- [ ] Lists loaded plugins with tool counts
- [ ] Unload button removes plugin
- [ ] Unload updates tool registry

### Sessions
- [ ] Lists active HTTP sessions
- [ ] Shows session ID, created time, last active time
- [ ] Terminate button removes session

### Tools
- [ ] Lists all 34+ registered tools
- [ ] Shows name, description, parameter schema
- [ ] Groups by business domain

### Config
- [ ] Shows env vars (sensitive values masked)
- [ ] Shows Node version, platform, memory
- [ ] Shows package version

### Health
- [ ] Shows SAP connection status
- [ ] Shows circuit breaker state
- [ ] Shows cache status
- [ ] Shows auto-pagination status
- [ ] Shows HTTP transport status

### Testing
- [ ] `admin-auth.test.js` — 8+ test cases
- [ ] `admin-api.test.js` — 15+ test cases
- [ ] All existing tests still pass

## 6. Environment Variables

| Variable | Description | Default |
|---|---|---|
| `MCP_ADMIN_PASSWORD` | Admin dashboard password | (empty = disabled) |
| `MCP_ADMIN_SESSION_TTL` | Session TTL in milliseconds | `28800000` (8h) |

## 7. Dependencies

- **express** — already in package.json (used by metrics-server.js)
- **cookie-parser** — new dependency for session cookie handling

## 8. Files

| File | Responsibility |
|---|---|
| `lib/admin-auth.js` | Session management, auth middleware, login/logout |
| `lib/admin-api.js` | Express Router with all `/admin/api/*` endpoints |
| `admin/index.html` | SPA entry point |
| `admin/css/style.css` | Dark theme styles |
| `admin/js/app.js` | Client-side router, page switching |
| `admin/js/api.js` | Fetch wrapper for admin API |
| `admin/js/pages/*.js` | Page modules (7 pages) |
| `mcp-server.js` | Integration: mount admin routes, pass shared services |
| `tests/unit/admin-auth.test.js` | Auth unit tests |
| `tests/unit/admin-api.test.js` | API endpoint unit tests |
