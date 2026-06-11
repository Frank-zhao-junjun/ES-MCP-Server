/**
 * MCP Server Plugin Loader
 *
 * Handles dynamic loading and management of plugins from external modules.
 * Delegates all tool registration/unregistration to PluginManager,
 * which uses the MCP SDK's RegisteredTool handles for proper lifecycle.
 */

const fs = require('fs');
const path = require('path');
const { validatePlugin, PluginManager } = require('./plugin-system');

class PluginLoader {
    constructor(server, pluginDirs = []) {
        this.server = server;
        this.pluginDirs = pluginDirs;
        this.pluginManager = new PluginManager(server);
        this.activePlugins = new Map(); // pluginId -> module
        this.watchers = new Map();      // plugin file path -> { watcher, timeoutId }
    }

    /**
     * Load plugins from specified directories
     * @param {string[]} pluginDirs
     * @returns {Promise<Object>} Result with loaded plugins and errors
     */
    async loadPluginsFromDirs(pluginDirs = this.pluginDirs) {
        const result = {
            loaded: [],
            errors: []
        };

        for (const dir of pluginDirs) {
            if (!fs.existsSync(dir)) {
                console.warn(`[plugin-loader] Plugin directory does not exist: ${dir}`);
                continue;
            }

            const files = fs.readdirSync(dir);

            for (const file of files) {
                if (file.endsWith('.js') || file.endsWith('.cjs') || file.endsWith('.mjs')) {
                    const pluginPath = path.join(dir, file);

                    try {
                        const pluginModule = await this.loadPluginFromFile(pluginPath);

                        if (pluginModule) {
                            const success = await this.pluginManager.registerPlugin(pluginModule);

                            if (success) {
                                result.loaded.push({
                                    id: pluginModule.id,
                                    path: pluginPath,
                                    name: pluginModule.name
                                });

                                this.activePlugins.set(pluginModule.id, pluginModule);
                            } else {
                                result.errors.push({
                                    path: pluginPath,
                                    error: 'Failed to register plugin'
                                });
                            }
                        }
                    } catch (error) {
                        result.errors.push({
                            path: pluginPath,
                            error: error.message
                        });
                    }
                }
            }
        }

        return result;
    }

    /**
     * Load a single plugin from a file
     * @param {string} pluginPath
     * @returns {Promise<McpPlugin|null>}
     */
    async loadPluginFromFile(pluginPath) {
        try {
            // Clear require cache to enable hot reloading
            delete require.cache[require.resolve(pluginPath)];

            const pluginModule = require(pluginPath);

            // Handle both default export and named exports
            const plugin = pluginModule.default || pluginModule;

            if (!plugin || typeof plugin !== 'object') {
                throw new Error('Plugin module does not export a valid plugin object');
            }

            return plugin;
        } catch (error) {
            console.error(`[plugin-loader] Error loading plugin from ${pluginPath}:`, error.message);
            return null;
        }
    }

    /**
     * Load a plugin from a module name (npm package)
     * @param {string} moduleName
     * @returns {Promise<McpPlugin|null>}
     */
    async loadPluginFromModule(moduleName) {
        try {
            const pluginModule = require(moduleName);
            const plugin = pluginModule.default || pluginModule;

            if (!plugin || typeof plugin !== 'object') {
                throw new Error('Module does not export a valid plugin object');
            }

            return plugin;
        } catch (error) {
            console.error(`[plugin-loader] Error loading plugin module ${moduleName}:`, error.message);
            return null;
        }
    }

    /**
     * Hot reload a plugin from file
     * @param {string} pluginId
     * @param {string} pluginPath
     * @returns {Promise<boolean>}
     */
    async reloadPlugin(pluginId, pluginPath) {
        // Unregister existing plugin (truly removes tools from SDK registry)
        if (this.pluginManager.getPlugin(pluginId)) {
            await this.pluginManager.unregisterPlugin(pluginId);
            this.activePlugins.delete(pluginId);
        }

        // Load and register new version
        const pluginModule = await this.loadPluginFromFile(pluginPath);

        if (!pluginModule) {
            return false;
        }

        if (pluginModule.id !== pluginId) {
            console.error(`[plugin-loader] Plugin ID changed during reload: ${pluginId} -> ${pluginModule.id}`);
            return false;
        }

        const success = await this.pluginManager.registerPlugin(pluginModule);

        if (success) {
            this.activePlugins.set(pluginModule.id, pluginModule);
            console.error(`[plugin-loader] Reloaded plugin "${pluginId}"`);
        }

        return success;
    }

