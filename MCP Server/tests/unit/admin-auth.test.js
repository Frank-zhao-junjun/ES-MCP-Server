/**
 * Unit tests for lib/admin-auth.js
 */
const assert = require('assert');
const { AdminAuth } = require('../../lib/admin-auth');

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

console.log('  admin-auth.test.js');

// Test: isEnabled when password is set
test('isEnabled returns true when password is set', () => {
    const auth = new AdminAuth({ password: 'secret123' });
    assert.strictEqual(auth.isEnabled(), true);
});

// Test: isEnabled when password is empty
test('isEnabled returns false when password is empty', () => {
    const auth = new AdminAuth({ password: '' });
    assert.strictEqual(auth.isEnabled(), false);
});

// Test: login with correct password
test('login succeeds with correct password', () => {
    const auth = new AdminAuth({ password: 'secret123' });
    const result = auth.login('secret123');
    assert.strictEqual(result.ok, true);
    assert.ok(result.token);
    assert.strictEqual(result.token.length, 64); // 32 bytes hex
});

// Test: login with wrong password
test('login fails with wrong password', () => {
    const auth = new AdminAuth({ password: 'secret123' });
    const result = auth.login('wrongpassword');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'Invalid password');
});

// Test: login when disabled
test('login fails when admin is disabled', () => {
    const auth = new AdminAuth({ password: '' });
    const result = auth.login('anypassword');
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('disabled'));
});

// Test: validateSession with valid token
test('validateSession returns valid for valid token', () => {
    const auth = new AdminAuth({ password: 'secret123' });
    const { token } = auth.login('secret123');
    const result = auth.validateSession(token);
    assert.strictEqual(result.valid, true);
});

// Test: validateSession with invalid token
test('validateSession returns invalid for unknown token', () => {
    const auth = new AdminAuth({ password: 'secret123' });
    const result = auth.validateSession('invalid-token');
    assert.strictEqual(result.valid, false);
});

// Test: validateSession with null token
test('validateSession returns invalid for null token', () => {
    const auth = new AdminAuth({ password: 'secret123' });
    const result = auth.validateSession(null);
    assert.strictEqual(result.valid, false);
});

// Test: logout removes session
test('logout removes session', () => {
    const auth = new AdminAuth({ password: 'secret123' });
    const { token } = auth.login('secret123');
    auth.logout(token);
    const result = auth.validateSession(token);
    assert.strictEqual(result.valid, false);
});

// Test: getActiveSessionCount
test('getActiveSessionCount returns correct count', () => {
    const auth = new AdminAuth({ password: 'secret123' });
    assert.strictEqual(auth.getActiveSessionCount(), 0);
    auth.login('secret123');
    assert.strictEqual(auth.getActiveSessionCount(), 1);
    auth.login('secret123');
    assert.strictEqual(auth.getActiveSessionCount(), 2);
});

// Test: session expiry
test('expired session returns expired flag', () => {
    const auth = new AdminAuth({ password: 'secret123', sessionTTL: 1 }); // 1ms TTL
    const { token } = auth.login('secret123');
    // Wait for expiry
    const start = Date.now();
    while (Date.now() - start < 10) {} // busy wait 10ms
    const result = auth.validateSession(token);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.expired, true);
});

// Test: rate limiting
test('rate limiting blocks after max attempts', () => {
    const auth = new AdminAuth({ password: 'secret123' });
    // Make 10 failed attempts
    for (let i = 0; i < 10; i++) {
        auth.login('wrong');
    }
    // 11th attempt should be rate limited
    const result = auth.login('secret123');
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('Too many'));
});

// Test: login with empty password input
test('login with empty password fails', () => {
    const auth = new AdminAuth({ password: 'secret123' });
    const result = auth.login('');
    assert.strictEqual(result.ok, false);
});

// Test: login with null password input
test('login with null password fails', () => {
    const auth = new AdminAuth({ password: 'secret123' });
    const result = auth.login(null);
    assert.strictEqual(result.ok, false);
});

// Summary
if (failed > 0) {
    console.log(`\n  ${failed} test(s) failed`);
    process.exit(1);
} else {
    console.log(`  ${passed} tests passed`);
}

module.exports = { passed, failed };
