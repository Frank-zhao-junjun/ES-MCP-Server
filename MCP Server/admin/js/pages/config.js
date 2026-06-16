/**
 * Config Page
 */
const ConfigPage = {
    async render() {
        const content = document.getElementById('content');
        content.innerHTML = '<div class="loading">Loading configuration...</div>';

        try {
            const data = await AdminAPI.getConfig();
            this.renderData(data.data);
        } catch (err) {
            content.innerHTML = `<div class="empty-state">Failed to load configuration: ${err.message}</div>`;
        }
    },

    renderData(data) {
        const content = document.getElementById('content');
        const runtime = data.runtime || {};
        const env = data.env || {};

        // Format memory usage
        const memUsage = runtime.memoryUsage || {};
        const formatBytes = (bytes) => {
            if (!bytes) return 'N/A';
            return (bytes / 1024 / 1024).toFixed(2) + ' MB';
        };

        // Sort env vars alphabetically
        const sortedEnv = Object.entries(env).sort(([a], [b]) => a.localeCompare(b));

        content.innerHTML = `
            <h2 class="page-title">System Configuration</h2>

            <div class="section">
                <h3 class="section-title">Version</h3>
                <div class="card">
                    <div class="card-value">${data.version || 'unknown'}</div>
                </div>
            </div>

            <div class="section">
                <h3 class="section-title">Runtime</h3>
                <div class="table-container">
                    <table>
                        <tbody>
                            <tr><td class="kv-key">Node Version</td><td>${runtime.nodeVersion || 'N/A'}</td></tr>
                            <tr><td class="kv-key">Platform</td><td>${runtime.platform || 'N/A'}</td></tr>
                            <tr><td class="kv-key">Architecture</td><td>${runtime.arch || 'N/A'}</td></tr>
                            <tr><td class="kv-key">PID</td><td>${runtime.pid || 'N/A'}</td></tr>
                            <tr><td class="kv-key">Uptime</td><td>${this.formatUptime(runtime.uptime || 0)}</td></tr>
                            <tr><td class="kv-key">Heap Used</td><td>${formatBytes(memUsage.heapUsed)}</td></tr>
                            <tr><td class="kv-key">Heap Total</td><td>${formatBytes(memUsage.heapTotal)}</td></tr>
                            <tr><td class="kv-key">RSS</td><td>${formatBytes(memUsage.rss)}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="section">
                <h3 class="section-title">Environment Variables</h3>
                <div class="table-container" style="max-height: 500px; overflow-y: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>Variable</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedEnv.map(([key, value]) => `
                                <tr>
                                    <td class="kv-key">${key}</td>
                                    <td>${this.escapeHtml(String(value))}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (days > 0) return `${days}d ${hours}h ${mins}m`;
        if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    destroy() {},
};
