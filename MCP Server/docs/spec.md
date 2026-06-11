# Feature Spec: MCP Server Phase 2 & 3

## 1. Problem

- Current pain: Phase 1 已完成安全加固，但代码仍存在架构耦合、配置硬编码、缓存永不过期、无分页、无 Schema 元数据等问题，影响扩展性和 Agent 体验。
- Who is affected: AI Agent 调用方、未来维护者、需要大数据量查询的场景。
- Why now: MVP 安全基线已打好，必须趁代码量不大时重构架构，否则技术债会阻碍新增业务场景（如采购订单追踪）。

## 2. Goal

- Primary goal: 将 MCP Server 从「单体硬编码」重构为「配置驱动 + 分层清晰 + 可观测」的健壮架构，并补充 Agent 急需的分页、Schema 能力。
- Non-goals: 不增加写操作（保持只读）；不替换 Basic Auth；不做多 SAP 系统支持。

## 3. Users and Scenarios

- User type(s): Claude Code / Cursor Agent 通过 MCP stdio 调用。
- Core scenario: Agent 需要追踪销售订单全链路、按场景灵活查询、分页遍历大数据集。
- Edge scenarios: SAP 服务偶发 502/504；场景文件被运维更新后 Agent 缓存未刷新；Agent 不知道 Entity 有哪些字段可过滤。

## 4. Requirements

- R1: 将 `TRACE_STEPS` 外置为 JSON 配置文件，新增追踪维度无需改代码。
- R2: 统一错误处理层级（SAP → Core → MCP），消除层级间结构混乱。
- R3: 为 `discoveryCache` 和 `_scenariosCache` 添加基于 mtime/TTL 的失效机制。
- R4: 启动时校验必要环境变量和文件路径，将 `SAP_HOST` 提取到环境变量。
- R5: 为 `query_sap_scenario` 添加 `$skip` 分页参数，并在返回中提示是否还有更多数据。
- R6: 新增 `get_entity_schema` Tool，解析 SAP `$metadata` 返回字段列表和类型。
- R7: 为 `sapFetch` 添加 502/503/504 的指数退避重试，以及简易断路器逻辑。
- R8: 每个请求生成 `request_id` 并贯穿所有 SAP 子查询，支持链路追踪。

## 5. Constraints

- Technical constraints: 保持 `@modelcontextprotocol/sdk@1.29.0` 兼容；保持 stdio transport 单会话模式。
- Time constraints: 预计 2-3 天。
- Scope constraints: 不改现有 Tool 的签名（除了新增可选参数），保持向后兼容。

## 6. Acceptance Criteria

- AC1: 新增一个追踪维度只需修改 JSON 配置文件，无需重启 MCP Server（或热加载）。
- AC2: 所有错误响应都遵循 `{ ok, error: { code, message, retryable, details } }` 结构。
- AC3: 场景文件被外部修改后，5 分钟内 `list_sap_scenarios` 返回最新内容。
- AC4: `query_sap_scenario` 带 `skip=20,top=20` 能正确返回第 21-40 条记录。
- AC5: `get_entity_schema` 返回字段名、类型、可空性、最大长度。
- AC6: 连续 3 次 SAP 502 后，第 4 次请求在 5 秒内快速失败并返回 `SAP_UNAVAILABLE` 错误。

## 7. Risks and Open Questions

- Risk 1 + mitigation: `$metadata` 解析复杂且体积大，可能超时。→ 只解析需要的 EntitySet，缓存解析结果。
- Risk 2 + mitigation: JSON 配置格式设计不当会导致后期频繁变更。→ 先用最小 schema（id, url, buildFilter 模板），稳定后再扩展。
- Open question(s): 断路器状态是否需要持久化？（当前阶段：内存态即可）

## 8. Out of Scope

- 暴露 MCP Resources / Prompts（阶段 4）。
- OAuth2SAML 替换 Basic Auth。
- 字段级数据脱敏（客户邮箱、电话等）。
- 多会话并发状态隔离（为 HTTP transport 做准备）。
