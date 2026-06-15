/**
 * tests/unit/mcp-auth-v2.test.js
 * v0.4: Multi-key authentication tests
 */
const assert = require('assert');
const {
    createAuthContext, initAuth, authenticate,
    getAuthenticatedRole, isAuthenticated, isApiKeyRequired,
} = require('../../mcp-auth');
const { ErrorCodes } = require('../../lib/errors');

function withEnvVars(values, fn) {
    const previous = {};
    for (const key of Object.keys(values)) {
        previous[key] = { existed: key in process.env, value: process.env[key] };
    }
    try {
        for (const [key, value] of Object.entries(values)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        return fn();
    } finally {
        for (const [key, item] of Object.entries(previous)) {
            if (item.existed) process.env[key] = item.value;
            else delete process.env[key];
        }
    }
}

// ── Multi-key initAuth ──

function testInitMultiKey() {
    const ctx = createAuthContext();
    const keys = JSON.stringify({ 'key-admin-123': 'admin', 'key-readonly-456': 'readonly' });
    withEnvVars({ MCP_API_KEYS: keys, MCP_API_KEY: undefined }, () => {
        initAuth(ctx);
        assert.ok(ctx.apiKeys instanceof Map, 'apiKeys should be a Map');
        assert.equal(ctx.apiKeys.size, 2, 'should have 2 keys');
        assert.equal(ctx.apiKeys.get('key-admin-123').role, 'admin');
        assert.equal(ctx.apiKeys.get('key-readonly-456').role, 'readonly');
        assert.equal(ctx.apiKey, null, 'apiKey should be null in multi-key mode');
    });
}

// ── Multi-key takes precedence over single key ──

function testMultiKeyPrecedence() {
    const ctx = createAuthContext();
    const keys = JSON.stringify({ 'mk-key': 'debug' });
    withEnvVars({ MCP_API_KEYS: keys, MCP_API_KEY: 'old-key' }, () => {
        initAuth(ctx);
        assert.ok(ctx.apiKeys instanceof Map);
        assert.equal(ctx.apiKey, null);
    });
}

// ── Multi-key authenticate success ──

function testMultiKeyAuthSuccess() {
    const ctx = createAuthContext();
    const keys = JSON.stringify({ 'secret-1': 'admin', 'secret-2': 'readonly' });
    withEnvVars({ MCP_API_KEYS: keys, MCP_API_KEY: undefined }, () => {
        initAuth(ctx);
        const result = authenticate('secret-1', ctx);
        assert.equal(result.success, true);
        assert.equal(result.role, 'admin');
        assert.equal(ctx.authenticatedKey, 'secret-1');
        assert.equal(isAuthenticated(ctx), true);
    });
}

// ── Multi-key authenticate wrong key ──

function testMultiKeyAuthWrongKey() {
    const ctx = createAuthContext();
    const keys = JSON.stringify({ 'real-key': 'readonly' });
    withEnvVars({ MCP_API_KEYS: keys, MCP_API_KEY: undefined }, () => {
        initAuth(ctx);
        const result = authenticate('wrong-key', ctx);
        assert.equal(result.success, false);
        assert.equal(result.code, ErrorCodes.AUTH_INVALID_KEY);
        assert.equal(isAuthenticated(ctx), false);
    });
}

// ── getAuthenticatedRole ──

function testGetAuthenticatedRole() {
    const ctx = createAuthContext();
    const keys = JSON.stringify({ 'k1': 'debug' });
    withEnvVars({ MCP_API_KEYS: keys, MCP_API_KEY: undefined }, () => {
        initAuth(ctx);
        authenticate('k1', ctx);
        assert.equal(getAuthenticatedRole(ctx), 'debug');
    });
}

// ── Multi-key context isolation ──

function testMultiKeyContextIsolation() {
    const ctx1 = createAuthContext();
    const ctx2 = createAuthContext();
    const keys = JSON.stringify({ 'key-a': 'admin' });
    withEnvVars({ MCP_API_KEYS: keys, MCP_API_KEY: undefined }, () => {
        initAuth(ctx1);
        initAuth(ctx2);
        authenticate('key-a', ctx1);
        assert.equal(isAuthenticated(ctx1), true);
        assert.equal(isAuthenticated(ctx2), false, 'ctx2 should NOT be authenticated');
    });
}

// ── Single-key backward compat ──

function testSingleKeyBackwardCompat() {
    const ctx = createAuthContext();
    withEnvVars({ MCP_API_KEYS: undefined, MCP_API_KEY: 'old-school' }, () => {
        initAuth(ctx);
        assert.equal(ctx.apiKey, 'old-school');
        assert.equal(ctx.apiKeys, null);
        const result = authenticate('old-school', ctx);
        assert.equal(result.success, true);
        assert.equal(result.role, undefined, 'single-key has no role in result');
        assert.equal(getAuthenticatedRole(ctx), null, 'single-key returns null role');
    });
}

// ── Invalid role defaults to readonly ──

function testInvalidRoleDefaults() {
    const ctx = createAuthContext();
    const keys = JSON.stringify({ 'bad-role-key': 'superuser' });
    withEnvVars({ MCP_API_KEYS: keys, MCP_API_KEY: undefined }, () => {
        initAuth(ctx);
        const record = ctx.apiKeys.get('bad-role-key');
        assert.equal(record.role, 'readonly', 'invalid role should default to readonly');
    });
}

// ── Multi-key per-key lockout ──

function testMultiKeyPerKeyLockout() {
    const ctx = createAuthContext();
    const keys = JSON.stringify({ 'lock-test': 'readonly' });
    withEnvVars({ MCP_API_KEYS: keys, MCP_API_KEY: undefined }, () => {
        initAuth(ctx);
        // Lock the key by deliberately manipulating the record
        const record = ctx.apiKeys.get('lock-test');
        record.lockUntil = Date.now() + 30000;
        const result = authenticate('lock-test', ctx);
        assert.equal(result.success, false);
        assert.equal(result.code, ErrorCodes.AUTH_LOCKED);
        assert.equal(result.locked, true);
    });
}

// ── Runner ──

async function run() {
    testInitMultiKey();
    testMultiKeyPrecedence();
    testMultiKeyAuthSuccess();
    testMultiKeyAuthWrongKey();
    testGetAuthenticatedRole();
    testMultiKeyContextIsolation();
    testSingleKeyBackwardCompat();
    testInvalidRoleDefaults();
    testMultiKeyPerKeyLockout();
    console.log('  ✅ mcp-auth-v2.test.js — all passed');
}

module.exports = { run };
