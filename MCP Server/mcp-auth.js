const crypto = require('crypto');
const { ErrorCodes } = require('./lib/errors');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30000;

function isApiKeyRequired() {
    return process.env.MCP_REQUIRE_API_KEY === 'true' || process.env.NODE_ENV === 'production';
}

/**
 * 创建认证上下文。
 *
 * 多键模式 (MCP_API_KEYS)：
 *   context.apiKeys = Map<key, { role, failedAttempts, lockUntil }>
 *   context.authenticatedKey = 认证成功的 key 字符串
 *
 * 单键模式 (MCP_API_KEY，向后兼容)：
 *   context.apiKey = 单个密钥字符串
 *   context.authenticated = boolean
 *   context.failedAttempts / context.lockUntil = 全局锁定
 */
function createAuthContext() {
    return {
        // 多键
        apiKeys: null,
        authenticatedKey: null,
        // 单键 (向后兼容)
        apiKey: null,
        authenticated: false,
        failedAttempts: 0,
        lockUntil: 0,
    };
}

const defaultAuthContext = createAuthContext();

/**
 * 解析 MCP_API_KEYS JSON 并验证每个 role
 */
function _parseMultiKeys(raw) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (_) {
        console.error('[sap-s4-mcp] MCP_API_KEYS is not valid JSON — falling back to MCP_API_KEY');
        return null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        console.error('[sap-s4-mcp] MCP_API_KEYS must be a JSON object { key: role } — falling back to MCP_API_KEY');
        return null;
    }
    const VALID_ROLES = ['readonly', 'debug', 'admin'];
    const map = new Map();
    for (const [key, role] of Object.entries(parsed)) {
        const normalized = String(role || 'readonly').toLowerCase().trim();
        if (!VALID_ROLES.includes(normalized)) {
            console.error(`[sap-s4-mcp] MCP_API_KEYS: unknown role "${role}" for key "${key.substring(0, 8)}...", defaulting to "readonly"`);
        }
        map.set(key, {
            role: VALID_ROLES.includes(normalized) ? normalized : 'readonly',
            failedAttempts: 0,
            lockUntil: 0,
        });
    }
    return map.size > 0 ? map : null;
}

function initAuth(context = defaultAuthContext) {
    const multiKeysRaw = process.env.MCP_API_KEYS || '';
    const singleKey = process.env.MCP_API_KEY || '';

    if (multiKeysRaw) {
        // ── 多键模式 ──
        const map = _parseMultiKeys(multiKeysRaw);
        if (map) {
            context.apiKeys = map;
            context.apiKey = null;
            if (singleKey) {
                console.error('[sap-s4-mcp] MCP_API_KEYS takes precedence over MCP_API_KEY');
            }
            console.error(`[sap-s4-mcp] MCP_API_KEYS loaded: ${map.size} key(s) configured`);
            return null; // 多键模式不返回单个 key
        }
        // JSON 解析失败 → 回退到单键
    }

    // ── 单键模式 (向后兼容) ──
    context.apiKey = singleKey;
    context.apiKeys = null;

    if (!context.apiKey) {
        if (isApiKeyRequired()) {
            const err = new Error('MCP_API_KEY is required when MCP_REQUIRE_API_KEY=true or NODE_ENV=production.');
            err.code = ErrorCodes.AUTH_MISSING;
            throw err;
        }

        context.apiKey = 'mcp-' + crypto.randomBytes(24).toString('base64url');
        console.error('[sap-s4-mcp] MCP_API_KEY is not configured; generated a temporary key:');
        console.error(`[sap-s4-mcp] ${context.apiKey}`);
        console.error('[sap-s4-mcp] Configure this value in mcp.json env.MCP_API_KEY for stable use.');
    } else {
        console.error('[sap-s4-mcp] MCP_API_KEY loaded from environment');
    }

    return context.apiKey;
}

/**
 * 多键模式：检查指定 key 的锁定状态
 */
function _checkMultiKeyLock(keyRecord) {
    if (keyRecord.lockUntil > 0 && Date.now() < keyRecord.lockUntil) {
        const remaining = Math.ceil((keyRecord.lockUntil - Date.now()) / 1000);
        return {
            success: false,
            code: ErrorCodes.AUTH_LOCKED,
            message: `Too many failed attempts for this key. Please retry in ${remaining} seconds.`,
            locked: true,
            retryAfter: remaining,
        };
    }
    return null;
}

