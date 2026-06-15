# User Stories — SAP S/4HANA MCP Server

> 版本: 1.0 | 更新: 2026-06-15

## 角色定义

| 角色 | 标识 | 描述 |
|---|---|---|
| 业务 Agent | `agent-biz` | 回答用户业务问题，只读查询 |
| 运维 Agent | `agent-ops` | 巡检、监控、故障排查 |
| 管理 Agent | `agent-admin` | 插件管理、调试、配置变更 |

---

## US-001: Agent 认证接入

**As** 任何 Agent
**I want** 用预共享密钥认证
**So that** 我能安全地调用 SAP 查询工具

### Acceptance Criteria
- [x] 调用 `authenticate` 传入 `api_key` 成功返回 `authenticated: true`
- [x] 错误密钥返回 `AUTH_INVALID_KEY`
- [x] 连续 5 次失败触发 30s 锁定 (`AUTH_LOCKED`)
- [x] 未认证调用业务工具返回 `AUTH_REQUIRED`
- [x] `MCP_REQUIRE_API_KEY=true` 时禁止自动生成密钥

### 关联
- PRD §2.2
- Constitution §2.1

---

## US-002: 查询销售订单状态

**As** 业务 Agent
**I want** 按销售订单号查询订单头和行项目
**So that** 我能回答用户"订单 19 的状态是什么"

### Acceptance Criteria
- [x] `get_sales_order_status("19")` 返回订单头 + 行项目
- [x] 不存在的订单返回 `found: false`
- [x] 支持 `includeItems=false` 只查头
- [x] 销售订单号只允许数字字符
- [x] `top` 默认 20，最大 50

### 关联
- PRD §2.1
- 工具: `get_sales_order_status`

---

## US-003: 追踪销售订单全链路

**As** 业务 Agent
**I want** 查看销售订单的交货、生产、物料凭证、开票
**So that** 我能回答"订单 19 的货发了吗？生产完成了吗？"

### Acceptance Criteria
- [x] `trace_sales_order("19")` 并行查询 4 个下游 API
- [x] 部分失败返回 `TRACE_PARTIAL_FAILURE` + 成功数据
- [x] 每个链路可独立开关 (`includeDeliveries` 等)
- [x] 全成功返回全量数据
- [x] `top` 默认 20，最大 50

### 关联
- PRD §2.1
- 工具: `trace_sales_order`

---

## US-004: 查询采购订单

**As** 业务 Agent
**I want** 按 PO 号/供应商/公司代码查询采购订单
**So that** 我能回答"供应商 X 的 PO 状态是什么"

### Acceptance Criteria
- [x] 支持单号或逗号分隔多号查询
- [x] 支持按供应商/公司代码/PO类型过滤
- [x] `includeItems=true` 返回行项目
- [x] 至少一个过滤条件

### 关联
- PRD §2.1
- 工具: `get_purchase_order`

---

## US-005: 查询物料库存

**As** 业务 Agent
**I want** 查询物料在各工厂/库位的库存
**So that** 我能回答"FG10 在 1010 工厂有多少库存"

### Acceptance Criteria
- [x] 至少提供 `material` 或 `plant`
- [x] 支持批次信息 (`includeBatchInfo`)
- [x] 支持库位过滤

### 关联
- PRD §2.1
- 工具: `get_material_stock`

---

## US-006: 服务健康检查

**As** 运维 Agent
**I want** 检查 MCP Server 和 SAP 连通性
**So that** 我能快速判断服务是否正常

### Acceptance Criteria
- [x] 未认证只返回 `server.ok` + `auth.ok: false`
- [x] 已认证返回凭据文件/场景目录/SAP 连通性/指标
- [x] `includeSapCheck=false` 跳过真实 SAP 调用
- [x] 场景文件缺失/不可读时 warning

### 关联
- PRD §2.1
- Constitution §2.3

---

## US-007: 理解实体字段

**As** 业务 Agent
**I want** 查看 OData 实体的字段名、类型、主键
**So that** 我能构造正确的过滤条件

### Acceptance Criteria
- [x] `get_entity_schema("sap_com_0109_sales_order", "A_SalesOrder")` 返回字段列表
- [x] 支持 `useCache=false` 强制刷新
- [x] 自动从场景文件中解析 $metadata URL

### 关联
- PRD §2.1
- 工具: `get_entity_schema`

---

## US-008: 角色权限控制

**As** 管理 Agent
**I want** 通过环境变量控制 Agent 能使用的工具范围
**So that** 普通 Agent 不能用调试/管理工具

### Acceptance Criteria
- [x] `MCP_ROLE=readonly` → 仅业务工具
- [x] `MCP_ROLE=debug` → +`query_sap_scenario`
- [x] `MCP_ROLE=admin` → +插件管理
- [x] `MCP_ENABLE_*` 显式覆盖优先级高于 `MCP_ROLE`

### 关联
- Constitution §2.2
- PRD §2.2
- 实现: `lib/roles.js`

---

## US-009: SAP 调用限流

**As** 运维 Agent
**I want** 限制对 SAP 的并发和速率
**So that** 多个 Agent 并发查询不会压垮 SAP 或被 SAP 限流

### Acceptance Criteria
- [x] 并发上限 (`MCP_SAP_MAX_CONCURRENT`，默认 5)
- [x] 速率限制 (`MCP_SAP_RATE_PER_MIN`，默认 60)
- [x] 超限入队等待（30s 超时）
- [x] 断路器：连续失败 3 次 → 30s 熔断

### 关联
- Constitution §4.3
- PRD §2.2
- 实现: `lib/rate-limiter.js`

---

## US-010: 容器化部署

**As** 运维 Agent
**I want** 用 Docker 部署 MCP Server
**So that** 能在 Kubernetes 或 ACI 中运行

### Acceptance Criteria
- [x] `Dockerfile` 多阶段构建 (build + runtime)
- [x] 非 root 用户运行
- [x] `HEALTHCHECK` 指令
- [x] `.dockerignore` 排除 dev 文件
- [x] `.env.example` 全量环境变量文档

### 关联
- PRD §5
- 产出: `Dockerfile`, `.dockerignore`, `.env.example`

---

## 状态摘要

| US | 标题 | 状态 |
|---|---|---|
| US-001 | Agent 认证接入 | ✅ 完成 |
| US-002 | 查询销售订单状态 | ✅ 完成 |
| US-003 | 追踪销售订单全链路 | ✅ 完成 |
| US-004 | 查询采购订单 | ✅ 完成 |
| US-005 | 查询物料库存 | ✅ 完成 |
| US-006 | 服务健康检查 | ✅ 完成 |
| US-007 | 理解实体字段 | ✅ 完成 |
| US-008 | 角色权限控制 | ✅ 完成 |
| US-009 | SAP 调用限流 | ✅ 完成 |
| US-010 | 容器化部署 | ✅ 完成 |
