/**
 * lib/sap-cache.js — SAP 响应缓存
 *
 * TTL 内存缓存，用于减少重复 SAP OData 查询。
 * 配置: SAP_CACHE_TTL_MS (默认 300000 = 5min, 0 = 禁用)
 * 401/403 响应自动清空全部缓存。
 */
class SapCache {
    constructor(options = {}) {
        this.ttlMs = options.ttlMs || 0;
        this.store = new Map();
        this.hits = 0;
        this.misses = 0;
        this.invalidations = 0;
    }

    /**
     * URL 规范化：去 sap-client、排序 params、规范化尾部斜杠
     */
    _normalizeUrl(url) {
        try {
            const u = new URL(url.startsWith('http') ? url : `http://x${url}`);
            const params = new URLSearchParams(u.search);
            // 去掉 sap-client（所有请求统一）
            params.delete('sap-client');
            // 排序
            params.sort();
            const normalized = `${u.pathname.replace(/\/+$/, '')}?${params.toString()}`;
            return normalized;
        } catch {
            return url;
        }
    }

    isEnabled() {
        return this.ttlMs > 0;
    }

    get(url) {
        if (!this.isEnabled()) return null;
        const key = this._normalizeUrl(url);
        const entry = this.store.get(key);
        if (!entry) {
            this.misses++;
            return null;
        }
        if (Date.now() - entry.cachedAt > this.ttlMs) {
            this.store.delete(key);
            this.misses++;
            return null;
        }
        this.hits++;
        return entry.data;
    }

    set(url, data) {
        if (!this.isEnabled()) return;
        const key = this._normalizeUrl(url);
        this.store.set(key, { data, cachedAt: Date.now() });
    }

    invalidate(url) {
        if (url) {
            this.store.delete(this._normalizeUrl(url));
        }
        this.invalidations++;
    }

    invalidateAll() {
        this.store.clear();
        this.invalidations++;
    }

    getStats() {
        const total = this.hits + this.misses;
        return {
            enabled: this.isEnabled(),
            ttlMs: this.ttlMs,
            size: this.store.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? Math.round((this.hits / total) * 100) : 0,
            invalidations: this.invalidations,
        };
    }
}

module.exports = { SapCache };
