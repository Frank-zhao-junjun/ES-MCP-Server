const fs = require('fs');
const path = require('path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const {
    sapFetch,
    extractRows,
    getScenarios,
    queryScenario,
    MAX_TOP,
} = require('./mcp-sap-core');
const {
    initAuth,
    authenticate: doAuth,
    requireAuth,
    isAuthenticated,
} = require('./mcp-auth');
const { ErrorCodes, makeError, normalizeError } = require('./lib/errors');
const { toolSuccess, toolFailure, textJson } = require('./lib/mcp-response');
const { createRuntimeContext } = require('./runtime-context');
const { generateTraceId, createTraceContext, recordSapCall, metrics } = require('./lib/observability');
const { getSalesOrderStatus } = require('./services/sales-order-status');
const { traceSalesOrder } = require('./services/sales-order-trace');
const { getCostCenter } = require('./services/cost-center');
const { getProduct } = require('./services/product');
const { getBusinessPartner } = require('./services/business-partner');

const server = new McpServer({
    name: 'sap-s4-mcp',
    version: '0.3.0',
});
const runtimeContext = createRuntimeContext();

// ── Observability ───────────────────────────────────

let activeRequests = 0;
let isShuttingDown = false;

function logRequest({ requestId, traceId, tool, durationMs, status, error, sapCalls }) {
    const line = JSON.stringify({
        timestamp: new Date().toISOString(),
        level: status === 'success' ? 'info' : 'warn',
        requestId,
        traceId: traceId || undefined,
        tool,
        durationMs,
        status,
        error: error || undefined,
        sapCalls: sapCalls || undefined,
    });
    console.error(line);
}

function wrapTool(toolName, handler) {
    return async (args) => {
        if (isShuttingDown) {
            return textJson(toolFailure(toolName, makeError(ErrorCodes.INTERNAL, 'Server is shutting down')));
        }

        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const traceId = generateTraceId();
        const start = Date.now();
        let status = 'success';
        let error = null;

        activeRequests++;
        try {
            const result = await handler(args);
            try {
                const payload = JSON.parse(result.content[0].text);
                if (!payload.ok) {
                    status = 'failure';
                    error = payload.error?.code || 'UNKNOWN';
                }
            } catch (_) {
                // non-JSON result, treat as success
            }
            return result;
        } catch (err) {
            status = 'error';
            error = err.code || err.message;
            throw err;
        } finally {
            const durationMs = Date.now() - start;
            activeRequests--;
            metrics.recordRequest(toolName, durationMs, status === 'success');
            logRequest({ requestId, traceId, tool: toolName, durationMs, status, error });
        }
    };
}

// ── Debug / Config ──────────────────────────────────

function isDebugToolEnabled() {
    return process.env.MCP_ENABLE_DEBUG_TOOLS === 'true';
}

function sapDependencies(traceId) {
    return {
        sapFetch: async (url) => {
            const start = Date.now();
            try {
                const result = await sapFetch(url, runtimeContext.sap);
                const durationMs = Date.now() - start;
                metrics.recordSapCall(durationMs, true);
                if (traceId) {
                    recordSapCall(null, url, durationMs, 'ok');
                }
                return result;
            } catch (err) {
                const durationMs = Date.now() - start;
                metrics.recordSapCall(durationMs, false);
                if (traceId) {
                    recordSapCall(null, url, durationMs, err.code || err.message, err.code);
                }
                throw err;
            }
        },
        extractRows,
    };
}

function requireAuthenticatedTool(toolName) {
    try {
        requireAuth(runtimeContext.auth);
        return null;
    } catch (err) {
        return textJson(toolFailure(toolName, normalizeError(err, ErrorCodes.AUTH_REQUIRED)));
    }
}

