/**
 * tests/unit/material-reservation.test.js
 * US-API-024: Material Reservation 服务单元测试
 */
const assert = require('assert');
const {
    getMaterialReservation,
    validateReservationInput,
    buildReservationFilter,
    buildReservationUrl,
    buildReservationItemsUrl,
} = require('../../services/material-reservation');
const { ErrorCodes } = require('../../lib/errors');

// ════════════════════════════════════════════════════
// validateReservationInput
// ════════════════════════════════════════════════════

function testValidateRequiresAtLeastOneFilter() {
    const r1 = validateReservationInput({});
    assert.strictEqual(r1.valid, false);
    assert.strictEqual(r1.error.code, ErrorCodes.INVALID_INPUT);

    const r2 = validateReservationInput({ reservation: null, material: null });
    assert.strictEqual(r2.valid, false);
}

function testValidateWithSingleFilter() {
    assert.strictEqual(validateReservationInput({ reservation: '10000001' }).valid, true);
    assert.strictEqual(validateReservationInput({ material: 'MAT001' }).valid, true);
    assert.strictEqual(validateReservationInput({ plant: '1000' }).valid, true);
    assert.strictEqual(validateReservationInput({ requirementNumber: 'REQ001' }).valid, true);
}

function testValidateWithMultipleFilters() {
    assert.strictEqual(validateReservationInput({
        reservation: '10000001',
        material: 'MAT001',
        plant: '1000',
    }).valid, true);
}

function testValidateRejectsNonStringReservation() {
    const r = validateReservationInput({ reservation: 12345 });
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

// ════════════════════════════════════════════════════
// buildReservationFilter
// ════════════════════════════════════════════════════

function testBuildFilterSingleReservation() {
    const filter = buildReservationFilter({ reservation: '10000001' });
    assert.strictEqual(filter, "Reservation eq '10000001'");
}

function testBuildFilterMultipleReservations() {
    const filter = buildReservationFilter({ reservation: '10000001, 10000002 , 10000003' });
    assert.ok(filter.includes('Reservation in ('), 'should use "in" for multiple values');
    assert.ok(filter.includes("'10000001'"));
    assert.ok(filter.includes("'10000002'"));
    assert.ok(filter.includes("'10000003'"));
}

function testBuildFilterMaterial() {
    assert.strictEqual(
        buildReservationFilter({ material: 'MAT001' }),
        "Material eq 'MAT001'"
    );
}

function testBuildFilterPlant() {
    assert.strictEqual(
        buildReservationFilter({ plant: '1000' }),
        "Plant eq '1000'"
    );
}

function testBuildFilterRequirementNumber() {
    assert.strictEqual(
        buildReservationFilter({ requirementNumber: 'REQ001' }),
        "RequirementNumber eq 'REQ001'"
    );
}

function testBuildFilterCombined() {
    const filter = buildReservationFilter({
        reservation: '10000001',
        material: 'MAT001',
        plant: '1000',
    });
    assert.ok(filter.includes("Reservation eq '10000001'"));
    assert.ok(filter.includes("Material eq 'MAT001'"));
    assert.ok(filter.includes("Plant eq '1000'"));
    assert.ok(filter.includes(' and '));
}

function testBuildFilterEmptyArgs() {
    assert.strictEqual(buildReservationFilter({}), '');
    assert.strictEqual(buildReservationFilter(null), '');
    assert.strictEqual(buildReservationFilter(), '');
}

// ════════════════════════════════════════════════════
// buildReservationUrl
// ════════════════════════════════════════════════════

function testBuildUrlWithFilter() {
    const url = buildReservationUrl("Reservation eq '10000001'", 10);
    assert.ok(url.includes('A_ReservationDocument?'));
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('$filter='));
}

function testBuildUrlWithoutFilter() {
    const url = buildReservationUrl('', 5);
    assert.ok(url.includes('$top=5'));
    assert.ok(!url.includes('$filter'));
}

function testBuildUrlTopCapped() {
    const url = buildReservationUrl('', 999);
    assert.ok(url.includes('$top=100'));
}

