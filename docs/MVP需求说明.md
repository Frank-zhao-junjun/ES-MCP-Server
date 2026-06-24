# ES-MCP-Server MVP 需求说明

| 项 | 内容 |
|---|---|
| **文档版本** | v1.2 |
| **编写日期** | 2026-06-24 |
| **项目名称** | ES-MCP-Server（sap-s4-mcp） |
| **仓库** | https://github.com/Frank-zhao-junjun/ES-MCP-Server |
| **本地根目录** | `E:\00 - 中数通ES环境\ES-MCP-Server` |
| **MVP 代号** | MVP-stdio-8tools |
| **状态** | §9.6 全矩阵验收完成：A1-A5 ✅ / T1-T8 ✅ / E1-E8 ✅ / C1-C3 ✅ / D1-D4 ✅ / git clean ✅ |

---

## 1. 背景

 ES/EPC 环境需对接 SAP S/4HANA Cloud（中国区租户 `my200967-api.s4hana.sapcloud.cn`），使业务人员与 AI Agent 能以自然语言查询销售、采购、库存、发票等数据，而无需直接操作 OData URL 或 SAP GUI。

前期在本地目录 `ES 接口` 完成了 OData 连通性探测（42 端点）、接口清单 Excel 与 MCP 工具规格设计。MCP Server 完整源码已迁入 Git 仓库 **ES-MCP-Server**，并确立为**唯一开发与部署根目录**；`ES 接口` 目录归档，不再重复实现。

本需求说明定义 **MVP（最小可行产品）** 的交付范围、功能规格与验收标准。

---

## 2. 建设目标

### 2.1 业务目标

| 编号 | 目标 | 说明 |
|------|------|------|
| G1 | Agent 可查 SAP 只读数据 | 通过 Cursor 等 MCP Client，用自然语言触发结构化查询 |
| G2 | 屏蔽 OData 复杂性 | Agent 只调用语义化工具名，不暴露 SAP URL、实体名拼写 |
| G3 | 支撑 ES/EPC 集成验证 | 采购订单、供应商发票等场景可用于 EPC Demo 与联调 |
| G4 | 可重复验收 | 有明确探测脚本、测试用例与 Checklist，非一次性演示 |

### 2.2 技术目标

| 编号 | 目标 | 说明 |
|------|------|------|
| T1 | 标准 MCP 协议 | 基于 `@modelcontextprotocol/sdk`，工具带 JSON Schema 入参 |
| T2 | stdio 本地接入 | Cursor / Claude Desktop 以子进程 stdio 连接，无需公网暴露 |
| T3 | SAP 桥接层内聚 | 凭证、HTTP、V2/V4 解析、错误映射集中在 `mcp-sap-core.js` + `lib/` |
| T4 | 单仓库交付 | 源码、文档、探测脚本、清单均在 `ES-MCP-Server` |

### 2.3 MVP 成功标准

> **通过 MCP Inspector（或任意标准 MCP Client）以 stdio 连接后，8 个只读工具均可成功调用 SAP 并返回 JSON；
> 文档明确 MVP 边界；
> ES 接口` 不再作为开发目录。**

---

## 3. 仓库与目录约定

### 3.1 唯一根目录

| 目录 | 角色 |
|------|------|
| **`ES-MCP-Server`** | ✅ 唯一开发、部署、Git 提交根目录 |
| `ES 接口` | ⚠️ 已归档，仅保留历史探测脚本与 JSON，**禁止**在此目录新增 MCP 源码 |
| `ES+EPC Demo系统搭建\EPC接口` | 关联项目，负责字段映射与 EPC 业务逻辑，消费 MCP 返回的 JSON |

### 3.2 仓库结构（MVP 相关）

```
ES-MCP-Server/
├── user.txt                      # SAP 凭证（本地，.gitignore）
├── Probe_Latest.json             # 探测结果（事实来源）
├── ES接口清单.xlsx               # 接口总表
├── docs/
│   ├── MVP需求说明.md            # 本文档
│   ├── MCP-Server开发指南.md
│   ├── SAP接口连通性手册.md
│   └── TASKS.md
├── scripts/
│   ├── probe-sap-connectivity.js # SAP 连通性探测（验收前置）
│   └── sync-excel-from-probe.py
└── MCP Server/                   # ★ MCP 唯一实现位置
    ├── mcp-server.js             # L2：MCP 协议、工具注册
    ├── mcp-sap-core.js           # L3：SAP HTTP 桥接
    ├── lib/
    │   ├── credentials.js
    │   ├── sap-endpoints.js
    │   └── tools.js
    ├── test/credentials.test.js
    ├── .env / .env.example
    └── package.json
