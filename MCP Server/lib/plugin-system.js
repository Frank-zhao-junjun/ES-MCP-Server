/**
 * MCP Server Plugin System
 *
 * Defines interfaces and utilities for plugin-based tool registration.
 * Uses MCP SDK's RegisteredTool.disable()/remove()/enable() for proper
 * lifecycle management so that unloaded tools are truly hidden from clients.
 */

const { z } = require('zod');

/**
 * @typedef {Object} McpToolDefinition
 * @property {string} name - Tool name (unique identifier)
 * @property {string} description - Tool description for AI agents
 * @property {Object.<string, import('zod').ZodSchema>} parameters - Zod schema for parameters
 * @property {Function} handler - Async function that handles the tool request
 */

/**
 * @typedef {Object} McpPlugin
 * @property {string} id - Unique plugin identifier
 * @property {string} name - Human-readable plugin name
 * @property {string} version - Plugin version
 * @property {string} description - Plugin description
 * @property {McpToolDefinition[]} tools - List of tools provided by the plugin
 * @property {Function} [init] - Optional initialization function
 * @property {Function} [cleanup] - Optional cleanup function
 */

/**
 * Validates a plugin definition
 * @param {McpPlugin} plugin
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
async function validatePlugin(plugin) {
    const errors = [];

    if (!plugin.id || typeof plugin.id !== 'string') {
        errors.push('Plugin must have a valid id string');
    } else if (/^(?:__proto__|constructor|prototype)$/.test(plugin.id.trim())) {
        errors.push('Plugin id must not be a reserved property name');
    } else if (plugin.id.trim().length === 0) {
        errors.push('Plugin id must not be empty or whitespace-only');
    }

    if (!plugin.name || typeof plugin.name !== 'string') {
        errors.push('Plugin must have a valid name string');
    }

    if (!plugin.version || typeof plugin.version !== 'string') {
        errors.push('Plugin must have a valid version string');
    }

    if (!plugin.description || typeof plugin.description !== 'string') {
        errors.push('Plugin must have a valid description string');
    }

    if (!Array.isArray(plugin.tools)) {
        errors.push('Plugin must have a tools array');
    } else {
        for (let i = 0; i < plugin.tools.length; i++) {
            const tool = plugin.tools[i];
            const prefix = `Tool[${i}]`;

            if (!tool.name || typeof tool.name !== 'string') {
                errors.push(`${prefix} must have a valid name string`);
            }

            if (!tool.description || typeof tool.description !== 'string') {
                errors.push(`${prefix} must have a valid description string`);
            }

            if (!tool.parameters || typeof tool.parameters !== 'object') {
                errors.push(`${prefix} must have a valid parameters object`);
            } else {
                for (const [paramName, paramSchema] of Object.entries(tool.parameters)) {
                    if (!paramSchema || typeof paramSchema.parse !== 'function') {
                        errors.push(`${prefix}.parameters.${paramName} must be a Zod schema`);
                    }
                }
            }

            if (typeof tool.handler !== 'function') {
                errors.push(`${prefix} must have a valid handler function`);
            }
        }
    }

    if (plugin.init && typeof plugin.init !== 'function') {
        errors.push('Plugin init must be a function if provided');
    }

    if (plugin.cleanup && typeof plugin.cleanup !== 'function') {
        errors.push('Plugin cleanup must be a function if provided');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Plugin manager class.
 *
 * For every tool registered via `registerPlugin()`, we keep the
 * `RegisteredTool` handle returned by `server.tool()`.  This handle
 * exposes `disable()`, `enable()` and `remove()` methods from the
 * MCP SDK, which properly update the tool list advertised to
 * connected clients (via `notifications/tools/list_changed`).
 */
class PluginManager {
    constructor(server) {
        this.server = server;
        this.plugins = new Map();          // id -> plugin
        this.loadedTools = new Map();      // toolName -> pluginId
        this.toolHandles = new Map();      // toolName -> RegisteredTool handle
    }

