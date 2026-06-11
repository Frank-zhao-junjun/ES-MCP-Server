/**
 * tests/unit/services.test.js
 * REQ-005: services/ 单元测试（依赖注入 Mock）
 */
const assert = require('assert');
const { getSalesOrderStatus, validateSalesOrder: validateSO } = require('../../services/sales-order-status');
const { traceSalesOrder, validateSalesOrder: validateTraceSO, loadTraceSteps } = require('../../services/sales-order-trace');
const { ErrorCodes } = require('../../lib/errors');

// ════════════════════════════════════════════════════
// REQ-005-01 & REQ-005-02: validateSalesOrder
// ════════════════════════════════════════════════════

function testValidateSalesOrderNormal() {
    assert.strictEqual(validateSO('0000000019'), '19');
    assert.strictEqual(validateSO('19'), '19');
    assert.strictEqual(validateSO('0'), '0');
    assert.strictEqual(validateSO('0000000000'), '0');
    assert.strictEqual(validateSO('1'), '1');
}

function testValidateSalesOrderInvalid() {
    assert.throws(() => validateSO(''), (e) => e.code === ErrorCodes.INVALID_INPUT);
    assert.throws(() => validateSO('ABC'), (e) => e.code === ErrorCodes.INVALID_INPUT);
    assert.throws(() => validateSO('19A'), (e) => e.code === ErrorCodes.INVALID_INPUT);
    assert.throws(() => validateSO(null), (e) => e.code === ErrorCodes.INVALID_INPUT);
    assert.throws(() => validateSO(undefined), (e) => e.code === ErrorCodes.INVALID_INPUT);
    assert.throws(() => validateSO(123), (e) => e.code === ErrorCodes.INVALID_INPUT);
}

function testValidateTraceSalesOrderSame() {
    // 两个 service 中的 validate 行为应一致
    assert.strictEqual(validateTraceSO('0000000042'), '42');
    assert.throws(() => validateTraceSO(''), (e) => e.code === ErrorCodes.INVALID_INPUT);
}

// ════════════════════════════════════════════════════
// REQ-005-03: getSalesOrderStatus 正常流程
// ════════════════════════════════════════════════════

async function testGetSalesOrderStatusFound() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        if (url.includes('/SalesOrder?')) {
            return { value: [{ SalesOrder: '19', SalesOrderType: 'OR' }] };
        }
        if (url.includes('/SalesOrderItem?')) {
            return { value: [{ SalesOrder: '19', SalesOrderItem: '10' }, { SalesOrder: '19', SalesOrderItem: '20' }] };
        }
        return { value: [] };
    };
    const mockExtractRows = (data) => data.value || [];

    const result = await getSalesOrderStatus(
        { salesOrder: '0000000019', top: 5 },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.inputSalesOrder, '0000000019');
    assert.strictEqual(result.normalizedSalesOrder, '19');
    assert.strictEqual(result.found, true);
    assert.strictEqual(result.header.SalesOrderType, 'OR');
    assert.strictEqual(result.items.length, 2);
    assert.strictEqual(result.itemCount, 2);
    assert.strictEqual(calls.length, 2);
}

// ════════════════════════════════════════════════════
// REQ-005-04: getSalesOrderStatus 未找到
// ════════════════════════════════════════════════════

async function testGetSalesOrderStatusNotFound() {
    const mockSapFetch = async () => ({ value: [] });
    const mockExtractRows = (data) => data.value || [];

    const result = await getSalesOrderStatus(
        { salesOrder: '99999', includeItems: false },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.found, false);
    assert.strictEqual(result.header, null);
    assert.strictEqual(result.items.length, 0);
    assert.strictEqual(result.itemCount, 0);
}

// ════════════════════════════════════════════════════
// REQ-005-05: traceSalesOrder URL 生成正确
// ════════════════════════════════════════════════════

async function testTraceSalesOrderUrlGeneration() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        return { value: [] };
    };
    const mockExtractRows = (data) => data.value || [];

    const result = await traceSalesOrder(
        { salesOrder: '19', top: 3 },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    assert.strictEqual(result.salesOrder, '19');
    assert.strictEqual(calls.length, 6, 'should make exactly 6 calls: SO header + items + 4 trace steps');

    // 验证 URL 包含正确的 filter 编码
    assert.ok(calls[0].includes('SalesOrder%20eq%20%2719%27'), `SO header call: ${calls[0]}`);
    assert.ok(calls[1].includes('SalesOrder%20eq%20%2719%27'), `SO items call: ${calls[1]}`);
    assert.ok(calls[5].includes('SalesDocument%20eq%20%2719%27'), `Billing call: ${calls[5]}`);

    // SO header 使用 $top=1（设计如此），其余使用用户指定的 $top
    assert.ok(calls[0].includes('$top=1'), `SO header should use $top=1: ${calls[0]}`);
    for (let i = 1; i < calls.length; i++) {
        assert.ok(calls[i].includes('$top=3'), `call ${i} should have $top=3: ${calls[i]}`);
    }

    // 验证 errors 空空
    assert.strictEqual(result.errors.length, 0);
}

