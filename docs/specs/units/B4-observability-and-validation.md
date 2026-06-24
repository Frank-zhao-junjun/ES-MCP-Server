# Unit Spec B4 — 参数校验与可观测性

| 字段 | 值 |
|------|-----|
| **Unit ID** | B4 |
| **状态** | done |
| **关联 FR** | §6.1.3 `INVALID_PARAMETER`；NFR-11～14 |
| **关联 PRD** | `docs/MVP需求说明.md` v1.1.1 §9.3 E2/E8、§7.4 |

## 问题陈述

1. **E2/E8**：zod `max(1000)` 拦截超范围 `top`。**已注册于 mcp-server.js。**
2. **NFR-13**：工具调用 stderr `[ISO8601] <工具名>`。**已实现 `withToolLog`。**
3. **NFR-14**：`SAP_DEBUG=true` 输出 URL 与 status。**已实现于 sapGet。**
4. **NFR-11**：启动输出 version + 传输模式。**已实现。**

原 review **B4 文档项**（E2 仅 INVALID_PARAMETER）已在 v1.1.1 定稿；本 Unit 覆盖 **运行时行为**。

## 范围

**In scope**

- 确认 zod 校验对 MVP 8 工具生效（E2/E8）
- `mcp-server.js`：工具 handler 包装层记录调用日志
- `mcp-sap-core.js`：`SAP_DEBUG` 请求/响应日志
- 启动日志：stdio/HTTP 模式 + version

**Out of scope**

- 结构化日志聚合 / ELK
- HTTP API key 审计

## 接口契约

### stderr — 工具调用（NFR-13）

```
[2026-06-23T12:00:00.000Z] get_product
```

### stderr — SAP_DEBUG（NFR-14）

```
[SAP_DEBUG] GET https://.../A_Product?$top=1...
[SAP_DEBUG] status=200
```

### INVALID_PARAMETER（E2）

入参 `{ "top": 5000 }` → MCP SDK 校验失败，**不**调用 `sapGet`。

## 验收标准

| # | 条件 | Pass |
|---|------|------|
| B4-A1 | E2 `top: 5000` | 校验失败，无 SAP 请求 |
| B4-A2 | 任意工具调用 | stderr 含 ISO 时间戳 + 工具名 |
| B4-A3 | `SAP_DEBUG=true` + SAP 调用 | stderr 含 URL 与 status |
| B4-A4 | stdio 启动 | stderr 含 version、传输模式、Ready |

## 测试映射

- `docs/tests/MVP-TC-gap-B1-B4.md` → TC-B4-01～03
- `docs/tests/MVP-TC.md` → E2、E8、A5
- `MCP Server/test/tools-utils.test.js`

## 实现文件

- `MCP Server/mcp-server.js`
- `MCP Server/mcp-sap-core.js`
