/**
 * tests/unit/sales-contract.test.js
 * US-API-011: Sales Contract 服务单元测试
 */
const assert = require('assert');
const {
    getSalesContract,
    validateSalesContractInput,
    buildSalesContractFilter,
    buildSalesContractUrl,
    buildSalesContractItemsUrl,
} = require('../../services/sales-contract');
const { ErrorCodes } = require('../../lib/errors');

// ════════════════════════════════════════════════════
// validateSalesContractInput
// ════════════════════════════════════════════════════

function testValidateRequiresAtLeastOneFilter() {
    const r1 = validateSalesContractInput({});
    assert.strictEqual(r1.valid, false);
    assert.strictEqual(r1.error.code, ErrorCodes.INVALID_INPUT);

    const r2 = validateSalesContractInput({ salesContract: null, customer: null });
    assert.strictEqual(r2.valid, false);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validateSalesContractInput({ salesContract: '4000000001' }).valid, true);
    assert.strictEqual(validateSalesContractInput({ customer: '1000001' }).valid, true);
    assert.strictEqual(validateSalesContractInput({ salesOrganization: '1000' }).valid, true);
    assert.strictEqual(validateSalesContractInput({ distributionChannel: '10' }).valid, true);
    assert.strictEqual(validateSalesContractInput({ division: '00' }).valid, true);
}

function testValidateWithMultipleFilters() {
    assert.strictEqual(validateSalesContractInput({
        salesContract: '4000000001',
        customer: '1000001',
        salesOrganization: '1000',
    }).valid, true);
}

function testValidateRejectsNonStringSC() {
    const r = validateSalesContractInput({ salesContract: 12345 });
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

// ════════════════════════════════════════════════════
// buildSalesContractFilter
// ════════════════════════════════════════════════════

function testBuildFilterSingleSC() {
    const filter = buildSalesContractFilter({ salesContract: '4000000001' });
    assert.strictEqual(filter, "SalesContract eq '4000000001'");
}

function testBuildFilterMultipleSCs() {
    const filter = buildSalesContractFilter({ salesContract: '4000000001, 4000000002 , 4000000003' });
    assert.ok(filter.includes('SalesContract in ('), 'should use "in" for multiple values');
    assert.ok(filter.includes("'4000000001'"));
    assert.ok(filter.includes("'4000000002'"));
    assert.ok(filter.includes("'4000000003'"));
}

function testBuildFilterCustomer() {
    assert.strictEqual(
        buildSalesContractFilter({ customer: '1000001' }),
        "SoldToParty eq '1000001'"
    );
}

function testBuildFilterSalesOrg() {
    assert.strictEqual(
        buildSalesContractFilter({ salesOrganization: '1000' }),
        "SalesOrganization eq '1000'"
    );
}

function testBuildFilterDistChannel() {
    assert.strictEqual(
        buildSalesContractFilter({ distributionChannel: '10' }),
        "DistributionChannel eq '10'"
    );
}

function testBuildFilterDivision() {
    assert.strictEqual(
        buildSalesContractFilter({ division: '00' }),
        "Division eq '00'"
    );
}

function testBuildFilterCombined() {
    const filter = buildSalesContractFilter({
        salesContract: '4000000001',
        customer: '1000001',
        salesOrganization: '1000',
    });
    assert.ok(filter.includes("SalesContract eq '4000000001'"));
    assert.ok(filter.includes("SoldToParty eq '1000001'"));
    assert.ok(filter.includes("SalesOrganization eq '1000'"));
    assert.ok(filter.includes(' and '));
}

function testBuildFilterEmptyArgs() {
    assert.strictEqual(buildSalesContractFilter({}), '');
    assert.strictEqual(buildSalesContractFilter(null), '');
    assert.strictEqual(buildSalesContractFilter(), '');
}

// ════════════════════════════════════════════════════
// buildSalesContractUrl
// ════════════════════════════════════════════════════

function testBuildUrlWithFilter() {
    const url = buildSalesContractUrl("SalesContract eq '4000000001'", 10);
    assert.ok(url.includes('A_SalesContract?'));
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('$filter='));
}

function testBuildUrlWithoutFilter() {
    const url = buildSalesContractUrl('', 5);
    assert.ok(url.includes('$top=5'));
    assert.ok(!url.includes('$filter'));
}

