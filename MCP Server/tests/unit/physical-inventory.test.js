/**
 * tests/unit/physical-inventory.test.js
 * US-API-025: Physical Inventory 服务单元测试
 */
const assert = require('assert');
const {
    getPhysicalInventory,
    validatePhysicalInventoryInput,
    buildPhysicalInventoryFilter,
    buildPhysicalInventoryUrl,
} = require('../../services/physical-inventory');
const { ErrorCodes } = require('../../lib/errors');

function testValidateRequiresAtLeastOneFilter() {
    const r = validatePhysicalInventoryInput({});
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validatePhysicalInventoryInput({ physicalInventoryDocument: '1000000001' }).valid, true);
    assert.strictEqual(validatePhysicalInventoryInput({ plant: '1010' }).valid, true);
    assert.strictEqual(validatePhysicalInventoryInput({ material: 'MAT001' }).valid, true);
}

function testValidateRejectsNonStringDocument() {
    const r = validatePhysicalInventoryInput({ physicalInventoryDocument: 12345 });
    assert.strictEqual(r.valid, false);
}

function testBuildFilterSingleDocument() {
    const filter = buildPhysicalInventoryFilter({ physicalInventoryDocument: '1000000001' });
    assert.strictEqual(filter, "PhysicalInventoryDocument eq '1000000001'");
}

function testBuildFilterMultipleDocuments() {
    const filter = buildPhysicalInventoryFilter({ physicalInventoryDocument: '1000000001, 1000000002' });
    assert.ok(filter.includes('PhysicalInventoryDocument in ('));
}

function testBuildPhysicalInventoryUrl() {
    const url = buildPhysicalInventoryUrl("PhysicalInventoryDocument eq '1000000001'", 10);
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('api_physicalinventorydocument'));
}

async function testGetPhysicalInventorySuccess() {
    const mockSapFetch = async () => ({
        value: [{ PhysicalInventoryDocument: '1000000001', Plant: '1010' }],
    });
    const extractRows = (data) => data.value || [];

    const result = await getPhysicalInventory(
        { physicalInventoryDocument: '1000000001', includeItems: false },
        { sapFetch: mockSapFetch, extractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.documents[0].PhysicalInventoryDocument, '1000000001');
}

async function testGetPhysicalInventoryValidationFailure() {
    try {
        await getPhysicalInventory({}, { sapFetch: async () => ({}), extractRows: () => [] });
        assert.fail('Should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function run() {
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateRejectsNonStringDocument();
    testBuildFilterSingleDocument();
    testBuildFilterMultipleDocuments();
    testBuildPhysicalInventoryUrl();
    await testGetPhysicalInventorySuccess();
    await testGetPhysicalInventoryValidationFailure();
    console.log('  ✅ physical-inventory.test.js — all passed');
}

module.exports = { run };
