# MCP Server — 部署说明

SAP S/4HANA MCP Server（**sap-s4-mcp**）。仓库根目录：`ES-MCP-Server`（非 `ES 接口`）。

> 工具规格见 [../docs/MCP-Server开发指南.md](../docs/MCP-Server开发指南.md)

## 前置条件

- Node.js **≥ 18**
- 可访问 `https://my200967-api.s4hana.sapcloud.cn`
- 根目录 `../user.txt` 含有效 `EPC_USER` 凭证

## 安装

```powershell
cd "E:\00 - 中数通ES环境\ES-MCP-Server\MCP Server"
copy .env.example .env
pnpm install
```

## 启动

### stdio（Cursor / Claude Desktop，推荐）

```powershell
node mcp-server.js --stdio
```

### HTTP（Coze / 远程 Agent）

`.env` 中 `MCP_ENABLE_HTTP_TRANSPORT=true`，然后：

```powershell
node mcp-server.js
```

- 服务信息：`http://127.0.0.1:3000/`
- MCP 端点：`http://127.0.0.1:3000/mcp`

## 验证 SAP（不启动 MCP）

```powershell
cd "E:\00 - 中数通ES环境\ES-MCP-Server"
node scripts/probe-sap-connectivity.js
npm test --prefix "MCP Server"
```

## Cursor 配置

```json
{
  "mcpServers": {
    "sap-s4": {
      "command": "node",
      "args": [
        "E:\\00 - 中数通ES环境\\ES-MCP-Server\\MCP Server\\mcp-server.js",
        "--stdio"
      ],
      "env": {
        "SAP_CREDENTIALS_FILE": "E:\\00 - 中数通ES环境\\ES-MCP-Server\\user.txt",
        "MCP_ENABLE_HTTP_TRANSPORT": "false"
      }
    }
  }
}
```

## 故障排查

| 问题 | 处理 |
|------|------|
| `SAP credentials file not found` | 在 `ES-MCP-Server\user.txt` 创建凭证 |
| SAP 401 | 检查 `user.txt`；运行 probe 脚本 |
| SAP 403 | 需 Basis 开通对应 Communication Arrangement |
| Cursor 连不上 | 确认使用 `--stdio` 且路径指向 **ES-MCP-Server** |
