# Unit Spec U-07 — `get_cost_center`

| 字段 | 值 |
|------|-----|
| **Unit ID** | U-07 |
| **状态** | done |
| **关联 US** | US-07 |
| **关联 FR** | FR-08 |
| **关联 PRD** | [MVP需求说明.md](../../MVP需求说明.md) §6.2 FR-08 |

## 用途

查询成本中心主数据（V4 `api_cost_center/.../A_CostCenter_2`）。

## 入参

`costCenter`、`companyCode`、`filter`、`top`。

## 出参

`{ "results": [...] }`

## 验收

MVP T8：`{ "top": 1 }` 返回 200。

## 测试映射

[MVP-TC.md](../../tests/MVP-TC.md) → T8

## 实现

`MCP Server/lib/tools.js` → `getCostCenter`