```

### 3.3 分层职责

```
L1  MCP Client（Agent）
         │  stdio，MCP tools/call
L2  mcp-server.js
         │  入参校验（zod）、工具注册、传输选择
L3  mcp-sap-core.js + lib/tools.js
         │  Basic Auth、OData GET、V2/V4 解析、错误映射
L4  SAP S/4HANA Cloud OData
```

---

## 4. 用户与使用场景

### 4.1 目标用户

| 用户 | 使用方式 |
|------|----------|
| 业务/集成人员 | 在 Agent 中用自然语言查 SAP 数据 |
| 开发人员 | 维护 MCP 工具、跑探测与验收 |
| EPC 项目 | 后续通过 MCP 或 HTTP 拉取 PO/发票原始 JSON |

### 4.2 MVP 用户故事

| ID | 角色 | 场景 | 期望工具 |
|----|------|------|----------|
| US-01 | 采购员 | 「查 PO 4500000000 的行项目」 | `get_purchase_order` |
| US-02 | 财务 | 「发票 5105600101 2025 年度关联哪张 PO」 | `get_supplier_invoice` + `includeLines` |
| US-03 | 销售 | 「销售订单 19 的状态」 | `get_sales_order_status` |
| US-04 | 仓管 | 「物料 XXX 在工厂 YYY 的库存」 | `get_material_stock` |
| US-05 | 运维 | 「SAP 和 MCP 是否正常」 | `health_check` |
| US-06 | 主数据 | 「列 5 个客户」 | `get_business_partner` + `top` |
| US-07 | 成本会计 | 「查成本中心列表」 | `get_cost_center` |
| US-08 | 计划 | 「查产品主数据」 | `get_product` |

---

## 5. MVP 范围定义

### 5.1 范围内（In Scope）

| 类别 | 内容 |
|------|------|
| **传输** | 仅 **stdio**（`node mcp-server.js --stdio`） |
| **操作类型** | 仅 **只读 GET**，无创建/修改/删除 SAP 数据 |
| **工具数量** | **8 个**（见 §6） |
| **认证** | SAP：`user.txt` → Basic Auth；MVP 不要求 MCP API Key |
| **租户** | 固定 `my200967-api.s4hana.sapcloud.cn`，client `100` |
| **验收** | 探测脚本 + 8 工具实测（MCP Inspector 或任意标准 MCP Client）+ Cursor 自然语言（推荐） |
| **文档** | 本文档 + README/AGENTS 标明 MVP 与非 MVP 边界 |

### 5.2 范围外（Out of Scope）

| 排除项 | 原因 | 归属版本 |
|--------|------|----------|
| HTTP / Coze 部署 | MVP 聚焦 Cursor 本地 | v0.2 |
| `authenticate` 工具与 Bearer 鉴权 | stdio 无需 | v0.2 |
| `trace_sales_order` 全链路编排 | 链路字段待验证 | v0.2 |
| `query_sap_scenario` / `list_sap_scenarios` | 通用查询，非 MVP 刚需 | v0.2 |
| `get_entity_schema` | 元数据辅助 | v0.2 |
| 7 个 SAP 403 工具 | 需 Basis 开通 Arrangement | v1.0 |
| SAP 写操作 | 安全与确认流未设计 | 未来 |
| EPC 字段映射视图 | 由 EPC 项目消费原始 JSON | EPC 项目 |
| 在 `ES 接口` 目录开发 | 已归档 | — |

### 5.3 代码与交付的关系

仓库中 **已注册 20 个工具**，但 **MVP 只承诺其中 8 个** 的行为与验收。其余 12 个为「已实现、未纳入 MVP 验收」；文档与 Agent 使用指南须明确区分，避免将 403 工具当作 MVP 能力宣传。

---

## 6. 功能需求 — MVP 八个工具

### 6.1 通用约定

#### 6.1.1 调用方式

- 协议：MCP `tools/call`
- 传输：stdio
- 返回：MCP `content[].text` 为 JSON 字符串

#### 6.1.2 成功响应结构

```json
{
  "results": [ { "...": "OData 字段" } ]
}
```

或发票工具：

```json
{
  "header": [ { "...": "..." } ],
  "lines": [ { "...": "..." } ]
}
```

`health_check` 例外，结构见 §6.2.1。

#### 6.1.3 错误响应结构

工具失败时 `isError: true`，`content` 内 JSON 示例：

```json
{
  "error": "SAP_AUTH_FAILED",
  "message": "SAP rejected credentials; check user.txt"
}
```

| error 码 | SAP HTTP | 含义 |
|----------|----------|------|
| `SAP_AUTH_FAILED` | 401 | 凭证错误或无法解析 `user.txt` |
| `SAP_ARRANGEMENT_REQUIRED` | 403 | Communication Arrangement 未开通 |
| `SAP_NOT_FOUND` | 404 | 服务路径或实体不存在 |
| `SAP_BAD_REQUEST` | 400 | 请求参数不合法（如无效 `$filter` 表达式） |
| `SAP_SERVICE_UNAVAILABLE` | 502/503 | SAP 侧临时不可用 |
| `SAP_TIMEOUT` | — | 请求超时（默认 30s） |
| `NETWORK_ERROR` | — | DNS 解析失败、连接拒绝等网络层故障 |
| `SAP_ERROR` | 其他 | 通用 SAP 错误 |
| `INVALID_PARAMETER` | — | MCP 层入参校验失败（类型/范围不符合 JSON Schema） |

#### 6.1.4 OData 版本处理

| 版本 | 响应取数路径 |
|------|-------------|
| OData V2 | `d.results` 或单条 `d` |
| OData V4 | `value` |

由 `lib/tools.js` 中 `extractResults()` 统一处理。

#### 6.1.5 行项目 / 行引用返回结构

**采购订单、销售订单**（`includeItems: true`）须将行项目拆到独立 `items` 字段（不从 `$expand` 嵌套中直接返回给 Agent）：

```json
{
  "results": [ { "PurchaseOrder": "4500000000", "...": "..." } ],
  "items": [ { "PurchaseOrderItem": "10", "Material": "MAT001", "...": "..." } ]
}
```

| 工具 | 参数 | 行项目来源 | 响应字段 |
|------|------|-----------|----------|
| `get_purchase_order` | `includeItems` | `$expand=to_PurchaseOrderItem` | `results` + `items` |
| `get_sales_order_status` | `includeItems` | `$expand=to_Item` | `results` + `items` |

**供应商发票**（`includeLines: true`）沿用 §6.1.2 的 `header` / `lines` 结构（**不使用** `results` / `items`）：

```json
{
  "header": [ { "SupplierInvoice": "5105600101", "FiscalYear": "2025", "...": "..." } ],
  "lines": [ { "PurchaseOrder": "4500000000", "...": "..." } ]
}
```

| 工具 | 参数 | 行项目来源 | 响应字段 |
|------|------|-----------|----------|
| `get_supplier_invoice` | `includeLines` | `A_SuplrInvcItemPurOrdRef`（独立 GET） | `header` + `lines` |

#### 6.1.6 `filter` 参数语法

`filter` 参数接受 **OData `$filter` 表达式子集**，由 SAP 侧解析。工具层不校验语法，传递后由 SAP 返回结果或 400 错误。

**有效示例：**

| 工具 | filter 示例 |
|------|------------|
| `get_product` | `"ProductType eq 'FERT'"` |
| `get_business_partner` | `"CustomerName eq 'ACME Corp'"` |
| `get_material_stock` | `"Material eq 'MAT001' and Plant eq '1000'"` |

若 SAP 返回 400（语法错误），工具应返回 `SAP_BAD_REQUEST` 错误码，message 中包含原始 `$filter` 表达式原文以便调试。

---

### 6.2 工具规格

#### FR-01 `health_check`

| 项 | 说明 |
|----|------|
| **用途** | 检查 MCP 进程与 SAP 连通性 |
| **入参** | `includeSapCheck?: boolean`（默认 true）；`includeScenarios?: boolean`（默认 false） |
| **SAP 依赖** | 可选：`GET API_PRODUCT_SRV/A_Product?$top=1` |
| **成功出参** | `{ mcp: "ok", version: "<从 package.json 读取>", time: ISO8601, sap?: { status, ok } }` |
| **验收** | `includeSapCheck: true` 时 `sap.ok === true` |

---

#### FR-02 `get_product`

| 项 | 说明 |
|----|------|
| **用途** | 查询产品主数据 |
| **入参** | `product?: string`；`filter?: string`；`top?: number`（默认 10，最大 1000） |
| **SAP** | OData V2 `API_PRODUCT_SRV/A_Product` |
| **场景** | SAP_COM_0009 |
| **探测状态** | OK(200) |
| **验收用例** | `{ "top": 1 }` 返回至少 0 条（200 即可）；有数据时 `results[0].Product` 存在 |

---

#### FR-03 `get_business_partner`

| 项 | 说明 |
|----|------|
| **用途** | 查询客户或供应商主数据 |
| **入参** | `customer?: string`；`supplier?: string`；`filter?: string`；`top?: number`（默认 10，最大 1000） |
| **SAP** | `A_Customer` 或 `A_Supplier`（`API_BUSINESS_PARTNER`） |
| **场景** | SAP_COM_0008 |
| **探测状态** | OK(200) |
| **规则** | 指定 `customer` 查客户；指定 `supplier` 查供应商；均未指定时默认列客户 |
| **验收用例** | `{ "top": 1 }` 返回 200 |

---

#### FR-04 `get_sales_order_status`

| 项 | 说明 |
|----|------|
| **用途** | 查询销售订单状态，可选行项目 |
| **入参** | `salesOrder?: string`；`includeItems?: boolean`；`top?: number` |
| **SAP** | OData V4 `api_salesorder/.../SalesOrder`；`includeItems` 时 `$expand=to_Item` |
| **场景** | SAP_COM_0109 |
| **探测状态** | OK(200) |
| **验收用例** | `{ "salesOrder": "19" }` 或 `{ "top": 1 }` |

---

#### FR-05 `get_purchase_order`

| 项 | 说明 |
|----|------|
| **用途** | 查询采购订单（EPC 核心场景） |
| **入参** | `purchaseOrder?: string`；`includeItems?`；`includeSchedule?`；`includePricing?`；`includeNotes?`；`top?: number` |
| **SAP** | OData V4 `api_purchaseorder_2/.../PurchaseOrder` 及 `$expand` 子实体 |
| **场景** | SAP_COM_0053 |
| **探测状态** | OK(200) |
| **MVP 验收** | 抬头：`{ "purchaseOrder": "4500000000" }`；含行：`includeItems: true` |
| **MVP 不验收** | schedule/pricing/notes 展开（已实现但不作为门禁） |

---

#### FR-06 `get_material_stock`

| 项 | 说明 |
|----|------|
| **用途** | 查询物料库存 |
| **入参** | `material?: string`；`plant?: string`；`filter?: string`；`top?: number` |
| **SAP** | V2 `API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod` |
| **场景** | SAP_COM_0164 |
| **探测状态** | OK(200) |
| **验收用例** | `{ "top": 1 }` 返回 200（允许空数组） |

---

#### FR-07 `get_supplier_invoice`

| 项 | 说明 |
|----|------|
| **用途** | 查询供应商发票（EPC 应付场景） |
| **入参** | `invoice?: string`；`fiscalYear?: string`（不传时默认当前系统年度）；`includeLines?: boolean` |
| **SAP** | **仅 V2** `API_SUPPLIERINVOICE_PROCESS_SRV` |
| **探测状态** | V2 OK(200)；V4 403（MVP 不使用 V4） |
| **验收用例** | `{ "invoice": "5105600101", "fiscalYear": "2025", "includeLines": true }` |
| **规则** | 不得默认走 V4 路径 |

---

#### FR-08 `get_cost_center`

| 项 | 说明 |
|----|------|
| **用途** | 查询成本中心主数据 |
| **入参** | `costCenter?: string`；`companyCode?: string`；`filter?: string`；`top?: number` |
| **SAP** | V4 `api_cost_center/.../A_CostCenter_2` |
| **场景** | SAP_COM_0008 |
| **探测状态** | OK(200) |
| **验收用例** | `{ "top": 1 }` 返回 200 |

---

## 7. 非功能需求

### 7.1 性能

| 编号 | 要求 |
|------|------|
| NFR-01 | 单次 OData GET 超时默认 30s（`SAP_REQUEST_TIMEOUT_MS`） |
| NFR-02 | 单工具单次调用 SAP 请求数：简单查询 ≤1；`get_purchase_order` 含 expand ≤1；`get_supplier_invoice` 含 lines ≤2 |
| NFR-03 | MVP 不启用响应缓存（`SAP_CACHE_TTL_MS=0`），避免缓存一致性问题干扰验收结果 |

### 7.2 安全

| 编号 | 要求 |
|------|------|
| NFR-04 | `user.txt`、`.env` 不得提交 Git（`.gitignore` 已配置） |
| NFR-05 | Agent 不得通过 MCP 获取 SAP 密码明文 |
| NFR-06 | MVP 仅只读，无 BAPI_COMMIT 或 OData POST/PATCH/DELETE |
| NFR-07 | 禁止提供「任意 RFC / 任意 URL」类万能工具 |

### 7.3 可维护性

| 编号 | 要求 |
|------|------|
| NFR-08 | 凭证解析逻辑与 `lib/credentials.js` 一致，单元测试通过 |
| NFR-09 | 端点表集中在 `lib/sap-endpoints.js`，与探测脚本共享 |
| NFR-10 | CommonJS（`require`），Node.js ≥ 18 |

### 7.4 可观测性（MVP 最低要求）

| 编号 | 要求 |
|------|------|
| NFR-11 | 启动时 stderr 输出凭证文件路径、传输模式、版本号 |
| NFR-12 | SAP 错误返回结构化 JSON（含 error/message 字段），非 Node 堆栈泄漏给 Agent |
| NFR-13 | 每次工具调用时 stderr 输出：`[ISO8601 时间戳] <工具名>`，便于值班排查"Agent 刚才调了什么" |
| NFR-14 | 环境变量 `SAP_DEBUG=true` 时，stderr 追加输出 SAP 请求 URL 和 HTTP 状态码；默认 `false` |

---

## 8. 配置与环境

### 8.1 前置条件

| 项 | 要求 |
|----|------|
| Node.js | ≥ 18 |
| 包管理 | `pnpm install`（在 `MCP Server/`） |
| 网络 | 可访问 `https://my200967-api.s4hana.sapcloud.cn` |
| SAP 用户 | `EPC_USER`，具备相关 OData 读权限 |

