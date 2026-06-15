/**
 * tests/unit/purchase-rfq.test.js
 * US-API-007: Purchase RFQ 服务单元测试
 */
const assert = require('assert');
const {
    getPurchaseRfq,
    validateRfqInput,
    buildRfqFilter,
    buildRfqUrl,
} = require('../../services/purchase-rfq');
const { ErrorCodes } = require('../../lib/errors');

function testValidateRequiresAtLeastOneFilter() {
    const r = validateRfqInput({});
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validateRfqInput({ purchaseRequisition: '5500000001' }).valid, true);
    assert.strictEqual(validateRfqInput({ purchasingOrganization: '1000' }).valid, true);
    assert.strictEqual(validateRfqInput({ supplier: '1000001' }).valid, true);
}

function testValidateRejectsNonStringRfq() {
    const r = validateRfqInput({ purchaseRequisition: 12345 });
    assert.strictEqual(r.valid, false);
}

function testBuildFilterSingleRfq() {
    const filter = buildRfqFilter({ purchaseRequisition: '5500000001' });
    assert.ok(filter.includes("PurchaseRequisition eq '5500000001'"));
    assert.ok(filter.includes("PurchaseRequisitionType eq 'RF'"));
}

function testBuildFilterMultipleRfqs() {
    const filter = buildRfqFilter({ purchaseRequisition: '5500000001, 5500000002' });
    assert.ok(filter.includes('PurchaseRequisition in ('));
    assert.ok(filter.includes("PurchaseRequisitionType eq 'RF'"));
}

function testBuildPurchaseRfqUrl() {
    const url = buildRfqUrl("PurchaseRequisition eq '5500000001'", 10);
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('A_PurchaseRequisition'));
}

async function testGetPurchaseRfqSuccess() {
    const mockSapFetch = async () => ({
        value: [{ PurchaseRequisition: '5500000001', PurchasingOrganization: '1000' }],
    });
    const extractRows = (data) => data.value || [];

    const result = await getPurchaseRfq(
        { purchaseRequisition: '5500000001' },
        { sapFetch: mockSapFetch, extractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.rfqs[0].PurchaseRequisition, '5500000001');
}

async function testGetPurchaseRfqValidationFailure() {
    try {
        await getPurchaseRfq({}, { sapFetch: async () => ({}), extractRows: () => [] });
        assert.fail('Should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function run() {
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateRejectsNonStringRfq();
    testBuildFilterSingleRfq();
    testBuildFilterMultipleRfqs();
    testBuildPurchaseRfqUrl();
    await testGetPurchaseRfqSuccess();
    await testGetPurchaseRfqValidationFailure();
    console.log('  ✅ purchase-rfq.test.js — all passed');
}

module.exports = { run };
