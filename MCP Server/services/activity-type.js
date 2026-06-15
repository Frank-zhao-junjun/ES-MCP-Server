/**
 * services/activity-type.js
 * SAP Activity Type 作业类型查询服务 (OData V2)
 *
 * US-API-027 / SAP_COM_0129
 * Service: API_ACTIVITYTYPE_SRV
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

// ── 纯函数：输入校验 ─────────────────────────────────

function validateActivityTypeInput(args) {
    const { activityType, controllingArea, costCenter } = args || {};

    const hasFilter = Boolean(activityType) || Boolean(controllingArea)
        || Boolean(costCenter);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: activityType, controllingArea, or costCenter'),
        };
    }

    if (activityType && typeof activityType !== 'string') {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'activityType must be a string') };
    }

    return { valid: true };
}

// ── 纯函数：构建 OData Filter ────────────────────────

function buildActivityTypeFilter(args) {
    const { activityType, controllingArea, costCenter } = args || {};
    const conditions = [];

    if (activityType) {
        const types = activityType.split(',').map(s => s.trim()).filter(Boolean);
        if (types.length === 1) {
            conditions.push(`ActivityType eq '${types[0]}'`);
        } else {
            conditions.push(`ActivityType in (${types.map(t => `'${t}'`).join(',')})`);
        }
    }

    if (controllingArea) {
        conditions.push(`ControllingArea eq '${controllingArea}'`);
    }

    if (costCenter) {
        conditions.push(`CostCenter eq '${costCenter}'`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildActivityTypeUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_ACTIVITYTYPE_SRV/A_ActivityType';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询作业类型
 * @param {object} args - { activityType?, controllingArea?, costCenter?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { activityTypes, count, filter }
 */
async function getActivityType(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    const validation = validateActivityTypeInput(args);
    if (!validation.valid) throw validation.error;

    const { top = DEFAULT_TOP } = args;
    const filter = buildActivityTypeFilter(args);
    const url = buildActivityTypeUrl(filter, top);

    const data = await sapFetch(url);
    const activityTypes = extractRows(data);

    return {
        activityTypes,
        count: activityTypes.length,
        filter: filter || '(none)',
    };
}

module.exports = {
    getActivityType,
    validateActivityTypeInput,
    buildActivityTypeFilter,
    buildActivityTypeUrl,
};
