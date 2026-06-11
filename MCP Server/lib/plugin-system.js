/**
 * MCP Server Plugin System
 *
 * Defines interfaces and utilities for plugin-based tool registration
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
                // Validate that parameters are Zod schemas
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
 * Plugin manager class
 */
class PluginManager {
    constructor(server) {
        this.server = server;
        this.plugins = new Map(); // id -> plugin
        this.loadedTools = new Map(); // toolName -> pluginId
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

        // Register all tools from the plugin
        for (const toolDef of plugin.tools) {
            if (this.loadedTools.has(toolDef.name)) {
                console.error(`[plugin-manager] Tool name "${toolDef.name}" already exists`);
                // Rollback: unregister previously registered tools from this plugin
                for (const rollbackTool of plugin.tools) {
                    if (rollbackTool.name !== toolDef.name) {
                        this.server.unregisterTool?.(rollbackTool.name); // If MCP SDK supports this
                    }
                    break; // Just remove the one we added so far
                }
                this.plugins.delete(plugin.id);
                return false;
            }

            // Register the tool with the server
            this.server.tool(
                toolDef.name,
                toolDef.description,
                toolDef.parameters,
                toolDef.handler
            );

            this.loadedTools.set(toolDef.name, plugin.id);
        }

        console.error(`[plugin-manager] Successfully registered plugin "${plugin.id}" with ${plugin.tools.length} tools`);
        return true;
    }

    /**
     * Unregister a plugin and its tools
     * @param {string} pluginId
     * @returns {Promise<boolean>} Success status
     */
    async unregisterPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            console.error(`[plugin-manager] Plugin with id "${pluginId}" not found`);
            return false;
        }

        // Note: MCP SDK doesn't currently support unregistering tools,
        // so we'll just track what was loaded and warn about it

        // Run cleanup if provided
        if (plugin.cleanup) {
            try {
                await plugin.cleanup(this.server);
            } catch (error) {
                console.error(`[plugin-manager] Error during plugin "${pluginId}" cleanup:`, error.message);
                // Don't return false here as the plugin is still unregistered
            }
        }

        // Remove from our tracking
        for (const toolDef of plugin.tools) {
            this.loadedTools.delete(toolDef.name);
        }

        this.plugins.delete(pluginId);

        console.error(`[plugin-manager] Unregistered plugin "${pluginId}"`);
        return true;
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
