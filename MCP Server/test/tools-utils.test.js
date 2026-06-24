const assert = require('assert');
const { z } = require('zod');
const { formatSapError } = require('../mcp-sap-core');
const { splitExpandedLineItems } = require('../lib/tools');
const pkg = require('../package.json');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

console.log('Tools utils tests (B1–B4)\n');

// --- B1: splitExpandedLineItems ---
test('B1: PO expand splits _PurchaseOrderItem', () => {
  const input = [{
    PurchaseOrder: '4500000000',
    _PurchaseOrderItem: [{ PurchaseOrderItem: '10', Material: 'MAT001' }],
  }];
  const { results, items } = splitExpandedLineItems(input, '_PurchaseOrderItem');
  assert.strictEqual(results[0]._PurchaseOrderItem, undefined);
  assert.strictEqual(items[0].PurchaseOrderItem, '10');
});

test('B1: SO expand splits to_Item', () => {
  const input = [{ SalesOrder: '19', to_Item: [{ SalesOrderItem: '10' }] }];
  const { results, items } = splitExpandedLineItems(input, 'to_Item');
  assert.strictEqual(results[0].to_Item, undefined);
  assert.strictEqual(items[0].SalesOrderItem, '10');
});

test('B1: empty expand yields empty items', () => {
  const { results, items } = splitExpandedLineItems([{ PurchaseOrder: '1' }], 'to_PurchaseOrderItem');
  assert.strictEqual(results.length, 1);
  assert.deepStrictEqual(items, []);
});

// --- B2: formatSapError ---
test('B2: HTTP 400 maps to SAP_BAD_REQUEST', () => {
  const err = formatSapError(400, 'Invalid filter');
  assert.strictEqual(err.error, 'SAP_BAD_REQUEST');
  assert.ok(err.message.includes('Invalid filter'));
});

test('B2: HTTP 503 maps to SAP_SERVICE_UNAVAILABLE', () => {
  const err = formatSapError(503, 'unavailable');
  assert.strictEqual(err.error, 'SAP_SERVICE_UNAVAILABLE');
});

test('B2: HTTP 401 still SAP_AUTH_FAILED', () => {
  const err = formatSapError(401, '');
  assert.strictEqual(err.error, 'SAP_AUTH_FAILED');
});

// --- B3: package version ---
test('B3: package.json version is readable', () => {
  assert.strictEqual(typeof pkg.version, 'string');
  assert.ok(pkg.version.length > 0);
});

// --- B4: zod top max (E2) ---
test('B4: top 5000 fails zod max(1000)', () => {
  const schema = z.number().int().min(1).max(1000);
  assert.throws(() => schema.parse(5000));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
