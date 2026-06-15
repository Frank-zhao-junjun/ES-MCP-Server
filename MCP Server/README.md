# SAP S/4HANA MCP Server

MCP Server for AI Agents to read SAP S/4HANA Cloud OData APIs through business-oriented, read-only tools.

## Documentation

### 核心文档

| 文档 | 描述 | 面向 |
|---|---|---|
| [PRD.md](./docs/PRD.md) | 产品需求文档 | 所有人 |
| [user-stories.md](./docs/user-stories.md) | 10 个 User Story + 验收标准 | 产品/开发 |
| [constitution.md](./.specify/memory/constitution.md) | 项目宪法 | 开发 |
| [WORKLOG.md](./WORKLOG.md) | 工作日志 | 所有人 |
| [AGENT_USAGE.md](./AGENT_USAGE.md) | Agent 调用规则与安全边界 | AI Agent |

### 详细文档

| 文档 | 描述 | 面向 |
|---|---|---|
| [Specs](./.specify/specs/) | 4 个技术规格 (Core/Business/Master/Plugin) | 开发 |
| [tasks.md](./docs/tasks.md) | 任务计划与完成追踪 | 开发 |
| [parameter-validation-rules.md](./docs/parameter-validation-rules.md) | 每个工具的参数校验规则 | 开发 |
| [business-logic.md](./docs/business-logic.md) | SAP 业务逻辑 mermaid 流程图 | 开发 |
| [plugin-system-guide.md](./docs/plugin-system-guide.md) | 插件系统完整使用指南 | 开发 |
| [enhancements-overview.md](./docs/enhancements-overview.md) | 全部增强功能概览 | 开发 |
| [spec.md](./docs/spec.md) | Phase 2 & 3 技术规格 | 开发 |

## Current Tools

Business tools:

- `authenticate`: authenticate the Agent with `MCP_API_KEY`.
- `health_check`: check server configuration, auth status, SAP reachability, scenario files, and runtime metrics.
- `get_sales_order_status`: get Sales Order header and items.
- `trace_sales_order`: trace Sales Order lifecycle across production, delivery, material document, and billing APIs.
- `get_business_partner`: query SAP Business Partner master data.
- `get_product`: query SAP Product master data.
- `get_purchase_order`: query SAP Purchase Order header and items.
- `get_material_stock`: query SAP Material Stock data.
- `get_bom`: query SAP Bill of Materials data.
- `get_supplier_invoice`: query SAP Supplier Invoice data.
- `get_cost_center`: query SAP Cost Center master data.
- `get_entity_schema`: inspect SAP OData entity fields from service metadata.
- `list_sap_scenarios`: list configured SAP Communication Scenarios.

Admin/debug tools:

- `query_sap_scenario`: generic SAP scenario query tool. Disabled unless `MCP_ENABLE_DEBUG_TOOLS=true`.
- `load_plugin`: dynamically load new tools from plugin files. Disabled unless `MCP_ENABLE_ADMIN_TOOLS=true`.
- `unload_plugin`: unload plugins and their tools at runtime. Disabled unless `MCP_ENABLE_ADMIN_TOOLS=true`.
- `list_loaded_plugins`: list all currently loaded plugins and their tools. Disabled unless `MCP_ENABLE_ADMIN_TOOLS=true`.

## Install

```powershell
cd "E:\00 - 中数通ES环境\ES 接口\MCP Server"
npm install
npm test
```

## Run

The server runs over MCP stdio:

```powershell
npm start
```

## Configuration

Required environment variables:

| Name | Required | Description |
| --- | --- | --- |
| `MCP_API_KEY` | Yes in production | Pre-shared MCP authentication key. In production it must be explicitly configured. In local development, a temporary key may be generated when missing. |
| `MCP_REQUIRE_API_KEY` | No | Set to `true` to reject startup when `MCP_API_KEY` is missing. This is always enforced when `NODE_ENV=production`. |
| `SAP_CREDENTIALS_FILE` | Yes | Path to the SAP communication user credential file. |
| `SAP_SCENARIO_DIR` | Yes | Directory containing `SAP_COM_xxxx` endpoint text files. |
| `SAP_BASE_URL` | No | SAP API base URL. Defaults to the current S/4HANA tenant URL. |
| `SAP_CLIENT` | No | SAP client. Defaults to `100`. |
| `SAP_REQUEST_TIMEOUT_MS` | No | SAP request timeout. Defaults to `30000`. |
| `MCP_ENABLE_DEBUG_TOOLS` | No | Set to `true` to enable `query_sap_scenario`. Defaults to disabled. |
| `MCP_ENABLE_ADMIN_TOOLS` | No | Set to `true` to enable plugin management tools: `load_plugin`, `unload_plugin`, `list_loaded_plugins`. Defaults to disabled. |

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
        "MCP_REQUIRE_API_KEY": "true",
        "MCP_ENABLE_DEBUG_TOOLS": "false",
        "MCP_ENABLE_ADMIN_TOOLS": "false"
      }
    }
  }
}
```

The checked-in `mcp.json` is a local template. Replace `MCP_API_KEY` and `SAP_BASE_URL` before using it with a real MCP client. Production deployments should set `MCP_REQUIRE_API_KEY=true` or `NODE_ENV=production`.

## SAP Credential File

The current MVP supports the existing local credential text format and reads:

- `User Name:<value>`
- `User ID:<value>`
- `密码:<value>` or `密码：<value>`
- `或者这个:<value>` or `或者这个：<value>`

Production use should move credentials to a managed secret store or an environment-injected secret file.

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
2. Call `health_check` if the Agent needs to verify configuration or SAP connectivity.
3. Use business tools such as `get_sales_order_status`, `get_purchase_order`, `get_product`, or `get_material_stock` for normal read-only queries.
4. Use `trace_sales_order` only when downstream lifecycle data is needed.
5. Use `get_entity_schema` before building complex filters against unfamiliar OData entities.
6. Use `query_sap_scenario` only for debug/admin exploration and only when explicitly enabled.
7. Treat `load_plugin`, `unload_plugin`, and `list_loaded_plugins` as admin-only operations. They are blocked unless `MCP_ENABLE_ADMIN_TOOLS=true`.

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
node -e "JSON.parse(require('fs').readFileSync('mcp.json','utf8')); console.log('mcp.json ok')"
```

`npm test` does not call SAP. It validates response schema, context isolation, scenario key generation, and business service URL generation with fake SAP clients.

## Plugin System

The server supports a plugin system for controlled extension:

- Dynamic loading of new tools at runtime.
- Plugin-based architecture for extensibility.
- Hot reloading of plugin code.
- Runtime management of plugins.

Plugin tools are admin-only capabilities when this MCP Server is exposed to other Agents. Runtime plugin management is blocked unless `MCP_ENABLE_ADMIN_TOOLS=true`.

For more information about the plugin system, see:

- `docs/plugin-system-guide.md`: complete guide to using the plugin system.
- `examples/sample-plugin.js`: example plugin implementation.
- `docs/enhancements-overview.md`: overview of all enhancements made.
