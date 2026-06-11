# Spec: Cost Center 查询工具

## 概述
为 SAP Cost Center API 创建专用 MCP Tool `get_cost_center`，让 AI Agent 能查询成本中心主数据。

## API 信息
- **基础 URL**: `/sap/opu/odata4/sap/api_cost_center/srvd_a2x/sap/costcenter/0001/`
- **协议**: OData V4
- **实体**: `A_CostCenter_2` (80 字段), `A_CostCenterText_2` (6 字段，含多语言名称)

## REQ-CC-001: get_cost_center Tool

### 参数
| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `costCenter` | string | 否 | — | 成本中心编号，支持单个或逗号分隔多个 |
| `controllingArea` | string | 否 | — | 控制范围 |
| `companyCode` | string | 否 | — | 公司代码 |
| `includeText` | boolean | 否 | true | 是否包含多语言文本 |
| `top` | number | 否 | 20 | 最大返回记录数，max 100 |

### 行为
1. 至少需要一个查询条件（costCenter / controllingArea / companyCode）
2. 构建 OData $filter 组合条件
3. 查询 A_CostCenter_2
4. 若 includeText=true，对每条记录查询 A_CostCenterText_2
5. 将文本合并到主记录中

### 返回结构
```json
{
  "costCenters": [{ ...A_CostCenter_2 fields, "texts": [...] }],
  "count": N,
  "filter": "applied filter string"
}
```

### 错误处理
- 无查询条件 → INVALID_INPUT
- API 不可用 → QUERY_FAILED

## REQ-CC-002: 纯函数（可测试）
- `validateCostCenterInput(args)` — 输入校验
- `buildCostCenterFilter(args)` — 构建 OData filter 字符串

## REQ-CC-003: 测试覆盖
- 输入校验: 空参数、非法值
- Filter 构建: 单个/多个条件
- DI Mock 集成: 模拟 sapFetch 返回
- SAP Mock 集成: 端到端测试
