/**
 * lib/admin-api.js — 管理后台 REST API 路由
 *
 * 提供管理后台所需的全部 API 端点：
 * - /admin/api/auth/* — 认证
 * - /admin/api/dashboard — 仪表盘数据
 * - /admin/api/keys — API Key 管理
 * - /admin/api/plugins — 插件管理
 * - /admin/api/sessions — 会话监控
 * - /admin/api/tools — 工具列表
 * - /admin/api/config — 系统配置
 * - /admin/api/health — 健康检查
 */

const express = require('express');
const path = require('path');
const { adminAuth } = require('./admin-auth');

// 敏感环境变量名模式（脱敏用）
const SENSITIVE_PATTERNS = [
    /password/i,
    /secret/i,
    /key/i,
    /token/i,
    /credential/i,
    /auth/i,
];

/**
 * 判断环境变量名是否敏感
 */
function isSensitiveEnvVar(name) {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(name));
}

/**
 * 脱敏 API Key（显示前 8 位 + ***）
 */
function maskApiKey(key) {
    if (!key || key.length <= 8) return '***';
    return key.substring(0, 8) + '***';
}

/**
 * 创建管理后台 API Router
 * @param {Object} options - 共享服务
 * @param {Object} options.metrics - MetricsStore 实例
 * @param {Object} options.authContext - MCP 认证上下文
 * @param {Object} options.dynamicLoader - DynamicLoader 实例
 * @param {Object} options.sapResponseCache - SAP 响应缓存
 * @param {Object} options.circuitBreaker - 断路器状态
 * @param {Map} options.httpSessions - HTTP 会话 Map
 * @param {Array} options.registeredTools - 已注册工具列表
 * @returns {express.Router}
 */
