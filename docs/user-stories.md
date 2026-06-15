# SAP 接口资产清单 / SAP API Inventory

> **本文档定位：**
> 这是一份 **SAP ES 接口的资产清单**，从业务用户视角描述每个 API 模块的用途和验收标准。
>
> **与 MCP Server 文档的关系：**
> - `MCP Server/docs/user-stories.md` — MCP 工具层的产品级用户故事（认证/权限/限流/容器化）
> - `MCP Server/docs/PRD.md` — MCP Server 产品路线图
> - **本文档** — SAP 系统侧 29 个标准 API 模块（US-API-001~029）的资产登记和验收标准
>
> **编号约定：**
> - `US-API-xxx` — 本文档专用编号，区别于 MCP Server 的 `US-xxx`
> - 每个 US 对应一个或一组 SAP Communication Scenario（SAP_COM_xxxx）
> - 验收标准 = "接口能用了"的最低标准
> - OData V2/V4 协议版本必须明确标注
>
> **覆盖状态：** 本文档共 29 个 US-API 模块，附录总表列出 33 个 SAP_COM。多出的 SAP_COM 为同一 US-API 下的细分服务（如 US-API-005 同时包含采购合同和计划协议），或当前尚未纳入 MCP 覆盖的候选服务。

---

## 一、主数据管理 (Master Data)

### US-API-001: 业务伙伴主数据同步
**作为** 采购/销售业务人员  
**我想要** 实时获取 SAP 中的客户和供应商主数据  
**以便于** 在 MES 系统中维护最新的业务伙伴信息

**验收标准：**
- [x] 能够通过 API 获取客户基本信息（Customer, CustomerName, AccountGroup）
- [x] 能够获取客户的销售范围（SalesOrganization, DistributionChannel, Division）
- [x] 能够获取客户的公司代码层财务信息
- [x] 能够获取供应商基本信息
- [x] 数据延迟不超过 5 分钟

**MCP 工具映射：** `get_business_partner` · 详见 §8 映射表

---

### US-API-002: 产品主数据同步
**作为** 生产/仓储业务人员  
**我想要** 同步 SAP 中的产品主数据  
**以便于** 保持 MES 系统中物料信息的完整性

**验收标准：**
- [x] 能够获取产品的基本属性（描述、规格、单位）
- [x] 能够获取产品的物料组信息（含多语言）
- [x] 能够获取产品的分类信息
- [x] 支持 OData V4 和 V2 双版本

**MCP 工具映射：** `get_product` · 详见 §8 映射表

---

## 二、采购管理 (Procurement)

### US-API-003: 采购订单查询
**作为** 采购员  
**我想要** 查看 SAP 中的采购订单状态  
**以便于** 跟踪订单执行进度

**验收标准：**
- [x] 能够获取采购订单抬头信息
- [x] 能够获取采购订单行项目明细
- [x] 能够按供应商/日期范围过滤
- [x] 支持 OData V4

> 实现注：当前 MCP Server 使用 V2 服务 `API_PURCHASEORDER_PROCESS_SRV`；SAP_COM_0053 设计目标为 V4 服务 `api_purchaseorder_2`，后续可平滑升级。

**MCP 工具映射：** `get_purchase_order` · 详见 §8 映射表

---

### US-API-004: 采购申请查询
**作为** 采购经理  
**我想要** 查看 SAP 中的采购申请  
**以便于** 审批和管理采购需求

**验收标准：**
- [x] 能够获取采购申请抬头和明细
- [x] 能够获取申请人信息
- [x] 支持 OData V4

**MCP 工具映射：** 暂无专用工具（roadmap 待排） · 详见 §8 映射表

---

### US-API-005: 采购框架协议（合同/计划协议）
**作为** 采购员  
**我想要** 查询采购合同和计划协议  
**以便于** 关联采购执行

**验收标准：**
- [x] 能够查询采购合同（Purchase Contract）
- [x] 能够查询计划协议（Schedule Agreement）
- [x] 支持 OData V2

