# Unit Spec U-06 — `get_business_partner`

| 字段 | 值 |
|------|-----|
| **Unit ID** | U-06 |
| **状态** | done |
| **关联 US** | US-06 |
| **关联 FR** | FR-03 |
| **关联 PRD** | [MVP需求说明.md](../../MVP需求说明.md) §6.2 FR-03 |

## 用途

查询客户或供应商主数据。`customer` → `A_Customer`；`supplier` → `A_Supplier`；均未指定默认列客户。

## 入参

`customer`、`supplier`、`filter`、`top`（max 1000）。

## 出参

`{ "results": [...] }`

## 验收

| # | 用例 | Pass |
|---|------|------|
| U-06-A1 | MVP T3 | `{ "top": 1 }` 含 `results` |
| U-06-A2 | MVP E3 | 无参默认 10 条客户 |

## 测试映射

[MVP-TC.md](../../tests/MVP-TC.md) → T3、E3

## 实现

`MCP Server/lib/tools.js` → `getBusinessPartner`
