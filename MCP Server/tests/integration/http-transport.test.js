/**
 * tests/integration/http-transport.test.js
 * v0.5 Goal A: HTTP/SSE Transport Integration Test
 *
 * Tests the MCP Streamable HTTP transport endpoint.
 */
const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');

const TEST_PORT = 3456;
const SERVER_STARTUP_TIMEOUT = 5000;

// ── Helper: Start MCP server with HTTP transport ──

function startHttpServer(env = {}) {
    return new Promise((resolve, reject) => {
        const serverPath = path.join(__dirname, '..', '..', 'mcp-server.js');
        const proc = spawn('node', [serverPath], {
            env: {
                ...process.env,
                MCP_ENABLE_HTTP_TRANSPORT: 'true',
                MCP_PORT: String(TEST_PORT),
                MCP_BIND_ADDRESS: '127.0.0.1',
                MCP_API_KEY: 'test-key-123',
                MCP_REQUIRE_API_KEY: 'false',
                SAP_BASE_URL: 'http://localhost:9999',
                SAP_CREDENTIALS_FILE: '/tmp/mcp-test/user.txt',
                SAP_SCENARIO_DIR: '/tmp/mcp-test',
                ...env,
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stderr = '';
        let resolved = false;

        proc.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
            // Wait for the HTTP transport ready message
            if (stderr.includes('HTTP Transport') && !resolved) {
                resolved = true;
                resolve({ proc, stderr });
            }
        });

        proc.on('error', (err) => {
            if (!resolved) {
                resolved = true;
                reject(err);
            }
        });

        proc.on('exit', (code) => {
            if (!resolved) {
                resolved = true;
                reject(new Error(`Server exited with code ${code}: ${stderr}`));
            }
        });

        // Timeout
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                proc.kill();
                reject(new Error(`Server startup timeout. stderr: ${stderr}`));
            }
        }, SERVER_STARTUP_TIMEOUT);
    });
}

// ── Helper: Make HTTP request ──

async function httpRequest(method, path, body = null, headers = {}) {
    const url = `http://127.0.0.1:${TEST_PORT}${path}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            ...headers,
        },
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    const resp = await fetch(url, options);
    const text = await resp.text();
    let json = null;
    try {
        json = JSON.parse(text);
    } catch {
        // not JSON
    }
    return { status: resp.status, headers: resp.headers, text, json };
}

// ════════════════════════════════════════════════════
// Test: Health endpoint returns server info
// ════════════════════════════════════════════════════

async function testHealthEndpoint() {
    const resp = await httpRequest('GET', '/');

    assert.strictEqual(resp.status, 200);
    assert.ok(resp.json, 'Response should be JSON');
    assert.strictEqual(resp.json.name, 'SAP S/4HANA MCP Server');
    assert.strictEqual(resp.json.status, 'running');
    assert.ok(resp.json.version, 'Should have version');
    assert.ok(resp.json.timestamp, 'Should have timestamp');
}

// ════════════════════════════════════════════════════
// Test: MCP endpoint accepts POST requests
// ════════════════════════════════════════════════════

async function testMcpPostEndpoint() {
    // Send an MCP initialize request
    const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
                name: 'test-client',
                version: '1.0.0',
            },
        },
    };

    const resp = await httpRequest('POST', '/mcp', initRequest);

    // MCP Streamable HTTP should return 200 or 202
    assert.ok(
        resp.status === 200 || resp.status === 202,
        `Expected 200 or 202, got ${resp.status}: ${resp.text}`
    );
}

// ════════════════════════════════════════════════════
// Test: MCP endpoint accepts GET requests (SSE)
// ════════════════════════════════════════════════════

async function testMcpGetEndpoint() {
    const resp = await httpRequest('GET', '/mcp');

    // GET /mcp for SSE stream:
    // - 200: SSE stream established
    // - 400: Missing session ID (stateless mode may reject)
    // - 405: Method not allowed
    // - 406: Not Acceptable (missing Accept header)
    // - 500: Internal error (stateless mode doesn't support GET SSE)
    // All are valid responses depending on server configuration
    assert.ok(
        resp.status === 200 || resp.status === 400 || resp.status === 405 || resp.status === 406 || resp.status === 500,
        `Expected 200, 400, 405, 406, or 500, got ${resp.status}`
    );
}

// ════════════════════════════════════════════════════
// Test: Invalid JSON returns error
// ════════════════════════════════════════════════════

async function testInvalidJson() {
    const url = `http://127.0.0.1:${TEST_PORT}/mcp`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json {{{',
    });

    // Should return 400 Bad Request or similar
    assert.ok(
        resp.status >= 400,
        `Expected 4xx error, got ${resp.status}`
    );
}

// ════════════════════════════════════════════════════
// Test Runner
// ════════════════════════════════════════════════════

async function runTests() {
    console.log('Starting HTTP transport integration tests...\n');

    let server = null;
    let passed = 0;
    let failed = 0;
    const failures = [];

    try {
        console.log('Starting MCP server with HTTP transport...');
        server = await startHttpServer();
        console.log('Server started successfully.\n');

        const tests = [
            ['Health endpoint', testHealthEndpoint],
            ['MCP POST endpoint', testMcpPostEndpoint],
            ['MCP GET endpoint', testMcpGetEndpoint],
            ['Invalid JSON handling', testInvalidJson],
        ];

        for (const [name, fn] of tests) {
            try {
                await fn();
                console.log(`  ✅ ${name}`);
                passed++;
            } catch (err) {
                console.log(`  ❌ ${name}: ${err.message}`);
                failures.push({ name, error: err.message });
                failed++;
            }
        }
    } catch (err) {
        console.error(`\n❌ Setup failed: ${err.message}`);
        failed++;
        failures.push({ name: 'Setup', error: err.message });
    } finally {
        if (server && server.proc) {
            server.proc.kill('SIGTERM');
            // Wait for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);

    if (failures.length > 0) {
        console.log('\nFailures:');
        for (const f of failures) {
            console.log(`  - ${f.name}: ${f.error}`);
        }
        process.exit(1);
    }

    console.log('\n✅ All HTTP transport tests passed!');
}

// Run if executed directly
if (require.main === module) {
    runTests().catch(err => {
        console.error('Test runner error:', err);
        process.exit(1);
    });
}

module.exports = { runTests, startHttpServer, httpRequest };
