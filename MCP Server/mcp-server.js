const fs = require('fs');
const path = require('path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const express = require('express');
const cors = require('cors');
const { z } = require('zod');
const {
    sapFetch,
    extractRows,
    getScenarios,
    queryScenario,
    MAX_TOP,
    sapResponseCache,
} = require('./mcp-sap-core');
const {
    initAuth,
    authenticate: doAuth,
    requireAuth,
    isAuthenticated,
    getAuthenticatedRole,
} = require('./mcp-auth');
const { ErrorCodes, makeError, normalizeError } = require('./lib/errors');
const { toolSuccess, toolFailure, textJson } = require('./lib/mcp-response');
const { createRuntimeContext } = require('./runtime-context');
const { generateTraceId, createTraceContext, recordSapCall, metrics } = require('./lib/observability');
const { autoPaginate, isAutoPageEnabled, getAutoPageMax } = require('./lib/auto-pagination');
const { canUseDebugTools, canUseAdminTools } = require('./lib/roles');
const { getSalesOrderStatus } = require('./services/sales-order-status');
const { traceSalesOrder } = require('./services/sales-order-trace');
const { getCostCenter } = require('./services/cost-center');
const { getProduct } = require('./services/product');
const { getBusinessPartner } = require('./services/business-partner');
const { getPurchaseOrder } = require('./services/purchase-order');
const { getMaterialStock } = require('./services/material-stock');
const { getBOM } = require('./services/bom');
const { getSupplierInvoice } = require('./services/supplier-invoice');
const { getEntitySchema } = require('./services/entity-schema');
const { getPurchaseRequisition } = require('./services/purchase-requisition');
const { getScheduleAgreement } = require('./services/schedule-agreement');
const { getSalesContract } = require('./services/sales-contract');
const { getMaterialReservation } = require('./services/material-reservation');
const { getPurchaseRfq } = require('./services/purchase-rfq');
const { getSupplierEvaluation } = require('./services/supplier-evaluation');
const { getServiceEntrySheet } = require('./services/service-entry-sheet');
const { getSalesQuotation } = require('./services/sales-quotation');
const { getSalesPricingCondition } = require('./services/sales-pricing-condition');
const { getProductionData } = require('./services/production-data');
const { getProductionOrderConfirmation } = require('./services/production-order-confirmation');
const { getRouting } = require('./services/routing');
const { getInspectionData } = require('./services/inspection-data');
const { getPhysicalInventory } = require('./services/physical-inventory');
const { getActivityType } = require('./services/activity-type');
const { getAttachment } = require('./services/attachment');
const { getIamUserRole } = require('./services/iam-user-role');

// Plugin system
const DynamicLoader = require('./lib/dynamic-loader');

const server = new McpServer({
    name: 'sap-s4-mcp',
    version: '0.4.0',
});
const runtimeContext = createRuntimeContext();

// ── Plugin System Integration ───────────────────────────────────

let dynamicLoader = null;

// ── HTTP/SSE Transport Support ───────────────────────────────────

// 环境变量配置
const PORT = process.env.MCP_PORT || process.env.PORT || 3000;
const BIND_ADDRESS = process.env.MCP_BIND_ADDRESS || '127.0.0.1';
const ENABLE_HTTP_TRANSPORT = process.env.MCP_ENABLE_HTTP_TRANSPORT === 'true';

let httpServer = null;
let expressApp = null;
let mcpTransports = new Map(); // Store active transports for session management if needed, though stateless is often preferred for simple setups

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
            const toolArgs = args && typeof args === 'object' ? { ...args, _traceId: traceId } : { _traceId: traceId };
            const result = await handler(toolArgs);
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
// Delegates to lib/roles.js: respects MCP_ROLE with MCP_ENABLE_* overrides.
// v0.4: accepts optional roleOverride for multi-key per-key role.

function isDebugToolEnabled(roleOverride = null) {
    return canUseDebugTools(roleOverride);
}

function isAdminToolEnabled(roleOverride = null) {
    return canUseAdminTools(roleOverride);
}

function sapContextForTrace(traceId) {
    return {
        get lastGoodCred() {
            return runtimeContext.sap.lastGoodCred;
        },
        set lastGoodCred(value) {
            runtimeContext.sap.lastGoodCred = value;
        },
        traceId
    };
}

function sapDependencies(traceId, options = {}) {
    const autoPage = options.autoPage !== false;
    const context = sapContextForTrace(traceId);
    const traceCtx = createTraceContext(traceId);

    const _record = (url, durationMs, ok, errCode) => {
        metrics.recordSapCall(durationMs, ok);
        if (traceId) {
            recordSapCall(traceCtx, url, durationMs, ok ? 'ok' : (errCode || 'error'), errCode);
        }
    };

    return {
        sapFetch: async (url) => {
            const start = Date.now();

            if (autoPage && isAutoPageEnabled()) {
                try {
                    const { rows, metadata } = await autoPaginate(
                        (u) => sapFetch(u, context).then(r => {
                            _record(u, Date.now() - start, true);
                            return r;
                        }).catch(err => { throw err; }),
                        extractRows,
                        url,
                        { maxTotal: getAutoPageMax(), top: 100 }
                    );
                    if (metadata.autoPaged) {
                        const wrapper = { value: rows };
                        Object.defineProperty(wrapper, '_autoPaged', { value: true, enumerable: false });
                        Object.defineProperty(wrapper, '_totalFetched', { value: metadata.totalFetched, enumerable: false });
                        return wrapper;
                    }
                    return { value: rows };
                } catch (err) {
                    _record(url, Date.now() - start, false, err.code);
                    throw err;
                }
            }

            try {
                const result = await sapFetch(url, context);
                _record(url, Date.now() - start, true);
                return result;
            } catch (err) {
                _record(url, Date.now() - start, false, err.code);
                throw err;
            }
        },
        extractRows,
        _traceCtx: traceCtx,
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

// ── Built-in Tools ──────────────────────────────────

function requireAdminTool(toolName) {
    const authFailure = requireAuthenticatedTool(toolName);
    if (authFailure) return authFailure;

    const role = getAuthenticatedRole(runtimeContext.auth);
    if (!isAdminToolEnabled(role)) {
        return textJson(toolFailure(
            toolName,
            makeError(
                ErrorCodes.ADMIN_TOOL_DISABLED,
                `${toolName} is disabled. Set MCP_ENABLE_ADMIN_TOOLS=true to enable admin plugin management tools.`
            )
        ));
    }

    return null;
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
        if (result.role) {
            data.role = result.role;
        }

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
        const authenticated = isAuthenticated(runtimeContext.auth);

        // ── 未认证：仅返回最小状态，不泄露配置细节 ──
        if (!authenticated) {
            return textJson(toolSuccess('health_check', {
                server: { ok: true, version: '0.4.0', uptimeSeconds: metrics.getMetrics().uptimeSeconds },
                auth: { ok: false },
                debugToolsEnabled: isDebugToolEnabled(),
                adminToolsEnabled: isAdminToolEnabled(),
            }, ['Authenticate to view full health details.']));
        }

        // ── 已认证：返回完整健康信息 ──
        const warnings = [];
        const checks = {
            server: { ok: true, version: '0.4.0', uptimeSeconds: metrics.getMetrics().uptimeSeconds },
            auth: { ok: true },
            debugToolsEnabled: isDebugToolEnabled(),
            adminToolsEnabled: isAdminToolEnabled(),
            credentialsFile: { ok: false, path: process.env.SAP_CREDENTIALS_FILE || path.join(__dirname, '..', 'user.txt') },
            scenarioDir: { ok: false, path: process.env.SAP_SCENARIO_DIR || __dirname },
            scenarios: { ok: false, count: 0 },
            sapConnectivity: { ok: false, checked: false },
            metrics: metrics.getMetrics(),
            sapResponseCache: sapResponseCache.getStats(),
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
                const base = process.env.SAP_BASE_URL || 'https://your-tenant-api.s4hana.sapcloud.cn';
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
- getAllItems: Get all items instead of limiting to top N, default false. When true, ignores top parameter.
- top: Max item records, default 20, max 100.
- skip: Number of records to skip (for pagination), default 0.`,
    {
        salesOrder: z.string().min(1).describe('Sales Order number, e.g. "19"'),
        includeItems: z.boolean().optional().default(true),
        getAllItems: z.boolean().optional().default(false).describe('Get all items instead of limiting to top N'),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_sales_order_status', async (args) => {
        const authFailure = requireAuthenticatedTool('get_sales_order_status');
        if (authFailure) return authFailure;

        try {
            const data = await getSalesOrderStatus(args, sapDependencies(args._traceId, { autoPage: false }));
            const warnings = data.found ? [] : [`Sales Order "${args.salesOrder}" not found`];
            return textJson(toolSuccess('get_sales_order_status', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_sales_order_status', normalizeError(err, ErrorCodes.STATUS_FAILED)));
        }
    })
);

server.tool(
    'trace_sales_order',
    `Trace the lifecycle of a Sales Order across related SAP documents. This tool queries multiple SAP APIs in parallel to provide a complete picture of the order's progress through the supply chain and fulfillment process. Use this when you need to understand the full execution status of a sales order — what was produced, delivered, invoiced, and what inventory movements occurred. The tool automatically merges paginated data to provide complete results when getAllData is true.

Parameters:
- salesOrder: Sales Order number, e.g. "19" or "0000000019".
- includeDeliveries: Include outbound delivery data, default true.
- includeProductionOrders: Include production order data, default true.
- includeMaterialDocuments: Include material movement documents, default true.
- includeBillingDocuments: Include billing document data, default true.
- getAllData: Get all related records instead of limiting to top N per entity, default false. When true, ignores top parameter.
- top: Max records per entity, default 20, max 100.
- skip: Number of records to skip per entity (for pagination), default 0.`,
    {
        salesOrder: z.string().min(1).describe('Sales Order number, e.g. "19"'),
        includeDeliveries: z.boolean().optional().default(true),
        includeProductionOrders: z.boolean().optional().default(true),
        includeMaterialDocuments: z.boolean().optional().default(true),
        includeBillingDocuments: z.boolean().optional().default(true),
        getAllData: z.boolean().optional().default(false).describe('Get all related records instead of limiting to top N'),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip per entity for pagination'),
    },
    wrapTool('trace_sales_order', async (args) => {
        const authFailure = requireAuthenticatedTool('trace_sales_order');
        if (authFailure) return authFailure;

        try {
            const result = await traceSalesOrder(args, sapDependencies(args._traceId, { autoPage: false }));
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
- top: Max records to return, default 20, max 100.
- skip: Number of records to skip (for pagination), default 0.`,
    {
        key: z.string().describe('Scenario key, e.g. "sap_com_0109_sales_order"'),
        filter: z.string().optional().describe('OData filter, e.g. "SalesOrder eq \'19\'"'),
        top: z.number().min(1).max(MAX_TOP).optional().describe('Max records, default 20, max 100'),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('query_sap_scenario', async ({ key, filter, top, skip, _traceId }) => {
        const authFailure = requireAuthenticatedTool('query_sap_scenario');
        if (authFailure) return authFailure;

        if (!isDebugToolEnabled()) {
            return textJson(toolFailure(
                'query_sap_scenario',
                makeError(ErrorCodes.DEBUG_TOOL_DISABLED, 'query_sap_scenario is disabled. Set MCP_ENABLE_DEBUG_TOOLS=true to enable debug/admin querying.')
            ));
        }

        try {
            const result = await queryScenario(key, filter, top, skip, sapContextForTrace(_traceId));
            const summary = `Scenario: ${result.scenario.title} (${result.scenario.code})\nObjects found: ${result.objects.length}\nTotal records: ${result.objects.reduce((sum, object) => sum + object.count, 0)}`;
            const warnings = Object.keys(result.summary)
                .filter(entityName => result.summary[entityName] === 0)
                .map(entityName => `Entity "${entityName}" returned 0 records`);

            if (result.hasMore) {
                warnings.push('More records may be available. Use skip to paginate.');
            }

            return textJson(toolSuccess('query_sap_scenario', {
                summary,
                scenario: result.scenario,
                objects: result.objects,
                hasMore: result.hasMore,
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
- top: Max records to return, default 20, max 100.
- skip: Number of records to skip (for pagination), default 0.`,
    {
        costCenter: z.string().optional().describe('Cost center number(s), e.g. "10101001" or "10101001,10101002"'),
        controllingArea: z.string().optional().describe('Controlling area, e.g. "A000"'),
        companyCode: z.string().optional().describe('Company code, e.g. "1010"'),
        includeText: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
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
- top: Max records, default 20, max 100.
- skip: Number of records to skip (for pagination), default 0.`,
    {
        product: z.string().optional().describe('Material number(s), e.g. "MAT001" or "MAT001,MAT001,MAT002"'),
        productType: z.string().optional().describe('Product type, e.g. "FERT", "HAWA", "ROH"'),
        productGroup: z.string().optional().describe('Product group code'),
        includeDescription: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
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
- top: Max records, default 20, max 100.
- skip: Number of records to skip (for pagination), default 0.`,
    {
        businessPartner: z.string().optional().describe('BP number(s), e.g. "1000001" or "1000001,1000002"'),
        businessPartnerCategory: z.string().optional().describe('BP category, e.g. "1" (person), "2" (organization)'),
        includeCustomer: z.boolean().optional().default(false),
        includeSupplier: z.boolean().optional().default(false),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
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

// ────────────────────────────────────────────────────
// Tool: get_purchase_order
// ────────────────────────────────────────────────────

server.tool(
    'get_purchase_order',
    `Query SAP Purchase Order header and items. Returns PO details including supplier, company code, status, and optionally line items with quantities/prices.

Parameters:
- purchaseOrder: PO number(s), single "4500000001" or comma-separated.
- supplier: Supplier BP number.
- companyCode: Company code.
- purchaseOrderType: PO type (e.g. "NB" for standard).
- includeItems: Include line items (default true).
- top: Max records, default 20, max 100.
- skip: Number of records to skip (for pagination), default 0.`,
    {
        purchaseOrder: z.string().optional().describe('PO number(s), e.g. "4500000001" or "4500000001,4500000002"'),
        supplier: z.string().optional().describe('Supplier BP number'),
        companyCode: z.string().optional().describe('Company code'),
        purchaseOrderType: z.string().optional().describe('PO type, e.g. "NB"'),
        includeItems: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_purchase_order', async (args) => {
        const authFailure = requireAuthenticatedTool('get_purchase_order');
        if (authFailure) return authFailure;
        try {
            const data = await getPurchaseOrder(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No purchase orders found'] : [];
            return textJson(toolSuccess('get_purchase_order', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_purchase_order', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_material_stock
// ────────────────────────────────────────────────────

server.tool(
    'get_material_stock',
    `Query SAP Material Stock information. Returns stock levels across plants, storage locations, and batch information.

Parameters:
- material: Material number(s), single "MAT001" or comma-separated.
- plant: Plant code filter.
- storageLocation: Storage location code filter.
- batch: Batch number filter.
- includeBatchInfo: Include detailed batch information (default true).
- top: Max records, default 20, max 100.
- skip: Number of records to skip (for pagination), default 0.`,
    {
        material: z.string().optional().describe('Material number(s), e.g. "MAT001" or "MAT001,MAT002"'),
        plant: z.string().optional().describe('Plant code, e.g. "1000"'),
        storageLocation: z.string().optional().describe('Storage location code, e.g. "0001"'),
        batch: z.string().optional().describe('Batch number'),
        includeBatchInfo: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_material_stock', async (args) => {
        const authFailure = requireAuthenticatedTool('get_material_stock');
        if (authFailure) return authFailure;
        try {
            const data = await getMaterialStock(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No material stock found'] : [];
            return textJson(toolSuccess('get_material_stock', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_material_stock', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_bom
// ────────────────────────────────────────────────────

server.tool(
    'get_bom',
    `Query SAP Bill of Materials (BOM). Returns BOM header and components for materials.

Parameters:
- material: Material number to get BOM for.
- bomUsage: BOM usage filter (e.g. '1' for production, '2' for maintenance).
- plant: Plant code for BOM validity.
- includeComponents: Include BOM component details (default true).
- top: Max records, default 20, max 100.
- skip: Number of records to skip (for pagination), default 0.`,
    {
        material: z.string().optional().describe('Material number, e.g. "MAT001"'),
        bomUsage: z.string().optional().describe('BOM usage, e.g. "1" (production), "2" (maintenance)'),
        plant: z.string().optional().describe('Plant code, e.g. "1000"'),
        includeComponents: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_bom', async (args) => {
        const authFailure = requireAuthenticatedTool('get_bom');
        if (authFailure) return authFailure;
        try {
            const data = await getBOM(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No BOM found for material'] : [];
            return textJson(toolSuccess('get_bom', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_bom', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ── Plugin Management Tools ──────────────────────────────────

server.tool(
    'load_plugin',
    `Load a plugin from a file path. This enables dynamic loading of new tools at runtime.

Parameters:
- pluginPath: Absolute or relative path to the plugin file.`,
    {
        pluginPath: z.string().min(1).describe('Path to the plugin file to load'),
    },
    wrapTool('load_plugin', async ({ pluginPath }) => {
        const adminFailure = requireAdminTool('load_plugin');
        if (adminFailure) return adminFailure;

        if (!dynamicLoader) {
            return textJson(toolFailure('load_plugin', makeError(ErrorCodes.INTERNAL, 'Plugin system not initialized')));
        }

        try {
            const result = await dynamicLoader.loadPluginFromFile(pluginPath);

            if (result.success) {
                return textJson(toolSuccess('load_plugin', {
                    loaded: result.loaded,
                    message: `Successfully loaded plugin from ${pluginPath}`
                }));
            } else {
                return textJson(toolFailure(
                    'load_plugin',
                    makeError(ErrorCodes.INTERNAL, 'Failed to load plugin', { errors: result.errors })
                ));
            }
        } catch (err) {
            return textJson(toolFailure('load_plugin', normalizeError(err, ErrorCodes.INTERNAL)));
        }
    })
);

server.tool(
    'unload_plugin',
    `Unload a plugin by its ID. This removes the plugin's tools from the server.

Parameters:
- pluginId: The ID of the plugin to unload.`,
    {
        pluginId: z.string().min(1).describe('ID of the plugin to unload'),
    },
    wrapTool('unload_plugin', async ({ pluginId }) => {
        const adminFailure = requireAdminTool('unload_plugin');
        if (adminFailure) return adminFailure;

        if (!dynamicLoader) {
            return textJson(toolFailure('unload_plugin', makeError(ErrorCodes.INTERNAL, 'Plugin system not initialized')));
        }

        try {
            const success = await dynamicLoader.unloadPlugin(pluginId);

            if (success) {
                return textJson(toolSuccess('unload_plugin', {
                    pluginId,
                    message: `Successfully unloaded plugin ${pluginId}`
                }));
            } else {
                return textJson(toolFailure(
                    'unload_plugin',
                    makeError(ErrorCodes.INTERNAL, `Failed to unload plugin ${pluginId}`)
                ));
            }
        } catch (err) {
            return textJson(toolFailure('unload_plugin', normalizeError(err, ErrorCodes.INTERNAL)));
        }
    })
);

server.tool(
    'list_loaded_plugins',
    `List all currently loaded plugins and their tools.`,
    {},
    wrapTool('list_loaded_plugins', async () => {
        const adminFailure = requireAdminTool('list_loaded_plugins');
        if (adminFailure) return adminFailure;

        if (!dynamicLoader) {
            return textJson(toolFailure('list_loaded_plugins', makeError(ErrorCodes.INTERNAL, 'Plugin system not initialized')));
        }

        try {
            const plugins = dynamicLoader.listPlugins();
            const dynamicTools = dynamicLoader.listDynamicTools();

            return textJson(toolSuccess('list_loaded_plugins', {
                pluginCount: plugins.length,
                plugins: plugins.map(p => ({
                    id: p.id,
                    name: p.name,
                    version: p.version,
                    description: p.description,
                    toolCount: p.tools ? p.tools.length : 0
                })),
                dynamicToolCount: dynamicTools.length,
                dynamicTools
            }));
        } catch (err) {
            return textJson(toolFailure('list_loaded_plugins', normalizeError(err, ErrorCodes.INTERNAL)));
        }
    })
);

server.tool(
    'get_supplier_invoice',
    `Query SAP Supplier Invoice header and PO reference items.

Parameters:
- supplierInvoice: Invoice number(s), optional.
- fiscalYear: Fiscal year, e.g. "2025", optional.
- companyCode: Company code, optional.
- invoicingParty: Supplier BP number, optional.
- includeItems: Include invoice items, default true.
- top: Max records, default 20.
- skip: Records to skip for pagination.`,
    {
        supplierInvoice: z.string().optional().describe('Invoice number(s)'),
        fiscalYear: z.string().optional().describe('Fiscal year, e.g. "2025"'),
        companyCode: z.string().optional().describe('Company code'),
        invoicingParty: z.string().optional().describe('Supplier BP number'),
        includeItems: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_supplier_invoice', async (args) => {
        const authFailure = requireAuthenticatedTool('get_supplier_invoice');
        if (authFailure) return authFailure;
        try {
            const data = await getSupplierInvoice(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No supplier invoices found'] : [];
            return textJson(toolSuccess('get_supplier_invoice', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_supplier_invoice', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

server.tool(
    'get_entity_schema',
    `Get the schema (fields, types, keys) of an SAP EntitySet or EntityType by parsing the service $metadata. Use this to understand what fields are available before querying.

Parameters:
- scenarioKey: Scenario key from list_sap_scenarios that contains the target service.
- entityName: EntitySet or EntityType name, e.g. "A_SalesOrder" or "SalesOrder".
- useCache: Use cached $metadata (default true). Set false to force refresh.`,
    {
        scenarioKey: z.string().describe('Scenario key, e.g. "sap_com_0109_sales_order"'),
        entityName: z.string().describe('EntitySet or EntityType name, e.g. "A_SalesOrder"'),
        useCache: z.boolean().optional().default(true).describe('Use cached $metadata'),
    },
    wrapTool('get_entity_schema', async (args) => {
        const authFailure = requireAuthenticatedTool('get_entity_schema');
        if (authFailure) return authFailure;

        try {
            const data = await getEntitySchema(args, sapDependencies(args._traceId));
            return textJson(toolSuccess('get_entity_schema', data));
        } catch (err) {
            return textJson(toolFailure('get_entity_schema', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_purchase_requisition
// ────────────────────────────────────────────────────

server.tool(
    'get_purchase_requisition',
    `Query SAP Purchase Requisition header and items. Returns PR details including purchasing organization, purchasing group, supplier, status, and optionally line items.

Parameters:
- purchaseRequisition: PR number(s), single "1000001" or comma-separated "1000001,1000002".
- purchasingOrganization: Purchasing organization code.
- purchasingGroup: Purchasing group code.
- supplier: Supplier BP number.
- includeItems: Include line items (default true).
- top: Max records, default 20, max 100.
- skip: Number of records to skip (for pagination), default 0.`,
    {
        purchaseRequisition: z.string().optional().describe('PR number(s), e.g. "1000001" or "1000001,1000002"'),
        purchasingOrganization: z.string().optional().describe('Purchasing organization code'),
        purchasingGroup: z.string().optional().describe('Purchasing group code'),
        supplier: z.string().optional().describe('Supplier BP number'),
        includeItems: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_purchase_requisition', async (args) => {
        const authFailure = requireAuthenticatedTool('get_purchase_requisition');
        if (authFailure) return authFailure;
        try {
            const data = await getPurchaseRequisition(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No purchase requisitions found'] : [];
            return textJson(toolSuccess('get_purchase_requisition', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_purchase_requisition', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_schedule_agreement
// ────────────────────────────────────────────────────

server.tool(
    'get_schedule_agreement',
    `Query SAP Schedule Agreement header and items. Returns scheduling agreement details including supplier, purchasing organization, validity dates, and optionally line items with delivery schedules.

Parameters:
- scheduleAgreement: Schedule Agreement number(s), single "5500000001" or comma-separated.
- supplier: Supplier BP number.
- purchasingOrganization: Purchasing organization code.
- purchasingGroup: Purchasing group code.
- includeItems: Include line items (default true).
- top: Max records, default 20, max 100.
- skip: Number of records to skip (for pagination), default 0.`,
    {
        scheduleAgreement: z.string().optional().describe('Schedule Agreement number(s), e.g. "5500000001"'),
        supplier: z.string().optional().describe('Supplier BP number'),
        purchasingOrganization: z.string().optional().describe('Purchasing organization code'),
        purchasingGroup: z.string().optional().describe('Purchasing group code'),
        includeItems: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_schedule_agreement', async (args) => {
        const authFailure = requireAuthenticatedTool('get_schedule_agreement');
        if (authFailure) return authFailure;
        try {
            const data = await getScheduleAgreement(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No schedule agreements found'] : [];
            return textJson(toolSuccess('get_schedule_agreement', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_schedule_agreement', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_sales_contract
// ────────────────────────────────────────────────────

server.tool(
    'get_sales_contract',
    `Query SAP Sales Contract header and items. Returns sales contract details including sold-to party, sales organization, validity dates, status, and optionally line items.

Parameters:
- salesContract: Sales Contract number(s), single "4000000001" or comma-separated.
- customer: Sold-to party (customer) BP number.
- salesOrganization: Sales organization code.
- distributionChannel: Distribution channel code.
- division: Division code.
- includeItems: Include line items (default true).
- top: Max records, default 20, max 100.
- skip: Number of records to skip (for pagination), default 0.`,
    {
        salesContract: z.string().optional().describe('Sales Contract number(s), e.g. "4000000001"'),
        customer: z.string().optional().describe('Sold-to party (customer) BP number'),
        salesOrganization: z.string().optional().describe('Sales organization code'),
        distributionChannel: z.string().optional().describe('Distribution channel code'),
        division: z.string().optional().describe('Division code'),
        includeItems: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_sales_contract', async (args) => {
        const authFailure = requireAuthenticatedTool('get_sales_contract');
        if (authFailure) return authFailure;
        try {
            const data = await getSalesContract(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No sales contracts found'] : [];
            return textJson(toolSuccess('get_sales_contract', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_sales_contract', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_material_reservation
// ────────────────────────────────────────────────────

server.tool(
    'get_material_reservation',
    `Query SAP Material Reservation header and items. Returns reservation details including material, plant, requirement quantity, movement type, and optionally line items.

Parameters:
- reservation: Reservation number(s), single "10000001" or comma-separated.
- material: Material number.
- plant: Plant code.
- requirementNumber: Requirement number.
- includeItems: Include line items (default true).
- top: Max records, default 20, max 100.
- skip: Number of records to skip (for pagination), default 0.`,
    {
        reservation: z.string().optional().describe('Reservation number(s), e.g. "10000001"'),
        material: z.string().optional().describe('Material number'),
        plant: z.string().optional().describe('Plant code'),
        requirementNumber: z.string().optional().describe('Requirement number'),
        includeItems: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_material_reservation', async (args) => {
        const authFailure = requireAuthenticatedTool('get_material_reservation');
        if (authFailure) return authFailure;
        try {
            const data = await getMaterialReservation(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No material reservations found'] : [];
            return textJson(toolSuccess('get_material_reservation', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_material_reservation', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_purchase_rfq (US-API-007)
// ────────────────────────────────────────────────────

server.tool(
    'get_purchase_rfq',
    `Query SAP Purchase RFQ (Request for Quotation) documents. Returns RFQ details including purchasing organization, supplier, and optionally line items.

Parameters:
- purchaseRequisition: RFQ number(s), single or comma-separated.
- purchasingOrganization: Purchasing organization code.
- purchasingGroup: Purchasing group code.
- supplier: Supplier BP number.
- includeItems: Include line items (default true).
- top: Max records, default 20, max 100.
- skip: Records to skip for pagination.`,
    {
        purchaseRequisition: z.string().optional().describe('RFQ number(s), e.g. "1000001"'),
        purchasingOrganization: z.string().optional().describe('Purchasing organization code'),
        purchasingGroup: z.string().optional().describe('Purchasing group code'),
        supplier: z.string().optional().describe('Supplier BP number'),
        includeItems: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_purchase_rfq', async (args) => {
        const authFailure = requireAuthenticatedTool('get_purchase_rfq');
        if (authFailure) return authFailure;
        try {
            const data = await getPurchaseRfq(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No RFQ documents found'] : [];
            return textJson(toolSuccess('get_purchase_rfq', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_purchase_rfq', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_supplier_evaluation (US-API-008)
// ────────────────────────────────────────────────────

server.tool(
    'get_supplier_evaluation',
    `Query SAP Supplier Evaluation Scorecards. Returns evaluation scores, criteria, and optionally scorecard items.

Parameters:
- supplier: Supplier BP number(s), single or comma-separated.
- purchasingOrganization: Purchasing organization code.
- evaluationPeriod: Evaluation period identifier.
- includeItems: Include scorecard items (default true).
- top: Max records, default 20, max 100.
- skip: Records to skip for pagination.`,
    {
        supplier: z.string().optional().describe('Supplier BP number(s)'),
        purchasingOrganization: z.string().optional().describe('Purchasing organization code'),
        evaluationPeriod: z.string().optional().describe('Evaluation period identifier'),
        includeItems: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_supplier_evaluation', async (args) => {
        const authFailure = requireAuthenticatedTool('get_supplier_evaluation');
        if (authFailure) return authFailure;
        try {
            const data = await getSupplierEvaluation(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No supplier evaluations found'] : [];
            return textJson(toolSuccess('get_supplier_evaluation', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_supplier_evaluation', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_service_entry_sheet (US-API-009)
// ────────────────────────────────────────────────────

server.tool(
    'get_service_entry_sheet',
    `Query SAP Service Entry Sheets. Returns service entry sheet details including purchase order reference, supplier, and optionally line items.

Parameters:
- serviceEntrySheet: Service Entry Sheet number(s), single or comma-separated.
- purchaseOrder: Related Purchase Order number.
- supplier: Supplier BP number.
- purchasingOrganization: Purchasing organization code.
- includeItems: Include line items (default true).
- top: Max records, default 20, max 100.
- skip: Records to skip for pagination.`,
    {
        serviceEntrySheet: z.string().optional().describe('Service Entry Sheet number(s)'),
        purchaseOrder: z.string().optional().describe('Related Purchase Order number'),
        supplier: z.string().optional().describe('Supplier BP number'),
        purchasingOrganization: z.string().optional().describe('Purchasing organization code'),
        includeItems: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_service_entry_sheet', async (args) => {
        const authFailure = requireAuthenticatedTool('get_service_entry_sheet');
        if (authFailure) return authFailure;
        try {
            const data = await getServiceEntrySheet(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No service entry sheets found'] : [];
            return textJson(toolSuccess('get_service_entry_sheet', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_service_entry_sheet', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_sales_quotation (US-API-012)
// ────────────────────────────────────────────────────

server.tool(
    'get_sales_quotation',
    `Query SAP Sales Quotation and Sales Inquiry documents. Returns quotation/inquiry details including sold-to party, sales organization, and optionally line items.

Parameters:
- salesQuotation: Sales Quotation number(s), single or comma-separated.
- salesInquiry: Sales Inquiry number(s), single or comma-separated.
- soldToParty: Sold-to party (customer) BP number.
- salesOrganization: Sales organization code.
- includeItems: Include line items (default true).
- top: Max records, default 20, max 100.
- skip: Records to skip for pagination.`,
    {
        salesQuotation: z.string().optional().describe('Sales Quotation number(s)'),
        salesInquiry: z.string().optional().describe('Sales Inquiry number(s)'),
        soldToParty: z.string().optional().describe('Sold-to party (customer) BP number'),
        salesOrganization: z.string().optional().describe('Sales organization code'),
        includeItems: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_sales_quotation', async (args) => {
        const authFailure = requireAuthenticatedTool('get_sales_quotation');
        if (authFailure) return authFailure;
        try {
            const data = await getSalesQuotation(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No sales quotations/inquiries found'] : [];
            return textJson(toolSuccess('get_sales_quotation', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_sales_quotation', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_sales_pricing_condition (US-API-014)
// ────────────────────────────────────────────────────

server.tool(
    'get_sales_pricing_condition',
    `Query SAP Sales Pricing Condition Records. Returns pricing condition details including condition type, sales organization, and material.

Parameters:
- conditionTable: Condition table number.
- conditionType: Condition type(s), e.g. "PR00", "K007".
- salesOrganization: Sales organization code.
- distributionChannel: Distribution channel code.
- material: Material number.
- top: Max records, default 20, max 100.
- skip: Records to skip for pagination.`,
    {
        conditionTable: z.string().optional().describe('Condition table number'),
        conditionType: z.string().optional().describe('Condition type(s), e.g. "PR00", "K007"'),
        salesOrganization: z.string().optional().describe('Sales organization code'),
        distributionChannel: z.string().optional().describe('Distribution channel code'),
        material: z.string().optional().describe('Material number'),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_sales_pricing_condition', async (args) => {
        const authFailure = requireAuthenticatedTool('get_sales_pricing_condition');
        if (authFailure) return authFailure;
        try {
            const data = await getSalesPricingCondition(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No pricing condition records found'] : [];
            return textJson(toolSuccess('get_sales_pricing_condition', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_sales_pricing_condition', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_production_data (US-API-016)
// ────────────────────────────────────────────────────

server.tool(
    'get_production_data',
    `Query SAP Production Data including Planned Orders, Work Centers, and MRP Requirements. Returns production planning information.

Parameters:
- material: Material number.
- plant: Plant code.
- workCenter: Work center identifier.
- plannedOrder: Planned order number(s).
- mrpArea: MRP area.
- includePlannedOrders: Include planned orders (default true).
- includeWorkCenters: Include work centers (default true).
- includeMrp: Include MRP requirements (default true).
- top: Max records per entity, default 20, max 100.
- skip: Records to skip for pagination.`,
    {
        material: z.string().optional().describe('Material number'),
        plant: z.string().optional().describe('Plant code'),
        workCenter: z.string().optional().describe('Work center identifier'),
        plannedOrder: z.string().optional().describe('Planned order number(s)'),
        mrpArea: z.string().optional().describe('MRP area'),
        includePlannedOrders: z.boolean().optional().default(true),
        includeWorkCenters: z.boolean().optional().default(true),
        includeMrp: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_production_data', async (args) => {
        const authFailure = requireAuthenticatedTool('get_production_data');
        if (authFailure) return authFailure;
        try {
            const data = await getProductionData(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No production data found'] : [];
            return textJson(toolSuccess('get_production_data', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_production_data', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_production_order_confirmation (US-API-017)
// ────────────────────────────────────────────────────

server.tool(
    'get_production_order_confirmation',
    `Query SAP Production Order Confirmations. Returns confirmation details including manufacturing order, quantities, and optionally line items.

Note: This endpoint may return 406 if the service is not activated in your SAP system.

Parameters:
- productionOrder: Production/Manufacturing Order number(s).
- confirmation: Confirmation number.
- manufacturingOrder: Manufacturing Order number.
- includeItems: Include line items (default true).
- top: Max records, default 20, max 100.
- skip: Records to skip for pagination.`,
    {
        productionOrder: z.string().optional().describe('Production Order number(s)'),
        confirmation: z.string().optional().describe('Confirmation number'),
        manufacturingOrder: z.string().optional().describe('Manufacturing Order number'),
        includeItems: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_production_order_confirmation', async (args) => {
        const authFailure = requireAuthenticatedTool('get_production_order_confirmation');
        if (authFailure) return authFailure;
        try {
            const data = await getProductionOrderConfirmation(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No production order confirmations found'] : [];
            return textJson(toolSuccess('get_production_order_confirmation', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_production_order_confirmation', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_routing (US-API-019)
// ────────────────────────────────────────────────────

server.tool(
    'get_routing',
    `Query SAP Routing (工艺路线) data. Returns routing header and optionally operation details.

Parameters:
- routing: Routing number(s), single or comma-separated.
- material: Material number.
- plant: Plant code.
- routingGroup: Routing group.
- includeOperations: Include routing operations (default true).
- top: Max records, default 20, max 100.
- skip: Records to skip for pagination.`,
    {
        routing: z.string().optional().describe('Routing number(s)'),
        material: z.string().optional().describe('Material number'),
        plant: z.string().optional().describe('Plant code'),
        routingGroup: z.string().optional().describe('Routing group'),
        includeOperations: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_routing', async (args) => {
        const authFailure = requireAuthenticatedTool('get_routing');
        if (authFailure) return authFailure;
        try {
            const data = await getRouting(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No routings found'] : [];
            return textJson(toolSuccess('get_routing', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_routing', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_inspection_data (US-API-020)
// ────────────────────────────────────────────────────

server.tool(
    'get_inspection_data',
    `Query SAP Inspection Data including Inspection Methods, Characteristics, and Plans. Returns quality inspection information.

Parameters:
- inspectionMethod: Inspection method number(s).
- inspectionCharacteristic: Inspection characteristic identifier.
- inspectionPlan: Inspection plan number.
- material: Material number.
- plant: Plant code.
- includeMethods: Include inspection methods (default true).
- includeCharacteristics: Include inspection characteristics (default true).
- includePlans: Include inspection plans (default true).
- top: Max records per entity, default 20, max 100.
- skip: Records to skip for pagination.`,
    {
        inspectionMethod: z.string().optional().describe('Inspection method number(s)'),
        inspectionCharacteristic: z.string().optional().describe('Inspection characteristic identifier'),
        inspectionPlan: z.string().optional().describe('Inspection plan number'),
        material: z.string().optional().describe('Material number'),
        plant: z.string().optional().describe('Plant code'),
        includeMethods: z.boolean().optional().default(true),
        includeCharacteristics: z.boolean().optional().default(true),
        includePlans: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_inspection_data', async (args) => {
        const authFailure = requireAuthenticatedTool('get_inspection_data');
        if (authFailure) return authFailure;
        try {
            const data = await getInspectionData(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No inspection data found'] : [];
            return textJson(toolSuccess('get_inspection_data', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_inspection_data', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_physical_inventory (US-API-025)
// ────────────────────────────────────────────────────

server.tool(
    'get_physical_inventory',
    `Query SAP Physical Inventory Documents. Returns inventory document details including material, plant, fiscal year, and optionally line items.

Parameters:
- physicalInventoryDocument: Physical Inventory Document number(s).
- material: Material number.
- plant: Plant code.
- fiscalYear: Fiscal year, e.g. "2025".
- includeItems: Include line items (default true).
- top: Max records, default 20, max 100.
- skip: Records to skip for pagination.`,
    {
        physicalInventoryDocument: z.string().optional().describe('Physical Inventory Document number(s)'),
        material: z.string().optional().describe('Material number'),
        plant: z.string().optional().describe('Plant code'),
        fiscalYear: z.string().optional().describe('Fiscal year, e.g. "2025"'),
        includeItems: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_physical_inventory', async (args) => {
        const authFailure = requireAuthenticatedTool('get_physical_inventory');
        if (authFailure) return authFailure;
        try {
            const data = await getPhysicalInventory(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No physical inventory documents found'] : [];
            return textJson(toolSuccess('get_physical_inventory', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_physical_inventory', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_activity_type (US-API-027)
// ────────────────────────────────────────────────────

server.tool(
    'get_activity_type',
    `Query SAP Activity Type master data. Returns activity type details including controlling area, cost center, and descriptions.

Parameters:
- activityType: Activity type code(s), single or comma-separated.
- controllingArea: Controlling area (e.g. "A000").
- costCenter: Cost center number.
- top: Max records, default 20, max 100.
- skip: Records to skip for pagination.`,
    {
        activityType: z.string().optional().describe('Activity type code(s)'),
        controllingArea: z.string().optional().describe('Controlling area, e.g. "A000"'),
        costCenter: z.string().optional().describe('Cost center number'),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_activity_type', async (args) => {
        const authFailure = requireAuthenticatedTool('get_activity_type');
        if (authFailure) return authFailure;
        try {
            const data = await getActivityType(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No activity types found'] : [];
            return textJson(toolSuccess('get_activity_type', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_activity_type', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_attachment (US-API-028)
// ────────────────────────────────────────────────────

server.tool(
    'get_attachment',
    `Query SAP Attachments linked to business objects. Returns attachment metadata including file name, type, and size.

Parameters:
- businessObjectType: Business object type (e.g. "BUS2012" for Purchase Order, "BUS2032" for Sales Order).
- businessObjectKey: Business object key(s), single or comma-separated.
- documentType: Document type filter.
- top: Max records, default 20, max 100.
- skip: Records to skip for pagination.`,
    {
        businessObjectType: z.string().optional().describe('Business object type, e.g. "BUS2012"'),
        businessObjectKey: z.string().optional().describe('Business object key(s)'),
        documentType: z.string().optional().describe('Document type filter'),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_attachment', async (args) => {
        const authFailure = requireAuthenticatedTool('get_attachment');
        if (authFailure) return authFailure;
        try {
            const data = await getAttachment(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No attachments found'] : [];
            return textJson(toolSuccess('get_attachment', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_attachment', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

// ────────────────────────────────────────────────────
// Tool: get_iam_user_role (US-API-029)
// ────────────────────────────────────────────────────

server.tool(
    'get_iam_user_role',
    `Query SAP IAM Users and Roles. Returns business user details, business roles, and PFCG roles.

Parameters:
- userId: SAP User ID(s), single or comma-separated.
- businessRole: Business Role name(s).
- pfcgRole: PFCG Role name(s).
- personId: Person ID.
- includeUsers: Include business users (default true).
- includeBusinessRoles: Include business roles (default true).
- includePfcgRoles: Include PFCG roles (default true).
- top: Max records per entity, default 20, max 100.
- skip: Records to skip for pagination.`,
    {
        userId: z.string().optional().describe('SAP User ID(s)'),
        businessRole: z.string().optional().describe('Business Role name(s)'),
        pfcgRole: z.string().optional().describe('PFCG Role name(s)'),
        personId: z.string().optional().describe('Person ID'),
        includeUsers: z.boolean().optional().default(true),
        includeBusinessRoles: z.boolean().optional().default(true),
        includePfcgRoles: z.boolean().optional().default(true),
        top: z.number().min(1).max(MAX_TOP).optional().default(20),
        skip: z.number().min(0).optional().default(0).describe('Records to skip for pagination'),
    },
    wrapTool('get_iam_user_role', async (args) => {
        const authFailure = requireAuthenticatedTool('get_iam_user_role');
        if (authFailure) return authFailure;
        try {
            const data = await getIamUserRole(args, sapDependencies(args._traceId));
            const warnings = data.count === 0 ? ['No users/roles found'] : [];
            return textJson(toolSuccess('get_iam_user_role', data, warnings));
        } catch (err) {
            return textJson(toolFailure('get_iam_user_role', normalizeError(err, ErrorCodes.QUERY_FAILED)));
        }
    })
);

async function gracefulShutdown(transport, metricsServer = null) {
    isShuttingDown = true;
    console.error('[sap-s4-mcp] Shutting down gracefully...');

    if (metricsServer) {
        await metricsServer.stop();
    }

    // Close HTTP server if it exists
    if (httpServer) {
        await new Promise((resolve) => {
            httpServer.close(() => {
                console.error('[sap-s4-mcp] HTTP server closed');
                resolve();
            });
        });
    }

    // Shutdown plugin system
    if (dynamicLoader) {
        await dynamicLoader.shutdown();
    }

    while (activeRequests > 0) {
        console.error(`[sap-s4-mcp] Waiting for ${activeRequests} active request(s)...`);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (transport) {
        await transport.close();
    }
    
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

    // 3. SAP_BASE_URL — required, must not be the placeholder
    const baseUrl = process.env.SAP_BASE_URL || '';
    if (!baseUrl) {
        errors.push('SAP_BASE_URL is required. Set it to your S/4HANA Cloud API base URL.');
    } else if (/your-tenant-api/.test(baseUrl)) {
        errors.push(`SAP_BASE_URL is still the placeholder value. Replace it with your real tenant URL.`);
    } else {
        try {
            const parsed = new URL(baseUrl);
            if (!/^https?:$/.test(parsed.protocol)) {
                errors.push(`SAP_BASE_URL must use http or https protocol: ${baseUrl}`);
            }
        } catch {
            errors.push(`SAP_BASE_URL is not a valid URL: ${baseUrl}`);
        }
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

    // ── Metrics server (optional HTTP sidecar) ──
    const { MetricsServer } = require('./lib/metrics-server');
    const metricsPort = Number(process.env.MCP_METRICS_PORT || 0);
    let metricsServer = null;
    if (metricsPort > 0) {
        metricsServer = new MetricsServer({
            port: metricsPort,
            metrics,
            activeRequests: () => activeRequests,
            cacheStats: () => sapResponseCache.getStats(),
        });
        await metricsServer.start();
    }

    // Initialize plugin system — examples/ only loaded in admin mode
    const pluginDirs = [path.join(__dirname, 'plugins')];
    if (isAdminToolEnabled()) {
        pluginDirs.push(path.join(__dirname, 'examples'));
    }
    dynamicLoader = new DynamicLoader(server, pluginDirs);

    // Load plugins from configured directories
    try {
        const loadResult = await dynamicLoader.loadPluginsFromDirs(pluginDirs);
        if (loadResult.errors.length > 0) {
            console.error('[sap-s4-mcp] Plugin loading errors:', loadResult.errors);
        }
        if (loadResult.loaded.length > 0) {
            console.error(`[sap-s4-mcp] Loaded ${loadResult.loaded.length} plugins:`, loadResult.loaded.map(p => p.id));
        }
    } catch (err) {
        console.error('[sap-s4-mcp] Error loading plugins:', err.message);
    }

    let transport = null;

    if (ENABLE_HTTP_TRANSPORT) {
        // Setup HTTP/SSE Transport
        expressApp = express();
        expressApp.use(cors());
        expressApp.use(express.json({ limit: '10mb' }));
        expressApp.use(express.urlencoded({ extended: true }));

        // Optional: Add simple health/info endpoints
        expressApp.get('/', (req, res) => {
            res.json({
                name: 'SAP S/4HANA MCP Server',
                version: '0.4.0',
                status: 'running',
                timestamp: new Date().toISOString(),
            });
        });

        const httpTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined, // Stateless mode
        });

        // Mount MCP handler
        expressApp.post('/mcp', (req, res) => {
            httpTransport.handlePostMessage(req, res, req.body);
        });

        expressApp.get('/mcp', (req, res) => {
            httpTransport.handleGetMessage(req, res);
        });

        // Create HTTP server
        httpServer = require('http').createServer(expressApp);
        
        await new Promise((resolve) => {
            httpServer.listen(PORT, BIND_ADDRESS, () => {
                console.error(`\n🌐 HTTP Transport 已启动: http://${BIND_ADDRESS}:${PORT}`);
                console.error(`📋 MCP 协议端点: http://${BIND_ADDRESS}:${PORT}/mcp`);
                resolve();
            });
        });

        // Connect MCP Server to HTTP Transport
        await server.connect(httpTransport);
        transport = httpTransport; // Keep reference for shutdown if needed, though HTTP server handles lifecycle
        
        console.error('[sap-s4-mcp v0.4] MCP Server started with HTTP transport');
    } else {
        // Fallback to Stdio
        transport = new StdioServerTransport();
        await server.connect(transport);
        console.error('[sap-s4-mcp v0.4] MCP Server started via stdio');
    }

    console.error('[sap-s4-mcp] SAP credentials from:', process.env.SAP_CREDENTIALS_FILE || 'default user.txt');
    console.error('[sap-s4-mcp] Authentication enabled');
    console.error('[sap-s4-mcp] Debug tools:', isDebugToolEnabled() ? 'enabled' : 'disabled');
    console.error('[sap-s4-mcp] Admin tools:', isAdminToolEnabled() ? 'enabled' : 'disabled');
    console.error('[sap-s4-mcp] Plugin system initialized with', dynamicLoader.listPlugins().length, 'plugins');
    
    if (metricsServer && metricsServer.isEnabled()) {
        console.error(`[sap-s4-mcp] Metrics server on port ${metricsPort}`);
    }
    if (sapResponseCache.isEnabled()) {
        console.error(`[sap-s4-mcp] SAP response cache enabled, TTL=${sapResponseCache.ttlMs}ms`);
    }
    if (isAutoPageEnabled()) {
        console.error(`[sap-s4-mcp] Auto-pagination enabled, max=${getAutoPageMax()}`);
    }
    
    if (ENABLE_HTTP_TRANSPORT) {
        console.error(`[sap-s4-mcp] Access via HTTP: http://${BIND_ADDRESS}:${PORT}/mcp`);
    }

    process.on('SIGTERM', () => gracefulShutdown(transport, metricsServer));
    process.on('SIGINT', () => gracefulShutdown(transport, metricsServer));
}

main().catch(err => {
    console.error('[sap-s4-mcp] Fatal startup error:', err.message);
    process.exit(1);
});