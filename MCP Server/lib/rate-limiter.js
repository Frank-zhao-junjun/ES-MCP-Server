/**
 * lib/rate-limiter.js — SAP 调用并发与速率限制
 *
 * REQ-RL-001: 并发上限控制（避免压垮 SAP）
 * REQ-RL-002: 每分钟速率限制（避免被 SAP 限流）
 */
const { ErrorCodes, makeError } = require('./errors');

const MAX_CONCURRENT = Number(process.env.MCP_SAP_MAX_CONCURRENT || 5);
const RATE_PER_MIN = Number(process.env.MCP_SAP_RATE_PER_MIN || 60);
const WINDOW_MS = 60_000;

class RateLimiter {
    constructor() {
        this.active = 0;                        // 当前并发数
        this.maxConcurrent = Math.max(1, MAX_CONCURRENT);
        this.ratePerMin = Math.max(1, RATE_PER_MIN);
        this.timestamps = [];                   // 滑动窗口内的时间戳
        this.waitQueue = [];                    // 等待队列 [{ resolve, reject }]
    }

    /**
     * 获取调用许可。若超出并发或速率限制，等待直到许可可用。
     * @returns {Promise<void>}
     */
    async acquire() {
        // 速率限制：清理过期时间戳
        const now = Date.now();
        const cutoff = now - WINDOW_MS;
        while (this.timestamps.length > 0 && this.timestamps[0] < cutoff) {
            this.timestamps.shift();
        }

        // 如果并发已满或速率已满，入队等待
        if (this.active >= this.maxConcurrent || this.timestamps.length >= this.ratePerMin) {
            return new Promise((resolve, reject) => {
                this.waitQueue.push({ resolve, reject });

                // 超时保护：等待超过 30 秒则拒绝
                const timeout = setTimeout(() => {
                    const idx = this.waitQueue.findIndex(e => e.resolve === resolve);
                    if (idx !== -1) {
                        this.waitQueue.splice(idx, 1);
                        reject(makeError(
                            ErrorCodes.RATE_LIMITED,
                            `Rate limit wait timeout after 30s. Active: ${this.active}/${this.maxConcurrent}, RPM: ${this.timestamps.length}/${this.ratePerMin}`,
                            { retryable: true }
                        ));
                    }
                }, 30_000);

                // 包装 resolve 以清除 timeout
                const originalResolve = resolve;
                resolve = () => {
                    clearTimeout(timeout);
                    originalResolve();
                };
            });
        }

        this.active++;
        this.timestamps.push(now);
    }

    /**
     * 释放一个并发槽位，并尝试唤醒下一个等待者。
     */
    release() {
        this.active = Math.max(0, this.active - 1);
        this._tryWakeNext();
    }

    _tryWakeNext() {
        if (this.waitQueue.length === 0) return;

        const now = Date.now();
        const cutoff = now - WINDOW_MS;
        while (this.timestamps.length > 0 && this.timestamps[0] < cutoff) {
            this.timestamps.shift();
        }

        if (this.active < this.maxConcurrent && this.timestamps.length < this.ratePerMin) {
            const next = this.waitQueue.shift();
            this.active++;
            this.timestamps.push(now);
            next.resolve();
        }
    }

    /**
     * 获取当前限流状态快照
     */
    getStatus() {
        const now = Date.now();
        const cutoff = now - WINDOW_MS;
        const recentCount = this.timestamps.filter(t => t >= cutoff).length;

        return {
            active: this.active,
            maxConcurrent: this.maxConcurrent,
            recentRpm: recentCount,
            maxRpm: this.ratePerMin,
            queued: this.waitQueue.length,
        };
    }
}

// 全局单例
const sapRateLimiter = new RateLimiter();

module.exports = { RateLimiter, sapRateLimiter };
