/**
 * services/bom.js
 * SAP Bill of Materials 物料清单查询 (V2 OData)
 */
const { ErrorCodes, makeError } = require('../lib/errors');
const DEFAULT_TOP = 20, MAX_TOP = 100;

function validateBOMInput(args) {
    const { material, plant, billOfMaterial } = args || {};
    if (!material && !plant && !billOfMaterial) return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'At least one filter required: material, plant, or billOfMaterial') };
    return { valid: true };
}

function buildBOMFilter(args) {
    const { material, plant, billOfMaterial } = args || {};
    const conditions = [];
    if (material) {
        const mats = material.split(',').map(s => s.trim()).filter(Boolean);
        conditions.push(mats.length === 1 ? `Material eq '${mats[0]}'` : `Material in (${mats.map(m => `'${m}'`).join(',')})`);
    }
    if (plant) conditions.push(`Plant eq '${plant}'`);
    if (billOfMaterial) conditions.push(`BillOfMaterial eq '${billOfMaterial}'`);
    return conditions.join(' and ');
}

function buildBOMUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_BILL_OF_MATERIAL_SRV;v=0002/A_BillOfMaterial';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildItemsUrl(billOfMaterial, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const filter = encodeURIComponent(`BillOfMaterial eq '${billOfMaterial}'`);
    return `/sap/opu/odata/sap/API_BILL_OF_MATERIAL_SRV;v=0002/A_BillOfMaterialItem?$format=json&$top=${t}&$filter=${filter}`;
}

async function getBOM(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;
    const v = validateBOMInput(args);
    if (!v.valid) throw v.error;
    const { includeItems = true, top = DEFAULT_TOP } = args;
    const filter = buildBOMFilter(args);
    const data = await sapFetch(buildBOMUrl(filter, top));
    const boms = extractRows(data);

    if (includeItems && boms.length > 0) {
        for (const bom of boms) {
            try {
                const itemData = await sapFetch(buildItemsUrl(bom.BillOfMaterial, top));
                bom.items = extractRows(itemData);
            } catch (_) { bom.items = []; }
        }
    }
    return { billsOfMaterial: boms, count: boms.length, filter: filter || '(none)' };
}

module.exports = { getBOM, validateBOMInput, buildBOMFilter, buildBOMUrl, buildItemsUrl };
