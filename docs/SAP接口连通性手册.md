# SAP 接口连通性手册

本文档描述 `scripts/probe-sap-connectivity.js` 探测的 **33 个 OData 端点**，以及如何在租户 `my200967-api.s4hana.sapcloud.cn`（client `100`）上使用它们。

最新结果见 `Probe_Latest.json`；表格版见 `ES接口清单.xlsx` 工作表 **ES接口清单**（行 22–54）。

---

## 1. 探测脚本

### 用法

```powershell
cd "E:\00 - 中数通ES环境\ES-MCP-Server"
node scripts/probe-sap-connectivity.js
```

### 环境变量（可选）

| 变量 | 默认 | 说明 |
|------|------|------|
| `SAP_BASE_URL` | `https://my200967-api.s4hana.sapcloud.cn` | SAP API 根地址 |
| `SAP_CLIENT` | `100` | `sap-client` 查询参数 |
| `SAP_CREDENTIALS_FILE` | `./user.txt` | 凭证文件路径 |

### 凭证解析

脚本从 `user.txt` 读取用户与密码，支持：

- 中文：`接口调用的通信用户：`、`密码：`、`或者这个：`
- 英文：`User Name:`、`User ID:`、`Password:`、`PasswordAlt:`

对每个端点，脚本会尝试所有「用户 × 密码」组合，任一返回 2xx 即记为 OK。

### 输出

- 控制台打印 JSON 数组
- 写入 `Probe_Latest.json`
-  stderr 汇总：`总计 33 | OK 24 | 403 9 | 404 0`

### 同步 Excel

```powershell
python scripts/sync-excel-from-probe.py
```

---

## 2. 汇总（2026-06-22）

| 分类 | 条数 | OK | 403 |
|------|------|-----|-----|
| SAP上游 | 14 | 14 | 0 |
| EPC采购 | 7 | 7 | 0 |
| EPC应付 | 6 | 3 (V2) | 3 (V4) |
| 主数据 | 6 | 0 | 6 |
| **合计** | **33** | **24** | **9** |

认证用户：`EPC_USER`

---

## 3. SAP 上游（14 项，全部 OK）

| 接口名称 | 通信场景 | 协议 | Entity / 路径要点 |
|----------|----------|------|-------------------|
| 产品主数据 V2 | SAP_COM_0009 | OData V2 | `API_PRODUCT_SRV/A_Product` |
| 客户主数据 V2 | SAP_COM_0008 | OData V2 | `API_BUSINESS_PARTNER/A_Customer` |
| 销售订单 V4 | SAP_COM_0109 | OData V4 | `api_salesorder/.../SalesOrder` |
| 生产订单 V4 | SAP_COM_0104 | OData V4 | `api_productionorder/.../ProductionOrder` |
| 外向交货 V2 | SAP_COM_0106 | OData V2 | `API_OUTBOUND_DELIVERY_SRV;v=0002/A_OutbDeliveryHeader` |
| 开票 V2 | SAP_COM_0124 | OData V2 | `API_BILLING_DOCUMENT_SRV/A_BillingDocument` |
| 物料库存 V2 | SAP_COM_0164 | OData V2 | `API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod` |
| 采购订单 V2 | legacy | OData V2 | `API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder` |
| 产品主数据 V4 | SAP_COM_0009 | OData V4 | `api_product/.../Product` |
| 物料组 ProductGroup V4 | SAP_COM_0009 | OData V4 | `api_productgroup_2/.../ProductGroup` |
| 供应商 V2 | SAP_COM_0008 | OData V2 | `A_Supplier` |
| 供应商公司 V2 | SAP_COM_0008 | OData V2 | `A_SupplierCompany` |
| 物料凭证 V2 | SAP_COM_0108 | OData V2 | `API_MATERIAL_DOCUMENT_SRV/A_MaterialDocumentHeader` |
| 成本中心 V4 | SAP_COM_0008 | OData V4 | `api_cost_center/.../A_CostCenter_2` |

完整 URL 见 `Probe_Latest.json` 各条 `接口地址` 字段。

### 通用请求头

```
Authorization: Basic <base64(EPC_USER:password)>
Accept: application/json
sap-client: 100
```

查询参数建议始终包含：`$format=json&sap-client=100`

---

## 4. EPC 采购 — SAP_COM_0053（7 项，全部 OK）

服务根路径：

```
/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/
```

