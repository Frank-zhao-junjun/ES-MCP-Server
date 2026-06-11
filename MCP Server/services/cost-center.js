/**
 * services/cost-center.js
 * SAP Cost Center 查询服务
 * 
 * REQ-CC-001: 提供 getCostCenter 函数，通过 DI 模式支持测试
 * REQ-CC-002: 纯函数 validateCostCenterInput / buildCostCenterFilter
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;
const SAP_CLIENT = '100';

// ── 纯函数：输入校验 ─────────────────────────────────

/**
 * 校验 get_cost_center 的输入参数
 * @returns {{ valid: boolean, error?: object }}
 */
function validateCostCenterInput(args) {
    const { costCenter, controllingArea, companyCode } = args || {};

    const hasFilter = Boolean(costCenter) || Boolean(controllingArea) || Boolean(companyCode);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: costCenter, controllingArea, or companyCode'),
        };
    }

    // 校验 costCenter 格式（如果提供）
    if (costCenter && typeof costCenter !== 'string') {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'costCenter must be a string'),
        };
    }

    return { valid: true };
}

// ── 纯函数：构建 OData Filter ────────────────────────

/**
 * 根据输入构建 OData $filter 字符串
 */
function buildCostCenterFilter(args) {
    const { costCenter, controllingArea, companyCode } = args || {};
    const conditions = [];

    if (costCenter) {
        // 支持逗号分隔的多个成本中心
        const centers = costCenter.split(',').map(s => s.trim()).filter(Boolean);
        if (centers.length === 1) {
            conditions.push(`CostCenter eq '${centers[0]}'`);
        } else {
            const quoted = centers.map(c => `'${c}'`).join(',');
            conditions.push(`CostCenter in (${quoted})`);
        }
    }

    if (controllingArea) {
        conditions.push(`ControllingArea eq '${controllingArea}'`);
    }

    if (companyCode) {
        conditions.push(`CompanyCode eq '${companyCode}'`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildCostCenterUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    if (!filter) {
        return `/sap/opu/odata4/sap/api_cost_center/srvd_a2x/sap/costcenter/0001/A_CostCenter_2?$top=${t}`;
    }
    return `/sap/opu/odata4/sap/api_cost_center/srvd_a2x/sap/costcenter/0001/A_CostCenter_2?$top=${t}&$filter=${encodeURIComponent(filter)}`;
}

function buildCostCenterTextUrl(costCenter, controllingArea) {
    const filter = `CostCenter eq '${costCenter}' and ControllingArea eq '${controllingArea}'`;
    return `/sap/opu/odata4/sap/api_cost_center/srvd_a2x/sap/costcenter/0001/A_CostCenterText_2?$top=20&$filter=${encodeURIComponent(filter)}`;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询成本中心主数据
 * @param {object} args - { costCenter?, controllingArea?, companyCode?, includeText?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { costCenters, count, filter }
 */
async function getCostCenter(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    // 校验输入
    const validation = validateCostCenterInput(args);
    if (!validation.valid) {
        throw validation.error;
    }

    const { includeText = true, top = DEFAULT_TOP } = args;
    const filter = buildCostCenterFilter(args);
    const url = buildCostCenterUrl(filter, top);

    // 查询主实体
    const data = await sapFetch(url);
    let costCenters = extractRows(data);

    // 合并多语言文本
    if (includeText && costCenters.length > 0) {
        const enriched = [];
        for (const cc of costCenters) {
            try {
                const textUrl = buildCostCenterTextUrl(cc.CostCenter, cc.ControllingArea);
                const textData = await sapFetch(textUrl);
                cc.texts = extractRows(textData);
            } catch (_) {
                cc.texts = [];
            }
            enriched.push(cc);
        }
        costCenters = enriched;
    }

    return {
        costCenters,
        count: costCenters.length,
        filter: filter || '(none)',
    };
}

module.exports = {
    getCostCenter,
    validateCostCenterInput,
    buildCostCenterFilter,
    buildCostCenterUrl,
    buildCostCenterTextUrl,
};
