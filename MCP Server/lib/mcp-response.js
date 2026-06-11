const SCHEMA_VERSION = '1.0';

function toolSuccess(tool, data, warnings = []) {
    return {
        schemaVersion: SCHEMA_VERSION,
        tool,
        ok: true,
        data,
        warnings,
        error: null,
    };
}

function toolFailure(tool, error, options = {}) {
    return {
        schemaVersion: SCHEMA_VERSION,
        tool,
        ok: false,
        data: options.data || null,
        warnings: options.warnings || [],
        error,
    };
}

function textJson(payload) {
    return {
        content: [{
            type: 'text',
            text: JSON.stringify(payload, null, 2),
        }],
    };
}

module.exports = {
    SCHEMA_VERSION,
    toolSuccess,
    toolFailure,
    textJson,
};