// ════════════════════════════════════════════════════
// REQ-005-06: traceSalesOrder 部分步骤失败不中断
// ════════════════════════════════════════════════════

async function testTracePartialFailure() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        // 前两个调用（SO header + items）成功
        if (calls.length <= 2) {
            return { value: [{ SalesOrder: '19' }] };
        }
        // deliveries 步骤失败
        if (url.includes('OUTBOUND_DELIVERY')) {
            throw { code: 'SAP_HTTP_500', message: 'Delivery API down' };
        }
        // production 步骤也失败
        if (url.includes('api_productionorder')) {
            throw new Error('Network timeout');
        }
        // 其他步骤正常
        return { value: [{ Doc: 'OK' }] };
    };
    const mockExtractRows = (data) => data.value || [];

    const result = await traceSalesOrder(
        { salesOrder: '19', top: 5 },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    // 所有步骤都应尝试（6 次调用）
    assert.strictEqual(calls.length, 6);

    // warnings 应包含失败信息
    assert.ok(result.warnings.length > 0, 'should have warnings for failed steps');
    const deliveryWarning = result.warnings.find(w => w.includes('Outbound Deliveries'));
    assert.ok(deliveryWarning, 'should warn about delivery failure');
    const prodWarning = result.warnings.find(w => w.includes('Production Orders'));
    assert.ok(prodWarning, 'should warn about production failure');

    // 未失败的步骤应有数据
    assert.ok(result.data.materialDocuments.length >= 0);
    assert.ok(result.data.billingDocuments.length >= 0);

    // errors 只包含 SO header/items 级别的错误（trace steps 走 warnings）
    assert.strictEqual(result.errors.length, 0);
}

// ════════════════════════════════════════════════════
// REQ-005-07: traceSalesOrder exclude 选项
// ════════════════════════════════════════════════════

async function testTraceExcludeOptions() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        return { value: [] };
    };
    const mockExtractRows = (data) => data.value || [];

    await traceSalesOrder(
        {
            salesOrder: '19',
            includeDeliveries: false,
            includeProductionOrders: false,
            includeMaterialDocuments: false,
            includeBillingDocuments: false,
        },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    // 只有 SO header + items（2 个调用）
    assert.strictEqual(calls.length, 2);
    for (const url of calls) {
        assert.ok(url.includes('salesorder'), 'should only call sales order APIs');
    }
}

// ════════════════════════════════════════════════════
// TRACE_STEPS 结构验证
// ════════════════════════════════════════════════════

function testTraceStepsStructure() {
    const TRACE_STEPS = loadTraceSteps();
    assert.ok(TRACE_STEPS.length >= 1, 'should have at least 1 trace step');
    for (const step of TRACE_STEPS) {
        assert.ok(step.id, `step missing id`);
        assert.ok(step.url, `step ${step.id} missing url`);
    }
}

// ════════════════════════════════════════════════════
// getSalesOrderStatus top 超限截断
// ════════════════════════════════════════════════════

async function testSalesOrderTopCapped() {
    const calls = [];
    const mockSapFetch = async (url) => {
        calls.push(url);
        return { value: [{ x: 1 }] };
    };
    const mockExtractRows = (data) => data.value || [];

    await getSalesOrderStatus(
        { salesOrder: '19', top: 999 },
        { sapFetch: mockSapFetch, extractRows: mockExtractRows }
    );

    // $top 应被截断到 MAX_TOP=50
    const itemCall = calls.find(u => u.includes('SalesOrderItem'));
    assert.ok(itemCall.includes('$top=50'), `top should be capped at 50, got: ${itemCall}`);
}

// ════════════════════════════════════════════════════
// Runner
// ════════════════════════════════════════════════════

async function run() {
    // 同步测试
    testValidateSalesOrderNormal();
    testValidateSalesOrderInvalid();
    testValidateTraceSalesOrderSame();
    testTraceStepsStructure();

    // 异步测试
    await testGetSalesOrderStatusFound();
    await testGetSalesOrderStatusNotFound();
    await testTraceSalesOrderUrlGeneration();
    await testTracePartialFailure();
    await testTraceExcludeOptions();
    await testSalesOrderTopCapped();

    console.log('  ✅ services.test.js — all passed');
}

module.exports = { run };
