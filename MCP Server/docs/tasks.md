# Task Plan: MCP Server Phase 2 & 3

## Mapping

- R1 (配置化追踪) -> T1, T2
- R2 (统一错误) -> T3
- R3 (缓存失效) -> T4
- R4 (启动校验) -> T5
- R5 (分页) -> T6
- R6 (Schema 元数据) -> T7
- R7 (重试+断路器) -> T8
- R8 (链路追踪 request_id) -> T9

## Tasks

- [x] T1: 设计 `trace-config.json` schema 并把 `TRACE_STEPS` 从 `sales-order-trace.js` 迁移进去
  - Purpose: 实现追踪维度可配置化，满足 R1
  - Files to touch: `services/sales-order-trace.js`, 新建 `config/trace-config.json`, `mcp-sap-core.js`（新增加载器）
  - Verification: 单元测试验证 JSON 加载后 `traceSalesOrder` 行为与硬编码一致
  - Risk: JSON 中 `buildFilter` 是函数，无法序列化。→ 用模板字符串 `${salesOrder}` 替代，运行时替换

- [x] T2: 在 `sales-order-trace.js` 中实现「模板替换 + JSON 配置驱动」的 `buildUrl`
  - Purpose: 让 `traceSalesOrder` 读取 JSON 配置而非硬编码数组
  - Files to touch: `services/sales-order-trace.js`
  - Verification: 测试传入不同 `salesOrder` 时，生成的 URL 与旧版一致
  - Risk: 模板注入（虽然 `salesOrder` 已校验为纯数字，仍需防御性编码）

- [x] T3: 统一错误处理层级，消除 `mcp-server.js` 中的重复 `normalizeError` / `makeError` 混用
  - Purpose: 让 Service → Core → MCP 每层错误结构一致，满足 R2
  - Files to touch: `lib/errors.js`, `mcp-sap-core.js`, `services/*.js`, `mcp-server.js`
  - Verification: 所有测试通过；手工构造 SAP 401/500 错误，观察最终返回结构符合 `{ ok, error: { code, message, retryable } }`
  - Risk: 改动面广，容易漏改某处 `throw`

- [x] T4: 为 `discoveryCache` 和 `_scenariosCache` 添加 mtime/TTL 失效
  - Purpose: 场景文件或 SAP $metadata 变更后自动刷新，满足 R3
  - Files to touch: `mcp-sap-core.js`
  - Verification: 修改某个 `SAP_COM_*.txt` 文件后，再次调用 `list_sap_scenarios` 能在 5 分钟内反映新内容
  - Risk: 频繁 `fs.statSync` 影响性能。→ 每次请求只检查一次，或设置 60s 最小检查间隔

- [x] T5: 启动时校验环境变量和文件路径，提取 `SAP_HOST` 到环境变量
  - Purpose: 提前发现配置错误，满足 R4
  - Files to touch: `mcp-server.js`（`main()` 开头），`.env.example`（如有）
  - Verification: 删除 `user.txt` 后启动，进程在 3 秒内退出并打印清晰错误
  - Risk: 现有 CI/部署脚本可能未设置 `SAP_HOST`。→ 保持默认值，仅 warn 不退出

- [x] T6: 为 `query_sap_scenario` 添加 `skip` 参数，并在返回中提示「是否还有更多」
  - Purpose: 支持分页遍历，满足 R5
  - Files to touch: `mcp-server.js`（Tool 定义 + handler），`mcp-sap-core.js`（`buildQueryPath`）
  - Verification: 调用 `query_sap_scenario` 带 `skip=2,top=2`，返回第 3-4 条；最后一页提示 `hasMore: false`
  - Risk: SAP OData V2/V4 对 `$skip` 的支持细节不同。→ 在 `mcp-sap-core.js` 中按版本适配

- [x] T7: 新增 `get_entity_schema` Tool，解析 SAP `$metadata`
  - Purpose: 让 Agent 知道可用字段，满足 R6
  - Files to touch: 新建 `services/entity-schema.js`，`mcp-server.js`（注册 tool）
  - Verification: 调用 `get_entity_schema` 返回 `A_SalesOrder` 的字段列表，包含类型和可空性
  - Risk: `$metadata` XML 体积大（数 MB），解析慢。→ 只拉取一次并缓存；按需解析指定 EntitySet

