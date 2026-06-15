/**
 * services/physical-inventory.js
 * SAP Physical Inventory 盘点数据查询服务 (OData V4)
 *
 * US-API-025 / SAP_COM_0107
 * Service: api_physicalinventorydocument
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

// ── 纯函数：输入校验 ─────────────────────────────────

function validatePhysicalInventoryInput(args) {
    const { physicalInventoryDocument, material, plant, fiscalYear } = args || {};

    const hasFilter = Boolean(physicalInventoryDocument) || Boolean(material)
        || Boolean(plant) || Boolean(fiscalYear);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: physicalInventoryDocument, material, plant, or fiscalYear'),
        };
    }

    if (physicalInventoryDocument && typeof physicalInventoryDocument !== 'string') {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'physicalInventoryDocument must be a string') };
    }

    return { valid: true };
}

// ── 纯函数：构建 OData Filter ────────────────────────

function buildPhysicalInventoryFilter(args) {
    const { physicalInventoryDocument, material, plant, fiscalYear } = args || {};
    const conditions = [];

    if (physicalInventoryDocument) {
        const docs = physicalInventoryDocument.split(',').map(s => s.trim()).filter(Boolean);
        if (docs.length === 1) {
            conditions.push(`PhysicalInventoryDocument eq '${docs[0]}'`);
        } else {
            conditions.push(`PhysicalInventoryDocument in (${docs.map(d => `'${d}'`).join(',')})`);
        }
    }

    if (material) {
        conditions.push(`Material eq '${material}'`);
    }

    if (plant) {
        conditions.push(`Plant eq '${plant}'`);
    }

    if (fiscalYear) {
        conditions.push(`FiscalYear eq '${fiscalYear}'`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildPhysicalInventoryUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata4/sap/api_physicalinventorydocument/srvd_a2x/sap/physicalinventorydocument/0001/A_PhysInventoryDocHeader';
    let url = `${base}?$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildPhysicalInventoryItemsUrl(physicalInventoryDocument, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const filter = encodeURIComponent(`PhysicalInventoryDocument eq '${physicalInventoryDocument}'`);
    return `/sap/opu/odata4/sap/api_physicalinventorydocument/srvd_a2x/sap/physicalinventorydocument/0001/A_PhysInventoryDocItem?$top=${t}&$filter=${filter}`;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询盘点数据
 * @param {object} args - { physicalInventoryDocument?, material?, plant?, fiscalYear?, includeItems?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { documents, count, filter }
 */
async function getPhysicalInventory(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    const validation = validatePhysicalInventoryInput(args);
    if (!validation.valid) throw validation.error;

    const { includeItems = true, top = DEFAULT_TOP } = args;
    const filter = buildPhysicalInventoryFilter(args);
    const url = buildPhysicalInventoryUrl(filter, top);

    const data = await sapFetch(url);
    const documents = extractRows(data);

    if (includeItems && documents.length > 0) {
        for (const doc of documents) {
            try {
                const itemData = await sapFetch(buildPhysicalInventoryItemsUrl(doc.PhysicalInventoryDocument, top));
                doc.items = extractRows(itemData);
            } catch (_) { doc.items = []; }
        }
    }

    return {
        documents,
        count: documents.length,
        filter: filter || '(none)',
    };
}

module.exports = {
    getPhysicalInventory,
    validatePhysicalInventoryInput,
    buildPhysicalInventoryFilter,
    buildPhysicalInventoryUrl,
    buildPhysicalInventoryItemsUrl,
};
