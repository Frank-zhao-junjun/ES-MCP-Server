/**
 * services/product.js
 * SAP Product 产品主数据查询服务 (V2 OData)
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

function validateProductInput(args) {
    const { product, productType, productGroup } = args || {};
    const hasFilter = Boolean(product) || Boolean(productType) || Boolean(productGroup);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: product, productType, or productGroup'),
        };
    }

    if (product && typeof product !== 'string') {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'product must be a string') };
    }

    return { valid: true };
}

function buildProductFilter(args) {
    const { product, productType, productGroup } = args || {};
    const conditions = [];

    if (product) {
        const products = product.split(',').map(s => s.trim()).filter(Boolean);
        if (products.length === 1) {
            conditions.push(`Product eq '${products[0]}'`);
        } else {
            conditions.push(`Product in (${products.map(p => `'${p}'`).join(',')})`);
        }
    }
    if (productType) conditions.push(`ProductType eq '${productType}'`);
    if (productGroup) conditions.push(`ProductGroup eq '${productGroup}'`);

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

function buildProductUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_PRODUCT_SRV/A_Product';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildDescriptionUrl(product) {
    const filter = encodeURIComponent(`Product eq '${product}'`);
    return `/sap/opu/odata/sap/API_PRODUCT_SRV/A_ProductDescription?$format=json&$top=50&$filter=${filter}`;
}

async function getProduct(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;
    const validation = validateProductInput(args);
    if (!validation.valid) throw validation.error;

    const { includeDescription = true, top = DEFAULT_TOP } = args;
    const filter = buildProductFilter(args);
    const url = buildProductUrl(filter, top);

    const data = await sapFetch(url);
    let products = extractRows(data);

    if (includeDescription && products.length > 0) {
        const enriched = [];
        for (const p of products) {
            try {
                const textData = await sapFetch(buildDescriptionUrl(p.Product));
                p.descriptions = extractRows(textData);
            } catch (_) {
                p.descriptions = [];
            }
            enriched.push(p);
        }
        products = enriched;
    }

    return {
        products,
        count: products.length,
        filter: filter || '(none)',
    };
}

module.exports = {
    getProduct,
    validateProductInput,
    buildProductFilter,
    buildProductUrl,
    buildDescriptionUrl,
};
