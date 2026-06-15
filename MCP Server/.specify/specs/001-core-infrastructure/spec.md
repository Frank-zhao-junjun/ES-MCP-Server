# Spec 001 — Core Infrastructure

> **Status**: ✅ Complete | **Version**: 0.3 | **Owner**: Backend
>
> Covers: US-001 (Auth), US-006 (Health Check), US-008 (Roles), US-009 (Rate Limiting)

## 1. Functional Requirements

### FR-001: MCP API Key Authentication
- MCP Server requires a pre-shared key via `MCP_API_KEY` env var
- Agent MUST call `authenticate` tool first before any business tool
- Wrong key → `AUTH_INVALID_KEY`; 5 failures in a row → 30s lock (`AUTH_LOCKED`)
- Unauthenticated calls → `AUTH_REQUIRED`
- `MCP_REQUIRE_API_KEY=true` prevents auto-generation of temporary keys

### FR-002: Health Check
- `health_check` tool returns server status, auth state, config validity, SAP connectivity
- **Unauthenticated**: minimal response — `server.ok`, `auth.ok: false`, version, uptime
- **Authenticated**: full response — credentials file, scenario dir, SAP connectivity, metrics
- `includeSapCheck=false` skips real SAP HTTP call for faster response

### FR-003: Role-Based Access Control
- `MCP_ROLE` env var: `readonly` (default), `debug`, `admin`
- `readonly`: business tools only
- `debug`: +`query_sap_scenario`
- `admin`: +`load_plugin`, `unload_plugin`, `list_loaded_plugins`
- Individual `MCP_ENABLE_DEBUG_TOOLS` / `MCP_ENABLE_ADMIN_TOOLS` override role

### FR-004: SAP Call Rate Limiting
- Concurrent SAP call limit: `MCP_SAP_MAX_CONCURRENT` (default 5)
- Rate per minute: `MCP_SAP_RATE_PER_MIN` (default 60)
- Exceeded → queued (FIFO), 30s timeout → `RATE_LIMITED` error
- Circuit breaker: 3 consecutive failures → 30s open → `SAP_UNAVAILABLE`

## 2. Technical Design

### Auth Flow
```
Agent                    mcp-auth.js              MCP Server
  |                          |                        |
  |-- authenticate(api_key)->|                        |
  |                          |-- validate key         |
  |                          |-- check lock           |
  |<-- {ok, authenticated}---|                        |
  |                          |                        |
  |-- get_sales_order(...)-->|                        |
  |                          |-- requireAuth()        |
  |                          |-- pass if authenticated |
```

### Role Resolution
```
MCP_ENABLE_DEBUG_TOOLS  ──┐
                           ├──> canUseDebugTools()
MCP_ROLE                  ──┘
                           │
MCP_ENABLE_ADMIN_TOOLS  ──┐
                           ├──> canUseAdminTools()
MCP_ROLE                  ──┘
```
Priority: explicit env var override > MCP_ROLE

### Rate Limiter
```
sapFetch()
  ├── checkCircuitBreaker()     → OPEN? → SAP_UNAVAILABLE
  ├── sapRateLimiter.acquire()  → full? → queue (30s timeout)
  ├── sapFetchOnce() × retries
  └── sapRateLimiter.release()  → wake next waiter
```

## 3. Acceptance Criteria

- [x] `authenticate` with valid key → `authenticated: true`
- [x] `authenticate` with invalid key → `AUTH_INVALID_KEY`
- [x] 5 failures → 30s lock → `AUTH_LOCKED`
- [x] Business tool without auth → `AUTH_REQUIRED`
- [x] `MCP_REQUIRE_API_KEY=true` + no key → startup abort
- [x] `health_check` unauthenticated → minimal (no paths)
- [x] `health_check` authenticated → full (paths, SAP test)
- [x] `MCP_ROLE=readonly` → plugin tools return `ADMIN_TOOL_DISABLED`
- [x] `MCP_ROLE=admin` → all tools available
- [x] Concurrent SAP calls > 5 → queued
- [x] Rate > 60/min → queued
- [x] Circuit breaker opens after 3 failures

## 4. Files

| File | Responsibility |
|---|---|
| `mcp-auth.js` | API key validation, lockout, `requireAuth` |
| `lib/roles.js` | `MCP_ROLE` resolution, `canUseDebugTools`, `canUseAdminTools` |
| `lib/rate-limiter.js` | Token bucket + concurrency limiter |
| `mcp-sap-core.js` | Circuit breaker, `sapFetch` integration |
| `mcp-server.js` | Tool registration, `requireAdminTool`, `validateStartupConfig` |
| `lib/errors.js` | `AUTH_*`, `ADMIN_TOOL_DISABLED`, `RATE_LIMITED`, `SAP_UNAVAILABLE` |

## 5. Test Coverage

| Layer | File | What |
|---|---|---|
| Unit | `tests/unit/mcp-auth.test.js` | Auth context, lockout, requireAuth |
| Unit | `tests/unit/lib-errors.test.js` | Error code stability |
| Unit | `tests/unit/observability.test.js` | Metrics store |
| Contract | `tests/contract/mcp-client.test.js` | Auth success/failure, health_check, error codes |
