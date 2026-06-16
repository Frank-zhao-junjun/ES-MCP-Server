/**
 * Dashboard Page
 */
const DashboardPage = {
    refreshInterval: null,

    async render() {
        const content = document.getElementById('content');
        content.innerHTML = '<div class="loading">Loading dashboard...</div>';

        try {
            const data = await AdminAPI.getDashboard();
            this.renderData(data.data);
            this.startAutoRefresh();
        } catch (err) {
            content.innerHTML = `<div class="empty-state">Failed to load dashboard: ${err.message}</div>`;
        }
    },

    renderData(data) {
        const content = document.getElementById('content');
        const m = data.metrics || {};
        const reqs = m.requests || {};
        const sap = m.sapCalls || {};
        const cache = data.cache || {};
        const cb = data.circuitBreaker || {};

        const successRate = reqs.total > 0
            ? ((reqs.success / reqs.total) * 100).toFixed(1)
            : '0.0';

        const cacheHitRate = cache.stats
            ? ((cache.stats.hits / (cache.stats.hits + cache.stats.misses || 1)) * 100).toFixed(1)
            : '0.0';

        content.innerHTML = `
            <h2 class="page-title">Dashboard</h2>

            <div class="card-grid">
                <div class="card">
                    <div class="card-label">Total Requests</div>
                    <div class="card-value">${reqs.total || 0}</div>
                </div>
                <div class="card">
                    <div class="card-label">Success Rate</div>
                    <div class="card-value ${parseFloat(successRate) >= 95 ? 'success' : parseFloat(successRate) >= 80 ? 'warning' : 'danger'}">${successRate}%</div>
                </div>
                <div class="card">
                    <div class="card-label">p50 Latency</div>
                    <div class="card-value">${reqs.p50DurationMs || 0}ms</div>
                </div>
                <div class="card">
                    <div class="card-label">p95 Latency</div>
                    <div class="card-value">${reqs.p95DurationMs || 0}ms</div>
                </div>
            </div>

            <div class="card-grid">
                <div class="card">
                    <div class="card-label">SAP Calls</div>
                    <div class="card-value">${sap.total || 0}</div>
                </div>
                <div class="card">
                    <div class="card-label">SAP Errors</div>
                    <div class="card-value ${sap.errors > 0 ? 'danger' : ''}">${sap.errors || 0}</div>
                </div>
                <div class="card">
                    <div class="card-label">Cache Hit Rate</div>
                    <div class="card-value">${cacheHitRate}%</div>
                </div>
                <div class="card">
                    <div class="card-label">Uptime</div>
                    <div class="card-value">${this.formatUptime(m.uptimeSeconds || 0)}</div>
                </div>
            </div>

            <div class="section">
                <h3 class="section-title">Circuit Breaker</h3>
                <div class="table-container">
                    <table>
                        <tr>
                            <th>State</th>
                            <th>Failure Count</th>
                            <th>Last Failure</th>
                        </tr>
                        <tr>
                            <td><span class="status ${cb.state === 'CLOSED' ? 'status-ok' : cb.state === 'OPEN' ? 'status-error' : 'status-warning'}">${cb.state || 'UNKNOWN'}</span></td>
                            <td>${cb.failureCount || 0}</td>
                            <td>${cb.lastFailureTime ? new Date(cb.lastFailureTime).toLocaleString() : 'N/A'}</td>
                        </tr>
                    </table>
                </div>
            </div>

            <div class="section">
                <h3 class="section-title">Admin Sessions</h3>
                <div class="card">
                    <div class="card-label">Active Sessions</div>
                    <div class="card-value">${data.adminSessions || 0}</div>
                </div>
            </div>
        `;
    },

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    },

    startAutoRefresh() {
        this.stopAutoRefresh();
        this.refreshInterval = setInterval(async () => {
            try {
                const data = await AdminAPI.getDashboard();
                this.renderData(data.data);
            } catch {
                // Ignore refresh errors
            }
        }, 5000);
    },

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    },

    destroy() {
        this.stopAutoRefresh();
    },
};
