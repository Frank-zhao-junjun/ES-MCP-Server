/**
 * tests/unit/business-partner.test.js
 * BP 服务单元测试
 */
const assert = require('assert');
const { getBusinessPartner, validateBPInput, buildBPFilter, buildBPUrl } = require('../../services/business-partner');
const { ErrorCodes } = require('../../lib/errors');

function testValidate() {
    assert.strictEqual(validateBPInput({}).valid, false);
    assert.strictEqual(validateBPInput({ businessPartner: '1000001' }).valid, true);
    assert.strictEqual(validateBPInput({ businessPartnerCategory: '2' }).valid, true);
}

function testFilterSingle() {
    assert.strictEqual(buildBPFilter({ businessPartner: '1000001' }), "BusinessPartner eq '1000001'");
}

function testFilterMultiple() {
    const f = buildBPFilter({ businessPartner: '1000001, 1000002' });
    assert.ok(f.includes('BusinessPartner in ('));
    assert.ok(f.includes("'1000001'"));
}

function testFilterCategory() {
    assert.strictEqual(buildBPFilter({ businessPartnerCategory: '2' }), "BusinessPartnerCategory eq '2'");
}

function testUrl() {
    const url = buildBPUrl("BusinessPartner eq '1000001'", 10);
    assert.ok(url.includes('A_BusinessPartner?'));
    assert.ok(url.includes('$format=json'));
    assert.ok(url.includes('$top=10'));
}

async function testGetBPSuccess() {
    const calls = [];
    const deps = {
        sapFetch: async (url) => { calls.push(url); return { d: { results: [{ BusinessPartner: '1000001', BusinessPartnerFullName: 'Test Corp', Customer: '1000001' }] } }; },
        extractRows: (d) => d.d?.results || [],
    };
    const r = await getBusinessPartner({ businessPartner: '1000001' }, deps);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.businessPartners[0].BusinessPartnerFullName, 'Test Corp');
    assert.strictEqual(r.businessPartners[0].customerDetail, undefined);
}

async function testGetBPWithDetails() {
    const calls = [];
    const deps = {
        sapFetch: async (url) => {
            calls.push(url);
            if (url.includes('A_BusinessPartner?')) return { d: { results: [{ BusinessPartner: '1000001', Customer: '1000001', Supplier: '5000001' }] } };
            if (url.includes('A_Customer?')) return { d: { results: [{ Customer: '1000001', CustomerAccountGroup: 'Z001' }] } };
            if (url.includes('A_Supplier?')) return { d: { results: [{ Supplier: '5000001', SupplierAccountGroup: 'Z002' }] } };
            return { d: { results: [] } };
        },
        extractRows: (d) => d.d?.results || [],
    };
    const r = await getBusinessPartner({ businessPartner: '1000001', includeCustomer: true, includeSupplier: true }, deps);
    assert.strictEqual(r.businessPartners[0].customerDetail.CustomerAccountGroup, 'Z001');
    assert.strictEqual(r.businessPartners[0].supplierDetail.SupplierAccountGroup, 'Z002');
    assert.strictEqual(calls.length, 3);
}

async function run() {
    testValidate();
    testFilterSingle();
    testFilterMultiple();
    testFilterCategory();
    testUrl();
    await testGetBPSuccess();
    await testGetBPWithDetails();
    console.log('  ✅ business-partner.test.js — all passed');
}
module.exports = { run };