    /**
     * Watch plugin files for changes and reload automatically
     * @param {string} pluginPath
     * @param {number} debounceMs
     * @returns {Promise<void>}
     */
    async watchPluginFile(pluginPath, debounceMs = 1000) {
        if (this.watchers.has(pluginPath)) {
            return;
        }

        let timeoutId = null;

        const watcher = fs.watch(pluginPath, (eventType) => {
            if (eventType === 'change') {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                timeoutId = setTimeout(async () => {
                    // Clear the timeout reference so stopWatching can clean it up
                    const entry = this.watchers.get(pluginPath);
                    if (entry) entry.timeoutId = null;

                    try {
                        const stat = fs.statSync(pluginPath);
                        if (stat.size === 0) {
                            return;
                        }

                        // Clear require cache before reading the module
                        delete require.cache[require.resolve(pluginPath)];

                        const pluginModule = require(pluginPath);
                        const plugin = pluginModule.default || pluginModule;

                        if (plugin && plugin.id) {
                            await this.reloadPlugin(plugin.id, pluginPath);
                        }
                    } catch (error) {
                        console.error(`[plugin-loader] Error during hot reload of ${pluginPath}:`, error.message);
                    }
                }, debounceMs);

                // Store the timeoutId so we can clear it on stop
                const entry = this.watchers.get(pluginPath);
                if (entry) entry.timeoutId = timeoutId;
            }
        });

        this.watchers.set(pluginPath, { watcher, timeoutId: null });
        console.error(`[plugin-loader] Started watching plugin file: ${pluginPath}`);
    }

    /**
     * Stop watching a plugin file
     * @param {string} pluginPath
     * @returns {void}
     */
    stopWatchingPluginFile(pluginPath) {
        const entry = this.watchers.get(pluginPath);
        if (entry) {
            if (entry.timeoutId) {
                clearTimeout(entry.timeoutId);
            }
            entry.watcher.close();
            this.watchers.delete(pluginPath);
            console.error(`[plugin-loader] Stopped watching plugin file: ${pluginPath}`);
        }
    }

    /**
     * Unload a plugin (truly removes its tools from the MCP SDK registry)
     * @param {string} pluginId
     * @returns {Promise<boolean>}
     */
    async unloadPlugin(pluginId) {
        const success = await this.pluginManager.unregisterPlugin(pluginId);

        if (success) {
            this.activePlugins.delete(pluginId);

            // Stop any file watchers for this plugin
            for (const [filePath, entry] of this.watchers) {
                try {
                    delete require.cache[require.resolve(filePath)];
                    const loadedModule = require(filePath);
                    const modulePlugin = loadedModule.default || loadedModule;

                    if (modulePlugin && modulePlugin.id === pluginId) {
                        this.stopWatchingPluginFile(filePath);
                    }
                } catch (error) {
                    // Ignore errors when checking module — cache may be stale
                }
            }
        }

        return success;
    }

    /**
     * Get plugin manager instance
     * @returns {PluginManager}
     */
    getPluginManager() {
        return this.pluginManager;
    }

    /**
     * Get all loaded plugins
     * @returns {McpPlugin[]}
     */
    getLoadedPlugins() {
        return this.pluginManager.listPlugins();
    }

    /**
     * Get plugin by ID
     * @param {string} pluginId
     * @returns {McpPlugin|null}
     */
    getPlugin(pluginId) {
        return this.pluginManager.getPlugin(pluginId);
    }

    /**
     * Shutdown the plugin loader
     *
     * Properly removes all plugin tools from the MCP SDK registry
     * and runs each plugin's cleanup function.
     *
     * @returns {Promise<void>}
     */
    async shutdown() {
        // Stop all watchers (clear pending timeouts too)
        for (const [filePath, entry] of this.watchers) {
            if (entry.timeoutId) {
                clearTimeout(entry.timeoutId);
            }
            entry.watcher.close();
        }
        this.watchers.clear();

        // Unregister every plugin — this removes tools from the SDK registry
        for (const pluginId of this.activePlugins.keys()) {
            await this.pluginManager.unregisterPlugin(pluginId);
        }

        this.activePlugins.clear();
    }
}

module.exports = PluginLoader;
