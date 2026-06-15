/**
 * services/routing.js
 * SAP Routing 工艺路线查询服务 (OData V2)
 *
 * US-API-019 / SAP_COM_0519
 * Service: API_PRODUCTION_ROUTING
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

// ── 纯函数：输入校验 ─────────────────────────────────

function validateRoutingInput(args) {
    const { routing, material, plant, routingGroup } = args || {};

    const hasFilter = Boolean(routing) || Boolean(material)
        || Boolean(plant) || Boolean(routingGroup);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: routing, material, plant, or routingGroup'),
        };
    }

    if (routing && typeof routing !== 'string') {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'routing must be a string') };
    }

    return { valid: true };
}

// ── 纯函数：构建 OData Filter ────────────────────────

function buildRoutingFilter(args) {
    const { routing, material, plant, routingGroup } = args || {};
    const conditions = [];

    if (routing) {
        const routings = routing.split(',').map(s => s.trim()).filter(Boolean);
        if (routings.length === 1) {
            conditions.push(`Routing eq '${routings[0]}'`);
        } else {
            conditions.push(`Routing in (${routings.map(r => `'${r}'`).join(',')})`);
        }
    }

    if (material) {
        conditions.push(`Material eq '${material}'`);
    }

    if (plant) {
        conditions.push(`Plant eq '${plant}'`);
    }

    if (routingGroup) {
        conditions.push(`RoutingGroup eq '${routingGroup}'`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildRoutingUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_PRODUCTION_ROUTING/A_RoutingHeader';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildRoutingOperationsUrl(routing, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const filter = encodeURIComponent(`Routing eq '${routing}'`);
    return `/sap/opu/odata/sap/API_PRODUCTION_ROUTING/A_RoutingOperation?$format=json&$top=${t}&$filter=${filter}`;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询工艺路线
 * @param {object} args - { routing?, material?, plant?, routingGroup?, includeOperations?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { routings, count, filter }
 */
async function getRouting(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    const validation = validateRoutingInput(args);
    if (!validation.valid) throw validation.error;

    const { includeOperations = true, top = DEFAULT_TOP } = args;
    const filter = buildRoutingFilter(args);
    const url = buildRoutingUrl(filter, top);

    const data = await sapFetch(url);
    const routings = extractRows(data);

    if (includeOperations && routings.length > 0) {
        for (const r of routings) {
            try {
                const opData = await sapFetch(buildRoutingOperationsUrl(r.Routing, top));
                r.operations = extractRows(opData);
            } catch (_) { r.operations = []; }
        }
    }

    return {
        routings,
        count: routings.length,
        filter: filter || '(none)',
    };
}

module.exports = {
    getRouting,
    validateRoutingInput,
    buildRoutingFilter,
    buildRoutingUrl,
    buildRoutingOperationsUrl,
};
