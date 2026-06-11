/**
 * tests/unit/product.test.js
 * REQ-PRD: Product 服务单元测试
 */
const assert = require('assert');
const {
    getProduct, validateProductInput, buildProductFilter,
    buildProductUrl, buildDescriptionUrl,
} = require('../../services/product');
const { ErrorCodes } = require('../../lib/errors');

// ── validateProductInput ──
function testValidateRequiresFilter() {
    assert.strictEqual(validateProductInput({}).valid, false);
    assert.strictEqual(validateProductInput({ product: 'MAT001' }).valid, true);
    assert.strictEqual(validateProductInput({ productType: 'FERT' }).valid, true);
    assert.strictEqual(validateProductInput({ productGroup: 'PG1' }).valid, true);
}

function testValidateRejectsNonString() {
    const r = validateProductInput({ product: 123 });
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.error.code, ErrorCodes.INVALID_INPUT);
}

// ── buildProductFilter ──
function testBuildFilterSingle() {
    assert.strictEqual(buildProductFilter({ product: 'MAT001' }), "Product eq 'MAT001'");
}

function testBuildFilterMultiple() {
    const f = buildProductFilter({ product: 'MAT001, MAT002' });
    assert.ok(f.includes('Product in ('), 'should use "in" for multiple');
    assert.ok(f.includes("'MAT001'"));
    assert.ok(f.includes("'MAT002'"));
}

function testBuildFilterCombined() {
    const f = buildProductFilter({ product: 'MAT001', productType: 'FERT' });
    assert.ok(f.includes("Product eq 'MAT001'"));
    assert.ok(f.includes("ProductType eq 'FERT'"));
    assert.ok(f.includes(' and '));
}

function testBuildFilterEmpty() {
    assert.strictEqual(buildProductFilter({}), '');
    assert.strictEqual(buildProductFilter(), '');
}

// ── buildProductUrl ──
function testBuildUrlV2() {
    const url = buildProductUrl("Product eq 'MAT001'", 10);
    assert.ok(url.includes('API_PRODUCT_SRV/A_Product?'));
    assert.ok(url.includes('$format=json'), 'V2 must include $format=json');
    assert.ok(url.includes('$top=10'));
    assert.ok(url.includes('$filter='));
}

// ── buildDescriptionUrl ──
function testBuildDescriptionUrl() {
    const url = buildDescriptionUrl('MAT001');
    assert.ok(url.includes('A_ProductDescription?'));
    assert.ok(url.includes('$format=json'));
    assert.ok(url.includes('MAT001'));
}

// ── DI Mock: 正常查询 ──
async function testGetProductSuccess() {
    const calls = [];
    const deps = {
        sapFetch: async (url) => {
            calls.push(url);
            if (url.includes('A_Product?')) {
                return { d: { results: [{ Product: 'MAT001', ProductType: 'FERT', BaseUnit: 'PC' }] } };
            }
            if (url.includes('A_ProductDescription?')) {
                return { d: { results: [{ Product: 'MAT001', Language: 'ZH', ProductDescription: '成品A' }] } };
            }
            return { d: { results: [] } };
        },
        extractRows: (data) => data.d && data.d.results ? data.d.results : [],
    };

    const result = await getProduct({ product: 'MAT001', top: 5 }, deps);
    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.products[0].Product, 'MAT001');
    assert.strictEqual(result.products[0].descriptions.length, 1);
    assert.strictEqual(result.products[0].descriptions[0].ProductDescription, '成品A');
    assert.strictEqual(calls.length, 2);
}

async function testGetProductWithoutDescription() {
    const deps = {
        sapFetch: async () => ({ d: { results: [{ Product: 'MAT001' }] } }),
        extractRows: (data) => data.d && data.d.results ? data.d.results : [],
    };
    const result = await getProduct({ productType: 'FERT', includeDescription: false }, deps);
    assert.strictEqual(result.products[0].descriptions, undefined);
}

async function testGetProductNoFilterThrows() {
    try {
        await getProduct({}, { sapFetch: async () => ({}), extractRows: () => [] });
        assert.fail('should throw');
    } catch (e) {
        assert.strictEqual(e.code, ErrorCodes.INVALID_INPUT);
    }
}

async function run() {
    testValidateRequiresFilter();
    testValidateRejectsNonString();
    testBuildFilterSingle();
    testBuildFilterMultiple();
    testBuildFilterCombined();
    testBuildFilterEmpty();
    testBuildUrlV2();
    testBuildDescriptionUrl();
    await testGetProductSuccess();
    await testGetProductWithoutDescription();
    await testGetProductNoFilterThrows();
    console.log('  ✅ product.test.js — all passed');
}

module.exports = { run };
