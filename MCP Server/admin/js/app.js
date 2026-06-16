/**
 * Admin Dashboard App
 * Main application logic - routing, authentication, page management
 */
const App = {
    currentPage: null,
    pages: {
        dashboard: DashboardPage,
        keys: KeysPage,
        plugins: PluginsPage,
        sessions: SessionsPage,
        tools: ToolsPage,
        config: ConfigPage,
        health: HealthPage,
    },

    async init() {
        // Check auth status
        try {
            const status = await AdminAPI.checkStatus();

            if (!status.enabled) {
                this.showDisabledScreen();
                return;
            }

            if (status.authenticated) {
                this.showApp();
            } else {
                this.showLoginScreen();
            }
        } catch (err) {
            this.showLoginScreen();
        }

        // Setup event listeners
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                this.navigateTo(page);
            });
        });

        // Handle hash changes
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.slice(1) || 'dashboard';
            this.navigateTo(hash);
        });
    },

    async handleLogin() {
        const passwordInput = document.getElementById('password-input');
        const errorEl = document.getElementById('login-error');
        const password = passwordInput.value;

        errorEl.classList.add('hidden');

        try {
            const result = await AdminAPI.login(password);
            if (result.ok) {
                passwordInput.value = '';
                this.showApp();
            } else {
                errorEl.textContent = result.error || 'Login failed';
                errorEl.classList.remove('hidden');
            }
        } catch (err) {
            errorEl.textContent = err.message || 'Login failed';
            errorEl.classList.remove('hidden');
        }
    },

    async handleLogout() {
        try {
            await AdminAPI.logout();
        } catch {
            // Ignore logout errors
        }
        this.showLoginScreen();
    },

    showLoginScreen() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
        document.getElementById('disabled-screen').classList.add('hidden');
    },

    showApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        document.getElementById('disabled-screen').classList.add('hidden');

        // Navigate to current page or dashboard
        const hash = window.location.hash.slice(1) || 'dashboard';
        this.navigateTo(hash);
    },

    showDisabledScreen() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.add('hidden');
        document.getElementById('disabled-screen').classList.remove('hidden');
    },

    navigateTo(pageName) {
        // Destroy current page
        if (this.currentPage && this.currentPage.destroy) {
            this.currentPage.destroy();
        }

        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === pageName);
        });

        // Update URL hash
        if (window.location.hash.slice(1) !== pageName) {
            window.location.hash = pageName;
        }

        // Render new page
        const page = this.pages[pageName];
        if (page) {
            this.currentPage = page;
            page.render();
        } else {
            document.getElementById('content').innerHTML = `
                <div class="empty-state">Page not found: ${pageName}</div>
            `;
        }
    },
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
