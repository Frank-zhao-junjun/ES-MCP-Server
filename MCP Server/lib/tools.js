const path = require('path');
const { sapGet, sapGetEntitySchema, config } = require('../mcp-sap-core');
const { ENDPOINTS, resolvePath, getEndpointByKey, listScenarios } = require('./sap-endpoints');

const { version: PACKAGE_VERSION } = require(path.join(__dirname, '..', 'package.json'));

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

/**
 * Split OData $expand line items into a top-level `items` array (§6.1.5).
 */
function splitExpandedLineItems(records, expandProp) {
  const rows = Array.isArray(records) ? records : records == null ? [] : [records];
  const results = [];
  const items = [];

  for (const record of rows) {
    if (!record || typeof record !== 'object') {
      results.push(record);
      continue;
    }
    const header = { ...record };
    const expanded = header[expandProp];
    delete header[expandProp];

    if (Array.isArray(expanded)) {
      items.push(...expanded);
    } else if (expanded && typeof expanded === 'object') {
      items.push(expanded);
    }

    results.push(header);
  }

  return { results, items };
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
    version: PACKAGE_VERSION,
    time: new Date().toISOString(),
  };

  if (includeSapCheck) {
    const url = `/sap/opu/odata/sap/API_PRODUCT_SRV/A_Product?$top=1&$format=json&sap-client=${config.client}`;
    const resp = await sapGet(url);
    checks.sap = resp.ok ? { status: resp.status, ok: true } : { status: resp.status, ok: false, error: resp.error };
  }

  if (includeScenarios) {
    checks.scenarios = listScenarios(config.client).length;
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
  const records = extractResults(resp.data);
  if (includeItems) {
    const { results, items } = splitExpandedLineItems(records, 'to_Item');
    return toMcpResult({ results, items });
  }
  return toMcpResult({ results: records });
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
  const PO_ITEM_EXPAND = '_PurchaseOrderItem';
  const expandParts = [];
  if (includeItems) expandParts.push(PO_ITEM_EXPAND);
  if (includeSchedule) expandParts.push('_PurchaseOrderScheduleLine');
  if (includePricing) expandParts.push('_PurOrderItemPricingElement');
  if (includeNotes) expandParts.push('_PurchaseOrderNote');
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
  const records = extractResults(resp.data);

  if (includeItems) {
    let { results, items } = splitExpandedLineItems(records, PO_ITEM_EXPAND);
    if (!items.length && purchaseOrder) {
      const itemUrl = makeUrl(`${base}/PurchaseOrderItem`, {
        $filter: `PurchaseOrder eq '${purchaseOrder}'`,
        $format: 'json',
        sapClient: false,
      });
      const itemResp = await sapGet(itemUrl);
      if (itemResp.ok) items = extractResults(itemResp.data);
    }
    return toMcpResult({ results, items });
  }
  return toMcpResult({ results: records });
}

