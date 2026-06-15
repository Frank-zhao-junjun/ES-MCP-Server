# User Stories — SAP S/4HANA MCP Server

> 版本: 0.4.0 | 更新: 2026-06-15

> **📋 交叉引用**：本文档描述 MCP 工具层的产品级用户故事（共 21 个 US）。
> 底层 SAP API 模块的资产清单见 [../../docs/user-stories.md](../../docs/user-stories.md)（US-API-001 ~ US-API-029，按主数据/采购/销售/生产/物流/财务/系统集成 8 大类编排）。

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
- [x] `top` 默认 20，最大 100

### 关联
- PRD §2.1
- 工具: `get_sales_order_status`
- SAP API: [US-API-010](../../docs/user-stories.md#us-api-010-销售订单同步)

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
- [x] `top` 默认 20，最大 100

### 关联
- PRD §2.1
- 工具: `trace_sales_order`
- SAP API: US-API-010/013/015/021/022（详见 [SAP API Inventory 映射表](../../docs/user-stories.md)）

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
- SAP API: [US-API-003](../../docs/user-stories.md#us-api-003-采购订单查询)

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
- SAP API: [US-API-023](../../docs/user-stories.md#us-api-023-库存查询)

---

## US-006: 服务健康检查

**As** 运维 Agent
**I want** 检查 MCP Server 和 SAP 连通性
**So that** 我能快速判断服务是否正常

### Acceptance Criteria
- [x] 未认证只返回 `server.ok` + `auth.ok: false`
- [x] 已认证返回凭据文件/场景目录/SAP 连通性/指标
- [x] `includeSapCheck=false` 跳过真实 SAP 调用
- [x] `includeScenarios=true` 返回场景列表状态（文件数 / 可用数 / 详情）
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
- SAP API: 全部 29 个 US-API 模块（元数据解析）

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

## US-011: 查询产品主数据

**As** 业务 Agent
**I want** 按产品编号或名称查询产品主数据
**So that** 我能回答"产品 FG10 的规格和单位是什么"

### Acceptance Criteria
- [x] `get_product("FG10")` 返回产品基本属性（描述、规格、单位）
- [x] 支持 `includeDescription=true` 获取多语言描述
- [x] 不存在的产品返回 `found: false`
- [x] `top` 默认 20，最大 100

### 关联
- PRD §2.1
- 工具: `get_product`

---

## US-012: 查询业务伙伴

**As** 业务 Agent
**I want** 按编号或名称查询客户/供应商主数据
**So that** 我能回答"客户 C001 的公司代码和销售范围是什么"

### Acceptance Criteria
- [x] `get_business_partner("C001")` 返回 BP 基本属性
- [x] 支持客户/供应商类型过滤
- [x] 支持 `includeSupplier=true` 获取供应商扩展信息
- [x] `top` 默认 20，最大 100

### 关联
- PRD §2.1
- 工具: `get_business_partner`

---

## US-013: 查询物料清单（BOM）

**As** 业务 Agent
**I want** 按物料编号查询 BOM 结构
**So that** 我能回答"产品 FG10 由哪些组件构成"

### Acceptance Criteria
- [x] `get_bom("FG10")` 返回 BOM 头 + 组件列表
- [x] 支持 `includeComponents=true` 展开组件明细
- [x] 不存在的 BOM 返回空组件列表
- [x] `top` 默认 20，最大 100

### 关联
- PRD §2.1
- 工具: `get_bom`

---

## US-014: 查询供应商发票

**As** 业务 Agent
**I want** 按供应商或 PO 号查询发票
**So that** 我能回答"供应商 X 的发票付款状态是什么"

### Acceptance Criteria
- [x] `get_supplier_invoice` 支持按供应商/PO号/日期过滤
- [x] 支持 `includeItems=true` 返回发票行项目
- [x] 至少一个过滤条件
- [x] `top` 默认 20，最大 100

### 关联
- PRD §2.1
- 工具: `get_supplier_invoice`

---

## US-015: 查询成本中心

**As** 业务 Agent
**I want** 按编号或名称查询成本中心
**So that** 我能回答"成本中心 CC001 的负责人和层次结构是什么"

### Acceptance Criteria
- [x] `get_cost_center("CC001")` 返回成本中心主数据
- [x] 支持 `includeText=true` 获取描述文本
- [x] 不存在的成本中心返回 `found: false`
- [x] `top` 默认 20，最大 100

### 关联
- PRD §2.1
- 工具: `get_cost_center`

---

## US-016: SAP 场景管理

**As** 运维 Agent / 业务 Agent
**I want** 浏览和查询已配置的 SAP 通信场景
**So that** 我能发现可用的 SAP API 并执行自定义查询

### Acceptance Criteria
- [x] `list_sap_scenarios` 返回所有场景的 key/code/title/端点数量
- [x] `query_sap_scenario(key, filter)` 对指定场景执行 OData 查询
- [x] 支持 `$top` / `$skip` 分页
- [x] 未知场景返回 `SCENARIO_NOT_FOUND`
- [x] 自动从场景文件解析 $metadata 发现 EntitySet

### 关联
- PRD §2.1
- 工具: `list_sap_scenarios`, `query_sap_scenario`

---

## US-017: 插件系统管理

**As** 管理 Agent
**I want** 动态加载/卸载/查看 MCP 工具插件
**So that** 无需重启服务器即可扩展工具能力

### Acceptance Criteria
- [x] `load_plugin(pluginPath)` 热加载 `.js` 插件文件并注册工具
- [x] `unload_plugin(pluginId)` 移除已加载插件及其工具
- [x] `list_loaded_plugins` 返回所有已加载插件的 ID/路径/工具列表
- [x] 仅 admin 角色可访问
- [x] 重复加载同一插件返回 `PLUGIN_ALREADY_LOADED`

### 关联
- PRD §2.2 / §4
- 工具: `load_plugin`, `unload_plugin`, `list_loaded_plugins`

---

## US-018: 查询采购申请

**As** 业务 Agent
**I want** 按采购申请号/采购组织/采购组/供应商查询采购申请
**So that** 我能回答"采购申请 PR1000001 的审批状态和行项目是什么"

### Acceptance Criteria
- [x] `get_purchase_requisition("1000001")` 返回 PR 头 + 行项目
- [x] 支持按采购组织/采购组/供应商过滤
- [x] 多值逗号分隔查询
- [x] `includeItems=true` 返回行项目明细
- [x] `top` 默认 20，最大 100

### 关联
- PRD §2.1
- 工具: `get_purchase_requisition`
- SAP API: [US-API-004](../../docs/user-stories.md#us-api-004-采购申请同步)

---

## US-019: 查询采购框架协议

**As** 业务 Agent
**I want** 按框架协议号/供应商查询采购框架协议（Schedule Agreement）
**So that** 我能回答"供应商 X 的框架协议 5500000001 的交货计划是什么"

### Acceptance Criteria
- [x] `get_schedule_agreement("5500000001")` 返回协议头 + 交货计划行项目
- [x] 支持按供应商/采购组织/采购组过滤
- [x] 多值逗号分隔查询
- [x] `includeItems=true` 返回行项目（含交货计划）
- [x] `top` 默认 20，最大 100

### 关联
- PRD §2.1
- 工具: `get_schedule_agreement`
- SAP API: [US-API-005](../../docs/user-stories.md#us-api-005-采购框架协议同步)

---

## US-020: 查询销售合同

**As** 业务 Agent
**I want** 按销售合同号/客户/销售组织查询销售合同
**So that** 我能回答"客户 X 的销售合同 4000000001 的有效期和行项目是什么"

### Acceptance Criteria
- [x] `get_sales_contract("4000000001")` 返回合同头 + 行项目
- [x] 支持按客户/销售组织/分销渠道/产品组过滤
- [x] 多值逗号分隔查询
- [x] `includeItems=true` 返回行项目明细
- [x] `top` 默认 20，最大 100

### 关联
- PRD §2.1
- 工具: `get_sales_contract`
- SAP API: [US-API-011](../../docs/user-stories.md#us-api-011-销售合同同步)

---

## US-021: 查询库存预留

**As** 业务 Agent
**I want** 按预留号/物料/工厂查询物料预留
**So that** 我能回答"工厂 1010 中物料 FG10 的预留 10000001 状态是什么"

### Acceptance Criteria
- [x] `get_material_reservation("10000001")` 返回预留头 + 行项目
- [x] 支持按物料/工厂/需求号过滤
- [x] 多值逗号分隔查询
- [x] `includeItems=true` 返回行项目（含需求数量/移动类型）
- [x] `top` 默认 20，最大 100

### 关联
- PRD §2.1
- 工具: `get_material_reservation`
- SAP API: [US-API-024](../../docs/user-stories.md#us-api-024-库存预留查询)

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
| US-011 | 查询产品主数据 | ✅ 完成 |
| US-012 | 查询业务伙伴 | ✅ 完成 |
| US-013 | 查询物料清单（BOM） | ✅ 完成 |
| US-014 | 查询供应商发票 | ✅ 完成 |
| US-015 | 查询成本中心 | ✅ 完成 |
| US-016 | SAP 场景管理 | ✅ 完成 |
| US-017 | 插件系统管理 | ✅ 完成 |
| US-018 | 查询采购申请 | ✅ 完成 |
| US-019 | 查询采购框架协议 | ✅ 完成 |
| US-020 | 查询销售合同 | ✅ 完成 |
| US-021 | 查询库存预留 | ✅ 完成 |
