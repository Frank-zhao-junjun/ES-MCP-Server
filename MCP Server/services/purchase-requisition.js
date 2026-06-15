/**
 * services/purchase-requisition.js
 * SAP Purchase Requisition 采购申请查询服务 (OData V4)
 *
 * US-API-004 / SAP_COM_0102
 * Service: api_purchaserequisition_2
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

// ── 纯函数：输入校验 ─────────────────────────────────

function validatePurReqInput(args) {
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

function buildPurReqFilter(args) {
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

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildPurReqUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata4/sap/api_purchaserequisition_2/srvd_a2x/sap/purchaserequisition/0001/A_PurchaseRequisition';
    let url = `${base}?$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildPurReqItemsUrl(purchaseRequisition, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const filter = encodeURIComponent(`PurchaseRequisition eq '${purchaseRequisition}'`);
    return `/sap/opu/odata4/sap/api_purchaserequisition_2/srvd_a2x/sap/purchaserequisition/0001/A_PurchaseRequisitionItem?$top=${t}&$filter=${filter}`;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询采购申请
 * @param {object} args - { purchaseRequisition?, purchasingOrganization?, purchasingGroup?, supplier?, includeItems?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { purchaseRequisitions, count, filter }
 */
async function getPurchaseRequisition(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    const validation = validatePurReqInput(args);
    if (!validation.valid) throw validation.error;

    const { includeItems = true, top = DEFAULT_TOP } = args;
    const filter = buildPurReqFilter(args);
    const url = buildPurReqUrl(filter, top);

    const data = await sapFetch(url);
    const requisitions = extractRows(data);

    if (includeItems && requisitions.length > 0) {
        for (const pr of requisitions) {
            try {
                const itemData = await sapFetch(buildPurReqItemsUrl(pr.PurchaseRequisition, top));
                pr.items = extractRows(itemData);
            } catch (_) { pr.items = []; }
        }
    }

    return {
        purchaseRequisitions: requisitions,
        count: requisitions.length,
        filter: filter || '(none)',
    };
}

module.exports = {
    getPurchaseRequisition,
    validatePurReqInput,
    buildPurReqFilter,
    buildPurReqUrl,
    buildPurReqItemsUrl,
};
