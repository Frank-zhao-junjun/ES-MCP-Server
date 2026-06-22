const { sapGet, config } = require('../mcp-sap-core');

/**
 * Extract result array from OData response regardless of V2 ({ d: { results } })
 * or V4 ({ value }).
 */
function extractResults(data) {
  if (data && typeof data === 'object') {
    if (Array.isArray(data.value)) return data.value;
    if (data.d && Array.isArray(data.d.results)) return data.d.results;
    if (data.d && typeof data.d === 'object') return [data.d];
  }
  return data;
}

function buildQuery(params) {
  const qs = new URLSearchParams();
  if (params.$filter) qs.set('$filter', params.$filter);
  if (params.$top !== undefined) qs.set('$top', String(params.$top));
  if (params.$format !== undefined) qs.set('$format', params.$format || 'json');
  if (params.$expand !== undefined) qs.set('$expand', params.$expand);
  if (params.$select !== undefined) qs.set('$select', params.$select);
  // Always include sap-client unless explicitly omitted
  if (params.sapClient !== false) qs.set('sap-client', params.sapClient || config.client);
  return qs.toString();
}

function makeUrl(servicePath, params = {}) {
  const qs = buildQuery(params);
  return `${servicePath}${qs ? `?${qs}` : ''}`;
}

function singleKeyUrl(servicePath, keyName, keyValue, params = {}) {
  return makeUrl(`${servicePath}(${keyName}='${keyValue}')`, params);
}

function toMcpResult(result) {
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}