### 8.2 凭证文件 `user.txt`（仓库根目录）

支持中文：

```
接口调用的通信用户：EPC_USER
密码：<密码>
```

或英文：

```
User Name:EPC_USER
Password:<密码>
PasswordAlt:<备用密码>
```

桥接层依次尝试「用户 × 密码」组合直至 SAP 返回 2xx。

### 8.3 环境变量（MVP 推荐）

| 变量 | MVP 值 | 说明 |
|------|--------|------|
| `SAP_CREDENTIALS_FILE` | `../user.txt` 或绝对路径 | 凭证 |
| `SAP_BASE_URL` | `https://my200967-api.s4hana.sapcloud.cn` | 默认即可 |
| `SAP_CLIENT` | `100` | 默认即可 |
| `MCP_ENABLE_HTTP_TRANSPORT` | `false`（Cursor env 覆盖） | MVP 强制 stdio |
| `SAP_REQUEST_TIMEOUT_MS` | `30000` | 默认即可 |

### 8.4 Cursor MCP 配置（标准）

```json
{
  "mcpServers": {
    "sap-s4": {
      "command": "node",
      "args": [
        "E:\\00 - 中数通ES环境\\ES-MCP-Server\\MCP Server\\mcp-server.js",
        "--stdio"
      ],
      "env": {
        "SAP_CREDENTIALS_FILE": "E:\\00 - 中数通ES环境\\ES-MCP-Server\\user.txt",
        "MCP_ENABLE_HTTP_TRANSPORT": "false"
      }
    }
  }
}
```

