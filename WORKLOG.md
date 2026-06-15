# 工作日志 — SAP S/4HANA MCP Server

> 版本: v0.4.0 | 更新: 2026-06-15 22:29 CST

## v0.4 版本发布

### 基础设施增强

| 任务 | 状态 | 涉及文件 |
|---|---|---|
| MCP_API_KEYS 多键 + 每键角色绑定 | ✅ 完成 2026-06-15 | `MCP Server\mcp-auth.js`, `MCP Server\lib\roles.js` |
| SAP 响应 TTL 缓存 (`SAP_CACHE_TTL_MS`) | ✅ 完成 2026-06-15 | `MCP Server\lib\sap-cache.js` |
| 自动分页合并 (`@odata.nextLink` + `$skip`) | ✅ 完成 2026-06-15 | `MCP Server\lib\auto-pagination.js` |
| Prometheus /metrics + /healthz 端点 | ✅ 完成 2026-06-15 | `MCP Server\lib\metrics-server.js` |
| HTTP/SSE 传输支持 (`MCP_ENABLE_HTTP_TRANSPORT`) | ✅ 完成 2026-06-15 | `MCP Server\mcp-server.js` |

### 新增业务 API 工具 (v0.4)

| 工具 | US-API | SAP_COM | 服务文件 |
|---|---|---|---|
| `get_purchase_requisition` | US-API-004 | SAP_COM_0102 | `services/purchase-requisition.js` |
| `get_schedule_agreement` | US-API-005 | SAP_COM_0103 | `services/schedule-agreement.js` |
| `get_sales_contract` | US-API-011 | SAP_COM_0119 | `services/sales-contract.js` |
| `get_material_reservation` | US-API-024 | SAP_COM_0112 | `services/material-reservation.js` |

### 文档完善 (2026-06-15)

| 变更 | 涉及文件 |
|---|---|
| 修复 health_check 版本号 0.3.0→0.4.0 | `MCP Server\mcp-server.js` |
| 补充 4 个缺失工具到 README，工具计数 17→21 | `MCP Server\README.md` |
| PRD 版本 0.3.0→0.4.0，工具数 17→21 | `MCP Server\docs\PRD.md` |
| 标注 spec.md Phase 2&3 已完成 | `MCP Server\docs\spec.md` |
| 新增 US-018~US-021 User Stories (21 个) | `MCP Server\docs\user-stories.md` |
| 新增 v0.4 T10–T17 任务完成记录 | `MCP Server\docs\tasks.md` |
| 新增 v0.4 特性段 (多密钥/缓存/分页/指标/4工具) | `MCP Server\docs\enhancements-overview.md` |
| deployment-guide 版本 0.3.0→0.4.0 | `MCP Server\docs\deployment-guide.md` |
| 工具计数 17→21 | `MCP Server\WORKLOG.md` |

## v0.4 特性总结

### 安全
- 多密钥认证 (`MCP_API_KEYS`)：每密钥独立角色 + 失败锁定
- 向后兼容单键 `MCP_API_KEY`

### 性能
- SAP 响应 TTL 内存缓存（默认 5min）
- 自动分页合并，支持 `@odata.nextLink` 和 `$skip` 回退

### 可观测性
- Prometheus `/metrics` 端点：请求数、p50/p95 延迟、SAP 调用统计
- `/healthz` 健康检查端点
- 结构化 JSON 日志 (requestId/traceId/tool/duration)

### API 覆盖
- 21 个内置 MCP 工具（13 业务 + 1 调试 + 3 管理 + 4 v0.4 新增）
- 覆盖 17 个 SAP_COM 场景
- 29 个 US-API 模块中已实现高优先级 17 个

## 下一步 (v0.5)
- [ ] 全量 29 个 US-API 覆盖
- [ ] OAuth2 客户端凭据流
- [ ] HTTP/SSE MCP Streamable 正式支持
- [ ] 租户级隔离