/**
 * services/purchase-rfq.js
 * SAP Purchase RFQ (Request for Quotation) 采购询价查询服务 (OData V2)
 *
 * US-API-007 / SAP_COM_0113
 * Service: API_PURCHASEREQUISITION_PROCESS_SRV (RFQ entity)
 * Note: SAP S/4HANA Cloud uses the same PR service for RFQ documents (document type = RFQ)
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

// ── 纯函数：输入校验 ─────────────────────────────────

function validateRfqInput(args) {
    const { purchaseRequisition, purchasingOrganization, purchasingGroup, supplier } = args || {};

    const hasFilter = Boolean(purchaseRequisition) || Boolean(purchasingOrganization)
        || Boolean(purchasingGroup) || Boolean(supplier);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: purchaseRequisition, purchasingOrganization, purchasingGroup, or supplier'),
        };
    }

    if (purchaseRequisition && typeof purchaseRequisition !== 'string') {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'purchaseRequisition must be a string') };
    }

    return { valid: true };
}

// ── 纯函数：构建 OData Filter ────────────────────────

function buildRfqFilter(args) {
    const { purchaseRequisition, purchasingOrganization, purchasingGroup, supplier } = args || {};
    const conditions = [];

    if (purchaseRequisition) {
        const prs = purchaseRequisition.split(',').map(s => s.trim()).filter(Boolean);
        if (prs.length === 1) {
            conditions.push(`PurchaseRequisition eq '${prs[0]}'`);
        } else {
            conditions.push(`PurchaseRequisition in (${prs.map(p => `'${p}'`).join(',')})`);
        }
    }

    if (purchasingOrganization) {
        conditions.push(`PurchasingOrganization eq '${purchasingOrganization}'`);
    }

    if (purchasingGroup) {
        conditions.push(`PurchasingGroup eq '${purchasingGroup}'`);
    }

    if (supplier) {
        conditions.push(`Supplier eq '${supplier}'`);
    }

    // RFQ documents are identified by PurchaseRequisitionType = 'RF'
    conditions.push(`PurchaseRequisitionType eq 'RF'`);

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildRfqUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_PURCHASEREQUISITION_PROCESS_SRV/A_PurchaseRequisitionHeader';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildRfqItemsUrl(purchaseRequisition, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const filter = encodeURIComponent(`PurchaseRequisition eq '${purchaseRequisition}'`);
    return `/sap/opu/odata/sap/API_PURCHASEREQUISITION_PROCESS_SRV/A_PurchaseRequisitionItem?$format=json&$top=${t}&$filter=${filter}`;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询采购询价单 (RFQ)
 * @param {object} args - { purchaseRequisition?, purchasingOrganization?, purchasingGroup?, supplier?, includeItems?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { rfqs, count, filter }
 */
async function getPurchaseRfq(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    const validation = validateRfqInput(args);
    if (!validation.valid) throw validation.error;

    const { includeItems = true, top = DEFAULT_TOP } = args;
    const filter = buildRfqFilter(args);
    const url = buildRfqUrl(filter, top);

    const data = await sapFetch(url);
    const rfqs = extractRows(data);

    if (includeItems && rfqs.length > 0) {
        for (const rfq of rfqs) {
            try {
                const itemData = await sapFetch(buildRfqItemsUrl(rfq.PurchaseRequisition, top));
                rfq.items = extractRows(itemData);
            } catch (_) { rfq.items = []; }
        }
    }

    return {
        rfqs,
        count: rfqs.length,
        filter: filter || '(none)',
    };
}

module.exports = {
    getPurchaseRfq,
    validateRfqInput,
    buildRfqFilter,
    buildRfqUrl,
    buildRfqItemsUrl,
};
