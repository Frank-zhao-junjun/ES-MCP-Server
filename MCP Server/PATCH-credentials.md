# 凭证解析补丁备忘

> **已并入** [../docs/MCP-Server开发指南.md](../docs/MCP-Server开发指南.md) §4。  
> 实现 `mcp-sap-core.js` / `lib/credentials.js` 时按此逻辑编写，并与 `scripts/probe-sap-connectivity.js` 保持同步。

## 要求

1. **用户标签** — 支持中英文，冒号后允许空格：
   - `User Name:`、`User ID:`
   - `接口调用的通信用户：`、`通信用户：`

2. **密码标签** — 支持：
   - `密码：`、`或者这个：`
   - `Password:`、`PasswordAlt:`

3. **组合策略** — 对每个 SAP 请求依次尝试所有「用户 × 密码」组合，与探测脚本行为一致。

## 参考实现

见 `scripts/probe-sap-connectivity.js` 中的 `parseCredentials()` 函数。
