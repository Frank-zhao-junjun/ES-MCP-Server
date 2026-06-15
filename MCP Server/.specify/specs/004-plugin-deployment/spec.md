# Spec 004 — Plugin System & Deployment

> **Status**: ✅ Complete | **Version**: 0.3 | **Owner**: Backend
>
> Covers: US-010 (Deployment); Plugin management tools; Observability

## 1. Functional Requirements

### FR-001: Plugin Management (Admin Only)
- `load_plugin(pluginPath)`: load `.js` plugin file, register its tools
- `unload_plugin(pluginId)`: remove plugin and all its tools from MCP registry
- `list_loaded_plugins()`: return all active plugins with tool counts
- All three gated behind `MCP_ENABLE_ADMIN_TOOLS=true` or `MCP_ROLE=admin`
- Plugin path must be within allowed directories (`plugins/`, optionally `examples/`)

### FR-002: Plugin Lifecycle
- Plugin validated via `validatePlugin()` before registration
- Tool name conflicts → rollback (remove already-registered tools)
- `init()` / `cleanup()` hooks called on register/unregister
- `loadPluginFromFile()` clears require cache for hot reload

### FR-003: Containerized Deployment
- `Dockerfile`: multi-stage (build → runtime), Node 20 Alpine, non-root user
- `HEALTHCHECK`: 30s interval, verifies Node process alive
- `.dockerignore`: excludes dev files, tests, docs, examples
- `.env.example`: full env var documentation with defaults
- `mcp.json`: MCP client config template

### FR-004: Observability
- Structured JSON logs to stderr: `{ timestamp, level, requestId, traceId, tool, durationMs, status, error, sapCalls }`
- `MetricsStore`: request count, success/failure, p50/p95 durations, per-tool stats
- `TraceContext`: per-request trace ID, SAP call log aggregation
- `health_check` exposes metrics snapshot

## 2. Technical Design

### Plugin Registration Flow
```
load_plugin("plugins/my-tool.js")
  ├── isAllowedPluginPath() → check dir whitelist
  ├── loadPluginFromFile() → require() + cache clear
  ├── validatePlugin() → check id/name/version/tools schema
  ├── PluginManager.registerPlugin()
  │   ├── For each tool:
  │   │   ├── Check name uniqueness
  │   │   ├── server.tool(name, desc, params, handler) → RegisteredTool handle
  │   │   └── Store handle for later remove()
  │   └── If conflict → rollback all, return false
  └── SDK sends notifications/tools/list_changed to clients
```

### Docker Multi-Stage
```
Stage 1 (build):
  COPY package*.json → npm ci --omit=dev

Stage 2 (runtime):
  COPY --from=build node_modules
  COPY source code
  RUN rm -rf tests docs examples specs
  USER mcp (non-root)
  ENTRYPOINT ["node", "mcp-server.js"]
```

### Trace Context Threading
```
wrapTool()
  ├── traceId = generateTraceId()
  ├── traceCtx = createTraceContext(traceId)
  ├── sapDependencies(traceId)
  │   └── sapFetch wrapper:
  │       ├── recordSapCall(traceCtx, url, duration, status)
  │       └── traceCtx.sapCalls[] accumulates call log
  └── logRequest({ ..., traceId, sapCalls: traceCtx.sapCalls })
```

## 3. Acceptance Criteria

- [x] `load_plugin("examples/sample-plugin.js")` registers tools (admin mode)
- [x] Same plugin twice → error, no duplicate tools
- [x] `unload_plugin("sample-plugin")` removes tools from `tools/list`
- [x] `list_loaded_plugins()` returns plugin count + tool counts
- [x] Non-admin role → `ADMIN_TOOL_DISABLED`
- [x] Plugin path outside allowed dirs → rejected
- [x] Invalid plugin (missing id/name/tools) → validation error
- [x] Docker build succeeds, runs as non-root
- [x] `HEALTHCHECK` returns healthy
- [x] Structured logs contain all required fields
- [x] `health_check` returns metrics with p50/p95
- [x] `recordSapCall` uses `traceCtx` (not null)

## 4. Files

| File | Responsibility |
|---|---|
| `lib/plugin-system.js` | `validatePlugin`, `PluginManager` (SDK handle management) |
| `lib/plugin-loader.js` | File/module loading, hot reload, watcher |
| `lib/dynamic-loader.js` | Runtime tool/plugin lifecycle, path whitelist |
| `lib/observability.js` | `generateTraceId`, `MetricsStore`, `recordSapCall` |
| `Dockerfile` | Multi-stage container build |
| `.dockerignore` | Build exclusions |
| `.env.example` | Environment variable documentation |
| `mcp.json` | MCP client config template |

## 5. Test Coverage

| Layer | File |
|---|---|
| Contract | `tests/contract/mcp-client.test.js` — tools/list validates tool count |
| Manual | `test-plugin-system.js` — plugin registration smoke test |
| Manual | `test-trace.js` — trace context threading smoke test |
