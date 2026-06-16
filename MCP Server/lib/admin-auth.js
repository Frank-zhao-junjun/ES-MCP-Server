/**
 * lib/admin-auth.js — 管理后台认证模块
 *
 * 独立于 MCP API Key 的认证系统：
 * - MCP_ADMIN_PASSWORD 环境变量配置密码
 * - Session-based auth，cookie 存储
 * - 8 小时有效期（可配置）
 * - 登录失败限流（10次/分钟）
 */

const crypto = require('crypto');

const DEFAULT_SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 60 * 1000; // 1 minute

class AdminAuth {
    constructor(options = {}) {
        this.password = options.password || process.env.MCP_ADMIN_PASSWORD || '';
        this.sessionTTL = options.sessionTTL || parseInt(process.env.MCP_ADMIN_SESSION_TTL, 10) || DEFAULT_SESSION_TTL;
        this.sessions = new Map(); // token -> { createdAt, lastActive }
        this.loginAttempts = []; // timestamps of login attempts

        if (this.password) {
            console.error('[admin-auth] Admin dashboard enabled');
        } else {
            console.error('[admin-auth] Admin dashboard disabled (MCP_ADMIN_PASSWORD not set)');
        }
    }

    /**
     * 检查管理后台是否启用
     */
    isEnabled() {
        return this.password.length > 0;
    }

    /**
     * 检查登录限流
     * @returns {boolean} true = 允许登录, false = 已限流
     */
    _checkRateLimit() {
        const now = Date.now();
        // 清理过期的尝试记录
        this.loginAttempts = this.loginAttempts.filter(t => now - t < LOGIN_WINDOW_MS);
        return this.loginAttempts.length < MAX_LOGIN_ATTEMPTS;
    }

    /**
     * 记录登录尝试
     */
    _recordAttempt() {
        this.loginAttempts.push(Date.now());
    }

    /**
     * 登录
     * @param {string} password - 用户输入的密码
     * @returns {{ ok: boolean, token?: string, error?: string }}
     */
    login(password) {
        if (!this.isEnabled()) {
            return { ok: false, error: 'Admin dashboard is disabled' };
        }

        if (!this._checkRateLimit()) {
            return { ok: false, error: 'Too many login attempts. Please try again later.' };
        }

        this._recordAttempt();

        // 使用 timing-safe 比较防止时序攻击
        const inputBuffer = Buffer.from(String(password || ''));
        const secretBuffer = Buffer.from(this.password);

        if (inputBuffer.length !== secretBuffer.length) {
            return { ok: false, error: 'Invalid password' };
        }

        const match = crypto.timingSafeEqual(inputBuffer, secretBuffer);
        if (!match) {
            return { ok: false, error: 'Invalid password' };
        }

        // 生成 session token
        const token = crypto.randomBytes(32).toString('hex');
        const now = Date.now();
        this.sessions.set(token, {
            createdAt: now,
            lastActive: now,
        });

        return { ok: true, token };
    }

    /**
     * 登出
     * @param {string} token - session token
     * @returns {{ ok: boolean }}
     */
    logout(token) {
        if (token && this.sessions.has(token)) {
            this.sessions.delete(token);
        }
        return { ok: true };
    }

    /**
     * 验证 session
     * @param {string} token - session token
     * @returns {{ valid: boolean, expired?: boolean }}
     */
    validateSession(token) {
        if (!token) {
            return { valid: false };
        }

        const session = this.sessions.get(token);
        if (!session) {
            return { valid: false };
        }

        const now = Date.now();
        if (now - session.createdAt > this.sessionTTL) {
            // Session 过期，清理
            this.sessions.delete(token);
            return { valid: false, expired: true };
        }

        // 更新最后活动时间
        session.lastActive = now;
        return { valid: true };
    }

    /**
     * Express 认证中间件
     */
    middleware() {
        return (req, res, next) => {
            if (!this.isEnabled()) {
                return res.status(503).json({
                    ok: false,
                    error: 'Admin dashboard is disabled',
                });
            }

            // 从 cookie 或 Authorization header 获取 token
            let token = null;

            // 1. 检查 cookie
            if (req.cookies && req.cookies.admin_session) {
                token = req.cookies.admin_session;
            }

            // 2. 检查 Authorization header (Bearer token)
            if (!token && req.headers.authorization) {
                const parts = req.headers.authorization.split(' ');
                if (parts.length === 2 && parts[0] === 'Bearer') {
                    token = parts[1];
                }
            }

            const result = this.validateSession(token);
            if (!result.valid) {
                return res.status(401).json({
                    ok: false,
                    error: result.expired ? 'Session expired' : 'Unauthorized',
                });
            }

            next();
        };
    }

    /**
     * 获取活跃 session 数量
     */
    getActiveSessionCount() {
        const now = Date.now();
        let count = 0;
        for (const [token, session] of this.sessions) {
            if (now - session.createdAt <= this.sessionTTL) {
                count++;
            } else {
                this.sessions.delete(token);
            }
        }
        return count;
    }

    /**
     * 清理过期 session
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        for (const [token, session] of this.sessions) {
            if (now - session.createdAt > this.sessionTTL) {
                this.sessions.delete(token);
            }
        }
    }
}

// 全局单例
const adminAuth = new AdminAuth();

module.exports = {
    AdminAuth,
    adminAuth,
};
