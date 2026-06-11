const { createAuthContext } = require('./mcp-auth');
const { createSapContext } = require('./mcp-sap-core');

function createRuntimeContext() {
    return {
        auth: createAuthContext(),
        sap: createSapContext(),
    };
}

module.exports = {
    createRuntimeContext,
};
