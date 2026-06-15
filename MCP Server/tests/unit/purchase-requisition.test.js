/**
 * tests/unit/purchase-requisition.test.js
 * US-API-004: Purchase Requisition 服务单元测试
 */
const assert = require('assert');
const {
    getPurchaseRequisition,
    validatePurReqInput,
    buildPurReqFilter,
    buildPurReqUrl,
    buildPurReqItemsUrl,
} = require('../../services/purchase-requisition');
const { ErrorCodes } = require('../../lib/errors');

// ════════════════════════════════════════════════════
// validatePurReqInput
// ════════════════════════════════════════════════════

function testValidateRequiresAtLeastOneFilter() {
    const r1 = validatePurReqInput({});
    assert.strictEqual(r1.valid, false);
    assert.strictEqual(r1.error.code, ErrorCodes.INVALID_INPUT);

    const r2 = validatePurReqInput({ purchaseRequisition: null, purchasingOrganization: null });
    assert.strictEqual(r2.valid, false);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validatePurReqInput({ purchaseRequisition: '1000001' }).valid, true);
    assert.strictEqual(validatePurReqInput({ purchasingOrganization: '1000' }).valid, true);
    assert.strictEqual(validatePurReqInput({ purchasingGroup: '001' }).valid, true);
    assert.strictEqual(validatePurReqInput({ supplier: '1000001' }).valid, true);
}

function testValidateWithMultipleFilters() {
    assert.strictEqual(validatePurReqInput({
        purchaseRequisition: '1000001',
        purchasingOrganization: '1000',
        supplier: '1000001',
    }).valid, true);
}

function testValidateRejectsNonStringPR() {
    const r = validatePurReqInput({ purchaseRequisition: 12345 });
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

// ════════════════════════════════════════════════════
// buildPurReqFilter
// ════════════════════════════════════════════════════

function testBuildFilterSinglePR() {
    const filter = buildPurReqFilter({ purchaseRequisition: '1000001' });
    assert.strictEqual(filter, "PurchaseRequisition eq '1000001'");
}

function testBuildFilterMultiplePRs() {
    const filter = buildPurReqFilter({ purchaseRequisition: '1000001, 1000002 , 1000003' });
    assert.ok(filter.includes('PurchaseRequisition in ('), 'should use "in" for multiple values');
    assert.ok(filter.includes("'1000001'"));
    assert.ok(filter.includes("'1000002'"));
    assert.ok(filter.includes("'1000003'"));
}

function testBuildFilterPurchasingOrg() {
    assert.strictEqual(
        buildPurReqFilter({ purchasingOrganization: '1000' }),
        "PurchasingOrganization eq '1000'"
    );
}

function testBuildFilterPurchasingGroup() {
    assert.strictEqual(
        buildPurReqFilter({ purchasingGroup: '001' }),
        "PurchasingGroup eq '001'"
    );
}

function testBuildFilterSupplier() {
    assert.strictEqual(
        buildPurReqFilter({ supplier: '1000001' }),
        "Supplier eq '1000001'"
    );
}

function testBuildFilterCombined() {
    const filter = buildPurReqFilter({
        purchaseRequisition: '1000001',
        purchasingOrganization: '1000',
        supplier: '1000001',
    });
    assert.ok(filter.includes("PurchaseRequisition eq '1000001'"));
    assert.ok(filter.includes("PurchasingOrganization eq '1000'"));
    assert.ok(filter.includes("Supplier eq '1000001'"));
    assert.ok(filter.includes(' and '));
}

function testBuildFilterEmptyArgs() {
    assert.strictEqual(buildPurReqFilter({}), '');
    assert.strictEqual(buildPurReqFilter(null), '');
    assert.strictEqual(buildPurReqFilter(), '');
}

// ════════════════════════════════════════════════════
// buildPurReqUrl
// ════════════════════════════════════════════════════

function testBuildUrlWithFilter() {
    const url = buildPurReqUrl("PurchaseRequisition eq '1000001'", 10);
    assert.ok(url.includes('A_PurchaseRequisition?'));
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('$filter='));
}

function testBuildUrlWithoutFilter() {
    const url = buildPurReqUrl('', 5);
    assert.ok(url.includes('$top=5'));
    assert.ok(!url.includes('$filter'));
}

