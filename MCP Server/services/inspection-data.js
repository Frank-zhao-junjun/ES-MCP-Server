/**
 * services/inspection-data.js
 * SAP Inspection Data 质检数据查询服务 (OData V2)
 *
 * US-API-020 / SAP_COM_0110
 * Services: API_INSPECTIONMETHOD_SRV (检验方法), API_INSPECTIONCHARACTERISTIC_SRV (检验特性),
 *           API_INSPECTIONPLAN_SRV (检验计划)
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

// ── 纯函数：输入校验 ─────────────────────────────────

function validateInspectionDataInput(args) {
    const { inspectionMethod, inspectionCharacteristic, inspectionPlan, material, plant } = args || {};

    const hasFilter = Boolean(inspectionMethod) || Boolean(inspectionCharacteristic)
        || Boolean(inspectionPlan) || Boolean(material) || Boolean(plant);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: inspectionMethod, inspectionCharacteristic, inspectionPlan, material, or plant'),
        };
    }

    if (inspectionMethod && typeof inspectionMethod !== 'string') {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'inspectionMethod must be a string') };
    }

    return { valid: true };
}

// ── 纯函数：构建 OData Filter ────────────────────────

function buildInspectionMethodFilter(args) {
    const { inspectionMethod } = args || {};
    const conditions = [];

    if (inspectionMethod) {
        const methods = inspectionMethod.split(',').map(s => s.trim()).filter(Boolean);
        if (methods.length === 1) {
            conditions.push(`InspectionMethod eq '${methods[0]}'`);
        } else {
            conditions.push(`InspectionMethod in (${methods.map(m => `'${m}'`).join(',')})`);
        }
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

function buildInspectionPlanFilter(args) {
    const { inspectionPlan, material, plant } = args || {};
    const conditions = [];

    if (inspectionPlan) {
        conditions.push(`InspectionPlan eq '${inspectionPlan}'`);
    }

    if (material) {
        conditions.push(`Material eq '${material}'`);
    }

    if (plant) {
        conditions.push(`Plant eq '${plant}'`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildInspectionMethodUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_INSPECTIONMETHOD_SRV/A_InspectionMethod';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildInspectionCharacteristicUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_INSPECTIONCHARACTERISTIC_SRV/A_InspectionCharacteristic';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildInspectionPlanUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_INSPECTIONPLAN_SRV/A_InspectionPlan';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询质检数据（检验方法、检验特性、检验计划）
 * @param {object} args - { inspectionMethod?, inspectionCharacteristic?, inspectionPlan?, material?, plant?, includeMethods?, includeCharacteristics?, includePlans?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { methods, characteristics, plans, count, filter }
 */
async function getInspectionData(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    const validation = validateInspectionDataInput(args);
    if (!validation.valid) throw validation.error;

    const {
        includeMethods = true,
        includeCharacteristics = true,
        includePlans = true,
        top = DEFAULT_TOP,
    } = args;

    const result = {
        methods: [],
        characteristics: [],
        plans: [],
        count: 0,
        filter: '',
    };

    const methodFilter = buildInspectionMethodFilter(args);
    const planFilter = buildInspectionPlanFilter(args);
    result.filter = methodFilter || planFilter || '(none)';

    // Inspection Methods
    if (includeMethods) {
        try {
            const data = await sapFetch(buildInspectionMethodUrl(methodFilter, top));
            result.methods = extractRows(data);
        } catch (_) { result.methods = []; }
    }

    // Inspection Characteristics
    if (includeCharacteristics) {
        try {
            const charFilter = buildInspectionMethodFilter(args);
            const data = await sapFetch(buildInspectionCharacteristicUrl(charFilter, top));
            result.characteristics = extractRows(data);
        } catch (_) { result.characteristics = []; }
    }

    // Inspection Plans
    if (includePlans) {
        try {
            const data = await sapFetch(buildInspectionPlanUrl(planFilter, top));
            result.plans = extractRows(data);
        } catch (_) { result.plans = []; }
    }

    result.count = result.methods.length + result.characteristics.length + result.plans.length;
    return result;
}

module.exports = {
    getInspectionData,
    validateInspectionDataInput,
    buildInspectionMethodFilter,
    buildInspectionPlanFilter,
    buildInspectionMethodUrl,
    buildInspectionCharacteristicUrl,
    buildInspectionPlanUrl,
};
