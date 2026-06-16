/**
 * Health Page
 */
const HealthPage = {
    async render() {
        const content = document.getElementById('content');
        content.innerHTML = '<div class="loading">Loading health status...</div>';

        try {
            const data = await AdminAPI.getHealth();
            this.renderData(data.data);
        } catch (err) {
            content.innerHTML = `<div class="empty-state">Failed to load health status: ${err.message}</div>`;
        }
    },

    renderData(data) {
        const content = document.getElementById('content');
        const sap = data.sap || {};
        const cb = data.circuitBreaker || {};
        const cache = data.cache || {};
        const autoPage = data.autoPagination || {};
        const http = data.httpTransport || {};
        const admin = data.adminDashboard || {};

        content.innerHTML = `
            <h2 class="page-title">Health Check</h2>

            <div class="section">
                <h3 class="section-title">SAP Connection</h3>
                <div class="table-container">
                    <table>
                        <tbody>
                            <tr>
                                <td class="kv-key">Status</td>
                                <td><span class="status ${sap.configured ? 'status-ok' : 'status-error'}">${sap.configured ? 'Configured' : 'Not Configured'}</span></td>
                            </tr>
                            <tr><td class="kv-key">Base URL</td><td>${sap.baseUrl || 'N/A'}</td></tr>
                            <tr><td class="kv-key">Client</td><td>${sap.client || 'N/A'}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="section">
                <h3 class="section-title">Circuit Breaker</h3>
                <div class="table-container">
                    <table>
                        <tbody>
                            <tr>
                                <td class="kv-key">State</td>
                                <td><span class="status ${cb.state === 'CLOSED' ? 'status-ok' : cb.state === 'OPEN' ? 'status-error' : 'status-warning'}">${cb.state || 'UNKNOWN'}</span></td>
                            </tr>
                            <tr><td class="kv-key">Failure Count</td><td>${cb.failureCount || 0}</td></tr>
                            <tr><td class="kv-key">Last Failure</td><td>${cb.lastFailureTime ? new Date(cb.lastFailureTime).toLocaleString() : 'N/A'}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="section">
                <h3 class="section-title">Response Cache</h3>
                <div class="table-container">
                    <table>
                        <tbody>
                            <tr>
                                <td class="kv-key">Enabled</td>
                                <td><span class="status ${cache.enabled ? 'status-ok' : 'status-warning'}">${cache.enabled ? 'Yes' : 'No'}</span></td>
                            </tr>
                            <tr><td class="kv-key">TTL</td><td>${cache.ttlMs ? cache.ttlMs + 'ms' : 'N/A'}</td></tr>
                            ${cache.stats ? `
                                <tr><td class="kv-key">Hits</td><td>${cache.stats.hits || 0}</td></tr>
                                <tr><td class="kv-key">Misses</td><td>${cache.stats.misses || 0}</td></tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="section">
                <h3 class="section-title">Auto-Pagination</h3>
                <div class="table-container">
                    <table>
                        <tbody>
                            <tr>
                                <td class="kv-key">Enabled</td>
                                <td><span class="status ${autoPage.enabled ? 'status-ok' : 'status-warning'}">${autoPage.enabled ? 'Yes' : 'No'}</span></td>
                            </tr>
                            <tr><td class="kv-key">Max Records</td><td>${autoPage.maxRecords || 'N/A'}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="section">
                <h3 class="section-title">HTTP Transport</h3>
                <div class="table-container">
                    <table>
                        <tbody>
                            <tr>
                                <td class="kv-key">Enabled</td>
                                <td><span class="status ${http.enabled ? 'status-ok' : 'status-warning'}">${http.enabled ? 'Yes' : 'No'}</span></td>
                            </tr>
                            <tr><td class="kv-key">Port</td><td>${http.port || 'N/A'}</td></tr>
                            <tr><td class="kv-key">Bind Address</td><td>${http.bindAddress || 'N/A'}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="section">
                <h3 class="section-title">Admin Dashboard</h3>
                <div class="table-container">
                    <table>
                        <tbody>
                            <tr>
                                <td class="kv-key">Enabled</td>
                                <td><span class="status ${admin.enabled ? 'status-ok' : 'status-warning'}">${admin.enabled ? 'Yes' : 'No'}</span></td>
                            </tr>
                            <tr><td class="kv-key">Active Sessions</td><td>${admin.activeSessions || 0}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    destroy() {},
};