function createAdminRouter(options = {}) {
    const router = express.Router();
    const {
        metrics,
        authContext,
        dynamicLoader,
        sapResponseCache,
        circuitBreaker,
        httpSessions,
        registeredTools,
    } = options;

    // ── 静态文件服务 ──────────────────────────────────────────────
    const adminDir = path.join(__dirname, '..', 'admin');
    router.use(express.static(adminDir));

    // ── 认证端点（不需要认证中间件）────────────────────────────────

    /**
     * POST /admin/api/auth/login
     * 登录
     */
    router.post('/api/auth/login', (req, res) => {
        const { password } = req.body || {};
        const result = adminAuth.login(password);

        if (result.ok) {
            // 设置 cookie
            res.cookie('admin_session', result.token, {
                httpOnly: true,
                sameSite: 'strict',
                path: '/admin',
                maxAge: adminAuth.sessionTTL,
            });
            return res.json({ ok: true });
        }

        const status = result.error.includes('disabled') ? 503 : 401;
        return res.status(status).json({ ok: false, error: result.error });
    });

    /**
     * POST /admin/api/auth/logout
     * 登出
     */
    router.post('/api/auth/logout', (req, res) => {
        const token = req.cookies?.admin_session;
        adminAuth.logout(token);
        res.clearCookie('admin_session', { path: '/admin' });
        res.json({ ok: true });
    });

    /**
     * GET /admin/api/auth/status
     * 检查认证状态
     */
    router.get('/api/auth/status', (req, res) => {
        if (!adminAuth.isEnabled()) {
            return res.json({ enabled: false });
        }

        const token = req.cookies?.admin_session;
        const result = adminAuth.validateSession(token);
        res.json({
            enabled: true,
            authenticated: result.valid,
        });
    });

    // ── 以下端点需要认证 ──────────────────────────────────────────
    router.use('/api', adminAuth.middleware());

    /**
     * GET /admin/api/dashboard
     * 仪表盘数据
     */
    router.get('/api/dashboard', (req, res) => {
        const metricsData = metrics ? metrics.getMetrics() : null;
        const cacheStats = sapResponseCache ? sapResponseCache.getStats() : null;
        const cbState = circuitBreaker ? circuitBreaker.getState() : null;

        res.json({
            ok: true,
            data: {
                metrics: metricsData,
                cache: cacheStats,
                circuitBreaker: cbState,
                adminSessions: adminAuth.getActiveSessionCount(),
            },
        });
    });

    /**
     * GET /admin/api/keys
     * API Key 列表
     */
    router.get('/api/keys', (req, res) => {
        const keys = [];

        if (authContext) {
            if (authContext.apiKeys && authContext.apiKeys.size > 0) {
                // 多键模式
                for (const [key, info] of authContext.apiKeys) {
                    const now = Date.now();
                    const isLocked = info.lockUntil > now;
                    const lockRemainingMs = isLocked ? info.lockUntil - now : 0;

                    keys.push({
                        key: maskApiKey(key),
                        role: info.role,
                        failedAttempts: info.failedAttempts,
                        locked: isLocked,
                        lockRemainingMs,
                        lockRemainingSeconds: Math.ceil(lockRemainingMs / 1000),
                    });
                }
            } else if (authContext.apiKey) {
                // 单键模式
                const now = Date.now();
                const isLocked = authContext.lockUntil > now;
                const lockRemainingMs = isLocked ? authContext.lockUntil - now : 0;

                keys.push({
                    key: maskApiKey(authContext.apiKey),
                    role: process.env.MCP_ROLE || 'readonly',
                    failedAttempts: authContext.failedAttempts || 0,
                    locked: isLocked,
                    lockRemainingMs,
                    lockRemainingSeconds: Math.ceil(lockRemainingMs / 1000),
                });
            }
        }

        res.json({
            ok: true,
            data: {
                mode: authContext?.apiKeys ? 'multi' : 'single',
                keys,
            },
        });
    });

    /**
     * GET /admin/api/plugins
     * 插件列表
     */
    router.get('/api/plugins', (req, res) => {
        const plugins = [];

        if (dynamicLoader) {
            const pluginList = dynamicLoader.listPlugins();
            for (const plugin of pluginList) {
                plugins.push({
                    id: plugin.id,
                    name: plugin.name,
                    version: plugin.version,
                    description: plugin.description,
                    toolCount: plugin.tools ? plugin.tools.length : 0,
                    tools: plugin.tools ? plugin.tools.map(t => t.name) : [],
                });
            }
        }

        res.json({
            ok: true,
            data: { plugins },
        });
    });

    /**
     * DELETE /admin/api/plugins/:id
     * 卸载插件
     */
    router.delete('/api/plugins/:id', async (req, res) => {
        const { id } = req.params;

        if (!dynamicLoader) {
            return res.status(503).json({
                ok: false,
                error: 'Plugin system not available',
            });
        }

        try {
            const result = await dynamicLoader.unloadPlugin(id);
            if (result) {
                res.json({ ok: true, message: `Plugin "${id}" unloaded` });
            } else {
                res.status(404).json({
                    ok: false,
                    error: `Plugin "${id}" not found`,
                });
            }
        } catch (err) {
            res.status(500).json({
                ok: false,
                error: err.message,
            });
        }
    });

    /**
     * GET /admin/api/sessions
     * HTTP 会话列表
     */
    router.get('/api/sessions', (req, res) => {
        const sessions = [];

        if (httpSessions && httpSessions.size > 0) {
            for (const [id, session] of httpSessions) {
                sessions.push({
                    id: id.substring(0, 16) + '...',
                    createdAt: session.createdAt,
                    lastActive: session.lastActive,
                    age: Date.now() - session.createdAt,
                });
            }
        }

        res.json({
            ok: true,
            data: {
                count: sessions.length,
                sessions,
            },
        });
    });

    /**
     * DELETE /admin/api/sessions/:id
     * 终止会话
     */
    router.delete('/api/sessions/:id', (req, res) => {
        const { id } = req.params;

        if (!httpSessions) {
            return res.status(503).json({
                ok: false,
                error: 'Session management not available',
            });
        }

        // 查找匹配的 session（支持部分匹配）
        let found = false;
        for (const [sessionId] of httpSessions) {
            if (sessionId.startsWith(id) || sessionId === id) {
                httpSessions.delete(sessionId);
                found = true;
                break;
            }
        }

        if (found) {
            res.json({ ok: true, message: 'Session terminated' });
        } else {
            res.status(404).json({
                ok: false,
                error: 'Session not found',
            });
        }
    });

    /**
     * GET /admin/api/tools
     * 工具列表
     */
    router.get('/api/tools', (req, res) => {
        const tools = registeredTools || [];

        // 按业务域分类
        const categories = {
            procurement: [],
            sales: [],
            masterData: [],
            production: [],
            logistics: [],
            finance: [],
            system: [],
        };

        const PROCUREMENT_TOOLS = ['get_purchase_order', 'get_purchase_requisition', 'get_schedule_agreement', 'get_purchase_rfq', 'get_supplier_evaluation', 'get_service_entry_sheet'];
        const SALES_TOOLS = ['get_sales_order_status', 'trace_sales_order', 'get_sales_quotation', 'get_sales_pricing_condition', 'get_sales_contract'];
        const MASTER_DATA_TOOLS = ['get_product', 'get_business_partner', 'get_material_stock', 'get_bom', 'get_entity_schema'];
        const PRODUCTION_TOOLS = ['get_production_data', 'get_production_order_confirmation', 'get_routing', 'get_inspection_data'];
        const LOGISTICS_TOOLS = ['get_material_reservation', 'get_physical_inventory'];
        const FINANCE_TOOLS = ['get_supplier_invoice', 'get_cost_center', 'get_activity_type'];
        const SYSTEM_TOOLS = ['authenticate', 'health_check', 'list_sap_scenarios', 'query_sap_scenario', 'load_plugin', 'unload_plugin', 'list_loaded_plugins', 'get_attachment', 'get_iam_user_role'];

        for (const tool of tools) {
            const item = {
                name: tool.name,
                description: tool.description,
            };

            if (PROCUREMENT_TOOLS.includes(tool.name)) {
                categories.procurement.push(item);
            } else if (SALES_TOOLS.includes(tool.name)) {
                categories.sales.push(item);
            } else if (MASTER_DATA_TOOLS.includes(tool.name)) {
                categories.masterData.push(item);
            } else if (PRODUCTION_TOOLS.includes(tool.name)) {
                categories.production.push(item);
            } else if (LOGISTICS_TOOLS.includes(tool.name)) {
                categories.logistics.push(item);
            } else if (FINANCE_TOOLS.includes(tool.name)) {
                categories.finance.push(item);
            } else {
                categories.system.push(item);
            }
        }

        res.json({
            ok: true,
            data: {
                total: tools.length,
                categories,
                tools,
            },
        });
    });

    /**
     * GET /admin/api/config
     * 系统配置
     */
    router.get('/api/config', (req, res) => {
        // 环境变量（脱敏）
        const envVars = {};
        for (const [key, value] of Object.entries(process.env)) {
            if (isSensitiveEnvVar(key)) {
                envVars[key] = value ? '***' : '(empty)';
            } else {
                envVars[key] = value;
            }
        }

        // 运行时信息
        const runtime = {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            pid: process.pid,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
        };

        // 版本信息
        let packageVersion = 'unknown';
        try {
            const pkg = require('../package.json');
            packageVersion = pkg.version;
        } catch {
            // ignore
        }

        res.json({
            ok: true,
            data: {
                version: packageVersion,
                runtime,
                env: envVars,
            },
        });
    });

    /**
     * GET /admin/api/health
     * 健康检查
     */
    router.get('/api/health', (req, res) => {
        const health = {
            sap: {
                configured: !!process.env.SAP_BASE_URL,
                baseUrl: process.env.SAP_BASE_URL ? 'configured' : 'not set',
                client: process.env.SAP_CLIENT || '100',
            },
            circuitBreaker: circuitBreaker ? circuitBreaker.getState() : { state: 'UNKNOWN' },
            cache: sapResponseCache ? {
                enabled: sapResponseCache.isEnabled(),
                ttlMs: sapResponseCache.ttlMs,
                stats: sapResponseCache.getStats(),
            } : { enabled: false },
            autoPagination: {
                enabled: require('./auto-pagination').isAutoPageEnabled(),
                maxRecords: require('./auto-pagination').getAutoPageMax(),
            },
            httpTransport: {
                enabled: process.env.MCP_ENABLE_HTTP_TRANSPORT === 'true',
                port: process.env.MCP_PORT || 3000,
                bindAddress: process.env.MCP_BIND_ADDRESS || '127.0.0.1',
            },
            adminDashboard: {
                enabled: adminAuth.isEnabled(),
                activeSessions: adminAuth.getActiveSessionCount(),
            },
        };

        res.json({
            ok: true,
            data: health,
        });
    });

    // ── SPA 回退路由 ──────────────────────────────────────────────
    // 所有未匹配的 /admin/* 路由返回 index.html（支持前端路由）
    router.get('*', (req, res) => {
        res.sendFile(path.join(adminDir, 'index.html'));
    });

    return router;
}

module.exports = {
    createAdminRouter,
    isSensitiveEnvVar,
    maskApiKey,
};
