# 工具参数验证规则

本文档详细说明 MCP Server 中每个工具的参数验证规则。

## 1. authenticate

### 参数验证规则

| 参数 | 类型 | 验证规则 | 错误码 |
|------|------|----------|---------|
| api_key | string | 长度 ≥ 1 | INVALID_INPUT |

### 业务逻辑
- 验证提供的 API 密钥是否与服务器配置的密钥匹配
- 成功后设置认证状态，允许访问其他工具

## 2. health_check

### 参数验证规则

| 参数 | 类型 | 默认值 | 验证规则 | 错误码 |
|------|------|--------|----------|---------|
| includeSapCheck | boolean | true | 无特殊验证 | - |
| includeScenarios | boolean | false | 无特殊验证 | - |

### 业务逻辑
- 检查服务器健康状态
- 验证配置文件可访问性
- 可选地测试 SAP 连接性和场景可用性

## 3. list_sap_scenarios

### 参数验证规则

| 参数 | 类型 | 验证规则 | 错误码 |
|------|------|----------|---------|
| (无参数) | - | - | - |

### 业务逻辑
- 列出所有可用的 SAP 通信场景
- 需要先通过 `authenticate` 工具认证

## 4. get_sales_order_status

### 参数验证规则

| 参数 | 类型 | 默认值 | 验证规则 | 错误码 |
|------|------|--------|----------|---------|
| salesOrder | string | - | 仅包含数字字符 | INVALID_INPUT |
| includeItems | boolean | true | 无特殊验证 | - |
| top | number | 20 | 1 ≤ value ≤ 50 | INVALID_INPUT |

### 业务逻辑
- 查询指定销售订单的头信息和项目信息
- 支持限制返回的项目数量
- 需要先通过 `authenticate` 工具认证

## 5. trace_sales_order

### 参数验证规则

| 参数 | 类型 | 默认值 | 验证规则 | 错误码 |
|------|------|--------|----------|---------|
| salesOrder | string | - | 仅包含数字字符 | INVALID_INPUT |
| includeDeliveries | boolean | true | 无特殊验证 | - |
| includeProductionOrders | boolean | true | 无特殊验证 | - |
| includeMaterialDocuments | boolean | true | 无特殊验证 | - |
| includeBillingDocuments | boolean | true | 无特殊验证 | - |
| top | number | 20 | 1 ≤ value ≤ 50 | INVALID_INPUT |

### 业务逻辑
- 跟踪销售订单在其生命周期中的各种相关单据
- 包括交货单、生产订单、物料凭证和开票凭证
- 需要先通过 `authenticate` 工具认证

## 6. query_sap_scenario

### 参数验证规则

| 参数 | 类型 | 验证规则 | 错误码 |
|------|------|----------|---------|
| key | string | - | SCENARIO_NOT_FOUND |
| filter | string (可选) | - | - |
| top | number (可选) | 1 ≤ value ≤ 100 | INVALID_INPUT |

### 业务逻辑
- 查询特定 SAP 通信场景的数据
- 支持 OData 过滤器和限制返回记录数
- 仅在启用调试工具时可用
- 需要先通过 `authenticate` 工具认证

## 7. get_cost_center

### 参数验证规则

| 参数 | 类型 | 默认值 | 验证规则 | 错误码 |
|------|------|--------|----------|---------|
| costCenter | string (可选) | - | 逗号分隔的字符串 | - |
| controllingArea | string (可选) | - | - | - |
| companyCode | string (可选) | - | - | - |
| includeText | boolean | true | 无特殊验证 | - |
| top | number | 20 | 1 ≤ value ≤ 100 | INVALID_INPUT |

### 业务逻辑
- 查询成本中心主数据
- 支持多种过滤条件
- 需要先通过 `authenticate` 工具认证

## 8. get_product

### 参数验证规则

| 参数 | 类型 | 默认值 | 验证规则 | 错误码 |
|------|------|--------|----------|---------|
| product | string (可选) | - | 逗号分隔的字符串 | - |
| productType | string (可选) | - | - | - |
| productGroup | string (可选) | - | - | - |
| includeDescription | boolean | true | 无特殊验证 | - |
| top | number | 20 | 1 ≤ value ≤ 100 | INVALID_INPUT |

### 业务逻辑
- 查询产品主数据
- 支持多种过滤条件和产品类型筛选
- 需要先通过 `authenticate` 工具认证

## 9. get_business_partner

### 参数验证规则

| 参数 | 类型 | 默认值 | 验证规则 | 错误码 |
|------|------|--------|----------|---------|
| businessPartner | string (可选) | - | 逗号分隔的字符串 | - |
| businessPartnerCategory | string (可选) | - | - | - |
| includeCustomer | boolean | false | 无特殊验证 | - |
| includeSupplier | boolean | false | 无特殊验证 | - |
| top | number | 20 | 1 ≤ value ≤ 100 | INVALID_INPUT |

### 业务逻辑
- 查询业务伙伴主数据
- 可选择包含客户或供应商关联数据
- 需要先通过 `authenticate` 工具认证

## 10. get_purchase_order

### 参数验证规则

| 参数 | 类型 | 默认值 | 验证规则 | 错误码 |
|------|------|--------|----------|---------|
| purchaseOrder | string (可选) | - | 逗号分隔的字符串 | - |
| supplier | string (可选) | - | - | - |
| companyCode | string (可选) | - | - | - |
| purchaseOrderType | string (可选) | - | - | - |
| includeItems | boolean | true | 无特殊验证 | - |
| top | number | 20 | 1 ≤ value ≤ 100 | INVALID_INPUT |

### 业务逻辑
- 查询采购订单头信息和项目信息
- 支持多种过滤条件
- 需要先通过 `authenticate` 工具认证

## 通用验证规则

### Zod 验证库使用
所有参数验证均使用 Zod 库进行运行时验证，确保类型安全和参数有效性。

### 错误处理
- 参数验证失败时返回 `INVALID_INPUT` 错误码
- 特定业务逻辑错误使用专用错误码
- 所有错误都包含详细的错误消息和可选的附加数据