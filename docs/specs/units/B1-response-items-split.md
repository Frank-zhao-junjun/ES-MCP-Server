# Unit Spec B1 — PO/SO 行项目 `items` 拆分

| 字段 | 值 |
|------|-----|
| **Unit ID** | B1 |
| **状态** | done |
| **关联 US** | US-01 采购订单、US-03 销售订单 |
| **关联 FR** | FR-04、FR-05；§6.1.5 |
| **关联 PRD** | `docs/MVP需求说明.md` v1.1.1 §6.1.5、T5 |

## 问题陈述

v1.1.1 规定 `includeItems: true` 时，采购/销售订单须返回 `{ results, items }`，行项目从 `$expand` 嵌套中拆出。**已实现** `splitExpandedLineItems()`。

## 范围

**In scope**

- `get_purchase_order`：`$expand=_PurchaseOrderItem`（本租户 V4 导航属性；非 `to_*`）
- `get_sales_order_status`：`to_Item` → 顶层 `items`
- 新增/复用 `splitExpandedLineItems()` 工具函数

**Out of scope**

- `get_supplier_invoice`（沿用 `header`/`lines`，B1 文档一致性已在 v1.1.1 完成）
- schedule/pricing/notes 等其他 expand 字段拆分

## 接口契约

### `get_purchase_order` — `includeItems: true`

```json
{
  "results": [{ "PurchaseOrder": "4500000000" }],
  "items": [{ "PurchaseOrderItem": "10", "Material": "MAT001" }]
}
```

- `results` 中 **不得** 含 `to_PurchaseOrderItem` 键

### `get_sales_order_status` — `includeItems: true`

```json
{
  "results": [{ "SalesOrder": "19" }],
  "items": [{ "SalesOrderItem": "10" }]
}
```

- `results` 中 **不得** 含 `to_Item` 键

### `includeItems: false`

行为不变：仅 `{ results }`，无 `items` 字段。

## 验收标准

| # | 条件 | Pass |
|---|------|------|
| B1-A1 | T5 入参 `{ purchaseOrder, includeItems: true }` | 响应含独立 `items` 数组 |
| B1-A2 | T5 `results[0]` | 无 `to_PurchaseOrderItem` |
| B1-A3 | SO + `includeItems: true` | 含 `items`，header 无 `to_Item` |
| B1-A4 | `includeItems: false` | 无 `items` 字段 |

## 测试映射

- `docs/tests/MVP-TC-gap-B1-B4.md` → TC-B1-01～03
- `docs/tests/MVP-TC.md` → T5
- `MCP Server/test/tools-utils.test.js`

## 实现文件

- `MCP Server/lib/tools.js`
