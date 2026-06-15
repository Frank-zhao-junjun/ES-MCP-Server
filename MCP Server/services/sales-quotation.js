/**
 * services/sales-quotation.js
 * SAP Sales Quotation / Sales Inquiry 销售报价/询价查询服务 (OData V2)
 *
 * US-API-012 / SAP_COM_0113 / SAP_COM_0117
 * Service: API_SALES_QUOTATION_SRV / API_SALES_INQUIRY_SRV
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

// ── 纯函数：输入校验 ─────────────────────────────────

function validateSalesQuotationInput(args) {
    const { salesQuotation, salesInquiry, soldToParty, salesOrganization } = args || {};

    const hasFilter = Boolean(salesQuotation) || Boolean(salesInquiry)
        || Boolean(soldToParty) || Boolean(salesOrganization);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: salesQuotation, salesInquiry, soldToParty, or salesOrganization'),
        };
    }

    if (salesQuotation && typeof salesQuotation !== 'string') {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'salesQuotation must be a string') };
    }

    return { valid: true };
}

// ── 纯函数：构建 OData Filter ────────────────────────

function buildSalesQuotationFilter(args) {
    const { salesQuotation, salesInquiry, soldToParty, salesOrganization } = args || {};
    const conditions = [];

    if (salesQuotation) {
        const sqs = salesQuotation.split(',').map(s => s.trim()).filter(Boolean);
        if (sqs.length === 1) {
            conditions.push(`SalesQuotation eq '${sqs[0]}'`);
        } else {
            conditions.push(`SalesQuotation in (${sqs.map(s => `'${s}'`).join(',')})`);
        }
    }

    if (salesInquiry) {
        const sis = salesInquiry.split(',').map(s => s.trim()).filter(Boolean);
        if (sis.length === 1) {
            conditions.push(`SalesInquiry eq '${sis[0]}'`);
        } else {
            conditions.push(`SalesInquiry in (${sis.map(s => `'${s}'`).join(',')})`);
        }
    }

    if (soldToParty) {
        conditions.push(`SoldToParty eq '${soldToParty}'`);
    }

    if (salesOrganization) {
        conditions.push(`SalesOrganization eq '${salesOrganization}'`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildSalesQuotationUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_SALES_QUOTATION_SRV/A_SalesQuotation';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildSalesQuotationItemsUrl(salesQuotation, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const filter = encodeURIComponent(`SalesQuotation eq '${salesQuotation}'`);
    return `/sap/opu/odata/sap/API_SALES_QUOTATION_SRV/A_SalesQuotationItem?$format=json&$top=${t}&$filter=${filter}`;
}

function buildSalesInquiryUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_SALES_INQUIRY_SRV/A_SalesInquiry';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询销售报价/询价
 * @param {object} args - { salesQuotation?, salesInquiry?, soldToParty?, salesOrganization?, includeItems?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { quotations, inquiries, count, filter }
 */
async function getSalesQuotation(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    const validation = validateSalesQuotationInput(args);
    if (!validation.valid) throw validation.error;

    const { includeItems = true, top = DEFAULT_TOP } = args;
    const filter = buildSalesQuotationFilter(args);
    const result = { quotations: [], inquiries: [], count: 0, filter: filter || '(none)' };

    // Query quotations
    if (!args.salesInquiry) {
        const url = buildSalesQuotationUrl(filter, top);
        const data = await sapFetch(url);
        result.quotations = extractRows(data);

        if (includeItems && result.quotations.length > 0) {
            for (const q of result.quotations) {
                try {
                    const itemData = await sapFetch(buildSalesQuotationItemsUrl(q.SalesQuotation, top));
                    q.items = extractRows(itemData);
                } catch (_) { q.items = []; }
            }
        }
    }

    // Query inquiries
    if (!args.salesQuotation) {
        const inquiryFilter = buildSalesQuotationFilter(args);
        const inquiryUrl = buildSalesInquiryUrl(inquiryFilter, top);
        try {
            const inquiryData = await sapFetch(inquiryUrl);
            result.inquiries = extractRows(inquiryData);
        } catch (_) { result.inquiries = []; }
    }

    result.count = result.quotations.length + result.inquiries.length;
    return result;
}

module.exports = {
    getSalesQuotation,
    validateSalesQuotationInput,
    buildSalesQuotationFilter,
    buildSalesQuotationUrl,
    buildSalesQuotationItemsUrl,
    buildSalesInquiryUrl,
};
