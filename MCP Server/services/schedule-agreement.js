/**
 * services/schedule-agreement.js
 * SAP Schedule Agreement 采购计划协议查询服务 (OData V2)
 *
 * US-API-005 / SAP_COM_0103
 * Service: API_SCHED_AGRMT_PROCESS_SRV
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

// ── 纯函数：输入校验 ─────────────────────────────────

function validateSchedAgmtInput(args) {
    const { scheduleAgreement, supplier, purchasingOrganization, purchasingGroup } = args || {};

    const hasFilter = Boolean(scheduleAgreement) || Boolean(supplier)
        || Boolean(purchasingOrganization) || Boolean(purchasingGroup);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: scheduleAgreement, supplier, purchasingOrganization, or purchasingGroup'),
        };
    }

    if (scheduleAgreement && typeof scheduleAgreement !== 'string') {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'scheduleAgreement must be a string') };
    }

    return { valid: true };
}

// ── 纯函数：构建 OData Filter ────────────────────────

function buildSchedAgmtFilter(args) {
    const { scheduleAgreement, supplier, purchasingOrganization, purchasingGroup } = args || {};
    const conditions = [];

    if (scheduleAgreement) {
        const sas = scheduleAgreement.split(',').map(s => s.trim()).filter(Boolean);
        if (sas.length === 1) {
            conditions.push(`ScheduleAgreement eq '${sas[0]}'`);
        } else {
            conditions.push(`ScheduleAgreement in (${sas.map(s => `'${s}'`).join(',')})`);
        }
    }

    if (supplier) {
        conditions.push(`Supplier eq '${supplier}'`);
    }

    if (purchasingOrganization) {
        conditions.push(`PurchasingOrganization eq '${purchasingOrganization}'`);
    }

    if (purchasingGroup) {
        conditions.push(`PurchasingGroup eq '${purchasingGroup}'`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildSchedAgmtUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_SCHED_AGRMT_PROCESS_SRV/A_ScheduleAgreement';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildSchedAgmtItemsUrl(scheduleAgreement, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const filter = encodeURIComponent(`ScheduleAgreement eq '${scheduleAgreement}'`);
    return `/sap/opu/odata/sap/API_SCHED_AGRMT_PROCESS_SRV/A_ScheduleAgreementItem?$format=json&$top=${t}&$filter=${filter}`;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询采购计划协议
 * @param {object} args - { scheduleAgreement?, supplier?, purchasingOrganization?, purchasingGroup?, includeItems?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { scheduleAgreements, count, filter }
 */
async function getScheduleAgreement(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    const validation = validateSchedAgmtInput(args);
    if (!validation.valid) throw validation.error;

    const { includeItems = true, top = DEFAULT_TOP } = args;
    const filter = buildSchedAgmtFilter(args);
    const url = buildSchedAgmtUrl(filter, top);

    const data = await sapFetch(url);
    const agreements = extractRows(data);

    if (includeItems && agreements.length > 0) {
        for (const sa of agreements) {
            try {
                const itemData = await sapFetch(buildSchedAgmtItemsUrl(sa.ScheduleAgreement, top));
                sa.items = extractRows(itemData);
            } catch (_) { sa.items = []; }
        }
    }

    return {
        scheduleAgreements: agreements,
        count: agreements.length,
        filter: filter || '(none)',
    };
}

module.exports = {
    getScheduleAgreement,
    validateSchedAgmtInput,
    buildSchedAgmtFilter,
    buildSchedAgmtUrl,
    buildSchedAgmtItemsUrl,
};
