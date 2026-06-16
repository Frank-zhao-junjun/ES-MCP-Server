/**
 * Admin API Client
 */
const AdminAPI = {
    baseUrl: '/admin/api',

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            ...options,
        };

        const response = await fetch(url, config);

        if (response.status === 401) {
            // Session expired or unauthorized
            window.location.reload();
            throw new Error('Unauthorized');
        }

        const data = await response.json();
        return data;
    },

    // Auth
    async checkStatus() {
        return this.request('/auth/status');
    },

    async login(password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ password }),
        });
    },

    async logout() {
        return this.request('/auth/logout', { method: 'POST' });
    },

    // Dashboard
    async getDashboard() {
        return this.request('/dashboard');
    },

    // API Keys
    async getKeys() {
        return this.request('/keys');
    },

    // Plugins
    async getPlugins() {
        return this.request('/plugins');
    },

    async unloadPlugin(id) {
        return this.request(`/plugins/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        });
    },

    // Sessions
    async getSessions() {
        return this.request('/sessions');
    },

    async terminateSession(id) {
        return this.request(`/sessions/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        });
    },

    // Tools
    async getTools() {
        return this.request('/tools');
    },

    // Config
    async getConfig() {
        return this.request('/config');
    },

    // Health
    async getHealth() {
        return this.request('/health');
    },
};
