/**
 * Unit test: Plugin system unload semantics
 *
 * Verifies that:
 *  - registerPlugin stores SDK handles
 *  - unregisterPlugin calls handle.remove() → tools disappear
 *  - disableTool / enableTool toggle visibility
 *  - loadTool / unloadTool via DynamicLoader use SDK handles
 */

const assert = require('assert');

// ── Mock MCP SDK server ────────────────────────────────────

function createMockServer() {
    const tools = new Map();

    return {
        _tools: tools,
        tool(name, description, parameters, handler) {
            if (tools.has(name)) {
                throw new Error(`Tool ${name} is already registered`);
            }
            const handle = {
                name,
                description,
                parameters,
                handler,
                enabled: true,
                disable() { this.enabled = false; },
                enable()  { this.enabled = true;  },
                remove()  { tools.delete(name);   },
                update()  {},
            };
            tools.set(name, handle);
            return handle;
        },
    };
}

// ── Test PluginManager ─────────────────────────────────────

const { PluginManager } = require('../../lib/plugin-system');

async function testRegisterAndUnregister() {
    const server = createMockServer();
    const pm = new PluginManager(server);

    const plugin = {
        id: 'test-plugin',
        name: 'Test',
        version: '1.0.0',
        description: 'Test plugin',
        tools: [
            {
                name: 'hello',
                description: 'Say hello',
                parameters: {},
                handler: async () => 'hi',
            },
            {
                name: 'world',
                description: 'Say world',
                parameters: {},
                handler: async () => 'earth',
            },
        ],
    };

    // Register
    const ok = await pm.registerPlugin(plugin);
    assert.strictEqual(ok, true, 'registerPlugin should succeed');
    assert.strictEqual(server._tools.size, 2, '2 tools should be in SDK registry');
    assert.ok(server._tools.has('hello'), 'hello should exist');
    assert.ok(server._tools.has('world'), 'world should exist');
    assert.strictEqual(pm.loadedTools.get('hello'), 'test-plugin');

    // Unregister — should truly remove from SDK
    const ok2 = await pm.unregisterPlugin('test-plugin');
    assert.strictEqual(ok2, true, 'unregisterPlugin should succeed');
    assert.strictEqual(server._tools.size, 0, 'All tools should be removed from SDK registry');
    assert.strictEqual(pm.loadedTools.has('hello'), false, 'hello should be gone from tracking');
    assert.strictEqual(pm.toolHandles.has('hello'), false, 'hello handle should be gone');

    console.log('  ✅ registerPlugin + unregisterPlugin: tools truly removed from SDK');
}

async function testRollbackOnDuplicate() {
    const server = createMockServer();
    const pm = new PluginManager(server);

    // Pre-register a tool to cause conflict
    server.tool('conflict', 'existing', {}, async () => 'old');

    const plugin = {
        id: 'dup-plugin',
        name: 'Dup',
        version: '1.0.0',
        description: 'Has conflicting tool',
        tools: [
            { name: 'first', description: 'ok', parameters: {}, handler: async () => {} },
            { name: 'conflict', description: 'dup', parameters: {}, handler: async () => {} },
            { name: 'third', description: 'ok', parameters: {}, handler: async () => {} },
        ],
    };

    const ok = await pm.registerPlugin(plugin);
    assert.strictEqual(ok, false, 'registerPlugin should fail on duplicate tool name');

    // 'first' was registered before hitting 'conflict', should be rolled back
    assert.strictEqual(server._tools.has('first'), false, 'first should be rolled back (removed)');
    assert.strictEqual(pm.loadedTools.has('first'), false, 'first should be gone from tracking');
    assert.strictEqual(pm.toolHandles.has('first'), false, 'first handle should be gone');
    assert.strictEqual(pm.plugins.has('dup-plugin'), false, 'plugin should not be stored');

    // Original 'conflict' tool should still exist (we only remove tools we registered)
    assert.strictEqual(server._tools.has('conflict'), true, 'original conflict tool survives');

    console.log('  ✅ Rollback on duplicate tool name: partial registrations cleaned up');
}

