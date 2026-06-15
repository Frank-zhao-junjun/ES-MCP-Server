const ErrorCodes = Object.freeze({
    ADMIN_TOOL_DISABLED: 'ADMIN_TOOL_DISABLED',
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    RATE_LIMITED: 'RATE_LIMITED',
    AUTH_INVALID_KEY: 'AUTH_INVALID_KEY',
    AUTH_LOCKED: 'AUTH_LOCKED',
    AUTH_MISSING: 'AUTH_MISSING',
    DEBUG_TOOL_DISABLED: 'DEBUG_TOOL_DISABLED',
    INTERNAL: 'INTERNAL',
    INVALID_INPUT: 'INVALID_INPUT',
    NO_ENDPOINT: 'NO_ENDPOINT',
    QUERY_FAILED: 'QUERY_FAILED',
    SAP_NETWORK_ERROR: 'SAP_NETWORK_ERROR',
    SAP_TIMEOUT: 'SAP_TIMEOUT',
    SAP_UNAVAILABLE: 'SAP_UNAVAILABLE',
    SCENARIO_NOT_FOUND: 'SCENARIO_NOT_FOUND',
    STATUS_FAILED: 'STATUS_FAILED',
    TRACE_PARTIAL_FAILURE: 'TRACE_PARTIAL_FAILURE',
});

function errorCodeFromSapStatus(status) {
    switch (status) {
        case 401:
        case 403:
            return ErrorCodes.AUTH_MISSING;
        case 404:
            return ErrorCodes.NO_ENDPOINT;
        case 408:
            return ErrorCodes.SAP_TIMEOUT;
        case 502:
        case 503:
        case 504:
            return ErrorCodes.SAP_UNAVAILABLE;
        default:
            return status >= 500 ? ErrorCodes.SAP_NETWORK_ERROR : ErrorCodes.INTERNAL;
    }
}

function makeError(code, message, options = {}) {
    return {
        code,
        message,
        sapStatus: options.sapStatus || undefined,
        retryable: Boolean(options.retryable),
        details: options.details || undefined,
    };
}

function normalizeError(err, fallbackCode = ErrorCodes.INTERNAL) {
    if (err && err.code && err.message) {
        return makeError(err.code, err.message, {
            sapStatus: err.sapStatus,
            retryable: err.retryable,
            details: err.details,
        });
    }

    return makeError(fallbackCode, err && err.message ? err.message : String(err || 'Unknown error'));
}

module.exports = {
    ErrorCodes,
    makeError,
    normalizeError,
    errorCodeFromSapStatus,
};
