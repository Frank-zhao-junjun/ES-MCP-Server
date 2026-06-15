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
 *
 * v0.4: canUseDebugTools / canUseAdminTools 接受可选 roleOverride 参数，
 * 用于多键模式下按 key 的 role 鉴权。无参数时回退到全局 MCP_ROLE。
 */

const VALID_ROLES = ['readonly', 'debug', 'admin'];
const ROLE_LEVELS = { readonly: 0, debug: 1, admin: 2 };
let cachedRole = null;

/**
 * 获取当前运行角色（全局，单键模式使用）
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
 * 纯函数：比较 role 是否 >= target
 */
function roleGte(role, target) {
    return (ROLE_LEVELS[role] || 0) >= (ROLE_LEVELS[target] || 0);
}

/**
 * 内部：用给定 role 做层级比较
 */
function _roleGteWithRole(role, target) {
    return roleGte(role || getRole(), target);
}

/**
 * 是否可使用调试工具 (query_sap_scenario)
 *
 * 优先级: MCP_ENABLE_DEBUG_TOOLS 显式覆盖 > role (传入或全局 MCP_ROLE)
 *
 * @param {string|null} roleOverride - 多键模式下的 key role，null 时用全局
 */
function canUseDebugTools(roleOverride = null) {
    if (process.env.MCP_ENABLE_DEBUG_TOOLS === 'true') return true;
    if (process.env.MCP_ENABLE_DEBUG_TOOLS === 'false') return false;
    return _roleGteWithRole(roleOverride, 'debug');
}

/**
 * 是否可使用管理员工具 (load_plugin, unload_plugin 等)
 *
 * 优先级: MCP_ENABLE_ADMIN_TOOLS 显式覆盖 > role (传入或全局 MCP_ROLE)
 *
 * @param {string|null} roleOverride - 多键模式下的 key role，null 时用全局
 */
function canUseAdminTools(roleOverride = null) {
    if (process.env.MCP_ENABLE_ADMIN_TOOLS === 'true') return true;
    if (process.env.MCP_ENABLE_ADMIN_TOOLS === 'false') return false;
    return _roleGteWithRole(roleOverride, 'admin');
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
    roleGte,
    resetRole,
    VALID_ROLES,
};
