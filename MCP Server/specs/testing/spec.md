# Spec: MCP Server 测试体系建设

## REQ-001: lib/errors.js 单元测试

### REQ-001-01: makeError 基础功能
- **Given**: 传入 code='TEST', message='something wrong'
- **When**: 调用 makeError(code, message)
- **Then**: 返回 { code: 'TEST', message: 'something wrong', retryable: false }

### REQ-001-02: makeError 可选参数
- **Given**: 传入 options={sapStatus:500, retryable:true, details:{raw:'data'}}
- **When**: 调用 makeError(code, message, options)
- **Then**: 返回对象包含 sapStatus=500, retryable=true, details={raw:'data'}

### REQ-001-03: normalizeError 处理 MCP 错误对象
- **Given**: 传入 { code: 'A', message: 'B' }
- **When**: 调用 normalizeError(err)
- **Then**: 返回 { code: 'A', message: 'B' }

### REQ-001-04: normalizeError 处理原生 Error
- **Given**: 传入 new Error('native error')
- **When**: 调用 normalizeError(err)
- **Then**: 返回 { code: 'INTERNAL', message: 'native error' }

### REQ-001-05: normalizeError 处理 null/undefined
- **Given**: 传入 null 或 undefined
- **When**: 调用 normalizeError(err)
- **Then**: 返回 { code: 'INTERNAL', message: 'null' 或 'Unknown error' }

### REQ-001-06: ErrorCodes 完整性
- **Given**: ErrorCodes 常量对象
- **Then**: 包含所有预期错误码且 Object.freeze 生效

---

## REQ-002: lib/mcp-response.js 单元测试

### REQ-002-01: toolSuccess 结构
- **Given**: tool='test', data={x:1}, warnings=['w']
- **Then**: 返回 { schemaVersion:'1.0', tool:'test', ok:true, data:{x:1}, warnings:['w'], error:null }

### REQ-002-02: toolFailure 结构
- **Given**: tool='test', error={code:'E',message:'m'}
- **Then**: 返回 { schemaVersion:'1.0', tool:'test', ok:false, error:{code:'E',message:'m'} }

### REQ-002-03: textJson 包装
- **Given**: payload={a:1}
- **Then**: 返回 { content: [{ type:'text', text: '{\n  "a": 1\n}' }] }

---

## REQ-003: mcp-auth.js 单元测试

### REQ-003-01: createAuthContext 隔离
- **Given**: 创建两个 AuthContext
- **Then**: 互不影响，各自独立

### REQ-003-02: initAuth 读取环境变量
- **Given**: process.env.MCP_API_KEY='test-key'
- **When**: 调用 initAuth(ctx)
- **Then**: ctx.apiKey='test-key'，ctx.authenticated=false

### REQ-003-03: initAuth 无环境变量时自动生成
- **Given**: process.env.MCP_API_KEY 未设置
- **When**: 调用 initAuth(ctx)
- **Then**: ctx.apiKey 为 'mcp-' 前缀的 32 字符随机串

### REQ-003-04: authenticate 成功
- **Given**: ctx.apiKey='k1'，调用 authenticate('k1', ctx)
- **Then**: 返回 { success:true }，ctx.authenticated=true，failedAttempts=0

### REQ-003-05: authenticate 密钥错误
- **Given**: ctx.apiKey='k1'，调用 authenticate('wrong', ctx)
- **Then**: 返回 { success:false, code:'AUTH_INVALID_KEY' }，remainingAttempts=4

### REQ-003-06: authenticate 锁定机制
- **Given**: 连续 5 次错误
- **Then**: 第 6 次返回 { success:false, code:'AUTH_LOCKED', locked:true }

### REQ-003-07: requireAuth 拦截未认证
- **Given**: ctx.authenticated=false
- **When**: 调用 requireAuth(ctx)
- **Then**: 抛出 Error，err.code='AUTH_REQUIRED'

### REQ-003-08: requireAuth 通过已认证
- **Given**: ctx.authenticated=true
- **When**: 调用 requireAuth(ctx)
- **Then**: 不抛出异常

### REQ-003-09: generateNewKey 重置状态
- **Given**: 已认证的 ctx
- **When**: 调用 generateNewKey(ctx)
- **Then**: apiKey 变更，authenticated=false

