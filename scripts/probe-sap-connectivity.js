#!/usr/bin/env node
/**
 * Quick SAP connectivity probe for ES 接口 project.
 * Usage: node scripts/probe-sap-connectivity.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const USER_FILE = process.env.SAP_CREDENTIALS_FILE || path.join(ROOT, 'user.txt');
const BASE = process.env.SAP_BASE_URL || 'https://my200967-api.s4hana.sapcloud.cn';
const CLIENT = process.env.SAP_CLIENT || '100';

function parseCredentials(text) {
  const users = [
    ...text.matchAll(/User Name:\s*([^\s\r\n]+)/gi),
    ...text.matchAll(/User ID:\s*([^\s\r\n]+)/gi),
    ...text.matchAll(/(?:接口调用的)?通信用户[：:]\s*([^\s\r\n]+)/gi),
  ].map((m) => m[1].trim());
  const passwords = [
    ...text.matchAll(/密码[：:]\s*([^\s\r\n]+)/g),
    ...text.matchAll(/或者这个[：:]\s*([^\s\r\n]+)/g),
    ...text.matchAll(/^Password(?:Alt)?:\s*(.+)$/gim),
  ].map((m) => m[1].trim());
  return {
    users: [...new Set(users)],
    passwords: [...new Set(passwords)],
  };
}

const SI_V2 = `/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV`;

const ENDPOINTS = [
  // --- 原有 8 项 ---
  { 分类: 'SAP上游', 名称: '产品主数据 V2', 场景: 'SAP_COM_0009', 方法: 'GET', 协议: 'OData V2/JSON', 路径: `/sap/opu/odata/sap/API_PRODUCT_SRV/A_Product?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'SAP上游', 名称: '客户主数据 V2', 场景: 'SAP_COM_0008', 方法: 'GET', 协议: 'OData V2/JSON', 路径: `/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_Customer?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'SAP上游', 名称: '销售订单 V4', 场景: 'SAP_COM_0109', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrder?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'SAP上游', 名称: '生产订单 V4', 场景: 'SAP_COM_0104', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_productionorder/srvd_a2x/sap/productionorder/0001/ProductionOrder?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'SAP上游', 名称: '外向交货 V2', 场景: 'SAP_COM_0106', 方法: 'GET', 协议: 'OData V2/JSON', 路径: `/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002/A_OutbDeliveryHeader?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'SAP上游', 名称: '开票 V2', 场景: 'SAP_COM_0124', 方法: 'GET', 协议: 'OData V2/JSON', 路径: `/sap/opu/odata/sap/API_BILLING_DOCUMENT_SRV/A_BillingDocument?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'SAP上游', 名称: '物料库存 V2', 场景: 'SAP_COM_0164', 方法: 'GET', 协议: 'OData V2/JSON', 路径: `/sap/opu/odata/sap/API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'SAP上游', 名称: '采购订单 V2', 场景: 'legacy', 方法: 'GET', 协议: 'OData V2/JSON', 路径: `/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder?$top=1&$format=json&sap-client=${CLIENT}` },

  // --- 扩展：产品 / 业务伙伴 ---
  { 分类: 'SAP上游', 名称: '产品主数据 V4', 场景: 'SAP_COM_0009', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_product/srvd_a2x/sap/product/0002/Product?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'SAP上游', 名称: '物料组 ProductGroup V4', 场景: 'SAP_COM_0009', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_productgroup_2/srvd_a2x/sap/productgroup/0001/ProductGroup?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'SAP上游', 名称: '供应商 V2', 场景: 'SAP_COM_0008', 方法: 'GET', 协议: 'OData V2/JSON', 路径: `/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_Supplier?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'SAP上游', 名称: '供应商公司 V2', 场景: 'SAP_COM_0008', 方法: 'GET', 协议: 'OData V2/JSON', 路径: `/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_SupplierCompany?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'SAP上游', 名称: '物料凭证 V2', 场景: 'SAP_COM_0108', 方法: 'GET', 协议: 'OData V2/JSON', 路径: `/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/A_MaterialDocumentHeader?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'SAP上游', 名称: '成本中心 V4', 场景: 'SAP_COM_0008', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_cost_center/srvd_a2x/sap/costcenter/0001/A_CostCenter_2?$top=1&$format=json&sap-client=${CLIENT}` },

  // --- 扩展：采购订单 V4 (EPC / SAP_COM_0053) ---
  { 分类: 'EPC采购', 名称: '采购订单抬头 V4', 场景: 'SAP_COM_0053', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/PurchaseOrder?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'EPC采购', 名称: '采购订单行 V4', 场景: 'SAP_COM_0053', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/PurchaseOrderItem?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'EPC采购', 名称: '采购计划行 V4', 场景: 'SAP_COM_0053', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/PurchaseOrderScheduleLine?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'EPC采购', 名称: '采购行定价 V4', 场景: 'SAP_COM_0053', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/PurOrderItemPricingElement?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'EPC采购', 名称: '采购抬头备注 V4', 场景: 'SAP_COM_0053', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/PurchaseOrderNote?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'EPC采购', 名称: '采购行备注 V4', 场景: 'SAP_COM_0053', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/PurchaseOrderItemNote?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: 'EPC采购', 名称: '委外组件 V4', 场景: 'SAP_COM_0053', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/POSubcontractingComponent?$top=1&$format=json&sap-client=${CLIENT}` },

  // --- 供应商发票：V2 可用 (legacy)；V4 需 SAP_COM_0054 ---
  { 分类: 'EPC应付', 名称: '供应商发票列表 V2', 场景: 'legacy(V2可用)', 方法: 'GET', 协议: 'OData V2/JSON', 路径: `${SI_V2}/A_SupplierInvoice?$top=1&$format=json&sap-client=${CLIENT}`, 读取示例: `GET ${BASE}${SI_V2}/A_SupplierInvoice?$top=50&$format=json&sap-client=${CLIENT}`, 备注: '列表；V4需SAP_COM_0054' },
  { 分类: 'EPC应付', 名称: '供应商发票单张 V2', 场景: 'legacy(V2可用)', 方法: 'GET', 协议: 'OData V2/JSON', 路径: `${SI_V2}/A_SupplierInvoice(SupplierInvoice='5105600101',FiscalYear='2025')?$format=json&sap-client=${CLIENT}`, 读取示例: `GET ${BASE}${SI_V2}/A_SupplierInvoice(SupplierInvoice='{Invoice}',FiscalYear='{Year}')?$format=json&sap-client=${CLIENT}`, 备注: '示例5105600101/2025' },
  { 分类: 'EPC应付', 名称: '供应商发票行(PO参考) V2', 场景: 'legacy(V2可用)', 方法: 'GET', 协议: 'OData V2/JSON', 路径: `${SI_V2}/A_SuplrInvcItemPurOrdRef?$filter=SupplierInvoice eq '5105600101' and FiscalYear eq '2025'&$top=1&$format=json&sap-client=${CLIENT}`, 读取示例: `GET ${BASE}${SI_V2}/A_SuplrInvcItemPurOrdRef?$filter=SupplierInvoice eq '{Invoice}' and FiscalYear eq '{Year}'&$format=json&sap-client=${CLIENT}`, 备注: '实体A_SuplrInvcItemPurOrdRef' },
  { 分类: 'EPC应付', 名称: '供应商发票抬头 V4', 场景: 'SAP_COM_0054', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_supplierinvoice/srvd_a2x/sap/supplierinvoice/0001/SupplierInvoice?$top=1&$format=json&sap-client=${CLIENT}`, 备注: '需开通Arrangement' },
  { 分类: 'EPC应付', 名称: '供应商发票行(PO参考) V4', 场景: 'SAP_COM_0054', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_supplierinvoice/srvd_a2x/sap/supplierinvoice/0001/SuplrInvcItemPurOrdRef?$top=1&$format=json&sap-client=${CLIENT}`, 备注: '需开通Arrangement' },
  { 分类: 'EPC应付', 名称: '供应商发票税 V4', 场景: 'SAP_COM_0054', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_supplierinvoice/srvd_a2x/sap/supplierinvoice/0001/SupplierInvoiceTax?$top=1&$format=json&sap-client=${CLIENT}`, 备注: '需开通Arrangement' },

  // --- 扩展：主数据 (SAP_COM_0087 等，预期部分 403) ---
  { 分类: '主数据', 名称: '付款条件 V4', 场景: 'SAP_COM_0087', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_paymentterms/srvd_a2x/sap/paymentterms/0001/PaymentTerms?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: '主数据', 名称: '工厂 V4', 场景: 'SAP_COM_0087', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_plant/srvd_a2x/sap/plant/0001/Plant?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: '主数据', 名称: '采购组织 V4', 场景: 'SAP_COM_0087', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_purchasingorganization/srvd_a2x/sap/purchasingorganization/0001/A_PurchasingOrganization?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: '主数据', 名称: '采购组 V4', 场景: 'SAP_COM_0087', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_purchasinggroup/srvd_a2x/sap/purchasinggroup/0001/A_PurchasingGroup?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: '主数据', 名称: '公司代码 V4', 场景: 'SAP_COM_0087', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_companycode/srvd_a2x/sap/companycode/0001/CompanyCode?$top=1&$format=json&sap-client=${CLIENT}` },
  { 分类: '主数据', 名称: '库存地点 V4', 场景: 'SAP_COM_0087', 方法: 'GET', 协议: 'OData V4/JSON', 路径: `/sap/opu/odata4/sap/api_storagelocation/srvd_a2x/sap/storagelocation/0001/StorageLocation?$top=1&$format=json&sap-client=${CLIENT}` },
];

async function probe(url, user, password) {
  const auth = Buffer.from(`${user}:${password}`, 'utf8').toString('base64');
  const resp = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'sap-client': CLIENT,
    },
    signal: AbortSignal.timeout(25000),
  });
  return resp.status;
}

async function main() {
  const text = fs.readFileSync(USER_FILE, 'utf8');
  const { users, passwords } = parseCredentials(text);
  if (!users.length || !passwords.length) {
    console.error('No credentials parsed from', USER_FILE);
    process.exit(1);
  }

  const results = [];
  for (const ep of ENDPOINTS) {
    const url = `${BASE}${ep.路径}`;
    let status = 0;
    let note = 'FAIL';
    let credUsed = '';

    for (const user of users) {
      for (const password of passwords) {
        try {
          status = await probe(url, user, password);
          if (status >= 200 && status < 300) {
            note = 'OK';
            credUsed = user;
            break;
          }
        } catch (err) {
          status = 0;
          note = err.message || 'ERR';
        }
      }
      if (note === 'OK') break;
    }

    const result = {
      分类: ep.分类,
      通信场景: ep.场景 || '',
      接口名称: ep.名称,
      方法: ep.方法,
      接口地址: url,
      协议: ep.协议,
      鉴权: 'Basic Auth + sap-client',
      连通性: note === 'OK' ? `OK(${status})` : `FAIL(${status || note})`,
      备注: ep.备注
        ? (credUsed ? `${ep.备注}; user=${credUsed}` : ep.备注)
        : credUsed
          ? `user=${credUsed}`
          : status === 403
            ? '需开通 Communication Arrangement'
            : status === 404
              ? '服务路径或实体不存在'
              : 'all credential combos failed',
    };
    if (ep.读取示例) result.读取示例 = ep.读取示例;
    results.push(result);
  }

  const out = path.join(ROOT, 'Probe_Latest.json');
  fs.writeFileSync(out, JSON.stringify(results, null, 2), 'utf8');
  console.log(JSON.stringify(results, null, 2));
  console.error('Wrote', out);

  const ok = results.filter((r) => r.连通性.startsWith('OK'));
  const fail403 = results.filter((r) => r.连通性.includes('403'));
  const fail404 = results.filter((r) => r.连通性.includes('404'));
  console.error(`\n--- 汇总 ---`);
  console.error(`总计 ${results.length} | OK ${ok.length} | 403 ${fail403.length} | 404 ${fail404.length} | 其他 ${results.length - ok.length - fail403.length - fail404.length}`);

  const allFailed = results.every((r) => !r.连通性.startsWith('OK'));
  if (allFailed) {
    console.error('\n--- 诊断 ---');
    console.error(`凭证文件: ${USER_FILE}`);
    console.error(`用户: ${users.join(', ')}`);
    console.error(`密码数量: ${passwords.length}（长度: ${passwords.map((p) => p.length).join(', ')}）`);
    console.error('全部组合均 401 → SAP 拒绝登录（密码错误或用户被锁）');
    console.error('请在 Fiori 打开 Maintain Communication Users → 解锁 EPC_USER → 重置密码');
    console.error('然后更新 user.txt 的 Password: 行，再重新运行本脚本。');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
