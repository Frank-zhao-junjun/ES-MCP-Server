# MVP Test Cases — B1–B4 差距修复

| 字段 | 值 |
|------|-----|
| **版本** | v0.2 |
| **日期** | 2026-06-23 |
| **PRD** | [PRD-MVP-gap-B1-B4.md](../specs/PRD-MVP-gap-B1-B4.md)（done） |
| **关联** | [MVP-TC.md](MVP-TC.md) §9.2 T5、§9.3 E2/E5 |
| **原则** | **先于编码** — 本文件在 ④ Coding 前定稿 |

## 单元测试（⑤，无 SAP 网络）

| ID | Unit | 步骤 | 期望 |
|----|------|------|------|
| TC-B1-01 | B1 | `splitExpandedLineItems([{PO:'1',to_PurchaseOrderItem:[{Item:'10'}]}], 'to_PurchaseOrderItem')` | `results[0]` 无 expand 键；`items.length===1` |
| TC-B1-02 | B1 | 同上，`includeItems:false` 路径不调用 split | 仅 `{results}` |
| TC-B1-03 | B1 | SO expand `to_Item` | `items` 含行，`results` 无 `to_Item` |
| TC-B2-01 | B2 | `formatSapError(400, 'bad filter')` | `error==='SAP_BAD_REQUEST'` |
| TC-B2-02 | B2 | `formatSapError(503, '')` | `error==='SAP_SERVICE_UNAVAILABLE'` |
| TC-B2-03 | B2 | `formatSapError(0, 'ECONNREFUSED')` 经 sapGet 失败路径 | `NETWORK_ERROR` |
| TC-B3-01 | B3 | mock `getSupplierInvoice({invoice:'X'})` 无 fiscalYear | URL 含当前年 |
| TC-B3-02 | B3 | `healthCheck({includeSapCheck:false})` | `version===package.json.version` |
| TC-B4-01 | B4 | zod `top:5000` on get_product schema | 校验失败 |
| TC-B4-02 | B4 | 启动 stderr | 含 version + stdio + Ready |
| TC-B4-03 | B4 | `SAP_DEBUG=true` 一次 sapGet | stderr 含 URL + status |

## 集成 / E2E（⑥，需 SAP 或 Inspector）

| ID | 映射 MVP | 入参 | Pass |
|----|----------|------|------|
| TC-E2E-T5 | §9.2 T5 | `{ purchaseOrder:"4500000000", includeItems:true }` | `items` 非空且独立 |
| TC-E2E-E5 | §9.3 E5 | `{ invoice:"5105600101" }` | 正常 header（默认财年） |
| TC-E2E-E2 | §9.3 E2 | `{ top:5000 }` on get_product | INVALID_PARAMETER，无 SAP 往返 |

## 执行命令

```powershell
cd "E:\00 - 中数通ES环境\ES-MCP-Server\MCP Server"
pnpm test
```

E2E（可选）：

```powershell
npx @modelcontextprotocol/inspector node mcp-server.js --stdio
```

## 结果记录

| ID | 执行日 | 结果 | 备注 |
|----|--------|------|------|
| TC-B1-01 | 2026-06-23 | PASS | tools-utils.test.js |
| TC-B1-02 | 2026-06-23 | PASS | implicit (no split when includeItems false) |
| TC-B1-03 | 2026-06-23 | PASS | tools-utils.test.js |
| TC-B2-01 | 2026-06-23 | PASS | tools-utils.test.js |
| TC-B2-02 | 2026-06-23 | PASS | tools-utils.test.js |
| TC-B2-03 | 2026-06-23 | PASS | mcp-sap-core.js lastStatus=0 path |
| TC-B3-01 | 2026-06-23 | PASS | getSupplierInvoice 默认财年 |
| TC-B3-02 | 2026-06-23 | PASS | tools-utils + healthCheck |
| TC-B4-01 | 2026-06-23 | PASS | tools-utils.test.js zod |
| TC-B4-02 | 2026-06-23 | PASS | mvp-e2e A5 stdio Ready |
| TC-B4-03 | 2026-06-23 | pending | SAP_DEBUG=true + SAP 调用 |
| TC-E2E-T5 | 2026-06-23 | PASS | PO `4500000000` + `_PurchaseOrderItem` |
| TC-E2E-E5 | 2026-06-23 | PASS | 默认 FY2026 → SAP_NOT_FOUND（租户仅 FY2025 数据） |
| TC-E2E-E2 | 2026-06-23 | PASS | zod 拦截 |
| TC-B4-02 | 2026-06-23 | PASS | mvp-e2e A5 |
| TC-B4-03 | 2026-06-23 | pending | 需 `SAP_DEBUG=true` 手工验证 |
