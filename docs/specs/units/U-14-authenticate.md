# Unit Spec U-14 — `authenticate` 与 HTTP API Key 门禁

| 字段 | 值 |
|------|-----|
| **Unit ID** | U-14 |
| **状态** | ready |
| **关联 US** | US-12 |
| **关联 FR** | FR-14；§6.1.3 `MISSING_API_KEY` / `INVALID_API_KEY` / HTTP `UNAUTHORIZED` |
| **关联 PRD** | [v0.2需求说明.md](../../v0.2需求说明.md) §6.3 FR-14；NFR-18、NFR-20、NFR-21 |

## 问题陈述

远程 MCP Client（如 Coze）在调用业务工具前需验证配置的 API Key；公网 HTTP 部署需可选 Bearer 门禁，在 MCP 协议层之前拒绝未授权请求。`authenticate` 工具提供显式预检；HTTP 中间件对 **所有** HTTP 路由（含 `GET /` 与 `/mcp`）统一校验。

## 范围

**In scope**

- 工具 `authenticate({ apiKey })` 与 `MCP_API_KEY` 环境变量比对
- `MCP_REQUIRE_API_KEY=true` 时 HTTP 层 Bearer 校验（U-13 传输）
- 错误码：`MISSING_API_KEY`、`INVALID_API_KEY`（工具层）；`UNAUTHORIZED`（HTTP 401 JSON）
- stdio 模式默认 **不** 强制 API Key（`MCP_REQUIRE_API_KEY=false`）

**Out of scope**

- OAuth / SSO
- API Key 轮换、吊销列表
- per-tool 粒度鉴权（全 HTTP 或无）
- SAP Basic Auth（仍由 `user.txt` 负责）

## 接口契约

### 环境变量

| 变量 | 说明 |
|------|------|
| `MCP_API_KEY` | 期望值；默认占位 `change-me`（生产须替换，NFR-18） |
| `MCP_REQUIRE_API_KEY` | `true` 启用 HTTP Bearer 门禁 |

### 工具入参

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `apiKey` | string | ✅ | Client 持有的 MCP API Key |

### 工具成功出参

```json
{ "success": true, "message": "API key valid" }
```

### 工具错误出参

缺参：

```json
{ "error": "MISSING_API_KEY", "message": "apiKey is required" }
```

不匹配：

```json
{ "error": "INVALID_API_KEY", "message": "Provided API key is invalid" }
```

### HTTP Bearer 门禁（`MCP_REQUIRE_API_KEY=true`）

**请求头：**

```
Authorization: Bearer <MCP_API_KEY>
```

**无 Bearer 或 token 不匹配 — 401：**

```json
{ "error": "UNAUTHORIZED", "message": "Invalid or missing API key" }
```

- 在 `transport.handleRequest` **之前**拦截
- 适用于 `GET /` 与 `/mcp` 全部方法
- 响应为 HTTP JSON，**非** MCP `tools/call` 包装

### stdio 行为

- `authenticate` 工具仍可用（显式传 key 验证）
- 无 HTTP Bearer 要求（NFR-21）

## 验收标准

| # | 条件 | Pass |
|---|------|------|
| U-14-A1 | `{ "apiKey": "<MCP_API_KEY>" }` | `success === true` |
| U-14-A2 | `{ "apiKey": "wrong" }` | `INVALID_API_KEY` |
| U-14-A3 | `{}` | `MISSING_API_KEY` |
| U-14-A4 | HTTP + `MCP_REQUIRE_API_KEY=true`，curl 无 Bearer | HTTP **401**，body 含 `UNAUTHORIZED` |
| U-14-A5 | HTTP + 错误 Bearer | HTTP **401** |
| U-14-A6 | HTTP + 正确 Bearer + initialize | MCP 会话成功 |
| U-14-A7 | stdio + `MCP_REQUIRE_API_KEY=true` | 工具调用不受 Bearer 限制（无 HTTP） |

## 测试映射

[V0.2-TC.md](../../tests/V0.2-TC.md) → **T13**、**E12**、**E13**、**E14**

## 实现

| 层级 | 路径 | 符号 |
|------|------|------|
| Handler | `MCP Server/lib/tools.js` | `authenticate` |
| HTTP 门禁 | `MCP Server/mcp-server.js` | `http.createServer` 内 `config.requireApiKey` 分支 |
| 配置 | `MCP Server/mcp-sap-core.js` | `apiKey`, `requireApiKey` |
| 模板 | `MCP Server/.env.example` | `MCP_API_KEY`, `MCP_REQUIRE_API_KEY` |

## 实现备注

- HTTP 401 与工具层 `INVALID_API_KEY` 为 **两层**错误：E13/E14 验 HTTP；E12 验工具。
- 生产部署须 `MCP_REQUIRE_API_KEY=true` 且 `MCP_API_KEY` ≠ `change-me`（NFR-18）；验收环境可用 dev 配置。
- `authenticate` 不写入日志中的完整 key（避免泄露）。
