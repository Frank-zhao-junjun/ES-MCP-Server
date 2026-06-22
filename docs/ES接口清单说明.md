# ES接口清单.xlsx 说明

`ES接口清单.xlsx` 工作表 **ES接口清单** 是本项目的接口总表，与 `Probe_Latest.json` 及 MCP 工具规格保持同步。

## 列定义

| 列 | 字段 | 说明 |
|----|------|------|
| A | 分类 | `MCP工具` / `MCP HTTP` / `SAP上游` / `EPC采购` / `EPC应付` / `主数据` / `配置` |
| B | 接口名称 | 工具名或 OData 接口中文名 |
| C | 方法 | `GET`、`MCP Tool`、`POST/GET`、`FILE` 等 |
| D | 接口地址 | 完整 OData URL，或 MCP 传输说明（`stdio / POST /mcp`） |
| E | 协议 | `OData V2/JSON`、`OData V4/JSON`、`MCP JSON` 等 |
| F | 请求格式 | 查询参数或 MCP 入参 JSON 结构 |
| G | 响应格式 | OData 包装（`{ d: { results } }` / `{ value[] }`）或 MCP 出参 |
| H | 鉴权 | `Basic Auth`、`MCP_API_KEY`、`已认证` 等 |
| I | 连通性 | `OK(200)`、`FAIL(403)`、`需启动MCP`、`SAP 401` 等 |
| J | 备注 | 通信场景、示例、依赖说明 |

## 行区间

| 行 | 内容 |
|----|------|
| 1 | 表头 |
| 2–21 | MCP 工具（17 个）+ HTTP 端点（2 个） |
| 22–54 | SAP OData 探测结果（33 条） |
| 55–56 | 配置项（`user.txt`、MCP 环境变量） |

## 连通性标注含义

| 标注 | 含义 |
|------|------|
| `OK(200)` | `probe-sap-connectivity.js` 实测通过（或 MCP 工具对应底层 API 已通过） |
| `FAIL(403)` | 需开通 Communication Arrangement（见连通性手册） |
| `需启动MCP` | 基础设施工具，需 MCP Server 进程运行后才能验证 |
| `SAP 401` | 历史标注或场景未开通；以 `Probe_Latest.json` 为准 |

## 同步方式

探测后更新 Excel：

```powershell
node scripts/probe-sap-connectivity.js
python scripts/sync-excel-from-probe.py
```

脚本 `sync-excel-from-probe.py` 会：

- 保留 MCP 工具区（行 2–21）并刷新已验证工具的连通性
- 用 `Probe_Latest.json` 重写 SAP 区（行 22–54）
- 保留配置区（末 2 行）
- 备注列写入 `[通信场景]` 前缀

## 相关文档

- [SAP接口连通性手册](SAP接口连通性手册.md) — 33 端点详情
- [MCP-Server开发指南](MCP-Server开发指南.md) — 17 个 MCP 工具规格
