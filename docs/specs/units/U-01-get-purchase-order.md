# Unit Spec U-01 — `get_purchase_order`

| 字段 | 值 |
|------|-----|
| **Unit ID** | U-01 |
| **状态** | done |
| **关联 US** | US-01 |
| **关联 FR** | FR-05；§6.1.5 |
| **关联 PRD** | [MVP需求说明.md](../../MVP需求说明.md) §6.2 FR-05 |

## 用途

查询采购订单抬头；`includeItems: true` 时返回独立 `items` 行数组（EPC 核心场景）。

## 入参

| 参数 | 类型 | 说明 |
|------|------|------|
| `purchaseOrder` | string? | 单条 PO 号 |
| `includeItems` | boolean? | 含行项目 → `items` |
| `includeSchedule` / `includePricing` / `includeNotes` | boolean? | MVP 不验收 |
| `top` | number? | 列表默认 10，max 1000 |

## 出参

`includeItems: true`：

```json
{ "results": [{ "PurchaseOrder": "4500000000" }], "items": [{ "PurchaseOrderItem": "10" }] }
```

`includeItems: false`：仅 `{ "results": [...] }`。

## 验收

| # | 用例 | Pass |
|---|------|------|
| U-01-A1 | MVP T5：`4500000000` + `includeItems: true` | `results` + 独立 `items` |
| U-01-A2 | MVP E4：不存在 PO | `results: []` 或 `SAP_NOT_FOUND` |

## 测试映射

[MVP-TC.md](../../tests/MVP-TC.md) → T5、E4

## 实现

`MCP Server/lib/tools.js` → `getPurchaseOrder`
