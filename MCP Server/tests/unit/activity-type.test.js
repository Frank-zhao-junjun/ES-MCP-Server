/**
 * tests/unit/activity-type.test.js
 * US-API-027: Activity Type 服务单元测试
 */
const assert = require('assert');
const {
    getActivityType,
    validateActivityTypeInput,
    buildActivityTypeFilter,
    buildActivityTypeUrl,
} = require('../../services/activity-type');
const { ErrorCodes } = require('../../lib/errors');

function testValidateRequiresAtLeastOneFilter() {
    const r = validateActivityTypeInput({});
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validateActivityTypeInput({ activityType: 'L001' }).valid, true);
    assert.strictEqual(validateActivityTypeInput({ controllingArea: 'A000' }).valid, true);
    assert.strictEqual(validateActivityTypeInput({ costCenter: '10101001' }).valid, true);
}

function testValidateRejectsNonStringActivityType() {
    const r = validateActivityTypeInput({ activityType: 12345 });
    assert.strictEqual(r.valid, false);
}

function testBuildFilterSingleType() {
    const filter = buildActivityTypeFilter({ activityType: 'L001' });
    assert.strictEqual(filter, "ActivityType eq 'L001'");
}

function testBuildFilterMultipleTypes() {
    const filter = buildActivityTypeFilter({ activityType: 'L001, L002' });
    assert.ok(filter.includes('ActivityType in ('));
}

function testBuildActivityTypeUrl() {
    const url = buildActivityTypeUrl("ActivityType eq 'L001'", 10);
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('API_ACTIVITYTYPE_SRV'));
}

async function testGetActivityTypeSuccess() {
    const mockSapFetch = async () => ({
        d: { results: [{ ActivityType: 'L001', ControllingArea: 'A000' }] },
    });
    const extractRows = (data) => (data.d && data.d.results) || [];

    const result = await getActivityType(
        { activityType: 'L001' },
        { sapFetch: mockSapFetch, extractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.activityTypes[0].ActivityType, 'L001');
}

async function testGetActivityTypeValidationFailure() {
    try {
        await getActivityType({}, { sapFetch: async () => ({}), extractRows: () => [] });
        assert.fail('Should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function run() {
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateRejectsNonStringActivityType();
    testBuildFilterSingleType();
    testBuildFilterMultipleTypes();
    testBuildActivityTypeUrl();
    await testGetActivityTypeSuccess();
    await testGetActivityTypeValidationFailure();
    console.log('  ✅ activity-type.test.js — all passed');
}

module.exports = { run };
