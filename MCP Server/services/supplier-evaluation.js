/**
 * services/supplier-evaluation.js
 * SAP Supplier Evaluation 供应商评估查询服务 (OData V2)
 *
 * US-API-008 / SAP_COM_0122 / SAP_COM_0139
 * Service: API_SUPLR_EVAL_SCORECARD_SRV / API_SUPLR_EVAL_RESPONSE_SRV
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

// ── 纯函数：输入校验 ─────────────────────────────────

function validateSupplierEvalInput(args) {
    const { supplier, purchasingOrganization, evaluationPeriod } = args || {};

    const hasFilter = Boolean(supplier) || Boolean(purchasingOrganization)
        || Boolean(evaluationPeriod);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: supplier, purchasingOrganization, or evaluationPeriod'),
        };
    }

    if (supplier && typeof supplier !== 'string') {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'supplier must be a string') };
    }

    return { valid: true };
}

// ── 纯函数：构建 OData Filter ────────────────────────

function buildSupplierEvalFilter(args) {
    const { supplier, purchasingOrganization, evaluationPeriod } = args || {};
    const conditions = [];

    if (supplier) {
        const suppliers = supplier.split(',').map(s => s.trim()).filter(Boolean);
        if (suppliers.length === 1) {
            conditions.push(`Supplier eq '${suppliers[0]}'`);
        } else {
            conditions.push(`Supplier in (${suppliers.map(s => `'${s}'`).join(',')})`);
        }
    }

    if (purchasingOrganization) {
        conditions.push(`PurchasingOrganization eq '${purchasingOrganization}'`);
    }

    if (evaluationPeriod) {
        conditions.push(`EvaluationPeriod eq '${evaluationPeriod}'`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildScorecardUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_SUPLR_EVAL_SCORECARD_SRV/A_SupplierEvaluationScorecard';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildScorecardItemsUrl(supplier, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const filter = encodeURIComponent(`Supplier eq '${supplier}'`);
    return `/sap/opu/odata/sap/API_SUPLR_EVAL_SCORECARD_SRV/A_SupplierEvaluationScorecardItem?$format=json&$top=${t}&$filter=${filter}`;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询供应商评估计分卡
 * @param {object} args - { supplier?, purchasingOrganization?, evaluationPeriod?, includeItems?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { scorecards, count, filter }
 */
async function getSupplierEvaluation(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    const validation = validateSupplierEvalInput(args);
    if (!validation.valid) throw validation.error;

    const { includeItems = true, top = DEFAULT_TOP } = args;
    const filter = buildSupplierEvalFilter(args);
    const url = buildScorecardUrl(filter, top);

    const data = await sapFetch(url);
    const scorecards = extractRows(data);

    if (includeItems && scorecards.length > 0) {
        for (const sc of scorecards) {
            try {
                const itemData = await sapFetch(buildScorecardItemsUrl(sc.Supplier, top));
                sc.items = extractRows(itemData);
            } catch (_) { sc.items = []; }
        }
    }

    return {
        scorecards,
        count: scorecards.length,
        filter: filter || '(none)',
    };
}

module.exports = {
    getSupplierEvaluation,
    validateSupplierEvalInput,
    buildSupplierEvalFilter,
    buildScorecardUrl,
    buildScorecardItemsUrl,
};
