/**
 * tests/integration/sap-integration.test.js
 * REQ-006: SAP Mock Server 集成测试
 *
 * 启动本地 Mock SAP Server，用真实 HTTP 调用验证服务层。
 */
const assert = require('assert');
const { createSapMockServer } = require('./sap-mock-server');
const { getSalesOrderStatus } = require('../../services/sales-order-status');
const { traceSalesOrder } = require('../../services/sales-order-trace');
const { getCostCenter } = require('../../services/cost-center');
const { getProduct } = require('../../services/product');

// ── 工具：从真实 HTTP 获取数据的 sapFetch ──
function createRealSapFetch(baseUrl) {
    return async (urlPath) => {
        const fullUrl = urlPath.startsWith('http') ? urlPath : `${baseUrl}${urlPath}`;
        const resp = await fetch(fullUrl, {
            headers: { Accept: 'application/json' },
        });
        if (!resp.ok) {
            const body = await resp.text().catch(() => '');
            const err = new Error(`HTTP ${resp.status}`);
            err.code = `SAP_HTTP_${resp.status}`;
            err.sapStatus = resp.status;
            err.message = body || err.message;
            throw err;
        }
        return resp.json();
    };
}

function createRealExtractRows() {
    return (data) => {
        if (data && data.d && Array.isArray(data.d.results)) return data.d.results;
        if (data && Array.isArray(data.value)) return data.value;
        return [];
    };
}

// ════════════════════════════════════════════════════
// REQ-006-03: 通过 Mock Server 调用 getSalesOrderStatus
// ════════════════════════════════════════════════════

async function testGetSalesOrderStatusViaMock(mock) {
    const deps = {
        sapFetch: createRealSapFetch(mock.baseUrl),
        extractRows: createRealExtractRows(),
    };

    const result = await getSalesOrderStatus({ salesOrder: '19', top: 5 }, deps);

    assert.strictEqual(result.found, true);
    assert.strictEqual(result.normalizedSalesOrder, '19');
    assert.strictEqual(result.header.SalesOrderType, 'OR');
    assert.strictEqual(result.items.length, 2);
    assert.strictEqual(result.itemCount, 2);

    // 验证实际发出了 HTTP 请求
    const soRequests = mock.requests.filter(r => r.url.includes('SalesOrder'));
    assert.ok(soRequests.length >= 2, `expected at least 2 SO requests, got ${soRequests.length}`);
}

// ════════════════════════════════════════════════════
// REQ-006-03: 通过 Mock Server 调用 traceSalesOrder
// ════════════════════════════════════════════════════

async function testTraceSalesOrderViaMock(mock) {
    mock.requests = []; // reset for this test
    const deps = {
        sapFetch: createRealSapFetch(mock.baseUrl),
        extractRows: createRealExtractRows(),
    };

    const result = await traceSalesOrder({ salesOrder: '19', top: 5 }, deps);

    if (result.errors.length > 0) {
        console.error('  [trace errors]', JSON.stringify(result.errors));
    }

    assert.strictEqual(result.salesOrder, '19');
    assert.notStrictEqual(result.data.salesOrder, null, 'salesOrder should not be null');
    assert.strictEqual(result.data.salesOrder.SalesOrder, '19');
    assert.strictEqual(result.data.items.length, 2);
    assert.strictEqual(result.data.productionOrders.length, 1);
    assert.strictEqual(result.data.deliveries.length, 1);
    assert.strictEqual(result.data.materialDocuments.length, 1);
    assert.strictEqual(result.data.billingDocuments.length, 1);
    assert.strictEqual(result.errors.length, 0, 'trace should have no errors — ' + JSON.stringify(result.errors));

    // 验证发出了 6 个 HTTP 请求
    assert.strictEqual(mock.requests.length, 6, `expected 6 requests, got ${mock.requests.length}: ${mock.requests.map(r=>r.url.substring(0,60)).join(' | ')}`);
}

// ════════════════════════════════════════════════════
// Cost Center Integration Test
// ════════════════════════════════════════════════════

