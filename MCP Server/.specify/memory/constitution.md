# Project Constitution — SAP S/4HANA MCP Server

## 1. 定位与使命

**定位**：面向 AI Agent 的 SAP S/4HANA Cloud 只读查询 MCP Server。

**使命**：让 AI Agent 在安全、可控、可审计的边界内获取 SAP 业务数据。

**非目标**：不提供 SAP 写入、审批、改单、下单能力。

## 2. 安全第一

### 2.1 凭据绝不落地
- SAP 密码只通过 `SAP_CREDENTIALS_FILE` 环境变量引用，不硬编码
- MCP API Key 通过 `MCP_API_KEY` 注入，生产环境 (`MCP_REQUIRE_API_KEY=true`) 拒绝自动生成

### 2.2 最小权限
- 角色模型：`readonly` → `debug` → `admin` 三级递进
- 普通 Agent 只能使用业务只读工具
- 插件管理、调试工具默认关闭

### 2.3 最小披露
- `health_check` 未认证只返回运行状态
- 错误信息不含内部路径、凭据提示

### 2.4 租户脱敏
- `SAP_BASE_URL` 必填，无默认值，占位符拒绝启动
- 代码中零硬编码租户标识

## 3. 架构原则

### 3.1 关注点分离
- `mcp-server.js` — MCP 协议适配 + 工具注册
- `mcp-sap-core.js` — SAP OData 客户端（协议无关）
- `services/` — 业务用例（独立于 MCP）
- `lib/` — 横切关注点（errors, roles, rate-limiter, observability）

### 3.2 上下文隔离
- 有状态模块通过 `create*Context()` 工厂创建
- `runtime-context.js` 是未来 per-session 状态的 seam

### 3.3 可扩展但受控
- 插件系统支持动态工具加载
- 插件来源目录受 `MCP_ENABLE_ADMIN_TOOLS` 门控

## 4. 稳定性原则

### 4.1 统一响应契约
```json
{ "schemaVersion": "1.0", "tool": "...", "ok": true|false, "data": {}, "warnings": [], "error": null }
```
- 所有工具返回此结构
- `schemaVersion` 保证向后兼容
- `error.code` 稳定，Agent 可据此决策

### 4.2 错误码稳定
- 错误码大写下划线，语义明确
- `retryable` 字段指导重试策略

### 4.3 限流保护
- SAP 调用并发上限 + 速率限制
- 断路器模式防止级联失败

## 5. 质量原则

### 5.1 三层测试
| 层 | 命令 | 覆盖 |
|---|---|---|
| Unit | `npm test` | 纯函数、响应 schema、上下文隔离 |
| Integration | `npm test` | Mock SAP server 全流程 |
| Contract | `npm run test:contract` | 真 MCP stdio 客户端 |

### 5.2 测试宪法
- 零外部测试依赖（只用 `assert` + Node 内置模块）
- 纯函数优先；I/O 通过 DI Mock
- 绝不连接真实 SAP 系统
- 全部 unit < 5s，全部 integration < 15s

## 6. 开发工作流

### 6.1 US-Spec-PRD 驱动
每个功能从三层文档开始：
1. **User Story** — 用户视角的需求描述
2. **Spec** — 技术规格和验收标准
3. **PRD** — 产品级背景和优先级

### 6.2 WORKLOG 纪律
每次工作完成后更新 `WORKLOG.md`，格式：
```
### YYYY-MM-DD — 工作标题
- **User Story**: US-XXX
- **变更**: 文件列表
- **验证**: 测试结果
```

### 6.3 发布前检查
- [ ] `npm test` 全绿
- [ ] `npm run test:contract` 全绿
- [ ] `node --check mcp-server.js` 通过
- [ ] `.gitignore` 覆盖所有敏感文件
- [ ] `git ls-files` 不含 `user.txt` / 业务数据
