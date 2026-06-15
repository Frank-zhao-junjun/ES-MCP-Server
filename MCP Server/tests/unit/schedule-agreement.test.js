/**
 * tests/unit/schedule-agreement.test.js
 * US-API-005: Schedule Agreement 服务单元测试
 */
const assert = require('assert');
const {
    getScheduleAgreement,
    validateSchedAgmtInput,
    buildSchedAgmtFilter,
    buildSchedAgmtUrl,
    buildSchedAgmtItemsUrl,
} = require('../../services/schedule-agreement');
const { ErrorCodes } = require('../../lib/errors');

// ════════════════════════════════════════════════════
// validateSchedAgmtInput
// ════════════════════════════════════════════════════

function testValidateRequiresAtLeastOneFilter() {
    const r1 = validateSchedAgmtInput({});
    assert.strictEqual(r1.valid, false);
    assert.strictEqual(r1.error.code, ErrorCodes.INVALID_INPUT);

    const r2 = validateSchedAgmtInput({ scheduleAgreement: null, supplier: null });
    assert.strictEqual(r2.valid, false);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validateSchedAgmtInput({ scheduleAgreement: '5500000001' }).valid, true);
    assert.strictEqual(validateSchedAgmtInput({ supplier: '1000001' }).valid, true);
    assert.strictEqual(validateSchedAgmtInput({ purchasingOrganization: '1000' }).valid, true);
    assert.strictEqual(validateSchedAgmtInput({ purchasingGroup: '001' }).valid, true);
}

function testValidateWithMultipleFilters() {
    assert.strictEqual(validateSchedAgmtInput({
        scheduleAgreement: '5500000001',
        supplier: '1000001',
        purchasingOrganization: '1000',
    }).valid, true);
}

function testValidateRejectsNonStringSA() {
    const r = validateSchedAgmtInput({ scheduleAgreement: 12345 });
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

// ════════════════════════════════════════════════════
// buildSchedAgmtFilter
// ════════════════════════════════════════════════════

function testBuildFilterSingleSA() {
    const filter = buildSchedAgmtFilter({ scheduleAgreement: '5500000001' });
    assert.strictEqual(filter, "ScheduleAgreement eq '5500000001'");
}

function testBuildFilterMultipleSAs() {
    const filter = buildSchedAgmtFilter({ scheduleAgreement: '5500000001, 5500000002 , 5500000003' });
    assert.ok(filter.includes('ScheduleAgreement in ('), 'should use "in" for multiple values');
    assert.ok(filter.includes("'5500000001'"));
    assert.ok(filter.includes("'5500000002'"));
    assert.ok(filter.includes("'5500000003'"));
}

function testBuildFilterSupplier() {
    assert.strictEqual(
        buildSchedAgmtFilter({ supplier: '1000001' }),
        "Supplier eq '1000001'"
    );
}

function testBuildFilterPurchasingOrg() {
    assert.strictEqual(
        buildSchedAgmtFilter({ purchasingOrganization: '1000' }),
        "PurchasingOrganization eq '1000'"
    );
}

function testBuildFilterPurchasingGroup() {
    assert.strictEqual(
        buildSchedAgmtFilter({ purchasingGroup: '001' }),
        "PurchasingGroup eq '001'"
    );
}

function testBuildFilterCombined() {
    const filter = buildSchedAgmtFilter({
        scheduleAgreement: '5500000001',
        supplier: '1000001',
        purchasingOrganization: '1000',
    });
    assert.ok(filter.includes("ScheduleAgreement eq '5500000001'"));
    assert.ok(filter.includes("Supplier eq '1000001'"));
    assert.ok(filter.includes("PurchasingOrganization eq '1000'"));
    assert.ok(filter.includes(' and '));
}

function testBuildFilterEmptyArgs() {
    assert.strictEqual(buildSchedAgmtFilter({}), '');
    assert.strictEqual(buildSchedAgmtFilter(null), '');
    assert.strictEqual(buildSchedAgmtFilter(), '');
}

// ════════════════════════════════════════════════════
// buildSchedAgmtUrl
// ════════════════════════════════════════════════════

function testBuildUrlWithFilter() {
    const url = buildSchedAgmtUrl("ScheduleAgreement eq '5500000001'", 10);
    assert.ok(url.includes('A_ScheduleAgreement?'));
    assert.ok(url.includes('$format=json'));
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('$filter='));
}

function testBuildUrlWithoutFilter() {
    const url = buildSchedAgmtUrl('', 5);
    assert.ok(url.includes('$format=json'));
    assert.ok(url.includes('$top=5'));
    assert.ok(!url.includes('$filter'));
}

