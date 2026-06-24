# AGENTS.md — ES-MCP-Server

## 项目概览

构建面向 SAP S/4HANA Cloud 的 MCP Server，暴露 20 个工具供 AI Agent 通过 HTTP 或 stdio 调用（8 个 MVP + 5 个 Phase 2 基础设施 + 7 个 Phase 3 被阻塞工具）。

- 仓库根目录：`E:\00 - 中数通ES环境\ES-MCP-Server`（GitHub: Frank-zhao-junjun/ES-MCP-Server）
- 旧目录 `ES 接口` 已归档，勿在此重复实现
- 源码目录：`MCP Server/`
- 文档目录：`docs/`
- 探测脚本：`scripts/`

## 开发流程（SDD Workflow）

**所有 Feature / User Story / Bugfix 必须遵循 6 阶段门禁流程：**

```
US → ① Unit Spec → ② PRD → ③ Testing Case → ④ Coding → ⑤ Unit Test → ⑥ E2E
```

**关键约束：** ③ 测试用例必须先于 ④ 编码（TDD）；④ ⑤ 使用 multi-agent dispatch 并行执行。

流程细节与 Red Flags 见 `.claude/skills/sdd-workflow/SKILL.md`，或通过 `/sdd-workflow` 调用。

| 阶段 | 负责 Skill | 阶段间门禁 |
|------|-----------|-----------|
| ① Unit Spec | superpowers:writing-plans | 所有 Unit 边界清晰 |
| ② PRD | superpowers:writing-plans | PRD 覆盖所有 Unit |
| ③ Testing Case | superpowers:test-driven-development | 用例覆盖 normal/error/boundary |
| ④ Coding | superpowers:subagent-driven-development | 每 Unit agent diff 已 apply |
| ⑤ Unit Test | superpowers:verification-before-completion | npm test 全绿 |
| ⑥ E2E | gstack:qa | checklist 全部打勾 |

## 目录结构

```
MCP Server/
├── package.json          # 依赖：@modelcontextprotocol/sdk, dotenv, zod, hono
├── mcp-server.js         # 入口：注册工具 + 启动 stdio / HTTP transport
├── mcp-sap-core.js       # SAP HTTP 客户端、缓存、错误映射、配置加载、$metadata 解析
├── lib/
│   ├── credentials.js    # 解析 ../user.txt（user:password 格式）
│   ├── sap-endpoints.js  # 共享 SAP 场景/端点注册表（33 项）
│   └── tools.js          # 13 个工具 handler
├── .env.example          # 环境变量模板
└── .env                  # 本地配置，不提交（已 .gitignore）
```

## 启动命令

```bash
cd "MCP Server"

# HTTP 模式（默认，供 Agent 通过 HTTP/SSE 调用）
node mcp-server.js

# stdio 模式（供 Claude Desktop 等本地 MCP 客户端调用）
node mcp-server.js --stdio
```

HTTP 模式监听 `MCP_BIND_ADDRESS:MCP_PORT`（默认 `127.0.0.1:3000`），MCP endpoint 为 `/mcp`。

## 配置

复制 `.env.example` 为 `.env`，关键环境变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SAP_BASE_URL` | `https://my200967-api.s4hana.sapcloud.cn` | SAP API 网关 |
| `SAP_CLIENT` | `100` | SAP client |
| `SAP_CREDENTIALS_FILE` | `../user.txt` | 用户名密码文件 |
| `SAP_REQUEST_TIMEOUT_MS` | `30000` | 请求超时 |
| `MCP_ENABLE_HTTP_TRANSPORT` | `true` | 是否启用 HTTP |
| `MCP_REQUIRE_API_KEY` | `false` | 是否启用 Bearer Token 鉴权 |
| `MCP_API_KEY` | `change-me` | API Key（启用鉴权时必填） |

`user.txt` 格式（仓库根目录）：

```
接口调用的通信用户：EPC_USER
密码：<密码>
```

或英文：`User Name:` / `Password:` / `PasswordAlt:`

## 工具清单

### MVP 工具 (Phase 1, 8 个)

