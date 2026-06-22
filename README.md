# ES 接口 — SAP MCP Server

SAP S/4HANA Cloud OData 接口探测与 MCP Server 项目。面向 ES/EPC 系统通过 AI Agent 访问 SAP 业务数据。

## 租户信息

| 项 | 值 |
|---|---|
| 系统 URL | `https://my200967-api.s4hana.sapcloud.cn` |
| Client | `100` |
| 通信用户 | `EPC_USER`（见 `user.txt`，勿提交 Git） |

## 项目结构

```
ES 接口/
├── README.md                    # 本文件
├── docs/
│   ├── MCP-Server开发指南.md    # MCP 工具规格、架构、接入方式
│   └── SAP接口连通性手册.md     # 33 个 OData 端点探测说明
├── ES接口清单.xlsx              # 接口总表（MCP 工具 + SAP OData + 配置）
├── user.txt                     # SAP 通信用户凭证（本地，勿提交）
├── Probe_Latest.json            # 最近一次连通性探测结果
├── scripts/
│   ├── probe-sap-connectivity.js   # SAP 连通性探测
│   └── sync-excel-from-probe.py    # 将探测结果同步到 Excel
└── MCP Server/
    ├── .env.example             # 环境变量模板
    ├── .env                     # 本地配置（勿提交）
    └── README.md                # MCP Server 部署说明
```

关联项目（EPC 采购集成详细字段映射）：

`E:\00 - 中数通ES环境\ES+EPC Demo系统搭建\EPC接口\`

## 当前状态（2026-06-23）

| 模块 | 状态 |
|------|------|
| SAP 连通性探测 | ✅ 完成 — 42 端点，**OK 24 / 403 18** |
| `ES接口清单.xlsx` | ✅ 已同步最新探测结果 |
| `user.txt` 中文格式解析 | ✅ 探测脚本已支持 |
| MCP Server 源码 | ✅ **已实现** — Phase 0→4 全部完成 |
| MCP 工具注册 | ✅ **20 个工具**（8 MVP + 5 基础设施 + 7 被阻塞） |
| MCP 工具端到端验证 | ✅ HTTP / stdio 双模式冒烟测试通过 |
| 凭证单元测试 | ✅ 11 个测试全部通过 |
| Git 卫生 | ✅ `.gitignore` 排除 `user.txt` / `.env` / `node_modules` |

## 快速开始

### 1. 配置凭证

编辑 `user.txt`（支持中文或英文标签，冒号后可有空格）：

```
接口调用的通信用户：EPC_USER
密码：<你的密码>
```

或：

```
User Name:EPC_USER
Password:<你的密码>
PasswordAlt:<备用密码>
```

### 2. 运行连通性探测

```powershell
cd "E:\00 - 中数通ES环境\ES 接口"
node scripts/probe-sap-connectivity.js
```

结果写入 `Probe_Latest.json`。预期汇总：`OK 24 | 403 9`。

### 3. 同步 Excel 清单

```powershell
python scripts/sync-excel-from-probe.py
```

### 4. 启动 MCP Server

```powershell
cd "MCP Server"
pnpm install
node mcp-server.js
```

HTTP 模式：`http://127.0.0.1:3000/mcp`（需 `MCP_ENABLE_HTTP_TRANSPORT=true`）

## 文档索引

| 文档 | 内容 |
|------|------|
| [MCP-Server开发指南](docs/MCP-Server开发指南.md) | 17 个 MCP 工具规格、架构、Cursor 接入、开发路线图 |
| [SAP接口连通性手册](docs/SAP接口连通性手册.md) | 33 个 OData 端点、403 阻塞项、发票 V2 示例 |
| [ES接口清单说明](docs/ES接口清单说明.md) | Excel 列定义、行区间、同步方式 |
| [TASKS.md](docs/TASKS.md) | **Lean 任务清单**（逐项执行） |
| [MCP Server/README.md](MCP%20Server/README.md) | 环境变量、部署、凭证解析要求 |

## SAP 侧待开通项

向 Basis 申请 Communication Arrangement 后，以下接口可从 403 变为 200：

| 场景 | Scope Item | 影响 |
|------|------------|------|
| **SAP_COM_0087** | 1YB | 付款条件、工厂、采购组织/组、公司代码、库存地点 |
| **SAP_COM_0054** | — | 供应商发票 V4（当前用 V2 legacy 替代） |

部分 MCP 工具（采购申请、计划协议、销售合同、BOM、预留单）依赖尚未探测或未开通的场景，见开发指南。

## 历史参考

- `Endpoint_Probe_20260603.json` — 2026-06-03 早期探测（8 项，均 200）
