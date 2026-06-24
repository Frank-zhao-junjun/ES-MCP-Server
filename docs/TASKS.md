# MCP Server — Lean Tasks (one by one)

Execute in order. **Finish + verify each task before starting the next.**

Reference: [MCP-Server开发指南.md](MCP-Server开发指南.md) · [SAP接口连通性手册.md](SAP接口连通性手册.md)

---

## Phase 0 — Scaffold

### Task 0.1 — `package.json`

**Do:** Create `MCP Server/package.json` (`sap-s4-mcp`, `main: mcp-server.js`, scripts `start` / `probe`).

**Done when:** `npm install` succeeds (deps already in `node_modules`).

---

### Task 0.2 — Boot stdio only

**Do:** Create minimal `mcp-server.js` — load `.env`, start MCP SDK stdio transport, register zero tools, log `[sap-s4-mcp v0.1] Ready`.

**Done when:** `node mcp-server.js` starts without error; stderr shows ready message.

---

### Task 0.3 — `lib/credentials.js`

**Do:** Extract `parseCredentials()` from `scripts/probe-sap-connectivity.js` into `MCP Server/lib/credentials.js` (same regex, export function).

**Done when:** Quick one-liner or tiny script prints `EPC_USER` + password count from `../user.txt`.

---

### Task 0.4 — `mcp-sap-core.js` skeleton

**Do:** Create `mcp-sap-core.js` with `loadConfig()`, `sapGet(path)` — Basic Auth, `sap-client`, timeout from env.

**Done when:** `sapGet('/sap/opu/odata/sap/API_PRODUCT_SRV/A_Product?$top=1&$format=json')` returns 200 JSON in a test call.

---

## Phase 1 — MVP tools (7)

### Task 1.1 — `health_check`

**Do:** Register MCP tool `health_check` — returns `{ mcp: 'ok', sap: <status of one known GET> }`.

**Done when:** Cursor or `npx @modelcontextprotocol/inspector` calls tool and gets `sap: 200`.

---

### Task 1.2 — `get_product`

**Do:** Tool `{ product?, filter?, top? }` → V4 `Product` or V2 `A_Product`.

**Done when:** Call with `top: 1` returns at least one product row.

---

### Task 1.3 — `get_business_partner`

**Do:** Tool `{ customer?, supplier?, filter?, top? }` → `A_Customer` / `A_Supplier`.

**Done when:** List or single partner returns 200.

---

### Task 1.4 — `get_sales_order_status`

**Do:** Tool `{ salesOrder?, includeItems? }` → SalesOrder V4 (+ items if flag).

**Done when:** List `$top=1` or known order number works.

---

### Task 1.5 — `get_purchase_order`

**Do:** Tool `{ purchaseOrder?, includeItems?, includeSchedule?, includePricing?, includeNotes? }` → `api_purchaseorder_2` entities.

**Done when:** Header-only and header+items for a known PO (e.g. `4500000000`) work.

---

### Task 1.6 — `get_material_stock`

**Do:** Tool `{ material?, plant?, filter? }` → `A_MatlStkInAcctMod`.

**Done when:** `$top=1` returns stock row or empty `value`/`results` with 200.

---

### Task 1.7 — `get_supplier_invoice`

**Do:** Tool `{ invoice?, fiscalYear?, includeLines? }` → V2 `A_SupplierInvoice` + optional `A_SuplrInvcItemPurOrdRef`.

**Done when:** Sample `5105600101` / `2025` returns header (+ lines if requested).

---

### Task 1.8 — `get_cost_center`

**Do:** Tool `{ costCenter?, companyCode?, filter? }` → `A_CostCenter_2`.

**Done when:** `$top=1` returns 200.

---

### Task 1.9 — MVP gate

**Do:** Smoke-test all 7 tools via MCP inspector; fix 401/parse issues.

**Done when:** All 7 return structured JSON (not stack traces). Update `ES接口清单.xlsx` col I to `OK(200)` for these rows if needed.