function toMcpError(message) {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

async function healthCheck(args = {}) {
  const { includeSapCheck = true, includeScenarios = false } = args;
  const checks = {
    mcp: 'ok',
    version: '0.1.0',
    time: new Date().toISOString(),
  };

  if (includeSapCheck) {
    const url = `/sap/opu/odata/sap/API_PRODUCT_SRV/A_Product?$top=1&$format=json&sap-client=${config.client}`;
    const resp = await sapGet(url);
    checks.sap = resp.ok ? { status: resp.status, ok: true } : { status: resp.status, ok: false, error: resp.error };
  }

  if (includeScenarios) {
    checks.scenarios = 33; // Known count from Probe_Latest.json; will be dynamic in Phase 2
  }

  return toMcpResult(checks);
}

async function getProduct(args = {}) {
  const { product, filter, top = 10 } = args;
  let url;
  if (product) {
    url = singleKeyUrl('/sap/opu/odata/sap/API_PRODUCT_SRV/A_Product', 'Product', product, { $format: 'json' });
  } else {
    const $filter = filter || undefined;
    url = makeUrl('/sap/opu/odata/sap/API_PRODUCT_SRV/A_Product', { $filter, $top: top, $format: 'json' });
  }
  const resp = await sapGet(url);
  if (!resp.ok) return toMcpError(JSON.stringify(resp.error));
  return toMcpResult({ results: extractResults(resp.data) });
}

async function getBusinessPartner(args = {}) {
  const { customer, supplier, filter, top = 10 } = args;
  let service;
  let keyName;
  let keyValue;

  if (customer) {
    service = '/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_Customer';
    keyName = 'Customer';
    keyValue = customer;
  } else if (supplier) {
    service = '/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_Supplier';
    keyName = 'Supplier';
    keyValue = supplier;
  } else {
    service = '/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_Customer';
  }

  let url;
  if (keyValue) {
    url = singleKeyUrl(service, keyName, keyValue, { $format: 'json' });
  } else {
    url = makeUrl(service, { $filter: filter, $top: top, $format: 'json' });
  }

  const resp = await sapGet(url);
  if (!resp.ok) return toMcpError(JSON.stringify(resp.error));
  return toMcpResult({ results: extractResults(resp.data) });
}

async function getSalesOrderStatus(args = {}) {
  const { salesOrder, includeItems = false, top = 10 } = args;
  const base = '/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001';
  let url;
  const expand = includeItems ? 'to_Item' : undefined;

  if (salesOrder) {
    url = singleKeyUrl(`${base}/SalesOrder`, 'SalesOrder', salesOrder, { $format: 'json', $expand: expand, sapClient: false });
  } else {
    url = makeUrl(`${base}/SalesOrder`, { $top: top, $format: 'json', $expand: expand, sapClient: false });
  }

  const resp = await sapGet(url);
  if (!resp.ok) return toMcpError(JSON.stringify(resp.error));
  return toMcpResult({ results: extractResults(resp.data) });
}

async function getPurchaseOrder(args = {}) {
  const {
    purchaseOrder,
    includeItems = false,
    includeSchedule = false,
    includePricing = false,
    includeNotes = false,
    top = 10,
  } = args;

  const base = '/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001';
  const expandParts = [];
  if (includeItems) expandParts.push('to_PurchaseOrderItem');
  if (includeSchedule) expandParts.push('to_PurchaseOrderScheduleLine');
  if (includePricing) expandParts.push('to_PurOrderItemPricingElement');
  if (includeNotes) expandParts.push('to_PurchaseOrderNote');
  const $expand = expandParts.length ? expandParts.join(',') : undefined;

  let url;
  if (purchaseOrder) {
    url = singleKeyUrl(`${base}/PurchaseOrder`, 'PurchaseOrder', purchaseOrder, {
      $format: 'json',
      $expand,
      sapClient: false,
    });
  } else {
    url = makeUrl(`${base}/PurchaseOrder`, { $top: top, $format: 'json', $expand, sapClient: false });
  }

  const resp = await sapGet(url);
  if (!resp.ok) return toMcpError(JSON.stringify(resp.error));
  return toMcpResult({ results: extractResults(resp.data) });
}

async function getMaterialStock(args = {}) {
  const { material, plant, filter, top = 10 } = args;
  let $filter = filter;
  if (material && !$filter) {
    $filter = `Material eq '${material}'`;
  }
  if (plant && !$filter) {
    $filter = `Plant eq '${plant}'`;
  } else if (plant && $filter) {
    $filter += ` and Plant eq '${plant}'`;
  }

  const url = makeUrl('/sap/opu/odata/sap/API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod', {
    $filter,
    $top: top,
    $format: 'json',
  });

  const resp = await sapGet(url);
  if (!resp.ok) return toMcpError(JSON.stringify(resp.error));
  return toMcpResult({ results: extractResults(resp.data) });
}

async function getSupplierInvoice(args = {}) {
  const { invoice, fiscalYear, includeLines = false } = args;
  const base = '/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV';

  let headerUrl;
  if (invoice && fiscalYear) {
    headerUrl = `${base}/A_SupplierInvoice(SupplierInvoice='${invoice}',FiscalYear='${fiscalYear}')?$format=json&sap-client=${config.client}`;
  } else {
    headerUrl = `${base}/A_SupplierInvoice?$top=10&$format=json&sap-client=${config.client}`;
  }

  const header = await sapGet(headerUrl);
  if (!header.ok) return toMcpError(JSON.stringify(header.error));

  const result = {
    header: extractResults(header.data),
  };

  if (includeLines && invoice && fiscalYear) {
    const lineUrl = `${base}/A_SuplrInvcItemPurOrdRef?$filter=SupplierInvoice eq '${invoice}' and FiscalYear eq '${fiscalYear}'&$format=json&sap-client=${config.client}`;
    const lines = await sapGet(lineUrl);
    result.lines = lines.ok ? extractResults(lines.data) : lines.error;
  }

  return toMcpResult(result);
}

async function getCostCenter(args = {}) {
  const { costCenter, companyCode, filter, top = 10 } = args;
  const base = '/sap/opu/odata4/sap/api_cost_center/srvd_a2x/sap/costcenter/0001';

  let url;
  if (costCenter) {
    const ccFilter = companyCode ? `CompanyCode eq '${companyCode}'` : undefined;
    url = singleKeyUrl(`${base}/A_CostCenter_2`, 'CostCenter', costCenter, {
      $format: 'json',
      $filter: ccFilter,
      sapClient: false,
    });
  } else {
    let $filter = filter;
    if (companyCode && !$filter) $filter = `CompanyCode eq '${companyCode}'`;
    else if (companyCode && $filter) $filter += ` and CompanyCode eq '${companyCode}'`;
    url = makeUrl(`${base}/A_CostCenter_2`, { $filter, $top: top, $format: 'json', sapClient: false });
  }

  const resp = await sapGet(url);
  if (!resp.ok) return toMcpError(JSON.stringify(resp.error));
  return toMcpResult({ results: extractResults(resp.data) });
}

module.exports = {
  healthCheck,
  getProduct,
  getBusinessPartner,
  getSalesOrderStatus,
  getPurchaseOrder,
  getMaterialStock,
  getSupplierInvoice,
  getCostCenter,
};
