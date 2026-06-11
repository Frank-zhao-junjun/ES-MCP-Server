/**
 * tests/unit/observability.test.js
 * REQ-OBS-001 & REQ-OBS-002: Observability 单元测试
 */
const assert = require('assert');
const {
    generateTraceId,
    createTraceContext,
    recordSapCall,
    MetricsStore,
} = require('../../lib/observability');

// ════════════════════════════════════════════════════
// trace_id 生成
// ════════════════════════════════════════════════════

function testGenerateTraceId() {
    const id1 = generateTraceId();
    const id2 = generateTraceId();
    // 16 字符 hex
    assert.ok(/^[0-9a-f]{16}$/.test(id1), `trace_id should be 16 hex chars, got: ${id1}`);
    assert.ok(/^[0-9a-f]{16}$/.test(id2));
    assert.notStrictEqual(id1, id2, 'each trace_id should be unique');
}

// ════════════════════════════════════════════════════
// createTraceContext
// ════════════════════════════════════════════════════

function testCreateTraceContext() {
    const ctx = createTraceContext('abcd1234abcd1234');
    assert.strictEqual(ctx.traceId, 'abcd1234abcd1234');
    assert.ok(ctx.startTime > 0);
    assert.deepStrictEqual(ctx.sapCalls, []);
}

function testCreateTraceContextAutoId() {
    const ctx = createTraceContext();
    assert.ok(/^[0-9a-f]{16}$/.test(ctx.traceId));
}

// ════════════════════════════════════════════════════
// recordSapCall
// ════════════════════════════════════════════════════

function testRecordSapCall() {
    const ctx = createTraceContext('trace1234567890ab');
    recordSapCall(ctx, '/sap/api/test?$top=10', 45, 'ok');
    recordSapCall(ctx, '/sap/api/error', 120, 'SAP_HTTP_500', 'SERVER_ERROR');

    assert.strictEqual(ctx.sapCalls.length, 2);
    assert.strictEqual(ctx.sapCalls[0].url, '/sap/api/test?$top=10');
    assert.strictEqual(ctx.sapCalls[0].durationMs, 45);
    assert.strictEqual(ctx.sapCalls[0].status, 'ok');
    assert.strictEqual(ctx.sapCalls[1].error, 'SERVER_ERROR');
}

function testRecordSapCallWithoutContext() {
    // 不传 ctx 也不应报错
    const entry = recordSapCall(null, '/test', 10, 'ok');
    assert.strictEqual(entry.durationMs, 10);
}

// ════════════════════════════════════════════════════
// MetricsStore
// ════════════════════════════════════════════════════

function testMetricsStoreBasic() {
    const store = new MetricsStore();
    const m = store.getMetrics();

    assert.strictEqual(m.requests.total, 0);
    assert.strictEqual(m.requests.success, 0);
    assert.strictEqual(m.requests.failure, 0);
    assert.ok(m.uptimeSeconds >= 0);
    assert.strictEqual(m.sapCalls.total, 0);
}

function testMetricsStoreRecordRequests() {
    const store = new MetricsStore();
    store.recordRequest('test_tool', 100, true);
    store.recordRequest('test_tool', 200, true);
    store.recordRequest('test_tool', 50, false);
    store.recordRequest('other_tool', 300, true);

    const m = store.getMetrics();
    assert.strictEqual(m.requests.total, 4);
    assert.strictEqual(m.requests.success, 3);
    assert.strictEqual(m.requests.failure, 1);
    assert.strictEqual(m.requests.avgDurationMs, Math.round((100 + 200 + 50 + 300) / 4)); // 162

    // 按工具统计
    assert.strictEqual(m.tools.test_tool.count, 3);
    assert.strictEqual(m.tools.other_tool.count, 1);
}

function testMetricsStorePercentiles() {
    const store = new MetricsStore();
    // 10 requests: 10, 20, 30, ..., 100 ms
    for (let i = 1; i <= 10; i++) {
        store.recordRequest('t', i * 10, true);
    }

    const m = store.getMetrics();
    assert.strictEqual(m.requests.p50DurationMs, 50); // ~50ms
    assert.strictEqual(m.requests.p95DurationMs, 100); // ~100ms
}

function testMetricsStoreSapCalls() {
    const store = new MetricsStore();
    store.recordSapCall(50, true);
    store.recordSapCall(100, true);
    store.recordSapCall(200, false);

    const m = store.getMetrics();
    assert.strictEqual(m.sapCalls.total, 3);
    assert.strictEqual(m.sapCalls.errors, 1);
    assert.strictEqual(m.sapCalls.avgDurationMs, Math.round((50 + 100 + 200) / 3));
}

function testMetricsStoreReset() {
    const store = new MetricsStore();
    store.recordRequest('t', 100, true);
    store.reset();

    const m = store.getMetrics();
    assert.strictEqual(m.requests.total, 0);
    assert.strictEqual(m.sapCalls.total, 0);
}

// ════════════════════════════════════════════════════
// Runner
// ════════════════════════════════════════════════════

function run() {
    testGenerateTraceId();
    testCreateTraceContext();
    testCreateTraceContextAutoId();
    testRecordSapCall();
    testRecordSapCallWithoutContext();
    testMetricsStoreBasic();
    testMetricsStoreRecordRequests();
    testMetricsStorePercentiles();
    testMetricsStoreSapCalls();
    testMetricsStoreReset();
    console.log('  ✅ observability.test.js — all passed');
}

module.exports = { run };
