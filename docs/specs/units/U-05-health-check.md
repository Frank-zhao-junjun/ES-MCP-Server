# Unit Spec U-05 — `health_check`

| 字段 | 值 |
|------|-----|
| **Unit ID** | U-05 |
| **状态** | done |
| **关联 US** | US-05 |
| **关联 FR** | FR-01 |
| **关联 PRD** | [MVP需求说明.md](../../MVP需求说明.md) §6.2 FR-01 |

## 用途

MCP 进程健康检查；可选探测 SAP（`API_PRODUCT_SRV` `$top=1`）。

## 入参

`includeSapCheck`（默认 true）、`includeScenarios`（默认 false）。

## 出参

```json
{ "mcp": "ok", "version": "<package.json>", "time": "ISO8601", "sap": { "status", "ok" } }
```

`version` 须与 `MCP Server/package.json` 一致。

## 验收

| # | 用例 | Pass |
|---|------|------|
| U-05-A1 | MVP T1 | `sap.ok === true` |
| U-05-A2 | MVP E1 | `includeSapCheck: false` 时无 `sap` |

## 测试映射

[MVP-TC.md](../../tests/MVP-TC.md) → T1、E1；B3 → TC-B3-02

## 实现

`MCP Server/lib/tools.js` → `healthCheck`
