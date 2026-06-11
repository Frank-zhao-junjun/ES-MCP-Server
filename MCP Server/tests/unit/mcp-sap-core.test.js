/**
 * tests/unit/mcp-sap-core.test.js
 * REQ-004: mcp-sap-core.js 纯函数单元测试
 */
const assert = require('assert');
const {
    isV2, isV4, extractRows, buildBasicAuth,
    buildQueryPath, normalizeScenarioKey, createSapContext,
} = require('../../mcp-sap-core');

// ── REQ-004-01: isV2 识别 ──
function testIsV2() {
    assert.strictEqual(isV2('/sap/opu/odata/sap/API_SRV'), true);
    assert.strictEqual(isV2('/sap/opu/odata/sap/API_SRV;v=0002/Entity'), true);
    assert.strictEqual(isV2('/sap/opu/odata/sap/'), true);
}

// ── REQ-004-02: isV4 识别 ──
function testIsV4() {
    assert.strictEqual(isV4('/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001'), true);
    assert.strictEqual(isV4('/sap/opu/odata4/sap/api_billingdocument/...'), true);
}

// ── isV2 / isV4 互斥 ──
function testIsV2NotV4() {
    const v2Url = '/sap/opu/odata/sap/API_SRV/Entity';
    assert.strictEqual(isV2(v2Url), true);
    assert.strictEqual(isV4(v2Url), false);
}

function testIsV4NotV2() {
    const v4Url = '/sap/opu/odata4/sap/xxx/0001/Entity';
    assert.strictEqual(isV4(v4Url), true);
    assert.strictEqual(isV2(v4Url), false);
}

function testNeitherV2NorV4() {
    assert.strictEqual(isV2('/some/random/url'), false);
    assert.strictEqual(isV4('/some/random/url'), false);
    assert.strictEqual(isV2(''), false);
    assert.strictEqual(isV4(''), false);
}

// ── REQ-004-03: extractRows V2 格式 ──
function testExtractRowsV2() {
    const data = { d: { results: [{ a: 1 }, { b: 2 }] } };
    const rows = extractRows(data);
    assert.strictEqual(rows.length, 2);
    assert.deepStrictEqual(rows[0], { a: 1 });
}

// ── REQ-004-04: extractRows V4 格式 ──
function testExtractRowsV4() {
    const data = { value: [{ x: 'hello' }, { y: 'world' }] };
    const rows = extractRows(data);
    assert.strictEqual(rows.length, 2);
    assert.deepStrictEqual(rows[1], { y: 'world' });
}

// ── REQ-004-05: extractRows 空/异常数据 ──
function testExtractRowsEdgeCases() {
    assert.deepStrictEqual(extractRows({}), []);
    assert.deepStrictEqual(extractRows(null), []);
    assert.deepStrictEqual(extractRows(undefined), []);
    assert.deepStrictEqual(extractRows({ d: {} }), []);
    assert.deepStrictEqual(extractRows({ d: { results: null } }), []);
    assert.deepStrictEqual(extractRows({ value: null }), []);
    assert.deepStrictEqual(extractRows('string'), []);
    assert.deepStrictEqual(extractRows(123), []);
}

// ── REQ-004-06: buildBasicAuth ──
function testBuildBasicAuth() {
    const auth = buildBasicAuth('myuser', 'mypass');
    const expected = Buffer.from('myuser:mypass', 'utf8').toString('base64');
    assert.strictEqual(auth, expected);
    assert.ok(auth.length > 0);
}

function testBuildBasicAuthSpecialChars() {
    const auth = buildBasicAuth('user@domain', 'p@ss:word!');
    const decoded = Buffer.from(auth, 'base64').toString('utf8');
    assert.strictEqual(decoded, 'user@domain:p@ss:word!');
}

