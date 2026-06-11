/**
 * tests/unit/material-stock.test.js
 */
const assert = require('assert');
const { getMaterialStock, validateStockInput, buildStockFilter, buildStockUrl } = require('../../services/material-stock');
const { ErrorCodes } = require('../../lib/errors');

function testValidate() {
    assert.strictEqual(validateStockInput({}).valid, false);
    assert.strictEqual(validateStockInput({ material: 'MAT001' }).valid, true);
    assert.strictEqual(validateStockInput({ plant: '1010' }).valid, true);
}

function testFilter() {
    assert.strictEqual(buildStockFilter({ material: 'MAT001' }), "Material eq 'MAT001'");
    const f = buildStockFilter({ material: 'MAT001', plant: '1010', storageLocation: '0001' });
    assert.ok(f.includes(' and '));
    assert.ok(f.includes("StorageLocation eq '0001'"));
}

function testUrl() {
    const url = buildStockUrl("Material eq 'MAT001'", 10);
    assert.ok(url.includes('A_MatlStkInAcctMod?'));
    assert.ok(url.includes('$format=json'));
    assert.ok(url.includes('$top=10'));
}

async function testGetStock() {
    const deps = {
        sapFetch: async () => ({ d: { results: [{ Material: 'MAT001', Plant: '1010', MatlWrhsStkQtyInMatlBaseUnit: '500' }] } }),
        extractRows: (d) => d.d?.results || [],
    };
    const r = await getMaterialStock({ material: 'MAT001' }, deps);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.stocks[0].MatlWrhsStkQtyInMatlBaseUnit, '500');
}

async function run() {
    testValidate(); testFilter(); testUrl();
    await testGetStock();
    console.log('  ✅ material-stock.test.js — all passed');
}
module.exports = { run };
