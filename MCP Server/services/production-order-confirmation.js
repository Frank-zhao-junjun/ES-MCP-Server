/**
 * services/production-order-confirmation.js
 * SAP Production Order Confirmation 生产订单确认查询服务 (OData V2)
 *
 * US-API-017 / SAP_COM_0522
 * Service: API_PROD_ORDER_CONFIRMATION_2_SRV
 * Note: 端点探测返回 406，需复核服务激活状态
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

// ── 纯函数：输入校验 ─────────────────────────────────

function validateProdOrderConfInput(args) {
    const { productionOrder, confirmation, manufacturingOrder } = args || {};

    const hasFilter = Boolean(productionOrder) || Boolean(confirmation)
        || Boolean(manufacturingOrder);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: productionOrder, confirmation, or manufacturingOrder'),
        };
    }

    if (productionOrder && typeof productionOrder !== 'string') {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'productionOrder must be a string') };
    }

    return { valid: true };
}

// ── 纯函数：构建 OData Filter ────────────────────────

function buildProdOrderConfFilter(args) {
    const { productionOrder, confirmation, manufacturingOrder } = args || {};
    const conditions = [];

    if (productionOrder) {
        const pos = productionOrder.split(',').map(s => s.trim()).filter(Boolean);
        if (pos.length === 1) {
            conditions.push(`ManufacturingOrder eq '${pos[0]}'`);
        } else {
            conditions.push(`ManufacturingOrder in (${pos.map(p => `'${p}'`).join(',')})`);
        }
    }

    if (confirmation) {
        conditions.push(`Confirmation eq '${confirmation}'`);
    }

    if (manufacturingOrder) {
        conditions.push(`ManufacturingOrder eq '${manufacturingOrder}'`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildProdOrderConfUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_PROD_ORDER_CONFIRMATION_2_SRV/A_ProdOrderConfHdr';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildProdOrderConfItemsUrl(productionOrder, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const filter = encodeURIComponent(`ManufacturingOrder eq '${productionOrder}'`);
    return `/sap/opu/odata/sap/API_PROD_ORDER_CONFIRMATION_2_SRV/A_ProdOrderConfItem?$format=json&$top=${t}&$filter=${filter}`;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询生产订单确认
 * @param {object} args - { productionOrder?, confirmation?, manufacturingOrder?, includeItems?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { confirmations, count, filter }
 */
async function getProductionOrderConfirmation(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    const validation = validateProdOrderConfInput(args);
    if (!validation.valid) throw validation.error;

    const { includeItems = true, top = DEFAULT_TOP } = args;
    const filter = buildProdOrderConfFilter(args);
    const url = buildProdOrderConfUrl(filter, top);

    const data = await sapFetch(url);
    const confirmations = extractRows(data);

    if (includeItems && confirmations.length > 0) {
        for (const conf of confirmations) {
            try {
                const itemData = await sapFetch(buildProdOrderConfItemsUrl(conf.ManufacturingOrder, top));
                conf.items = extractRows(itemData);
            } catch (_) { conf.items = []; }
        }
    }

    return {
        confirmations,
        count: confirmations.length,
        filter: filter || '(none)',
    };
}

module.exports = {
    getProductionOrderConfirmation,
    validateProdOrderConfInput,
    buildProdOrderConfFilter,
    buildProdOrderConfUrl,
    buildProdOrderConfItemsUrl,
};
