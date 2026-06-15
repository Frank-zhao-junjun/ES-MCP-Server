/**
 * tests/unit/supplier-evaluation.test.js
 * US-API-008: Supplier Evaluation 服务单元测试
 */
const assert = require('assert');
const {
    getSupplierEvaluation,
    validateSupplierEvalInput,
    buildSupplierEvalFilter,
    buildScorecardUrl,
} = require('../../services/supplier-evaluation');
const { ErrorCodes } = require('../../lib/errors');

function testValidateRequiresAtLeastOneFilter() {
    const r = validateSupplierEvalInput({});
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validateSupplierEvalInput({ supplier: '1000001' }).valid, true);
    assert.strictEqual(validateSupplierEvalInput({ purchasingOrganization: '1000' }).valid, true);
    assert.strictEqual(validateSupplierEvalInput({ evaluationPeriod: '2024' }).valid, true);
}

function testValidateRejectsNonStringSupplier() {
    const r = validateSupplierEvalInput({ supplier: 12345 });
    assert.strictEqual(r.valid, false);
}

function testBuildFilterSingleSupplier() {
    const filter = buildSupplierEvalFilter({ supplier: '1000001' });
    assert.strictEqual(filter, "Supplier eq '1000001'");
}

function testBuildFilterMultipleSuppliers() {
    const filter = buildSupplierEvalFilter({ supplier: '1000001, 1000002' });
    assert.ok(filter.includes('Supplier in ('));
}

function testBuildScorecardUrl() {
    const url = buildScorecardUrl("Supplier eq '1000001'", 10);
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('A_SupplierEvaluation'));
}

async function testGetSupplierEvaluationSuccess() {
    const mockSapFetch = async () => ({
        d: { results: [{ Supplier: '1000001', EvaluationScore: 85 }] },
    });
    const extractRows = (data) => (data.d && data.d.results) || [];

    const result = await getSupplierEvaluation(
        { supplier: '1000001', includeItems: false },
        { sapFetch: mockSapFetch, extractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.scorecards[0].Supplier, '1000001');
}

async function testGetSupplierEvaluationValidationFailure() {
    try {
        await getSupplierEvaluation({}, { sapFetch: async () => ({}), extractRows: () => [] });
        assert.fail('Should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function run() {
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateRejectsNonStringSupplier();
    testBuildFilterSingleSupplier();
    testBuildFilterMultipleSuppliers();
    testBuildScorecardUrl();
    await testGetSupplierEvaluationSuccess();
    await testGetSupplierEvaluationValidationFailure();
    console.log('  ✅ supplier-evaluation.test.js — all passed');
}

module.exports = { run };
