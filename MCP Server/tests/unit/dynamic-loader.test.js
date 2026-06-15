/**
 * tests/unit/dynamic-loader.test.js — 动态加载器单元测试
 * 测试路径白名单校验逻辑（不需要真实 MCP server）。
 */
const assert = require('assert');
const path = require('path');
const DynamicLoader = require('../../lib/dynamic-loader');

function run() {
    console.log('  dynamic-loader.test.js');

    // Mock server 对象（满足构造函数要求）
    const mockServer = { tool: () => ({ remove: () => {}, disable: () => {}, enable: () => {} }) };

    // ── 1. isAllowedPluginPath: 路径在白名单内 ──
    {
        const pluginsDir = path.join(__dirname, '..', 'fixtures', 'plugins');
        const loader = new DynamicLoader(mockServer, [pluginsDir]);
        assert.strictEqual(
            loader.isAllowedPluginPath(path.join(pluginsDir, 'sample.js')),
            true,
            'path inside plugin dir is allowed'
        );
    }

    // ── 2. isAllowedPluginPath: 路径在白名单外 ──
    {
        const pluginsDir = path.join(__dirname, '..', 'fixtures', 'plugins');
        const loader = new DynamicLoader(mockServer, [pluginsDir]);
        assert.strictEqual(
            loader.isAllowedPluginPath('/etc/passwd'),
            false,
            'path outside plugin dir is rejected'
        );
    }

    // ── 3. isAllowedPluginPath: 路径遍历攻击 ──
    {
        const pluginsDir = path.join(__dirname, '..', 'fixtures', 'plugins');
        const loader = new DynamicLoader(mockServer, [pluginsDir]);
        assert.strictEqual(
            loader.isAllowedPluginPath(path.join(pluginsDir, '..', '..', 'etc', 'passwd')),
            false,
            'path traversal is rejected'
        );
    }

    // ── 4. listDynamicTools: 初始为空 ──
    {
        const loader = new DynamicLoader(mockServer, []);
        assert.strictEqual(loader.listDynamicTools().length, 0, 'no dynamic tools initially');
    }

    // ── 5. hasTool: 不存在的工具 ──
    {
        const loader = new DynamicLoader(mockServer, []);
        assert.strictEqual(loader.hasTool('nonexistent'), false);
    }

    // ── 6. hasTool + loadTool + unloadTool: 生命周期 ──
    {
        const loader = new DynamicLoader(mockServer, []);
        const result = loader.loadTool(
            'test_dynamic_tool',
            'Test tool',
            {},
            async () => ({ content: [{ type: 'text', text: 'ok' }] })
        );
        assert.strictEqual(result.ok, true, 'loadTool succeeds');
        assert.strictEqual(loader.hasTool('test_dynamic_tool'), true, 'tool is tracked');

        const info = loader.getToolInfo('test_dynamic_tool');
        assert.notStrictEqual(info, null, 'getToolInfo returns data');
        assert.strictEqual(info.description, 'Test tool');

        loader.unloadTool('test_dynamic_tool');
        assert.strictEqual(loader.hasTool('test_dynamic_tool'), false, 'tool removed after unload');
    }

    // ── 7. listPlugins: 初始为空 ──
    {
        const loader = new DynamicLoader(mockServer, []);
        assert.strictEqual(loader.listPlugins().length, 0, 'no plugins initially');
    }

    // ── 8. disableTool / enableTool ──
    {
        const loader = new DynamicLoader(mockServer, []);
        loader.loadTool('toggle_tool', 'Toggle test', {}, async () => ({}));
        // disableTool returns false if tool not in PluginManager handles (mock server)
        // But the test verifies the method exists and doesn't throw
        assert.doesNotThrow(() => loader.disableTool('toggle_tool'), 'disableTool does not throw');
        assert.doesNotThrow(() => loader.enableTool('toggle_tool'), 'enableTool does not throw');
        loader.unloadTool('toggle_tool');
    }

    console.log('    ✅ all passed');
}

module.exports = { run };