/**
 * 认证。多键模式：key 即凭据，存在且未锁定即成功。单键模式：向后兼容。
 */
function authenticate(key, context = defaultAuthContext) {
    // ── 多键模式 ──
    if (context.apiKeys && context.apiKeys instanceof Map) {
        const keyRecord = context.apiKeys.get(key);

        // 未知 key → 通用失败，不锁定（不泄露 key 是否存在）
        if (!keyRecord) {
            return {
                success: false,
                code: ErrorCodes.AUTH_INVALID_KEY,
                message: 'Invalid API key.',
            };
        }

        // 该 key 被锁定（管理员操作等）
        const lockResult = _checkMultiKeyLock(keyRecord);
        if (lockResult) return lockResult;

        // 成功 — 重置锁定状态
        keyRecord.failedAttempts = 0;
        keyRecord.lockUntil = 0;
        context.authenticatedKey = key;
        context.authenticated = true;
        return {
            success: true,
            message: 'Authentication successful. All tools are now available.',
            role: keyRecord.role,
        };
    }

    // ── 单键模式 (向后兼容) ──
    if (!context.apiKey) {
        initAuth(context);
    }

    if (context.lockUntil > 0 && Date.now() < context.lockUntil) {
        const remaining = Math.ceil((context.lockUntil - Date.now()) / 1000);
        return {
            success: false,
            code: ErrorCodes.AUTH_LOCKED,
            message: `Too many failed attempts. Please retry in ${remaining} seconds.`,
            locked: true,
            retryAfter: remaining,
        };
    }

    if (key === context.apiKey) {
        context.authenticated = true;
        context.failedAttempts = 0;
        context.lockUntil = 0;
        return { success: true, message: 'Authentication successful. All tools are now available.' };
    }

    context.failedAttempts++;
    if (context.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        context.lockUntil = Date.now() + LOCK_DURATION_MS;
        context.failedAttempts = 0;
        return {
            success: false,
            code: ErrorCodes.AUTH_LOCKED,
            message: `Authentication failed ${MAX_FAILED_ATTEMPTS} times. Account locked for ${LOCK_DURATION_MS / 1000} seconds.`,
            locked: true,
            retryAfter: LOCK_DURATION_MS / 1000,
        };
    }

    return {
        success: false,
        code: ErrorCodes.AUTH_INVALID_KEY,
        message: `Invalid API key. ${MAX_FAILED_ATTEMPTS - context.failedAttempts} attempt(s) remaining.`,
        remainingAttempts: MAX_FAILED_ATTEMPTS - context.failedAttempts,
    };
}

/**
 * 返回当前认证 key 的 role。
 * 多键模式: 从 apiKeys Map 查找。单键模式: 返回 null（由全局 MCP_ROLE 决定）。
 */
function getAuthenticatedRole(context = defaultAuthContext) {
    if (context.apiKeys && context.authenticatedKey) {
        const record = context.apiKeys.get(context.authenticatedKey);
        return record ? record.role : null;
    }
    return null;
}

function isAuthenticated(context = defaultAuthContext) {
    // 多键模式: authenticatedKey 存在即为已认证
    if (context.apiKeys) {
        return Boolean(context.authenticatedKey);
    }
    // 单键模式
    return context.authenticated;
}

function requireAuth(context = defaultAuthContext) {
    if (!isAuthenticated(context)) {
        const err = new Error('Authentication required. Please call the "authenticate" tool with your API key first.');
        err.code = ErrorCodes.AUTH_REQUIRED;
        throw err;
    }
}

function generateNewKey(context = defaultAuthContext) {
    context.apiKey = 'mcp-' + crypto.randomBytes(24).toString('base64url');
    context.authenticated = false;
    return context.apiKey;
}

module.exports = {
    createAuthContext,
    isApiKeyRequired,
    initAuth,
    authenticate,
    getAuthenticatedRole,
    isAuthenticated,
    requireAuth,
    generateNewKey,
};
