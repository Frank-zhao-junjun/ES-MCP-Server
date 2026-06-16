/**
 * Sessions Page
 */
const SessionsPage = {
    async render() {
        const content = document.getElementById('content');
        content.innerHTML = '<div class="loading">Loading sessions...</div>';

        try {
            const data = await AdminAPI.getSessions();
            this.renderData(data.data);
        } catch (err) {
            content.innerHTML = `<div class="empty-state">Failed to load sessions: ${err.message}</div>`;
        }
    },

    renderData(data) {
        const content = document.getElementById('content');
        const sessions = data.sessions || [];

        content.innerHTML = `
            <h2 class="page-title">HTTP Sessions</h2>

            <div class="section">
                <div class="card">
                    <div class="card-label">Active Sessions</div>
                    <div class="card-value">${data.count || 0}</div>
                </div>
            </div>

            ${sessions.length === 0 ? `
                <div class="empty-state">No active HTTP sessions</div>
            ` : `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Session ID</th>
                                <th>Created</th>
                                <th>Last Active</th>
                                <th>Age</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sessions.map(session => `
                                <tr>
                                    <td>${session.id}</td>
                                    <td>${new Date(session.createdAt).toLocaleString()}</td>
                                    <td>${new Date(session.lastActive).toLocaleString()}</td>
                                    <td>${this.formatAge(session.age)}</td>
                                    <td>
                                        <button class="btn btn-danger btn-small" onclick="SessionsPage.terminate('${session.id}')">
                                            Terminate
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        `;
    },

    formatAge(ms) {
        const seconds = Math.floor(ms / 1000);
        const mins = Math.floor(seconds / 60);
        const hours = Math.floor(mins / 60);
        if (hours > 0) return `${hours}h ${mins % 60}m`;
        if (mins > 0) return `${mins}m ${seconds % 60}s`;
        return `${seconds}s`;
    },

    async terminate(id) {
        if (!confirm(`Terminate session "${id}"?`)) return;

        try {
            await AdminAPI.terminateSession(id);
            this.render(); // Refresh
        } catch (err) {
            alert(`Failed to terminate session: ${err.message}`);
        }
    },

    destroy() {},
};
