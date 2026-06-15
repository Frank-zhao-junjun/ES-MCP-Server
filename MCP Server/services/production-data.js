/**
 * services/production-data.js
 * SAP Production Data 生产数据查询服务 (OData V2/V4)
 *
 * US-API-016 / SAP_COM_0104
 * Services: API_PLANNED_ORDER_SRV (Planned Orders), API_WORKCENTER_SRV (Work Centers),
 *           API_MATERIAL_REQUIREMENT_SRV (MRP), API_INDEPENDENT_REQUIREMENT_SRV (Independent Requirements)
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

// ── 纯函数：输入校验 ─────────────────────────────────

function validateProductionDataInput(args) {
    const { material, plant, workCenter, plannedOrder, mrpArea } = args || {};

    const hasFilter = Boolean(material) || Boolean(plant)
        || Boolean(workCenter) || Boolean(plannedOrder) || Boolean(mrpArea);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: material, plant, workCenter, plannedOrder, or mrpArea'),
        };
    }

    if (material && typeof material !== 'string') {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'material must be a string') };
    }

    return { valid: true };
}

// ── 纯函数：构建 OData Filter ────────────────────────

function buildPlannedOrderFilter(args) {
    const { material, plant, plannedOrder } = args || {};
    const conditions = [];

    if (plannedOrder) {
        const pos = plannedOrder.split(',').map(s => s.trim()).filter(Boolean);
        if (pos.length === 1) {
            conditions.push(`PlannedOrder eq '${pos[0]}'`);
        } else {
            conditions.push(`PlannedOrder in (${pos.map(p => `'${p}'`).join(',')})`);
        }
    }

    if (material) {
        conditions.push(`Material eq '${material}'`);
    }

    if (plant) {
        conditions.push(`ProductionPlant eq '${plant}'`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

function buildWorkCenterFilter(args) {
    const { workCenter, plant } = args || {};
    const conditions = [];

    if (workCenter) {
        conditions.push(`WorkCenter eq '${workCenter}'`);
    }

    if (plant) {
        conditions.push(`Plant eq '${plant}'`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildPlannedOrderUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_PLANNED_ORDER_SRV/A_PlannedOrder';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildWorkCenterUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_WORKCENTER_SRV/A_WorkCenter';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildMrpUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_MATERIAL_REQUIREMENT_SRV/A_MaterialRequirement';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询生产数据（计划订单、工作中心、MRP）
 * @param {object} args - { material?, plant?, workCenter?, plannedOrder?, mrpArea?, includePlannedOrders?, includeWorkCenters?, includeMrp?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { plannedOrders, workCenters, mrpRequirements, count, filter }
 */
async function getProductionData(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    const validation = validateProductionDataInput(args);
    if (!validation.valid) throw validation.error;

    const {
        includePlannedOrders = true,
        includeWorkCenters = true,
        includeMrp = true,
        top = DEFAULT_TOP,
    } = args;

    const result = {
        plannedOrders: [],
        workCenters: [],
        mrpRequirements: [],
        count: 0,
        filter: '',
    };

    const poFilter = buildPlannedOrderFilter(args);
    const wcFilter = buildWorkCenterFilter(args);
    result.filter = poFilter || wcFilter || '(none)';

    // Planned Orders
    if (includePlannedOrders) {
        try {
            const data = await sapFetch(buildPlannedOrderUrl(poFilter, top));
            result.plannedOrders = extractRows(data);
        } catch (_) { result.plannedOrders = []; }
    }

    // Work Centers
    if (includeWorkCenters) {
        try {
            const data = await sapFetch(buildWorkCenterUrl(wcFilter, top));
            result.workCenters = extractRows(data);
        } catch (_) { result.workCenters = []; }
    }

    // MRP Requirements
    if (includeMrp) {
        try {
            const mrpFilter = buildPlannedOrderFilter(args);
            const data = await sapFetch(buildMrpUrl(mrpFilter, top));
            result.mrpRequirements = extractRows(data);
        } catch (_) { result.mrpRequirements = []; }
    }

    result.count = result.plannedOrders.length + result.workCenters.length + result.mrpRequirements.length;
    return result;
}

module.exports = {
    getProductionData,
    validateProductionDataInput,
    buildPlannedOrderFilter,
    buildWorkCenterFilter,
    buildPlannedOrderUrl,
    buildWorkCenterUrl,
    buildMrpUrl,
};
