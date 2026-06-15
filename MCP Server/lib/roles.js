/**
 * lib/roles.js — 基于 MCP_ROLE 的权限模型
 *
 * 角色层级 (由低到高):
 *   readonly — 仅业务只读工具 (默认)
 *   debug    — 业务 + 调试工具 (query_sap_scenario)
 *   admin    — 全部工具含插件管理
 *
 * 向后兼容: 独立的 MCP_ENABLE_DEBUG_TOOLS / MCP_ENABLE_ADMIN_TOOLS
 * 仍然作为覆盖开关生效。
 */

const VALID_ROLES = ['readonly', 'debug', 'admin'];
let cachedRole = null;

/**
 * 获取当前运行角色
 * @returns {'readonly'|'debug'|'admin'}
 */
function getRole() {
    if (cachedRole !== null) return cachedRole;

    const raw = (process.env.MCP_ROLE || 'readonly').toLowerCase().trim();
    cachedRole = VALID_ROLES.includes(raw) ? raw : 'readonly';

    if (!VALID_ROLES.includes(raw)) {
        console.error(`[sap-s4-mcp] Unknown MCP_ROLE "${raw}", falling back to "readonly"`);
    }

    return cachedRole;
}

/**
 * 大于等于比较角色层级
 */
function _roleGte(target) {
    const levels = { readonly: 0, debug: 1, admin: 2 };
    return levels[getRole()] >= levels[target];
}

/**
 * 是否可使用调试工具 (query_sap_scenario)
 *
 * 优先级: MCP_ENABLE_DEBUG_TOOLS 显式覆盖 > MCP_ROLE >= debug
 */
function canUseDebugTools() {
    if (process.env.MCP_ENABLE_DEBUG_TOOLS === 'true') return true;
    if (process.env.MCP_ENABLE_DEBUG_TOOLS === 'false') return false;
    return _roleGte('debug');
}

/**
 * 是否可使用管理员工具 (load_plugin, unload_plugin 等)
 *
 * 优先级: MCP_ENABLE_ADMIN_TOOLS 显式覆盖 > MCP_ROLE >= admin
 */
function canUseAdminTools() {
    if (process.env.MCP_ENABLE_ADMIN_TOOLS === 'true') return true;
    if (process.env.MCP_ENABLE_ADMIN_TOOLS === 'false') return false;
    return _roleGte('admin');
}

/**
 * 重置角色缓存（仅供测试）
 */
function resetRole() {
    cachedRole = null;
}

module.exports = {
    getRole,
    canUseDebugTools,
    canUseAdminTools,
    resetRole,
    VALID_ROLES,
};
