# Unit Spec B3 — fiscalYear 默认与 health 版本号

| 字段 | 值 |
|------|-----|
| **Unit ID** | B3 |
| **状态** | done |
| **关联 US** | US-07 供应商发票 |
| **关联 FR** | FR-01、FR-07 |
| **关联 PRD** | `docs/MVP需求说明.md` v1.1.1 §9.3 E5 |

## 问题陈述

1. **FR-07**：`get_supplier_invoice` 未传 `fiscalYear` 时默认当前系统年度。**已实现。**
2. **FR-01**：`health_check.version` 从 `package.json` 读取。**已实现。**

v1.1.1 文档路径/版本号（原 review B2/B3 文档项）已对齐，本 Unit 聚焦 **代码** 行为。

## 范围

**In scope**

- `getSupplierInvoice`：有 `invoice` 无 `fiscalYear` 时使用 `String(new Date().getFullYear())`
- `healthCheck`：`version` 读取 `MCP Server/package.json`

**Out of scope**

- 财年日历（非自然年）逻辑
- 多 invoice 批量查询语义变更

## 接口契约

### E5 — 不传 fiscalYear

```javascript
// 入参
{ "invoice": "5105600101" }

// 行为：等价于 fiscalYear = 当前年（如 "2026"）
// 成功时返回 { header: [...] }
```

### FR-01 — health_check

```json
{
  "mcp": "ok",
  "version": "0.1.0",
  "time": "2026-06-23T..."
}
```

`version` 必须与 `package.json` 的 `version` 字段一致。

## 验收标准

| # | 条件 | Pass |
|---|------|------|
| B3-A1 | E5 入参（仅 invoice） | 使用当前年构造 OData URL |
| B3-A2 | `health_check` | `version === package.json.version` |
| B3-A3 | 显式传 `fiscalYear: "2025"` | 仍用 2025，不被覆盖 |

## 测试映射

- `docs/tests/MVP-TC-gap-B1-B4.md` → TC-B3-01～02
- `docs/tests/MVP-TC.md` → E5、T1
- `MCP Server/test/tools-utils.test.js`

## 实现文件

- `MCP Server/lib/tools.js`