async function getMaterialStock(args = {}) {
  const { material, plant, filter, top = 10 } = args;
  let $filter = filter;
  if (material && !$filter) {
    $filter = `Material eq '${material}'`;
  } else if (material && $filter) {
    $filter += ` and Material eq '${material}'`;
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
  const year = fiscalYear || String(new Date().getFullYear());

  let headerUrl;
  if (invoice) {
    headerUrl = `${base}/A_SupplierInvoice(SupplierInvoice='${invoice}',FiscalYear='${year}')?$format=json&sap-client=${config.client}`;
  } else {
    headerUrl = `${base}/A_SupplierInvoice?$top=10&$format=json&sap-client=${config.client}`;
  }

  const header = await sapGet(headerUrl);
  if (!header.ok) return toMcpError(JSON.stringify(header.error));

  const result = {
    header: extractResults(header.data),
  };

  if (includeLines && invoice) {
    const lineUrl = `${base}/A_SuplrInvcItemPurOrdRef?$filter=SupplierInvoice eq '${invoice}' and FiscalYear eq '${year}'&$format=json&sap-client=${config.client}`;
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

// =============================================================================
// Phase 2 — Infra + cross-document tools
// =============================================================================

/**
 * Task 2.2 — Parse $metadata for a service/entity and return property list.
 */
async function getEntitySchema({ service, entity }) {
  if (!service || !entity) {
    return toMcpError(JSON.stringify({ error: 'MISSING_PARAMS', message: 'service and entity are required' }));
  }

  const servicePath = service.startsWith('/sap/') ? service : `/sap/opu/odata/sap/${service}`;
  const resp = await sapGetEntitySchema(servicePath, entity);
  if (!resp.ok) return toMcpError(JSON.stringify(resp.error));

  return toMcpResult({
    service,
    entity,
    properties: resp.properties,
    count: resp.properties.length,
  });
}

/**
 * Task 2.3 — Return the built-in SAP scenario/endpoint table (≥33 entries).
 */
async function listSapScenarios() {
  const scenarios = listScenarios(config.client);
  return toMcpResult({ count: scenarios.length, scenarios });
}

/**
 * Task 2.4 — Dynamic GET by scenario key with optional entity/filter/top.
 */
async function querySapScenario({ key, filter, top, entity }) {
  if (!key) {
    return toMcpError(JSON.stringify({ error: 'MISSING_PARAMS', message: 'key is required' }));
  }

  const ep = getEndpointByKey(key);
  if (!ep) {
    return toMcpError(JSON.stringify({ error: 'SCENARIO_NOT_FOUND', message: `No scenario found for key: ${key}` }));
  }

  let path = resolvePath(ep, config.client);
  if (!path) {
    return toMcpError(JSON.stringify({ error: 'INVALID_SCENARIO', message: 'Scenario has no resolvable path' }));
  }

  // Allow overriding entity segment for flexible queries
  if (entity) {
    const qIdx = path.indexOf('?');
    if (qIdx !== -1) {
      const baseSeg = path.substring(0, qIdx);
      const lastSlash = baseSeg.lastIndexOf('/');
      path = `${baseSeg.substring(0, lastSlash + 1)}${entity}${path.substring(qIdx)}`;
    } else {
      const lastSlash = path.lastIndexOf('/');
      path = `${path.substring(0, lastSlash + 1)}${entity}`;
    }
  }

  const urlObj = new URL(path, 'http://localhost');
  const params = urlObj.searchParams;
  if (filter !== undefined) params.set('$filter', filter);
  if (top !== undefined) params.set('$top', String(top));
  path = `${urlObj.pathname}?${params.toString()}`;

  const resp = await sapGet(path);
  if (!resp.ok) return toMcpError(JSON.stringify(resp.error));

  return toMcpResult({
    key,
    entity,
    results: extractResults(resp.data),
  });
}

/**
 * Task 2.5 — Best-effort trace: SalesOrder → OutboundDelivery → BillingDocument → MaterialDocument.
 */
async function traceSalesOrder({ salesOrder }) {
  if (!salesOrder) {
    return toMcpError(JSON.stringify({ error: 'MISSING_PARAMS', message: 'salesOrder is required' }));
  }

  const trace = {
    salesOrder,
    legs: [],
  };

  // 1. Sales Order header
  const soResp = await sapGet(
    `/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrder('${salesOrder}')?$format=json`
  );
  trace.legs.push({ step: 'SalesOrder', ok: soResp.ok, status: soResp.status, error: soResp.error?.error });
  if (!soResp.ok) return toMcpResult(trace);

  // 2. Outbound delivery references (best-effort via V2 header)
  const odResp = await sapGet(
    `/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002/A_OutbDeliveryHeader?$filter=ReferenceSDDocument eq '${salesOrder}'&$top=10&$format=json`
  );
  trace.legs.push({ step: 'OutboundDelivery', ok: odResp.ok, status: odResp.status, count: extractResults(odResp.data).length, error: odResp.error?.error });

  // 3. Billing documents referencing the SO
  const billingResp = await sapGet(
    `/sap/opu/odata/sap/API_BILLING_DOCUMENT_SRV/A_BillingDocument?$filter=ReferenceSDDocument eq '${salesOrder}'&$top=10&$format=json`
  );
  trace.legs.push({ step: 'BillingDocument', ok: billingResp.ok, status: billingResp.status, count: extractResults(billingResp.data).length, error: billingResp.error?.error });

  // 4. Material documents ( Goods Movement ) — broad filter on ReferenceDocument
  const matDocResp = await sapGet(
    `/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/A_MaterialDocumentHeader?$filter=ReferenceDocument eq '${salesOrder}'&$top=10&$format=json`
  );
  trace.legs.push({ step: 'MaterialDocument', ok: matDocResp.ok, status: matDocResp.status, count: extractResults(matDocResp.data).length, error: matDocResp.error?.error });

  return toMcpResult(trace);
}

/**
 * Task 2.7 — Validate API key. Useful for clients before calling protected tools.
 */
async function authenticate({ apiKey }) {
  if (!apiKey) {
    return toMcpError(JSON.stringify({ error: 'MISSING_API_KEY', message: 'apiKey is required' }));
  }
  if (apiKey !== config.apiKey) {
    return toMcpError(JSON.stringify({ error: 'INVALID_API_KEY', message: 'Provided API key is invalid' }));
  }
  return toMcpResult({ success: true, message: 'API key valid' });
}

// =============================================================================
// Phase 3 — Blocked / arrangement-dependent tools
// =============================================================================

/**
 * Task 3.1 — Purchase Requisition (SAP_COM_0102, API_PURCHASEREQUISITION_2)
 */
async function getPurchaseRequisition(args = {}) {
  const { purchaseRequisition, includeItems = false, filter, top = 10 } = args;
  const base = '/sap/opu/odata4/sap/api_purchaserequisition_2/srvd_a2x/sap/purchaserequisition/0001';
  const entity = 'PurchaseReqn';
  const keyField = 'PurchaseRequisition';

  let url;
  if (purchaseRequisition) {
    url = singleKeyUrl(`${base}/${entity}`, keyField, purchaseRequisition, {
      $format: 'json',
      sapClient: false,
    });
  } else {
    url = makeUrl(`${base}/${entity}`, { $filter: filter, $top: top, $format: 'json', sapClient: false });
  }

  const resp = await sapGet(url);
  if (!resp.ok) {
    return toMcpError(JSON.stringify({
      ...resp.error,
      hint: 'This endpoint requires SAP_COM_0102 (API_PURCHASEREQUISITION_2). Ask Basis to open the Communication Arrangement.',
    }));
  }

  const records = extractResults(resp.data);
  if (includeItems) {
    let items = [];
    if (purchaseRequisition) {
      const itemUrl = makeUrl(`${base}/PurchaseReqnItem`, {
        $filter: `${keyField} eq '${purchaseRequisition}'`,
        $format: 'json',
        sapClient: false,
      });
      const itemResp = await sapGet(itemUrl);
      if (itemResp.ok) items = extractResults(itemResp.data);
    }
    return toMcpResult({ results: records, items });
  }
  return toMcpResult({ results: records });
}

/**
 * Task 3.2 — Scheduling Agreement (SAP_COM_0103, V4)
 */
async function getScheduleAgreement(args = {}) {
  const { schedulingAgreement, includeItems = false, filter, top = 10 } = args;
  const base = '/sap/opu/odata4/sap/api_schedagreement/srvd_a2x/sap/schedagreement/0001';
  const expandParts = [];
  if (includeItems) expandParts.push('to_SchedgAgrmtItem');
  const $expand = expandParts.length ? expandParts.join(',') : undefined;

  let url;
  if (schedulingAgreement) {
    url = singleKeyUrl(`${base}/A_SchedgAgrmt`, 'SchedulingAgreement', schedulingAgreement, {
      $format: 'json', $expand, sapClient: false,
    });
  } else {
    url = makeUrl(`${base}/A_SchedgAgrmt`, { $filter: filter, $top: top, $format: 'json', $expand, sapClient: false });
  }

  const resp = await sapGet(url);
  if (!resp.ok) {
    return toMcpError(JSON.stringify({
      ...resp.error,
      hint: 'This endpoint requires SAP_COM_0103 Communication Arrangement. Ask Basis to open it.',
    }));
  }
  return toMcpResult({ results: extractResults(resp.data) });
}

/**
 * Task 3.3 — Sales Contract (SAP_COM_0119, V4)
 */
async function getSalesContract(args = {}) {
  const { salesContract, includeItems = false, filter, top = 10 } = args;
  const base = '/sap/opu/odata4/sap/api_salescontract/srvd_a2x/sap/salescontract/0001';
  const expandParts = [];
  if (includeItems) expandParts.push('to_SalesContractItem');
  const $expand = expandParts.length ? expandParts.join(',') : undefined;

  let url;
  if (salesContract) {
    url = singleKeyUrl(`${base}/SalesContract`, 'SalesContract', salesContract, {
      $format: 'json', $expand, sapClient: false,
    });
  } else {
    url = makeUrl(`${base}/SalesContract`, { $filter: filter, $top: top, $format: 'json', $expand, sapClient: false });
  }

  const resp = await sapGet(url);
  if (!resp.ok) {
    return toMcpError(JSON.stringify({
      ...resp.error,
      hint: 'This endpoint requires SAP_COM_0119 Communication Arrangement. Ask Basis to open it.',
    }));
  }
  return toMcpResult({ results: extractResults(resp.data) });
}

/**
 * Task 3.4 — Bill of Material (API_BILL_OF_MATERIAL_SRV, V2)
 */
async function getBom(args = {}) {
  const { billOfMaterial, material, plant, filter, top = 10 } = args;
  const base = '/sap/opu/odata/sap/API_BILL_OF_MATERIAL_SRV;v=0002';

  let url;
  if (billOfMaterial) {
    url = singleKeyUrl(`${base}/A_BillOfMaterial`, 'BillOfMaterial', billOfMaterial, { $format: 'json' });
  } else {
    let $filter = filter;
    const parts = [];
    if (material) parts.push(`Material eq '${material}'`);
    if (plant) parts.push(`Plant eq '${plant}'`);
    if (parts.length && !$filter) $filter = parts.join(' and ');
    url = makeUrl(`${base}/A_BillOfMaterialItem`, { $filter, $top: top, $format: 'json' });
  }

  const resp = await sapGet(url);
  if (!resp.ok) {
    return toMcpError(JSON.stringify({
      ...resp.error,
      hint: 'This endpoint requires API_BILL_OF_MATERIAL_SRV Communication Arrangement. Ask Basis to open it.',
    }));
  }
  return toMcpResult({ results: extractResults(resp.data) });
}

/**
 * Task 3.5 — Material Reservation (V4)
 */
async function getMaterialReservation(args = {}) {
  const { reservation, material, plant, filter, top = 10 } = args;
  const base = '/sap/opu/odata4/sap/api_reservationdocument/srvd_a2x/sap/reservationdocument/0001';

  let url;
  if (reservation) {
    url = singleKeyUrl(`${base}/ReservationDocumentItem`, 'ReservationDocument', reservation, {
      $format: 'json', sapClient: false,
    });
  } else {
    let $filter = filter;
    const parts = [];
    if (material) parts.push(`Material eq '${material}'`);
    if (plant) parts.push(`Plant eq '${plant}'`);
    if (parts.length && !$filter) $filter = parts.join(' and ');
    url = makeUrl(`${base}/ReservationDocumentItem`, { $filter, $top: top, $format: 'json', sapClient: false });
  }

  const resp = await sapGet(url);
  if (!resp.ok) {
    return toMcpError(JSON.stringify({
      ...resp.error,
      hint: 'This endpoint requires Reservation Document V4 Communication Arrangement. Ask Basis to open it.',
    }));
  }
  return toMcpResult({ results: extractResults(resp.data) });
}

/**
 * Task 3.6 — Supplier Invoice V4 (SAP_COM_0054)
 */
async function getSupplierInvoiceV4(args = {}) {
  const { invoice, fiscalYear, includeLines = false, includeTax = false, filter, top = 10 } = args;
  const base = '/sap/opu/odata4/sap/api_supplierinvoice/srvd_a2x/sap/supplierinvoice/0001';

  const result = {};

  // Header
  let headerUrl;
  if (invoice && fiscalYear) {
    headerUrl = `${base}/SupplierInvoice(SupplierInvoice='${invoice}',FiscalYear='${fiscalYear}')?$format=json`;
  } else {
    headerUrl = makeUrl(`${base}/SupplierInvoice`, { $filter: filter, $top: top, $format: 'json', sapClient: false });
  }

  const headerResp = await sapGet(headerUrl);
  if (!headerResp.ok) {
    return toMcpError(JSON.stringify({
      ...headerResp.error,
      hint: 'This endpoint requires SAP_COM_0054 Communication Arrangement. Ask Basis to open it.',
    }));
  }
  result.header = extractResults(headerResp.data);

  // Lines
  if (includeLines && invoice && fiscalYear) {
    const lineUrl = makeUrl(`${base}/SuplrInvcItemPurOrdRef`, {
      $filter: `SupplierInvoice eq '${invoice}' and FiscalYear eq '${fiscalYear}'`,
      $format: 'json', sapClient: false,
    });
    const lineResp = await sapGet(lineUrl);
    result.lines = lineResp.ok ? extractResults(lineResp.data) : lineResp.error;
  }

  // Tax
  if (includeTax && invoice && fiscalYear) {
    const taxUrl = makeUrl(`${base}/SupplierInvoiceTax`, {
      $filter: `SupplierInvoice eq '${invoice}' and FiscalYear eq '${fiscalYear}'`,
      $format: 'json', sapClient: false,
    });
    const taxResp = await sapGet(taxUrl);
    result.tax = taxResp.ok ? extractResults(taxResp.data) : taxResp.error;
  }

  return toMcpResult(result);
}

/**
 * Task 3.7 — Master data helpers (SAP_COM_0087)
 * Supports: plant, payment_terms, purchasing_organization, purchasing_group, company_code, storage_location
 */
const MASTER_DATA_MAP = {
  plant: { path: '/sap/opu/odata4/sap/api_plant/srvd_a2x/sap/plant/0001/Plant', key: 'Plant' },
  payment_terms: { path: '/sap/opu/odata4/sap/api_paymentterms/srvd_a2x/sap/paymentterms/0001/PaymentTerms', key: 'PaymentTerms' },
  purchasing_organization: { path: '/sap/opu/odata4/sap/api_purchasingorganization/srvd_a2x/sap/purchasingorganization/0001/A_PurchasingOrganization', key: 'PurchasingOrganization' },
  purchasing_group: { path: '/sap/opu/odata4/sap/api_purchasinggroup/srvd_a2x/sap/purchasinggroup/0001/A_PurchasingGroup', key: 'PurchasingGroup' },
  company_code: { path: '/sap/opu/odata4/sap/api_companycode/srvd_a2x/sap/companycode/0001/CompanyCode', key: 'CompanyCode' },
  storage_location: { path: '/sap/opu/odata4/sap/api_storagelocation/srvd_a2x/sap/storagelocation/0001/StorageLocation', key: 'StorageLocation' },
};

async function getMasterData(args = {}) {
  const { type, key, filter, top = 10 } = args;

  if (!type) {
    return toMcpError(JSON.stringify({
      error: 'MISSING_PARAMS',
      message: 'type is required',
      validTypes: Object.keys(MASTER_DATA_MAP),
    }));
  }

  const meta = MASTER_DATA_MAP[type];
  if (!meta) {
    return toMcpError(JSON.stringify({
      error: 'INVALID_TYPE',
      message: `Unknown master data type: ${type}`,
      validTypes: Object.keys(MASTER_DATA_MAP),
    }));
  }

  let url;
  if (key) {
    url = singleKeyUrl(meta.path, meta.key, key, { $format: 'json', sapClient: false });
  } else {
    url = makeUrl(meta.path, { $filter: filter, $top: top, $format: 'json', sapClient: false });
  }

  const resp = await sapGet(url);
  if (!resp.ok) {
    return toMcpError(JSON.stringify({
      ...resp.error,
      hint: 'This endpoint requires SAP_COM_0087 Communication Arrangement. Ask Basis to open it.',
    }));
  }
  return toMcpResult({ type, results: extractResults(resp.data) });
}

module.exports = {
  splitExpandedLineItems,
  extractResults,
  healthCheck,
  getProduct,
  getBusinessPartner,
  getSalesOrderStatus,
  getPurchaseOrder,
  getMaterialStock,
  getSupplierInvoice,
  getCostCenter,
  getEntitySchema,
  listSapScenarios,
  querySapScenario,
  traceSalesOrder,
  authenticate,
  getPurchaseRequisition,
  getScheduleAgreement,
  getSalesContract,
  getBom,
  getMaterialReservation,
  getSupplierInvoiceV4,
  getMasterData,
};
