# AGENTS.md — ES-MCP-Server

## 项目概览

构建面向 SAP S/4HANA Cloud 的 MCP Server，暴露 8 个 MVP 工具供 AI Agent 通过 HTTP 或 stdio 调用。

- 仓库根目录：`/workspace/projects`
- 源码目录：`MCP Server/`
- 文档目录：`docs/`
- 探测脚本：`scripts/`

## 目录结构

```
MCP Server/
├── package.json          # 依赖：@modelcontextprotocol/sdk, axios, dotenv, zod
├── mcp-server.js         # 入口：注册工具 + 启动 stdio / HTTP transport
├── mcp-sap-core.js       # SAP HTTP 客户端、缓存、错误映射、配置加载
├── lib/
│   ├── credentials.js    # 解析 ../user.txt（user:password 格式）
│   └── tools.js          # 8 个 MVP 工具 handler
├── .env.example          # 环境变量模板
└── .env                  # 本地配置，不提交（已 .gitignore）
```

## 启动命令

```bash
cd "MCP Server"

# HTTP 模式（默认，供 Agent 通过 HTTP/SSE 调用）
node mcp-server.js

# stdio 模式（供 Claude Desktop 等本地 MCP 客户端调用）
node mcp-server.js --stdio
```

HTTP 模式监听 `MCP_BIND_ADDRESS:MCP_PORT`（默认 `127.0.0.1:3000`），MCP endpoint 为 `/mcp`。

## 配置

复制 `.env.example` 为 `.env`，关键环境变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SAP_BASE_URL` | `https://my200967-api.s4hana.sapcloud.cn` | SAP API 网关 |
| `SAP_CLIENT` | `100` | SAP client |
| `SAP_CREDENTIALS_FILE` | `../user.txt` | 用户名密码文件 |
| `SAP_REQUEST_TIMEOUT_MS` | `30000` | 请求超时 |
| `MCP_ENABLE_HTTP_TRANSPORT` | `true` | 是否启用 HTTP |
| `MCP_REQUIRE_API_KEY` | `false` | 是否启用 Bearer Token 鉴权 |
| `MCP_API_KEY` | `change-me` | API Key（启用鉴权时必填） |

`user.txt` 格式：

```
S00222941xxx:YourPassword
```

## 工具清单

| 工具名 | 说明 |
|--------|------|
| `health_check` | 服务健康检查，可选探测 SAP |
| `get_product` | 产品主数据 `API_PRODUCT_SRV/A_Product` |
| `get_business_partner` | 客户/供应商主数据 `API_BUSINESS_PARTNER` |
| `get_sales_order_status` | 销售订单状态 `API_SALES_ORDER_SRV` |
| `get_purchase_order` | 采购订单 `api_purchaseorder_2` |
| `get_material_stock` | 物料库存 `API_MATERIAL_STOCK_SRV` |
| `get_supplier_invoice` | 供应商发票 `API_SUPPLIER_INVOICE_PROCESS_SRV` |
| `get_cost_center` | 成本中心 `api_cost_center` |

## 本地验证

```bash
# 启动 HTTP 服务
cd "MCP Server" && node mcp-server.js &

# 检查基本信息
curl http://127.0.0.1:3000/

# MCP initialize（返回后获取 Mcp-Session-Id）
curl -i -X POST http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# 列出工具（携带上一步的 Session ID）
curl -X POST http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Session-Id: <session-id>' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

## 常见错误

- `SAP credentials file not found: ...`：缺少 `user.txt`，需创建并填写用户名密码。
- `SAP_AUTH_FAILED`：凭证被 SAP 拒绝，检查 user.txt。
- `SAP_ARRANGEMENT_REQUIRED`：API 未在 SAP 中启用 Communication Arrangement。
- `401 UNAUTHORIZED`：HTTP 模式启用了 `MCP_REQUIRE_API_KEY=true` 但请求未携带正确的 `Authorization: Bearer <MCP_API_KEY>`。

## 开发约定

- 仅使用 CommonJS（`require`），保持与 Node.js 直接运行兼容。
- 工具 handler 统一返回 `{ content: [{ type: 'text', text: JSON.stringify(result) }], isError?: boolean }`。
- SAP HTTP 调用优先尝试所有凭证组合，自动处理 V2 (`d.results`) 与 V4 (`value`) 响应结构。
- 不要提交 `.env`、`user.txt`、`node_modules`。
