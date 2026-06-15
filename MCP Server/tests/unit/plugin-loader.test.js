/**
 * tests/unit/plugin-loader.test.js — 插件加载器单元测试
 * 测试 validatePlugin 和 PluginManager 核心逻辑。
 */
const assert = require('assert');
const { validatePlugin, PluginManager } = require('../../lib/plugin-system');
const { z } = require('zod');

async function run() {
    console.log('  plugin-loader.test.js');

    const mockServer = {
        tool: () => ({ remove: () => {}, disable: () => {}, enable: () => {} })
    };

    // ── 1. validatePlugin: 合法插件 ──
    {
        const plugin = {
            id: 'test-plugin',
            name: 'Test Plugin',
            version: '1.0.0',
            description: 'A test plugin',
            tools: [{
                name: 'greet',
                description: 'Say hello',
                parameters: { name: z.string() },
                handler: async () => ({}),
            }],
        };
        const result = await validatePlugin(plugin);
        assert.strictEqual(result.valid, true, `errors: ${result.errors.join(', ')}`);
    }

    // ── 2. validatePlugin: 缺 id ──
    {
        const result = await validatePlugin({ name: 'x', version: '1', description: 'd', tools: [] });
        assert.strictEqual(result.valid, false, 'missing id should fail');
    }

    // ── 3. validatePlugin: 缺 name ──
    {
        const result = await validatePlugin({ id: 'x', version: '1', description: 'd', tools: [] });
        assert.strictEqual(result.valid, false, 'missing name should fail');
    }

    // ── 4. validatePlugin: 缺 version ──
    {
        const result = await validatePlugin({ id: 'x', name: 'x', description: 'd', tools: [] });
        assert.strictEqual(result.valid, false, 'missing version should fail');
    }

    // ── 5. validatePlugin: 工具缺 handler ──
    {
        const result = await validatePlugin({
            id: 'x', name: 'x', version: '1', description: 'd',
            tools: [{ name: 't', description: 'd', parameters: {} }],
        });
        assert.strictEqual(result.valid, false, 'missing handler should fail');
    }

    // ── 6. validatePlugin: 工具参数非 Zod schema ──
    {
        const result = await validatePlugin({
            id: 'x', name: 'x', version: '1', description: 'd',
            tools: [{ name: 't', description: 'd', parameters: { x: 'not a schema' }, handler: async () => ({}) }],
        });
        assert.strictEqual(result.valid, false, 'non-zod params should fail');
    }

    // ── 7. PluginManager: 注册插件 ──
    {
        const pm = new PluginManager(mockServer);
        const plugin = {
            id: 'pm-test',
            name: 'PM Test',
            version: '1.0.0',
            description: 'Test',
            tools: [{
                name: 'pm_tool',
                description: 'A tool',
                parameters: { x: z.string() },
                handler: async () => ({}),
            }],
        };
        const ok = await pm.registerPlugin(plugin);
        assert.strictEqual(ok, true, 'registerPlugin succeeds');
        assert.notStrictEqual(pm.getPlugin('pm-test'), null, 'getPlugin returns plugin');
        assert.strictEqual(pm.listPlugins().length, 1, 'listPlugins has 1 entry');
        assert.strictEqual(pm.getPluginIdByTool('pm_tool'), 'pm-test', 'tool mapped to plugin');
    }

    // ── 8. PluginManager: 重复注册拒绝 ──
    {
        const pm = new PluginManager(mockServer);
        const plugin = { id: 'dup', name: 'Dup', version: '1', description: 'd', tools: [] };
        await pm.registerPlugin(plugin);
        const second = await pm.registerPlugin(plugin);
        assert.strictEqual(second, false, 'duplicate plugin registration fails');
    }

    // ── 9. PluginManager: 工具名冲突回滚 ──
    {
        const pm = new PluginManager(mockServer);
        const p1 = {
            id: 'conflict-1', name: 'C1', version: '1', description: 'd',
            tools: [{ name: 'shared_tool', description: 'd', parameters: {}, handler: async () => ({}) }],
        };
        const p2 = {
            id: 'conflict-2', name: 'C2', version: '1', description: 'd',
            tools: [{ name: 'shared_tool', description: 'd', parameters: {}, handler: async () => ({}) }],
        };
        await pm.registerPlugin(p1);
        const ok = await pm.registerPlugin(p2);
        assert.strictEqual(ok, false, 'tool name conflict fails registration');
        assert.strictEqual(pm.getPlugin('conflict-2'), null, 'conflicting plugin not stored');
    }

    // ── 10. PluginManager: unregisterPlugin ──
    {
        const pm = new PluginManager(mockServer);
        const plugin = {
            id: 'to-remove', name: 'Remove Me', version: '1', description: 'd',
            tools: [{ name: 'rm_tool', description: 'd', parameters: {}, handler: async () => ({}) }],
        };
        await pm.registerPlugin(plugin);
        assert.strictEqual(pm.listPlugins().length, 1);
        await pm.unregisterPlugin('to-remove');
        assert.strictEqual(pm.listPlugins().length, 0, 'plugin removed');
        assert.strictEqual(pm.getPluginIdByTool('rm_tool'), null, 'tool unmapped');
    }

    console.log('    ✅ all passed');
}

module.exports = { run };
