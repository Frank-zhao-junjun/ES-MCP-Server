/**
 * services/material-stock.js
 * SAP Material Stock 物料库存查询 (V2 OData)
 */
const { ErrorCodes, makeError } = require('../lib/errors');
const DEFAULT_TOP = 20, MAX_TOP = 100;

function validateStockInput(args) {
    const { material, plant } = args || {};
    if (!material && !plant) return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'At least one filter required: material or plant') };
    return { valid: true };
}

function buildStockFilter(args) {
    const { material, plant, storageLocation, batch } = args || {};
    const conditions = [];
    if (material) {
        const mats = material.split(',').map(s => s.trim()).filter(Boolean);
        conditions.push(mats.length === 1 ? `Material eq '${mats[0]}'` : `Material in (${mats.map(m => `'${m}'`).join(',')})`);
    }
    if (plant) conditions.push(`Plant eq '${plant}'`);
    if (storageLocation) conditions.push(`StorageLocation eq '${storageLocation}'`);
    if (batch) conditions.push(`Batch eq '${batch}'`);
    return conditions.join(' and ');
}

function buildStockUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

async function getMaterialStock(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;
    const v = validateStockInput(args);
    if (!v.valid) throw v.error;
    const { top = DEFAULT_TOP } = args;
    const filter = buildStockFilter(args);
    const data = await sapFetch(buildStockUrl(filter, top));
    const stocks = extractRows(data);
    return { stocks, count: stocks.length, filter: filter || '(none)' };
}

module.exports = { getMaterialStock, validateStockInput, buildStockFilter, buildStockUrl };