---

## Phase 2 — Infra + cross-doc tools

### Task 2.1 — SAP error mapping

**Do:** Centralize 401 → `SAP_AUTH_FAILED`, 403 → `SAP_ARRANGEMENT_REQUIRED`, 404 → `SAP_NOT_FOUND`.

**Done when:** One tool returns readable error object on bad path test.

---

### Task 2.2 — `get_entity_schema`

**Do:** Tool `{ service, entity }` → parse `$metadata` for field names (cache optional).

**Done when:** `API_PRODUCT_SRV` + `A_Product` returns property list.

---

### Task 2.3 — `list_sap_scenarios`

**Do:** Tool `{}` → return built-in table from probe `ENDPOINTS` (or scan `SAP_SCENARIO_DIR`).

**Done when:** Returns ≥ 33 scenario entries with `key` + `baseUrl`.

---

### Task 2.4 — `query_sap_scenario`

**Do:** Tool `{ key, entity?, filter?, top? }` → dynamic GET by scenario key.

**Done when:** `key` for sales order + `top: 1` returns 200.

---

### Task 2.5 — `trace_sales_order`

**Do:** Tool `{ salesOrder }` → chain SalesOrder → OutboundDelivery → Billing → MaterialDoc (best-effort links).

**Done when:** Known SO returns combined object with sub-call status per leg.

---

### Task 2.6 — HTTP transport

**Do:** Enable `MCP_ENABLE_HTTP_TRANSPORT` — `GET /`, `POST /mcp` on port 3000.

**Done when:** `curl http://127.0.0.1:3000/` returns service JSON.

---

### Task 2.7 — `authenticate`

**Do:** Tool `{ api_key }` + optional Bearer check on HTTP when `MCP_REQUIRE_API_KEY=true`.

**Done when:** Valid key → `{ success: true }`; invalid → error.

---

## Phase 3 — Blocked / arrangement-dependent

> Run only after Basis opens arrangements, or implement with clear 403 messages.

| Task | Tool | Blocker |
|------|------|---------|
| 3.1 | `get_purchase_requisition` | SAP_COM_0102 |
| 3.2 | `get_schedule_agreement` | SAP_COM_0103 |
| 3.3 | `get_sales_contract` | SAP_COM_0119 |
| 3.4 | `get_bom` | API_BILL_OF_MATERIAL_SRV |
| 3.5 | `get_material_reservation` | Reservation V4 |
| 3.6 | Supplier invoice V4 path | SAP_COM_0054 |
| 3.7 | Master data helpers (plant, payment terms, …) | SAP_COM_0087 |

**Done when:** Probe shows 200 for that endpoint, then tool works.

---

## Phase 4 — Hardening

### Task 4.1 — Shared endpoints module

**Do:** Move `ENDPOINTS` from `probe-sap-connectivity.js` to `lib/sap-endpoints.js`; import in probe + MCP.

**Done when:** Probe still writes `Probe_Latest.json` with same counts.

---

### Task 4.2 — Credential unit tests

**Do:** Test `parseCredentials` for Chinese + English `user.txt` samples (no real passwords in repo).

**Done when:** `npm test` passes.

---

### Task 4.3 — Git hygiene

**Do:** Commit source; confirm `.gitignore` excludes `user.txt`, `.env`.

**Done when:** `git status` shows no secrets.

---

### Task 4.4 — Docs sync

**Do:** Update `README.md` + dev guide §1 status to “MVP shipped” when Phase 1.9 passes.

**Done when:** Docs match reality.

---

## SAP-side (parallel, not code)

| # | Action | Unblocks |
|---|--------|----------|
| S1 | Request **SAP_COM_0087** (Scope 1YB) | 6 master-data APIs |
| S2 | Request **SAP_COM_0054** | Invoice V4 |
| S3 | Request **0102 / 0103 / 0119** if needed | PR, schedule agreement, sales contract |

---

## Next action

**Start with Task 0.1** — say `go 0.1` when ready.
