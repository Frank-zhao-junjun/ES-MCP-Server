/**
 * tests/unit/rate-limiter.test.js — 限流器单元测试
 */
const assert = require('assert');
const { RateLimiter } = require('../../lib/rate-limiter');

async function run() {
    console.log('  rate-limiter.test.js');

    // ── 1. 基本获取/释放 ──
    {
        const limiter = new RateLimiter();
        limiter.maxConcurrent = 3;
        limiter.ratePerMin = 100;

        await limiter.acquire();
        assert.strictEqual(limiter.active, 1, 'acquire increases active');
        assert.strictEqual(limiter.timestamps.length, 1, 'acquire records timestamp');

        limiter.release();
        assert.strictEqual(limiter.active, 0, 'release decreases active');
    }

    // ── 2. 并发上限排队 ──
    {
        const limiter = new RateLimiter();
        limiter.maxConcurrent = 2;
        limiter.ratePerMin = 100;

        await limiter.acquire(); // active=1
        await limiter.acquire(); // active=2

        // 第三个应该等待
        const p3 = limiter.acquire();
        await new Promise(r => setTimeout(r, 50));
        assert.strictEqual(limiter.active, 2, 'third acquire is queued');
        assert.strictEqual(limiter.waitQueue.length, 1, 'one waiter in queue');

        limiter.release(); // active drops then p3 wakes → active=2
        await p3;
        assert.strictEqual(limiter.active, 2, 'after release, queued acquire wakes and active stays at 2');
        limiter.release();
        assert.strictEqual(limiter.active, 1, 'release one, active=1');
    }

    // ── 3. 释放唤醒等待者 ──
    {
        const limiter = new RateLimiter();
        limiter.maxConcurrent = 1;
        limiter.ratePerMin = 100;

        await limiter.acquire();
        const p2 = limiter.acquire();
        limiter.release();
        await p2;
        assert.strictEqual(limiter.active, 1, 'release wakes next waiter');
        limiter.release();
        assert.strictEqual(limiter.active, 0, 'fully released');
    }

    // ── 4. getStatus ──
    {
        const limiter = new RateLimiter();
        const status = limiter.getStatus();
        assert.strictEqual(status.active, 0);
        assert.strictEqual(status.queued, 0);
        assert.strictEqual(typeof status.maxConcurrent, 'number');
    }

    // ── 5. active 不会负 ──
    {
        const limiter = new RateLimiter();
        limiter.release();
        limiter.release();
        assert.strictEqual(limiter.active, 0, 'release never goes below 0');
    }

    console.log('    ✅ all passed');
}

module.exports = { run };
