/**
 * tests/integration/sap-mock-server.js
 * REQ-006: 本地 SAP OData Mock Server
 *
 * 模拟 SAP S/4HANA OData V2/V4 接口，用于集成测试。
 * 每次测试启动独立实例，用完即停。
 */
const http = require('http');

class SapMockServer {
    constructor() {
        this.server = null;
        this.port = 0;
        this._routes = [];
        // 默认行为：记录所有请求
        this.requests = [];
    }

    /**
     * 注册自定义路由
     * @param {string|RegExp} pattern - URL 匹配模式
     * @param {function} handler - (req, res) => void
     */
    on(pattern, handler) {
        this._routes.push({ pattern, handler });
    }

    /**
     * 便捷方法：注册 GET 路由
     */
    get(pattern, statusCode, body) {
        const handler = (req, res) => {
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(body));
        };
        this._routes.push({ pattern, handler });
    }

    /**
     * 启动服务器
     * @returns {Promise<number>} 分配的端口号
     */
    async start() {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.requests.push({ method: req.method, url: req.url, time: new Date().toISOString() });

                // 匹配自定义路由
                for (const route of this._routes) {
                    if (typeof route.pattern === 'string' && req.url.includes(route.pattern)) {
                        route.handler(req, res);
                        return;
                    }
                    if (route.pattern instanceof RegExp && route.pattern.test(req.url)) {
                        route.handler(req, res);
                        return;
                    }
                }

                // 默认 404
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: `No mock for: ${req.url}` } }));
            });

            this.server.listen(0, '127.0.0.1', () => {
                this.port = this.server.address().port;
                resolve(this.port);
            });

            this.server.on('error', reject);
        });
    }

    /**
     * 停止服务器
     */
    async stop() {
        this.requests = [];
        this._routes = [];
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => resolve());
            } else {
                resolve();
            }
        });
    }

    /**
     * 获取基准 URL
     */
    get baseUrl() {
        return `http://127.0.0.1:${this.port}`;
    }
}

/**
 * 创建预配置的 SAP Mock Server
 * - V2 service document
 * - V4 service document
 * - 数据查询端点
 * - 错误模拟端点
 */
