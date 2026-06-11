/**
 * MCP Server Dynamic Loader
 *
 * Provides runtime loading/unloading of tools and plugins
 */

const path = require('path');
const PluginLoader = require('./plugin-loader');

class DynamicLoader {
    constructor(server, pluginDirs = []) {
        this.server = server;
        this.pluginDirs = pluginDirs.map(dir => path.resolve(dir));
        this.pluginLoader = new PluginLoader(server, this.pluginDirs);
        this.dynamicTools = new Map(); // toolName -> { handler, parameters, description, pluginId }
        this.originalTools = new Map(); // To track original server tools
    }

    isAllowedPluginPath(pluginPath) {
        const resolvedPath = path.resolve(pluginPath);
        const normalizePath = value => process.platform === 'win32' ? value.toLowerCase() : value;
        const normalizedPath = normalizePath(resolvedPath);
        return this.pluginDirs.some(dir => {
            const normalizedDir = normalizePath(dir);
            return normalizedPath === normalizedDir || normalizedPath.startsWith(`${normalizedDir}${path.sep}`);
        });
    }

    /**
     * Load tools from a plugin module
     * @param {Object} pluginModule - The plugin module to load
     * @param {string} source - Source identifier (file path, module name, etc.)
     * @returns {Promise<{success: boolean, loaded: string[], errors: string[]}>}
     */
    async loadPlugin(pluginModule, source = 'unknown') {
        const result = {
            success: false,
            loaded: [],
            errors: []
        };

        try {
            // Validate the plugin module
            const plugin = pluginModule.default || pluginModule;

            if (!plugin || typeof plugin !== 'object') {
                result.errors.push('Invalid plugin module: does not export a plugin object');
                return result;
            }

            // Use plugin loader to register the plugin
            const success = await this.pluginLoader.getPluginManager().registerPlugin(plugin);

            if (success) {
                result.success = true;
                result.loaded = plugin.tools ? plugin.tools.map(t => t.name) : [];

                // Track loaded tools for potential later unloading
                for (const tool of plugin.tools || []) {
                    this.dynamicTools.set(tool.name, {
                        handler: tool.handler,
                        parameters: tool.parameters,
                        description: tool.description,
                        pluginId: plugin.id
                    });
                }

                console.error(`[dynamic-loader] Loaded plugin "${plugin.id}" with ${result.loaded.length} tools from ${source}`);
            } else {
                result.errors.push(`Failed to register plugin "${plugin.id}"`);
            }
        } catch (error) {
            result.errors.push(`Error loading plugin from ${source}: ${error.message}`);
        }

        return result;
    }

    /**
     * Load tools from a file path
     * @param {string} pluginPath - Path to the plugin file
     * @returns {Promise<{success: boolean, loaded: string[], errors: string[]}>}
     */
    async loadPluginFromFile(pluginPath) {
        try {
            if (!this.isAllowedPluginPath(pluginPath)) {
                return {
                    success: false,
                    loaded: [],
                    errors: [`Plugin path is outside allowed plugin directories: ${pluginPath}`]
                };
            }

            // Clear require cache to enable hot reloading
            delete require.cache[require.resolve(pluginPath)];

            const pluginModule = require(pluginPath);
            return await this.loadPlugin(pluginModule, pluginPath);
        } catch (error) {
            return {
                success: false,
                loaded: [],
                errors: [`Error loading plugin from file ${pluginPath}: ${error.message}`]
            };
        }
    }

    /**
     * Load tools from an npm module
     * @param {string} moduleName - Name of the npm module
     * @returns {Promise<{success: boolean, loaded: string[], errors: string[]}>}
     */
    async loadPluginFromModule(moduleName) {
        try {
            const pluginModule = require(moduleName);
            return await this.loadPlugin(pluginModule, moduleName);
        } catch (error) {
            return {
                success: false,
                loaded: [],
                errors: [`Error loading plugin module ${moduleName}: ${error.message}`]
            };
        }
    }

    /**
     * Unload a plugin and its tools
     * @param {string} pluginId - ID of the plugin to unload
     * @returns {Promise<boolean>}
     */
    async unloadPlugin(pluginId) {
        // Since MCP SDK doesn't support removing tools directly,
        // we'll just remove from our tracking and log a warning
        const plugin = this.pluginLoader.getPluginManager().getPlugin(pluginId);

        if (!plugin) {
            console.error(`[dynamic-loader] Plugin with ID "${pluginId}" not found`);
            return false;
        }

        // Attempt to unregister the plugin
        const success = await this.pluginLoader.unloadPlugin(pluginId);

        if (success) {
            // Remove tools from our tracking
            for (const tool of plugin.tools || []) {
                this.dynamicTools.delete(tool.name);
            }

            console.error(`[dynamic-loader] Unloaded plugin "${pluginId}"`);
        }

        return success;
    }