| Entity Set | 用途 |
|------------|------|
| `PurchaseOrder` | 采购订单抬头 |
| `PurchaseOrderItem` | 行项目 |
| `PurchaseOrderScheduleLine` | 计划行（交货日期） |
| `PurOrderItemPricingElement` | 行定价（税） |
| `PurchaseOrderNote` | 抬头备注 |
| `PurchaseOrderItemNote` | 行备注 |
| `POSubcontractingComponent` | 委外组件 |

EPC 集成建议按 PO 拉取：抬头 → 备注 → 供应商名称（`A_Supplier`）→ 行 → 计划行/定价。详细字段映射见 EPC 项目 `Purchase Order.txt`。

**注意：** 采购订单请使用 `api_purchaseorder_2`，不要用无 `_2` 的旧路径（会 403）。

---

## 5. EPC 应付 — 供应商发票

### V2（legacy，3 项 OK）— 推荐使用

服务：`API_SUPPLIERINVOICE_PROCESS_SRV`

| 操作 | URL 模式 |
|------|----------|
| 列表 | `.../A_SupplierInvoice?$top=50&$format=json&sap-client=100` |
| 单张 | `.../A_SupplierInvoice(SupplierInvoice='{Invoice}',FiscalYear='{Year}')?$format=json&sap-client=100` |
| 行(PO参考) | `.../A_SuplrInvcItemPurOrdRef?$filter=SupplierInvoice eq '{Invoice}' and FiscalYear eq '{Year}'&$format=json&sap-client=100` |

**已验证示例：** 发票 `5105600101` / 年度 `2025`，行项目关联 PO `4500000000/10`，金额 12000 CNY。

### V4（SAP_COM_0054，3 项 403）— 需开通 Arrangement

| Entity | 状态 |
|--------|------|
| `SupplierInvoice` | FAIL(403) |
| `SuplrInvcItemPurOrdRef` | FAIL(403) |
| `SupplierInvoiceTax` | FAIL(403) |

路径前缀：`/sap/opu/odata4/sap/api_supplierinvoice/srvd_a2x/sap/supplierinvoice/0001/`

---

## 6. 主数据 — SAP_COM_0087（6 项，全部 403）

需在 Fiori 开通 **Scope Item 1YB**（Communication Arrangement for SAP_COM_0087）后重跑探测。

| 接口名称 | Entity | API 服务 |
|----------|--------|----------|
| 付款条件 V4 | `PaymentTerms` | `api_paymentterms` |
| 工厂 V4 | `Plant` | `api_plant` |
| 采购组织 V4 | `A_PurchasingOrganization` | `api_purchasingorganization` |
| 采购组 V4 | `A_PurchasingGroup` | `api_purchasinggroup` |
| 公司代码 V4 | `CompanyCode` | `api_companycode` |
| 库存地点 V4 | `StorageLocation` | `api_storagelocation` |

### EPC 采购订单的替代方案（无需 0087）

| 需求 | 替代 API | 场景 |
|------|----------|------|
| 供应商名称 | `A_Supplier` | SAP_COM_0008 |
| 公司名称 | `A_SupplierCompany.CompanyCodeName` | SAP_COM_0008 |
| 物料组描述 | `ProductGroup.ProductGroupName`（`api_productgroup_2`） | SAP_COM_0009 |
| 抬头备注 | `PurchaseOrderNote` | SAP_COM_0053 |

---

## 7. 故障排查

| 现象 | 原因 | 处理 |
|------|------|------|
| 全部 FAIL(401) | 凭证未解析或密码错误 | 检查 `user.txt` 格式；Fiori 重置 `EPC_USER` 密码 |
| FAIL(403) | Communication Arrangement 未开通 | 申请 SAP_COM_0087 / SAP_COM_0054 |
| FAIL(404) | 服务路径错误 | 核对服务名（如 `api_purchaseorder_2` vs `api_purchaseorder`） |
| OK 但无数据 | 租户无业务数据 | 正常；探测仅用 `$top=1` 验证权限 |

---

## 8. 与 MCP 工具的对应关系

| MCP 工具 | 主要依赖的探测端点 |
|----------|-------------------|
| `get_sales_order_status` | 销售订单 V4 |
| `get_product` | 产品 V2/V4 |
| `get_business_partner` | 客户/供应商 V2 |
| `get_purchase_order` | 采购订单 V2 + PO V4 全套 |
| `get_material_stock` | 物料库存 V2 |
| `get_supplier_invoice` | 供应商发票 V2（三条） |
| `get_cost_center` | 成本中心 V4 |
| `trace_sales_order` | 销售订单 + 交货 + 开票 + 物料凭证（均已 OK） |

详见 [MCP-Server开发指南.md](MCP-Server开发指南.md)。
