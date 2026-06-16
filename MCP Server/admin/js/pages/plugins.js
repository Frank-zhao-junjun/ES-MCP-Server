/**
 * Plugins Page
 */
const PluginsPage = {
    async render() {
        const content = document.getElementById('content');
        content.innerHTML = '<div class="loading">Loading plugins...</div>';

        try {
            const data = await AdminAPI.getPlugins();
            this.renderData(data.data);
        } catch (err) {
            content.innerHTML = `<div class="empty-state">Failed to load plugins: ${err.message}</div>`;
        }
    },

    renderData(data) {
        const content = document.getElementById('content');
        const plugins = data.plugins || [];

        content.innerHTML = `
            <h2 class="page-title">Plugins</h2>

            ${plugins.length === 0 ? `
                <div class="empty-state">No plugins loaded</div>
            ` : `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Version</th>
                                <th>Tools</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${plugins.map(plugin => `
                                <tr>
                                    <td>${plugin.id}</td>
                                    <td>${plugin.name}</td>
                                    <td>${plugin.version}</td>
                                    <td>${plugin.toolCount} (${plugin.tools.join(', ')})</td>
                                    <td>
                                        <button class="btn btn-danger btn-small" onclick="PluginsPage.unload('${plugin.id}')">
                                            Unload
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

    async unload(id) {
        if (!confirm(`Unload plugin "${id}"?`)) return;

        try {
            await AdminAPI.unloadPlugin(id);
            this.render(); // Refresh
        } catch (err) {
            alert(`Failed to unload plugin: ${err.message}`);
        }
    },

    destroy() {},
};
