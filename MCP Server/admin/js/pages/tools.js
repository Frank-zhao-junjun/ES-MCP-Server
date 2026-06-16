/**
 * Tools Page
 */
const ToolsPage = {
    async render() {
        const content = document.getElementById('content');
        content.innerHTML = '<div class="loading">Loading tools...</div>';

        try {
            const data = await AdminAPI.getTools();
            this.renderData(data.data);
        } catch (err) {
            content.innerHTML = `<div class="empty-state">Failed to load tools: ${err.message}</div>`;
        }
    },

    renderData(data) {
        const content = document.getElementById('content');
        const categories = data.categories || {};
        const total = data.total || 0;

        const categoryLabels = {
            procurement: 'Procurement',
            sales: 'Sales',
            masterData: 'Master Data',
            production: 'Production',
            logistics: 'Logistics',
            finance: 'Finance',
            system: 'System',
        };

        let sectionsHtml = '';
        for (const [key, label] of Object.entries(categoryLabels)) {
            const tools = categories[key] || [];
            if (tools.length > 0) {
                sectionsHtml += `
                    <div class="section">
                        <h3 class="section-title">${label} (${tools.length})</h3>
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Tool Name</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tools.map(tool => `
                                        <tr>
                                            <td>${tool.name}</td>
                                            <td style="font-family: var(--font-sans); font-size: 0.8rem;">${tool.description || '-'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            }
        }

        content.innerHTML = `
            <h2 class="page-title">Registered Tools</h2>

            <div class="section">
                <div class="card">
                    <div class="card-label">Total Tools</div>
                    <div class="card-value">${total}</div>
                </div>
            </div>

            ${sectionsHtml}
        `;
    },

    destroy() {},
};
