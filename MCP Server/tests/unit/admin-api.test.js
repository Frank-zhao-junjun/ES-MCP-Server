/**
 * Unit tests for lib/admin-api.js
 * Tests helper functions and router creation
 */
const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (err) {
        failed++;
        console.log(`  ❌ ${name}: ${err.message}`);
    }
}

console.log('  admin-api.test.js');

// Import the module to test helper functions
const adminApi = require('../../lib/admin-api');

// Test: createAdminRouter is exported
test('createAdminRouter is exported as a function', () => {
    assert.strictEqual(typeof adminApi.createAdminRouter, 'function');
});

// Test: createAdminRouter returns an Express Router
test('createAdminRouter returns an Express Router', () => {
    const router = adminApi.createAdminRouter({});
    assert.strictEqual(typeof router, 'function');
    // Express Router has stack property
    assert.ok(router.stack || typeof router.use === 'function');
});

// Test: createAdminRouter with metrics option
test('createAdminRouter accepts metrics option', () => {
    const mockMetrics = {
        getSnapshot: () => ({ requests: { total: 0 } })
    };
    const router = adminApi.createAdminRouter({ metrics: mockMetrics });
    assert.ok(router);
});

// Test: createAdminRouter with all options
test('createAdminRouter accepts all options', () => {
    const router = adminApi.createAdminRouter({
        metrics: { getSnapshot: () => ({}) },
        authContext: { keys: [] },
        dynamicLoader: { listLoaded: () => [] },
        sapResponseCache: { getStats: () => ({}) },
        circuitBreaker: { state: 'CLOSED' },
        httpSessions: new Map(),
        registeredTools: []
    });
    assert.ok(router);
});

// Test: createAdminRouter with empty options
test('createAdminRouter works with empty options', () => {
    const router = adminApi.createAdminRouter({});
    assert.ok(router);
});

// Test: createAdminRouter with no arguments
test('createAdminRouter works with no arguments', () => {
    const router = adminApi.createAdminRouter();
    assert.ok(router);
});

// Test: Router has expected route methods
test('Router has get method', () => {
    const router = adminApi.createAdminRouter({});
    assert.strictEqual(typeof router.get, 'function');
});

test('Router has post method', () => {
    const router = adminApi.createAdminRouter({});
    assert.strictEqual(typeof router.post, 'function');
});

test('Router has use method', () => {
    const router = adminApi.createAdminRouter({});
    assert.strictEqual(typeof router.use, 'function');
});

// Test: Router stack contains routes
test('Router stack contains routes after creation', () => {
    const router = adminApi.createAdminRouter({});
    // Router should have at least the static middleware and some routes
    assert.ok(router.stack.length > 0);
});

// Summary
if (failed > 0) {
    console.log(`\n  ${failed} test(s) failed`);
    process.exit(1);
} else {
    console.log(`  ${passed} tests passed`);
}

module.exports = { passed, failed };