function testBuildUrlTopCapped() {
    const url = buildPurReqUrl('', 999);
    assert.ok(url.includes('$top=100'));
}

// ════════════════════════════════════════════════════
// buildPurReqItemsUrl
// ════════════════════════════════════════════════════

function testBuildItemsUrl() {
    const url = buildPurReqItemsUrl('1000001', 10);
    assert.ok(url.includes('A_PurchaseRequisitionItem?'));
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('PurchaseRequisition'));
    assert.ok(url.includes('$filter='));
}

// ════════════════════════════════════════════════════
// getPurchaseRequisition DI Mock
// ════════════════════════════════════════════════════

async function testGetPurReqSuccess() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        if (url.includes('A_PurchaseRequisition?')) {
            return {
                value: [{
                    PurchaseRequisition: '1000001',
                    PurchasingOrganization: '1000',
                    PurchasingGroup: '001',
                    Supplier: '1000001',
                }],
            };
        }
        if (url.includes('A_PurchaseRequisitionItem?')) {
            return {
                value: [{
                    PurchaseRequisition: '1000001',
                    PurchaseRequisitionItem: '00010',
                    Material: 'MAT001',
                    Quantity: 10,
                }],
            };
        }
        return { value: [] };
    };
    const mockExtractRows = (data) => data.value || [];

    const result = await getPurchaseRequisition(
        { purchaseRequisition: '1000001', top: 5 },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.purchaseRequisitions[0].PurchaseRequisition, '1000001');
    assert.strictEqual(result.purchaseRequisitions[0].items.length, 1);
    assert.strictEqual(result.purchaseRequisitions[0].items[0].Material, 'MAT001');
    assert.strictEqual(calls.length, 2, 'should make 2 calls: main + items');
}

async function testGetPurReqWithoutItems() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        return { value: [{ PurchaseRequisition: '1000001' }] };
    };
    const mockExtractRows = (data) => data.value || [];

    const result = await getPurchaseRequisition(
        { purchaseRequisition: '1000001', includeItems: false, top: 1 },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.purchaseRequisitions[0].items, undefined);
    assert.strictEqual(calls.length, 1, 'should only make 1 call without items');
}

async function testGetPurReqEmptyResult() {
    const mockSapFetch = async () => ({ value: [] });
    const mockExtractRows = (data) => data.value || [];

    const result = await getPurchaseRequisition(
        { purchasingOrganization: 'Z999' },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 0);
    assert.deepStrictEqual(result.purchaseRequisitions, []);
}

async function testGetPurReqNoFilterThrows() {
    const mockSapFetch = async () => ({ value: [] });
    const mockExtractRows = (data) => data.value || [];

    try {
        await getPurchaseRequisition({}, { sapFetch: mockSapFetch, extractRows: mockExtractRows });
        assert.fail('should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function testGetPurReqItemsFailureGraceful() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        if (url.includes('A_PurchaseRequisition?')) {
            return { value: [{ PurchaseRequisition: '1000001' }] };
        }
        throw { code: 'SAP_HTTP_500', message: 'Items API down' };
    };
    const mockExtractRows = (data) => data.value || [];

    const result = await getPurchaseRequisition(
        { purchaseRequisition: '1000001' },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.deepStrictEqual(result.purchaseRequisitions[0].items, [], 'items fallback should be empty array');
}

// ════════════════════════════════════════════════════
// Runner
// ════════════════════════════════════════════════════

async function run() {
    // 同步测试
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateWithMultipleFilters();
    testValidateRejectsNonStringPR();
    testBuildFilterSinglePR();
    testBuildFilterMultiplePRs();
    testBuildFilterPurchasingOrg();
    testBuildFilterPurchasingGroup();
    testBuildFilterSupplier();
    testBuildFilterCombined();
    testBuildFilterEmptyArgs();
    testBuildUrlWithFilter();
    testBuildUrlWithoutFilter();
    testBuildUrlTopCapped();
    testBuildItemsUrl();

    // 异步测试
    await testGetPurReqSuccess();
    await testGetPurReqWithoutItems();
    await testGetPurReqEmptyResult();
    await testGetPurReqNoFilterThrows();
    await testGetPurReqItemsFailureGraceful();

    console.log('  ✅ purchase-requisition.test.js — all passed');
}

module.exports = { run };
