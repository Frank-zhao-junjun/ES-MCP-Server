## 项目概述
- **项目名称**：ES-MCP-Server (SAP S/4HANA MCP Server)
- **类型**：MCP Server（Model Context Protocol）后端服务
- **描述**：为 AI Agent 提供安全、只读的 SAP S/4HANA Cloud OData 查询能力的 MCP Server

## 技术栈
- **语言**：JavaScript (Node.js 20+)
- **包管理器**：npm
- **核心依赖**：
  - `@modelcontextprotocol/sdk` — MCP 协议 SDK
  - `express` — HTTP 服务端
  - `cors` — 跨域支持
  - `zod` — 参数校验
  - `prom-client` — Prometheus 指标

## 目录结构
```
/workspace/projects/
├── MCP Server/                    # 核心项目目录
│   ├── mcp-server.js              # MCP 服务端入口
│   ├── mcp-sap-core.js            # SAP OData 客户端核心
│   ├── mcp-auth.js                # API Key 认证
│   ├── runtime-context.js         # 运行时上下文
│   ├── package.json               # 项目依赖
│   ├── mcp.json                   # MCP 客户端配置模板
│   ├── Dockerfile                 # 容器化部署
│   ├── .env.example               # 环境变量模板
│   ├── README.md                  # 项目说明
│   ├── WORKLOG.md                 # 工作日志
│   ├── AGENT_USAGE.md             # Agent 调用指南
│   ├── docs/                      # 产品文档
│   │   ├── PRD.md                 # 产品需求文档
│   │   ├── spec.md                # Phase 2&3 技术规格
│   │   ├── user-stories.md        # 21 个 User Story
│   │   ├── tasks.md               # 任务计划
│   │   ├── deployment-guide.md    # 部署指南
│   │   ├── business-logic.md      # 业务逻辑流程图
│   │   ├── plugin-system-guide.md # 插件系统指南
│   │   ├── enhancements-overview.md
│   │   └── parameter-validation-rules.md
│   ├── .specify/                  # Specify 规格系统
│   │   ├── memory/constitution.md # 项目宪法
│   │   └── specs/001~005/         # 5 个技术规格
│   ├── lib/                       # 横切关注点库
│   │   ├── errors.js              # 错误码定义
│   │   ├── mcp-response.js        # MCP 响应封装
│   │   ├── roles.js               # 角色权限
│   │   ├── rate-limiter.js        # 限流器
│   │   ├── observability.js       # 可观测性（trace/metrics）
│   │   ├── sap-cache.js           # SAP 响应缓存
│   │   ├── auto-pagination.js     # 自动分页
│   │   ├── metrics-server.js      # Prometheus 指标端点
│   │   ├── dynamic-loader.js      # 动态加载器
│   │   ├── plugin-loader.js       # 插件加载器
│   │   └── plugin-system.js       # 插件系统核心
│   ├── services/                  # 业务工具服务（27 个）
│   │   ├── sales-order-status.js
│   │   ├── sales-order-trace.js
│   │   ├── purchase-order.js
│   │   ├── purchase-requisition.js
│   │   ├── schedule-agreement.js
│   │   ├── sales-contract.js
│   │   ├── material-reservation.js
│   │   ├── product.js
│   │   ├── business-partner.js
│   │   ├── material-stock.js
│   │   ├── bom.js
│   │   ├── supplier-invoice.js
│   │   ├── cost-center.js
│   │   ├── entity-schema.js
│   │   ├── purchase-rfq.js        # US-API-007
│   │   ├── supplier-evaluation.js # US-API-008
│   │   ├── service-entry-sheet.js # US-API-009
│   │   ├── sales-quotation.js     # US-API-012
│   │   ├── sales-pricing-condition.js # US-API-014
│   │   ├── production-data.js     # US-API-016
│   │   ├── production-order-confirmation.js # US-API-017
│   │   ├── routing.js             # US-API-019
│   │   ├── inspection-data.js     # US-API-020
│   │   ├── physical-inventory.js  # US-API-025
│   │   ├── activity-type.js       # US-API-027
│   │   ├── attachment.js          # US-API-028
│   │   └── iam-user-role.js       # US-API-029
│   ├── config/                    # 配置文件
│   │   └── trace-config.json      # 追踪步骤配置
│   ├── tests/                     # 测试目录
│   │   ├── run-tests.js           # 测试运行器
│   │   ├── unit/                  # 单元测试（39 个模块）
│   │   ├── integration/           # 集成测试
│   │   └── contract/              # 契约测试
│   ├── scripts/                   # 工具脚本
│   │   ├── probe-all-apis.js      # API 探测
│   │   └── mark-ac.js             # AC 标记
│   └── examples/                  # 示例
│       └── sample-plugin.js
├── docs/                          # 根级文档
│   └── user-stories.md            # SAP API 资产清单（29 个 US-API）
├── public/                        # 静态文件
├── .coze                          # Coze 配置
└── AGENTS.md                      # 本文件
```

## 关键入口 / 核心模块
| 文件 | 职责 |
|---|---|
| `MCP Server/mcp-server.js` | MCP 协议适配 + 工具注册 + HTTP/SSE Transport |
| `MCP Server/mcp-sap-core.js` | SAP OData 客户端（sapFetch、断路器、缓存） |
| `MCP Server/mcp-auth.js` | API Key 认证（单键/多键 + 角色绑定 + 锁定） |
| `MCP Server/lib/roles.js` | 角色模型（readonly/debug/admin） |
| `MCP Server/lib/rate-limiter.js` | 并发限流 + 令牌桶 |
| `MCP Server/lib/observability.js` | Trace ID、MetricsStore、结构化日志 |

## 运行与预览
- **启动**：`cd "MCP Server" && npm start`（stdio 模式）
- **开发**：`npm run dev`
- **测试**：`npm test`
- **预览**：不支持（MCP Server 为后端服务）
- **部署**：Docker 多阶段构建，Node 20 Alpine

## 用户偏好与长期约束
- 只读查询，不提供 SAP 写入/审批/改单
- 零外部测试依赖（只用 `assert` + Node 内置模块）
- 绝不连接真实 SAP 系统进行测试
- US-Spec-PRD 三层文档驱动开发
- 每次工作完成后更新 `WORKLOG.md`

## 常见问题和预防
- `SAP_BASE_URL` 必填，无默认值
- `MCP_API_KEY` / `MCP_API_KEYS` 至少配置一个
- 生产环境必须设置 `MCP_REQUIRE_API_KEY=true`
- 插件路径必须在 `plugins/` 或 `examples/` 白名单内
