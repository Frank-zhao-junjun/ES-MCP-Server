/**
 * lib/observability.js — 可观测性模块
 * 
 * REQ-OBS-001: 请求耗时统计（MetricsStore）
 * REQ-OBS-002: SAP 调用链路追踪（trace_id 生成、调用日志）
 */
const crypto = require('crypto');

// ── Trace ID 生成 ──────────────────────────────────

/**
 * 生成 trace_id：16 字符 hex（8 字节随机）
 */
function generateTraceId() {
    return crypto.randomBytes(8).toString('hex');
}

/**
 * 创建链路追踪上下文
 */
function createTraceContext(traceId) {
    return {
        traceId: traceId || generateTraceId(),
        startTime: Date.now(),
        sapCalls: [],
    };
}

/**
 * 记录一次 SAP 调用
 */
function recordSapCall(ctx, url, durationMs, status, error) {
    const entry = {
        url: url.length > 200 ? url.substring(0, 197) + '...' : url,
        durationMs,
        status,
        error: error || undefined,
    };
    if (ctx && ctx.sapCalls) {
        ctx.sapCalls.push(entry);
    }
    return entry;
}

// ── MetricsStore ────────────────────────────────────

class MetricsStore {
    constructor() {
        this.reset();
    }

    reset() {
        this.startTime = Date.now();
        this.requestCount = 0;
        this.successCount = 0;
        this.failureCount = 0;
        this.totalDurationMs = 0;
        this.sapCallCount = 0;
        this.sapTotalDurationMs = 0;
        this.sapErrors = 0;
        this.toolDurations = {};  // { toolName: [durationMs, ...] }
        this.sapCallDurations = []; // [durationMs, ...] for Prometheus histogram
        this.cacheHits = 0;
        this.cacheMisses = 0;
    }

    recordRequest(tool, durationMs, ok) {
        this.requestCount++;
        this.totalDurationMs += durationMs;
        if (ok) {
            this.successCount++;
        } else {
            this.failureCount++;
        }
        if (!this.toolDurations[tool]) {
            this.toolDurations[tool] = [];
        }
        this.toolDurations[tool].push(durationMs);
    }

    recordSapCall(durationMs, ok) {
        this.sapCallCount++;
        this.sapTotalDurationMs += durationMs;
        this.sapCallDurations.push(durationMs);
        if (!ok) {
            this.sapErrors++;
        }
    }

    recordCacheHit() {
        this.cacheHits++;
    }

    recordCacheMiss() {
        this.cacheMisses++;
    }

    /**
     * 获取所有请求耗时（扁平化），供 Prometheus 直方图使用
     */
    getRequestDurations() {
        return Object.values(this.toolDurations).flat();
    }

    /**
     * 获取所有 SAP 调用耗时，供 Prometheus 直方图使用
     */
    getSapCallDurations() {
        return this.sapCallDurations;
    }

    /**
     * 计算百分位
     */
    _percentile(sorted, p) {
        if (sorted.length === 0) return 0;
        const idx = Math.ceil(sorted.length * p / 100) - 1;
        return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
    }

    /**
     * 获取当前指标快照
     */
    getMetrics() {
        const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        const allDurations = Object.values(this.toolDurations).flat().sort((a, b) => a - b);

        return {
            uptimeSeconds,
            requests: {
                total: this.requestCount,
                success: this.successCount,
                failure: this.failureCount,
                avgDurationMs: this.requestCount > 0
                    ? Math.round(this.totalDurationMs / this.requestCount)
                    : 0,
                p50DurationMs: this._percentile(allDurations, 50),
                p95DurationMs: this._percentile(allDurations, 95),
            },
            sapCalls: {
                total: this.sapCallCount,
                errors: this.sapErrors,
                avgDurationMs: this.sapCallCount > 0
                    ? Math.round(this.sapTotalDurationMs / this.sapCallCount)
                    : 0,
            },
            tools: Object.fromEntries(
                Object.entries(this.toolDurations).map(([tool, durations]) => [
                    tool,
                    {
                        count: durations.length,
                        avgMs: durations.length > 0
                            ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
                            : 0,
                    },
                ])
            ),
            cache: {
                hits: this.cacheHits,
                misses: this.cacheMisses,
                hitRate: (this.cacheHits + this.cacheMisses) > 0
                    ? Math.round((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100)
                    : 0,
            },
        };
    }
}

// ── 全局实例 ────────────────────────────────────────

const metrics = new MetricsStore();

module.exports = {
    generateTraceId,
    createTraceContext,
    recordSapCall,
    MetricsStore,
    metrics,
};
