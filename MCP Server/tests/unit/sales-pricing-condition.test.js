/**
 * tests/unit/sales-pricing-condition.test.js
 * US-API-014: Sales Pricing Condition 服务单元测试
 */
const assert = require('assert');
const {
    getSalesPricingCondition,
    validatePricingConditionInput,
    buildPricingConditionFilter,
    buildPricingConditionUrl,
} = require('../../services/sales-pricing-condition');
const { ErrorCodes } = require('../../lib/errors');

function testValidateRequiresAtLeastOneFilter() {
    const r = validatePricingConditionInput({});
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validatePricingConditionInput({ conditionType: 'PR00' }).valid, true);
    assert.strictEqual(validatePricingConditionInput({ salesOrganization: '1010' }).valid, true);
    assert.strictEqual(validatePricingConditionInput({ material: 'MAT001' }).valid, true);
}

function testValidateRejectsNonStringConditionType() {
    const r = validatePricingConditionInput({ conditionType: 12345 });
    assert.strictEqual(r.valid, false);
}

function testBuildFilterSingleType() {
    const filter = buildPricingConditionFilter({ conditionType: 'PR00' });
    assert.strictEqual(filter, "ConditionType eq 'PR00'");
}

function testBuildFilterMultipleTypes() {
    const filter = buildPricingConditionFilter({ conditionType: 'PR00, K007' });
    assert.ok(filter.includes('ConditionType in ('));
}

function testBuildPricingConditionUrl() {
    const url = buildPricingConditionUrl("ConditionType eq 'PR00'", 10);
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('A_SalesPricingCondition'));
}

async function testGetSalesPricingConditionSuccess() {
    const mockSapFetch = async () => ({
        value: [{ ConditionType: 'PR00', ConditionRate: 100.00 }],
    });
    const extractRows = (data) => data.value || [];

    const result = await getSalesPricingCondition(
        { conditionType: 'PR00' },
        { sapFetch: mockSapFetch, extractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.conditionRecords[0].ConditionType, 'PR00');
}

async function testGetSalesPricingConditionValidationFailure() {
    try {
        await getSalesPricingCondition({}, { sapFetch: async () => ({}), extractRows: () => [] });
        assert.fail('Should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function run() {
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateRejectsNonStringConditionType();
    testBuildFilterSingleType();
    testBuildFilterMultipleTypes();
    testBuildPricingConditionUrl();
    await testGetSalesPricingConditionSuccess();
    await testGetSalesPricingConditionValidationFailure();
    console.log('  ✅ sales-pricing-condition.test.js — all passed');
}

module.exports = { run };
