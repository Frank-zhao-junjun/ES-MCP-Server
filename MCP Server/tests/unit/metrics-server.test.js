/**
 * tests/unit/metrics-server.test.js
 * v0.4: Prometheus metrics server tests
 */
const assert = require('assert');
const http = require('http');
const { MetricsServer } = require('../../lib/metrics-server');
const { MetricsStore } = require('../../lib/observability');

// ── Helpers ──

function httpGet(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        }).on('error', reject);
    });
}

// ── Healthz endpoint ──

async function testHealthz() {
    const metrics = new MetricsStore();
    const server = new MetricsServer({ port: 0, metrics, activeRequests: () => 0, cacheStats: () => null });
    await server.start();
    try {
        const port = server.server.address().port;
        const res = await httpGet(`http://127.0.0.1:${port}/healthz`);
        assert.equal(res.status, 200);
        assert.equal(res.body, 'ok');
    } finally {
        await server.stop();
    }
}

// ── Metrics endpoint returns Prometheus format ──

async function testMetricsPrometheusFormat() {
    const metrics = new MetricsStore();
    metrics.recordRequest('test_tool', 150, true);
    metrics.recordSapCall(200, true);
    metrics.recordCacheHit();

    const server = new MetricsServer({
        port: 0,
        metrics,
        activeRequests: () => 1,
        cacheStats: () => ({ hits: 5, misses: 3 }),
    });
    await server.start();
    try {
        const port = server.server.address().port;
        const res = await httpGet(`http://127.0.0.1:${port}/metrics`);
        assert.equal(res.status, 200);
        assert.ok(res.body.includes('mcp_requests_total{status="success"}'), 'should have request counter');
        assert.ok(res.body.includes('mcp_sap_calls_total'), 'should have SAP call counter');
        assert.ok(res.body.includes('mcp_cache_hits_total 5'), 'should have cache hits');
        assert.ok(res.body.includes('mcp_cache_misses_total 3'), 'should have cache misses');
        assert.ok(res.body.includes('mcp_active_requests 1'), 'should have active requests');
        assert.ok(res.body.includes('mcp_uptime_seconds'), 'should have uptime');
        // Histogram
        assert.ok(res.body.includes('mcp_request_duration_seconds'), 'should have request duration histogram');
        assert.ok(res.body.includes('mcp_sap_call_duration_seconds'), 'should have SAP duration histogram');
    } finally {
        await server.stop();
    }
}

// ── Metrics server disabled by default ──

function testMetricsDisabledByDefault() {
    const server = new MetricsServer({ port: 0 });
    assert.equal(server.isEnabled(), false);
}

// ── Graceful shutdown ──

async function testGracefulShutdown() {
    const metrics = new MetricsStore();
    const server = new MetricsServer({ port: 0, metrics, activeRequests: () => 0, cacheStats: () => null });
    await server.start();
    const port = server.server.address().port;
    // Verify it's listening
    const res = await httpGet(`http://127.0.0.1:${port}/healthz`);
    assert.equal(res.status, 200);
    // Stop
    await server.stop();
    // Verify it's down (port may still be in TIME_WAIT)
    try {
        await httpGet(`http://127.0.0.1:${port}/healthz`);
        assert.fail('server should not respond after stop');
    } catch (err) {
        // Expected — any connection error is fine
        assert.ok(err, 'expected error after shutdown');
    }
}

// ── Counter increment across scrapes ──

async function testMetricsCounterAccumulates() {
    const metrics = new MetricsStore();
    const server = new MetricsServer({ port: 0, metrics, activeRequests: () => 0, cacheStats: () => null });
    await server.start();
    try {
        const port = server.server.address().port;
        // First scrape
        let res = await httpGet(`http://127.0.0.1:${port}/metrics`);
        assert.ok(res.body.includes('mcp_requests_total{status="success"} 0'));
        // Add more requests
        metrics.recordRequest('t1', 100, true);
        metrics.recordRequest('t1', 200, false);
        // Second scrape
        res = await httpGet(`http://127.0.0.1:${port}/metrics`);
        assert.ok(res.body.includes('mcp_requests_total{status="success"} 1'));
        assert.ok(res.body.includes('mcp_requests_total{status="failure"} 1'));
    } finally {
        await server.stop();
    }
}

// ── Runner ──

async function run() {
    testMetricsDisabledByDefault();
    await testHealthz();
    await testMetricsPrometheusFormat();
    await testGracefulShutdown();
    await testMetricsCounterAccumulates();
    console.log('  ✅ metrics-server.test.js — all passed');
}

module.exports = { run };
