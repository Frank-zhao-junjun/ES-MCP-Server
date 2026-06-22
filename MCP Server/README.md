# MCP Server — 部署说明

SAP S/4HANA MCP Server（**sap-s4-mcp**）运行环境与部署步骤。

> 完整工具规格见 [../docs/MCP-Server开发指南.md](../docs/MCP-Server开发指南.md)

---

## 前置条件

- Node.js **≥ 18**
- 可访问 `https://my200967-api.s4hana.sapcloud.cn`
- 有效通信用户 `EPC_USER`（见 `../user.txt`）

---

## 安装

```powershell
cd "E:\00 - 中数通ES环境\ES 接口\MCP Server"
copy .env.example .env
# 编辑 .env（一般无需改 URL/client）
npm install
```

> **注意：** 当前 `mcp-server.js` 源码尚未入库。`npm install` 仅安装依赖；待 Phase 1 实现后再执行 `node mcp-server.js`。

---

## 环境变量

| 变量 | 说明 |
|------|------|
| `SAP_BASE_URL` | SAP API 根地址 |
| `SAP_CLIENT` | 默认 `100` |
| `SAP_CREDENTIALS_FILE` | 默认 `../user.txt` |
| `SAP_SCENARIO_DIR` | SAP 场景描述文件目录 |
| `MCP_PORT` | HTTP 端口，默认 `3000` |
| `MCP_ENABLE_HTTP_TRANSPORT` | `true` 启用 HTTP |
| `MCP_API_KEY` | API Key（HTTP / authenticate） |
| `MCP_REQUIRE_API_KEY` | `false` 时 stdio 不强制 Key |
| `SAP_REQUEST_TIMEOUT_MS` | OData 超时（毫秒） |
| `SAP_CACHE_TTL_MS` | 缓存 TTL，`0` 关闭 |

---

## 凭证文件 `user.txt`

路径由 `SAP_CREDENTIALS_FILE` 指定。支持中文或英文格式：

```
接口调用的通信用户：EPC_USER
密码：<密码>
```

```
User Name:EPC_USER
Password:<密码>
PasswordAlt:<备用密码>
```

解析逻辑须与 `../scripts/probe-sap-connectivity.js` 一致（见开发指南 §4）。

**勿将 `user.txt` 或 `.env` 提交 Git。**

---

## 启动（源码就绪后）

### stdio 模式（Cursor / Claude Desktop）

```powershell
node mcp-server.js
```

预期 stderr：

```
[sap-s4-mcp v0.1] MCP Server started via stdio
[sap-s4-mcp] SAP credentials from: ../user.txt
[sap-s4-mcp] Ready for Agent connections
```

### HTTP 模式

确保 `.env` 中：

```
MCP_ENABLE_HTTP_TRANSPORT=true
MCP_PORT=3000
```

```powershell
node mcp-server.js
```

- 服务信息：`http://127.0.0.1:3000/`
- MCP 端点：`http://127.0.0.1:3000/mcp`

---

## 验证 SAP 连通性（不依赖 MCP）

```powershell
cd ".."
node scripts/probe-sap-connectivity.js
```

预期：`OK 24 | 403 9`。全部 401 时先修 `user.txt`，不要启动 MCP。

---

## Cursor 配置示例

```json
{
  "mcpServers": {
    "sap-s4": {
      "command": "node",
      "args": ["E:\\00 - 中数通ES环境\\ES 接口\\MCP Server\\mcp-server.js"],
      "env": {
        "SAP_CREDENTIALS_FILE": "E:\\00 - 中数通ES环境\\ES 接口\\user.txt"
      }
    }
  }
}
```

---

## 故障排查

| 问题 | 处理 |
|------|------|
| `Cannot find module mcp-server.js` | 源码未实现，见开发指南 Phase 1 |
| MCP 工具返回 SAP 401 | 检查 `user.txt`；运行探测脚本 |
| MCP 工具返回 SAP 403 | 需开通 SAP_COM_0087 / 0054 等 Arrangement |
| HTTP 连接被拒 | 确认 `MCP_ENABLE_HTTP_TRANSPORT=true` 且端口未被占用 |

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `.env.example` | 环境变量模板 |
| `.env` | 本地配置（不提交） |
| `PATCH-credentials.md` | 凭证解析补丁备忘（已并入开发指南） |
| `node_modules/` | npm 依赖 |
