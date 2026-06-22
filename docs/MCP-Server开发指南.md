# MCP Server 开发指南

SAP S/4HANA MCP Server（代号 **sap-s4-mcp**）设计规格与实现说明。供 AI Agent（Cursor、Claude Desktop 等）通过 MCP 协议查询 SAP 业务数据。

---

## 1. 项目状态

| 项 | 状态 |
|----|------|
| 工具规格（20 个） | ✅ 已定稿并实现 |
| SAP 底层 API 探测 | ✅ 24/42 端点 OK（见连通性手册） |
| 环境配置 `.env.example` | ✅ |
| 依赖 `node_modules` | ✅ 已安装（`@modelcontextprotocol/sdk`、`zod`、`hono` 等） |
| **源码** `mcp-server.js` 等 | ✅ **已实现** — Phase 0→4 全部完成 |
| stdio / HTTP 端到端验证 | ✅ 冒烟测试通过（20 工具注册、API Key 鉴权、错误处理） |
| 凭证单元测试 | ✅ 11 个测试通过（`pnpm test`） |
| 共享端点表 | ✅ `lib/sap-endpoints.js`（42 项），探测脚本复用 |

---

## 2. 架构

```
┌─────────────────┐     stdio / HTTP      ┌──────────────────┐
│  Cursor /       │ ◄──────────────────► │  mcp-server.js   │
│  Claude Desktop │     MCP JSON-RPC     │  (McpServer SDK) │
└─────────────────┘                       └────────┬─────────┘
                                                   │
                                          mcp-sap-core.js
                                          (凭证、HTTP、场景路由)
                                                   │
                                                   ▼
                                    ┌──────────────────────────┐
                                    │  SAP S/4HANA Cloud OData   │
                                    │  Basic Auth + sap-client   │
                                    └──────────────────────────┘
```

### 传输模式

| 模式 | 入口 | 配置 |
|------|------|------|
| **stdio**（默认） | `node mcp-server.js` | Cursor `mcp.json` 中 `command` + `args` |
| **HTTP** | `GET /`、`POST/GET /mcp` | `MCP_ENABLE_HTTP_TRANSPORT=true`，端口 `MCP_PORT` |

### 建议源码结构

```
MCP Server/
├── package.json
├── mcp-server.js          # 入口：注册工具、启动传输
├── mcp-sap-core.js        # SAP HTTP 客户端、凭证、场景映射
├── lib/
│   ├── credentials.js     # 解析 user.txt（中英文）
│   ├── sap-endpoints.js   # 42 个 SAP 场景/端点共享注册表
│   └── tools.js           # 20 个工具 handler
├── test/
│   └── credentials.test.js # 凭证解析单元测试
├── .env
└── README.md
```

---

## 3. 环境变量

复制 `.env.example` 为 `.env`：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SAP_BASE_URL` | `https://my200967-api.s4hana.sapcloud.cn` | API 根 URL |
| `SAP_CLIENT` | `100` | OData `sap-client` |
| `SAP_CREDENTIALS_FILE` | `../user.txt` | 凭证文件 |
| `SAP_SCENARIO_DIR` | `..` | 扫描 `SAP_COM_*.txt` 的目录（可选） |
| `MCP_PORT` | `3000` | HTTP 端口 |
| `MCP_BIND_ADDRESS` | `127.0.0.1` | 绑定地址 |
| `MCP_ENABLE_HTTP_TRANSPORT` | `true` | 是否启用 HTTP |
| `MCP_API_KEY` | `change-me` | HTTP / `authenticate` 工具用的 API Key |
| `MCP_REQUIRE_API_KEY` | `false` | stdio 是否强制 API Key |
| `SAP_REQUEST_TIMEOUT_MS` | `30000` | OData 请求超时 |
| `SAP_CACHE_TTL_MS` | `0` | 响应缓存（0=关闭） |

---

## 4. 凭证解析要求

`mcp-sap-core.js`（或 `lib/credentials.js`）须与 `scripts/probe-sap-connectivity.js` **使用相同解析逻辑**，支持：

```javascript
// 用户
/User Name:\s*([^\s\r\n]+)/gi
/User ID:\s*([^\s\r\n]+)/gi
/(?:接口调用的)?通信用户[：:]\s*([^\s\r\n]+)/gi

// 密码
/密码[：:]\s*([^\s\r\n]+)/g
/或者这个[：:]\s*([^\s\r\n]+)/g
/^Password(?:Alt)?:\s*(.+)$/gim
```

对 SAP 请求依次尝试「用户 × 密码」组合，与探测脚本行为一致。

---

## 5. MCP 工具清单

### 5.1 基础设施（4 个）

#### `authenticate`

| 项 | 值 |
|----|-----|
| 用途 | API Key 认证（HTTP 模式或可选 stdio 门禁） |
| 入参 | `{ api_key: string }` |
| 出参 | `{ success: boolean, role: string }` |
| SAP 依赖 | 无 |
| 状态 | ✅ 已实现 |

#### `health_check`

