/**
 * tests/unit/purchase-order.test.js
 */
const assert = require('assert');
const { getPurchaseOrder, validatePOInput, buildPOFilter, buildPOUrl, buildItemsUrl } = require('../../services/purchase-order');
const { ErrorCodes } = require('../../lib/errors');

function testValidate() {
    assert.strictEqual(validatePOInput({}).valid, false);
    assert.strictEqual(validatePOInput({ purchaseOrder: '4500000001' }).valid, true);
    assert.strictEqual(validatePOInput({ supplier: '1000001' }).valid, true);
    assert.strictEqual(validatePOInput({ companyCode: '1010' }).valid, true);
}

function testFilter() {
    assert.strictEqual(buildPOFilter({ purchaseOrder: '4500000001' }), "PurchaseOrder eq '4500000001'");
    const f = buildPOFilter({ supplier: '1000001', companyCode: '1010' });
    assert.ok(f.includes("Supplier eq '1000001'"));
    assert.ok(f.includes(' and '));
}

function testUrl() {
    const url = buildPOUrl("PurchaseOrder eq '45'", 10);
    assert.ok(url.includes('A_PurchaseOrder?'));
    assert.ok(url.includes('$format=json'));
    assert.ok(url.includes('$top=10'));
}

function testItemsUrl() {
    const url = buildItemsUrl('4500000001', 50);
    assert.ok(url.includes('A_PurchaseOrderItem?'));
    assert.ok(url.includes('$top=50'));
    assert.ok(url.includes('4500000001'));
}

async function testGetPO() {
    const calls = [];
    const deps = {
        sapFetch: async (url) => {
            calls.push(url);
            if (url.includes('A_PurchaseOrder?')) return { d: { results: [{ PurchaseOrder: '4500000001', Supplier: '1000001', CompanyCode: '1010' }] } };
            if (url.includes('A_PurchaseOrderItem?')) return { d: { results: [{ PurchaseOrder: '4500000001', PurchaseOrderItem: '10', Material: 'MAT001', OrderQuantity: '100' }] } };
            return { d: { results: [] } };
        },
        extractRows: (d) => d.d?.results || [],
    };
    const r = await getPurchaseOrder({ purchaseOrder: '4500000001' }, deps);
    assert.strictEqual(r.count, 1);
    assert.strictEqual(r.purchaseOrders[0].items.length, 1);
    assert.strictEqual(r.purchaseOrders[0].items[0].Material, 'MAT001');
    assert.strictEqual(calls.length, 2);
}

async function run() {
    testValidate();
    testFilter();
    testUrl();
    testItemsUrl();
    await testGetPO();
    console.log('  ✅ purchase-order.test.js — all passed');
}
module.exports = { run };