async function testGetCostCenterViaMock(mock) {
    const deps = {
        sapFetch: createRealSapFetch(mock.baseUrl),
        extractRows: createRealExtractRows(),
    };

    const result = await getCostCenter({ costCenter: '10101001', top: 5 }, deps);

    assert.strictEqual(result.count, 2, 'should return 2 cost centers from mock');
    assert.strictEqual(result.costCenters[0].CostCenter, '10101001');
    assert.strictEqual(result.costCenters[0].CompanyCode, '1010');
    assert.ok(result.costCenters[0].texts.length > 0, 'should include text data');
    assert.strictEqual(result.costCenters[0].texts[0].CostCenterName, '管理部门成本中心');

    // Verify HTTP requests were made
    const ccRequests = mock.requests.filter(r => r.url.includes('A_CostCenter'));
    assert.ok(ccRequests.length >= 2, `expected cost center requests, got ${ccRequests.length}`);
}

// ════════════════════════════════════════════════════
// Product Integration Test
// ════════════════════════════════════════════════════

async function testGetProductViaMock(mock) {
    const deps = {
        sapFetch: createRealSapFetch(mock.baseUrl),
        extractRows: createRealExtractRows(),
    };

    const result = await getProduct({ product: 'MAT001', top: 5 }, deps);

    assert.strictEqual(result.count, 2, 'should return 2 products');
    assert.strictEqual(result.products[0].Product, 'MAT001');
    assert.strictEqual(result.products[0].ProductType, 'FERT');
    assert.ok(result.products[0].descriptions.length > 0);
    assert.strictEqual(result.products[0].descriptions[0].ProductDescription, '成品A');
}

// ════════════════════════════════════════════════════
// REQ-006-04: Mock 错误响应
// ════════════════════════════════════════════════════

async function testErrorHandling(mock) {
    // 对 /_error/401 发起请求，验证返回 401
    const resp = await fetch(`${mock.baseUrl}/_error/401`);
    assert.strictEqual(resp.status, 401);

    const resp500 = await fetch(`${mock.baseUrl}/_error/500`);
    assert.strictEqual(resp500.status, 500);

    // 未注册路由返回 404
    const resp404 = await fetch(`${mock.baseUrl}/nonexistent/path`);
    assert.strictEqual(resp404.status, 404);
}

// ════════════════════════════════════════════════════
// REQ-006-01 & REQ-006-02: Service Document 格式
// ════════════════════════════════════════════════════

async function testServiceDocumentFormats(mock) {
    // 注册一个专门的 V2 service doc 路由用于此测试
    const mockForDoc = new (require('./sap-mock-server').SapMockServer)();

    // V2 Service Document
    mockForDoc.get('$format=json', 200, {
        d: { EntitySets: ['SetA', 'SetB', 'SetC'] },
    });

    // V4 Service Document  
    mockForDoc.on(/\/odata4\/.*\/0001\/?\?sap-client/, (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            value: [
                { url: 'Entity1', kind: 'EntitySet' },
                { url: 'Entity2', kind: 'EntitySet' },
                { url: 'Singleton', kind: 'Singleton' },
            ],
        }));
    });

    await mockForDoc.start();

    try {
        // V2
        const v2Resp = await fetch(`${mockForDoc.baseUrl}/sap/opu/odata/sap/TEST_SRV/?$format=json&sap-client=100`);
        const v2Data = await v2Resp.json();
        assert.deepStrictEqual(v2Data.d.EntitySets, ['SetA', 'SetB', 'SetC']);

        // V4 - 只统计 EntitySet
        const v4Resp = await fetch(`${mockForDoc.baseUrl}/sap/opu/odata4/sap/api_test/srvd_a2x/sap/test/0001/?sap-client=100`);
        const v4Data = await v4Resp.json();
        assert.strictEqual(v4Data.value.length, 3);
        const entitySets = v4Data.value.filter(e => e.kind === 'EntitySet');
        assert.strictEqual(entitySets.length, 2);
    } finally {
        await mockForDoc.stop();
    }
}

// ════════════════════════════════════════════════════
// Runner
// ════════════════════════════════════════════════════

async function run() {
    const mock = await createSapMockServer();

    try {
        console.log(`  [mock] SAP Mock Server started on port ${mock.port}`);

        await testGetSalesOrderStatusViaMock(mock);
        await testTraceSalesOrderViaMock(mock);
        await testGetCostCenterViaMock(mock);
        await testGetProductViaMock(mock);
        await testErrorHandling(mock);
        await testServiceDocumentFormats(mock);

        console.log('  ✅ sap-integration.test.js — all passed');
    } finally {
        await mock.stop();
        console.log('  [mock] SAP Mock Server stopped');
    }
}

module.exports = { run };
