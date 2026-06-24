# ES-MCP-Server

SAP S/4HANA Cloud OData 探测与 MCP Server。**本仓库为唯一开发与部署根目录。**

- **GitHub:** https://github.com/Frank-zhao-junjun/ES-MCP-Server
- **本地路径:** `E:\00 - 中数通ES环境\ES-MCP-Server`

面向 ES/EPC 系统，通过 AI Agent（Cursor、Claude、HTTP 客户端）查询 SAP 业务数据。

> 旧目录 `ES 接口` 已归档，仅作历史参考，不再在此重复实现 MCP 源码。见该目录下 `README.md` 说明。

## 租户信息

| 项 | 值 |
|---|---|
| 系统 URL | `https://my200967-api.s4hana.sapcloud.cn` |
| Client | `100` |
| 通信用户 | `EPC_USER`（见根目录 `user.txt`，勿提交 Git） |

## 项目结构

```
ES-MCP-Server/
├── README.md
├── AGENTS.md                  # Agent 工作指引 + SDD 强制引用
├── user.txt                   # SAP 凭证（本地，勿提交）
├── Probe_Latest.json          # 最近一次连通性探测
├── .claude/skills/sdd-workflow/  # SDD 6 阶段流程 Skill
├── docs/
│   ├── MVP需求说明.md         # PRD 主文档（v1.1.1）
│   ├── specs/units/           # ① Unit Spec（U-01～U-08 + B1～B4）
│   ├── tests/                 # ③ Test Case（先于编码）
│   └── superpowers/plans/     # 实施计划
├── scripts/
│   ├── probe-sap-connectivity.js
│   └── sync-excel-from-probe.py
└── MCP Server/                # ★ MCP 源码（唯一实现位置）
    ├── mcp-server.js
    ├── mcp-sap-core.js
    ├── lib/
    └── test/
```

关联项目（EPC 字段映射）：`E:\00 - 中数通ES环境\ES+EPC Demo系统搭建\EPC接口\`

## 开发流程（SDD）

```
US → ① Unit Spec → ② PRD → ③ Test Case → ④ Coding → ⑤ Unit Test → ⑥ E2E
```

| 阶段 | 路径 |
|------|------|
| ② PRD | [docs/MVP需求说明.md](docs/MVP需求说明.md) |
| ① Unit Spec | [docs/specs/units/](docs/specs/units/) |
| ③ Test Case | [docs/tests/MVP-TC.md](docs/tests/MVP-TC.md) |
| 流程 Skill | [.claude/skills/sdd-workflow/SKILL.md](.claude/skills/sdd-workflow/SKILL.md) |

细节见 [AGENTS.md](AGENTS.md)。

## 当前状态

| 模块 | 状态 |
|------|------|
| MCP Server 源码 | ✅ `MCP Server/` |
| MCP 工具 | ✅ 20 个已注册（8 MVP + 5 增强 + 7 待 SAP 开通） |
| SAP 连通性探测 | ✅ 42 端点，OK **26** / 403 **14** / 404 **2** |
| 差距修复 B1–B4 | ✅ 编码完成（items 拆分、错误码、fiscalYear、可观测性） |
| 单元测试 | ✅ `pnpm test` **19/19** |
| MVP §9 E2E | ✅ `pnpm test:e2e` **21/21** |
| **MVP 交付** | ✅ **已交付**（[`b4b7143`](https://github.com/Frank-zhao-junjun/ES-MCP-Server/commit/b4b7143)） |

## 快速开始

### 1. 配置凭证

在仓库根目录创建或复制 `user.txt`：

```
接口调用的通信用户：EPC_USER
密码：<你的密码>
```

### 2. 探测 SAP 连通性

```powershell
cd "E:\00 - 中数通ES环境\ES-MCP-Server"
node scripts/probe-sap-connectivity.js
```

### 3. 安装并启动 MCP（Cursor 推荐 stdio）

```powershell
cd "E:\00 - 中数通ES环境\ES-MCP-Server\MCP Server"
copy .env.example .env
pnpm install
pnpm test
pnpm test:e2e   # 需 SAP 网络
node mcp-server.js --stdio
```

HTTP 模式（Coze / 远程 Agent）：`node mcp-server.js`（`.env` 中 `MCP_ENABLE_HTTP_TRANSPORT=true`）

### 4. Cursor `mcp.json`

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

## MVP 范围（8 工具）

| 工具 | Unit Spec | 说明 |
|------|-----------|------|
| `health_check` | [U-05](docs/specs/units/U-05-health-check.md) | 服务 + SAP 连通性 |
| `get_product` | [U-08](docs/specs/units/U-08-get-product.md) | 产品主数据 |
| `get_business_partner` | [U-06](docs/specs/units/U-06-get-business-partner.md) | 客户 / 供应商 |
| `get_sales_order_status` | [U-03](docs/specs/units/U-03-get-sales-order-status.md) | 销售订单 |
| `get_purchase_order` | [U-01](docs/specs/units/U-01-get-purchase-order.md) | 采购订单（V4） |
| `get_material_stock` | [U-04](docs/specs/units/U-04-get-material-stock.md) | 物料库存 |
| `get_supplier_invoice` | [U-02](docs/specs/units/U-02-get-supplier-invoice.md) | 供应商发票（V2） |
| `get_cost_center` | [U-07](docs/specs/units/U-07-get-cost-center.md) | 成本中心 |

其余 12 个工具已实现，但属于增强能力或依赖 SAP Arrangement（403），见 [AGENTS.md](AGENTS.md)。

## 文档索引

| 文档 | 内容 |
|------|------|
| **[docs/MVP需求说明.md](docs/MVP需求说明.md)** | **MVP PRD、FR/NFR、§9 验收（权威）** |
| **[docs/tests/MVP-TC.md](docs/tests/MVP-TC.md)** | **测试用例矩阵（③ 先于编码）** |
| [docs/specs/units/](docs/specs/units/) | Unit Spec U-01～U-08、B1～B4 |
| [docs/specs/PRD-MVP-gap-B1-B4.md](docs/specs/PRD-MVP-gap-B1-B4.md) | 差距修复 PRD |
| [AGENTS.md](AGENTS.md) | 工具清单、SDD 流程、强制引用 |
| [docs/MCP-Server开发指南.md](docs/MCP-Server开发指南.md) | 全量 20 工具技术规格 |
| [docs/SAP接口连通性手册.md](docs/SAP接口连通性手册.md) | OData 端点与 403 说明 |
| [docs/TASKS.md](docs/TASKS.md) | 任务清单 |
| [MCP Server/README.md](MCP%20Server/README.md) | 部署与环境变量 |

**冲突裁决：** MVP 范围内以 `docs/MVP需求说明.md` 为准。