// ════════════════════════════════════════════════════
// buildReservationItemsUrl
// ════════════════════════════════════════════════════

function testBuildItemsUrl() {
    const url = buildReservationItemsUrl('10000001', 10);
    assert.ok(url.includes('A_ReservationDocumentItem?'));
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('Reservation'));
    assert.ok(url.includes('$filter='));
}

// ════════════════════════════════════════════════════
// getMaterialReservation DI Mock
// ════════════════════════════════════════════════════

async function testGetReservationSuccess() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        if (url.includes('A_ReservationDocument?')) {
            return {
                value: [{
                    Reservation: '10000001',
                    Material: 'MAT001',
                    Plant: '1000',
                    RequirementQuantity: 100,
                    MovementType: '201',
                }],
            };
        }
        if (url.includes('A_ReservationDocumentItem?')) {
            return {
                value: [{
                    Reservation: '10000001',
                    ReservationItem: '00001',
                    Material: 'MAT001',
                    RequirementQuantity: 100,
                    BaseUnit: 'PC',
                }],
            };
        }
        return { value: [] };
    };
    const mockExtractRows = (data) => data.value || [];

    const result = await getMaterialReservation(
        { reservation: '10000001', top: 5 },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.reservations[0].Reservation, '10000001');
    assert.strictEqual(result.reservations[0].items.length, 1);
    assert.strictEqual(result.reservations[0].items[0].Material, 'MAT001');
    assert.strictEqual(calls.length, 2, 'should make 2 calls: main + items');
}

async function testGetReservationWithoutItems() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        return { value: [{ Reservation: '10000001' }] };
    };
    const mockExtractRows = (data) => data.value || [];

    const result = await getMaterialReservation(
        { reservation: '10000001', includeItems: false, top: 1 },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.reservations[0].items, undefined);
    assert.strictEqual(calls.length, 1, 'should only make 1 call without items');
}

async function testGetReservationEmptyResult() {
    const mockSapFetch = async () => ({ value: [] });
    const mockExtractRows = (data) => data.value || [];

    const result = await getMaterialReservation(
        { material: 'MAT_Z999' },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 0);
    assert.deepStrictEqual(result.reservations, []);
}

async function testGetReservationNoFilterThrows() {
    const mockSapFetch = async () => ({ value: [] });
    const mockExtractRows = (data) => data.value || [];

    try {
        await getMaterialReservation({}, { sapFetch: mockSapFetch, extractRows: mockExtractRows });
        assert.fail('should have thrown');
    } catch (err) {
        assert.strictEqual(err.code, ErrorCodes.INVALID_INPUT);
    }
}

async function testGetReservationItemsFailureGraceful() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        if (url.includes('A_ReservationDocument?')) {
            return { value: [{ Reservation: '10000001' }] };
        }
        throw { code: 'SAP_HTTP_500', message: 'Items API down' };
    };
    const mockExtractRows = (data) => data.value || [];

    const result = await getMaterialReservation(
        { reservation: '10000001' },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.count, 1);
    assert.deepStrictEqual(result.reservations[0].items, [], 'items fallback should be empty array');
}

// ════════════════════════════════════════════════════
// Runner
// ════════════════════════════════════════════════════

async function run() {
    // 同步测试
    testValidateRequiresAtLeastOneFilter();
    testValidateWithSingleFilter();
    testValidateWithMultipleFilters();
    testValidateRejectsNonStringReservation();
    testBuildFilterSingleReservation();
    testBuildFilterMultipleReservations();
    testBuildFilterMaterial();
    testBuildFilterPlant();
    testBuildFilterRequirementNumber();
    testBuildFilterCombined();
    testBuildFilterEmptyArgs();
    testBuildUrlWithFilter();
    testBuildUrlWithoutFilter();
    testBuildUrlTopCapped();
    testBuildItemsUrl();

    // 异步测试
    await testGetReservationSuccess();
    await testGetReservationWithoutItems();
    await testGetReservationEmptyResult();
    await testGetReservationNoFilterThrows();
    await testGetReservationItemsFailureGraceful();

    console.log('  ✅ material-reservation.test.js — all passed');
}

module.exports = { run };
