/**
 * Shared SAP endpoint / scenario registry.
 * Extracted from scripts/probe-sap-connectivity.js so probe + MCP server can share the same table.
 */

const DEFAULT_CLIENT = process.env.SAP_CLIENT || '100';

const ENDPOINTS = [
  // --- 原有 8 项 ---
  { key: 'product_v2', category: 'SAP上游', name: '产品主数据 V2', scenario: 'SAP_COM_0009', method: 'GET', protocol: 'OData V2/JSON', pathTemplate: '/sap/opu/odata/sap/API_PRODUCT_SRV/A_Product?$top=1&$format=json&sap-client={CLIENT}', 分类: 'SAP上游', 名称: '产品主数据 V2', 场景: 'SAP_COM_0009', 方法: 'GET', 协议: 'OData V2/JSON' },
  { key: 'customer_v2', category: 'SAP上游', name: '客户主数据 V2', scenario: 'SAP_COM_0008', method: 'GET', protocol: 'OData V2/JSON', pathTemplate: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_Customer?$top=1&$format=json&sap-client={CLIENT}', 分类: 'SAP上游', 名称: '客户主数据 V2', 场景: 'SAP_COM_0008', 方法: 'GET', 协议: 'OData V2/JSON' },
  { key: 'sales_order_v4', category: 'SAP上游', name: '销售订单 V4', scenario: 'SAP_COM_0109', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrder?$top=1&$format=json&sap-client={CLIENT}', 分类: 'SAP上游', 名称: '销售订单 V4', 场景: 'SAP_COM_0109', 方法: 'GET', 协议: 'OData V4/JSON' },
  { key: 'production_order_v4', category: 'SAP上游', name: '生产订单 V4', scenario: 'SAP_COM_0104', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_productionorder/srvd_a2x/sap/productionorder/0001/ProductionOrder?$top=1&$format=json&sap-client={CLIENT}', 分类: 'SAP上游', 名称: '生产订单 V4', 场景: 'SAP_COM_0104', 方法: 'GET', 协议: 'OData V4/JSON' },
  { key: 'outbound_delivery_v2', category: 'SAP上游', name: '外向交货 V2', scenario: 'SAP_COM_0106', method: 'GET', protocol: 'OData V2/JSON', pathTemplate: '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002/A_OutbDeliveryHeader?$top=1&$format=json&sap-client={CLIENT}', 分类: 'SAP上游', 名称: '外向交货 V2', 场景: 'SAP_COM_0106', 方法: 'GET', 协议: 'OData V2/JSON' },
  { key: 'billing_document_v2', category: 'SAP上游', name: '开票 V2', scenario: 'SAP_COM_0124', method: 'GET', protocol: 'OData V2/JSON', pathTemplate: '/sap/opu/odata/sap/API_BILLING_DOCUMENT_SRV/A_BillingDocument?$top=1&$format=json&sap-client={CLIENT}', 分类: 'SAP上游', 名称: '开票 V2', 场景: 'SAP_COM_0124', 方法: 'GET', 协议: 'OData V2/JSON' },
  { key: 'material_stock_v2', category: 'SAP上游', name: '物料库存 V2', scenario: 'SAP_COM_0164', method: 'GET', protocol: 'OData V2/JSON', pathTemplate: '/sap/opu/odata/sap/API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod?$top=1&$format=json&sap-client={CLIENT}', 分类: 'SAP上游', 名称: '物料库存 V2', 场景: 'SAP_COM_0164', 方法: 'GET', 协议: 'OData V2/JSON' },
  { key: 'purchase_order_v2', category: 'SAP上游', name: '采购订单 V2', scenario: 'legacy', method: 'GET', protocol: 'OData V2/JSON', pathTemplate: '/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder?$top=1&$format=json&sap-client={CLIENT}', 分类: 'SAP上游', 名称: '采购订单 V2', 场景: 'legacy', 方法: 'GET', 协议: 'OData V2/JSON' },

  // --- 扩展：产品 / 业务伙伴 ---
  { key: 'product_v4', category: 'SAP上游', name: '产品主数据 V4', scenario: 'SAP_COM_0009', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_product/srvd_a2x/sap/product/0002/Product?$top=1&$format=json&sap-client={CLIENT}', 分类: 'SAP上游', 名称: '产品主数据 V4', 场景: 'SAP_COM_0009', 方法: 'GET', 协议: 'OData V4/JSON' },
  { key: 'product_group_v4', category: 'SAP上游', name: '物料组 ProductGroup V4', scenario: 'SAP_COM_0009', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_productgroup_2/srvd_a2x/sap/productgroup/0001/ProductGroup?$top=1&$format=json&sap-client={CLIENT}', 分类: 'SAP上游', 名称: '物料组 ProductGroup V4', 场景: 'SAP_COM_0009', 方法: 'GET', 协议: 'OData V4/JSON' },
  { key: 'supplier_v2', category: 'SAP上游', name: '供应商 V2', scenario: 'SAP_COM_0008', method: 'GET', protocol: 'OData V2/JSON', pathTemplate: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_Supplier?$top=1&$format=json&sap-client={CLIENT}', 分类: 'SAP上游', 名称: '供应商 V2', 场景: 'SAP_COM_0008', 方法: 'GET', 协议: 'OData V2/JSON' },
  { key: 'supplier_company_v2', category: 'SAP上游', name: '供应商公司 V2', scenario: 'SAP_COM_0008', method: 'GET', protocol: 'OData V2/JSON', pathTemplate: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_SupplierCompany?$top=1&$format=json&sap-client={CLIENT}', 分类: 'SAP上游', 名称: '供应商公司 V2', 场景: 'SAP_COM_0008', 方法: 'GET', 协议: 'OData V2/JSON' },
  { key: 'material_document_v2', category: 'SAP上游', name: '物料凭证 V2', scenario: 'SAP_COM_0108', method: 'GET', protocol: 'OData V2/JSON', pathTemplate: '/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/A_MaterialDocumentHeader?$top=1&$format=json&sap-client={CLIENT}', 分类: 'SAP上游', 名称: '物料凭证 V2', 场景: 'SAP_COM_0108', 方法: 'GET', 协议: 'OData V2/JSON' },
  { key: 'cost_center_v4', category: 'SAP上游', name: '成本中心 V4', scenario: 'SAP_COM_0008', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_cost_center/srvd_a2x/sap/costcenter/0001/A_CostCenter_2?$top=1&$format=json&sap-client={CLIENT}', 分类: 'SAP上游', 名称: '成本中心 V4', 场景: 'SAP_COM_0008', 方法: 'GET', 协议: 'OData V4/JSON' },

  // --- 扩展：采购订单 V4 (EPC / SAP_COM_0053) ---
  { key: 'purchase_order_header_v4', category: 'EPC采购', name: '采购订单抬头 V4', scenario: 'SAP_COM_0053', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/PurchaseOrder?$top=1&$format=json&sap-client={CLIENT}', 分类: 'EPC采购', 名称: '采购订单抬头 V4', 场景: 'SAP_COM_0053', 方法: 'GET', 协议: 'OData V4/JSON' },
  { key: 'purchase_order_item_v4', category: 'EPC采购', name: '采购订单行 V4', scenario: 'SAP_COM_0053', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/PurchaseOrderItem?$top=1&$format=json&sap-client={CLIENT}', 分类: 'EPC采购', 名称: '采购订单行 V4', 场景: 'SAP_COM_0053', 方法: 'GET', 协议: 'OData V4/JSON' },
  { key: 'purchase_order_schedule_line_v4', category: 'EPC采购', name: '采购计划行 V4', scenario: 'SAP_COM_0053', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/PurchaseOrderScheduleLine?$top=1&$format=json&sap-client={CLIENT}', 分类: 'EPC采购', 名称: '采购计划行 V4', 场景: 'SAP_COM_0053', 方法: 'GET', 协议: 'OData V4/JSON' },
  { key: 'purchase_order_pricing_v4', category: 'EPC采购', name: '采购行定价 V4', scenario: 'SAP_COM_0053', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/PurOrderItemPricingElement?$top=1&$format=json&sap-client={CLIENT}', 分类: 'EPC采购', 名称: '采购行定价 V4', 场景: 'SAP_COM_0053', 方法: 'GET', 协议: 'OData V4/JSON' },
  { key: 'purchase_order_note_v4', category: 'EPC采购', name: '采购抬头备注 V4', scenario: 'SAP_COM_0053', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/PurchaseOrderNote?$top=1&$format=json&sap-client={CLIENT}', 分类: 'EPC采购', 名称: '采购抬头备注 V4', 场景: 'SAP_COM_0053', 方法: 'GET', 协议: 'OData V4/JSON' },
  { key: 'purchase_order_item_note_v4', category: 'EPC采购', name: '采购行备注 V4', scenario: 'SAP_COM_0053', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/PurchaseOrderItemNote?$top=1&$format=json&sap-client={CLIENT}', 分类: 'EPC采购', 名称: '采购行备注 V4', 场景: 'SAP_COM_0053', 方法: 'GET', 协议: 'OData V4/JSON' },
  { key: 'po_subcontracting_component_v4', category: 'EPC采购', name: '委外组件 V4', scenario: 'SAP_COM_0053', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/POSubcontractingComponent?$top=1&$format=json&sap-client={CLIENT}', 分类: 'EPC采购', 名称: '委外组件 V4', 场景: 'SAP_COM_0053', 方法: 'GET', 协议: 'OData V4/JSON' },

  // --- 供应商发票：V2 可用 (legacy)；V4 需 SAP_COM_0054 ---
  { key: 'supplier_invoice_list_v2', category: 'EPC应付', name: '供应商发票列表 V2', scenario: 'legacy(V2可用)', method: 'GET', protocol: 'OData V2/JSON', pathTemplate: '/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice?$top=1&$format=json&sap-client={CLIENT}', readExample: '/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice?$top=50&$format=json&sap-client={CLIENT}', note: '列表；V4需SAP_COM_0054', 分类: 'EPC应付', 名称: '供应商发票列表 V2', 场景: 'legacy(V2可用)', 方法: 'GET', 协议: 'OData V2/JSON', 读取示例: '/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice?$top=50&$format=json&sap-client={CLIENT}', 备注: '列表；V4需SAP_COM_0054' },
  { key: 'supplier_invoice_single_v2', category: 'EPC应付', name: '供应商发票单张 V2', scenario: 'legacy(V2可用)', method: 'GET', protocol: 'OData V2/JSON', pathTemplate: "/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice(SupplierInvoice='5105600101',FiscalYear='2025')?$format=json&sap-client={CLIENT}", readExample: "/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice(SupplierInvoice='{Invoice}',FiscalYear='{Year}')?$format=json&sap-client={CLIENT}", note: '示例5105600101/2025', 分类: 'EPC应付', 名称: '供应商发票单张 V2', 场景: 'legacy(V2可用)', 方法: 'GET', 协议: 'OData V2/JSON', 读取示例: "/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice(SupplierInvoice='{Invoice}',FiscalYear='{Year}')?$format=json&sap-client={CLIENT}", 备注: '示例5105600101/2025' },
  { key: 'supplier_invoice_line_v2', category: 'EPC应付', name: '供应商发票行(PO参考) V2', scenario: 'legacy(V2可用)', method: 'GET', protocol: 'OData V2/JSON', pathTemplate: "/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SuplrInvcItemPurOrdRef?$filter=SupplierInvoice eq '5105600101' and FiscalYear eq '2025'&$top=1&$format=json&sap-client={CLIENT}", readExample: "/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SuplrInvcItemPurOrdRef?$filter=SupplierInvoice eq '{Invoice}' and FiscalYear eq '{Year}'&$format=json&sap-client={CLIENT}", note: '实体A_SuplrInvcItemPurOrdRef', 分类: 'EPC应付', 名称: '供应商发票行(PO参考) V2', 场景: 'legacy(V2可用)', 方法: 'GET', 协议: 'OData V2/JSON', 读取示例: "/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SuplrInvcItemPurOrdRef?$filter=SupplierInvoice eq '{Invoice}' and FiscalYear eq '2025'&$format=json&sap-client={CLIENT}", 备注: '实体A_SuplrInvcItemPurOrdRef' },
  { key: 'supplier_invoice_header_v4', category: 'EPC应付', name: '供应商发票抬头 V4', scenario: 'SAP_COM_0054', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_supplierinvoice/srvd_a2x/sap/supplierinvoice/0001/SupplierInvoice?$top=1&$format=json&sap-client={CLIENT}', note: '需开通Arrangement', 分类: 'EPC应付', 名称: '供应商发票抬头 V4', 场景: 'SAP_COM_0054', 方法: 'GET', 协议: 'OData V4/JSON', 备注: '需开通Arrangement' },
  { key: 'supplier_invoice_line_v4', category: 'EPC应付', name: '供应商发票行(PO参考) V4', scenario: 'SAP_COM_0054', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_supplierinvoice/srvd_a2x/sap/supplierinvoice/0001/SuplrInvcItemPurOrdRef?$top=1&$format=json&sap-client={CLIENT}', note: '需开通Arrangement', 分类: 'EPC应付', 名称: '供应商发票行(PO参考) V4', 场景: 'SAP_COM_0054', 方法: 'GET', 协议: 'OData V4/JSON', 备注: '需开通Arrangement' },
  { key: 'supplier_invoice_tax_v4', category: 'EPC应付', name: '供应商发票税 V4', scenario: 'SAP_COM_0054', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_supplierinvoice/srvd_a2x/sap/supplierinvoice/0001/SupplierInvoiceTax?$top=1&$format=json&sap-client={CLIENT}', note: '需开通Arrangement', 分类: 'EPC应付', 名称: '供应商发票税 V4', 场景: 'SAP_COM_0054', 方法: 'GET', 协议: 'OData V4/JSON', 备注: '需开通Arrangement' },

  // --- 扩展：主数据 (SAP_COM_0087 等，预期部分 403) ---
  { key: 'payment_terms_v4', category: '主数据', name: '付款条件 V4', scenario: 'SAP_COM_0087', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_paymentterms/srvd_a2x/sap/paymentterms/0001/PaymentTerms?$top=1&$format=json&sap-client={CLIENT}', 分类: '主数据', 名称: '付款条件 V4', 场景: 'SAP_COM_0087', 方法: 'GET', 协议: 'OData V4/JSON' },
  { key: 'plant_v4', category: '主数据', name: '工厂 V4', scenario: 'SAP_COM_0087', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_plant/srvd_a2x/sap/plant/0001/Plant?$top=1&$format=json&sap-client={CLIENT}', 分类: '主数据', 名称: '工厂 V4', 场景: 'SAP_COM_0087', 方法: 'GET', 协议: 'OData V4/JSON' },
  { key: 'purchasing_organization_v4', category: '主数据', name: '采购组织 V4', scenario: 'SAP_COM_0087', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_purchasingorganization/srvd_a2x/sap/purchasingorganization/0001/A_PurchasingOrganization?$top=1&$format=json&sap-client={CLIENT}', 分类: '主数据', 名称: '采购组织 V4', 场景: 'SAP_COM_0087', 方法: 'GET', 协议: 'OData V4/JSON' },
  { key: 'purchasing_group_v4', category: '主数据', name: '采购组 V4', scenario: 'SAP_COM_0087', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_purchasinggroup/srvd_a2x/sap/purchasinggroup/0001/A_PurchasingGroup?$top=1&$format=json&sap-client={CLIENT}', 分类: '主数据', 名称: '采购组 V4', 场景: 'SAP_COM_0087', 方法: 'GET', 协议: 'OData V4/JSON' },
  { key: 'company_code_v4', category: '主数据', name: '公司代码 V4', scenario: 'SAP_COM_0087', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_companycode/srvd_a2x/sap/companycode/0001/CompanyCode?$top=1&$format=json&sap-client={CLIENT}', 分类: '主数据', 名称: '公司代码 V4', 场景: 'SAP_COM_0087', 方法: 'GET', 协议: 'OData V4/JSON' },
  { key: 'storage_location_v4', category: '主数据', name: '库存地点 V4', scenario: 'SAP_COM_0087', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_storagelocation/srvd_a2x/sap/storagelocation/0001/StorageLocation?$top=1&$format=json&sap-client={CLIENT}', 分类: '主数据', 名称: '库存地点 V4', 场景: 'SAP_COM_0087', 方法: 'GET', 协议: 'OData V4/JSON' },

  // --- Phase 3: 被阻塞端点 (需 SAP Communication Arrangement) ---
  { key: 'purchase_requisition_v4', category: '采购', name: '采购申请 V4', scenario: 'SAP_COM_0102', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_purchaserequisition_2/srvd_a2x/sap/purchaserequisition/0001/PurchaseReqn?$top=1&$format=json&sap-client={CLIENT}', note: 'API_PURCHASEREQUISITION_2', 分类: '采购', 名称: '采购申请 V4', 场景: 'SAP_COM_0102', 方法: 'GET', 协议: 'OData V4/JSON', 备注: 'API_PURCHASEREQUISITION_2' },
  { key: 'purchase_requisition_item_v4', category: '采购', name: '采购申请行 V4', scenario: 'SAP_COM_0102', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_purchaserequisition_2/srvd_a2x/sap/purchaserequisition/0001/PurchaseReqnItem?$top=1&$format=json&sap-client={CLIENT}', note: 'API_PURCHASEREQUISITION_2', 分类: '采购', 名称: '采购申请行 V4', 场景: 'SAP_COM_0102', 方法: 'GET', 协议: 'OData V4/JSON', 备注: 'API_PURCHASEREQUISITION_2' },
  { key: 'schedule_agreement_v4', category: '采购', name: '计划协议 V4', scenario: 'SAP_COM_0103', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_schedagreement/srvd_a2x/sap/schedagreement/0001/A_SchedgAgrmt?$top=1&$format=json&sap-client={CLIENT}', note: '需开通SAP_COM_0103', 分类: '采购', 名称: '计划协议 V4', 场景: 'SAP_COM_0103', 方法: 'GET', 协议: 'OData V4/JSON', 备注: '需开通SAP_COM_0103' },
  { key: 'schedule_agreement_item_v4', category: '采购', name: '计划协议行 V4', scenario: 'SAP_COM_0103', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_schedagreement/srvd_a2x/sap/schedagreement/0001/A_SchedgAgrmtItem?$top=1&$format=json&sap-client={CLIENT}', note: '需开通SAP_COM_0103', 分类: '采购', 名称: '计划协议行 V4', 场景: 'SAP_COM_0103', 方法: 'GET', 协议: 'OData V4/JSON', 备注: '需开通SAP_COM_0103' },
  { key: 'sales_contract_v4', category: '销售', name: '销售合同 V4', scenario: 'SAP_COM_0119', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_salescontract/srvd_a2x/sap/salescontract/0001/SalesContract?$top=1&$format=json&sap-client={CLIENT}', note: '需开通SAP_COM_0119', 分类: '销售', 名称: '销售合同 V4', 场景: 'SAP_COM_0119', 方法: 'GET', 协议: 'OData V4/JSON', 备注: '需开通SAP_COM_0119' },
  { key: 'sales_contract_item_v4', category: '销售', name: '销售合同行 V4', scenario: 'SAP_COM_0119', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_salescontract/srvd_a2x/sap/salescontract/0001/SalesContractItem?$top=1&$format=json&sap-client={CLIENT}', note: '需开通SAP_COM_0119', 分类: '销售', 名称: '销售合同行 V4', 场景: 'SAP_COM_0119', 方法: 'GET', 协议: 'OData V4/JSON', 备注: '需开通SAP_COM_0119' },
  { key: 'bom_item_v2', category: '生产', name: 'BOM行项目 V2', scenario: 'API_BILL_OF_MATERIAL_SRV', method: 'GET', protocol: 'OData V2/JSON', pathTemplate: '/sap/opu/odata/sap/API_BILL_OF_MATERIAL_SRV;v=0002/A_BillOfMaterialItem?$top=1&$format=json&sap-client={CLIENT}', note: '需开通BOM服务', 分类: '生产', 名称: 'BOM行项目 V2', 场景: 'API_BILL_OF_MATERIAL_SRV', 方法: 'GET', 协议: 'OData V2/JSON', 备注: '需开通BOM服务' },
  { key: 'bom_header_v2', category: '生产', name: 'BOM抬头 V2', scenario: 'API_BILL_OF_MATERIAL_SRV', method: 'GET', protocol: 'OData V2/JSON', pathTemplate: '/sap/opu/odata/sap/API_BILL_OF_MATERIAL_SRV;v=0002/A_BillOfMaterial?$top=1&$format=json&sap-client={CLIENT}', note: '需开通BOM服务', 分类: '生产', 名称: 'BOM抬头 V2', 场景: 'API_BILL_OF_MATERIAL_SRV', 方法: 'GET', 协议: 'OData V2/JSON', 备注: '需开通BOM服务' },
  { key: 'material_reservation_v4', category: '库存', name: '预留 V4', scenario: 'SAP_COM_0225', method: 'GET', protocol: 'OData V4/JSON', pathTemplate: '/sap/opu/odata4/sap/api_reservationdocument/srvd_a2x/sap/reservationdocument/0001/ReservationDocumentItem?$top=1&$format=json&sap-client={CLIENT}', note: '需开通预留服务', 分类: '库存', 名称: '预留 V4', 场景: 'SAP_COM_0225', 方法: 'GET', 协议: 'OData V4/JSON', 备注: '需开通预留服务' },
];

function resolvePath(endpoint, client = DEFAULT_CLIENT) {
  if (!endpoint || !endpoint.pathTemplate) return undefined;
  return endpoint.pathTemplate.replace(/{CLIENT}/g, client);
}

function listScenarios(client = DEFAULT_CLIENT) {
  return ENDPOINTS.map((ep) => ({
    key: ep.key,
    category: ep.category,
    name: ep.name,
    scenario: ep.scenario,
    method: ep.method,
    protocol: ep.protocol,
    baseUrl: resolvePath(ep, client),
    note: ep.note || undefined,
  }));
}

function getEndpointByKey(key) {
  return ENDPOINTS.find((ep) => ep.key === key);
}

function getEndpointsByScenario(scenario) {
  return ENDPOINTS.filter((ep) => ep.scenario === scenario);
}

module.exports = {
  ENDPOINTS,
  resolvePath,
  listScenarios,
  getEndpointByKey,
  getEndpointsByScenario,
};
