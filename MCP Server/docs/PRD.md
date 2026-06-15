# PRD — SAP S/4HANA MCP Server

> 版本: 0.3 | 更新: 2026-06-15 | 状态: MVP 完成 → 生产加固

## 1. 产品概述

### 1.1 一句话

为 AI Agent 提供安全、只读的 SAP S/4HANA Cloud OData 查询能力的 MCP Server。

### 1.2 解决什么问题

企业 AI Agent 需要访问 SAP 业务数据（销售订单、采购订单、库存、BOM 等），但：
- SAP API 认证复杂（Basic Auth + CSRF + client）
- OData 语义对 LLM 不友好
- 直接暴露 SAP 凭据和端点有安全风险
- 缺少限流和审计能力

本 MCP Server 在 Agent 与 SAP 之间建立**安全闸门**。

### 1.3 目标用户

| 角色 | 描述 | 使用模式 |
|---|---|---|
| 业务 Agent | 查询销售订单、采购订单、库存等 | `authenticate` → 业务工具 → 返回给用户 |
| 运维 Agent | 巡检 SAP 连通性、场景状态 | `health_check` → `list_sap_scenarios` |
| 管理 Agent | 加载/卸载插件、调试查询 | `load_plugin` → `query_sap_scenario` |

## 2. 核心能力

### 2.1 已实现 (v0.3)

| 能力 | 工具 | 覆盖场景 |
|---|---|---|
| 认证 | `authenticate` | API Key 校验 + 失败锁定 |
| 健康检查 | `health_check` | 配置/连通性/指标，未认证最小披露 |
| 销售订单 | `get_sales_order_status` + `trace_sales_order` | 订单头/行项目 + 交货/生产/物料凭证/开票全链路 |
| 采购订单 | `get_purchase_order` | 按 PO号/供应商/公司代码查询 |
| 产品主数据 | `get_product` | 物料号/产品类型/产品组 |
| 业务伙伴 | `get_business_partner` | BP + Customer/Supplier 关联 |
| 物料库存 | `get_material_stock` | 物料/工厂/批次 |
| BOM | `get_bom` | 物料/工厂/BOM用途/组件 |
| 供应商发票 | `get_supplier_invoice` | 发票号/财年/公司代码 |
| 成本中心 | `get_cost_center` | 成本中心/控制范围 |
| 实体 Schema | `get_entity_schema` | OData $metadata 解析 |
| 场景管理 | `list_sap_scenarios` + `query_sap_scenario` | 30+ SAP_COM 场景 |
| 插件管理 | `load_plugin`/`unload_plugin`/`list_loaded_plugins` | Admin-only |

### 2.2 安全基础设施

| 能力 | 实现 |
|---|---|
| 认证 | PSK (`MCP_API_KEY`) + 失败锁定 (5次/30s) |
| 角色 | `MCP_ROLE`: readonly / debug / admin |
| 限流 | 并发上限 5 + 每分钟 60 次 + 断路器 |
| 脱敏 | SAP_BASE_URL 必填，无默认值 |
| 审计 | 结构化 JSON 日志 (requestId/traceId/tool/duration) |

## 3. 非目标 (v0.x)

- SAP 写入/审批/改单 ❌
- 多租户支持 ❌
- Web UI 仪表盘 ❌
- OAuth2/SAML 认证 ❌
- 缓存层 ❌

## 4. 架构决策记录

| ADR | 决策 | 原因 |
|---|---|---|
| 1 | MCP stdio 传输 | 最低延迟，Agent 侧零配置 |
| 2 | Zod 参数校验 | MCP SDK 原生支持 |
| 3 | 纯 Node.js (无 TS) | 降低构建复杂度 |
| 4 | express 仅保留 (未用于 MCP) | 根 server.js 是历史遗留 Web UI |
| 5 | 插件系统 | 允许无重启扩展工具 |

## 5. 路线图

### v0.4 (下一个)
- [ ] `MCP_API_KEY` 多键支持（多 Agent 不同角色）
- [ ] SAP 响应缓存（TTL 可配置）
- [ ] 分页自动合并
- [ ] Prometheus metrics 端点

### v1.0
- [ ] HTTP/SSE 传输 (MCP Streamable)
- [ ] OAuth2 客户端凭据流
- [ ] 租户级隔离
- [ ] 生产部署 guide
