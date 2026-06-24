# Unit Spec U-13 — HTTP 传输（Streamable HTTP）

| 字段 | 值 |
|------|-----|
| **Unit ID** | U-13 |
| **状态** | ready |
| **关联 US** | US-12 |
| **关联 FR** | FR-13 |
| **关联 PRD** | [v0.2需求说明.md](../../v0.2需求说明.md) §6.3 FR-13、§8.3、§8.5；NFR-19、NFR-21 |

## 问题陈述

Coze、curl 与远程 MCP Client 需要通过 HTTP 访问同一套 MCP 工具，而非本地 stdio 子进程。本 Unit 定义 Streamable HTTP 传输、服务发现端点、会话头与 stdio 互斥规则；HTTP Bearer 门禁细节与 `authenticate` 工具协同见 U-14。

## 范围

**In scope**

- 启动：`node mcp-server.js`（无 `--stdio`）且 `MCP_ENABLE_HTTP_TRANSPORT=true`
- `GET /` 服务信息 JSON
- `POST /mcp`（及 SDK 支持的 `GET /mcp`）Streamable HTTP MCP 协议
- 环境变量：`MCP_ENABLE_HTTP_TRANSPORT`、`MCP_PORT`、`MCP_BIND_ADDRESS`
- `--stdio` 强制 `enableHttp=false`，与 HTTP **二选一**
- `initialize` 响应头 `Mcp-Session-Id`；后续 MCP 请求携带该头
- 404 对未知路径

**Out of scope**

- TLS 终止（由反向代理负责）
- WebSocket 旧版 MCP 传输
- 多 worker / 水平扩展
- stdio 模式下的 HTTP 端点（必须不可用）

## 接口契约

### 启动与配置

| 变量 | 默认（代码） | v0.2 推荐 | 说明 |
|------|-------------|-----------|------|
| `MCP_ENABLE_HTTP_TRANSPORT` | `false` 若未设；`.env.example` 为 `true` | HTTP 部署 `true` | 启用 HTTP |
| `MCP_PORT` | `3000` | `3000` | 监听端口 |
| `MCP_BIND_ADDRESS` | `0.0.0.0` | 本地 `127.0.0.1`；容器 `0.0.0.0` | 绑定地址 |
| `--stdio` | — | Cursor 本地 | 强制关闭 HTTP |

### stderr 启动日志（NFR-11 扩展）

须包含：

```
[sap-s4-mcp] Version <semver>
[sap-s4-mcp] Transport: http
[sap-s4-mcp] MCP Server started via HTTP on http://<bind>:<port>
[sap-s4-mcp] MCP endpoint: http://<bind>:<port>/mcp
[sap-s4-mcp] API key gate: enabled|disabled
[sap-s4-mcp] Ready for Agent connections
```

### `GET /`

**请求：** `GET http://127.0.0.1:3000/`

**响应 200：**

```json
{
  "name": "sap-s4-mcp",
  "version": "<package.json version>",
  "tools": 20,
  "http": true
}
```

| 字段 | 说明 |
|------|------|
| `tools` | 当前注册工具总数（含 Phase 3）；v0.2 验收要求 `20` |
| `http` | 恒为 `true`（HTTP 模式下） |

### `POST /mcp` — initialize

**请求头：**

```
Content-Type: application/json
Accept: application/json, text/event-stream
```

（启用 API Key 时另需 `Authorization: Bearer <MCP_API_KEY>`，见 U-14 / E13）

**请求体示例：**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": { "name": "test", "version": "1.0" }
  }
}
```

**通过标准：** HTTP 200；响应头含 `Mcp-Session-Id`；body 含 MCP initialize 结果。

### `POST /mcp` — tools/list

**请求头：** 同上 + `Mcp-Session-Id: <session-id>`

**通过标准：** 列出工具名；v0.2 承诺的 **13** 个工具均出现（8 MVP + 5 Phase 2）。

### stdio 模式

```bash
node mcp-server.js --stdio
```

- stderr：`Transport: stdio`
- 不监听 TCP 端口
- MCP 仅通过 stdin/stdout

### 未知路径

`GET /unknown` → **404** `{ "error": "NOT_FOUND" }`

## 验收标准

| # | 条件 | Pass |
|---|------|------|
| U-13-A1 | `node mcp-server.js` + `.env` HTTP 启用 | stderr Ready，监听配置端口 |
| U-13-A2 | `curl http://127.0.0.1:3000/` | 200；`tools: 20`，`http: true` |
| U-13-A3 | initialize + tools/list | 会话成功；≥13 个 v0.2 工具名 |
| U-13-A4 | `node mcp-server.js --stdio` | `Transport: stdio`；无 HTTP 监听 |
| U-13-A5 | `MCP_ENABLE_HTTP_TRANSPORT=false` 且无 `--stdio` | 行为以当前代码为准（stdio 回退） |

## 测试映射

[V0.2-TC.md](../../tests/V0.2-TC.md) → **A6**、**A7**、**T14**、**T15**、**E13**、**E14**

## 实现

| 层级 | 路径 | 符号 |
|------|------|------|
| 入口 / HTTP 服务器 | `MCP Server/mcp-server.js` | `main`, `http.createServer`, `StreamableHTTPServerTransport` |
| 配置 | `MCP Server/mcp-sap-core.js` | `loadConfig` → `enableHttp`, `mcpPort`, `mcpBindAddress` |
| 模板 | `MCP Server/.env.example` | HTTP 相关变量 |

## 实现备注（与 PRD 差距）

| Gap | 说明 |
|-----|------|
| **G1** `MCP_BIND_ADDRESS` 代码默认 `0.0.0.0`，PRD 文档推荐本地 `127.0.0.1` — ✅ 已修复 — 默认改为 `127.0.0.1`，`.env.example` 同步更新 |
| **G2** 启动日志未显式打印 `MCP_REQUIRE_API_KEY` 状态（PRD §7.4 可观测性）— ✅ 已修复 |
| **G3** `tools: 20` 含 Phase 3；与 v0.2「承诺 13 工具」并存，Agent 文档须区分 |