**MCP 工具映射：** 暂无专用工具（roadmap 待排） · 详见 §8 映射表

---

### US-API-006: 供应商发票集成
**作为** 财务人员  
**我想要** 获取供应商发票信息  
**以便于** 财务对账和付款

**验收标准：**
- [x] 能够获取供应商发票抬头信息
- [x] 能够获取发票行项目
- [x] 支持附件查询

**MCP 工具映射：** `get_supplier_invoice` · 详见 §8 映射表

---

### US-API-007: 采购询价（RFQ）管理
**作为** 采购员  
**我想要** 查询供应商询价和报价  
**以便于** 进行供应商比价和选择

**验收标准：**
- [x] 能够获取采购询价单（RFQ）
- [x] 能够获取供应商报价（Supplier Quotation）
- [x] 支持 OData V4

**MCP 工具映射：** 暂无专用工具（roadmap 待排） · 详见 §8 映射表

---

### US-API-008: 供应商评估
**作为** 采购经理  
**我想要** 查看供应商绩效评估结果  
**以便于** 进行供应商等级管理和淘汰

**验收标准：**
- [x] 能够获取供应商评估计分卡
- [x] 能够获取供应商评估响应详情
- [x] 支持历史评估数据查询

**MCP 工具映射：** 暂无专用工具（roadmap 待排） · 详见 §8 映射表

---

### US-API-009: 服务确认单
**作为** 项目经理  
**我想要** 查询服务确认单状态  
**以便于** 确认外包服务的完成情况

**验收标准：**
- [x] 能够获取服务确认单抬头
- [x] 能够获取服务行项目明细
- [x] 支持 OData V4

**MCP 工具映射：** 暂无专用工具（roadmap 待排） · 详见 §8 映射表

---

## 三、销售管理 (Sales)

### US-API-010: 销售订单同步
**作为** 销售内勤  
**我想要** 获取 SAP 中的销售订单  
**以便于** 安排生产计划和发货

**验收标准：**
- [x] 能够获取销售订单抬头信息
- [x] 能够获取销售订单行项目（含价格条件）
- [x] 能够按客户/日期范围过滤
- [x] 支持 OData V4

**MCP 工具映射：** `get_sales_order_status`、`trace_sales_order` · 详见 §8 映射表

---

### US-API-011: 销售合同管理
**作为** 销售经理  
**我想要** 查询销售合同  
**以便于** 管理和执行大客户协议

**验收标准：**
- [x] 能够获取销售合同抬头
- [x] 能够获取合同行项目
- [x] 支持 OData V4

**MCP 工具映射：** 暂无专用工具（roadmap 待排） · 详见 §8 映射表

---

### US-API-012: 销售报价/询价
**作为** 销售员  
**我想要** 查询销售报价单和销售询价  
**以便于** 快速响应客户需求

**验收标准：**
- [x] 能够获取销售报价单（Sales Quotation）
- [x] 能够获取销售询价（Sales Inquiry）
- [x] 支持 OData V2

---

### US-API-013: 销售开票查询
**作为** 财务人员  
**我想要** 获取销售开票凭证  
**以便于** 财务记账和收入确认

**验收标准：**
- [x] 能够获取发票抬头信息
- [x] 能够获取发票行项目
- [x] 支持 OData V4

**MCP 工具映射：** `trace_sales_order` · 详见 §8 映射表

---

### US-API-014: 销售价格条件
**作为** 定价经理  
**我想要** 查询销售价格条件配置  
**以便于** 理解价格计算逻辑

**验收标准：**
- [x] 能够获取价格条件字段目录
- [x] 能够获取价格条件表
- [x] 能够获取价格访问序列
- [x] 支持 OData V4

**MCP 工具映射：** 暂无专用工具（roadmap 待排） · 详见 §8 映射表

---

## 四、生产管理 (Production)

### US-API-015: 生产订单管理
**作为** 生产计划员  
**我想要** 查询生产订单  
**以便于** 安排和跟踪生产执行

