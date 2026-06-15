/**
 * tests/unit/mcp-auth.test.js
 * REQ-003: mcp-auth.js 单元测试
 */
const assert = require('assert');
const {
    createAuthContext, isApiKeyRequired, initAuth, authenticate,
    isAuthenticated, requireAuth, generateNewKey,
} = require('../../mcp-auth');
const { ErrorCodes } = require('../../lib/errors');

// ── 工具函数：保存/恢复环境变量 ──
function withEnv(key, value, fn) {
    const prev = process.env[key];
    const existed = key in process.env;
    try {
        process.env[key] = value;
        return fn();
    } finally {
        if (existed) {
            process.env[key] = prev;
        } else {
            delete process.env[key];
        }
    }
}

function withEnvVars(values, fn) {
    const previous = {};
    for (const key of Object.keys(values)) {
        previous[key] = {
            existed: key in process.env,
            value: process.env[key],
        };
    }

    try {
        for (const [key, value] of Object.entries(values)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
        return fn();
    } finally {
        for (const [key, item] of Object.entries(previous)) {
            if (item.existed) {
                process.env[key] = item.value;
            } else {
                delete process.env[key];
            }
        }
    }
}

// ── REQ-003-01: createAuthContext 隔离 ──
function testCreateAuthContextIsolation() {
    const ctx1 = createAuthContext();
    const ctx2 = createAuthContext();

    assert.notStrictEqual(ctx1, ctx2);
    assert.strictEqual(ctx1.authenticated, false);
    assert.strictEqual(ctx2.authenticated, false);
    assert.strictEqual(ctx1.failedAttempts, 0);

    // 修改 ctx1 不影响 ctx2
    ctx1.authenticated = true;
    ctx1.failedAttempts = 3;
    assert.strictEqual(ctx2.authenticated, false);
    assert.strictEqual(ctx2.failedAttempts, 0);
}

// ── REQ-003-02: initAuth 读取环境变量 ──
function testInitAuthWithEnv() {
    withEnv('MCP_API_KEY', 'my-test-key-123', () => {
        const ctx = createAuthContext();
        const key = initAuth(ctx);
        assert.strictEqual(key, 'my-test-key-123');
        assert.strictEqual(ctx.apiKey, 'my-test-key-123');
        assert.strictEqual(ctx.authenticated, false);
    });
}

// ── REQ-003-03: initAuth 无环境变量时自动生成 ──
function testInitAuthAutoGenerate() {
    // 确保没有环境变量
    const prev = process.env.MCP_API_KEY;
    const existed = 'MCP_API_KEY' in process.env;
    delete process.env.MCP_API_KEY;

    try {
        const ctx = createAuthContext();
        const key = initAuth(ctx);
        assert.ok(key.startsWith('mcp-'), 'auto-generated key should start with mcp-');
        assert.ok(key.length >= 32, 'auto-generated key should be at least 32 chars');
        assert.strictEqual(ctx.apiKey, key);
        assert.strictEqual(ctx.authenticated, false);
    } finally {
        if (existed) {
            process.env.MCP_API_KEY = prev;
        } else {
            delete process.env.MCP_API_KEY;
        }
    }
}

function testInitAuthRequiresExplicitKeyInProduction() {
    withEnvVars({ MCP_API_KEY: undefined, MCP_REQUIRE_API_KEY: undefined, NODE_ENV: 'production' }, () => {
        const ctx = createAuthContext();
        assert.throws(
            () => initAuth(ctx),
            (err) => err.code === ErrorCodes.AUTH_MISSING,
            'production mode should require MCP_API_KEY'
        );
    });
}

function testInitAuthRequiresExplicitKeyWhenFlagEnabled() {
    withEnvVars({ MCP_API_KEY: undefined, MCP_REQUIRE_API_KEY: 'true', NODE_ENV: undefined }, () => {
        const ctx = createAuthContext();
        assert.strictEqual(isApiKeyRequired(), true);
        assert.throws(
            () => initAuth(ctx),
            (err) => err.code === ErrorCodes.AUTH_MISSING,
            'MCP_REQUIRE_API_KEY=true should require MCP_API_KEY'
        );
    });
}

// ── REQ-003-04: authenticate 成功 ──
function testAuthenticateSuccess() {
    withEnv('MCP_API_KEY', 'secret-key', () => {
        const ctx = createAuthContext();
        initAuth(ctx);
        const result = authenticate('secret-key', ctx);

        assert.strictEqual(result.success, true);
        assert.ok(result.message.includes('successful'));
        assert.strictEqual(ctx.authenticated, true);
        assert.strictEqual(ctx.failedAttempts, 0);
    });
}

// ── REQ-003-05: authenticate 密钥错误 ──
function testAuthenticateInvalidKey() {
    withEnv('MCP_API_KEY', 'real-key', () => {
        const ctx = createAuthContext();
        initAuth(ctx);
        const result = authenticate('wrong-key', ctx);

        assert.strictEqual(result.success, false);
        assert.strictEqual(result.code, ErrorCodes.AUTH_INVALID_KEY);
        assert.strictEqual(result.remainingAttempts, 4);
        assert.strictEqual(ctx.authenticated, false);
        assert.strictEqual(ctx.failedAttempts, 1);
    });
}

// ── REQ-003-06: authenticate 锁定机制 ──
function testAuthenticateLockout() {
    withEnv('MCP_API_KEY', 'lock-key', () => {
        const ctx = createAuthContext();
        initAuth(ctx);

        // 5 次失败
        for (let i = 0; i < 5; i++) {
            const r = authenticate('wrong', ctx);
            assert.strictEqual(r.success, false, `attempt ${i + 1} should fail`);
        }

        // 第 6 次被锁定
        const locked = authenticate('wrong', ctx);
        assert.strictEqual(locked.success, false);
        assert.strictEqual(locked.code, ErrorCodes.AUTH_LOCKED);
        assert.strictEqual(locked.locked, true);
        assert.ok(locked.retryAfter > 0, 'retryAfter should be positive');

        // 即使提供正确密钥也被锁
        const correctButLocked = authenticate('lock-key', ctx);
        assert.strictEqual(correctButLocked.success, false);
    });
}

// ── REQ-003-07: requireAuth 拦截未认证 ──
function testRequireAuthBlocks() {
    const ctx = createAuthContext();
    assert.throws(
        () => requireAuth(ctx),
        (err) => err.code === ErrorCodes.AUTH_REQUIRED,
        'should throw AUTH_REQUIRED when not authenticated'
    );
}

// ── REQ-003-08: requireAuth 通过已认证 ──
function testRequireAuthPasses() {
    withEnv('MCP_API_KEY', 'pass-key', () => {
        const ctx = createAuthContext();
        initAuth(ctx);
        authenticate('pass-key', ctx);
        assert.doesNotThrow(() => requireAuth(ctx));
    });
}

// ── REQ-003-09: generateNewKey 重置状态 ──
function testGenerateNewKey() {
    withEnv('MCP_API_KEY', 'old-key', () => {
        const ctx = createAuthContext();
        initAuth(ctx);
        authenticate('old-key', ctx);
        assert.strictEqual(ctx.authenticated, true);

        const newKey = generateNewKey(ctx);
        assert.notStrictEqual(newKey, 'old-key');
        assert.strictEqual(ctx.authenticated, false);
        assert.ok(newKey.startsWith('mcp-'));
    });
}

// ── isAuthenticated 正确反映状态 ──
function testIsAuthenticatedReflectsState() {
    withEnv('MCP_API_KEY', 'state-key', () => {
        const ctx = createAuthContext();
        initAuth(ctx);
        assert.strictEqual(isAuthenticated(ctx), false);
        authenticate('state-key', ctx);
        assert.strictEqual(isAuthenticated(ctx), true);
    });
}

// ── authenticate 成功后重置失败计数 ──
function testAuthenticateResetsFailedCount() {
    withEnv('MCP_API_KEY', 'reset-key', () => {
        const ctx = createAuthContext();
        initAuth(ctx);

        // 先失败 3 次
        authenticate('wrong1', ctx);
        authenticate('wrong2', ctx);
        authenticate('wrong3', ctx);
        assert.strictEqual(ctx.failedAttempts, 3);

        // 然后成功
        authenticate('reset-key', ctx);
        assert.strictEqual(ctx.failedAttempts, 0);
        assert.strictEqual(ctx.lockUntil, 0);
    });
}

// ── 不同 context 的锁互相独立 ──
function testLockIsContextScoped() {
    withEnv('MCP_API_KEY', 'scope-key', () => {
        const ctx1 = createAuthContext();
        const ctx2 = createAuthContext();
        initAuth(ctx1);
        initAuth(ctx2);

        // ctx1 锁住
        for (let i = 0; i < 5; i++) authenticate('wrong', ctx1);
        assert.strictEqual(authenticate('scope-key', ctx1).locked, true);

        // ctx2 不受影响
        assert.strictEqual(authenticate('scope-key', ctx2).success, true);
    });
}

// ── Runner ──
function run() {
    testCreateAuthContextIsolation();
    testInitAuthWithEnv();
    testInitAuthAutoGenerate();
    testInitAuthRequiresExplicitKeyInProduction();
    testInitAuthRequiresExplicitKeyWhenFlagEnabled();
    testAuthenticateSuccess();
    testAuthenticateInvalidKey();
    testAuthenticateLockout();
    testRequireAuthBlocks();
    testRequireAuthPasses();
    testGenerateNewKey();
    testIsAuthenticatedReflectsState();
    testAuthenticateResetsFailedCount();
    testLockIsContextScoped();
    console.log('  ✅ mcp-auth.test.js — all passed');
}

module.exports = { run };
