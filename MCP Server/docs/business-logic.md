# 业务逻辑说明

本文档详细说明 MCP Server 中各业务服务的逻辑流程。

## 1. 认证流程

### authenticate 工具

```mermaid
flowchart TD
    A[开始] --> B[接收 API 密钥]
    B --> C[验证密钥格式<br/>长度 ≥ 1]
    C --> D{密钥是否匹配<br/>服务器配置?}
    D -->|否| E[增加失败次数<br/>返回错误信息]
    E --> F{失败次数<br/>≥ 5?}
    F -->|是| G[锁定账户<br/>30秒]
    F -->|否| H[返回剩余尝试次数]
    D -->|是| I[重置失败次数<br/>设置认证状态]
    I --> J[返回成功响应]
    G --> K[返回锁定信息]
```

### 认证状态管理
- 服务器启动时初始化认证上下文
- 认证成功后设置 `authenticated` 标志
- 所有受保护工具都需要先检查认证状态

## 2. 健康检查流程

### health_check 工具

```mermaid
flowchart TD
    A[开始] --> B[检查服务器基本信息]
    B --> C[检查认证状态]
    C --> D[检查凭证文件可访问性]
    D --> E[检查场景目录可访问性]
    E --> F{includeSapCheck?}
    F -->|是| G[测试 SAP 连通性]
    F -->|否| H[跳过 SAP 测试]
    G --> I[检查场景文件数量]
    H --> I
    I --> J[汇总所有检查结果]
    J --> K[返回健康状态报告]
```

## 3. SAP 场景管理

### list_sap_scenarios 工具

```mermaid
flowchart TD
    A[开始] --> B[检查认证状态]
    B --> C[解析场景文件目录]
    C --> D[读取所有 SAP_COM_*.txt 文件]
    D --> E[提取场景代码和标题]
    E --> F[构建场景对象数组]
    F --> G[返回场景列表]
```

### 场景解析逻辑
- 从 `SAP_SCENARIO_DIR` 目录读取所有 `.txt` 文件
- 识别文件名中的 `SAP_COM_XXXX` 模式
- 提取文件中的 URL 并验证主机合法性
- 生成标准化的场景键名

## 4. 销售订单处理

### get_sales_order_status 工具

```mermaid
flowchart TD
    A[开始] --> B[验证销售订单参数<br/>仅数字字符]
    B --> C[标准化订单号<br/>去除前导零]
    C --> D[构建头信息查询 URL]
    D --> E[SAP OData 调用]
    E --> F[解析响应数据]
    F --> G{includeItems?}
    G -->|是| H[构建项目查询 URL]
    G -->|否| I[准备响应数据]
    H --> J[SAP OData 调用获取项目]
    J --> I
    I --> K[返回销售订单状态]
```

### trace_sales_order 工具

```mermaid
flowchart TD
    A[开始] --> B[验证销售订单参数]
    B --> C[构建多个实体查询 URL]
    C --> D[并行查询交货单]
    D --> E[并行查询生产订单]
    E --> F[并行查询物料凭证]
    F --> G[并行查询开票凭证]
    G --> H[收集所有查询结果]
    H --> I[处理错误和警告]
    I --> J[返回完整跟踪信息]
```

## 5. SAP 核心交互

### sapFetch 函数（含限流 + 断路器）

```mermaid
flowchart TD
    A[开始] --> B[检查断路器状态]
    B --> C{断路器是否 OPEN?}
    C -->|是| D{熔断超时已过?}
    D -->|否| E[返回 SAP_UNAVAILABLE]
    D -->|是| F[重置断路器为 CLOSED]
    C -->|否| F
    F --> G[获取限流许可<br/>sapRateLimiter.acquire]
    G --> H[获取 SAP 凭证]
    H --> I{上次成功凭证?}
    I -->|是| J[优先使用上次成功凭证]
    I -->|否| K[遍历所有凭证组合]
    J --> L[构建 Basic Auth 头<br/>设置 X-Request-ID]
    K --> L
    L --> M[发起 HTTP 请求<br/>含超时控制]
    M --> N{响应成功?}
    N -->|是| O[重置断路器<br/>记录成功凭证]
    O --> P[释放限流许可]
    P --> Q[返回响应数据]
    N -->|否| R[记录失败状态码]
    R --> S{401/403?}
    S -->|是| T{还有凭证可试?}
    T -->|是| L
    T -->|否| U[生成 SAP_AUTH 错误]
    S -->|否| V{可重试?}
    V -->|是 且未超最大重试| W[指数退避等待]
    W --> L
    V -->|否| X[记录断路器失败]
    X --> Y[释放限流许可]
    Y --> Z[抛出错误]
    U --> Y
    E --> Z
```