async function testDisableEnableTool() {
    const server = createMockServer();
    const pm = new PluginManager(server);

    const plugin = {
        id: 'toggle-plugin',
        name: 'Toggle',
        version: '1.0.0',
        description: 'Test disable/enable',
        tools: [
            { name: 'toggle_me', description: 'toggleable', parameters: {}, handler: async () => {} },
        ],
    };

    await pm.registerPlugin(plugin);
    const handle = pm.getToolHandle('toggle_me');
    assert.ok(handle, 'should have a handle');
    assert.strictEqual(handle.enabled, true, 'tool starts enabled');

    // Disable
    handle.disable();
    assert.strictEqual(handle.enabled, false, 'tool should be disabled');
    assert.strictEqual(server._tools.has('toggle_me'), true, 'tool still in registry (hidden only)');

    // Enable
    handle.enable();
    assert.strictEqual(handle.enabled, true, 'tool should be re-enabled');

    console.log('  ✅ disable/enable: tool visibility toggled without removal');
}

// ── Test DynamicLoader ─────────────────────────────────────

const DynamicLoader = require('../../lib/dynamic-loader');

async function testDynamicLoaderUnloadTool() {
    const server = createMockServer();
    const loader = new DynamicLoader(server, []);

    const plugin = {
        id: 'dyn-plugin',
        name: 'Dyn',
        version: '1.0.0',
        description: 'Dynamic test',
        tools: [
            { name: 'dyn_tool', description: 'dynamic', parameters: {}, handler: async () => {} },
        ],
    };

    await loader.loadPlugin(plugin);
    assert.strictEqual(server._tools.has('dyn_tool'), true, 'tool registered');
    assert.strictEqual(loader.dynamicTools.has('dyn_tool'), true, 'tool in tracking');

    // Unload
    const ok = loader.unloadTool('dyn_tool');
    assert.strictEqual(ok, true, 'unloadTool should succeed');
    assert.strictEqual(server._tools.has('dyn_tool'), false, 'tool truly removed from SDK registry');
    assert.strictEqual(loader.dynamicTools.has('dyn_tool'), false, 'tool gone from tracking');

    console.log('  ✅ DynamicLoader.unloadTool: tool truly removed via SDK handle.remove()');
}

async function testDynamicLoaderUnloadPlugin() {
    const server = createMockServer();
    const loader = new DynamicLoader(server, []);

    const plugin = {
        id: 'multi-tool-plugin',
        name: 'Multi',
        version: '1.0.0',
        description: 'Multiple tools',
        tools: [
            { name: 'tool_a', description: 'A', parameters: {}, handler: async () => {} },
            { name: 'tool_b', description: 'B', parameters: {}, handler: async () => {} },
        ],
    };

    await loader.loadPlugin(plugin);
    assert.strictEqual(server._tools.size, 2, '2 tools registered');

    // Unload plugin
    const ok = await loader.unloadPlugin('multi-tool-plugin');
    assert.strictEqual(ok, true, 'unloadPlugin should succeed');
    assert.strictEqual(server._tools.size, 0, 'all tools removed from SDK registry');
    assert.strictEqual(loader.dynamicTools.size, 0, 'all tools gone from tracking');

    console.log('  ✅ DynamicLoader.unloadPlugin: all tools truly removed via SDK handle.remove()');
}

async function testDynamicLoaderDisableEnable() {
    const server = createMockServer();
    const loader = new DynamicLoader(server, []);

    loader.loadTool('temp', 'temp tool', {}, async () => 'temp');

    // Disable
    const ok1 = loader.disableTool('temp');
    assert.strictEqual(ok1, true, 'disableTool should succeed');
    const handle = server._tools.get('temp');
    assert.strictEqual(handle.enabled, false, 'tool disabled');

    // Enable
    const ok2 = loader.enableTool('temp');
    assert.strictEqual(ok2, true, 'enableTool should succeed');
    assert.strictEqual(handle.enabled, true, 'tool re-enabled');

    console.log('  ✅ DynamicLoader.disableTool/enableTool: toggle visibility');
}

// ── Run ─────────────────────────────────────────────────────

(async () => {
    console.log('\n── Plugin System Unload Semantics Tests ──\n');

    await testRegisterAndUnregister();
    await testRollbackOnDuplicate();
    await testDisableEnableTool();
    await testDynamicLoaderUnloadTool();
    await testDynamicLoaderUnloadPlugin();
    await testDynamicLoaderDisableEnable();

    console.log('\n  ✅ All plugin unload semantics tests passed\n');
})().catch(err => {
    console.error('\n  ❌ Test failed:', err.message);
    process.exit(1);
});
