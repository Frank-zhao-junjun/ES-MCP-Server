# SAP S/4HANA MCP Server Agent 使用说明

本文面向通过 MCP 调用本服务的 AI Agent。目标是让 Agent 在只读、安全、可追踪的边界内查询 SAP S/4HANA Cloud OData 数据。

## 1. 基本原则

- 本 MCP Server 当前定位为只读查询服务，不提供 SAP 写入、审批、改单、下单等动作。
- Agent 调用任何业务工具前，必须先调用 `authenticate`。
- 普通业务 Agent 应优先使用业务工具，不应直接使用 `query_sap_scenario`。
- `query_sap_scenario` 属于调试能力，只有 `MCP_ENABLE_DEBUG_TOOLS=true` 时可用。
- `load_plugin`、`unload_plugin`、`list_loaded_plugins` 属于管理员能力，只有 `MCP_ENABLE_ADMIN_TOOLS=true` 时可用。
- 所有工具返回统一 JSON 响应，Agent 必须检查 `ok` 字段后再使用 `data`。

## 2. 推荐调用流程

1. `authenticate`

传入预共享的 `MCP_API_KEY`。认证失败时不要继续调用业务工具。

2. `health_check`

当 Agent 需要确认服务状态、配置、SAP 连通性时调用。常规业务查询可以跳过。

3. 选择业务工具

根据用户意图选择具体业务工具。例如销售订单查状态用 `get_sales_order_status`，采购订单查询用 `get_purchase_order`。

4. 必要时补充 Schema

如果 Agent 需要构造复杂 OData 过滤条件，先调用 `get_entity_schema` 理解字段。

5. 处理响应

只在 `ok: true` 时读取 `data`。若 `warnings` 非空，需要在回答中说明数据可能不完整。

## 3. 工具选择指南

| 用户意图 | 推荐工具 | 备注 |
| --- | --- | --- |
| 检查服务是否可用 | `health_check` | 可设置 `includeSapCheck=false` 获得更快响应。 |
| 查询销售订单当前状态 | `get_sales_order_status` | 优先于 `trace_sales_order` 使用。 |
| 追踪销售订单全链路 | `trace_sales_order` | 仅在需要交货、生产、物料凭证、开票链路时使用。 |
| 查询采购订单 | `get_purchase_order` | 支持按采购订单、供应商、公司代码等过滤。 |
| 查询供应商发票 | `get_supplier_invoice` | 至少提供一个过滤条件。 |
| 查询产品主数据 | `get_product` | 支持产品、产品类型、产品组等过滤。 |
| 查询库存 | `get_material_stock` | 至少提供物料或工厂。 |
| 查询 BOM | `get_bom` | 支持物料、工厂、BOM 用途等过滤。 |
| 查询业务伙伴 | `get_business_partner` | 可选择包含 Customer 或 Supplier 关联数据。 |
| 查询成本中心 | `get_cost_center` | 支持成本中心、控制范围、公司代码。 |
| 查看可用通信场景 | `list_sap_scenarios` | 用于发现已配置的 SAP_COM 场景。 |
| 查看实体字段 | `get_entity_schema` | 用于理解字段名、类型、主键、可空性。 |
| 临时探索 SAP 场景 | `query_sap_scenario` | 默认禁用，仅管理员调试使用。 |

## 4. 标准响应处理

所有工具的 MCP `content[0].text` 都是 JSON 字符串，结构如下：

```json
{
  "schemaVersion": "1.0",
  "tool": "get_sales_order_status",
  "ok": true,
  "data": {},
  "warnings": [],
  "error": null
}
```

Agent 处理规则：

- `ok === true`：读取 `data`，并检查 `warnings`。
- `ok === false`：不要基于 `data` 下结论，转而解释 `error.code` 和 `error.message`。
- `warnings.length > 0`：回答用户时说明数据缺失、未找到或部分失败。
- `schemaVersion` 当前为 `1.0`，后续兼容升级时应保留向后兼容处理。

错误响应示例：

```json
{
  "schemaVersion": "1.0",
  "tool": "query_sap_scenario",
  "ok": false,
  "data": null,
  "warnings": [],
  "error": {
    "code": "DEBUG_TOOL_DISABLED",
    "message": "query_sap_scenario is disabled. Set MCP_ENABLE_DEBUG_TOOLS=true to enable debug/admin querying.",
    "retryable": false
  }
}
```