**验收标准：**
- [x] 能够获取生产订单抬头信息
- [x] 能够获取生产订单工序明细
- [x] 支持 OData V4

**MCP 工具映射：** `trace_sales_order` · 详见 §8 映射表

---

### US-API-016: 生产数据查询
**作为** 生产计划员  
**我想要** 获取生产计划数据  
**以便于** 排产和资源调配

**验收标准：**
- [x] 能够获取计划订单（Planned Order）
- [x] 能够获取工作中心信息
- [x] 能够获取 MRP 物料计划数据
- [x] 能够获取独立需求（Independent Requirements）
- [x] 支持 OData V2 和 V4

**MCP 工具映射：** 暂无专用工具（roadmap 待排） · 详见 §8 映射表

---

### US-API-017: 生产订单确认
**作为** 车间主任  
**我想要** 记录和查询生产订单确认  
**以便于** 跟踪完工入库情况

**验收标准：**
- [ ] 能够获取生产订单确认信息
- [ ] 能够获取重复制造确认
- [ ] 支持 OData V2 和 V4

**MCP 工具映射：** 暂无专用工具（roadmap 待排，端点探测 406 需复核） · 详见 §8 映射表

---

### US-API-018: 物料清单（BOM）查询
**作为** 工艺工程师  
**我想要** 查询物料清单  
**以便于** 工艺设计和成本核算

**验收标准：**
- [x] 能够获取标准 BOM
- [x] 能够获取订单 BOM
- [x] 支持 OData V2

**MCP 工具映射：** `get_bom` · 详见 §8 映射表

---

### US-API-019: 工艺路线查询
**作为** 工艺工程师  
**我想要** 查询工艺路线  
**以便于** 工艺编排和工时估算

**验收标准：**
- [x] 能够获取工序清单
- [x] 能够获取工序详细信息
- [x] 支持 OData V2

**MCP 工具映射：** 暂无专用工具（roadmap 待排） · 详见 §8 映射表

---

### US-API-020: 质检数据查询
**作为** 质量工程师  
**我想要** 获取质检相关主数据  
**以便于** 质量检验执行和分析

**验收标准：**
- [x] 能够获取检验方法
- [x] 能够获取检验特性
- [x] 能够获取检验计划
- [x] 支持 OData V2

**MCP 工具映射：** 暂无专用工具（roadmap 待排） · 详见 §8 映射表

---

## 五、物流管理 (Logistics)

### US-API-021: 出入库交货单
**作为** 仓管员  
**我想要** 查询出库交货单和入库交货单  
**以便于** 安排仓库收发货

**验收标准：**
- [x] 能够获取出库交货单（Outbound Delivery）
- [x] 能够获取入库交货单（Inbound Delivery）
- [x] 能够获取客户退货交货单
- [x] 支持 OData V2

**MCP 工具映射：** `trace_sales_order` · 详见 §8 映射表

---

### US-API-022: 物料凭证查询
**作为** 仓管员/财务  
**我想要** 查询物料凭证（移动类型）  
**以便于** 追溯物料进出库记录

**验收标准：**
- [x] 能够获取物料凭证抬头
- [x] 能够获取物料凭证行项目
- [x] 支持 OData V2

**MCP 工具映射：** `trace_sales_order` · 详见 §8 映射表

---

### US-API-023: 库存查询
**作为** 仓管员  
**我想要** 实时查询物料库存  
**以便于** 了解可用库存量

**验收标准：**
- [x] 能够获取物料库存信息
- [x] 能够按工厂/库存地点过滤
- [x] 支持 OData V2

**MCP 工具映射：** `get_material_stock` · 详见 §8 映射表

---

### US-API-024: 库存预留查询
**作为** 生产计划员  
**我想要** 查询库存预留单  
**以便于** 了解预留占用情况

**验收标准：**
- [x] 能够获取预留单抬头
- [x] 能够获取预留行项目
- [x] 支持 OData V4

**MCP 工具映射：** 暂无专用工具（roadmap 待排） · 详见 §8 映射表

---

