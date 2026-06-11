const assert = require('assert');
const { getSupplierInvoice, validateInvoiceInput, buildInvoiceFilter, buildInvoiceUrl } = require('../../services/supplier-invoice');
const { ErrorCodes } = require('../../lib/errors');

function testValidate() {
    assert.strictEqual(validateInvoiceInput({}).valid, false);
    assert.strictEqual(validateInvoiceInput({ supplierInvoice: '5100000001' }).valid, true);
    assert.strictEqual(validateInvoiceInput({ companyCode: '1010' }).valid, true);
}

function testFilter() {
    assert.strictEqual(buildInvoiceFilter({ supplierInvoice: '5100000001' }), "SupplierInvoice eq '5100000001'");
    const f = buildInvoiceFilter({ companyCode: '1010', fiscalYear: '2025' });
    assert.ok(f.includes(' and '));
}

function testUrl() {
    const url = buildInvoiceUrl("SupplierInvoice eq '51'", 10);
    assert.ok(url.includes('A_SupplierInvoice?'));
    assert.ok(url.includes('$format=json'));
}

async function testGet() {
    const deps = {
        sapFetch: async (url) => {
            if (url.includes('A_SupplierInvoice?')) return { d: { results: [{ SupplierInvoice: '5100000001', FiscalYear: '2025', InvoiceGrossAmount: '1000.00', DocumentCurrency: 'CNY' }] } };
            return { d: { results: [{ SupplierInvoice: '5100000001', PurchaseOrder: '4500000001', SupplierInvoiceItemAmount: '500.00' }] } };
        },
        extractRows: (d) => d.d?.results || [],
    };
    const r = await getSupplierInvoice({ supplierInvoice: '5100000001' }, deps);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.supplierInvoices[0].InvoiceGrossAmount, '1000.00');
    assert.strictEqual(r.supplierInvoices[0].items[0].PurchaseOrder, '4500000001');
}

async function run() { testValidate(); testFilter(); testUrl(); await testGet(); console.log('  ✅ supplier-invoice.test.js — all passed'); }
module.exports = { run };
