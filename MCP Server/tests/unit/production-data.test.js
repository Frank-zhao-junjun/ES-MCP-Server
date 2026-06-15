/**
 * tests/unit/production-data.test.js
 * US-API-016: Production Data 服务单元测试
 */
const assert = require('assert');
const {
    getProductionData,
    validateProductionDataInput,
    buildPlannedOrderFilter,
    buildPlannedOrderUrl,
} = require('../../services/production-data');
const { ErrorCodes } = require('../../lib/errors');

function testValidateRequiresAtLeastOneFilter() {
    const r = validateProductionDataInput({});
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validateProductionDataInput({ plannedOrder: '1000001' }).valid, true);
    assert.strictEqual(validateProductionDataInput({ plant: '1010' }).valid, true);
    assert.strictEqual(validateProductionDataInput({ material: 'MAT001' }).valid, true);
}

function testValidateRejectsNonStringMaterial() {
    const r = validateProductionDataInput({ material: 12345 });
    assert.strictEqual(r.valid, false);
}

function testBuildFilterSingleOrder() {
    const filter = buildPlannedOrderFilter({ plannedOrder: '1000001' });
    assert.strictEqual(filter, "PlannedOrder eq '1000001'");
}

function testBuildFilterMultipleOrders() {
    const filter = buildPlannedOrderFilter({ plannedOrder: '1000001, 1000002' });
    assert.ok(filter.includes('PlannedOrder in ('));
}

function testBuildPlannedOrderUrl() {
    const url = buildPlannedOrderUrl("PlannedOrder eq '1000001'", 10);
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('API_PLANNED_ORDER_SRV'));
}

async function testGetProductionDataSuccess() {
    const mockSapFetch = async () => ({
        d: { results: [{ PlannedOrder: '1000001', Plant: '1010' }] },
    });
    const extractRows = (data) => (data.d && data.d.results) || [];

    const result = await getProductionData(
        { plannedOrder: '1000001', includeWorkCenters: false, includeMrp: false },
        { sapFetch: mockSapFetch, extractRows }
    );

    assert.strictEqual(result.plannedOrders.length, 1);
    assert.strictEqual(result.plannedOrders[0].PlannedOrder, '1000001');
}

async function testGetProductionDataValidationFailure() {
    try {
        await getProductionData({}, { sapFetch: async () => ({}), extractRows: () => [] });
        assert.fail('Should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function run() {
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateRejectsNonStringMaterial();
    testBuildFilterSingleOrder();
    testBuildFilterMultipleOrders();
    testBuildPlannedOrderUrl();
    await testGetProductionDataSuccess();
    await testGetProductionDataValidationFailure();
    console.log('  ✅ production-data.test.js — all passed');
}

module.exports = { run };