| 项 | 值 |
|----|-----|
| 用途 | 服务健康检查，可选附带 SAP 探测 |
| 入参 | `{ includeSapCheck?: boolean, includeScenarios?: boolean }` |
| 出参 | `checks` 对象（mcp、sap、scenarios 等子项） |
| SAP 依赖 | 可选调用探测逻辑或抽样 GET |
| 状态 | ✅ 已实现 |

#### `list_sap_scenarios`

| 项 | 值 |
|----|-----|
| 用途 | 列出已配置的 SAP 通信场景 |
| 入参 | `{}` |
| 出参 | `{ scenarios: [{ key, title, baseUrl, ... }] }` |
| SAP 依赖 | 扫描 `SAP_SCENARIO_DIR` 下 `SAP_COM_*.txt` 或内置表 |
| 状态 | ✅ 已实现 |

#### `get_entity_schema`

| 项 | 值 |
|----|-----|
| 用途 | 获取 OData 实体字段元数据 |
| 入参 | `{ service: string, entity: string }` |
| 出参 | 字段 schema（来自 `$metadata` 或缓存） |
| SAP 依赖 | 对应服务 `$metadata` |
| 状态 | ✅ 已实现 |

---

### 5.2 业务查询（7 个，底层 API 已验证 OK）

#### `get_sales_order_status`

| 项 | 值 |
|----|-----|
| 入参 | `{ salesOrder?: string, includeItems?: boolean }` |
| 出参 | 订单状态 + 可选行项目 |
| SAP 场景 | SAP_COM_0109 |
| OData | `api_salesorder/.../SalesOrder` |
| 探测状态 | OK(200) |

示例过滤：`$filter=SalesOrder eq 'xxx'` 或按单号 key 读取。

#### `get_product`

| 项 | 值 |
|----|-----|
| 入参 | `{ product?: string, filter?: string, top?: number }` |
| 出参 | 产品主数据 |
| SAP 场景 | SAP_COM_0009 |
| OData | V2 `API_PRODUCT_SRV/A_Product`；V4 `api_product/.../Product` |
| 探测状态 | OK(200) |

#### `get_business_partner`

| 项 | 值 |
|----|-----|
| 入参 | `{ customer?: string, supplier?: string, filter?: string, top?: number }` |
| 出参 | 客户 / 供应商 / 伙伴数据 |
| SAP 场景 | SAP_COM_0008 |
| OData | `A_Customer`、`A_Supplier`、`A_SupplierCompany` |
| 探测状态 | OK(200) |

#### `get_purchase_order`

| 项 | 值 |
|----|-----|
| 入参 | `{ purchaseOrder?: string, includeItems?: boolean, includeSchedule?: boolean, includePricing?: boolean, includeNotes?: boolean }` |
| 出参 | 采购订单抬头 + 可选子实体 |
| SAP 场景 | SAP_COM_0053（V4）；legacy V2 |
| OData | `api_purchaseorder_2/...` 全套 Entity |
| 探测状态 | OK(200) |

实现建议：`includeItems=true` 时按需追加 `PurchaseOrderItem`、`PurchaseOrderScheduleLine`、`PurOrderItemPricingElement`、Note 等调用（每 PO 约 2–4 次请求，非每行 5 次）。

#### `get_material_stock`

| 项 | 值 |
|----|-----|
| 入参 | `{ material?: string, plant?: string, filter?: string }` |
| 出参 | 库存数量 |
| SAP 场景 | SAP_COM_0164 |
| OData | `API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod` |
| 探测状态 | OK(200) |

#### `get_supplier_invoice`

| 项 | 值 |
|----|-----|
| 入参 | `{ invoice?: string, fiscalYear?: string, includeLines?: boolean }` |
| 出参 | 供应商发票抬头 + 可选 PO 参考行 |
| SAP 场景 | legacy V2（**推荐**）；V4 需 SAP_COM_0054 |
| OData V2 | `API_SUPPLIERINVOICE_PROCESS_SRV`：`A_SupplierInvoice`、`A_SuplrInvcItemPurOrdRef` |
| 探测状态 | V2 OK(200)；V4 FAIL(403) |

默认走 V2 三条 URL，见连通性手册第 5 节。

#### `get_cost_center`

| 项 | 值 |
|----|-----|
| 入参 | `{ costCenter?: string, companyCode?: string, filter?: string }` |
| 出参 | 成本中心主数据 |
| SAP 场景 | SAP_COM_0008 |
| OData | `api_cost_center/.../A_CostCenter_2` |
| 探测状态 | OK(200) |

---

### 5.3 扩展查询（6 个，场景未开通或未探测）

以下工具在 Excel 中标记为 **SAP 401/403**，实现时应对 SAP 错误做明确返回，并在 Arrangement 开通后启用。