---

## REQ-004: mcp-sap-core.js 单元测试

### REQ-004-01: isV2 识别
- **Given**: URL 含 /sap/opu/odata/sap/
- **Then**: isV2=true, isV4=false

### REQ-004-02: isV4 识别
- **Given**: URL 含 /sap/opu/odata4/
- **Then**: isV2=false, isV4=true

### REQ-004-03: extractRows V2 格式
- **Given**: { d: { results: [{a:1}] } }
- **Then**: 返回 [{a:1}]

### REQ-004-04: extractRows V4 格式
- **Given**: { value: [{b:2}] }
- **Then**: 返回 [{b:2}]

### REQ-004-05: extractRows 空数据
- **Given**: {} 或 null 或 { d: {} }
- **Then**: 返回 []

### REQ-004-06: buildBasicAuth
- **Given**: user='u', pass='p'
- **Then**: Buffer.from('u:p').toString('base64')

### REQ-004-07: buildQueryPath V2
- **Given**: baseUrl='/sap/opu/odata/sap/SRV', entity='E', filter='F eq 1', top=5
- **Then**: URL 含 $format=json, sap-client, $top=5, $filter

### REQ-004-08: buildQueryPath V4
- **Given**: baseUrl='/sap/opu/odata4/...', entity='E', top=5
- **Then**: URL 不含 $format=json

### REQ-004-09: normalizeScenarioKey
- **Given**: code='SAP_COM_0109', title='Sales Order'
- **Then**: 返回 'sap_com_0109_sales_order'

### REQ-004-10: createSapContext
- **Given**: 调用 createSapContext()
- **Then**: 返回 { lastGoodCred: null }

---

## REQ-005: services/ 单元测试（DI Mock）

### REQ-005-01: validateSalesOrder 合法输入
- **Given**: '0000000019'
- **Then**: 返回 '19'

### REQ-005-02: validateSalesOrder 非法输入
- **Given**: '' 或 'ABC' 或 null
- **Then**: 抛出 INVALID_INPUT 错误

### REQ-005-03: getSalesOrderStatus 正常流程
- **Given**: Mock sapFetch 返回 header + items
- **Then**: found=true, itemCount>0

### REQ-005-04: getSalesOrderStatus 未找到
- **Given**: Mock sapFetch 返回空
- **Then**: found=false, items=[]

### REQ-005-05: traceSalesOrder URL 生成正确
- **Given**: salesOrder='19', top=5
- **Then**: 生成 6 个 URL（SO header + items + 4 trace steps）

### REQ-005-06: traceSalesOrder 部分步骤失败不中断
- **Given**: Mock sapFetch 在某步骤抛出错误
- **Then**: warnings 包含失败信息，其余步骤继续执行

### REQ-005-07: traceSalesOrder exclude 选项
- **Given**: includeProductionOrders=false
- **Then**: 不查询 productionOrders URL

---

## REQ-006: SAP Mock Server（集成测试）

### REQ-006-01: Mock V2 Service Document
- **Given**: GET /sap/opu/odata/sap/MOCK_SRV/?$format=json
- **Then**: 返回 { d: { EntitySets: ['Entity1', 'Entity2'] } }

### REQ-006-02: Mock V4 Service Document
- **Given**: GET /sap/opu/odata4/.../MOCK_SRV/
- **Then**: 返回 { value: [{ url:'Entity', kind:'EntitySet' }] }

### REQ-006-03: Mock 数据查询
- **Given**: GET /sap/opu/odata/sap/MOCK_SRV/Entity?$top=10
- **Then**: 返回 { d: { results: [mock rows] } }

### REQ-006-04: Mock 错误响应
- **Given**: GET /.../_error/401
- **Then**: 返回 HTTP 401

---

## 覆盖率目标

| 模块 | 目标 |
|------|------|
| lib/errors.js | ≥ 95% |
| lib/mcp-response.js | ≥ 95% |
| mcp-auth.js | ≥ 90% |
| mcp-sap-core.js（纯函数部分） | ≥ 90% |
| services/*.js（DI mock） | ≥ 85% |
| 整体 | ≥ 80% |
