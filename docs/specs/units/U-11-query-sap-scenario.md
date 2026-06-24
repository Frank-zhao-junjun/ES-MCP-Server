# Unit Spec U-11 — `query_sap_scenario`

| 字段 | 值 |
|------|-----|
| **Unit ID** | U-11 |
| **状态** | ready |
| **关联 US** | US-10 |
| **关联 FR** | FR-11；§6.1.3 `SCENARIO_NOT_FOUND` / `INVALID_SCENARIO` |
| **关联 PRD** | [v0.2需求说明.md](../../v0.2需求说明.md) §6.3 FR-11；NFR-17 |

## 问题陈述

为减少为每个 OData 实体单独编写 MCP 工具，Agent 可通过场景 `key` 动态执行只读 GET。路径来自 `list_sap_scenarios` 同源注册表，支持 `$filter` / `$top` 与实体段覆盖。

## 范围

**In scope**

- 必填 `key`，解析 `sap-endpoints.js` 中 `pathTemplate`
- 可选 `filter`、`top` 追加为 OData 查询参数
- 可选 `entity` 覆盖 path 最后一段实体名
- 成功返回 `results` 数组（V2 `d.results` / V4 `value` 由 `extractResults` 统一）
- 未知 key → `SCENARIO_NOT_FOUND`；无 path → `INVALID_SCENARIO`
- SAP 401/403/404 等 → 标准 SAP 错误码

**Out of scope**

- POST/PATCH/DELETE
- Phase 3 阻塞 key 的 **200 成功**验收（E15 仅要求结构化错误、不崩溃）
- 自动重试多凭证组合以外的逻辑变更

## 接口契约

### 入参

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `key` | string | ✅ | 场景 key，如 `sales_order_v4` |
| `entity` | string? | | 覆盖 path 中实体段，如 `SalesOrderItem` |
| `filter` | string? | | OData `$filter` 表达式 |
| `top` | number? | | 1～1000，映射 `$top` |

### 成功出参

```json
{
  "key": "sales_order_v4",
  "entity": "SalesOrder",
  "results": [
    { "SalesOrder": "19", "SalesOrderType": "OR" }
  ]
}
```

未传 `entity` 时 JSON 可省略该字段或值为 `null`（实现差异不视为失败，以 `key` + `results` 为准）。

### 错误出参

未知 key：

```json
{ "error": "SCENARIO_NOT_FOUND", "message": "No scenario found for key: nonexistent_key" }
```

缺 key：

```json
{ "error": "MISSING_PARAMS", "message": "key is required" }
```

Phase 3 / Arrangement 未开通（E15）：

```json
{ "error": "SAP_ARRANGEMENT_REQUIRED", "message": "Communication Arrangement not enabled for this API" }
```

或 SAP 401：

```json
{ "error": "SAP_AUTH_FAILED", "message": "SAP rejected credentials; check user.txt" }
```

### MCP 包装

SAP 失败时 `isError: true`；成功时 `results` 可为空数组。

## 验收标准

| # | 条件 | Pass |
|---|------|------|
| U-11-A1 | `{ "key": "sales_order_v4", "top": 1 }` | HTTP 200 语义，`results` 为数组 |
| U-11-A2 | `{ "key": "nonexistent_key" }` | `SCENARIO_NOT_FOUND` |
| U-11-A3 | `{ "key": "purchase_requisition_v4", "top": 1 }` | 结构化 SAP 错误，进程不崩溃 |
| U-11-A4 | 单次成功调用 | 恰好 **1** 次 SAP GET（NFR-17） |
| U-11-A5 | 带 `filter` | `$filter` 出现在请求 URL |

## 测试映射

[V0.2-TC.md](../../tests/V0.2-TC.md) → **T11**、**E10**、**E15**

## 实现

| 层级 | 路径 | 符号 |
|------|------|------|
| Handler | `MCP Server/lib/tools.js` | `querySapScenario`, `extractResults` |
| 注册表 | `MCP Server/lib/sap-endpoints.js` | `getEndpointByKey`, `resolvePath` |
| SAP | `MCP Server/mcp-sap-core.js` | `sapGet` |
| 注册 | `MCP Server/mcp-server.js` | `query_sap_scenario` tool + zod |

## 实现备注

`entity` 覆盖逻辑替换 path 最后 `/` 段；若场景 path 含固定 key 段（如单张发票 URL），覆盖行为可能不符合直觉——v0.2 不验收此类边界，文档以 `sales_order_v4` 列表查询为准。