| 工具 | 通信场景 | 说明 |
|------|----------|------|
| `trace_sales_order` | 0109 + 0106 + 0124 + 0108 | 按销售订单串联交货、开票、生产、物料凭证；**底层子 API 均已 OK**，可实现 |
| `query_sap_scenario` | 通用 | `{ key, entity?, filter?, top? }` 按场景 key 动态查询 |
| `get_purchase_requisition` | SAP_COM_0102 | 采购申请 V4 |
| `get_schedule_agreement` | SAP_COM_0103 | 计划协议 V2 |
| `get_sales_contract` | SAP_COM_0119 | 销售合同 V4 |
| `get_bom` | — | `API_BILL_OF_MATERIAL_SRV` |
| `get_material_reservation` | — | Reservation V4 |

`trace_sales_order` 优先级高：探测显示销售订单、外向交货、开票、物料凭证均为 200，应作为 Phase 2 首批实现。

---

## 6. HTTP 端点

| 路径 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 服务信息 JSON（名称、版本、工具数） |
| `/mcp` | POST / GET | MCP Streamable HTTP 协议端点 |

鉴权：请求头 `Authorization: Bearer <MCP_API_KEY>`（当 `MCP_REQUIRE_API_KEY=true`）。

---

## 7. Cursor 接入配置

在 Cursor Settings → MCP 中添加（stdio 模式，源码就绪后）：

```json
{
  "mcpServers": {
    "sap-s4": {
      "command": "node",
      "args": ["E:\\00 - 中数通ES环境\\ES 接口\\MCP Server\\mcp-server.js"],
      "env": {
        "SAP_CREDENTIALS_FILE": "E:\\00 - 中数通ES环境\\ES 接口\\user.txt"
      }
    }
  }
}
```

HTTP 模式（可选）：

```json
{
  "mcpServers": {
    "sap-s4-http": {
      "url": "http://127.0.0.1:3000/mcp",
      "headers": {
        "Authorization": "Bearer change-me"
      }
    }
  }
}
```

---

## 8. 错误处理约定

工具返回应区分以下情况，便于 Agent 理解：

| SAP HTTP | MCP 层建议 |
|----------|------------|
| 200 | 正常返回 OData JSON（V2 取 `d.results`，V4 取 `value`） |
| 401 | `error: "SAP_AUTH_FAILED"` — 检查 user.txt |
| 403 | `error: "SAP_ARRANGEMENT_REQUIRED"` — 注明场景号（0087/0054 等） |
| 404 | `error: "SAP_NOT_FOUND"` — 路径或实体不存在 |
| 超时 | `error: "SAP_TIMEOUT"` |

---

## 9. 开发路线图

### Phase 0 — 脚手架 ✅

- [x] 创建 `package.json`、`mcp-server.js`、`mcp-sap-core.js`
- [x] 凭证解析（与探测脚本一致）
- [x] stdio 传输 + `health_check`

### Phase 1 — MVP 工具 ✅

- [x] 8 个已验证工具：`health_check`、`get_product`、`get_business_partner`、`get_sales_order_status`、`get_purchase_order`、`get_material_stock`、`get_supplier_invoice`、`get_cost_center`

### Phase 2 — 增强工具 ✅

- [x] `trace_sales_order`、`query_sap_scenario`
- [x] HTTP 传输 + `authenticate`
- [x] `list_sap_scenarios`、`get_entity_schema`
- [x] SAP 错误映射（401/403/404/超时）
- [x] 响应缓存（`SAP_CACHE_TTL_MS`）

### Phase 3 — 扩展场景 ✅

- [x] 采购申请、计划协议、销售合同、BOM、预留单（含 403 hint，待 Arrangement 开通）
- [x] 主数据查询 `get_master_data`（SAP_COM_0087，待开通）
- [x] 供应商发票 V4 `get_supplier_invoice_v4`（SAP_COM_0054，待开通）

### Phase 4 — 运维 ✅

- [x] 单元测试（凭证解析，11 个测试通过）
- [x] 与 `probe-sap-connectivity.js` 共享端点表（`lib/sap-endpoints.js`，42 项）
- [x] Git 入库，`.env` / `user.txt` 加入 `.gitignore`

---

## 10. 相关文件

| 文件 | 说明 |
|------|------|
| `ES接口清单.xlsx` | 工具 + OData 总表（机器可读备份：`Probe_Latest.json`） |
| `docs/SAP接口连通性手册.md` | 33 端点详情 |
| `MCP Server/.env.example` | 环境变量模板 |
| `MCP Server/PATCH-credentials.md` | 凭证解析补丁备忘（已并入本指南 §4） |
| `scripts/probe-sap-connectivity.js` | 连通性探测（实现时复用 ENDPOINTS 表） |

---

## 11. package.json

```json
{
  "name": "sap-s4-mcp",
  "version": "0.1.0",
  "description": "SAP S/4HANA MCP Server for ES/EPC integration",
  "main": "mcp-server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node mcp-server.js",
    "probe": "node ../scripts/probe-sap-connectivity.js",
    "test": "node test/credentials.test.js"
  },
  "dependencies": {
    "@hono/node-server": "^2.0.6",
    "@modelcontextprotocol/sdk": "^1.29.0",
    "dotenv": "^16.4.0",
    "hono": "^4.12.26",
    "zod": "^4.4.3"
  },
  "engines": {
    "node": ">=18"
  }
}
```

（依赖版本以现有 `node_modules` 为准。）
