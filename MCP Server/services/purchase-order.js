/**
 * services/purchase-order.js
 * SAP Purchase Order 采购订单查询服务 (V2 OData)
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

function validatePOInput(args) {
    const { purchaseOrder, supplier, companyCode, purchaseOrderType } = args || {};
    if (!purchaseOrder && !supplier && !companyCode && !purchaseOrderType) {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT,
            'At least one filter is required: purchaseOrder, supplier, companyCode, or purchaseOrderType') };
    }
    return { valid: true };
}

function buildPOFilter(args) {
    const { purchaseOrder, supplier, companyCode, purchaseOrderType } = args || {};
    const conditions = [];
    if (purchaseOrder) {
        const pos = purchaseOrder.split(',').map(s => s.trim()).filter(Boolean);
        conditions.push(pos.length === 1
            ? `PurchaseOrder eq '${pos[0]}'`
            : `PurchaseOrder in (${pos.map(p => `'${p}'`).join(',')})`);
    }
    if (supplier) conditions.push(`Supplier eq '${supplier}'`);
    if (companyCode) conditions.push(`CompanyCode eq '${companyCode}'`);
    if (purchaseOrderType) conditions.push(`PurchaseOrderType eq '${purchaseOrderType}'`);
    return conditions.join(' and ');
}

function buildPOUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildItemsUrl(purchaseOrder, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const filter = encodeURIComponent(`PurchaseOrder eq '${purchaseOrder}'`);
    return `/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrderItem?$format=json&$top=${t}&$filter=${filter}`;
}

async function getPurchaseOrder(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;
    const validation = validatePOInput(args);
    if (!validation.valid) throw validation.error;

    const { includeItems = true, top = DEFAULT_TOP } = args;
    const filter = buildPOFilter(args);
    const url = buildPOUrl(filter, top);

    const data = await sapFetch(url);
    const orders = extractRows(data);

    if (includeItems && orders.length > 0) {
        for (const po of orders) {
            try {
                const itemData = await sapFetch(buildItemsUrl(po.PurchaseOrder, top));
                po.items = extractRows(itemData);
            } catch (_) { po.items = []; }
        }
    }

    return { purchaseOrders: orders, count: orders.length, filter: filter || '(none)' };
}

module.exports = { getPurchaseOrder, validatePOInput, buildPOFilter, buildPOUrl, buildItemsUrl };