function testBuildUrlTopCapped() {
    const url = buildSalesContractUrl('', 999);
    assert.ok(url.includes('$top=100'));
}

// ════════════════════════════════════════════════════
// buildSalesContractItemsUrl
// ════════════════════════════════════════════════════

function testBuildItemsUrl() {
    const url = buildSalesContractItemsUrl('4000000001', 10);
    assert.ok(url.includes('A_SalesContractItem?'));
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('SalesContract'));
    assert.ok(url.includes('$filter='));
}

// ════════════════════════════════════════════════════
// getSalesContract DI Mock
// ════════════════════════════════════════════════════

async function testGetSalesContractSuccess() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        if (url.includes('A_SalesContract?')) {
            return {
                value: [{
                    SalesContract: '4000000001',
                    SoldToParty: '1000001',
                    SalesOrganization: '1000',
                    DistributionChannel: '10',
                    Division: '00',
                }],
            };
        }
        if (url.includes('A_SalesContractItem?')) {
            return {
                value: [{
                    SalesContract: '4000000001',
                    SalesContractItem: '00010',
                    Material: 'MAT001',
                    TargetQuantity: 50,
                }],
            };
        }
        return { value: [] };
    };
    const mockExtractRows = (data) => data.value || [];

    const result = await getSalesContract(
        { salesContract: '4000000001', top: 5 },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.salesContracts[0].SalesContract, '4000000001');
    assert.strictEqual(result.salesContracts[0].items.length, 1);
    assert.strictEqual(result.salesContracts[0].items[0].Material, 'MAT001');
    assert.strictEqual(calls.length, 2, 'should make 2 calls: main + items');
}

async function testGetSalesContractWithoutItems() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        return { value: [{ SalesContract: '4000000001' }] };
    };
    const mockExtractRows = (data) => data.value || [];

    const result = await getSalesContract(
        { salesContract: '4000000001', includeItems: false, top: 1 },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.salesContracts[0].items, undefined);
    assert.strictEqual(calls.length, 1, 'should only make 1 call without items');
}

async function testGetSalesContractEmptyResult() {
    const mockSapFetch = async () => ({ value: [] });
    const mockExtractRows = (data) => data.value || [];

    const result = await getSalesContract(
        { customer: 'Z999' },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 0);
    assert.deepStrictEqual(result.salesContracts, []);
}

async function testGetSalesContractNoFilterThrows() {
    const mockSapFetch = async () => ({ value: [] });
    const mockExtractRows = (data) => data.value || [];

    try {
        await getSalesContract({}, { sapFetch: mockSapFetch, extractRows: mockExtractRows });
        assert.fail('should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function testGetSalesContractItemsFailureGraceful() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        if (url.includes('A_SalesContract?')) {
            return { value: [{ SalesContract: '4000000001' }] };
        }
        throw { code: 'SAP_HTTP_500', message: 'Items API down' };
    };
    const mockExtractRows = (data) => data.value || [];

    const result = await getSalesContract(
        { salesContract: '4000000001' },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.deepStrictEqual(result.salesContracts[0].items, [], 'items fallback should be empty array');
}

// ════════════════════════════════════════════════════
// Runner
// ════════════════════════════════════════════════════

async function run() {
    // 同步测试
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateWithMultipleFilters();
    testValidateRejectsNonStringSC();
    testBuildFilterSingleSC();
    testBuildFilterMultipleSCs();
    testBuildFilterCustomer();
    testBuildFilterSalesOrg();
    testBuildFilterDistChannel();
    testBuildFilterDivision();
    testBuildFilterCombined();
    testBuildFilterEmptyArgs();
    testBuildUrlWithFilter();
    testBuildUrlWithoutFilter();
    testBuildUrlTopCapped();
    testBuildItemsUrl();

    // 异步测试
    await testGetSalesContractSuccess();
    await testGetSalesContractWithoutItems();
    await testGetSalesContractEmptyResult();
    await testGetSalesContractNoFilterThrows();
    await testGetSalesContractItemsFailureGraceful();

    console.log('  ✅ sales-contract.test.js — all passed');
}

module.exports = { run };
