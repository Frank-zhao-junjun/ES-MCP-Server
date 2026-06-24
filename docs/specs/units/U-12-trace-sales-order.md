# Unit Spec U-12 — `trace_sales_order`

| 字段 | 值 |
|------|-----|
| **Unit ID** | U-12 |
| **状态** | ready |
| **关联 US** | US-09 |
| **关联 FR** | FR-12；§6.1.3 `MISSING_PARAMS` |
| **关联 PRD** | [v0.2需求说明.md](../../v0.2需求说明.md) §6.3 FR-12；NFR-15 |

## 问题陈述

销售经理希望一次调用查看销售订单在 SAP 中的履约链路：销售订单 → 外向交货 → 开票 → 物料凭证。MVP 因链路 reference 字段未验证而推迟；v0.2 以 **best-effort** 串联四步 SAP GET，任一步失败仍返回已收集的 `legs`（第一步 SO 失败则早退）。

## 范围

**In scope**

- 必填 `salesOrder`（字符串，如 `"19"`）
- 固定四步顺序与 `step` 名称（见下表）
- 每 leg 含 `ok`、`status`；成功列表步含 `count`；失败含 `error`（SAP 错误码字符串）
- SO 步失败时返回 `{ salesOrder, legs: [SalesOrder leg] }`，不继续后续 SAP 调用
- 下游无业务单据时 `ok: true` 且 `count: 0` 为合法结果（非错误）
- SAP 请求总数 ≤ 4（NFR-15）

**Out of scope**

- 保证四步均有业务数据
- 返回各步完整 OData 行（仅 status/count，不返回 `results` 明细）
- 跨 SO 批量的批量 trace
- 写操作或状态变更

## 接口契约

### 入参

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `salesOrder` | string | ✅ | 销售订单号 |

### 成功出参（组合响应形状）

```json
{
  "salesOrder": "19",
  "legs": [
    {
      "step": "SalesOrder",
      "ok": true,
      "status": 200
    },
    {
      "step": "OutboundDelivery",
      "ok": true,
      "status": 200,
      "count": 2
    },
    {
      "step": "BillingDocument",
      "ok": true,
      "status": 200,
      "count": 1
    },
    {
      "step": "MaterialDocument",
      "ok": true,
      "status": 200,
      "count": 0
    }
  ]
}
```

### Leg 字段定义

| 字段 | 适用 step | 说明 |
|------|-----------|------|
| `step` | 全部 | 枚举：`SalesOrder` \| `OutboundDelivery` \| `BillingDocument` \| `MaterialDocument` |
| `ok` | 全部 | SAP HTTP 层是否成功（2xx） |
| `status` | 全部 | HTTP 状态码 |
| `count` | 后三步 | `extractResults(data).length`；列表查询步专用 |
| `error` | 失败 leg | SAP 错误码，如 `SAP_NOT_FOUND`（来自 `resp.error.error`） |

### 四步 SAP 路径（当前实现）

| step | SAP 场景 | 查询方式 |
|------|----------|----------|
| SalesOrder | SAP_COM_0109 | 单条 `SalesOrder('…')` V4 + `sap-client` URL 参数 |
| OutboundDelivery | SAP_COM_0106 | `$filter=ReferenceSDDocument eq '…'` |
| BillingDocument | SAP_COM_0124 | `$filter=ReferenceSDDocument eq '…'` |
| MaterialDocument | SAP_COM_0108 | `$filter=ReferenceDocument eq '…'` |

### 错误出参

缺参：

```json
{ "error": "MISSING_PARAMS", "message": "salesOrder is required" }
```

SO 不存在（早退示例）：

```json
{
  "salesOrder": "9999999999",
  "legs": [
    { "step": "SalesOrder", "ok": false, "status": 404, "error": "SAP_NOT_FOUND" }
  ]
}
```

### MCP 包装

含 `legs` 的 trace 对象即使部分 leg 失败也视为 **工具成功**（`isError: false`），除非入参校验失败。

## 验收标准

| # | 条件 | Pass |
|---|------|------|
| U-12-A1 | `{ "salesOrder": "19" }` | `legs.length === 4`；SO leg `ok === true` |
| U-12-A2 | `{}` | `MISSING_PARAMS` |
| U-12-A3 | 已知 SO 无下游交货 | 交货 leg `ok === true` 且 `count === 0`（或等价空结果） |
| U-12-A4 | 单次调用 | SAP 请求 ≤ 4；SO 失败时 ≤ 1 |
| U-12-A5 | 每 leg | 含 `step`、`ok`、`status` |

## 测试映射

[V0.2-TC.md](../../tests/V0.2-TC.md) → **T12**、**E11**、**C5**

## 实现

| 层级 | 路径 | 符号 |
|------|------|------|
| Handler | `MCP Server/lib/tools.js` | `traceSalesOrder`, `extractResults` |
| SAP | `MCP Server/mcp-sap-core.js` | `sapGet` |
| 注册 | `MCP Server/mcp-server.js` | `trace_sales_order` tool |

## 实现备注（待编码 / 验证 gap）

| Gap | 说明 | v0.2 动作 |
|-----|------|-----------|
| **G1 Reference 字段** | `ReferenceSDDocument` / `ReferenceDocument` 在租户上有效 | ✅ 已验证 — SO `19` 维度，交货/开票通过 `ReferenceSDDocument` 匹配，物料凭证通过 `ReferenceDocument` 匹配 |
| **G2 SO leg 无 count** | 当前 SO 步不返回 `count` | Spec 允许；可选后续与后三步对齐 |
| **G3 早退 legs 数量** | SO 失败时 `legs.length === 1`，非 4 | 符合 FR-12「第一步失败则早退」；T12 仅对有效 SO 要求 4 legs |
| **G4 无结果明细** | Agent 无法从 trace 直接读交货号 | v0.2 不返回嵌套 `results`；需后续增强或引导 Agent 再调 `query_sap_scenario` |
| **G5 MaterialDocument filter** | `ReferenceDocument` 可能关联非 SO 凭证 | best-effort；`count: 0` 为可接受结果 |
| **G6 SO sap-client** | V4 SO 端点需要 URL 参数 `sap-client`（HTTP header 不够） | ✅ 已修复 — URL 追加 `&sap-client=${config.client}` |
