# Unit Spec U-04 — `get_material_stock`

| 字段 | 值 |
|------|-----|
| **Unit ID** | U-04 |
| **状态** | done |
| **关联 US** | US-04 |
| **关联 FR** | FR-06 |
| **关联 PRD** | [MVP需求说明.md](../../MVP需求说明.md) §6.2 FR-06 |

## 用途

查询物料库存（V2 `API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod`）。

## 入参

`material`、`plant`、`filter`、`top`（可选；`material`/`plant` 可合成 `$filter`）。

## 出参

`{ "results": [...] }` — 允许空数组。

## 验收

MVP T6：`{ "top": 1 }` 返回 200。

## 测试映射

[MVP-TC.md](../../tests/MVP-TC.md) → T6

## 实现

`MCP Server/lib/tools.js` → `getMaterialStock`