    /**
     * Load a single tool dynamically
     * @param {string} name - Tool name
     * @param {string} description - Tool description
     * @param {Object} parameters - Zod parameters schema
     * @param {Function} handler - Tool handler function
     * @param {string} [groupId] - Optional group ID for related tools
     * @returns {boolean}
     */
    loadTool(name, description, parameters, handler, groupId = null) {
        if (this.dynamicTools.has(name)) {
            console.warn(`[dynamic-loader] Tool "${name}" already exists, replacing...`);
        }

        try {
            // Register the tool with the server
            this.server.tool(name, description, parameters, handler);

            // Track the tool
            this.dynamicTools.set(name, {
                handler,
                parameters,
                description,
                pluginId: groupId || 'dynamic'
            });

            console.error(`[dynamic-loader] Dynamically loaded tool "${name}"`);
            return true;
        } catch (error) {
            console.error(`[dynamic-loader] Failed to load tool "${name}":`, error.message);
            return false;
        }
    }

    /**
     * Unload a dynamically loaded tool
     * @param {string} name - Tool name to unload
     * @returns {boolean}
     */
    unloadTool(name) {
        const toolInfo = this.dynamicTools.get(name);

        if (!toolInfo) {
            console.warn(`[dynamic-loader] Tool "${name}" not found or not dynamically loaded`);
            return false;
        }

        // Since MCP SDK doesn't support removing tools directly,
        // we'll replace the handler with a disabled one
        this.server.tool(
            name,
            '[DISABLED] This tool has been unloaded',
            {},
            async () => {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            schemaVersion: '1.0',
                            tool: name,
                            ok: false,
                            data: null,
                            warnings: ['This tool has been dynamically unloaded'],
                            error: {
                                code: 'TOOL_UNLOADED',
                                message: 'This tool has been dynamically unloaded',
                                retryable: false
                            }
                        })
                    }],
                    isError: false
                };
            }
        );

        this.dynamicTools.delete(name);
        console.error(`[dynamic-loader] Unloaded tool "${name}"`);

        return true;
    }

    /**
     * Check if a tool exists
     * @param {string} name - Tool name
     * @returns {boolean}
     */
    hasTool(name) {
        return this.dynamicTools.has(name);
    }

    /**
     * Get information about a loaded tool
     * @param {string} name - Tool name
     * @returns {Object|null}
     */
    getToolInfo(name) {
        return this.dynamicTools.get(name) || null;
    }

    /**
     * List all dynamically loaded tools
     * @returns {Array<{name: string, pluginId: string, description: string}>}
     */
    listDynamicTools() {
        return Array.from(this.dynamicTools.entries()).map(([name, info]) => ({
            name,
            pluginId: info.pluginId,
            description: info.description
        }));
    }

    /**
     * List all loaded plugins
     * @returns {Array}
     */
    listPlugins() {
        return this.pluginLoader.getLoadedPlugins();
    }

    async loadPluginsFromDirs(pluginDirs = this.pluginDirs) {
        const result = await this.pluginLoader.loadPluginsFromDirs(pluginDirs);
        for (const plugin of this.pluginLoader.getLoadedPlugins()) {
            for (const tool of plugin.tools || []) {
                this.dynamicTools.set(tool.name, {
                    handler: tool.handler,
                    parameters: tool.parameters,
                    description: tool.description,
                    pluginId: plugin.id
                });
            }
        }
        return result;
    }

    /**
     * Enable hot reloading for a plugin file
     * @param {string} pluginPath - Path to the plugin file
     * @param {number} debounceMs - Debounce time in milliseconds
     * @returns {Promise<boolean>}
     */
    async enableHotReload(pluginPath, debounceMs = 1000) {
        try {
            await this.pluginLoader.watchPluginFile(pluginPath, debounceMs);
            return true;
        } catch (error) {
            console.error(`[dynamic-loader] Failed to enable hot reload for ${pluginPath}:`, error.message);
            return false;
        }
    }

    /**
     * Disable hot reloading for a plugin file
     * @param {string} pluginPath - Path to the plugin file
     * @returns {void}
     */
    disableHotReload(pluginPath) {
        this.pluginLoader.stopWatchingPluginFile(pluginPath);
    }

    /**
     * Get plugin loader instance
     * @returns {PluginLoader}
     */
    getPluginLoader() {
        return this.pluginLoader;
    }

    /**
     * Shutdown the dynamic loader
     * @returns {Promise<void>}
     */
    async shutdown() {
        // Clean up plugin loader
        await this.pluginLoader.shutdown();

        // Clear our internal tracking
        this.dynamicTools.clear();
    }
}

module.exports = DynamicLoader;
