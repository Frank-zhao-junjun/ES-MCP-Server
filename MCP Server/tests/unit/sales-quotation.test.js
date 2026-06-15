/**
 * tests/unit/sales-quotation.test.js
 * US-API-012: Sales Quotation 服务单元测试
 */
const assert = require('assert');
const {
    getSalesQuotation,
    validateSalesQuotationInput,
    buildSalesQuotationFilter,
    buildSalesQuotationUrl,
} = require('../../services/sales-quotation');
const { ErrorCodes } = require('../../lib/errors');

function testValidateRequiresAtLeastOneFilter() {
    const r = validateSalesQuotationInput({});
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validateSalesQuotationInput({ salesQuotation: '20000001' }).valid, true);
    assert.strictEqual(validateSalesQuotationInput({ soldToParty: '1000001' }).valid, true);
    assert.strictEqual(validateSalesQuotationInput({ salesOrganization: '1010' }).valid, true);
}

function testValidateRejectsNonStringQuotation() {
    const r = validateSalesQuotationInput({ salesQuotation: 12345 });
    assert.strictEqual(r.valid, false);
}

function testBuildFilterSingleQuotation() {
    const filter = buildSalesQuotationFilter({ salesQuotation: '20000001' });
    assert.strictEqual(filter, "SalesQuotation eq '20000001'");
}

function testBuildFilterMultipleQuotations() {
    const filter = buildSalesQuotationFilter({ salesQuotation: '20000001, 20000002' });
    assert.ok(filter.includes('SalesQuotation in ('));
}

function testBuildSalesQuotationUrl() {
    const url = buildSalesQuotationUrl("SalesQuotation eq '20000001'", 10);
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('A_SalesQuotation'));
}

async function testGetSalesQuotationSuccess() {
    const mockSapFetch = async () => ({
        d: { results: [{ SalesQuotation: '20000001', SoldToParty: '1000001' }] },
    });
    const extractRows = (data) => (data.d && data.d.results) || [];

    const result = await getSalesQuotation(
        { salesQuotation: '20000001' },
        { sapFetch: mockSapFetch, extractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.quotations[0].SalesQuotation, '20000001');
}

async function testGetSalesQuotationValidationFailure() {
    try {
        await getSalesQuotation({}, { sapFetch: async () => ({}), extractRows: () => [] });
        assert.fail('Should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function run() {
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateRejectsNonStringQuotation();
    testBuildFilterSingleQuotation();
    testBuildFilterMultipleQuotations();
    testBuildSalesQuotationUrl();
    await testGetSalesQuotationSuccess();
    await testGetSalesQuotationValidationFailure();
    console.log('  ✅ sales-quotation.test.js — all passed');
}

module.exports = { run };
