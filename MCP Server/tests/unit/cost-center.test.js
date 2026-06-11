/**
 * tests/unit/cost-center.test.js
 * REQ-CC-002 & REQ-CC-003: Cost Center 服务单元测试
 */
const assert = require('assert');
const {
    getCostCenter,
    validateCostCenterInput,
    buildCostCenterFilter,
    buildCostCenterUrl,
    buildCostCenterTextUrl,
} = require('../../services/cost-center');
const { ErrorCodes } = require('../../lib/errors');

// ════════════════════════════════════════════════════
// REQ-CC-002: validateCostCenterInput
// ════════════════════════════════════════════════════

function testValidateRequiresAtLeastOneFilter() {
    const r1 = validateCostCenterInput({});
    assert.strictEqual(r1.valid, false);
    assert.strictEqual(r1.error.code, ErrorCodes.INVALID_INPUT);

    const r2 = validateCostCenterInput({ costCenter: null, controllingArea: null });
    assert.strictEqual(r2.valid, false);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validateCostCenterInput({ costCenter: '10101001' }).valid, true);
    assert.strictEqual(validateCostCenterInput({ controllingArea: 'A000' }).valid, true);
    assert.strictEqual(validateCostCenterInput({ companyCode: '1010' }).valid, true);
}

function testValidateWithMultipleFilters() {
    assert.strictEqual(validateCostCenterInput({
        costCenter: '10101001',
        controllingArea: 'A000',
        companyCode: '1010',
    }).valid, true);
}

function testValidateRejectsNonStringCostCenter() {
    const r = validateCostCenterInput({ costCenter: 12345 });
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

// ════════════════════════════════════════════════════
// buildCostCenterFilter
// ════════════════════════════════════════════════════

function testBuildFilterSingleCostCenter() {
    const filter = buildCostCenterFilter({ costCenter: '10101001' });
    assert.strictEqual(filter, "CostCenter eq '10101001'");
}

function testBuildFilterMultipleCostCenters() {
    const filter = buildCostCenterFilter({ costCenter: '10101001, 10101002 , 10101003' });
    assert.ok(filter.includes('CostCenter in ('), 'should use "in" for multiple values');
    assert.ok(filter.includes("'10101001'"));
    assert.ok(filter.includes("'10101002'"));
    assert.ok(filter.includes("'10101003'"));
}

function testBuildFilterControllingArea() {
    assert.strictEqual(
        buildCostCenterFilter({ controllingArea: 'A000' }),
        "ControllingArea eq 'A000'"
    );
}

function testBuildFilterCompanyCode() {
    assert.strictEqual(
        buildCostCenterFilter({ companyCode: '1010' }),
        "CompanyCode eq '1010'"
    );
}

function testBuildFilterCombined() {
    const filter = buildCostCenterFilter({
        costCenter: '10101001',
        controllingArea: 'A000',
        companyCode: '1010',
    });
    assert.ok(filter.includes("CostCenter eq '10101001'"));
    assert.ok(filter.includes("ControllingArea eq 'A000'"));
    assert.ok(filter.includes("CompanyCode eq '1010'"));
    assert.ok(filter.includes(' and '));
}

function testBuildFilterEmptyArgs() {
    assert.strictEqual(buildCostCenterFilter({}), '');
    assert.strictEqual(buildCostCenterFilter(null), '');
    assert.strictEqual(buildCostCenterFilter(), '');
}

// ════════════════════════════════════════════════════
// buildCostCenterUrl
// ════════════════════════════════════════════════════

function testBuildUrlWithFilter() {
    const url = buildCostCenterUrl("CostCenter eq '10101001'", 10);
    assert.ok(url.includes('A_CostCenter_2?'));
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('$filter='));
}

function testBuildUrlWithoutFilter() {
    const url = buildCostCenterUrl('', 5);
    assert.ok(url.includes('$top=5'));
    assert.ok(!url.includes('$filter'));
}

function testBuildUrlTopCapped() {
    const url = buildCostCenterUrl('', 999);
    assert.ok(url.includes('$top=100'));
}

// ════════════════════════════════════════════════════
// buildCostCenterTextUrl
// ════════════════════════════════════════════════════

