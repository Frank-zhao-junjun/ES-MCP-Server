# Spec 005 — v0.4 Features

> **Status**: ✅ Complete | **Version**: 0.4 | **Owner**: Backend
>
> Covers: MCP_API_KEYS multi-key, SAP Cache, Auto-Pagination, Prometheus Metrics

## 1. MCP_API_KEYS 多键 + 角色绑定

### FR-001: Multi-Key Authentication
- `MCP_API_KEYS` env var: JSON `{"key1": "readonly", "key2": "admin"}`
- Each key has its own role + failure counter + lockout
- `MCP_API_KEYS` takes precedence over single `MCP_API_KEY`
- Backward compatible: single key mode unchanged

### Design
```
MCP_API_KEYS='{"key-a":"readonly","key-b":"admin"}'
  → context.apiKeys = Map<key, { role, failedAttempts, lockUntil }>
  → authenticate(key) → match key → set context.authenticatedKey + role
  → per-key lockout (5 fails → 30s)
```

### Acceptance
- [x] Multi-key JSON parsed correctly
- [x] Invalid JSON → fallback to single key mode
- [x] Unknown role → default "readonly"
- [x] Per-key lockout independent

### Files
- `mcp-auth.js` — `_parseMultiKeys()`, multi-key `authenticate()`
- `lib/roles.js` — `canUseDebugTools()`, `canUseAdminTools()`

---

## 2. SAP 响应缓存

### FR-002: TTL Memory Cache
- `lib/sap-cache.js` — `SapCache` class
- Config: `SAP_CACHE_TTL_MS` (default 300000 = 5min, 0 = disabled)
- URL normalization: strips `sap-client`, sorts query params
- Auto-invalidate on 401/403
- Metrics: `hits`, `misses`, `invalidations`

### Acceptance
- [x] Cache hit returns stored response
- [x] Cache miss calls SAP and stores
- [x] TTL expiry → re-fetch
- [x] 401/403 → clear all cache
- [x] `SAP_CACHE_TTL_MS=0` disables cache

### Files
- `lib/sap-cache.js`
- Integration: `mcp-sap-core.js` sapFetch wrapper

---

## 3. 自动分页

### FR-003: Transparent Pagination
- `lib/auto-pagination.js`
- Config: `MCP_AUTO_PAGE_MAX` (default 0 = disabled, hard cap 5000)
- V4: follows `@odata.nextLink`
- V2: falls back to `$skip` pagination
- `extractNextLink()` supports V2 (`data.d.__next`) and V4

### Acceptance
- [x] `MCP_AUTO_PAGE_MAX > 0` enables auto-pagination
- [x] Follows `@odata.nextLink` until null or max reached
- [x] Falls back to `$skip` for V2
- [x] Hard cap at 5000 records

### Files
- `lib/auto-pagination.js`

---

## 4. Prometheus Metrics

### FR-004: Metrics Endpoint
- `lib/metrics-server.js` — optional HTTP sidecar
- Config: `MCP_METRICS_PORT` (default 0 = disabled)
- Endpoints: `/metrics` (Prometheus text format), `/healthz`
- Metrics exposed:
  - `mcp_requests_total{status}` — Counter
  - `mcp_request_duration_seconds` — Histogram
  - `mcp_sap_calls_total{status}` — Counter
  - `mcp_sap_call_duration_seconds` — Histogram
  - `mcp_cache_hits_total` / `mcp_cache_misses_total` — Counter
  - `mcp_active_requests` — Gauge
  - `mcp_uptime_seconds` — Gauge

### Acceptance
- [x] `/metrics` returns valid Prometheus format
- [x] `/healthz` returns 200
- [x] `MCP_METRICS_PORT=0` disables server
- [x] All 8 metrics present when enabled

### Files
- `lib/metrics-server.js`
- `package.json` — express dependency reused