**说明：** 必须传 `--stdio`；否则默认可能启动 HTTP 模式，Cursor 无法连接。

### 8.5 进程生命周期约定

| 场景 | 行为 |
|------|------|
| stdio 启动 | stderr 输出 `Ready` 后等待 MCP Client 连接 |
| SAP 启动时不可达 | 进程继续运行，工具调用时返回 `SAP_SERVICE_UNAVAILABLE` / `NETWORK_ERROR`（**不退出**） |
| 父进程关闭 stdin | MCP Server 应优雅退出（stdio transport 自然结束） |
| 收到 SIGTERM/SIGINT | 关闭 HTTP 连接（如有），释放资源后退出 |

**关键原则：stdio 模式下的 MCP Server 是子进程，不应因 SAP 不可达而自杀——否则 Cursor 会反复重启进程，造成日志风暴。**

---

## 9. 验收标准

### 9.1 前置验收（环境）

| # | 检查项 | 命令 / 方法 | 通过标准 |
|---|--------|-------------|----------|
| A1 | 凭证文件存在 | 检查 `ES-MCP-Server/user.txt` | 文件存在且非空 |
| A2 | 依赖安装 | `cd MCP Server && pnpm install` | 无报错 |
| A3 | 凭证单元测试 | `pnpm test` | 11/11 通过 |
| A4 | SAP 探测 | `node scripts/probe-sap-connectivity.js` | 汇总含 OK 24（403 可接受） |
| A5 | stdio 启动 | `node mcp-server.js --stdio` | stderr 显示 Ready，进程不退出 |

