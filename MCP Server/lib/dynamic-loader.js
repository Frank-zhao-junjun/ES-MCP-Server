/**
 * MCP Server Dynamic Loader
 *
 * Provides runtime loading/unloading of tools and plugins.
 * Delegates to PluginLoader for file/module loading and
 * uses MCP SDK's RegisteredTool.remove()/disable()/enable()
 * for true lifecycle management.
 */

const path = require('path');
const PluginLoader = require('./plugin-loader');

class DynamicLoader {
    constructor(server, pluginDirs = []) {
        this.server = server;
        this.pluginDirs = pluginDirs.map(dir => path.resolve(dir));
        this.pluginLoader = new PluginLoader(server, this.pluginDirs);
        this.dynamicTools = new Map(); // toolName -> { handler, parameters, description, pluginId }
    }

    /**
     * Check whether a plugin path is inside one of the allowed directories.
     * Handles path traversal and normalises platform differences.
     */
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
            const plugin = pluginModule.default || pluginModule;

            if (!plugin || typeof plugin !== 'object') {
                result.errors.push('Invalid plugin module: does not export a plugin object');
                return result;
            }

            // Delegate registration to PluginManager
            const success = await this.pluginLoader.getPluginManager().registerPlugin(plugin);

            if (success) {
                result.success = true;
                result.loaded = plugin.tools ? plugin.tools.map(t => t.name) : [];

                // Mirror tools into our dynamic tracking map
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

            const pluginModule = await this.pluginLoader.loadPluginFromFile(pluginPath);
            if (!pluginModule) {
                return {
                    success: false,
                    loaded: [],
                    errors: [`Failed to load plugin from file: ${pluginPath}`]
                };
            }
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
            const pluginModule = await this.pluginLoader.loadPluginFromModule(moduleName);
            if (!pluginModule) {
                return {
                    success: false,
                    loaded: [],
                    errors: [`Failed to load plugin module: ${moduleName}`]
                };
            }
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
     * Unload a plugin and its tools.
     *
     * Delegates to PluginLoader.unloadPlugin() which in turn calls
     * PluginManager.unregisterPlugin(). The manager calls
     * `RegisteredTool.remove()` on each tool handle, so the tools
     * truly disappear from the MCP `tools/list` response and a
     * `notifications/tools/list_changed` is sent to all clients.
     *
     * @param {string} pluginId - ID of the plugin to unload
     * @returns {Promise<boolean>}
     */
    async unloadPlugin(pluginId) {
        const plugin = this.pluginLoader.getPluginManager().getPlugin(pluginId);

        if (!plugin) {
            console.error(`[dynamic-loader] Plugin with ID "${pluginId}" not found`);
            return false;
        }

        const success = await this.pluginLoader.unloadPlugin(pluginId);

        if (success) {
            // Clean up our dynamic tracking map
            for (const tool of plugin.tools || []) {
                this.dynamicTools.delete(tool.name);
            }

            console.error(`[dynamic-loader] Unloaded plugin "${pluginId}"`);
        }

        return success;
    }

    /**
     * Load a single tool dynamically (not part of a plugin).
     *
     * Returns the RegisteredTool handle so callers can disable/enable/remove
     * the tool later without going through a plugin.
     *
     * @param {string} name - Tool name
     * @param {string} description - Tool description
     * @param {Object} parameters - Zod parameters schema
     * @param {Function} handler - Tool handler function
     * @param {string} [groupId] - Optional group ID for related tools
     * @returns {{ handle: Object, ok: boolean }} SDK RegisteredTool handle + success flag
     */
    loadTool(name, description, parameters, handler, groupId = null) {
        if (this.dynamicTools.has(name)) {
            console.warn(`[dynamic-loader] Tool "${name}" already exists, will be replaced via remove+re-register`);
            // Remove the old one first so server.tool() won't throw
            const oldHandle = this.pluginLoader.getPluginManager().getToolHandle(name);
            if (oldHandle) {
                oldHandle.remove();
            }
        }

        try {
            const handle = this.server.tool(name, description, parameters, handler);

            this.dynamicTools.set(name, {
                handler,
                parameters,
                description,
                pluginId: groupId || 'dynamic'
            });

            // Keep the handle in PluginManager too for consistent lookup
            this.pluginLoader.getPluginManager().toolHandles.set(name, handle);
            this.pluginLoader.getPluginManager().loadedTools.set(name, groupId || 'dynamic');

            console.error(`[dynamic-loader] Dynamically loaded tool "${name}"`);
            return { handle, ok: true };
        } catch (error) {
            console.error(`[dynamic-loader] Failed to load tool "${name}":`, error.message);
            return { handle: null, ok: false };
        }
    }

    /**
     * Unload a dynamically loaded tool.
     *
     * Uses the SDK's `RegisteredTool.remove()` so the tool is truly
     * gone from `tools/list` and clients are notified.
     *
     * @param {string} name - Tool name to unload
     * @returns {boolean}
     */
    unloadTool(name) {
        const toolInfo = this.dynamicTools.get(name);

        if (!toolInfo) {
            console.warn(`[dynamic-loader] Tool "${name}" not found or not dynamically loaded`);
            return false;
        }

        // Use the SDK handle to truly remove the tool
        const handle = this.pluginLoader.getPluginManager().getToolHandle(name);
        if (handle) {
            handle.remove();   // removes from SDK registry + sends list_changed
            this.pluginLoader.getPluginManager().toolHandles.delete(name);
        }

        this.dynamicTools.delete(name);
        this.pluginLoader.getPluginManager().loadedTools.delete(name);

        console.error(`[dynamic-loader] Unloaded tool "${name}"`);
        return true;
    }

    /**
     * Temporarily disable a tool without removing it.
     * The tool still appears in tools/list but calls return an error.
     * @param {string} name - Tool name
     * @returns {boolean}
     */
    disableTool(name) {
        const handle = this.pluginLoader.getPluginManager().getToolHandle(name);
        if (!handle) return false;
        handle.disable();
        console.error(`[dynamic-loader] Disabled tool "${name}"`);
        return true;
    }

    /**
     * Re-enable a previously disabled tool.
     * @param {string} name - Tool name
     * @returns {boolean}
     */
    enableTool(name) {
        const handle = this.pluginLoader.getPluginManager().getToolHandle(name);
        if (!handle) return false;
        handle.enable();
        console.error(`[dynamic-loader] Enabled tool "${name}"`);
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

        // Mirror into our dynamic tracking map
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
        // Remove all dynamically loaded tools from the SDK registry
        for (const [name] of this.dynamicTools) {
            const handle = this.pluginLoader.getPluginManager().getToolHandle(name);
            if (handle) {
                handle.remove();
            }
        }

        // Clean up plugin loader (stops watchers, runs plugin cleanups)
        await this.pluginLoader.shutdown();

        // Clear our internal tracking
        this.dynamicTools.clear();
    }
}

module.exports = DynamicLoader;
