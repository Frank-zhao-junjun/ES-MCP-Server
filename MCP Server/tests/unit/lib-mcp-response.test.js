/**
 * tests/unit/lib-mcp-response.test.js
 * REQ-002: lib/mcp-response.js 单元测试
 */
const assert = require('assert');
const { toolSuccess, toolFailure, textJson } = require('../../lib/mcp-response');

// ── REQ-002-01: toolSuccess 结构 ──
function testToolSuccess() {
    const result = toolSuccess('test_tool', { value: 42 }, ['warning 1']);
    assert.strictEqual(result.schemaVersion, '1.0');
    assert.strictEqual(result.tool, 'test_tool');
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.data, { value: 42 });
    assert.deepStrictEqual(result.warnings, ['warning 1']);
    assert.strictEqual(result.error, null);
}

// ── REQ-002-02: toolFailure 结构 ──
function testToolFailure() {
    const err = { code: 'TEST_ERR', message: 'something broke' };
    const result = toolFailure('test_tool', err);
    assert.strictEqual(result.schemaVersion, '1.0');
    assert.strictEqual(result.tool, 'test_tool');
    assert.strictEqual(result.ok, false);
    assert.deepStrictEqual(result.error, { code: 'TEST_ERR', message: 'something broke' });
    assert.strictEqual(result.data, null);
    assert.deepStrictEqual(result.warnings, []);
}

// ── REQ-002-03: textJson 包装 ──
function testTextJson() {
    const output = textJson({ a: 1, b: 'hello' });
    assert.strictEqual(output.content.length, 1);
    assert.strictEqual(output.content[0].type, 'text');
    const parsed = JSON.parse(output.content[0].text);
    assert.deepStrictEqual(parsed, { a: 1, b: 'hello' });
}

// ── toolSuccess 无 warnings ──
function testToolSuccessNoWarnings() {
    const result = toolSuccess('t', { x: 1 });
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual(result.ok, true);
}

// ── toolSuccess 空 data ──
function testToolSuccessNullData() {
    const result = toolSuccess('t', null);
    assert.strictEqual(result.data, null);
    assert.strictEqual(result.error, null);
}

// ── toolFailure 带 data/warnings ──
function testToolFailureWithExtras() {
    const err = { code: 'E', message: 'm' };
    const result = toolFailure('t', err, {
        data: { partial: true },
        warnings: ['fallback used'],
    });
    assert.strictEqual(result.ok, false);
    assert.deepStrictEqual(result.data, { partial: true });
    assert.deepStrictEqual(result.warnings, ['fallback used']);
}

// ── textJson 空对象 ──
function testTextJsonEmpty() {
    const output = textJson({});
    const parsed = JSON.parse(output.content[0].text);
    assert.deepStrictEqual(parsed, {});
}

// ── textJson 含特殊字符 ──
function testTextJsonSpecialChars() {
    const output = textJson({ msg: '<div>"test"</div>' });
    const parsed = JSON.parse(output.content[0].text);
    assert.strictEqual(parsed.msg, '<div>"test"</div>');
}

// ── Runner ──
function run() {
    testToolSuccess();
    testToolFailure();
    testTextJson();
    testToolSuccessNoWarnings();
    testToolSuccessNullData();
    testToolFailureWithExtras();
    testTextJsonEmpty();
    testTextJsonSpecialChars();
    console.log('  ✅ lib/mcp-response.test.js — all passed');
}

module.exports = { run };