### US-API-025: 盘点数据查询
**作为** 财务/仓管  
**我想要** 获取物理库存盘点数据  
**以便于** 年终盘点或定期盘点

**验收标准：**
- [x] 能够获取盘点单抬头
- [x] 能够获取盘点行项目
- [x] 支持 OData V4

**MCP 工具映射：** 暂无专用工具（roadmap 待排） · 详见 §8 映射表

---

## 六、财务管理 (Finance)

### US-API-026: 成本中心查询
**作为** 财务经理  
**我想要** 查询成本中心信息  
**以便于** 成本核算和预算控制

**验收标准：**
- [x] 能够获取成本中心主数据
- [x] 能够获取成本中心层次结构
- [x] 支持 OData V4

**MCP 工具映射：** `get_cost_center` · 详见 §8 映射表

---

### US-API-027: 作业类型查询
**作为** 成本会计  
**我想要** 查询作业类型信息  
**以便于** 作业成本计算

**验收标准：**
- [x] 能够获取作业类型主数据
- [x] 支持 OData V2

**MCP 工具映射：** 暂无专用工具（roadmap 待排） · 详见 §8 映射表

---

## 七、系统集成 (System Integration)

### US-API-028: 附件管理
**作为** 业务人员  
**我想要** 访问 SAP 业务单据的附件  
**以便于** 获取相关文档

**验收标准：**
- [x] 能够获取采购订单/销售订单的附件列表
- [x] 能够下载附件文件
- [x] 支持 OData V2

**MCP 工具映射：** 暂无专用工具（roadmap 待排） · 详见 §8 映射表

---

### US-API-029: 用户与角色查询（IAM）
**作为** IT 管理员  
**我想要** 查询 SAP 用户和角色信息  
**以便于** 用户权限管理和审计

**验收标准：**
- [x] 能够获取 SAP 用户列表
- [x] 能够获取业务角色
- [x] 能够获取 PFCG 角色
- [x] 能够获取授权配置文件
- [x] 支持 OData V2

**MCP 工具映射：** 暂无专用工具（roadmap 待排） · 详见 §8 映射表

---

## 八、US-API → MCP 工具 / Spec 映射表

> 本表说明每个 SAP API 模块当前由哪些 MCP 工具覆盖，以及对应的设计规格。
> "—" 表示暂无专用 MCP 工具，已列入 MCP Server PRD roadmap 待排期。