    /**
     * Register a plugin with the server
     * @param {McpPlugin} plugin
     * @returns {Promise<boolean>} Success status
     */
    async registerPlugin(plugin) {
        const validationResult = await validatePlugin(plugin);

        if (!validationResult.valid) {
            console.error(`[plugin-manager] Invalid plugin "${plugin.id}":`, validationResult.errors);
            return false;
        }

        if (this.plugins.has(plugin.id)) {
            console.error(`[plugin-manager] Plugin with id "${plugin.id}" already registered`);
            return false;
        }

        // Store the plugin
        this.plugins.set(plugin.id, plugin);

        // Initialize the plugin if it has an init function
        if (plugin.init) {
            try {
                await plugin.init(this.server);
            } catch (error) {
                console.error(`[plugin-manager] Failed to initialize plugin "${plugin.id}":`, error.message);
                this.plugins.delete(plugin.id);
                return false;
            }
        }

        // Register all tools from the plugin, keeping track of handles for rollback
        const registeredNames = [];

        for (const toolDef of plugin.tools) {
            if (this.loadedTools.has(toolDef.name)) {
                console.error(`[plugin-manager] Tool name "${toolDef.name}" already registered by another plugin`);

                // Rollback: remove every tool we just registered for this plugin
                for (const name of registeredNames) {
                    const handle = this.toolHandles.get(name);
                    if (handle) {
                        handle.remove();   // truly removes from SDK registry
                        this.toolHandles.delete(name);
                    }
                    this.loadedTools.delete(name);
                }

                this.plugins.delete(plugin.id);
                return false;
            }

            // Register the tool — server.tool() returns a RegisteredTool handle.
            // This may throw if the tool name already exists in the SDK (e.g.
            // built-in tool or tool loaded outside of PluginManager).
            let handle;
            try {
                handle = this.server.tool(
                    toolDef.name,
                    toolDef.description,
                    toolDef.parameters,
                    toolDef.handler
                );
            } catch (sdkError) {
                console.error(`[plugin-manager] SDK rejected tool "${toolDef.name}": ${sdkError.message}`);

                // Rollback: remove every tool we already registered for this plugin
                for (const name of registeredNames) {
                    const h = this.toolHandles.get(name);
                    if (h) {
                        h.remove();
                        this.toolHandles.delete(name);
                    }
                    this.loadedTools.delete(name);
                }

                this.plugins.delete(plugin.id);
                return false;
            }

            // Save the SDK handle so we can disable/remove later
            this.toolHandles.set(toolDef.name, handle);
            this.loadedTools.set(toolDef.name, plugin.id);
            registeredNames.push(toolDef.name);
        }

        console.error(`[plugin-manager] Successfully registered plugin "${plugin.id}" with ${plugin.tools.length} tools`);
        return true;
    }

    /**
     * Unregister a plugin and its tools.
     *
     * Uses the SDK's `remove()` method so that the tools disappear from
     * `tools/list` and a `notifications/tools/list_changed` notification
     * is sent to all connected clients.
     *
     * @param {string} pluginId
     * @returns {Promise<boolean>} Success status
     */
    async unregisterPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            console.error(`[plugin-manager] Plugin with id "${pluginId}" not found`);
            return false;
        }

        // Run cleanup if provided
        if (plugin.cleanup) {
            try {
                await plugin.cleanup(this.server);
            } catch (error) {
                console.error(`[plugin-manager] Error during plugin "${pluginId}" cleanup:`, error.message);
                // Continue with unregister even if cleanup fails
            }
        }

        // Remove every tool from the SDK registry via the saved handle
        for (const toolDef of plugin.tools) {
            const handle = this.toolHandles.get(toolDef.name);
            if (handle) {
                handle.remove();   // truly removes from MCP SDK registry + sends list_changed
                this.toolHandles.delete(toolDef.name);
            }
            this.loadedTools.delete(toolDef.name);
        }

        this.plugins.delete(pluginId);

        console.error(`[plugin-manager] Unregistered plugin "${pluginId}"`);
        return true;
    }

    /**
     * Get the RegisteredTool handle for a tool name.
     * Useful for temporarily disabling a tool without removing it.
     * @param {string} toolName
     * @returns {Object|null} RegisteredTool handle or null
     */
    getToolHandle(toolName) {
        return this.toolHandles.get(toolName) || null;
    }

    /**
     * Get plugin by ID
     * @param {string} pluginId
     * @returns {McpPlugin|null}
     */
    getPlugin(pluginId) {
        return this.plugins.get(pluginId) || null;
    }

    /**
     * List all registered plugins
     * @returns {McpPlugin[]}
     */
    listPlugins() {
        return Array.from(this.plugins.values());
    }

    /**
     * Get plugin ID by tool name
     * @param {string} toolName
     * @returns {string|null}
     */
    getPluginIdByTool(toolName) {
        return this.loadedTools.get(toolName) || null;
    }

    /**
     * Get all loaded tools
     * @returns {{toolName: string, pluginId: string}[]}
     */
    getLoadedTools() {
        return Array.from(this.loadedTools.entries()).map(([toolName, pluginId]) => ({
            toolName,
            pluginId
        }));
    }
}

module.exports = {
    validatePlugin,
    PluginManager
};
