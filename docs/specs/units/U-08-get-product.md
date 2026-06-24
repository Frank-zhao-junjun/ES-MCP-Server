# Unit Spec U-08 — `get_product`

| 字段 | 值 |
|------|-----|
| **Unit ID** | U-08 |
| **状态** | done |
| **关联 US** | US-08 |
| **关联 FR** | FR-02 |
| **关联 PRD** | [MVP需求说明.md](../../MVP需求说明.md) §6.2 FR-02 |

## 用途

查询产品主数据（V2 `API_PRODUCT_SRV/A_Product`）。

## 入参

`product`、`filter`、`top`（默认 10，max 1000；zod 拦截超范围）。

## 出参

`{ "results": [...] }`

## 验收

| # | 用例 | Pass |
|---|------|------|
| U-08-A1 | MVP T2 | `{ "top": 1 }` 含 `results` |
| U-08-A2 | MVP E2 | `top: 5000` → `INVALID_PARAMETER`，不请求 SAP |

## 测试映射

[MVP-TC.md](../../tests/MVP-TC.md) → T2、E2；B4 → TC-B4-01

## 实现

`MCP Server/lib/tools.js` → `getProduct`；`mcp-server.js` zod schema
