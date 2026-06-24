# Unit Spec B2 — 扩展 SAP 错误码映射

| 字段 | 值 |
|------|-----|
| **Unit ID** | B2 |
| **状态** | done |
| **关联 FR** | §6.1.3、§6.1.6 |
| **关联 PRD** | `docs/MVP需求说明.md` v1.1.1 §6.1.3 |

## 问题陈述

PRD 错误码表含 `SAP_BAD_REQUEST`(400)、`SAP_SERVICE_UNAVAILABLE`(502/503)、`NETWORK_ERROR`(网络层)。**已在** `formatSapError()` 与 `sapGet()` 实现。

## 范围

**In scope**

- `formatSapError(status, body)` 补全 400、502、503
- `sapGet()` 中 fetch 异常（非超时）返回 `NETWORK_ERROR`
- 全部 credential 组合失败且 `lastStatus === 0` 时返回 `NETWORK_ERROR`

**Out of scope**

- MCP 层 `INVALID_PARAMETER`（B4 / zod）
- 自定义 SAP 业务错误解析

## 接口契约

| HTTP / 场景 | error 码 |
|-------------|----------|
| 400 | `SAP_BAD_REQUEST` |
| 401 | `SAP_AUTH_FAILED` |
| 403 | `SAP_ARRANGEMENT_REQUIRED` |
| 404 | `SAP_NOT_FOUND` |
| 502, 503 | `SAP_SERVICE_UNAVAILABLE` |
| DNS/连接失败 | `NETWORK_ERROR` |
| 超时 | `SAP_TIMEOUT`（已有） |
| 其他 | `SAP_ERROR` |

400 时 `message` 保留 SAP 响应摘要（便于 `$filter` 调试，§6.1.6）。

## 验收标准

| # | 条件 | Pass |
|---|------|------|
| B2-A1 | mock status 400 | `error === 'SAP_BAD_REQUEST'` |
| B2-A2 | mock status 503 | `error === 'SAP_SERVICE_UNAVAILABLE'` |
| B2-A3 | mock 网络异常 | `error === 'NETWORK_ERROR'` |
| B2-A4 | 无效 `$filter` 经 SAP 返回 400 | 工具 JSON 含 `SAP_BAD_REQUEST` |

## 测试映射

- `docs/tests/MVP-TC-gap-B1-B4.md` → TC-B2-01～03
- `MCP Server/test/tools-utils.test.js`

## 实现文件

- `MCP Server/mcp-sap-core.js`
