/**
 * tests/unit/lib-errors.test.js
 * REQ-001: lib/errors.js 单元测试
 */
const assert = require('assert');
const { ErrorCodes, makeError, normalizeError } = require('../../lib/errors');

// ── REQ-001-01: makeError 基础功能 ──
function testMakeErrorBasic() {
    const err = makeError('TEST_CODE', 'test message');
    assert.strictEqual(err.code, 'TEST_CODE');
    assert.strictEqual(err.message, 'test message');
    assert.strictEqual(err.retryable, false);
    assert.strictEqual(err.sapStatus, undefined);
    assert.strictEqual(err.details, undefined);
}

// ── REQ-001-02: makeError 可选参数 ──
function testMakeErrorWithOptions() {
    const err = makeError('E500', 'server error', {
        sapStatus: 500,
        retryable: true,
        details: { raw: 'data' },
    });
    assert.strictEqual(err.code, 'E500');
    assert.strictEqual(err.sapStatus, 500);
    assert.strictEqual(err.retryable, true);
    assert.deepStrictEqual(err.details, { raw: 'data' });
}

// ── REQ-001-03: normalizeError 处理 MCP 错误对象 ──
function testNormalizeErrorMCP() {
    const input = { code: 'CUSTOM', message: 'custom error', sapStatus: 404, retryable: true };
    const result = normalizeError(input);
    assert.strictEqual(result.code, 'CUSTOM');
    assert.strictEqual(result.message, 'custom error');
    assert.strictEqual(result.sapStatus, 404);
    assert.strictEqual(result.retryable, true);
}

// ── REQ-001-04: normalizeError 处理原生 Error ──
function testNormalizeErrorNative() {
    const result = normalizeError(new Error('native error'));
    assert.strictEqual(result.code, 'INTERNAL');
    assert.strictEqual(result.message, 'native error');
    assert.strictEqual(result.retryable, false);
}

// ── REQ-001-05: normalizeError 处理 null/undefined/string ──
function testNormalizeErrorEdgeCases() {
    const r1 = normalizeError(null);
    assert.strictEqual(r1.code, 'INTERNAL');
    assert.strictEqual(r1.message, 'Unknown error');

    const r2 = normalizeError(undefined);
    assert.strictEqual(r2.code, 'INTERNAL');
    assert.strictEqual(r2.message, 'Unknown error');

    const r3 = normalizeError('plain string');
    assert.strictEqual(r3.code, 'INTERNAL');
    assert.strictEqual(r3.message, 'plain string');

    const r4 = normalizeError({ code: 'X', message: 'Y' }, 'FALLBACK');
    assert.strictEqual(r4.code, 'X'); // fallback 不覆盖已有的 code
    assert.strictEqual(r4.message, 'Y');
}

// ── REQ-001-06: ErrorCodes 完整性 ──
function testErrorCodesComplete() {
    const required = [
        'AUTH_REQUIRED', 'AUTH_INVALID_KEY', 'AUTH_LOCKED', 'AUTH_MISSING',
        'DEBUG_TOOL_DISABLED', 'INTERNAL', 'INVALID_INPUT',
        'NO_ENDPOINT', 'QUERY_FAILED', 'SAP_NETWORK_ERROR', 'SAP_TIMEOUT',
        'SCENARIO_NOT_FOUND', 'STATUS_FAILED', 'TRACE_PARTIAL_FAILURE',
    ];
    for (const code of required) {
        assert.strictEqual(ErrorCodes[code], code, `ErrorCodes.${code} should exist`);
    }
    // Object.freeze 验证：赋值应静默失败
    const frozen = { ...ErrorCodes };
    ErrorCodes.TEST_PROP = 'should not appear';
    assert.strictEqual(ErrorCodes.TEST_PROP, undefined);
    assert.deepStrictEqual(ErrorCodes, frozen);
}

// ── makeError 默认 retryable=false ──
function testMakeErrorDefaultRetryable() {
    const err = makeError('X', 'y');
    assert.strictEqual(err.retryable, false);
}

// ── makeError 空 options ──
function testMakeErrorEmptyOptions() {
    const err = makeError('X', 'y', {});
    assert.strictEqual(err.code, 'X');
    assert.strictEqual(err.sapStatus, undefined);
    assert.strictEqual(err.retryable, false);
}

// ── Runner ──
function run() {
    testMakeErrorBasic();
    testMakeErrorWithOptions();
    testNormalizeErrorMCP();
    testNormalizeErrorNative();
    testNormalizeErrorEdgeCases();
    testErrorCodesComplete();
    testMakeErrorDefaultRetryable();
    testMakeErrorEmptyOptions();
    console.log('  ✅ lib/errors.test.js — all passed');
}

module.exports = { run };
