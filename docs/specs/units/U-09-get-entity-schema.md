# Unit Spec U-09 — `get_entity_schema`

| 字段 | 值 |
|------|-----|
| **Unit ID** | U-09 |
| **状态** | ready |
| **关联 US** | US-11 |
| **关联 FR** | FR-09；§6.1.3 `MISSING_PARAMS` / `SAP_NOT_FOUND` |
| **关联 PRD** | [v0.2需求说明.md](../../v0.2需求说明.md) §6.3 FR-09；NFR-16 |

## 问题陈述

Agent 构造 OData `$filter` 或理解返回字段前，需要知道某 SAP 服务实体的属性列表。本工具拉取 `$metadata` 并解析指定 `EntityType`，返回结构化字段清单，避免 Agent 硬猜字段名。

## 范围

**In scope**

- 入参 `service` + `entity`，调用对应 OData 服务 `$metadata`
- 解析 XML `EntityType`，返回 `properties[]`（`name`、`type`；可选 `isKey`）
- 服务名简写（`API_PRODUCT_SRV`）与完整路径（`/sap/opu/odata/sap/...`）均支持
- SAP 404 / 网络错误映射为标准 SAP 错误码
- stdio 与 HTTP 传输下行为一致

**Out of scope**

- JSON `$metadata` 格式（当前仅请求 `application/xml`）
- 导航属性 / 关联实体展开
- 写操作或 `$metadata` 缓存策略变更（NFR-16 仅要求可选复用现有 `SAP_CACHE_TTL_MS`）
- Phase 3 专用服务 schema 的 v0.2 专项验收

## 接口契约

### 入参

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `service` | string | ✅ | 服务名或完整路径，如 `API_PRODUCT_SRV` 或 `/sap/opu/odata/sap/API_PRODUCT_SRV` |
| `entity` | string | ✅ | 实体类型名，如 `A_Product` |

### 成功出参

```json
{
  "service": "API_PRODUCT_SRV",
  "entity": "A_Product",
  "properties": [
    { "name": "Product", "type": "Edm.String", "isKey": true },
    { "name": "ProductType", "type": "Edm.String" }
  ],
  "count": 2
}
```

| 字段 | 说明 |
|------|------|
| `service` | 回显入参（简写形式保留原样） |
| `entity` | 回显入参 |
| `properties` | 属性数组；每项至少含 `name`、`type` |
| `count` | `properties.length` |

### 错误出参

缺参：

```json
{ "error": "MISSING_PARAMS", "message": "service and entity are required" }
```

SAP 服务不存在（404）：

```json
{ "error": "SAP_NOT_FOUND", "message": "Service path or entity not found" }
```

### MCP 包装

`tools/call` 成功时 `content[0].text` 为上述 JSON 字符串；错误时 `isError: true`。

## 验收标准

| # | 条件 | Pass |
|---|------|------|
| U-09-A1 | `{ "service": "API_PRODUCT_SRV", "entity": "A_Product" }` | `count >= 1`，含 `Product` 等字段名 |
| U-09-A2 | 缺 `entity`（或 zod 拦截） | `MISSING_PARAMS`，不请求 SAP |
| U-09-A3 | 不存在的服务路径 | `SAP_NOT_FOUND` 或等价 SAP 错误 |
| U-09-A4 | 实体名不在 metadata 中（如 `A_NonExistent`） | `SAP_NOT_FOUND`，不崩溃 |
| U-09-A5 | 单次调用 | SAP HTTP 请求 ≤ 1（`$metadata` GET） |

## 测试映射

[V0.2-TC.md](../../tests/V0.2-TC.md) → **T9**、**E9**、**C6**

## 实现

| 层级 | 路径 | 符号 |
|------|------|------|
| Handler | `MCP Server/lib/tools.js` | `getEntitySchema` |
| SAP / 解析 | `MCP Server/mcp-sap-core.js` | `sapGetEntitySchema`, `parseMetadata` |
| 注册 | `MCP Server/mcp-server.js` | `get_entity_schema` tool + zod schema |

## 实现备注（与 PRD 差距）

| 项 | 现状 | v0.2 期望 / 待编码 |
|----|------|-------------------|
| `nullable` 字段 | `parseMetadata` 未解析 XML `Nullable` 属性 | PRD 出参标注 `nullable?` 为可选；可后续增强 |
| 实体名不存在于 metadata | 返回 `count: 0` 且 `ok` 路径 | ✅ 已修复 — 返回 `SAP_NOT_FOUND` |
| Metadata 专用缓存 | 复用 `sapGet` 通用 cache（`SAP_CACHE_TTL_MS>0`） | 满足 NFR-16「可选缓存」；无独立 TTL |
