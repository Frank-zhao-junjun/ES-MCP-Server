/**
 * tests/unit/routing.test.js
 * US-API-019: Routing 服务单元测试
 */
const assert = require('assert');
const {
    getRouting,
    validateRoutingInput,
    buildRoutingFilter,
    buildRoutingUrl,
} = require('../../services/routing');
const { ErrorCodes } = require('../../lib/errors');

function testValidateRequiresAtLeastOneFilter() {
    const r = validateRoutingInput({});
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validateRoutingInput({ routing: '50000001' }).valid, true);
    assert.strictEqual(validateRoutingInput({ plant: '1010' }).valid, true);
    assert.strictEqual(validateRoutingInput({ material: 'MAT001' }).valid, true);
}

function testValidateRejectsNonStringRouting() {
    const r = validateRoutingInput({ routing: 12345 });
    assert.strictEqual(r.valid, false);
}

function testBuildFilterSingleRouting() {
    const filter = buildRoutingFilter({ routing: '50000001' });
    assert.strictEqual(filter, "Routing eq '50000001'");
}

function testBuildFilterMultipleRoutings() {
    const filter = buildRoutingFilter({ routing: '50000001, 50000002' });
    assert.ok(filter.includes('Routing in ('));
}

function testBuildRoutingUrl() {
    const url = buildRoutingUrl("Routing eq '50000001'", 10);
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('API_PRODUCTION_ROUTING'));
}

async function testGetRoutingSuccess() {
    const mockSapFetch = async () => ({
        d: { results: [{ Routing: '50000001', Plant: '1010' }] },
    });
    const extractRows = (data) => (data.d && data.d.results) || [];

    const result = await getRouting(
        { routing: '50000001' },
        { sapFetch: mockSapFetch, extractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.routings[0].Routing, '50000001');
}

async function testGetRoutingValidationFailure() {
    try {
        await getRouting({}, { sapFetch: async () => ({}), extractRows: () => [] });
        assert.fail('Should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function run() {
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateRejectsNonStringRouting();
    testBuildFilterSingleRouting();
    testBuildFilterMultipleRoutings();
    testBuildRoutingUrl();
    await testGetRoutingSuccess();
    await testGetRoutingValidationFailure();
    console.log('  ✅ routing.test.js — all passed');
}

module.exports = { run };