| US-API | 业务域 | SAP_COM | OData | MCP 工具 | Spec |
|---|---|---|---|---|---|
| US-API-001 | 主数据 | SAP_COM_0008 | V2 | `get_business_partner` | [003-master-data](../MCP%20Server/.specify/specs/003-master-data/spec.md) |
| US-API-002 | 主数据 | SAP_COM_0009 | V2/V4 | `get_product` | [003-master-data](../MCP%20Server/.specify/specs/003-master-data/spec.md) |
| US-API-003 | 采购 | SAP_COM_0053 | V4 | `get_purchase_order` | [002-business-apis](../MCP%20Server/.specify/specs/002-business-apis/spec.md) |
| US-API-004 | 采购 | SAP_COM_0102 | V4 | `get_purchase_requisition` | ✅ v0.4 |
| US-API-005 | 采购 | SAP_COM_0101 / 0103 | V2 | `get_schedule_agreement` | ✅ v0.4 |
| US-API-006 | 采购 | SAP_COM_0057 | V2 | `get_supplier_invoice` | [003-master-data](../MCP%20Server/.specify/specs/003-master-data/spec.md) |
| US-API-007 | 采购 | SAP_COM_0113 | V2/V4 | — | roadmap |
| US-API-008 | 采购 | SAP_COM_0122 / 0139 | V2 | — | roadmap |
| US-API-009 | 采购 | SAP_COM_0146 | V4 | — | roadmap |
| US-API-010 | 销售 | SAP_COM_0109 | V4 | `get_sales_order_status`, `trace_sales_order` | [002-business-apis](../MCP%20Server/.specify/specs/002-business-apis/spec.md) |
| US-API-011 | 销售 | SAP_COM_0119 | V4 | `get_sales_contract` | ✅ v0.4 |
| US-API-012 | 销售 | SAP_COM_0113 / 0117 | V2/V4 | — | roadmap |
| US-API-013 | 销售 | SAP_COM_0120 | V4 | `trace_sales_order` | [002-business-apis](../MCP%20Server/.specify/specs/002-business-apis/spec.md) |
| US-API-014 | 销售 | SAP_COM_0294 | V4 | — | roadmap |
| US-API-015 | 生产 | SAP_COM_0522 | V4 | `trace_sales_order` | [002-business-apis](../MCP%20Server/.specify/specs/002-business-apis/spec.md) |
| US-API-016 | 生产 | SAP_COM_0104 | V2/V4 | — | roadmap |
| US-API-017 | 生产 | SAP_COM_0522（确认服务） | V2 | — | roadmap（端点探测 406，需复核） |
| US-API-018 | 生产 | SAP_COM_0105 | V2 | `get_bom` | [003-master-data](../MCP%20Server/.specify/specs/003-master-data/spec.md) |
| US-API-019 | 生产 | SAP_COM_0519 | V2 | — | roadmap |
| US-API-020 | 生产 | SAP_COM_0110 | V2 | — | roadmap |
| US-API-021 | 物流 | SAP_COM_0106 | V2 | `trace_sales_order` | [002-business-apis](../MCP%20Server/.specify/specs/002-business-apis/spec.md) |
| US-API-022 | 物流 | SAP_COM_0108 | V2 | `trace_sales_order` | [002-business-apis](../MCP%20Server/.specify/specs/002-business-apis/spec.md) |
| US-API-023 | 物流 | SAP_COM_0164 | V2 | `get_material_stock` | [003-master-data](../MCP%20Server/.specify/specs/003-master-data/spec.md) |
| US-API-024 | 物流 | SAP_COM_0112 | V4 | `get_material_reservation` | ✅ v0.4 |
| US-API-025 | 物流 | SAP_COM_0107 | V4 | — | roadmap |
| US-API-026 | 财务 | SAP_COM_0943 | V4 | `get_cost_center` | [003-master-data](../MCP%20Server/.specify/specs/003-master-data/spec.md) |
| US-API-027 | 财务 | SAP_COM_0129 | V2 | — | roadmap |
| US-API-028 | 系统集成 | 待确认（附件服务） | V2 | — | roadmap |
| US-API-029 | 系统集成 | SAP_COM_0066 | V2 | — | roadmap |

---

## 九、API 端点状态追踪

### 端点探测结果（2026-06-03）

| API | 端点 | 状态 | 说明 |
|-----|------|------|------|
| Product V2 | /API_PRODUCT_SRV | 200 | ✅ 可用 |
| Product V4 | /api_product | 200 | ✅ 可用 |
| Customer V2 | /API_BUSINESS_PARTNER | 200 | ✅ 可用 |
| MaterialDoc V2 | /API_MATERIAL_DOCUMENT_SRV | 200 | ✅ 可用 |
| Stock V2 | /API_MATERIAL_STOCK_SRV | 200 | ✅ 可用 |
| ProductionOrder V4 | /api_productionorder | 200 | ✅ 可用 |
| SalesOrder V4 | /api_salesorder | 200 | ✅ 可用（修正 URL） |
| Billing V2 | /API_BILLING_DOCUMENT_SRV | 200 | ✅ 可用 |
| OutboundDelivery V2 | /API_OUTBOUND_DELIVERY_SRV | 200 | ✅ 可用 |
| POConf V2 | /API_PROD_ORDER_CONFIRMATION_2_SRV | 406 | ⚠️ 元数据不可访问 |

> **注：** `POConf V2` 对应 **US-API-017 生产订单确认**。该端点当前返回 406（元数据不可访问），在纳入 MCP 覆盖前需重新探测并确认服务激活状态与正确的元数据 URL。

---

## 附录：API 清单总表