function testBuildUrlTopCapped() {
    const url = buildSchedAgmtUrl('', 999);
    assert.ok(url.includes('$top=100'));
}

// ════════════════════════════════════════════════════
// buildSchedAgmtItemsUrl
// ════════════════════════════════════════════════════

function testBuildItemsUrl() {
    const url = buildSchedAgmtItemsUrl('5500000001', 10);
    assert.ok(url.includes('A_ScheduleAgreementItem?'));
    assert.ok(url.includes('$format=json'));
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('ScheduleAgreement'));
    assert.ok(url.includes('$filter='));
}

// ════════════════════════════════════════════════════
// getScheduleAgreement DI Mock
// ════════════════════════════════════════════════════

async function testGetSchedAgmtSuccess() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        if (url.includes('A_ScheduleAgreement?')) {
            return {
                d: {
                    results: [{
                        ScheduleAgreement: '5500000001',
                        Supplier: '1000001',
                        PurchasingOrganization: '1000',
                        PurchasingGroup: '001',
                    }],
                },
            };
        }
        if (url.includes('A_ScheduleAgreementItem?')) {
            return {
                d: {
                    results: [{
                        ScheduleAgreement: '5500000001',
                        ScheduleAgreementItem: '00010',
                        Material: 'MAT001',
                        TargetQuantity: 100,
                    }],
                },
            };
        }
        return { d: { results: [] } };
    };
    const mockExtractRows = (data) => (data.d && data.d.results) || [];

    const result = await getScheduleAgreement(
        { scheduleAgreement: '5500000001', top: 5 },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.scheduleAgreements[0].ScheduleAgreement, '5500000001');
    assert.strictEqual(result.scheduleAgreements[0].items.length, 1);
    assert.strictEqual(result.scheduleAgreements[0].items[0].Material, 'MAT001');
    assert.strictEqual(calls.length, 2, 'should make 2 calls: main + items');
}

async function testGetSchedAgmtWithoutItems() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        return { d: { results: [{ ScheduleAgreement: '5500000001' }] } };
    };
    const mockExtractRows = (data) => (data.d && data.d.results) || [];

    const result = await getScheduleAgreement(
        { scheduleAgreement: '5500000001', includeItems: false, top: 1 },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.scheduleAgreements[0].items, undefined);
    assert.strictEqual(calls.length, 1, 'should only make 1 call without items');
}

async function testGetSchedAgmtEmptyResult() {
    const mockSapFetch = async () => ({ d: { results: [] } });
    const mockExtractRows = (data) => (data.d && data.d.results) || [];

    const result = await getScheduleAgreement(
        { supplier: 'Z999' },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 0);
    assert.deepStrictEqual(result.scheduleAgreements, []);
}

async function testGetSchedAgmtNoFilterThrows() {
    const mockSapFetch = async () => ({ d: { results: [] } });
    const mockExtractRows = (data) => (data.d && data.d.results) || [];

    try {
        await getScheduleAgreement({}, { sapFetch: mockSapFetch, extractRows: mockExtractRows });
        assert.fail('should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function testGetSchedAgmtItemsFailureGraceful() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        if (url.includes('A_ScheduleAgreement?')) {
            return { d: { results: [{ ScheduleAgreement: '5500000001' }] } };
        }
        throw { code: 'SAP_HTTP_500', message: 'Items API down' };
    };
    const mockExtractRows = (data) => (data.d && data.d.results) || [];

    const result = await getScheduleAgreement(
        { scheduleAgreement: '5500000001' },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.deepStrictEqual(result.scheduleAgreements[0].items, [], 'items fallback should be empty array');
}

// ════════════════════════════════════════════════════
// Runner
// ════════════════════════════════════════════════════

async function run() {
    // 同步测试
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateWithMultipleFilters();
    testValidateRejectsNonStringSA();
    testBuildFilterSingleSA();
    testBuildFilterMultipleSAs();
    testBuildFilterSupplier();
    testBuildFilterPurchasingOrg();
    testBuildFilterPurchasingGroup();
    testBuildFilterCombined();
    testBuildFilterEmptyArgs();
    testBuildUrlWithFilter();
    testBuildUrlWithoutFilter();
    testBuildUrlTopCapped();
    testBuildItemsUrl();

    // 异步测试
    await testGetSchedAgmtSuccess();
    await testGetSchedAgmtWithoutItems();
    await testGetSchedAgmtEmptyResult();
    await testGetSchedAgmtNoFilterThrows();
    await testGetSchedAgmtItemsFailureGraceful();

    console.log('  ✅ schedule-agreement.test.js — all passed');
}

module.exports = { run };