## 5. 常见错误处理

| 错误码 | 含义 | Agent 处理建议 |
| --- | --- | --- |
| `AUTH_REQUIRED` | 未认证 | 先调用 `authenticate`。 |
| `AUTH_INVALID_KEY` | API Key 错误 | 提示用户检查 MCP 配置，不要重试太多次。 |
| `AUTH_LOCKED` | 认证失败次数过多被锁定 | 等待 `retryAfter` 后再试。 |
| `INVALID_INPUT` | 参数不合法 | 修正参数格式后重试。 |
| `SCENARIO_NOT_FOUND` | 找不到 SAP 场景 | 先调用 `list_sap_scenarios`。 |
| `NO_ENDPOINT` | 场景没有可用 endpoint | 提示配置不完整。 |
| `SAP_TIMEOUT` | SAP 请求超时 | 可稍后重试，或缩小查询范围。 |
| `SAP_UNAVAILABLE` | SAP 临时不可用或断路器打开 | 不要频繁重试，提示稍后再试。 |
| `DEBUG_TOOL_DISABLED` | 调试工具未启用 | 不要继续调用 `query_sap_scenario`。 |
| `ADMIN_TOOL_DISABLED` | 管理员工具未启用 | 不要继续调用插件管理工具，除非服务端显式开启 `MCP_ENABLE_ADMIN_TOOLS=true`。 |
| `QUERY_FAILED` | 查询失败 | 检查参数、SAP 权限或服务状态。 |

## 6. 参数使用约定

- 编号类参数一般使用字符串，不要传数字，避免前导零丢失。
- 多值查询使用逗号分隔字符串，例如 `"1000001,1000002"`。
- `top` 用于限制返回记录数，普通业务场景建议保持默认值。
- 对销售订单号，当前服务要求只包含数字字符。
- 不确定字段名时，不要猜测过滤条件，先调用 `get_entity_schema`。

## 7. 示例流程

### 查询销售订单状态

1. 调用 `authenticate`。
2. 调用 `get_sales_order_status`：

```json
{
  "salesOrder": "19",
  "includeItems": true,
  "top": 20
}
```

3. 如果返回 `found: false` 或 warnings 包含未找到提示，回答用户“未查询到该销售订单”。

### 追踪销售订单全链路

1. 先调用 `get_sales_order_status` 确认销售订单存在。
2. 再调用 `trace_sales_order`：

```json
{
  "salesOrder": "19",
  "includeDeliveries": true,
  "includeProductionOrders": true,
  "includeMaterialDocuments": true,
  "includeBillingDocuments": true,
  "top": 20
}
```

3. 若返回部分失败，回答中区分“已查到的数据”和“未能查询的链路”。

### 查询物料库存

```json
{
  "material": "FG10",
  "plant": "1010",
  "includeBatchInfo": true,
  "top": 20
}
```

至少提供 `material` 或 `plant`。

### 查询实体字段

```json
{
  "scenarioKey": "sap_com_0109_sales_order",
  "entityName": "A_SalesOrder",
  "useCache": true
}
```

使用返回的字段信息再构造后续过滤条件。

## 8. 安全边界

- 不要把 MCP API Key、SAP 用户名、SAP 密码写入回答。
- 不要调用插件管理工具，除非当前 Agent 明确是管理员 Agent，且服务端已开启 `MCP_ENABLE_ADMIN_TOOLS=true`。
- 不要把 `query_sap_scenario` 作为常规业务查询入口。
- 不要承诺已完成 SAP 写操作；当前服务只做读取。
- 不要在用户未授权时扩大查询范围，例如从单据查询扩展为批量客户或供应商查询。

## 9. 面向用户的回答建议

Agent 向最终用户回答时，应包含：

- 查询对象，例如销售订单号、采购订单号、物料号。
- 查询结果摘要。
- 关键字段和状态。
- 数据不完整或部分失败的 warning。
- 必要时说明“当前结果来自 SAP 只读查询”。

Agent 不应包含：

- API Key、Basic Auth、SAP 密码。
- 原始超长 JSON，除非用户明确要求。
- 未经确认的推断性结论。
- 对写操作、审批或业务动作执行结果的承诺。
