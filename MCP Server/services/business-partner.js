/**
 * services/business-partner.js
 * SAP Business Partner 业务伙伴查询服务 (V2 OData)
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

function validateBPInput(args) {
    const { businessPartner, businessPartnerCategory } = args || {};
    if (!businessPartner && !businessPartnerCategory) {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT,
            'At least one filter is required: businessPartner or businessPartnerCategory') };
    }
    return { valid: true };
}

function buildBPFilter(args) {
    const { businessPartner, businessPartnerCategory } = args || {};
    const conditions = [];
    if (businessPartner) {
        const bps = businessPartner.split(',').map(s => s.trim()).filter(Boolean);
        conditions.push(bps.length === 1
            ? `BusinessPartner eq '${bps[0]}'`
            : `BusinessPartner in (${bps.map(b => `'${b}'`).join(',')})`);
    }
    if (businessPartnerCategory) conditions.push(`BusinessPartnerCategory eq '${businessPartnerCategory}'`);
    return conditions.join(' and ');
}

function buildBPUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildDetailUrl(entity, key) {
    return `/sap/opu/odata/sap/API_BUSINESS_PARTNER/${entity}?$format=json&$top=1&$filter=${encodeURIComponent(`${key} eq '${key === 'BusinessPartner' ? key : key}'`)}`;
}

async function fetchDetail(sapFetch, extractRows, entity, field, value) {
    if (!value) return null;
    try {
        const data = await sapFetch(`/sap/opu/odata/sap/API_BUSINESS_PARTNER/${entity}?$format=json&$top=1&$filter=${encodeURIComponent(`${field} eq '${value}'`)}`);
        const rows = extractRows(data);
        return rows.length > 0 ? rows[0] : null;
    } catch (_) { return null; }
}

async function getBusinessPartner(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;
    const validation = validateBPInput(args);
    if (!validation.valid) throw validation.error;

    const { includeCustomer = false, includeSupplier = false, top = DEFAULT_TOP } = args;
    const filter = buildBPFilter(args);
    const url = buildBPUrl(filter, top);

    const data = await sapFetch(url);
    const partners = extractRows(data);

    // 可选：补充 Customer 和 Supplier 详情
    if ((includeCustomer || includeSupplier) && partners.length > 0) {
        for (const bp of partners) {
            if (includeCustomer && bp.Customer) {
                bp.customerDetail = await fetchDetail(sapFetch, extractRows, 'A_Customer', 'Customer', bp.Customer);
            }
            if (includeSupplier && bp.Supplier) {
                bp.supplierDetail = await fetchDetail(sapFetch, extractRows, 'A_Supplier', 'Supplier', bp.Supplier);
            }
        }
    }

    return { businessPartners: partners, count: partners.length, filter: filter || '(none)' };
}

module.exports = { getBusinessPartner, validateBPInput, buildBPFilter, buildBPUrl };