- [x] T8: 为 `sapFetch` 添加指数退避重试和简易断路器
  - Purpose: 提升 SAP 网络抖动时的鲁棒性，满足 R7
  - Files to touch: `mcp-sap-core.js`
  - Verification: Mock `fetch` 连续返回 502，观察第 3 次后快速失败；成功一次后断路器重置
  - Risk: 重试可能触发 SAP 限流。→ 最多 2 次重试，基础延迟 1s，指数增长

- [x] T9: 将 `wrapTool` 的 `requestId` 注入到 SAP 子查询的 `X-Request-ID` header
  - Purpose: 端到端链路追踪，满足 R8
  - Files to touch: `mcp-server.js`（`wrapTool`），`mcp-sap-core.js`（`sapFetch` 接收可选 headers）
  - Verification: 调用 `trace_sales_order`，查看 SAP 请求头包含与 MCP 日志相同的 `requestId`
  - Risk: SAP 网关可能忽略未知 header。→ 不影响业务，仅为观测

## Done Log

- Date: 2026-06-11
- Completed task IDs:
  - T1-T2: Externalize TRACE_STEPS to JSON config with hot-reload (commit `446938f`)
  - T3: Normalize error handling with HTTP status mapping (commit `456ee98`)
  - T4: Cache invalidation for discovery and scenario caches (commit `d9f3770`)
  - T5: Startup config validation (commit `5983202`)
  - T6: Skip pagination for query_sap_scenario (commit `164ba46`)
  - T7: get_entity_schema Tool with XML parser (commit `513e51d`)
  - T8: Exponential backoff retry and circuit breaker (commit `55a0522`)
  - T9: Propagate request traceId to SAP X-Request-ID header (commit `bfa341d`)
- Checks run: `node tests/run-tests.js` ✅, `npm run test:contract` ✅ 40/40
- Remaining risks: — (全部完成，无剩余风险)

---

## v0.4 Feature Tasks (2026-06)

### Mapping

- FR-001 (MCP_API_KEYS 多键) → T10
- FR-002 (SAP 响应缓存) → T11
- FR-003 (自动分页) → T12
- FR-004 (Prometheus 指标) → T13
- FR-005 (采购申请) → T14
- FR-006 (采购框架协议) → T15
- FR-007 (销售合同) → T16
- FR-008 (库存预留) → T17

### Tasks

- [x] T10: 实现 `MCP_API_KEYS` 多键认证 + 每键角色绑定
  - Files: `mcp-auth.js` (`_parseMultiKeys()`), `lib/roles.js`
  - Verification: 多键 JSON 解析正确；无效 JSON 回退单键模式

- [x] T11: 实现 SAP 响应 TTL 缓存
  - Files: `lib/sap-cache.js`
  - Verification: 缓存命中返回存储响应；TTL 过期重新获取；401/403 清空缓存

- [x] T12: 实现自动分页合并
  - Files: `lib/auto-pagination.js`
  - Verification: `@odata.nextLink` 自动追踪；`$skip` 回退；`MCP_ENABLE_AUTO_PAGE` 开关

- [x] T13: 实现 Prometheus 指标端点
  - Files: `lib/metrics-server.js`
  - Verification: `/metrics` 返回 Prometheus 格式；`/healthz` 返回 200

- [x] T14: 新增 `get_purchase_requisition` 工具 (US-API-004)
  - Files: `services/purchase-requisition.js`, `mcp-server.js`
  - Verification: 按 PR 号/采购组织/供应商查询返回正确数据

- [x] T15: 新增 `get_schedule_agreement` 工具 (US-API-005)
  - Files: `services/schedule-agreement.js`, `mcp-server.js`
  - Verification: 按协议号/供应商查询返回交货计划

- [x] T16: 新增 `get_sales_contract` 工具 (US-API-011)
  - Files: `services/sales-contract.js`, `mcp-server.js`
  - Verification: 按合同号/客户查询返回合同行项目

- [x] T17: 新增 `get_material_reservation` 工具 (US-API-024)
  - Files: `services/material-reservation.js`, `mcp-server.js`
  - Verification: 按预留号/物料/工厂查询返回预留数据

### Done Log (v0.4)

- Date: 2026-06-15
- Completed task IDs: T10–T17
- Checks run: `npm test` ✅
- Remaining risks: — (全部完成，无剩余风险)