### 凭证管理策略
- 缓存凭证文件内容（基于修改时间变化检测）
- 优先使用上次成功的凭证组合
- 自动轮询所有可能的用户名/密码组合
- 实现请求超时控制

## 6. 业务服务模块

### 通用业务服务模式

所有业务服务模块（services/ 目录）遵循相同的模式：

1. **参数验证** - 验证输入参数的有效性
2. **URL 构建** - 基于参数构建 SAP OData 查询 URL
3. **SAP 调用** - 通过 sapFetch 函数执行查询
4. **数据处理** - 解析和标准化响应数据
5. **错误处理** - 统一的错误格式化

### 错误处理策略

```mermaid
flowchart TD
    A[开始] --> B[业务服务函数调用]
    B --> C[参数验证]
    C --> D{验证通过?}
    D -->|否| E[返回 INVALID_INPUT 错误]
    D -->|是| F[执行业务逻辑]
    F --> G{执行成功?}
    G -->|否| H[捕获异常]
    H --> I[标准化错误格式]
    I --> J[返回错误响应]
    G -->|是| K[构建成功响应]
    K --> L[返回成功响应]
    E --> M[结束]
    J --> M
    L --> M
```

## 7. 响应格式标准化

### 统一响应结构

所有工具返回相同格式的 JSON 响应：

```json
{
  "schemaVersion": "1.0",
  "tool": "tool-name",
  "ok": true/false,
  "data": {}, // 业务数据
  "warnings": [], // 警告信息
  "error": {} // 错误信息（仅失败时）
}
```

### 响应生成函数

- `toolSuccess()` - 生成成功响应
- `toolFailure()` - 生成失败响应
- `textJson()` - 将响应包装为 MCP 文本内容格式

## 8. 可观测性集成

### 请求包装器（wrapTool）

```mermaid
flowchart TD
    A[开始] --> B[检查服务是否关闭中]
    B --> C[生成 traceId]
    C --> D[createTraceContext<br/>创建追踪上下文]
    D --> E[记录开始时间]
    E --> F[执行工具处理器 handler]
    F --> G{执行成功?}
    G -->|是| H[计算耗时]
    H --> I[metrics.recordRequest<br/>记录请求指标]
    I --> J[metrics.recordSapCall<br/>批量记录 SAP 调用]
    J --> K[返回成功响应]
    G -->|否| L[捕获异常]
    L --> M[metrics.recordRequest<br/>记录失败指标]
    M --> N[返回失败响应]
```

### SAP 调用追踪

```mermaid
flowchart TD
    A[sapDependencies 注入] --> B[createTraceContext<br/>创建追踪上下文]
    B --> C[sapFetch 包装器调用]
    C --> D[记录 SAP 调用开始时间]
    D --> E[执行 sapFetch]
    E --> F{调用成功?}
    F -->|是| G[metrics.recordSapCall<br/>ok=true]
    G --> H[recordSapCall<br/>追加到 traceCtx.sapCalls]
    H --> I[返回 SAP 响应]
    F -->|否| J[metrics.recordSapCall<br/>ok=false]
    J --> K[recordSapCall<br/>记录错误码到 traceCtx]
    K --> L[抛出错误]
```

### 模块结构
- `lib/observability.js` — `generateTraceId`, `createTraceContext`, `recordSapCall`, `MetricsStore`
- `wrapTool()` — MCP 工具请求级别的追踪包装器
- `sapDependencies()` — 注入到业务服务模块的 SAP 调用包装器，负责指标记录和链路追踪

## 9. 运行时上下文

### 上下文隔离
- `createRuntimeContext()` 创建独立的运行时上下文
- 每个实例拥有独立的认证和 SAP 状态
- 支持未来 HTTP/SSE 会话扩展

## 10. 工具注册流程

### MCP 服务器初始化

```mermaid
flowchart TD
    A[开始] --> B[创建 MCP 服务器实例]
    B --> C[初始化运行时上下文]
    C --> D[注册 authenticate 工具]
    D --> E[注册 health_check 工具]
    E --> F[注册业务工具组]
    F --> G[注册调试工具组]
    G --> H[建立 STDIO 传输]
    H --> I[启动服务器]
    I --> J[监听退出信号]
```

### 工具注册模式
- 使用 `server.tool()` 方法注册每个工具
- 每个工具包含名称、描述、参数模式和处理器
- 所有工具处理器通过 `wrapTool()` 包装以获得统一的可观测性