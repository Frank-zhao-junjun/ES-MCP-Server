# Unit Spec U-02 — `get_supplier_invoice`

| 字段 | 值 |
|------|-----|
| **Unit ID** | U-02 |
| **状态** | done |
| **关联 US** | US-02 |
| **关联 FR** | FR-07；§6.1.2 |
| **关联 PRD** | [MVP需求说明.md](../../MVP需求说明.md) §6.2 FR-07 |

## 用途

查询供应商发票（**仅 V2** `API_SUPPLIERINVOICE_PROCESS_SRV`）；可选 PO 引用行。

## 入参

| 参数 | 类型 | 说明 |
|------|------|------|
| `invoice` | string? | 发票号 |
| `fiscalYear` | string? | 不传时默认当前系统年度 |
| `includeLines` | boolean? | 独立 GET 行 → `lines` |

## 出参

```json
{ "header": [...], "lines": [...] }
```

不使用 `results` / `items`（与 PO/SO 区分）。

## 验收

| # | 用例 | Pass |
|---|------|------|
| U-02-A1 | MVP T7 | `header`、`lines` 非空 |
| U-02-A2 | MVP E5 | 仅 `invoice`，默认财年 |
| U-02-A3 | MVP E6 | 无效发票不崩溃 |

## 测试映射

[MVP-TC.md](../../tests/MVP-TC.md) → T7、E5、E6

## 实现

`MCP Server/lib/tools.js` → `getSupplierInvoice`
