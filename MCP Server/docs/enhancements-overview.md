# MCP Server 增强功能概览

本文档介绍了对原始 MCP Server 的主要改进和增强功能。

## 1. 文档完善

### 1.1 工具参数验证规则
- 详细记录了每个工具的所有参数及其验证规则
- 明确标注参数类型、约束条件和错误码
- 便于开发者理解和使用工具

**相关文件：** `docs/parameter-validation-rules.md`

### 1.2 业务逻辑说明
- 详细解释了各业务服务的内部逻辑流程
- 使用流程图直观展示关键业务流程
- 帮助理解系统架构和数据流向

**相关文件：** `docs/business-logic.md`

## 2. 扩展性增强

### 2.1 插件化架构
实现了完整的插件系统，支持：

- **插件定义接口**：标准化的插件结构定义
- **工具注册**：动态注册新工具的能力
- **生命周期管理**：插件的初始化和清理

**相关文件：**
- `lib/plugin-system.js` - 插件接口和验证
- `lib/plugin-loader.js` - 插件加载和管理
- `lib/dynamic-loader.js` - 运行时动态加载

### 2.2 动态工具管理
- **运行时加载**：无需重启服务器即可加载新工具
- **动态卸载**：可移除不再需要的工具
- **热重载支持**：开发期间自动重载修改的插件

### 2.3 内置插件管理工具
服务器现在提供内置工具来管理插件：

- `load_plugin` - 从文件加载插件
- `unload_plugin` - 卸载指定插件
- `list_loaded_plugins` - 列出所有已加载插件

## 3. 实施细节

### 3.1 架构集成
插件系统无缝集成到主服务器中：
- 服务器启动时自动加载预定义目录中的插件
- 与现有工具注册机制兼容
- 不影响原有功能

### 3.2 示例和文档
- 提供完整的示例插件 (`examples/sample-plugin.js`)
- 详细的插件开发指南 (`docs/plugin-system-guide.md`)
- 最佳实践和故障排除建议

## 4. 测试和验证

所有增强功能均已通过：
- 单元测试验证
- 集成测试验证
- 与原始功能的兼容性测试
- 性能基准测试

## 5. 向后兼容性

所有增强功能都保持了完全的向后兼容性：
- 现有工具继续正常工作
- 现有的 API 调用方式不变
- 现有的配置选项仍然有效

## 6. v0.4 新增特性 (2026-06)

### 6.1 多密钥认证 + 角色绑定
- `MCP_API_KEYS` JSON 多密钥支持，每个密钥独立角色
- 每密钥独立失败计数器与锁定
- 向后兼容单密钥 `MCP_API_KEY` 模式

**相关文件：** `mcp-auth.js`, `lib/roles.js`

### 6.2 SAP 响应缓存
- TTL 内存缓存 (`SAP_CACHE_TTL_MS`, 默认 5 分钟)
- URL 规范化去重
- 401/403 自动清空缓存
- 缓存命中率统计

**相关文件：** `lib/sap-cache.js`

### 6.3 自动分页合并
- `@odata.nextLink` 自动追踪
- `$skip` 回退分页
- 可配置最大总条数 (`MCP_AUTO_PAGE_MAX`)
- 可通过 `MCP_ENABLE_AUTO_PAGE` 开关

**相关文件：** `lib/auto-pagination.js`

### 6.4 Prometheus 指标端点
- `/metrics` 端点 (Prometheus text 格式)
- `/healthz` 健康检查端点
- 请求数、成功率、p50/p95 延迟、SAP 调用统计
- 可选端口 (`MCP_METRICS_PORT`)

**相关文件：** `lib/metrics-server.js`

### 6.5 新增业务 API 工具
- `get_purchase_requisition` — 采购申请查询 (US-API-004)
- `get_schedule_agreement` — 采购框架协议查询 (US-API-005)
- `get_sales_contract` — 销售合同查询 (US-API-011)
- `get_material_reservation` — 库存预留查询 (US-API-024)

**相关文件：** `services/purchase-requisition.js`, `services/schedule-agreement.js`, `services/sales-contract.js`, `services/material-reservation.js`

## 7. 未来扩展

此增强为基础，支持：
- 第三方插件生态系统
- 动态功能扩展
- 更灵活的部署配置
- 热更新和A/B测试能力