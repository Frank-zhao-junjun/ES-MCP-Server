# SAP S/4HANA MCP Server

MCP Server for AI Agents to read SAP S/4HANA Cloud OData APIs through business-oriented tools.

## Current MVP

- `authenticate`: authenticate the Agent with `MCP_API_KEY`.
- `get_sales_order_status`: get Sales Order header and items.
- `trace_sales_order`: trace Sales Order lifecycle across production, delivery, material document, and billing APIs.
- `list_sap_scenarios`: list configured SAP Communication Scenarios.
- `query_sap_scenario`: debug/admin generic query tool. Disabled unless `MCP_ENABLE_DEBUG_TOOLS=true`.

## New Enhancement Features

- `load_plugin`: dynamically load new tools from plugin files.
- `unload_plugin`: unload plugins and their tools at runtime.
- `list_loaded_plugins`: list all currently loaded plugins and their tools.

## Install

```powershell
cd "E:\00 - 中数通ES环境\ES 接口\MCP Server"
npm install
npm test
```

## Configuration

The server runs over MCP stdio:

```powershell
npm start
```

Required environment variables:

| Name | Required | Description |
| --- | --- | --- |
| `MCP_API_KEY` | Yes | Pre-shared MCP authentication key. If missing, a temporary key is printed to stderr. |
| `SAP_CREDENTIALS_FILE` | Yes | Path to the SAP communication user credential file. |
| `SAP_SCENARIO_DIR` | Yes | Directory containing `SAP_COM_xxxx` endpoint text files. |
| `SAP_BASE_URL` | No | SAP API base URL. Defaults to the current S/4HANA tenant URL. |
| `SAP_CLIENT` | No | SAP client. Defaults to `100`. |
| `SAP_REQUEST_TIMEOUT_MS` | No | SAP request timeout. Defaults to `30000`. |
| `MCP_ENABLE_DEBUG_TOOLS` | No | Set to `true` to enable `query_sap_scenario`. Defaults to disabled. |

Example `mcp.json`:

```json
{
  "mcpServers": {
    "sap-s4-mcp": {
      "command": "node",
      "args": ["mcp-server.js"],
      "cwd": "E:\\00 - 中数通ES环境\\ES 接口\\MCP Server",
      "env": {
        "MCP_API_KEY": "mcp-your-real-key",
        "SAP_CREDENTIALS_FILE": "E:\\00 - 中数通ES环境\\ES 接口\\user.txt",
        "SAP_SCENARIO_DIR": "E:\\00 - 中数通ES环境\\ES 接口",
        "SAP_BASE_URL": "https://your-tenant-api.s4hana.sapcloud.cn",
        "SAP_CLIENT": "100",
        "MCP_ENABLE_DEBUG_TOOLS": "false"
      }
    }
  }
}
```

## SAP Credential File

The current MVP supports the existing local credential text format and reads:

- `User Name:<value>`
- `User ID:<value>`
- `密码：<value>`
- `或者这个：<value>`

Production use should move credentials to a managed secret store or environment-injected secret file.

## Response Schema

Every tool returns JSON in MCP `content[0].text` with this stable shape:

```json
{
  "schemaVersion": "1.0",
  "tool": "get_sales_order_status",
  "ok": true,
  "data": {},
  "warnings": [],
  "error": null
}
```

Error responses keep the same top-level schema:

```json
{
  "schemaVersion": "1.0",
  "tool": "query_sap_scenario",
  "ok": false,
  "data": null,
  "warnings": [],
  "error": {
    "code": "DEBUG_TOOL_DISABLED",
    "message": "query_sap_scenario is disabled. Set MCP_ENABLE_DEBUG_TOOLS=true to enable debug/admin querying.",
    "retryable": false
  }
}
```

## Recommended Agent Flow

1. Call `authenticate` with `api_key`.
2. Use `get_sales_order_status` for direct Sales Order checks.
3. Use `trace_sales_order` only when downstream lifecycle data is needed.
4. Use `query_sap_scenario` only for debug/admin exploration and only when explicitly enabled.
5. Use `load_plugin` to dynamically add new tools at runtime (optional).

## Architecture

- `mcp-server.js`: MCP protocol adapter and tool registration.
- `runtime-context.js`: creates per-runtime auth and SAP contexts. This is the seam for future HTTP/SSE per-session state.
- `mcp-auth.js`: authentication context and API key validation.
- `mcp-sap-core.js`: SAP OData client, scenario parsing, OData helpers.
- `services/`: business use cases independent from MCP protocol.
- `lib/errors.js`: stable error codes and error normalization.
- `lib/mcp-response.js`: stable MCP JSON response envelope.
- `lib/plugin-system.js`: plugin interface definitions and validation.
- `lib/plugin-loader.js`: plugin loading and lifecycle management.
- `lib/dynamic-loader.js`: runtime plugin loading/unloading.
- `docs/`: documentation including parameter validation rules and business logic.
- `examples/`: plugin examples and development templates.
- `tests/run-tests.js`: local no-network MVP regression tests.

## Validation

```powershell
npm test
node --check mcp-server.js
```

`npm test` does not call SAP. It validates response schema, context isolation, scenario key generation, and business service URL generation with fake SAP clients.

## Plugin System

The server now supports a plugin system that allows:

- Dynamic loading of new tools at runtime
- Plugin-based architecture for extensibility
- Hot reloading of plugin code
- Runtime management of plugins

For more information about the plugin system, see:
- `docs/plugin-system-guide.md` - Complete guide to using the plugin system
- `examples/sample-plugin.js` - Example plugin implementation
- `docs/enhancements-overview.md` - Overview of all enhancements made