function testBuildTextUrl() {
    const url = buildCostCenterTextUrl('10101001', 'A000');
    assert.ok(url.includes('A_CostCenterText_2?'));
    assert.ok(url.includes('10101001'), 'should include cost center number');
    assert.ok(url.includes('A000'), 'should include controlling area');
    assert.ok(url.includes('$filter='), 'should include filter param');
}

// ════════════════════════════════════════════════════
// REQ-CC-003: getCostCenter DI Mock 集成
// ════════════════════════════════════════════════════

async function testGetCostCenterSuccess() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        if (url.includes('A_CostCenter_2?')) {
            return {
                value: [{
                    ControllingArea: 'A000',
                    CostCenter: '10101001',
                    CostCenterName: '',
                    CompanyCode: '1010',
                    ProfitCenter: 'PC001',
                }],
            };
        }
        if (url.includes('A_CostCenterText_2?')) {
            return {
                value: [{
                    Language: 'ZH',
                    CostCenterName: '管理部门成本中心',
                    CostCenterDescription: '管理部门成本中心',
                }],
            };
        }
        return { value: [] };
    };
    const mockExtractRows = (data) => data.value || [];

    const result = await getCostCenter(
        { costCenter: '10101001', top: 5 },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.costCenters[0].CostCenter, '10101001');
    assert.strictEqual(result.costCenters[0].texts.length, 1);
    assert.strictEqual(result.costCenters[0].texts[0].CostCenterName, '管理部门成本中心');
    assert.strictEqual(calls.length, 2, 'should make 2 calls: main + text');
}

async function testGetCostCenterWithoutText() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        return { value: [{ ControllingArea: 'A000', CostCenter: '10101001' }] };
    };
    const mockExtractRows = (data) => data.value || [];

    const result = await getCostCenter(
        { costCenter: '10101001', includeText: false, top: 1 },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.costCenters[0].texts, undefined);
    assert.strictEqual(calls.length, 1, 'should only make 1 call without text');
}

async function testGetCostCenterEmptyResult() {
    const mockSapFetch = async () => ({ value: [] });
    const mockExtractRows = (data) => data.value || [];

    const result = await getCostCenter(
        { controllingArea: 'Z999' },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 0);
    assert.deepStrictEqual(result.costCenters, []);
}

async function testGetCostCenterNoFilterThrows() {
    const mockSapFetch = async () => ({ value: [] });
    const mockExtractRows = (data) => data.value || [];

    try {
        await getCostCenter({}, { sapFetch: mockSapFetch, extractRows: mockExtractRows });
        assert.fail('should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function testGetCostCenterTextFailureGraceful() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        if (url.includes('A_CostCenter_2?')) {
            return { value: [{ CostCenter: '10101001', ControllingArea: 'A000' }] };
        }
        // Text query fails
        throw { code: 'SAP_HTTP_500', message: 'Text API down' };
    };
    const mockExtractRows = (data) => data.value || [];

    const result = await getCostCenter(
        { costCenter: '10101001' },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    // 主查询成功，text 查询失败不应中断
    assert.strictEqual(result.count, 1);
    assert.deepStrictEqual(result.costCenters[0].texts, [], 'text fallback should be empty array');
}

// ════════════════════════════════════════════════════
// Runner
// ════════════════════════════════════════════════════

async function run() {
    // 同步测试
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateWithMultipleFilters();
    testValidateRejectsNonStringCostCenter();
    testBuildFilterSingleCostCenter();
    testBuildFilterMultipleCostCenters();
    testBuildFilterControllingArea();
    testBuildFilterCompanyCode();
    testBuildFilterCombined();
    testBuildFilterEmptyArgs();
    testBuildUrlWithFilter();
    testBuildUrlWithoutFilter();
    testBuildUrlTopCapped();
    testBuildTextUrl();

    // 异步测试
    await testGetCostCenterSuccess();
    await testGetCostCenterWithoutText();
    await testGetCostCenterEmptyResult();
    await testGetCostCenterNoFilterThrows();
    await testGetCostCenterTextFailureGraceful();

    console.log('  ✅ cost-center.test.js — all passed');
}

module.exports = { run };
