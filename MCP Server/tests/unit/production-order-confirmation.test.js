/**
 * tests/unit/production-order-confirmation.test.js
 * US-API-017: Production Order Confirmation 服务单元测试
 */
const assert = require('assert');
const {
    getProductionOrderConfirmation,
    validateProdOrderConfInput,
    buildProdOrderConfFilter,
    buildProdOrderConfUrl,
} = require('../../services/production-order-confirmation');
const { ErrorCodes } = require('../../lib/errors');

function testValidateRequiresAtLeastOneFilter() {
    const r = validateProdOrderConfInput({});
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validateProdOrderConfInput({ productionOrder: '1000001' }).valid, true);
    assert.strictEqual(validateProdOrderConfInput({ confirmation: '1000000001' }).valid, true);
    assert.strictEqual(validateProdOrderConfInput({ manufacturingOrder: '1000001' }).valid, true);
}

function testValidateRejectsNonStringOrder() {
    const r = validateProdOrderConfInput({ productionOrder: 12345 });
    assert.strictEqual(r.valid, false);
}

function testBuildFilterSingleOrder() {
    const filter = buildProdOrderConfFilter({ productionOrder: '1000001' });
    assert.strictEqual(filter, "ManufacturingOrder eq '1000001'");
}

function testBuildFilterMultipleOrders() {
    const filter = buildProdOrderConfFilter({ productionOrder: '1000001, 1000002' });
    assert.ok(filter.includes('ManufacturingOrder in ('));
}

function testBuildProdOrderConfUrl() {
    const url = buildProdOrderConfUrl("ManufacturingOrder eq '1000001'", 10);
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('API_PROD_ORDER_CONFIRMATION_2_SRV'));
}

async function testGetProductionOrderConfirmationSuccess() {
    const mockSapFetch = async () => ({
        d: { results: [{ ManufacturingOrder: '1000001', Confirmation: '1000000001' }] },
    });
    const extractRows = (data) => (data.d && data.d.results) || [];

    const result = await getProductionOrderConfirmation(
        { productionOrder: '1000001', includeItems: false },
        { sapFetch: mockSapFetch, extractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.confirmations[0].ManufacturingOrder, '1000001');
}

async function testGetProductionOrderConfirmationValidationFailure() {
    try {
        await getProductionOrderConfirmation({}, { sapFetch: async () => ({}), extractRows: () => [] });
        assert.fail('Should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function run() {
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateRejectsNonStringOrder();
    testBuildFilterSingleOrder();
    testBuildFilterMultipleOrders();
    testBuildProdOrderConfUrl();
    await testGetProductionOrderConfirmationSuccess();
    await testGetProductionOrderConfirmationValidationFailure();
    console.log('  ✅ production-order-confirmation.test.js — all passed');
}

module.exports = { run };
