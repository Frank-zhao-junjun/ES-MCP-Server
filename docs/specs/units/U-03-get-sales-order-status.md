# Unit Spec U-03 — `get_sales_order_status`

| 字段 | 值 |
|------|-----|
| **Unit ID** | U-03 |
| **状态** | done |
| **关联 US** | US-03 |
| **关联 FR** | FR-04；§6.1.5 |
| **关联 PRD** | [MVP需求说明.md](../../MVP需求说明.md) §6.2 FR-04 |

## 用途

查询销售订单状态（OData V4）；`includeItems` 时行项目拆到 `items`。

## 入参

| 参数 | 类型 | 说明 |
|------|------|------|
| `salesOrder` | string? | 单条 SO |
| `includeItems` | boolean? | `$expand=to_Item` → `items` |
| `top` | number? | 列表，max 1000 |

## 出参

`includeItems: true`：`{ results, items }`，`results` 无 `to_Item`。

## 验收

| # | 用例 | Pass |
|---|------|------|
| U-03-A1 | MVP T4 | JSON 含 `results`，无堆栈 |
| U-03-A2 | B1-A3 | `includeItems: true` 时独立 `items` |

## 测试映射

[MVP-TC.md](../../tests/MVP-TC.md) → T4；[MVP-TC-gap-B1-B4.md](../../tests/MVP-TC-gap-B1-B4.md) → TC-B1-03

## 实现

`MCP Server/lib/tools.js` → `getSalesOrderStatus`
