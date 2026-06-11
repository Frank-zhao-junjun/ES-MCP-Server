/**
 * tests/run-tests.js — MCP Server 测试入口
 * 运行方式: npm test 或 node tests/run-tests.js
 */
const assert = require('assert');
const libErrors = require('./unit/lib-errors.test');
const libResponse = require('./unit/lib-mcp-response.test');
const observability = require('./unit/observability.test');
const mcpAuth = require('./unit/mcp-auth.test');
const mcpSapCore = require('./unit/mcp-sap-core.test');
const services = require('./unit/services.test');
const costCenter = require('./unit/cost-center.test');
const sapIntegration = require('./integration/sap-integration.test');

async function main() {
    const start = Date.now();
    console.log('═══════════════════════════════════════');
    console.log('  SAP MCP Server — Test Suite');
    console.log('═══════════════════════════════════════');
    console.log('');

    // ── Unit Tests ──
    console.log('── Unit Tests ──');
    libErrors.run();
    libResponse.run();
    observability.run();
    mcpAuth.run();
    mcpSapCore.run();
    await services.run();
    await costCenter.run();
    console.log('');

    // ── Integration Tests ──
    console.log('── Integration Tests ──');
    await sapIntegration.run();
    console.log('');

    const elapsed = Date.now() - start;
    console.log('═══════════════════════════════════════');
    console.log(`  ✅ All tests passed (${elapsed}ms)`);
    console.log('═══════════════════════════════════════');
}

main().catch(err => {
    console.error('\n❌ TEST FAILURE:', err.message);
    console.error(err.stack);
    process.exit(1);
});
