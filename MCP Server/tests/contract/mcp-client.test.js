/**
 * tests/contract/mcp-client.test.js — MCP Client Contract Tests
 *
 * Spawns the MCP server via StdioClientTransport and validates:
 *   - tools/list response shape
 *   - authenticate success & failure
 *   - tool call response schema (schemaVersion, ok, data, error)
 *   - error code stability
 *
 * Run:  node tests/contract/mcp-client.test.js
 */

const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const SERVER_PATH = path.join(__dirname, '..', '..', 'mcp-server.js');
const SCENARIO_DIR = path.join(__dirname, '..', '..', '..');
const CRED_FILE = path.join(__dirname, '..', '..', '..', 'user.txt');
const TEST_API_KEY = 'mcp-ct-' + Date.now().toString(36);
const TIMEOUT_MS = 20000;

let passed = 0;
let failed = 0;

function assert(condition, label) {
    if (condition) { passed++; console.log(`  ✅ ${label}`); }
    else { failed++; console.error(`  ❌ ${label}`); }
}

function withTimeout(promise, ms, label) {
    const timer = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms)
    );
    return Promise.race([promise, timer]);
}

async function run() {
    const start = Date.now();
    console.log('═══════════════════════════════════════');
    console.log('  MCP Client — Contract Tests');
    console.log('═══════════════════════════════════════\n');

    const transport = new StdioClientTransport({
        command: 'node',
        args: [SERVER_PATH],
        env: {
            ...process.env,
            MCP_API_KEY: TEST_API_KEY,
            MCP_REQUIRE_API_KEY: 'false',
            MCP_ROLE: 'admin',
            MCP_ENABLE_DEBUG_TOOLS: 'true',
            MCP_ENABLE_ADMIN_TOOLS: 'true',
            SAP_CREDENTIALS_FILE: CRED_FILE,
            SAP_SCENARIO_DIR: SCENARIO_DIR,
            SAP_BASE_URL: 'https://test-tenant.example.com',
        },
        stderr: 'pipe',
    });

    const client = new Client(
        { name: 'contract-test', version: '1.0.0' },
        { capabilities: {} }
    );

    try {
        console.log('── Connecting to MCP Server ──');
        await withTimeout(client.connect(transport), TIMEOUT_MS, 'client.connect');

        // ── Test 1: tools/list ───────────────────────────
        console.log('\n── Test 1: tools/list ──');
        const toolsResult = await withTimeout(client.listTools(), TIMEOUT_MS, 'tools/list');
        assert(Array.isArray(toolsResult.tools), 'tools/list returns array');
        assert(toolsResult.tools.length >= 10, `>= 10 tools (${toolsResult.tools.length})`);

        const names = toolsResult.tools.map(t => t.name);
        for (const n of ['authenticate', 'health_check', 'get_sales_order_status', 'list_sap_scenarios', 'get_purchase_order']) {
            assert(names.includes(n), `tool: ${n}`);
        }

        // ── Test 2: authenticate failure ─────────────────
        console.log('\n── Test 2: authenticate (bad key) ──');
        const bad = await withTimeout(
            client.callTool({ name: 'authenticate', arguments: { api_key: 'bad-key' } }),
            TIMEOUT_MS, 'authenticate-bad'
        );
        const badP = JSON.parse(bad.content[0].text);
        assert(badP.ok === false, 'ok: false');
        assert(['AUTH_INVALID_KEY', 'AUTH_LOCKED'].includes(badP.error?.code),
            `error.code is AUTH_INVALID_KEY or AUTH_LOCKED (got ${badP.error?.code})`);

        // ── Test 3: authenticate success ─────────────────
        console.log('\n── Test 3: authenticate (good key) ──');
        const auth = await withTimeout(
            client.callTool({ name: 'authenticate', arguments: { api_key: TEST_API_KEY } }),
            TIMEOUT_MS, 'authenticate-good'
        );
        const authP = JSON.parse(auth.content[0].text);
        assert(authP.ok === true, 'ok: true');
        assert(authP.data?.authenticated === true, 'authenticated: true');

        // ── Test 4: health_check ─────────────────────────
        console.log('\n── Test 4: health_check ──');
        const health = await withTimeout(
            client.callTool({ name: 'health_check', arguments: { includeSapCheck: false } }),
            TIMEOUT_MS, 'health_check'
        );
        const healthP = JSON.parse(health.content[0].text);
        assert(healthP.ok === true, 'ok: true');
        assert(healthP.data?.server?.ok === true, 'server.ok');
        assert(typeof healthP.data?.server?.version === 'string', 'server.version is string');

        // ── Test 5: list_sap_scenarios ───────────────────
        console.log('\n── Test 5: list_sap_scenarios ──');
        const list = await withTimeout(
            client.callTool({ name: 'list_sap_scenarios', arguments: {} }),
            TIMEOUT_MS, 'list_sap_scenarios'
        );
        const listP = JSON.parse(list.content[0].text);
        assert(listP.ok === true, 'ok: true');
        assert(typeof listP.data?.count === 'number', 'has count');
        assert(Array.isArray(listP.data?.scenarios), 'scenarios is array');

        // ── Test 6: bad scenario → error schema ──────────
        console.log('\n── Test 6: query_sap_scenario (bad key) ──');
        const errR = await withTimeout(
            client.callTool({ name: 'query_sap_scenario', arguments: { key: 'no_such_key' } }),
            TIMEOUT_MS, 'bad-scenario'
        );
        const errP = JSON.parse(errR.content[0].text);
        assert(errP.ok === false, 'ok: false');
        assert(typeof errP.error === 'object', 'error is object');
        assert(typeof errP.error.code === 'string', 'error.code is string');

        // ── Test 7: Schema conformance ───────────────────
        console.log('\n── Test 7: Response schema ──');
        for (const field of ['schemaVersion', 'tool', 'ok', 'data', 'warnings', 'error']) {
            assert(field in authP, `auth has ${field}`);
            assert(field in healthP, `health has ${field}`);
            assert(field in errP, `error has ${field}`);
        }
        assert(authP.schemaVersion === '1.0', 'schemaVersion: 1.0');
        assert(authP.tool === 'authenticate', 'tool matches');

    } finally {
        try { await client.close(); } catch (_) {}
    }

    const elapsed = Date.now() - start;
    console.log(`\n═══════════════════════════════════════`);
    console.log(`  ${passed} passed, ${failed} failed (${elapsed}ms)`);
    console.log('═══════════════════════════════════════');
    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('\n❌ CONTRACT TEST FAILURE:', err.message);
    process.exit(1);
});