// ── REQ-004-07: buildQueryPath V2 ──
function testBuildQueryPathV2() {
    const baseUrl = '/sap/opu/odata/sap/API_SRV';
    const result = buildQueryPath(baseUrl, 'Entity', "Name eq 'Test'", 10);

    assert.ok(result.startsWith('/sap/opu/odata/sap/API_SRV/Entity?'));
    assert.ok(result.includes('$format=json'));
    assert.ok(result.includes('sap-client=100'));
    assert.ok(result.includes('$top=10'));
    assert.ok(result.includes('$filter='), 'should include $filter param');
    assert.ok(result.includes('Name%20eq%20'), 'spaces should be encoded');
}

// ── REQ-004-08: buildQueryPath V4 ──
function testBuildQueryPathV4() {
    const baseUrl = '/sap/opu/odata4/sap/api/srvd_a2x/sap/entity/0001';
    const result = buildQueryPath(baseUrl, 'Entity', null, 5);

    assert.ok(result.startsWith(baseUrl + '/Entity?'));
    assert.ok(!result.includes('$format=json'), 'V4 should NOT include $format=json');
    assert.ok(result.includes('sap-client=100'));
    assert.ok(result.includes('$top=5'));
}

// ── buildQueryPath 无 filter ──
function testBuildQueryPathNoFilter() {
    const result = buildQueryPath('/sap/opu/odata/sap/SRV', 'E', null, 20);
    assert.ok(!result.includes('$filter'), 'should not include $filter when filter is null');
}

// ── buildQueryPath top 超限截断 ──
function testBuildQueryPathTopCapped() {
    const result = buildQueryPath('/sap/opu/odata/sap/SRV', 'E', null, 999);
    assert.ok(result.includes('$top=100'), 'top should be capped at MAX_TOP (100)');
}

// ── REQ-004-09: normalizeScenarioKey ──
function testNormalizeScenarioKey() {
    assert.strictEqual(
        normalizeScenarioKey('SAP_COM_0109', 'Sales Order'),
        'sap_com_0109_sales_order'
    );
    assert.strictEqual(
        normalizeScenarioKey('SAP_COM_0008', 'Business Partner'),
        'sap_com_0008_business_partner'
    );
}

function testNormalizeScenarioKeyEmptyTitle() {
    assert.strictEqual(normalizeScenarioKey('SAP_COM_0001', ''), 'sap_com_0001');
    assert.strictEqual(normalizeScenarioKey('SAP_COM_0001', '   '), 'sap_com_0001');
}

function testNormalizeScenarioKeySpecialChars() {
    const key = normalizeScenarioKey('SAP_COM_0120', 'Sales Billing Documents (V2)');
    assert.ok(key.startsWith('sap_com_0120_'));
    assert.ok(!key.includes('('));
    assert.ok(!key.includes(')'));
}

// ── REQ-004-10: createSapContext ──
function testCreateSapContext() {
    const ctx = createSapContext();
    assert.deepStrictEqual(ctx, { lastGoodCred: null });
}

// ── buildQueryPath 带已有 query 参数的 baseUrl ──
function testBuildQueryPathBaseWithQuery() {
    const baseUrl = '/sap/opu/odata/sap/SRV;v=0002?sap-client=100';
    const result = buildQueryPath(baseUrl, 'Entity', null, 10);
    // 应该用 & 连接（因为已有 ?）
    assert.ok(result.includes('&sap-client=100'), 'should use & when baseUrl already has query');
    assert.ok(!result.includes('??'), 'should not have double ??');
}

// ── Runner ──
function run() {
    testIsV2();
    testIsV4();
    testIsV2NotV4();
    testIsV4NotV2();
    testNeitherV2NorV4();
    testExtractRowsV2();
    testExtractRowsV4();
    testExtractRowsEdgeCases();
    testBuildBasicAuth();
    testBuildBasicAuthSpecialChars();
    testBuildQueryPathV2();
    testBuildQueryPathV4();
    testBuildQueryPathNoFilter();
    testBuildQueryPathTopCapped();
    testNormalizeScenarioKey();
    testNormalizeScenarioKeyEmptyTitle();
    testNormalizeScenarioKeySpecialChars();
    testCreateSapContext();
    testBuildQueryPathBaseWithQuery();
    console.log('  ✅ mcp-sap-core.test.js — all passed');
}

module.exports = { run };
