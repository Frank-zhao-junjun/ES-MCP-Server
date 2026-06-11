/**
 * services/supplier-invoice.js
 * SAP Supplier Invoice 供应商发票查询 (V2 OData)
 */
const { ErrorCodes, makeError } = require('../lib/errors');
const DEFAULT_TOP = 20, MAX_TOP = 100;

function validateInvoiceInput(args) {
    const { supplierInvoice, fiscalYear, companyCode, invoicingParty } = args || {};
    if (!supplierInvoice && !fiscalYear && !companyCode && !invoicingParty)
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'At least one filter required') };
    return { valid: true };
}

function buildInvoiceFilter(args) {
    const { supplierInvoice, fiscalYear, companyCode, invoicingParty } = args || {};
    const c = [];
    if (supplierInvoice) {
        const invs = supplierInvoice.split(',').map(s => s.trim()).filter(Boolean);
        c.push(invs.length === 1 ? `SupplierInvoice eq '${invs[0]}'` : `SupplierInvoice in (${invs.map(i => `'${i}'`).join(',')})`);
    }
    if (fiscalYear) c.push(`FiscalYear eq '${fiscalYear}'`);
    if (companyCode) c.push(`CompanyCode eq '${companyCode}'`);
    if (invoicingParty) c.push(`InvoicingParty eq '${invoicingParty}'`);
    return c.join(' and ');
}

function buildInvoiceUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice';
    let url = `${base}?$format=json&$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildItemsUrl(supplierInvoice, fiscalYear, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const filter = encodeURIComponent(`SupplierInvoice eq '${supplierInvoice}' and FiscalYear eq '${fiscalYear}'`);
    return `/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SuplrInvcItemPurOrdRef?$format=json&$top=${t}&$filter=${filter}`;
}

async function getSupplierInvoice(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;
    const v = validateInvoiceInput(args);
    if (!v.valid) throw v.error;
    const { includeItems = true, top = DEFAULT_TOP } = args;
    const filter = buildInvoiceFilter(args);
    const data = await sapFetch(buildInvoiceUrl(filter, top));
    const invoices = extractRows(data);

    if (includeItems && invoices.length > 0) {
        for (const inv of invoices) {
            try {
                const itemsData = await sapFetch(buildItemsUrl(inv.SupplierInvoice, inv.FiscalYear, top));
                inv.items = extractRows(itemsData);
            } catch (_) { inv.items = []; }
        }
    }
    return { supplierInvoices: invoices, count: invoices.length, filter: filter || '(none)' };
}

module.exports = { getSupplierInvoice, validateInvoiceInput, buildInvoiceFilter, buildInvoiceUrl, buildItemsUrl };
