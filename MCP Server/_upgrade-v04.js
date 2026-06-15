// v0.4 upgrade script — applies all remaining mcp-server.js patches
const fs = require('fs');
let c = fs.readFileSync('mcp-server.js', 'utf8');

// 1. Add sapResponseCache to import
c = c.replace(
  "    queryScenario,\n    MAX_TOP,\n} = require('./mcp-sap-core');",
  "    queryScenario,\n    MAX_TOP,\n    sapResponseCache,\n} = require('./mcp-sap-core');"
);

// 2. Add autoPaginate import
c = c.replace(
  "const { generateTraceId, createTraceContext, recordSapCall, metrics } = require('./lib/observability');",
  "const { generateTraceId, createTraceContext, recordSapCall, metrics } = require('./lib/observability');\nconst { autoPaginate, isAutoPageEnabled, getAutoPageMax } = require('./lib/auto-pagination');"
);

// 3. Update version
c = c.replace(
  "const server = new McpServer({\n    name: 'sap-s4-mcp',\n    version: '0.3.0',\n});",
  "const server = new McpServer({\n    name: 'sap-s4-mcp',\n    version: '0.4.0',\n});"
);

// 4. Replace sapDependencies
const oldSapDeps = [
'function sapDependencies(traceId) {',
'    const context = sapContextForTrace(traceId);',
'    const traceCtx = createTraceContext(traceId);',
'    return {',
'        sapFetch: async (url) => {',
'            const start = Date.now();',
'            try {',
'                const result = await sapFetch(url, context);',
'                const durationMs = Date.now() - start;',
'                metrics.recordSapCall(durationMs, true);',
'                if (traceId) {',
'                    recordSapCall(traceCtx, url, durationMs, \'ok\');',
'                }',
'                return result;',
'            } catch (err) {',
'                const durationMs = Date.now() - start;',
'                metrics.recordSapCall(durationMs, false);',
'                if (traceId) {',
'                    recordSapCall(traceCtx, url, durationMs, err.code || err.message, err.code);',
'                }',
'                throw err;',
'            }',
'        },',
'        extractRows,',
'        _traceCtx: traceCtx,',
'    };',
'}',
].join('\n');

const newSapDeps = [
'function sapDependencies(traceId, options = {}) {',
'    const autoPage = options.autoPage !== false;',
'    const context = sapContextForTrace(traceId);',
'    const traceCtx = createTraceContext(traceId);',
'',
'    const _record = (url, durationMs, ok, errCode) => {',
'        metrics.recordSapCall(durationMs, ok);',
'        if (traceId) {',
'            recordSapCall(traceCtx, url, durationMs, ok ? \'ok\' : (errCode || \'error\'), errCode);',
'        }',
'    };',
'',
'    return {',
'        sapFetch: async (url) => {',
'            const start = Date.now();',
'',
'            if (autoPage && isAutoPageEnabled()) {',
'                try {',
'                    const { rows, metadata } = await autoPaginate(',
'                        (u) => sapFetch(u, context).then(r => {',
'                            _record(u, Date.now() - start, true);',
'                            return r;',
'                        }).catch(err => { throw err; }),',
'                        extractRows,',
'                        url,',
'                        { maxTotal: getAutoPageMax(), top: 100 }',
'                    );',
'                    if (metadata.autoPaged) {',
'                        const wrapper = { value: rows };',
'                        Object.defineProperty(wrapper, \'_autoPaged\', { value: true, enumerable: false });',
'                        Object.defineProperty(wrapper, \'_totalFetched\', { value: metadata.totalFetched, enumerable: false });',
'                        return wrapper;',
'                    }',
'                    return { value: rows };',
'                } catch (err) {',
'                    _record(url, Date.now() - start, false, err.code);',
'                    throw err;',
'                }',
'            }',
'',
'            try {',
'                const result = await sapFetch(url, context);',
'                _record(url, Date.now() - start, true);',
'                return result;',
'            } catch (err) {',
'                _record(url, Date.now() - start, false, err.code);',
'                throw err;',
'            }',
'        },',
'        extractRows,',
'        _traceCtx: traceCtx,',
'    };',
'}',
].join('\n');

if (c.includes(oldSapDeps)) {
  c = c.replace(oldSapDeps, newSapDeps);
  console.log('OK: sapDependencies replaced');
} else {
  console.log('WARN: old sapDependencies not found');
}

// 5. Opt-out sales-order from auto-pagination
c = c.replace('getSalesOrderStatus(args, sapDependencies(args._traceId));', 'getSalesOrderStatus(args, sapDependencies(args._traceId, { autoPage: false }));');
c = c.replace('traceSalesOrder(args, sapDependencies(args._traceId));', 'traceSalesOrder(args, sapDependencies(args._traceId, { autoPage: false }));');