### 9.2 工具验收（逐个 — 正常用例）

| # | 工具 | 测试入参 | 通过标准 |
|---|------|----------|----------|
| T1 | `health_check` | `{ "includeSapCheck": true }` | `sap.ok === true` |
| T2 | `get_product` | `{ "top": 1 }` | JSON 含 `results`，无堆栈 |
| T3 | `get_business_partner` | `{ "top": 1 }` | 同上 |
| T4 | `get_sales_order_status` | `{ "top": 1 }` 或 `{ "salesOrder": "19" }` | 同上 |
| T5 | `get_purchase_order` | `{ "purchaseOrder": "4500000000", "includeItems": true }` | `results` 含订单，`items` 含行项目 |
| T6 | `get_material_stock` | `{ "top": 1 }` | 200，允许空 results |
| T7 | `get_supplier_invoice` | `{ "invoice": "5105600101", "fiscalYear": "2025", "includeLines": true }` | `header` 非空，`lines` 非空 |
| T8 | `get_cost_center` | `{ "top": 1 }` | 200 |

### 9.3 工具验收（逐个 — 异常/边界用例）

| # | 工具 | 测试入参 | 通过标准 |
|---|------|----------|----------|
| E1 | `health_check` | `{ "includeSapCheck": false }` | `sap` 字段缺失，`mcp.ok === true` |
| E2 | `get_product` | `{ "top": 5000 }` (超上限) | MCP 层返回 `INVALID_PARAMETER`（zod `max(1000)` 拦截，不发起 SAP 请求） |
| E3 | `get_business_partner` | 不传任何参数 | 默认返回 10 条客户数据 |
| E4 | `get_purchase_order` | `{ "purchaseOrder": "9999999999" }` (不存在) | 返回 `{ "results": [] }` 或 `SAP_NOT_FOUND`（取决于 SAP 行为） |
| E5 | `get_supplier_invoice` | `{ "invoice": "5105600101" }` (不传 fiscalYear) | 默认当前系统年度，正常返回 |
| E6 | `get_supplier_invoice` | `{ "invoice": "INVALID" }` (不存在) | 返回 `{ "header": [] }` 或 `SAP_NOT_FOUND`（取决于 SAP 行为） |
| E7 | 任意工具 | 传入未定义字段（如 `{ "foo": "bar" }`） | 忽略未知字段，不崩溃 |
| E8 | 任意工具 | `top` 传负数或字符串 | 返回 `INVALID_PARAMETER` |

