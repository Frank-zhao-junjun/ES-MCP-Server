# MVP Test Cases

| 字段 | 值 |
|------|-----|
| **版本** | v1.1 |
| **日期** | 2026-06-23 |
| **E2E 执行** | 2026-06-23 `pnpm test:e2e` — **21/21 PASS** |
| **PRD** | [MVP需求说明.md](../MVP需求说明.md) v1.1.1 §9 |
| **Unit Spec** | [docs/specs/units/](specs/units/) |
| **原则** | **③ 先于 ④** — 编码前本文件为验收依据 |

> 与 PRD §9 一一对应。差距修复专项见 [MVP-TC-gap-B1-B4.md](MVP-TC-gap-B1-B4.md)。

---

## 9.1 前置验收（环境）— A1～A5

| ID | 检查项 | 命令 / 方法 | 通过标准 | 结果 |
|----|--------|-------------|----------|------|
| A1 | 凭证文件 | 检查 `user.txt` | 存在且非空 | PASS |
| A2 | 依赖安装 | `cd MCP Server && pnpm install` | 无报错 | PASS |
| A3 | 单元测试 | `pnpm test` | **19/19** 通过 | PASS |
| A4 | SAP 探测 | `node scripts/probe-sap-connectivity.js` | OK 26（403 可接受） | PASS |
| A5 | stdio 启动 | `node mcp-server.js --stdio` | stderr：version、stdio、Ready | PASS |

---

## 9.2 工具验收 — 正常用例 T1～T8

| ID | 工具 | Unit | 测试入参 | 通过标准 | 结果 |
|----|------|------|----------|----------|------|
| T1 | `health_check` | U-05 | `{ "includeSapCheck": true }` | `sap.ok === true` | PASS |
| T2 | `get_product` | U-08 | `{ "top": 1 }` | JSON 含 `results`，无堆栈 | PASS |
| T3 | `get_business_partner` | U-06 | `{ "top": 1 }` | 同上 | PASS |
| T4 | `get_sales_order_status` | U-03 | `{ "top": 1 }` 或 `{ "salesOrder": "19" }` | 同上 | PASS |
| T5 | `get_purchase_order` | U-01 | `{ "purchaseOrder": "4500000000", "includeItems": true }` | `results` + 独立 `items` | PASS |
| T6 | `get_material_stock` | U-04 | `{ "top": 1 }` | 200，允许空 results | PASS |
| T7 | `get_supplier_invoice` | U-02 | `{ "invoice": "5105600101", "fiscalYear": "2025", "includeLines": true }` | `header`、`lines` 非空 | PASS |
| T8 | `get_cost_center` | U-07 | `{ "top": 1 }` | 200 | PASS |

> **T5 备注：** 本租户有效 PO 为 `4500000000`（非文档示例 `4500000023`）。SAP V4 expand 导航属性为 `_PurchaseOrderItem`。

---

## 9.3 工具验收 — 异常/边界 E1～E8

| ID | 工具 | 测试入参 | 通过标准 | 结果 |
|----|------|----------|----------|------|
| E1 | `health_check` | `{ "includeSapCheck": false }` | 无 `sap`，`mcp === "ok"` | PASS |
| E2 | `get_product` | `{ "top": 5000 }` | `INVALID_PARAMETER`，不请求 SAP | PASS |
| E3 | `get_business_partner` | `{}` | 默认 10 条客户 | PASS |
| E4 | `get_purchase_order` | `{ "purchaseOrder": "9999999999" }` | `results: []` 或 `SAP_NOT_FOUND` | PASS |
| E5 | `get_supplier_invoice` | `{ "invoice": "5105600101" }` | 默认当前财年（租户 FY2025 数据可能 `SAP_NOT_FOUND`） | PASS |
| E6 | `get_supplier_invoice` | `{ "invoice": "INVALID" }` | `header: []` 或 `SAP_NOT_FOUND` | PASS |
| E7 | 任意 MVP 工具 | `{ "foo": "bar" }` | 忽略未知字段，不崩溃 | PASS |
| E8 | 任意含 `top` 工具 | `top` 为负数或字符串 | `INVALID_PARAMETER` | PASS |

---

## 9.4 MCP Client 实测 — C1～C3

验收方式：**MCP Inspector 优先**（`npx @modelcontextprotocol/inspector node mcp-server.js --stdio`）。

| ID | 用户输入示例 | 期望 Agent 行为 | 结果 |
|----|-------------|----------------|------|
| C1 | 「用 health_check 看 SAP 是否正常」 | 调用 `health_check`，汇报 SAP 状态 | PASS |
| C2 | 「查一下采购订单的行项目」 | `get_purchase_order` + `includeItems` | PASS |
| C3 | 「发票 5105600101，2025 年，带行项目」 | `get_supplier_invoice` + `includeLines` | PASS |

门禁：C1～C3 **至少 2 项**通过。

---

## 9.5 文档验收 — D1～D4

| ID | 检查项 | 通过标准 |
|----|--------|----------|
| D1 | README 唯一根目录 | ✅ |
| D2 | `ES 接口` 归档说明 | ✅ |
| D3 | MVP需求说明.md 入库 | ✅ |
| D4 | MVP 8 / 非 MVP 12 边界 | AGENTS.md / README 一致 |

---

## 9.6 MVP 交付判定

- [x] A1～A5 全部通过
- [x] T1～T8 全部通过
- [x] E1～E8 全部通过
- [x] C1～C3 至少 2 项通过（3/3 工具级代理）
- [x] D1～D4 全部满足
- [ ] `user.txt` / `.env` 未出现在 `git status`（提交前检查）

---

## 执行命令

```powershell
# ⑤ 单元测试（无 SAP）
pnpm test

# ⑥ E2E（需 SAP）
pnpm test:e2e
```
