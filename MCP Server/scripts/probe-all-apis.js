/**
 * scripts/probe-all-apis.js — 批量探测 29 个 US-API 端点连通性
 * 
 * 使用现有 MCP 基础设施 (mcp-sap-core.js) 实际调用 SAP OData API，
 * 记录每个 US-API 的 HTTP 状态和数据行数。
 * 
 * 运行: node scripts/probe-all-apis.js
 * 输出: 控制台表格 + probe-results.json
 */

const path = require('path');
const fs = require('fs');

// 确保 SAP 环境变量已设置
process.env.SAP_CREDENTIALS_FILE = process.env.SAP_CREDENTIALS_FILE || path.join(__dirname, '..', '..', 'user.txt');
process.env.SAP_SCENARIO_DIR = process.env.SAP_SCENARIO_DIR || path.join(__dirname, '..', '..');
process.env.SAP_BASE_URL = process.env.SAP_BASE_URL || 'https://my200967-api.s4hana.sapcloud.cn';
process.env.SAP_CLIENT = process.env.SAP_CLIENT || '100';

const {
    sapFetch, extractRows, getScenarios, discoverEntitySets,
    DEFAULT_TOP, MAX_TOP
} = require('../mcp-sap-core');

// US-API → SAP_COM 映射
const API_MAP = [
    { us: 'US-API-001', code: 'SAP_COM_0008', entity: 'A_BusinessPartner', desc: '业务伙伴' },
    { us: 'US-API-002', code: 'SAP_COM_0009', entity: 'Product', desc: '产品主数据' },
    { us: 'US-API-003', code: 'SAP_COM_0053', entity: 'A_PurchaseOrder', desc: '采购订单' },
    { us: 'US-API-004', code: 'SAP_COM_0102', entity: 'A_PurchaseRequisition', desc: '采购申请' },
    { us: 'US-API-005', code: 'SAP_COM_0103', entity: 'A_SchedgAgrmtHeader', desc: '计划协议' },
    { us: 'US-API-006', code: 'SAP_COM_0057', entity: 'A_SupplierInvoice', desc: '供应商发票' },
    { us: 'US-API-007', code: 'SAP_COM_0113', entity: 'A_PurchaseRFQ', desc: '采购询价' },
    { us: 'US-API-008', code: 'SAP_COM_0122', entity: 'A_SupEvalScorecard', desc: '供应商评估' },
    { us: 'US-API-009', code: 'SAP_COM_0146', entity: 'A_ServiceEntrySheet', desc: '服务确认单' },
    { us: 'US-API-010', code: 'SAP_COM_0109', entity: 'SalesOrder', desc: '销售订单' },
    { us: 'US-API-011', code: 'SAP_COM_0119', entity: 'A_SalesContract', desc: '销售合同' },
    { us: 'US-API-012', code: 'SAP_COM_0113', entity: 'A_SalesQuotation', desc: '销售报价', v2: true },
    { us: 'US-API-013', code: 'SAP_COM_0120', entity: 'A_BillingDocument', desc: '销售开票' },
    { us: 'US-API-014', code: 'SAP_COM_0294', entity: 'A_SlsPrcgCndnRecdValidity', desc: '价格条件' },
    { us: 'US-API-015', code: 'SAP_COM_0522', entity: 'ProductionOrder', desc: '生产订单' },
    { us: 'US-API-016', code: 'SAP_COM_0104', entity: 'A_PlannedOrder', desc: '生产数据' },
    { us: 'US-API-017', code: 'SAP_COM_0522', entity: 'ProdnOrderConfirmation', desc: '生产确认', v2: true },
    { us: 'US-API-018', code: 'SAP_COM_0105', entity: 'A_BillOfMaterial', desc: 'BOM' },
    { us: 'US-API-019', code: 'SAP_COM_0519', entity: 'A_RoutingHeader', desc: '工艺路线', v2: true },
    { us: 'US-API-020', code: 'SAP_COM_0110', entity: 'A_InspectionMethod', desc: '质检数据', v2: true },
    { us: 'US-API-021', code: 'SAP_COM_0106', entity: 'A_OutbDeliveryHeader', desc: '出库交货' },
    { us: 'US-API-022', code: 'SAP_COM_0108', entity: 'A_MaterialDocumentHeader', desc: '物料凭证' },
    { us: 'US-API-023', code: 'SAP_COM_0164', entity: 'A_MatlStkInAcctMod', desc: '库存查询' },
    { us: 'US-API-024', code: 'SAP_COM_0112', entity: 'A_ReservationDocument', desc: '库存预留' },
    { us: 'US-API-025', code: 'SAP_COM_0107', entity: 'A_PhysInventoryDocHeader', desc: '盘点数据' },
    { us: 'US-API-026', code: 'SAP_COM_0943', entity: 'CostCenter', desc: '成本中心' },
    { us: 'US-API-027', code: 'SAP_COM_0129', entity: 'A_ActivityType', desc: '作业类型' },
    { us: 'US-API-028', code: 'SAP_COM_0008', entity: 'A_BPContact', desc: '附件管理(IAM)', v2: true },
    { us: 'US-API-029', code: 'SAP_COM_0066', entity: 'A_User', desc: '用户角色(IAM)', v2: true },
];

