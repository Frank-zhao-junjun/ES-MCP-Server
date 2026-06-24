# Unit Spec U-10 — `list_sap_scenarios`

| 字段 | 值 |
|------|-----|
| **Unit ID** | U-10 |
| **状态** | ready |
| **关联 US** | US-10 |
| **关联 FR** | FR-10 |
| **关联 PRD** | [v0.2需求说明.md](../../v0.2需求说明.md) §6.3 FR-10；NFR-10 |

## 问题陈述

集成人员与 Agent 需要浏览 MCP 内置的 SAP OData 场景注册表，以便选择 `query_sap_scenario` 的 `key` 或理解探测脚本与 MCP 是否同源。本工具返回纯配置数据，不调用 SAP。

## 范围

**In scope**

- 返回 `lib/sap-endpoints.js` 中全部 `ENDPOINTS` 条目
- 每项含 `key`、`category`、`name`、`scenario`、`method`、`protocol`、`baseUrl`（已替换 `{CLIENT}`）
- 可选 `note`（Arrangement 提示等）
- `count` 等于 `scenarios.length`

**Out of scope**

- 运行时扫描 `SAP_SCENARIO_DIR`（PRD 标注为可选未来扩展）
- 过滤 / 分页参数
- Phase 3 阻塞场景从列表中隐藏（v0.2 仍列出，由 `query_sap_scenario` / E15 验证错误路径）
- SAP 连通性探测

## 接口契约

### 入参

无必填参数；接受 `{}`。

### 成功出参

```json
{
  "count": 42,
  "scenarios": [
    {
      "key": "sales_order_v4",
      "category": "SAP上游",
      "name": "销售订单 V4",
      "scenario": "SAP_COM_0109",
      "method": "GET",
      "protocol": "OData V4/JSON",
      "baseUrl": "/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrder?$top=1&$format=json&sap-client=100"
    },
    {
      "key": "purchase_order_header_v4",
      "category": "EPC采购",
      "name": "采购订单抬头 V4",
      "scenario": "SAP_COM_0053",
      "method": "GET",
      "protocol": "OData V4/JSON",
      "baseUrl": "/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/PurchaseOrder?$top=1&$format=json&sap-client=100"
    },
    {
      "key": "supplier_invoice_single_v2",
      "category": "EPC应付",
      "name": "供应商发票单张 V2",
      "scenario": "legacy(V2可用)",
      "method": "GET",
      "protocol": "OData V2/JSON",
      "baseUrl": "...",
      "note": "示例5105600101/2025"
    }
  ]
}
```

### 规则

| 规则 | 说明 |
|------|------|
| R1 | `count >= 33`（当前实现 **42** 项） |
| R2 | 每项必有 `key` 与 `baseUrl` |
| R3 | `method` 恒为 `GET` |
| R4 | `baseUrl` 使用 `config.client`（默认 `100`） |

### MCP 包装

始终成功（无 SAP 依赖）；`isError` 不应为 true。

## 验收标准

| # | 条件 | Pass |
|---|------|------|
| U-10-A1 | `{}` | `count >= 33`，`scenarios` 为数组 |
| U-10-A2 | 检查 key 集合 | 含 `sales_order_v4`、`purchase_order_header_v4`、`supplier_invoice_single_v2` |
| U-10-A3 | 任意一项 | `baseUrl` 含 `sap-client=100`（或当前 `SAP_CLIENT`） |
| U-10-A4 | 与探测脚本 | `ENDPOINTS` 与 `scripts/probe-sap-connectivity.js` 同源（NFR-10） |

## 测试映射

[V0.2-TC.md](../../tests/V0.2-TC.md) → **T10**、**C4**

## 实现

| 层级 | 路径 | 符号 |
|------|------|------|
| Handler | `MCP Server/lib/tools.js` | `listSapScenarios` |
| 注册表 | `MCP Server/lib/sap-endpoints.js` | `ENDPOINTS`, `listScenarios` |
| 注册 | `MCP Server/mcp-server.js` | `list_sap_scenarios` tool |

## 实现备注

当前 `listScenarios()` 不返回 `readExample` 等探测脚本扩展字段；与 FR-10 出参契约一致。注册表项数随 `sap-endpoints.js` 变更，验收以 `count >= 33` 为准。