### 9.4 MCP Client 实测（业务验收）

通过 **MCP Inspector**（推荐）或在任意支持 stdio MCP 的客户端（如 Cursor、Claude Desktop）中连接 `sap-s4` 后，至少完成以下自然语言对话并得到有效数据回复：

| # | 用户输入示例 | 期望 Agent 行为 |
|---|-------------|----------------|
| C1 | 「用 health_check 看 SAP 是否正常」 | 调用 `health_check`，汇报 SAP 状态 |
| C2 | 「查一下采购订单 4500000000 的行项目」 | 调用 `get_purchase_order` + `includeItems` |
| C3 | 「发票 5105600101，2025 年，带行项目」 | 调用 `get_supplier_invoice` |

> **验收方式优先级：** MCP Inspector (`npx @modelcontextprotocol/inspector`) 为首选，不依赖特定 IDE。Cursor 作为推荐验证方式，不作为门禁条件。

### 9.5 文档验收

| # | 检查项 | 通过标准 |
|---|--------|----------|
| D1 | README 指向本仓库为唯一根目录 | ✅ |
| D2 | `ES 接口/README.md` 标明归档 | ✅ |
| D3 | 本文档（MVP需求说明.md）入库 | ✅ |
| D4 | MVP 8 工具与非 MVP 12 工具边界清晰 | AGENTS.md / README 一致 |