| 工具名 | 说明 |
|--------|------|
| `health_check` | 服务健康检查，可选探测 SAP |
| `get_product` | 产品主数据 `API_PRODUCT_SRV/A_Product` |
| `get_business_partner` | 客户/供应商主数据 `API_BUSINESS_PARTNER` |
| `get_sales_order_status` | 销售订单状态 `API_SALES_ORDER_SRV` |
| `get_purchase_order` | 采购订单 `api_purchaseorder_2` |
| `get_material_stock` | 物料库存 `API_MATERIAL_STOCK_SRV` |
| `get_supplier_invoice` | 供应商发票 `API_SUPPLIER_INVOICE_PROCESS_SRV` |
| `get_cost_center` | 成本中心 `api_cost_center` |

### 基础设施 / 跨文档工具 (Phase 2, 5 个)

| 工具名 | 说明 |
|--------|------|
| `get_entity_schema` | 解析 `$metadata` 返回实体字段列表 |
| `list_sap_scenarios` | 列出 42 个内置 SAP 场景/端点 |
| `query_sap_scenario` | 按场景 key 动态执行 GET |
| `trace_sales_order` | 串联 SO → 外向交货 → 开票 → 物料凭证 |
| `authenticate` | 校验 MCP API Key |

### 被阻塞 / Arrangement 依赖工具 (Phase 3, 7 个)

| 工具名 | 说明 | 依赖场景 |
|--------|------|---------|
| `get_purchase_requisition` | 采购申请 V4 | SAP_COM_0102 |
| `get_schedule_agreement` | 计划协议 V4 | SAP_COM_0103 |
| `get_sales_contract` | 销售合同 V4 | SAP_COM_0119 |
| `get_bom` | BOM 物料清单 V2 | API_BILL_OF_MATERIAL_SRV |
| `get_material_reservation` | 预留 V4 | SAP_COM_0225 |
| `get_supplier_invoice_v4` | 供应商发票 V4 | SAP_COM_0054 |
| `get_master_data` | 主数据查询（工厂/付款条件/采购组织等） | SAP_COM_0087 |

## 本地验证

```bash
# 启动 HTTP 服务
cd "MCP Server" && node mcp-server.js &

# 检查基本信息
curl http://127.0.0.1:3000/

# MCP initialize（返回后获取 Mcp-Session-Id）
curl -i -X POST http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# 列出工具（携带上一步的 Session ID）
curl -X POST http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Session-Id: <session-id>' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

## 常见错误

- `SAP credentials file not found: ...`：缺少 `user.txt`，需创建并填写用户名密码。
- `SAP_AUTH_FAILED`：凭证被 SAP 拒绝，检查 user.txt。
- `SAP_ARRANGEMENT_REQUIRED`：API 未在 SAP 中启用 Communication Arrangement。
- `401 UNAUTHORIZED`：HTTP 模式启用了 `MCP_REQUIRE_API_KEY=true` 但请求未携带正确的 `Authorization: Bearer <MCP_API_KEY>`。

## 开发约定

- 仅使用 CommonJS（`require`），保持与 Node.js 直接运行兼容。
- 工具 handler 统一返回 `{ content: [{ type: 'text', text: JSON.stringify(result) }], isError?: boolean }`。
- SAP HTTP 调用优先尝试所有凭证组合，自动处理 V2 (`d.results`) 与 V4 (`value`) 响应结构。
- 不要提交 `.env`、`user.txt`、`node_modules`。
- **所有 Feature/Bugfix 开发必须遵循上方「开发流程（SDD Workflow）」6 阶段门禁。**

### 强制引用（开发前必读）

动手改代码前，Agent **必须**先打开并对照以下文档；未引用对应 Unit Spec / Test Case 不得进入 ④ Coding：

| 文档 | 用途 | 阶段 |
|------|------|------|
| [`.claude/skills/sdd-workflow/SKILL.md`](.claude/skills/sdd-workflow/SKILL.md) | 6 阶段门禁、Red Flags、产出物路径 | 全程 |
| [`docs/MVP需求说明.md`](docs/MVP需求说明.md) | MVP 权威需求、FR/NFR、§9 验收矩阵 | ② PRD / ⑥ E2E |
| [`docs/specs/units/`](docs/specs/units/) | 每个 Unit 的接口契约与验收标准 | ① Unit Spec |
| [`docs/tests/`](docs/tests/) | 测试用例（**必须先于编码**） | ③ Testing Case |
| [`docs/superpowers/plans/`](docs/superpowers/plans/) | 实施计划与任务拆解 | ④ ⑤ dispatch 前 |

**冲突裁决：** MVP 范围内，`docs/MVP需求说明.md` 优先于《MCP-Server开发指南》及其他文档。