| Scenario ID | 模块名称 | OData 版本 | 服务地址 | 对应 US-API |
|------------|----------|------------|----------|-------------|
| SAP_COM_0008 | Business Partner | V2 | API_BUSINESS_PARTNER | US-API-001 |
| SAP_COM_0009 | Product | V2/V4 | API_PRODUCT_SRV / api_product | US-API-002 |
| SAP_COM_0053 | Purchase Order | V4 | api_purchaseorder_2 | US-API-003 |
| SAP_COM_0057 | Supplier Invoice | V2 | API_SUPPLIERINVOICE_PROCESS_SRV | US-API-006 |
| SAP_COM_0101 | Purchase Contract | V2 | API_PURCHASECONTRACT_PROCESS_SRV | US-API-005 |
| SAP_COM_0102 | Purchase Requisition | V4 | api_purchaserequisition_2 | US-API-004 |
| SAP_COM_0103 | Schedule Agreement | V2 | API_SCHED_AGRMT_PROCESS_SRV | US-API-005 |
| SAP_COM_0104 | Production Data | V2/V4 | 多个服务 | US-API-016 |
| SAP_COM_0105 | BOM | V2 | API_BILL_OF_MATERIAL_SRV | US-API-018 |
| SAP_COM_0106 | Outbound/Inbound Delivery | V2 | API_OUTBOUND_DELIVERY_SRV | US-API-021 |
| SAP_COM_0107 | Physical Inventory | V4 | api_physicalinventorydocument | US-API-025 |
| SAP_COM_0108 | Material Documents | V2 | API_MATERIAL_DOCUMENT_SRV | US-API-022 |
| SAP_COM_0109 | Sales Order | V4 | api_salesorder | US-API-010 |
| SAP_COM_0110 | Inspection Data | V2 | API_INSPECTIONMETHOD_SRV 等 | US-API-020 |
| SAP_COM_0112 | Material Reservation | V4 | api_reservation_document | US-API-024 |
| SAP_COM_0113 | Purchase RFQ / Sales Quotation | V2/V4 | 多个服务 | US-API-007 / 012 |
| SAP_COM_0117 | Sales Inquiry | V2 | API_SALES_INQUIRY_SRV | US-API-012 |
| SAP_COM_0119 | Sales Contract | V4 | api_salescontract | US-API-011 |
| SAP_COM_0120 | Sales Billing | V4 | api_billingdocument | US-API-013 |
| SAP_COM_0122 | Supplier Evaluation | V2 | API_SUPLR_EVAL_SCORECARD_SRV | US-API-008 |
| SAP_COM_0123 | Purchasing Category | V2 | API_PURCHASING_CATEGORY_SRV | — |
| SAP_COM_0134 | Customer Material | V2 | API_CUSTOMER_MATERIAL_SRV | — |
| SAP_COM_0139 | Supplier Evaluation Response | V2 | API_SUPLR_EVAL_RESPONSE_SRV | US-API-008 |
| SAP_COM_0145 | Purchase Info Record | V2 | API_INFORECORD_PROCESS_SRV | — |
| SAP_COM_0146 | Service Entry Sheet | V4 | api_serviceentrysheet | US-API-009 |
| SAP_COM_0147 | Material Price | V2 | API_MATERIAL_VALUATION_SRV | — |
| SAP_COM_0164 | Material Stock | V2 | API_MATERIAL_STOCK_SRV | US-API-023 |
| SAP_COM_0294 | Sales Price condition | V4 | api_slsprcg* 系列 | US-API-014 |
| SAP_COM_0519 | Routing | V2 | API_PRODUCTION_ROUTING | US-API-019 |
| SAP_COM_0522 | Production Order | V4 | api_productionorder | US-API-015 |
| SAP_COM_0943 | Cost Center | V4 | api_cost_center | US-API-026 |
| SAP_COM_0066 | IAM Integration | V2 | APS_IAM_SIAG_* 系列 | US-API-029 |
| SAP_COM_0129 | Activity Type | V2 | 待确认 | US-API-027 |