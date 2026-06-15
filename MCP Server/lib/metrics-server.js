/**
 * lib/metrics-server.js — Prometheus 指标端点
 *
 * 可选 HTTP sidecar server，暴露 /metrics 和 /healthz。
 * 配置: MCP_METRICS_PORT (默认 0 = 禁用)
 * 复用 express (已在 package.json)。
 *
 * 指标:
 *   mcp_requests_total{status}       Counter
 *   mcp_request_duration_seconds     Histogram
 *   mcp_sap_calls_total{status}      Counter
 *   mcp_sap_call_duration_seconds    Histogram
 *   mcp_cache_hits_total             Counter
 *   mcp_cache_misses_total           Counter
 *   mcp_active_requests              Gauge
 *   mcp_uptime_seconds               Gauge
 */

const express = require('express');

const HISTOGRAM_BUCKETS = [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10];

class MetricsServer {
    constructor(options = {}) {
        this.port = options.port || 0;
        this.metrics = options.metrics;             // MetricsStore 实例
        this.getActiveRequests = options.activeRequests || (() => 0);
        this.getCacheStats = options.cacheStats || (() => null);
        this.server = null;
        this.app = express();
        this._setupRoutes();
    }

    _setupRoutes() {
        this.app.get('/metrics', (_req, res) => {
            res.set('Content-Type', 'text/plain; version=0.0.4');
            res.send(this._renderPrometheus());
        });

        this.app.get('/healthz', (_req, res) => {
            res.status(200).send('ok');
        });
    }

    _renderPrometheus() {
        const m = this.metrics;
        const mSnapshot = m ? m.getMetrics() : {};
        const cacheStats = this.getCacheStats() || {};
        const lines = [];

        const metric = (name, type, help) => {
            lines.push(`# HELP ${name} ${help}`);
            lines.push(`# TYPE ${name} ${type}`);
        };

        // ── Requests counter ──
        const reqs = mSnapshot.requests || {};
        metric('mcp_requests_total', 'counter', 'Total MCP tool requests.');
        lines.push(`mcp_requests_total{status="success"} ${reqs.success || 0}`);
        lines.push(`mcp_requests_total{status="failure"} ${reqs.failure || 0}`);
        lines.push('');

        // ── Request duration histogram ──
        metric('mcp_request_duration_seconds', 'histogram', 'MCP request duration in seconds.');
        const allDurations = m ? m.getRequestDurations() : [];
        for (const le of HISTOGRAM_BUCKETS) {
            const count = allDurations.filter(d => d / 1000 <= le).length;
            lines.push(`mcp_request_duration_seconds_bucket{le="${le}"} ${count}`);
        }
        lines.push(`mcp_request_duration_seconds_bucket{le="+Inf"} ${allDurations.length}`);
        const reqSum = allDurations.reduce((a, b) => a + b, 0) / 1000;
        lines.push(`mcp_request_duration_seconds_count ${allDurations.length}`);
        lines.push(`mcp_request_duration_seconds_sum ${reqSum.toFixed(3)}`);
        lines.push('');

        // ── SAP calls counter ──
        const sap = mSnapshot.sapCalls || {};
        metric('mcp_sap_calls_total', 'counter', 'Total SAP OData calls.');
        lines.push(`mcp_sap_calls_total{status="success"} ${(sap.total || 0) - (sap.errors || 0)}`);
        lines.push(`mcp_sap_calls_total{status="error"} ${sap.errors || 0}`);
        lines.push('');

        // ── SAP call duration histogram ──
        metric('mcp_sap_call_duration_seconds', 'histogram', 'SAP call duration in seconds.');
        const sapDurations = m ? m.getSapCallDurations() : [];
        for (const le of HISTOGRAM_BUCKETS) {
            const count = sapDurations.filter(d => d / 1000 <= le).length;
            lines.push(`mcp_sap_call_duration_seconds_bucket{le="${le}"} ${count}`);
        }
        lines.push(`mcp_sap_call_duration_seconds_bucket{le="+Inf"} ${sapDurations.length}`);
        const sapSum = sapDurations.reduce((a, b) => a + b, 0) / 1000;
        lines.push(`mcp_sap_call_duration_seconds_count ${sapDurations.length}`);
        lines.push(`mcp_sap_call_duration_seconds_sum ${sapSum.toFixed(3)}`);
        lines.push('');

        // ── Cache counters ──
        metric('mcp_cache_hits_total', 'counter', 'SAP response cache hits.');
        lines.push(`mcp_cache_hits_total ${cacheStats.hits || 0}`);
        metric('mcp_cache_misses_total', 'counter', 'SAP response cache misses.');
        lines.push(`mcp_cache_misses_total ${cacheStats.misses || 0}`);
        lines.push('');

        // ── Active requests gauge ──
        metric('mcp_active_requests', 'gauge', 'Currently active MCP requests.');
        lines.push(`mcp_active_requests ${this.getActiveRequests()}`);
        lines.push('');

        // ── Uptime gauge ──
        metric('mcp_uptime_seconds', 'gauge', 'Server uptime in seconds.');
        lines.push(`mcp_uptime_seconds ${mSnapshot.uptimeSeconds || 0}`);
        lines.push('');

        return lines.join('\n') + '\n';
    }

    async start() {
        if (this.port <= 0) return;
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.port, () => {
                console.error(`[sap-s4-mcp] Metrics server listening on port ${this.port}`);
                resolve();
            });
            this.server.on('error', reject);
        });
    }

    async stop() {
        if (this.server) {
            return new Promise(resolve => {
                this.server.close(() => {
                    console.error('[sap-s4-mcp] Metrics server stopped');
                    resolve();
                });
            });
        }
    }

    isEnabled() {
        return this.port > 0;
    }
}

module.exports = { MetricsServer };
