# Unit Spec 索引

| 字段 | 值 |
|------|-----|
| **PRD 主文档** | [MVP需求说明.md](../../MVP需求说明.md) v1.1.1 |
| **差距 PRD** | [PRD-MVP-gap-B1-B4.md](../PRD-MVP-gap-B1-B4.md) |
| **测试用例** | [docs/tests/](../../tests/) |

## MVP 8 工具（U-01～U-08）

| Unit ID | 工具 | US | FR | Spec |
|---------|------|----|----|------|
| U-01 | `get_purchase_order` | US-01 | FR-05 | [U-01-get-purchase-order.md](U-01-get-purchase-order.md) |
| U-02 | `get_supplier_invoice` | US-02 | FR-07 | [U-02-get-supplier-invoice.md](U-02-get-supplier-invoice.md) |
| U-03 | `get_sales_order_status` | US-03 | FR-04 | [U-03-get-sales-order-status.md](U-03-get-sales-order-status.md) |
| U-04 | `get_material_stock` | US-04 | FR-06 | [U-04-get-material-stock.md](U-04-get-material-stock.md) |
| U-05 | `health_check` | US-05 | FR-01 | [U-05-health-check.md](U-05-health-check.md) |
| U-06 | `get_business_partner` | US-06 | FR-03 | [U-06-get-business-partner.md](U-06-get-business-partner.md) |
| U-07 | `get_cost_center` | US-07 | FR-08 | [U-07-get-cost-center.md](U-07-get-cost-center.md) |
| U-08 | `get_product` | US-08 | FR-02 | [U-08-get-product.md](U-08-get-product.md) |

## 差距修复（B1～B4）

| Unit ID | 主题 | 状态 | Spec |
|---------|------|------|------|
| B1 | PO/SO `items` 拆分 | done | [B1-response-items-split.md](B1-response-items-split.md) |
| B2 | 扩展错误码 | done | [B2-error-code-mapping.md](B2-error-code-mapping.md) |
| B3 | fiscalYear 默认 + version | done | [B3-fiscal-year-and-version.md](B3-fiscal-year-and-version.md) |
| B4 | 可观测性 + 参数校验 | done | [B4-observability-and-validation.md](B4-observability-and-validation.md) |

## 新建 Unit Spec 模板

见 [`.claude/skills/sdd-workflow/SKILL.md`](../../../.claude/skills/sdd-workflow/SKILL.md)。