server.tool(
    'authenticate',
    `Authenticate with the MCP Server using an API key. This MUST be the FIRST tool you call before using any other tool.

Parameters:
- api_key: The pre-shared API key configured for this MCP Server.`,
    {
        api_key: z.string().min(1).describe('The API key for this MCP Server'),
    },
    wrapTool('authenticate', async ({ api_key }) => {
        const result = doAuth(api_key, runtimeContext.auth);
        const data = {
            authenticated: result.success,
            locked: result.locked || false,
            retryAfter: result.retryAfter || null,
            remainingAttempts: result.remainingAttempts || null,
            message: result.message,
        };

        if (result.success) {
            return textJson(toolSuccess('authenticate', data));
        }

        return textJson(toolFailure('authenticate', makeError(result.code || ErrorCodes.AUTH_INVALID_KEY, result.message), { data }));
    })
);

server.tool(
    'health_check',
    `Check MCP Server health including configuration, connectivity, auth status, uptime, and performance metrics.

Parameters:
- includeSapCheck: Test actual SAP API connectivity (default true). Set false for faster response.
- includeScenarios: Include per-scenario reachability check (default false). Enabling may be slow.`,
    {
        includeSapCheck: z.boolean().optional().default(true),
        includeScenarios: z.boolean().optional().default(false),
    },
    wrapTool('health_check', async ({ includeSapCheck, includeScenarios }) => {
        const warnings = [];
        const checks = {
            server: { ok: true, version: '0.3.0', uptimeSeconds: metrics.getMetrics().uptimeSeconds },
            auth: { ok: isAuthenticated(runtimeContext.auth) },
            credentialsFile: { ok: false, path: process.env.SAP_CREDENTIALS_FILE || path.join(__dirname, '..', 'user.txt') },
            scenarioDir: { ok: false, path: process.env.SAP_SCENARIO_DIR || __dirname },
            scenarios: { ok: false, count: 0 },
            sapConnectivity: { ok: false, checked: false },
            metrics: metrics.getMetrics(),
        };

        // 凭据文件
        try {
            fs.accessSync(checks.credentialsFile.path, fs.constants.R_OK);
            checks.credentialsFile.ok = true;
        } catch (err) {
            checks.credentialsFile.error = err.message;
            warnings.push('Credentials file not accessible');
        }

        // 场景目录
        try {
            const scenarioDir = checks.scenarioDir.path;
            fs.accessSync(scenarioDir, fs.constants.R_OK);
            checks.scenarioDir.ok = true;
            const files = fs.readdirSync(scenarioDir).filter(f => /SAP_COM_\d{4}/i.test(f) && /\.txt$/i.test(f));
            checks.scenarios.count = files.length;
            checks.scenarios.ok = files.length > 0;
            if (!checks.scenarios.ok) {
                warnings.push('No SAP scenario files found');
            }
        } catch (err) {
            checks.scenarioDir.error = err.message;
            warnings.push('Scenario directory not accessible');
        }

        // SAP 连通性测试（实际 HTTP 调用）
        if (includeSapCheck) {
            checks.sapConnectivity.checked = true;
            try {
                const base = process.env.SAP_BASE_URL || 'https://my200967-api.s4hana.sapcloud.cn';
                const resp = await fetch(`${base}/sap/opu/odata/sap/?$format=json&sap-client=${process.env.SAP_CLIENT || '100'}`, {
                    headers: { Accept: 'application/json' },
                    signal: AbortSignal.timeout(10000),
                });
                checks.sapConnectivity.ok = resp.ok;
                checks.sapConnectivity.statusCode = resp.status;
                if (!resp.ok) {
                    warnings.push(`SAP returned HTTP ${resp.status}`);
                }
            } catch (err) {
                checks.sapConnectivity.ok = false;
                checks.sapConnectivity.error = err.code || err.message;
                warnings.push(`SAP connectivity test failed: ${err.message}`);
            }
        }

        const allOk = checks.credentialsFile.ok && checks.scenarioDir.ok && checks.scenarios.ok
            && (!includeSapCheck || checks.sapConnectivity.ok);
        return textJson(toolSuccess('health_check', checks, warnings.length > 0 ? warnings : []));
    })
);

