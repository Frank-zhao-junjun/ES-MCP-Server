# 插件系统使用指南

## 概述

MCP Server 现在支持插件化架构，允许动态加载和卸载工具，无需重启服务器。

## 插件系统组件

### 1. PluginManager
- 管理插件的注册和注销
- 验证插件定义的完整性
- 跟踪已加载的工具

### 2. PluginLoader
- 从文件系统或 npm 模块加载插件
- 支持热重载功能
- 管理插件生命周期

### 3. DynamicLoader
- 提供运行时加载/卸载 API
- 集成到主服务器中
- 通过内置工具暴露插件管理功能

## 创建插件

### 插件结构

```javascript
const myPlugin = {
  // 必需字段
  id: 'my-plugin-id',                    // 唯一标识符
  name: 'My Plugin',                     // 人类可读名称
  version: '1.0.0',                      // 版本号
  description: 'Plugin description',      // 描述
  tools: [                               // 工具数组
    {
      name: 'tool_name',                 // 工具名称
      description: 'Tool description',    // 工具描述
      parameters: {                      // 参数验证规则
        param1: z.string().describe('Parameter description')
      },
      handler: async (args) => {         // 处理函数
        // 实现逻辑
        return textJson(toolSuccess('tool_name', result));
      }
    }
  ],
  
  // 可选字段
  init: async (server) => {              // 初始化函数
    // 插件初始化逻辑
  },
  cleanup: async (server) => {           // 清理函数
    // 插件卸载前清理逻辑
  }
};

module.exports = myPlugin;
```

### 示例插件

参见 `examples/sample-plugin.js` 了解完整示例。

## 运行时插件管理

服务器提供以下内置工具来管理插件：

### load_plugin
动态加载插件文件：

```json
{
  "name": "load_plugin",
  "arguments": {
    "pluginPath": "./plugins/my-plugin.js"
  }
}
```

### unload_plugin
卸载指定插件：

```json
{
  "name": "unload_plugin",
  "arguments": {
    "pluginId": "my-plugin-id"
  }
}
```

### list_loaded_plugins
列出所有已加载的插件：

```json
{
  "name": "list_loaded_plugins",
  "arguments": {}
}
```

## 插件目录结构

```
MCP Server/
├── plugins/           # 用户自定义插件
├── examples/          # 示例插件
├── lib/
│   ├── plugin-system.js
│   ├── plugin-loader.js
│   └── dynamic-loader.js
└── services/          # 核心业务服务
```

## 配置

插件系统会在启动时自动从以下目录加载插件：
- `./plugins/`
- `./examples/`

可以通过环境变量配置额外的插件目录：

```bash
MCP_PLUGIN_DIRS="./custom-plugins,./more-plugins"
```

## 最佳实践

### 1. 插件开发
- 为每个插件提供清晰的 ID 和描述
- 使用 Zod 验证所有参数
- 实现适当的错误处理
- 提供有意义的错误消息

### 2. 安全性
- 验证所有输入参数
- 实现适当的身份验证检查
- 避免在插件中硬编码敏感信息

### 3. 性能
- 实现适当的缓存策略
- 避免不必要的外部调用
- 使用异步操作处理长时间运行的任务

## 故障排除

### 插件加载失败
- 检查插件文件语法
- 验证插件结构是否符合要求
- 查看服务器日志中的错误消息

### 工具冲突
- 确保插件中的工具名称唯一
- 检查是否与其他插件或内置工具冲突

### 热重载问题
- 确保插件文件格式正确
- 检查文件权限
- 查看服务器日志了解重载状态