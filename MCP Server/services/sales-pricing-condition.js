/**
 * services/sales-pricing-condition.js
 * SAP Sales Pricing Condition 销售价格条件查询服务 (OData V4)
 *
 * US-API-014 / SAP_COM_0294
 * Service: api_slsprcgconditionrecord (Sales Pricing Condition Records)
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

// ── 纯函数：输入校验 ─────────────────────────────────

function validatePricingConditionInput(args) {
    const { conditionTable, conditionType, salesOrganization, distributionChannel, material } = args || {};

    const hasFilter = Boolean(conditionTable) || Boolean(conditionType)
        || Boolean(salesOrganization) || Boolean(distributionChannel) || Boolean(material);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: conditionTable, conditionType, salesOrganization, distributionChannel, or material'),
        };
    }

    if (conditionType && typeof conditionType !== 'string') {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'conditionType must be a string') };
    }

    return { valid: true };
}

// ── 纯函数：构建 OData Filter ────────────────────────

function buildPricingConditionFilter(args) {
    const { conditionTable, conditionType, salesOrganization, distributionChannel, material } = args || {};
    const conditions = [];

    if (conditionTable) {
        conditions.push(`ConditionTable eq '${conditionTable}'`);
    }

    if (conditionType) {
        const types = conditionType.split(',').map(s => s.trim()).filter(Boolean);
        if (types.length === 1) {
            conditions.push(`ConditionType eq '${types[0]}'`);
        } else {
            conditions.push(`ConditionType in (${types.map(t => `'${t}'`).join(',')})`);
        }
    }

    if (salesOrganization) {
        conditions.push(`SalesOrganization eq '${salesOrganization}'`);
    }

    if (distributionChannel) {
        conditions.push(`DistributionChannel eq '${distributionChannel}'`);
    }

    if (material) {
        conditions.push(`Material eq '${material}'`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildPricingConditionUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata4/sap/api_slsprcgconditionrecord/srvd_a2x/sap/salespricingconditionrecord/0001/A_SalesPricingConditionRecord';
    let url = `${base}?$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询销售价格条件
 * @param {object} args - { conditionTable?, conditionType?, salesOrganization?, distributionChannel?, material?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { conditionRecords, count, filter }
 */
async function getSalesPricingCondition(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    const validation = validatePricingConditionInput(args);
    if (!validation.valid) throw validation.error;

    const { top = DEFAULT_TOP } = args;
    const filter = buildPricingConditionFilter(args);
    const url = buildPricingConditionUrl(filter, top);

    const data = await sapFetch(url);
    const records = extractRows(data);

    return {
        conditionRecords: records,
        count: records.length,
        filter: filter || '(none)',
    };
}

module.exports = {
    getSalesPricingCondition,
    validatePricingConditionInput,
    buildPricingConditionFilter,
    buildPricingConditionUrl,
};