### 9.6 MVP 交付判定

**同时满足** 以下条件方可标记「MVP 已交付」：

- [ ] A1～A5 全部通过  
- [ ] T1～T8 全部通过  
- [ ] E1～E8 全部通过  
- [ ] C1～C3 至少 2 项通过（以 MCP Inspector 或任意标准 MCP Client 为准）  
- [ ] D1～D4 全部满足  
- [ ] `user.txt` / `.env` 未出现在 `git status`  

---

## 10. 交付物清单

| 交付物 | 路径 | MVP 是否必需 |
|--------|------|-------------|
| MCP Server 源码 | `MCP Server/` | ✅ |
| 需求说明（本文档） | `docs/MVP需求说明.md` | ✅ |
| 探测脚本 | `scripts/` | ✅ |
| 开发指南 / 连通性手册 | `docs/` | ✅ |
| Agent 指引 | `AGENTS.md` | ✅ |
| 凭证单元测试 | `MCP Server/test/` | ✅ |
| 接口清单 Excel | `ES接口清单.xlsx` | 可选（参考资料） |
| 探测结果 JSON | `Probe_Latest.json` | 可选（开发分析快照） |
| HTTP 部署配置 | `.coze`、HTTP 相关 | ❌ MVP |
| Coze / 公网部署实例 | — | ❌ MVP |

---

## 11. 风险、假设与依赖

### 11.1 假设

- SAP 租户 `EPC_USER` 凭证有效且权限不变。下表列出 MVP 8 工具对应的 SAP 通信场景与权限依赖：

| 工具 | SAP 通信场景 | 权限影响 |
|------|-------------|----------|
| `health_check` | SAP_COM_0009 (抽样) | 产品读取 |
| `get_product` | SAP_COM_0009 | 产品主数据读取 |
| `get_business_partner` | SAP_COM_0008 | 客户/供应商主数据读取 |
| `get_sales_order_status` | SAP_COM_0109 | 销售订单读取 |
| `get_purchase_order` | SAP_COM_0053 | 采购订单读取 |
| `get_material_stock` | SAP_COM_0164 | 物料库存读取 |
| `get_supplier_invoice` | Legacy V2 | 供应商发票读取 |
| `get_cost_center` | SAP_COM_0008 | 成本中心读取 |

