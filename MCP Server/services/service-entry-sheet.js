/**
 * services/service-entry-sheet.js
 * SAP Service Entry Sheet 服务确认单查询服务 (OData V4)
 *
 * US-API-009 / SAP_COM_0146
 * Service: api_serviceentrysheet
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

// ── 纯函数：输入校验 ─────────────────────────────────

function validateServiceEntryInput(args) {
    const { serviceEntrySheet, purchaseOrder, supplier, purchasingOrganization } = args || {};

    const hasFilter = Boolean(serviceEntrySheet) || Boolean(purchaseOrder)
        || Boolean(supplier) || Boolean(purchasingOrganization);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: serviceEntrySheet, purchaseOrder, supplier, or purchasingOrganization'),
        };
    }

    if (serviceEntrySheet && typeof serviceEntrySheet !== 'string') {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'serviceEntrySheet must be a string') };
    }

    return { valid: true };
}

// ── 纯函数：构建 OData Filter ────────────────────────

function buildServiceEntryFilter(args) {
    const { serviceEntrySheet, purchaseOrder, supplier, purchasingOrganization } = args || {};
    const conditions = [];

    if (serviceEntrySheet) {
        const ses = serviceEntrySheet.split(',').map(s => s.trim()).filter(Boolean);
        if (ses.length === 1) {
            conditions.push(`ServiceEntrySheet eq '${ses[0]}'`);
        } else {
            conditions.push(`ServiceEntrySheet in (${ses.map(s => `'${s}'`).join(',')})`);
        }
    }

    if (purchaseOrder) {
        conditions.push(`PurchaseOrder eq '${purchaseOrder}'`);
    }

    if (supplier) {
        conditions.push(`Supplier eq '${supplier}'`);
    }

    if (purchasingOrganization) {
        conditions.push(`PurchasingOrganization eq '${purchasingOrganization}'`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildServiceEntryUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata4/sap/api_serviceentrysheet/srvd_a2x/sap/servicentrysheet/0001/A_ServiceEntrySheet';
    let url = `${base}?$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildServiceEntryItemsUrl(serviceEntrySheet, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const filter = encodeURIComponent(`ServiceEntrySheet eq '${serviceEntrySheet}'`);
    return `/sap/opu/odata4/sap/api_serviceentrysheet/srvd_a2x/sap/servicentrysheet/0001/A_ServiceEntrySheetItem?$top=${t}&$filter=${filter}`;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询服务确认单
 * @param {object} args - { serviceEntrySheet?, purchaseOrder?, supplier?, purchasingOrganization?, includeItems?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { serviceEntrySheets, count, filter }
 */
async function getServiceEntrySheet(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    const validation = validateServiceEntryInput(args);
    if (!validation.valid) throw validation.error;

    const { includeItems = true, top = DEFAULT_TOP } = args;
    const filter = buildServiceEntryFilter(args);
    const url = buildServiceEntryUrl(filter, top);

    const data = await sapFetch(url);
    const sheets = extractRows(data);

    if (includeItems && sheets.length > 0) {
        for (const sheet of sheets) {
            try {
                const itemData = await sapFetch(buildServiceEntryItemsUrl(sheet.ServiceEntrySheet, top));
                sheet.items = extractRows(itemData);
            } catch (_) { sheet.items = []; }
        }
    }

    return {
        serviceEntrySheets: sheets,
        count: sheets.length,
        filter: filter || '(none)',
    };
}

module.exports = {
    getServiceEntrySheet,
    validateServiceEntryInput,
    buildServiceEntryFilter,
    buildServiceEntryUrl,
    buildServiceEntryItemsUrl,
};