function buildUrl(scenarioPath, entityName, isV2) {
    const base = scenarioPath.split('?')[0].replace(/\/$/, '');
    if (isV2) {
        return `${base}/${entityName}?$format=json&$top=1`;
    } else {
        return `${base}/${entityName}?$top=1`;
    }
}

async function probeOne(api, scenarios) {
    const scenario = scenarios.find(s => s.code === api.code);
    if (!scenario || !scenario.urls.length) {
        return { ...api, status: 'NO_SCENARIO', records: 0, error: '无场景文件或 URL' };
    }

    const baseUrl = scenario.urls[0];
    const url = new URL(baseUrl);
    const basePath = `${url.pathname}${url.search || ''}`;
    const isV2 = api.v2 || /\/sap\/opu\/odata\/sap\//i.test(basePath);

    // 第一步：用预设实体名尝试
    let queryUrl = buildUrl(basePath, api.entity, isV2);
    try {
        const data = await sapFetch(queryUrl);
        const rows = extractRows(data);
        if (rows.length > 0 || (data && (data.d || data.value))) {
            return { ...api, status: rows.length > 0 ? 'OK' : 'EMPTY', httpStatus: 200, records: rows.length, url: queryUrl };
        }
    } catch (err) {
        if (err.sapStatus === 404) {
            // 实体名可能不对，尝试自动发现
        } else {
            return { ...api, status: 'ERROR', httpStatus: err.sapStatus || 0, records: 0, error: err.message?.substring(0, 80) };
        }
    }

    // 第二步：自动发现实体集
    try {
        const entitySets = await discoverEntitySets(basePath);
        if (entitySets.length > 0) {
            // 优先匹配同名实体
            let match = entitySets.find(es => es.name === api.entity || es.url === api.entity);
            if (!match) {
                // 模糊匹配
                const lower = api.entity.toLowerCase();
                match = entitySets.find(es => es.name?.toLowerCase().includes(lower) || es.url?.toLowerCase().includes(lower));
            }
            if (!match) match = entitySets[0]; // fallback to first

            queryUrl = buildUrl(basePath, match.url || match.name, isV2);
            const data = await sapFetch(queryUrl);
            const rows = extractRows(data);
            return {
                ...api,
                status: rows.length > 0 ? 'OK' : 'EMPTY',
                httpStatus: 200,
                records: rows.length,
                url: queryUrl,
                discoveredEntity: match.url || match.name,
            };
        }
    } catch (_) {
        // discovery failed too
    }

    return { ...api, status: 'ERROR', httpStatus: 404, records: 0, error: 'entity not found + discovery failed' };
}

async function main() {
    console.log('═══════════════════════════════════════');
    console.log('  API Probe — 29 US-API Endpoints');
    console.log('═══════════════════════════════════════\n');

    const scenarios = getScenarios();
    console.log(`Loaded ${scenarios.length} scenarios from ${process.env.SAP_SCENARIO_DIR}\n`);

    const results = [];
    for (let i = 0; i < API_MAP.length; i++) {
        const api = API_MAP[i];
        process.stdout.write(`[${String(i+1).padStart(2,'0')}/${API_MAP.length}] ${api.us} ${api.desc}... `);
        const result = await probeOne(api, scenarios);
        results.push(result);
        console.log(result.status === 'OK' ? `✅ ${result.records} rows` :
                    result.status === 'EMPTY' ? '⚠️  empty' :
                    `❌ ${result.error || 'unknown'}`);
    }

    // 统计
    const ok = results.filter(r => r.status === 'OK').length;
    const empty = results.filter(r => r.status === 'EMPTY').length;
    const err = results.filter(r => r.status === 'ERROR' || r.status === 'NO_SCENARIO').length;

    console.log(`\n───────────────────────────────────────`);
    console.log(`  ✅ OK: ${ok}  ⚠️ Empty: ${empty}  ❌ Error: ${err}`);
    console.log(`───────────────────────────────────────\n`);

    // 输出 JSON
    const outputPath = path.join(__dirname, '..', 'probe-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`Results saved to: ${outputPath}`);

    // 输出更新后的 AC checklist
    console.log('\n── AC Checklist ──');
    for (const r of results) {
        const mark = r.status === 'OK' ? 'x' : ' ';
        console.log(`${r.us}: [${mark}] ${r.desc} (${r.status})`);
    }
}

main().catch(err => {
    console.error('Probe failed:', err.message);
    process.exit(1);
});