async function createSapMockServer() {
    const mock = new SapMockServer();

    // V2 Service Document（仅匹配 /sap/opu/odata/sap/.../?$format=json，不含 entity 名）
    mock.on(/\/sap\/opu\/odata\/sap\/[^/]*\/?\?\$format=json/, (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            d: {
                EntitySets: ['A_Entity1', 'A_Entity2', 'A_Entity3'],
            },
        }));
    });

    // V2 Entity 查询
    mock.get('A_Entity1', 200, {
        d: {
            results: [
                { Field1: 'value1', Field2: 100 },
                { Field1: 'value2', Field2: 200 },
            ],
        },
    });

    // V4 Service Document（只匹配 /0001/? 或 /0001?sap-client=...，不匹配 /0001/Entity?...）
    mock.on(/\/odata4\/.*\/0001\/?\?(sap-client|$)/, (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            value: [
                { url: 'SalesOrder', kind: 'EntitySet' },
                { url: 'SalesOrderItem', kind: 'EntitySet' },
            ],
        }));
    });

    // V4 SalesOrder 查询（仅匹配 /SalesOrder?，不匹配 /SalesOrderItem?）
    mock.on(/\/SalesOrder\?/, (req, res) => {
        if (req.url.includes('$top=1')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                value: [{ SalesOrder: '19', SalesOrderType: 'OR', OverallSDProcessStatus: 'C' }],
            }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                value: [
                    { SalesOrder: '19', SalesOrderItem: '10', Material: 'MAT001' },
                    { SalesOrder: '19', SalesOrderItem: '20', Material: 'MAT002' },
                ],
            }));
        }
    });

    // V4 SalesOrderItem 查询
    mock.on(/SalesOrderItem\?/, (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            value: [
                { SalesOrder: '19', SalesOrderItem: '10', Material: 'MAT001' },
                { SalesOrder: '19', SalesOrderItem: '20', Material: 'MAT002' },
            ],
        }));
    });

    // V4 Production Order
    mock.on(/api_productionorder/, (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            value: [
                { ProductionOrder: 'PO001', SalesOrder: '19', Material: 'MAT001' },
            ],
        }));
    });

    // V2 Outbound Delivery
    mock.on(/OUTBOUND_DELIVERY/, (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            d: {
                results: [
                    { DeliveryDocument: '80000001', ReferenceSDDocument: '19' },
                ],
            },
        }));
    });

    // V2 Material Document
    mock.on(/MATERIAL_DOCUMENT/, (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            d: {
                results: [
                    { MaterialDocument: '50000001', SalesOrder: '19' },
                ],
            },
        }));
    });

    // V4 Billing Document
    mock.on(/api_billingdocument/, (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            value: [
                { BillingDocument: '90000001', SalesDocument: '19' },
            ],
        }));
    });

    // V2 Material Stock
    mock.on(/MATERIAL_STOCK_SRV/, (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ d: { results: [{ Material: 'MAT001', Plant: '1010', StorageLocation: '0001', MatlWrhsStkQtyInMatlBaseUnit: '500', InventoryStockType: '01' }] } }));
    });

    // V2 Purchase Order
    mock.on(/PURCHASEORDER_PROCESS/, (req, res) => {
        if (req.url.includes('A_PurchaseOrderItem')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ d: { results: [{ PurchaseOrder: '4500000001', PurchaseOrderItem: '10', Material: 'MAT001', OrderQuantity: '100' }] } }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ d: { results: [{ PurchaseOrder: '4500000001', Supplier: '1000001', CompanyCode: '1010', PurchaseOrderType: 'NB' }] } }));
        }
    });

    // V2 Business Partner
    mock.on(/API_BUSINESS_PARTNER/, (req, res) => {
        if (req.url.includes('A_Customer?')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ d: { results: [{ Customer: '1000001', CustomerAccountGroup: 'Z001' }] } }));
        } else if (req.url.includes('A_Supplier?')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ d: { results: [{ Supplier: '5000001', SupplierAccountGroup: 'Z002' }] } }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ d: { results: [
                { BusinessPartner: '1000001', BusinessPartnerFullName: 'Test Corp', BusinessPartnerCategory: '2', Customer: '1000001', Supplier: '5000001' },
                { BusinessPartner: '1000002', BusinessPartnerFullName: 'John Doe', BusinessPartnerCategory: '1', Customer: '', Supplier: '' },
            ] } }));
        }
    });

    // V2 Product Master
    mock.on(/API_PRODUCT_SRV/, (req, res) => {
        if (req.url.includes('A_ProductDescription')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                d: { results: [{ Product: 'MAT001', Language: 'ZH', ProductDescription: '成品A' }] },
            }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                d: {
                    results: [
                        { Product: 'MAT001', ProductType: 'FERT', BaseUnit: 'PC', ProductGroup: 'PG1' },
                        { Product: 'MAT002', ProductType: 'HAWA', BaseUnit: 'KG', ProductGroup: 'PG2' },
                    ],
                },
            }));
        }
    });

    // V4 Cost Center
    mock.on(/api_cost_center/, (req, res) => {
        if (req.url.includes('A_CostCenterText_2')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                value: [{
                    Language: 'ZH',
                    ControllingArea: 'A000',
                    CostCenter: '10101001',
                    ValidityEndDate: '9999-12-31',
                    CostCenterName: '管理部门成本中心',
                    CostCenterDescription: '管理部门成本中心',
                }],
            }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                value: [
                    {
                        ControllingArea: 'A000',
                        CostCenter: '10101001',
                        ValidityEndDate: '9999-12-31',
                        ValidityStartDate: '2025-01-01',
                        CostCenterName: '',
                        CostCenterDescription: '',
                        CompanyCode: '1010',
                        CostCenterCategory: 'L',
                        CostCtrResponsiblePersonName: '管理部',
                        CostCenterCurrency: 'CNY',
                        ProfitCenter: 'PC001',
                    },
                    {
                        ControllingArea: 'A000',
                        CostCenter: '10101002',
                        ValidityEndDate: '9999-12-31',
                        ValidityStartDate: '2025-01-01',
                        CompanyCode: '1010',
                        CostCenterCategory: 'F',
                        CostCtrResponsiblePersonName: '财务部',
                        CostCenterCurrency: 'CNY',
                    },
                ],
            }));
        }
    });

    // 错误模拟: /_error/401
    mock.on('/_error/401', (req, res) => {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: '401', message: 'Unauthorized' } }));
    });

    // 错误模拟: /_error/500
    mock.on('/_error/500', (req, res) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: '500', message: 'Internal Server Error' } }));
    });

    // 错误模拟: /_error/timeout
    mock.on('/_error/timeout', (req, res) => {
        // 30 秒后响应，模拟超时
        setTimeout(() => {
            res.writeHead(200);
            res.end('{}');
        }, 30000);
    });

    await mock.start();
    return mock;
}

module.exports = { SapMockServer, createSapMockServer };
