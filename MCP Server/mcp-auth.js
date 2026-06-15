const crypto = require('crypto');
const { ErrorCodes } = require('./lib/errors');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30000;

function isApiKeyRequired() {
    return process.env.MCP_REQUIRE_API_KEY === 'true' || process.env.NODE_ENV === 'production';
}

function createAuthContext() {
    return {
        apiKey: null,
        authenticated: false,
        failedAttempts: 0,
        lockUntil: 0,
    };
}

const defaultAuthContext = createAuthContext();

function initAuth(context = defaultAuthContext) {
    context.apiKey = process.env.MCP_API_KEY || '';

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

function authenticate(key, context = defaultAuthContext) {
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

function isAuthenticated(context = defaultAuthContext) {
    return context.authenticated;
}

function requireAuth(context = defaultAuthContext) {
    if (!context.authenticated) {
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
    isAuthenticated,
    requireAuth,
    generateNewKey,
};
