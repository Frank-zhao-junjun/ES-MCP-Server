/**
 * tests/unit/inspection-data.test.js
 * US-API-020: Inspection Data 服务单元测试
 */
const assert = require('assert');
const {
    getInspectionData,
    validateInspectionDataInput,
    buildInspectionMethodFilter,
    buildInspectionMethodUrl,
} = require('../../services/inspection-data');
const { ErrorCodes } = require('../../lib/errors');

function testValidateRequiresAtLeastOneFilter() {
    const r = validateInspectionDataInput({});
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validateInspectionDataInput({ inspectionMethod: 'M001' }).valid, true);
    assert.strictEqual(validateInspectionDataInput({ material: 'MAT001' }).valid, true);
    assert.strictEqual(validateInspectionDataInput({ plant: '1010' }).valid, true);
}

function testValidateRejectsNonStringMethod() {
    const r = validateInspectionDataInput({ inspectionMethod: 12345 });
    assert.strictEqual(r.valid, false);
}

function testBuildFilterSingleMethod() {
    const filter = buildInspectionMethodFilter({ inspectionMethod: 'M001' });
    assert.strictEqual(filter, "InspectionMethod eq 'M001'");
}

function testBuildFilterMultipleMethods() {
    const filter = buildInspectionMethodFilter({ inspectionMethod: 'M001, M002' });
    assert.ok(filter.includes('InspectionMethod in ('));
}

function testBuildInspectionMethodUrl() {
    const url = buildInspectionMethodUrl("InspectionMethod eq 'M001'", 10);
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('API_INSPECTIONMETHOD_SRV'));
}

async function testGetInspectionDataSuccess() {
    const mockSapFetch = async () => ({
        d: { results: [{ InspectionMethod: 'M001', Material: 'MAT001' }] },
    });
    const extractRows = (data) => (data.d && data.d.results) || [];

    const result = await getInspectionData(
        { inspectionMethod: 'M001', includeCharacteristics: false, includePlans: false },
        { sapFetch: mockSapFetch, extractRows }
    );

    assert.strictEqual(result.methods.length, 1);
    assert.strictEqual(result.methods[0].InspectionMethod, 'M001');
}

async function testGetInspectionDataValidationFailure() {
    try {
        await getInspectionData({}, { sapFetch: async () => ({}), extractRows: () => [] });
        assert.fail('Should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function run() {
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateRejectsNonStringMethod();
    testBuildFilterSingleMethod();
    testBuildFilterMultipleMethods();
    testBuildInspectionMethodUrl();
    await testGetInspectionDataSuccess();
    await testGetInspectionDataValidationFailure();
    console.log('  ✅ inspection-data.test.js — all passed');
}

module.exports = { run };
