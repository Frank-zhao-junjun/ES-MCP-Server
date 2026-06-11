const assert = require('assert');
const { getBOM, validateBOMInput, buildBOMFilter, buildBOMUrl } = require('../../services/bom');
const { ErrorCodes } = require('../../lib/errors');

function testValidate() {
    assert.strictEqual(validateBOMInput({}).valid, false);
    assert.strictEqual(validateBOMInput({ material: 'MAT001' }).valid, true);
    assert.strictEqual(validateBOMInput({ plant: '1010' }).valid, true);
}

function testFilter() {
    assert.strictEqual(buildBOMFilter({ material: 'MAT001' }), "Material eq 'MAT001'");
    const f = buildBOMFilter({ material: 'MAT001', plant: '1010' });
    assert.ok(f.includes(' and '));
    assert.ok(f.includes("Plant eq '1010'"));
}

function testUrl() {
    const url = buildBOMUrl("Material eq 'MAT001'", 10);
    assert.ok(url.includes('A_BillOfMaterial?'));
    assert.ok(url.includes('$format=json'));
    assert.ok(url.includes('$top=10'));
}

async function testGetBOM() {
    const deps = {
        sapFetch: async (url) => {
            if (url.includes('A_BillOfMaterial?')) return { d: { results: [{ BillOfMaterial: 'BOM001', Material: 'MAT001', Plant: '1010' }] } };
            return { d: { results: [{ BillOfMaterialItem: '0010', BillOfMaterialComponent: 'MAT002', ComponentQuantity: '5' }] } };
        },
        extractRows: (d) => d.d?.results || [],
    };
    const r = await getBOM({ material: 'MAT001' }, deps);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.billsOfMaterial[0].items[0].BillOfMaterialComponent, 'MAT002');
}

async function run() {
    testValidate(); testFilter(); testUrl();
    await testGetBOM();
    console.log('  ✅ bom.test.js — all passed');
}
module.exports = { run };