若 Basis 调整角色导致 403，上表可按场景快速定位影响范围。

- MVP 阶段仅内网/VPN 环境使用，无需公网 SLA。  
- EPC 项目接受 MVP 返回**原始 OData 字段**，不做 MCP 侧字段重命名。

### 11.2 依赖

| 依赖方 | 内容 | MVP 影响 |
|--------|------|----------|
| SAP Basis | 维持现有 Arrangement（0008/0009/0053 等） | 403 则对应工具失败 |
| 网络 | 可达 `my200967-api.s4hana.sapcloud.cn` | 全部失败 |
| MCP Client | 支持 stdio MCP 协议 | 无法完成 C 类验收 |

### 11.3 风险

| 风险 | 缓解 |
|------|------|
| 误用 HTTP 模式连接 Cursor | 文档与 `--stdio` 强制说明 |
| Agent 调用 403 工具 | 文档定界；非 MVP 不承诺 |
| `ES 接口` 与 Git 仓库双份维护 | 已归档旧目录 |
| 密码轮换导致 401 | `health_check` + 探测脚本值班检查 |

---

## 12. 版本演进（MVP 之后）

```
MVP（本文档）
  │  stdio + 8 只读工具 + MCP Inspector 验收
  ▼
v0.2 增强
  │  trace_sales_order 修复、query_sap_scenario、HTTP + authenticate
  ▼
v1.0 全量
  │  SAP_COM_0087 / 0054 / 0102 等开通后启用 7 个阻塞工具
  ▼
v2.0（规划）
     写操作确认流、审计、EPC 复合视图
```

---

## 13. 相关文档索引

**权威级：** MVP 阶段若与《MCP-Server开发指南》或其他文档冲突，**以本文档（MVP需求说明.md）为准**。

| 文档 | 用途 |
|------|------|
| [MVP需求说明.md](MVP需求说明.md) | 本文档 — MVP 范围与验收（**需求主文档**） |
| [MCP-Server开发指南.md](MCP-Server开发指南.md) | 全量 20 工具技术规格、架构约束 |
| [SAP接口连通性手册.md](SAP接口连通性手册.md) | OData 端点与 403 说明 |
| [TASKS.md](TASKS.md) | 分阶段任务拆解 |
| [../AGENTS.md](../AGENTS.md) | Agent 操作指引 |
| [../README.md](../README.md) | 仓库入口与快速开始 |

---

## 14. 修订记录

| 版本 | 日期 | 作者 | 说明 |
|------|------|------|------|
| v1.0 | 2026-06-24 | — | 首版：确立 ES-MCP-Server 为唯一根目录，定义 MVP stdio 8 工具范围与验收 |
| v1.1 | 2026-06-24 | — | 评审修订：补充异常验收用例、错误码表、includeItems结构、filter语法、日志NFR、权限映射；交付物降级（Excel/Probe→可选）；验收方式改为MCP Inspector优先 |
| v1.1.1 | 2026-06-24 | — | 一致性修订：发票响应统一为 header/lines（与 §6.1.2、代码一致）；T7/E6 对齐；E2 明确仅 INVALID_PARAMETER；本地路径修正；文首版本号更新；§13 增加 MVP 权威声明 |
| v1.2 | 2026-06-24 | — | §9.6 全矩阵验收通过（A1-A5/T1-T8/E1-E8/C1-C3/D1-D4/git）；T5 expand 属性修正（_PurchaseOrderItem）；PO 示例号 4500000023→4500000000；E5 fiscalYear 默认行为确认通过 |

---

**批准与签收（待填）**

| 角色 | 姓名 | 日期 | 签字 |
|------|------|------|------|
| 产品/业务 | | | |
| 技术负责人 | | | |
| 测试验收 | | | |
