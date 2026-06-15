/**
 * tests/unit/roles.test.js — 角色权限模型单元测试
 */
const assert = require('assert');

// 保存原始环境变量
const originalEnv = { ...process.env };

function restoreEnv() {
    process.env = { ...originalEnv };
}

async function run() {
    console.log('  roles.test.js');

    // ── 每次测试前重置模块缓存和环境 ──
    function reloadRoles() {
        delete require.cache[require.resolve('../../lib/roles')];
        return require('../../lib/roles');
    }

    // ── 1. 默认角色为 readonly ──
    {
        delete process.env.MCP_ROLE;
        delete process.env.MCP_ENABLE_DEBUG_TOOLS;
        delete process.env.MCP_ENABLE_ADMIN_TOOLS;
        const { getRole, canUseDebugTools, canUseAdminTools } = reloadRoles();
        assert.strictEqual(getRole(), 'readonly', 'default role is readonly');
        assert.strictEqual(canUseDebugTools(), false, 'readonly cannot debug');
        assert.strictEqual(canUseAdminTools(), false, 'readonly cannot admin');
    }

    // ── 2. debug 角色 ──
    {
        process.env.MCP_ROLE = 'debug';
        delete process.env.MCP_ENABLE_DEBUG_TOOLS;
        delete process.env.MCP_ENABLE_ADMIN_TOOLS;
        const { getRole, canUseDebugTools, canUseAdminTools } = reloadRoles();
        assert.strictEqual(getRole(), 'debug');
        assert.strictEqual(canUseDebugTools(), true, 'debug can debug');
        assert.strictEqual(canUseAdminTools(), false, 'debug cannot admin');
    }

    // ── 3. admin 角色 ──
    {
        process.env.MCP_ROLE = 'admin';
        delete process.env.MCP_ENABLE_DEBUG_TOOLS;
        delete process.env.MCP_ENABLE_ADMIN_TOOLS;
        const { getRole, canUseDebugTools, canUseAdminTools } = reloadRoles();
        assert.strictEqual(getRole(), 'admin');
        assert.strictEqual(canUseDebugTools(), true, 'admin can debug');
        assert.strictEqual(canUseAdminTools(), true, 'admin can admin');
    }

    // ── 4. 未知角色回退 readonly ──
    {
        process.env.MCP_ROLE = 'superuser';
        delete process.env.MCP_ENABLE_DEBUG_TOOLS;
        delete process.env.MCP_ENABLE_ADMIN_TOOLS;
        const { getRole, canUseDebugTools, canUseAdminTools } = reloadRoles();
        assert.strictEqual(getRole(), 'readonly', 'unknown role falls back to readonly');
        assert.strictEqual(canUseDebugTools(), false);
        assert.strictEqual(canUseAdminTools(), false);
    }

    // ── 5. MCP_ENABLE_DEBUG_TOOLS 显式覆盖 ──
    {
        process.env.MCP_ROLE = 'readonly';
        process.env.MCP_ENABLE_DEBUG_TOOLS = 'true';
        delete process.env.MCP_ENABLE_ADMIN_TOOLS;
        const { canUseDebugTools } = reloadRoles();
        assert.strictEqual(canUseDebugTools(), true, 'explicit flag overrides role');
    }

    // ── 6. MCP_ENABLE_DEBUG_TOOLS=false 强制关闭 ──
    {
        process.env.MCP_ROLE = 'admin';
        process.env.MCP_ENABLE_DEBUG_TOOLS = 'false';
        delete process.env.MCP_ENABLE_ADMIN_TOOLS;
        const { canUseDebugTools } = reloadRoles();
        assert.strictEqual(canUseDebugTools(), false, 'explicit false overrides admin role');
    }

    // ── 7. MCP_ENABLE_ADMIN_TOOLS 显式覆盖 ──
    {
        process.env.MCP_ROLE = 'readonly';
        delete process.env.MCP_ENABLE_DEBUG_TOOLS;
        process.env.MCP_ENABLE_ADMIN_TOOLS = 'true';
        const { canUseAdminTools } = reloadRoles();
        assert.strictEqual(canUseAdminTools(), true, 'explicit admin flag overrides role');
    }

    // ── 8. roleOverride 参数（多键模式） ──
    {
        process.env.MCP_ROLE = 'readonly';
        delete process.env.MCP_ENABLE_DEBUG_TOOLS;
        delete process.env.MCP_ENABLE_ADMIN_TOOLS;
        const { canUseDebugTools, canUseAdminTools } = reloadRoles();
        assert.strictEqual(canUseDebugTools('admin'), true, 'admin override enables debug');
        assert.strictEqual(canUseAdminTools('admin'), true, 'admin override enables admin');
        assert.strictEqual(canUseDebugTools('debug'), true, 'debug override enables debug');
        assert.strictEqual(canUseAdminTools('debug'), false, 'debug override disables admin');
    }

    // ── 9. roleGte 纯函数 ──
    {
        const { roleGte } = require('../../lib/roles');
        assert.strictEqual(roleGte('admin', 'admin'), true);
        assert.strictEqual(roleGte('admin', 'debug'), true);
        assert.strictEqual(roleGte('admin', 'readonly'), true);
        assert.strictEqual(roleGte('debug', 'admin'), false);
        assert.strictEqual(roleGte('readonly', 'debug'), false);
    }

    // ── 恢复 ──
    restoreEnv();

    console.log('    ✅ all passed');
}

module.exports = { run };
