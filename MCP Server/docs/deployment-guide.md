# Deployment Guide — SAP S/4HANA MCP Server v0.3.0

> 面向运维人员的生产部署 step-by-step 指南。

## 前置条件

- Node.js 20+ 
- SAP S/4HANA Cloud 租户的通信用户凭据
- 30+ SAP_COM 场景的 endpoint 定义文件（`接口地址（SAP_COM_xxxx）.txt`）

## 1. 获取代码

```powershell
git clone https://github.com/Frank-zhao-junjun/ES-MCP-Server.git
cd ES-MCP-Server\MCP Server
npm install
```

## 2. 配置环境变量

复制模板并填入真实值：

```powershell
copy .env.example .env
```

必填项：

| 变量 | 说明 | 示例 |
|---|---|---|
| `MCP_API_KEY` | Agent 接入密钥 | `mcp-xxxxxxxxxxxxxxxxxx` |
| `SAP_BASE_URL` | SAP 租户 API 地址 | `https://mytenant-api.s4hana.sapcloud.cn` |
| `SAP_CREDENTIALS_FILE` | SAP 通信用户凭据文件路径 | `../user.txt` |
| `SAP_SCENARIO_DIR` | SAP_COM 场景文件目录 | `..` |
| `MCP_REQUIRE_API_KEY` | 生产环境必须 `true` | `true` |

推荐配置：

| 变量 | 推荐值 | 说明 |
|---|---|---|
| `MCP_ROLE` | `readonly` | 最小权限 |
| `MCP_ENABLE_DEBUG_TOOLS` | `false` | 关闭调试 |
| `MCP_ENABLE_ADMIN_TOOLS` | `false` | 关闭插件管理 |
| `MCP_SAP_MAX_CONCURRENT` | `5` | 并发上限 |
| `MCP_SAP_RATE_PER_MIN` | `60` | 每分钟速率 |
| `SAP_CLIENT` | `100` | SAP 客户端 |
| `SAP_REQUEST_TIMEOUT_MS` | `30000` | 请求超时 |

## 3. 验证

```powershell
# 语法检查
node --check mcp-server.js

# 单元 + 集成测试 (不连接真实 SAP)
npm test

# MCP 客户端契约测试
npm run test:contract
```

## 4. 本地启动

```powershell
npm start
```

MCP Server 通过 stdio 与 MCP 客户端通信，不监听网络端口。

## 5. 配置 MCP 客户端

在客户端的 `mcp.json` 中添加：

```json
{
  "mcpServers": {
    "sap-s4-mcp": {
      "command": "node",
      "args": ["mcp-server.js"],
      "cwd": "/path/to/MCP Server",
      "env": {
        "MCP_API_KEY": "mcp-your-real-key",
        "SAP_BASE_URL": "https://your-tenant-api.s4hana.sapcloud.cn",
        "SAP_CREDENTIALS_FILE": "/path/to/user.txt",
        "SAP_SCENARIO_DIR": "/path/to/scenarios",
        "MCP_REQUIRE_API_KEY": "true",
        "MCP_ROLE": "readonly"
      }
    }
  }
}
```

## 6. Docker 部署

```powershell
# 构建
docker build -t sap-s4-mcp:0.3.0 .

# 运行
docker run -i --rm \
  --env-file .env \
  -v /path/to/user.txt:/secrets/user.txt:ro \
  -v /path/to/scenarios:/scenarios:ro \
  -e SAP_CREDENTIALS_FILE=/secrets/user.txt \
  -e SAP_SCENARIO_DIR=/scenarios \
  sap-s4-mcp:0.3.0
```

## 7. Kubernetes 部署

示例 Deployment：

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: sap-mcp-secrets
stringData:
  MCP_API_KEY: "mcp-your-real-key"
  SAP_BASE_URL: "https://your-tenant-api.s4hana.sapcloud.cn"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sap-s4-mcp
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: mcp
        image: sap-s4-mcp:0.3.0
        envFrom:
        - secretRef:
            name: sap-mcp-secrets
        env:
        - name: MCP_REQUIRE_API_KEY
          value: "true"
        - name: MCP_ROLE
          value: "readonly"
        - name: MCP_ENABLE_DEBUG_TOOLS
          value: "false"
        - name: MCP_ENABLE_ADMIN_TOOLS
          value: "false"
        - name: SAP_CREDENTIALS_FILE
          value: "/secrets/user.txt"
        - name: SAP_SCENARIO_DIR
          value: "/scenarios"
        - name: MCP_SAP_MAX_CONCURRENT
          value: "5"
        - name: MCP_SAP_RATE_PER_MIN
          value: "60"
        volumeMounts:
        - name: credentials
          mountPath: /secrets
          readOnly: true
        - name: scenarios
          mountPath: /scenarios
          readOnly: true
      volumes:
      - name: credentials
        secret:
          secretName: sap-credentials
      - name: scenarios
        configMap:
          name: sap-scenarios
```

## 8. 健康检查

```powershell
# 通过 MCP 客户端调用
authenticate → health_check

# Docker
docker inspect --format='{{.State.Health.Status}}' <container>
```

## 9. 日志

所有结构化日志输出到 stderr，格式：

```json
{"timestamp":"...","level":"info","requestId":"...","traceId":"...","tool":"get_sales_order_status","durationMs":234,"status":"success"}
```

## 10. 故障排查

| 问题 | 检查 |
|---|---|
| `SAP_BASE_URL is required` | `.env` 中 `SAP_BASE_URL` 是否已填写 |
| `MCP_API_KEY is required` | `.env` 中 `MCP_API_KEY` 是否已填写 |
| `SAP_CREDENTIALS_FILE not readable` | `user.txt` 文件路径是否正确 |
| SAP 返回 401 | 通信用户密码是否过期 |
| SAP 返回 404 | `接口地址（SAP_COM_xxxx）.txt` 中 URL 是否正确 |
| `RATE_LIMITED` | 调低 `MCP_SAP_RATE_PER_MIN` 或增加 `MCP_SAP_MAX_CONCURRENT` |
| `SAP_UNAVAILABLE` (断路器) | SAP 可能临时不可用，等待 30s 自动恢复 |