// 6. Add cache stats to health_check
c = c.replace(
  '            metrics: metrics.getMetrics(),',
  '            metrics: metrics.getMetrics(),\n            sapResponseCache: sapResponseCache.getStats(),'
);

// 7. Version strings 0.3.0 -> 0.4.0
c = c.replace(/'0\.3\.0'/g, "'0.4.0'");

// 8. Update gracefulShutdown
const oldShutdown = [
'async function gracefulShutdown(transport) {',
'    isShuttingDown = true;',
"    console.error('[sap-s4-mcp] Shutting down gracefully...');",
'',
'    // Shutdown plugin system',
'    if (dynamicLoader) {',
'        await dynamicLoader.shutdown();',
'    }',
'',
'    while (activeRequests > 0) {',
'        console.error(`[sap-s4-mcp] Waiting for ${activeRequests} active request(s)...`);',
'        await new Promise(resolve => setTimeout(resolve, 500));',
'    }',
'    await transport.close();',
"    console.error('[sap-s4-mcp] Graceful shutdown complete');",
'    process.exit(0);',
'}',
].join('\n');

const newShutdown = [
'async function gracefulShutdown(transport, metricsServer = null) {',
'    isShuttingDown = true;',
"    console.error('[sap-s4-mcp] Shutting down gracefully...');",
'',
'    if (metricsServer) {',
'        await metricsServer.stop();',
'    }',
'',
'    // Shutdown plugin system',
'    if (dynamicLoader) {',
'        await dynamicLoader.shutdown();',
'    }',
'',
'    while (activeRequests > 0) {',
'        console.error(`[sap-s4-mcp] Waiting for ${activeRequests} active request(s)...`);',
'        await new Promise(resolve => setTimeout(resolve, 500));',
'    }',
'    await transport.close();',
"    console.error('[sap-s4-mcp] Graceful shutdown complete');",
'    process.exit(0);',
'}',
].join('\n');

if (c.includes(oldShutdown)) {
  c = c.replace(oldShutdown, newShutdown);
  console.log('OK: gracefulShutdown replaced');
} else {
  console.log('WARN: old gracefulShutdown not found');
}

// 9. Update main() — insert metrics server after initAuth
const oldMainPart = '    initAuth(runtimeContext.auth);\n\n    // Initialize plugin system';
if (c.includes(oldMainPart)) {
  const newMainPart = [
    '    initAuth(runtimeContext.auth);',
    '',
    "    // ── Metrics server (optional HTTP sidecar) ──",
    "    const { MetricsServer } = require('./lib/metrics-server');",
    "    const metricsPort = Number(process.env.MCP_METRICS_PORT || 0);",
    "    let metricsServer = null;",
    "    if (metricsPort > 0) {",
    "        metricsServer = new MetricsServer({",
    "            port: metricsPort,",
    "            metrics,",
    "            activeRequests: () => activeRequests,",
    "            cacheStats: () => sapResponseCache.getStats(),",
    "        });",
    "        await metricsServer.start();",
    "    }",
    '',
    '    // Initialize plugin system',
  ].join('\n');
  c = c.replace(oldMainPart, newMainPart);
  console.log('OK: main() metrics server added');
} else {
  console.log('WARN: old main block not found');
}

// 10. Update startup log version
c = c.replace('[sap-s4-mcp v0.3]', '[sap-s4-mcp v0.4]');

// 11. Add feature startup logs
const oldPluginLog = "console.error('[sap-s4-mcp] Plugin system initialized with', dynamicLoader.listPlugins().length, 'plugins');";
if (c.includes(oldPluginLog)) {
  const newPluginLog = [
    oldPluginLog,
    "    if (metricsServer && metricsServer.isEnabled()) {",
    "        console.error(`[sap-s4-mcp] Metrics server on port ${metricsPort}`);",
    "    }",
    "    if (sapResponseCache.isEnabled()) {",
    "        console.error(`[sap-s4-mcp] SAP response cache enabled, TTL=${sapResponseCache.ttlMs}ms`);",
    "    }",
    "    if (isAutoPageEnabled()) {",
    "        console.error(`[sap-s4-mcp] Auto-pagination enabled, max=${getAutoPageMax()}`);",
    "    }",
  ].join('\n');
  c = c.replace(oldPluginLog, newPluginLog);
  console.log('OK: startup logs added');
}

// 12. Update signal handlers
c = c.replace("process.on('SIGTERM', () => gracefulShutdown(transport));", "process.on('SIGTERM', () => gracefulShutdown(transport, metricsServer));");
c = c.replace("process.on('SIGINT', () => gracefulShutdown(transport));", "process.on('SIGINT', () => gracefulShutdown(transport, metricsServer));");

fs.writeFileSync('mcp-server.js', c);
console.log('mcp-server.js updated. Lines:', c.split('\n').length);
