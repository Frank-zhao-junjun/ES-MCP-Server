# Spec: 可观测性增强

## 概述
强化 MCP Server 的可观测能力：请求耗时统计、SAP 调用链路追踪、健康检查增强。

## REQ-OBS-001: 请求耗时统计

### MetricsStore（内存指标存储）
- `requestCount` — 总请求数
- `successCount` / `failureCount` — 成功/失败数
- `totalDurationMs` — 累计耗时（用于计算平均值）
- `sapCallCount` — SAP API 调用总数
- `sapTotalDurationMs` — SAP 调用累计耗时
- `sapErrors` — SAP 调用错误数
- `toolDurations` — 按 tool 分组的耗时数组（用于计算 p50/p95）

### 指标暴露
- `getMetrics()` → 返回结构化指标
- `reset()` → 重置（测试用）
- 通过 `health_check` 工具暴露

## REQ-OBS-002: SAP 调用链路追踪

### Trace ID 传播
- 每个 tool 调用生成 `trace_id`（uuid v4 风格）
- `sapDependencies` 将 `trace_id` 注入到 `sapFetch` 包装中
- 每次 SAP HTTP 调用记录：`{ trace_id, url, duration_ms, status, error }`

### 调用链日志
- 工具级别：`[trace_id] tool=xxx duration=123ms`
- SAP 级别：`[trace_id] sap_call=/path/to/api duration=45ms status=200`
- 多步工具（trace_sales_order）可看到完整的 6 次 SAP 调用链

## REQ-OBS-003: 健康检查增强

### 新增检查项
- `sapConnectivity` — 实际调用 SAP API 验证连通性（GET /sap/opu/odata/sap/ 返回 200）
- `authStatus` — 当前认证状态
- `uptime` — 服务器运行时长（秒）
- `metrics` — 请求统计摘要
- `scenarioHealth` — 按场景的快速可达性检查（可选，通过参数启用）

### 参数
- `includeScenarios` — 是否包含按场景检查（默认 false）
- `includeSapCheck` — 是否包含 SAP 连通性测试（默认 true）