server.tool(
    'list_sap_scenarios',
    'List available SAP Communication Scenarios. Returns scenario key, code, title, and endpoint count.',
    {},
    wrapTool('list_sap_scenarios', async () => {
        const authFailure = requireAuthenticatedTool('list_sap_scenarios');
        if (authFailure) return authFailure;

        try {
            const scenarios = getScenarios().map(scenario => ({
                key: scenario.key,
                code: scenario.code,
                title: scenario.title,
                urlCount: scenario.urls.length,
            }));
            return textJson(toolSuccess('list_sap_scenarios', { count: scenarios.length, scenarios }));
        } catch (err) {
            return textJson(toolFailure('list_sap_scenarios', normalizeError(err, ErrorCodes.INTERNAL)));
        }
    })
);

server.tool(
    'get_sales_order_status',
    `Get the current Sales Order header and item status. Use this business tool before trace_sales_order when you only need direct Sales Order information.

Parameters:
- salesOrder: Sales Order number, e.g. "19" or "0000000019".
- includeItems: Include Sales Order items, default true.
- top: Max item records, default 20, max 50.`,
    {
        salesOrder: z.string().min(1).describe('Sales Order number, e.g. "19"'),
        includeItems: z.boolean().optional().default(true),
        top: z.number().min(1).max(50).optional().default(20),
    },
    wrapTool('get_sales_order_status', async (args) => {
        const authFailure = requireAuthenticatedTool('get_sales_order_status');
        if (authFailure) return authFailure;

        try {
            const data = await getSalesOrderStatus(args, sapDependencies(args._traceId));
            const warnings = data.found ? [] : [`Sales Order "${args.salesOrder}" not found`];
            return textJson(toolSuccess('get_sales_order_status', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_sales_order_status', normalizeError(err, ErrorCodes.STATUS_FAILED)));
        }
    })
);

server.tool(
    'trace_sales_order',
    `Trace the lifecycle of a Sales Order across related SAP documents.

Parameters:
- salesOrder: Sales Order number, e.g. "19" or "0000000019".
- includeDeliveries: Include outbound delivery data, default true.
- includeProductionOrders: Include production order data, default true.
- includeMaterialDocuments: Include material movement documents, default true.
- includeBillingDocuments: Include billing document data, default true.
- top: Max records per entity, default 20, max 50.`,
    {
        salesOrder: z.string().min(1).describe('Sales Order number, e.g. "19"'),
        includeDeliveries: z.boolean().optional().default(true),
        includeProductionOrders: z.boolean().optional().default(true),
        includeMaterialDocuments: z.boolean().optional().default(true),
        includeBillingDocuments: z.boolean().optional().default(true),
        top: z.number().min(1).max(50).optional().default(20),
    },
    wrapTool('trace_sales_order', async (args) => {
        const authFailure = requireAuthenticatedTool('trace_sales_order');
        if (authFailure) return authFailure;

        try {
            const result = await traceSalesOrder(args, sapDependencies(args._traceId));
            if (result.errors.length > 0) {
                return textJson(toolFailure(
                    'trace_sales_order',
                    makeError(ErrorCodes.TRACE_PARTIAL_FAILURE, 'Sales Order trace completed with critical step failures.', { details: result.errors }),
                    { data: { salesOrder: result.salesOrder, ...result.data }, warnings: result.warnings }
                ));
            }

            return textJson(toolSuccess('trace_sales_order', {
                salesOrder: result.salesOrder,
                ...result.data,
            }, result.warnings));
        } catch (err) {
            return textJson(toolFailure('trace_sales_order', normalizeError(err, ErrorCodes.TRACE_PARTIAL_FAILURE)));
        }
    })
);

server.tool(
    'query_sap_scenario',
    `Debug/admin tool: query a specific SAP Communication Scenario by key. Disabled unless MCP_ENABLE_DEBUG_TOOLS=true.

Parameters:
- key: Scenario key. Get valid keys from list_sap_scenarios.
- filter: Optional OData filter string in plain text, e.g. "SalesOrder eq '19'".
- top: Max records to return, default 20, max 100.`,
    {
        key: z.string().describe('Scenario key, e.g. "sap_com_0109_sales_order"'),
        filter: z.string().optional().describe('OData filter, e.g. "SalesOrder eq \'19\'"'),
        top: z.number().min(1).max(MAX_TOP).optional().describe('Max records, default 20, max 100'),
    },
    wrapTool('query_sap_scenario', async ({ key, filter, top }) => {
        const authFailure = requireAuthenticatedTool('query_sap_scenario');
        if (authFailure) return authFailure;

        if (!isDebugToolEnabled()) {
            return textJson(toolFailure(
                'query_sap_scenario',
                makeError(ErrorCodes.DEBUG_TOOL_DISABLED, 'query_sap_scenario is disabled. Set MCP_ENABLE_DEBUG_TOOLS=true to enable debug/admin querying.')
            ));
        }

        try {
            const result = await queryScenario(key, filter, top, runtimeContext.sap);
            const summary = `Scenario: ${result.scenario.title} (${result.scenario.code})\nObjects found: ${result.objects.length}\nTotal records: ${result.objects.reduce((sum, object) => sum + object.count, 0)}`;
            const warnings = Object.keys(result.summary)
                .filter(entityName => result.summary[entityName] === 0)
                .map(entityName => `Entity "${entityName}" returned 0 records`);

            return textJson(toolSuccess('query_sap_scenario', {
                summary,
                scenario: result.scenario,
                objects: result.objects,
            }, warnings));
        } catch (err) {
            return textJson(toolFailure('query_sap_scenario', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_cost_center
// ────────────────────────────────────────────────────

server.tool(
    'get_cost_center',
    `Query SAP Cost Center master data. Returns cost center details including controlling area, company code, profit center, responsible person, and multilingual descriptions.

Use this to find cost center information by any combination of cost center number, controlling area, or company code.

Parameters:
- costCenter: Cost center number(s). Single value like "10101001" or comma-separated like "10101001,10101002".
- controllingArea: Controlling area (e.g. "A000").
- companyCode: Company code (e.g. "1010").
- includeText: Include multilingual cost center name/description texts (default true).
- top: Max records to return, default 20, max 100.`,
    {
        costCenter: z.string().optional().describe('Cost center number(s), e.g. "10101001" or "10101001,10101002"'),
        controllingArea: z.string().optional().describe('Controlling area, e.g. "A000"'),
        companyCode: z.string().optional().describe('Company code, e.g. "1010"'),
        includeText: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
    },
    wrapTool('get_cost_center', async (args) => {
        const authFailure = requireAuthenticatedTool('get_cost_center');
        if (authFailure) return authFailure;

        try {
            const data = await getCostCenter(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No cost centers found matching the criteria'] : [];
            return textJson(toolSuccess('get_cost_center', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_cost_center', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_product
// ────────────────────────────────────────────────────

server.tool(
    'get_product',
    `Query SAP Product master data. Returns product details including type, group, base unit, status, and multilingual descriptions.

Parameters:
- product: Material number(s), single "MAT001" or comma-separated "MAT001,MAT002".
- productType: Product type filter (e.g. "FERT" for finished good, "HAWA" for trading good).
- productGroup: Product group filter.
- includeDescription: Include multilingual product descriptions (default true).
- top: Max records, default 20, max 100.`,
    {
        product: z.string().optional().describe('Material number(s), e.g. "MAT001" or "MAT001,MAT002"'),
        productType: z.string().optional().describe('Product type, e.g. "FERT", "HAWA", "ROH"'),
        productGroup: z.string().optional().describe('Product group code'),
        includeDescription: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
    },
    wrapTool('get_product', async (args) => {
        const authFailure = requireAuthenticatedTool('get_product');
        if (authFailure) return authFailure;

        try {
            const data = await getProduct(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No products found matching the criteria'] : [];
            return textJson(toolSuccess('get_product', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_product', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_business_partner
// ────────────────────────────────────────────────────

server.tool(
    'get_business_partner',
    `Query SAP Business Partner master data. Returns BP details including name, category, and optionally linked Customer/Supplier records.

Parameters:
- businessPartner: BP number(s), single "1000001" or comma-separated "1000001,1000002".
- businessPartnerCategory: BP category filter (e.g. "1" for person, "2" for organization).
- includeCustomer: Include linked Customer master data (default false).
- includeSupplier: Include linked Supplier master data (default false).
- top: Max records, default 20, max 100.`,
    {
        businessPartner: z.string().optional().describe('BP number(s), e.g. "1000001" or "1000001,1000002"'),
        businessPartnerCategory: z.string().optional().describe('BP category, e.g. "1" (person), "2" (organization)'),
        includeCustomer: z.boolean().optional().default(false),
        includeSupplier: z.boolean().optional().default(false),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
    },
    wrapTool('get_business_partner', async (args) => {
        const authFailure = requireAuthenticatedTool('get_business_partner');
        if (authFailure) return authFailure;

        try {
            const data = await getBusinessPartner(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No business partners found matching the criteria'] : [];
            return textJson(toolSuccess('get_business_partner', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_business_partner', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

async function gracefulShutdown(transport) {
    isShuttingDown = true;
    console.error('[sap-s4-mcp] Shutting down gracefully...');
    while (activeRequests > 0) {
        console.error(`[sap-s4-mcp] Waiting for ${activeRequests} active request(s)...`);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    await transport.close();
    console.error('[sap-s4-mcp] Graceful shutdown complete');
    process.exit(0);
}

function validateStartupConfig() {
    const errors = [];
    const warnings = [];

    // 1. Credentials file
    const credFile = process.env.SAP_CREDENTIALS_FILE || path.join(__dirname, '..', 'user.txt');
    try {
        fs.accessSync(credFile, fs.constants.R_OK);
    } catch (err) {
        errors.push(`SAP_CREDENTIALS_FILE not readable: ${credFile} — ${err.message}`);
    }

    // 2. Scenario directory
    const scenarioDir = process.env.SAP_SCENARIO_DIR || path.join(__dirname, '..');
    try {
        fs.accessSync(scenarioDir, fs.constants.R_OK);
        const files = fs.readdirSync(scenarioDir).filter(f => /SAP_COM_\d{4}/i.test(f) && /\.txt$/i.test(f));
        if (files.length === 0) {
            warnings.push(`No SAP_COM_*.txt scenario files found in: ${scenarioDir}`);
        }
    } catch (err) {
        errors.push(`SAP_SCENARIO_DIR not readable: ${scenarioDir} — ${err.message}`);
    }

    // 3. SAP_BASE_URL format
    const baseUrl = process.env.SAP_BASE_URL || 'https://my200967-api.s4hana.sapcloud.cn';
    try {
        const parsed = new URL(baseUrl);
        if (!/^https?:$/.test(parsed.protocol)) {
            errors.push(`SAP_BASE_URL must use http or https protocol: ${baseUrl}`);
        }
    } catch {
        errors.push(`SAP_BASE_URL is not a valid URL: ${baseUrl}`);
    }

    // 4. SAP_CLIENT format
    const client = process.env.SAP_CLIENT || '100';
    if (!/^\d{3}$/.test(client)) {
        warnings.push(`SAP_CLIENT should be a 3-digit number, got: ${client}`);
    }

    for (const w of warnings) {
        console.error('[sap-s4-mcp config-warning]', w);
    }

    if (errors.length > 0) {
        for (const e of errors) {
            console.error('[sap-s4-mcp config-error]', e);
        }
        console.error('[sap-s4-mcp] Startup aborted due to configuration errors');
        process.exit(1);
    }
}

async function main() {
    validateStartupConfig();
    initAuth(runtimeContext.auth);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[sap-s4-mcp v0.3] MCP Server started via stdio');
    console.error('[sap-s4-mcp] SAP credentials from:', process.env.SAP_CREDENTIALS_FILE || 'default user.txt');
    console.error('[sap-s4-mcp] Authentication enabled');
    console.error('[sap-s4-mcp] Debug tools:', isDebugToolEnabled() ? 'enabled' : 'disabled');

    process.on('SIGTERM', () => gracefulShutdown(transport));
    process.on('SIGINT', () => gracefulShutdown(transport));
}

main().catch(err => {
    console.error('[sap-s4-mcp] Fatal startup error:', err.message);
    process.exit(1);
});
