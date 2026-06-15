/**
 * tests/unit/sap-cache.test.js
 * v0.4: SAP response cache tests
 */
const assert = require('assert');
const { SapCache } = require('../../lib/sap-cache');

// ── Basic get/set ──

function testCacheHit() {
    const cache = new SapCache({ ttlMs: 60000 });
    assert.equal(cache.isEnabled(), true);
    cache.set('/sap/api/Foo?$top=10', { value: [{ id: 1 }] });
    const result = cache.get('/sap/api/Foo?$top=10');
    assert.ok(result, 'should return cached data');
    assert.equal(result.value[0].id, 1);
}

// ── Cache miss ──

function testCacheMiss() {
    const cache = new SapCache({ ttlMs: 60000 });
    const result = cache.get('/sap/api/NeverSet');
    assert.equal(result, null);
}

// ── TTL expiration ──

function testCacheTTL() {
    const cache = new SapCache({ ttlMs: 50 });
    cache.set('/sap/api/Expire', { x: 1 });
    // Force expiration by manipulating store
    const key = cache._normalizeUrl('/sap/api/Expire');
    cache.store.get(key).cachedAt = Date.now() - 100;
    const result = cache.get('/sap/api/Expire');
    assert.equal(result, null, 'expired entry should return null');
}

// ── Disabled cache ──

function testCacheDisabled() {
    const cache = new SapCache({ ttlMs: 0 });
    assert.equal(cache.isEnabled(), false);
    cache.set('/sap/api/X', { data: 1 });
    assert.equal(cache.get('/sap/api/X'), null, 'disabled cache should always return null');
}

// ── Invalidation ──

function testCacheInvalidate() {
    const cache = new SapCache({ ttlMs: 60000 });
    cache.set('/sap/api/Keep', { a: 1 });
    cache.set('/sap/api/Drop', { b: 2 });
    cache.invalidate('/sap/api/Drop');
    assert.ok(cache.get('/sap/api/Keep'), 'unrelated key should remain');
    assert.equal(cache.get('/sap/api/Drop'), null, 'invalidated key should return null');
}

// ── InvalidateAll ──

function testCacheInvalidateAll() {
    const cache = new SapCache({ ttlMs: 60000 });
    cache.set('/sap/api/A', { x: 1 });
    cache.set('/sap/api/B', { x: 2 });
    cache.invalidateAll();
    assert.equal(cache.get('/sap/api/A'), null);
    assert.equal(cache.get('/sap/api/B'), null);
}

// ── URL normalization strips sap-client ──

function testUrlNormalization() {
    const cache = new SapCache({ ttlMs: 60000 });
    const url1 = '/sap/opu/odata/sap/SRV/Entity?$top=10&sap-client=100';
    const url2 = '/sap/opu/odata/sap/SRV/Entity?$top=10&sap-client=200';
    cache.set(url1, { data: 'same' });
    const result = cache.get(url2);
    assert.ok(result, 'sap-client should be stripped from cache key');
    assert.equal(result.data, 'same');
}

// ── Stats ──

function testCacheStats() {
    const cache = new SapCache({ ttlMs: 60000 });
    cache.set('/sap/api/Stats', { n: 1 });
    cache.get('/sap/api/Stats');   // hit
    cache.get('/sap/api/Stats');   // hit
    cache.get('/sap/api/Miss');    // miss
    const stats = cache.getStats();
    assert.equal(stats.hits, 2);
    assert.equal(stats.misses, 1);
    assert.equal(stats.hitRate, 67); // 2/3 rounded
    assert.equal(stats.invalidations, 0);
    assert.equal(stats.enabled, true);
}

// ── Runner ──

async function run() {
    testCacheHit();
    testCacheMiss();
    testCacheTTL();
    testCacheDisabled();
    testCacheInvalidate();
    testCacheInvalidateAll();
    testUrlNormalization();
    testCacheStats();
    console.log('  ✅ sap-cache.test.js — all passed');
}

module.exports = { run };
