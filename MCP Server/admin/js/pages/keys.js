/**
 * API Keys Page
 */
const KeysPage = {
    async render() {
        const content = document.getElementById('content');
        content.innerHTML = '<div class="loading">Loading API keys...</div>';

        try {
            const data = await AdminAPI.getKeys();
            this.renderData(data.data);
        } catch (err) {
            content.innerHTML = `<div class="empty-state">Failed to load API keys: ${err.message}</div>`;
        }
    },

    renderData(data) {
        const content = document.getElementById('content');
        const keys = data.keys || [];

        content.innerHTML = `
            <h2 class="page-title">API Keys</h2>

            <div class="section">
                <h3 class="section-title">Authentication Mode: ${data.mode === 'multi' ? 'Multi-Key' : 'Single-Key'}</h3>
            </div>

            ${keys.length === 0 ? `
                <div class="empty-state">No API keys configured</div>
            ` : `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Key</th>
                                <th>Role</th>
                                <th>Failed Attempts</th>
                                <th>Status</th>
                                <th>Lock Remaining</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${keys.map(key => `
                                <tr>
                                    <td>${key.key}</td>
                                    <td><span class="status status-ok">${key.role}</span></td>
                                    <td>${key.failedAttempts}</td>
                                    <td>
                                        ${key.locked
                                            ? '<span class="status status-locked">LOCKED</span>'
                                            : '<span class="status status-ok">ACTIVE</span>'}
                                    </td>
                                    <td>${key.locked ? key.lockRemainingSeconds + 's' : '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        `;
    },

    destroy() {},
};
