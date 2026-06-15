/**
 * tests/unit/service-entry-sheet.test.js
 * US-API-009: Service Entry Sheet 服务单元测试
 */
const assert = require('assert');
const {
    getServiceEntrySheet,
    validateServiceEntryInput,
    buildServiceEntryFilter,
    buildServiceEntryUrl,
} = require('../../services/service-entry-sheet');
const { ErrorCodes } = require('../../lib/errors');

function testValidateRequiresAtLeastOneFilter() {
    const r = validateServiceEntryInput({});
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validateServiceEntryInput({ serviceEntrySheet: '1000000001' }).valid, true);
    assert.strictEqual(validateServiceEntryInput({ purchaseOrder: '4500000001' }).valid, true);
    assert.strictEqual(validateServiceEntryInput({ supplier: '1000001' }).valid, true);
}

function testValidateRejectsNonStringSheet() {
    const r = validateServiceEntryInput({ serviceEntrySheet: 12345 });
    assert.strictEqual(r.valid, false);
}

function testBuildFilterSingleSheet() {
    const filter = buildServiceEntryFilter({ serviceEntrySheet: '1000000001' });
    assert.strictEqual(filter, "ServiceEntrySheet eq '1000000001'");
}

function testBuildFilterMultipleSheets() {
    const filter = buildServiceEntryFilter({ serviceEntrySheet: '1000000001, 1000000002' });
    assert.ok(filter.includes('ServiceEntrySheet in ('));
}

function testBuildServiceEntryUrl() {
    const url = buildServiceEntryUrl("ServiceEntrySheet eq '1000000001'", 10);
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('A_ServiceEntrySheet'));
}

async function testGetServiceEntrySheetSuccess() {
    const mockSapFetch = async () => ({
        d: { results: [{ ServiceEntrySheet: '1000000001', PurchaseOrder: '4500000001' }] },
    });
    const extractRows = (data) => (data.d && data.d.results) || [];

    const result = await getServiceEntrySheet(
        { serviceEntrySheet: '1000000001' },
        { sapFetch: mockSapFetch, extractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.serviceEntrySheets[0].ServiceEntrySheet, '1000000001');
}

async function testGetServiceEntrySheetValidationFailure() {
    try {
        await getServiceEntrySheet({}, { sapFetch: async () => ({}), extractRows: () => [] });
        assert.fail('Should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function run() {
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateRejectsNonStringSheet();
    testBuildFilterSingleSheet();
    testBuildFilterMultipleSheets();
    testBuildServiceEntryUrl();
    await testGetServiceEntrySheetSuccess();
    await testGetServiceEntrySheetValidationFailure();
    console.log('  ✅ service-entry-sheet.test.js — all passed');
}

module.exports = { run };
