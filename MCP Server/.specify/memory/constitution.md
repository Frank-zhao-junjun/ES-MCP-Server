# Testing Constitution — SAP S/4HANA MCP Server

## 核心原则

### 1. 零外部测试依赖
- **只用 Node.js 内置模块**（`assert`、`fs`、`http`）
- 不引入 Jest、Mocha、Chai、Sinon 等第三方测试框架
- 原因：减少依赖熵、加快 CI 速度、降低维护成本

### 2. 纯函数优先
- 优先从纯函数开始测试（无副作用、无 I/O）
- I/O 函数通过依赖注入（DI）Mock
- 文件系统操作通过临时目录隔离

### 3. 上下文隔离
- 所有有状态模块必须通过 `create*Context()` 工厂创建隔离实例
- 测试之间不得共享可变状态
- 环境变量在测试中显式 set/restore

### 4. SAP 永不真实调用
- 单元测试：通过 DI 注入 Mock 函数
- 集成测试：使用本地 Mock HTTP Server
- 绝不连接真实 SAP 系统

### 5. 快速反馈
- 全部单元测试 < 5 秒
- 全部集成测试 < 15 秒
- 失败的测试必须给出清晰的断言信息

### 6. 可读性优先
- 测试名称用中文描述（面向业务人员可读）
- 每个 test case 遵循 AAA 模式：Arrange → Act → Assert
- 复杂断言用有意义的变量名

## 禁止事项

- ❌ 测试中调用真实 SAP API
- ❌ 测试间共享可变全局状态
- ❌ 跳过断言（每个 test case 必须有至少一个 assert）
- ❌ 测试依赖执行顺序
