/**
 * test-trace.js — 直接测试 trace_sales_order 链路
 * 绕过 MCP 协议，直接调用 core 模块验证 SAP 查询
 * 
 * 用法: node test-trace.js [salesOrder]
 */

const { sapFetch, extractRows, makeError } = require('./mcp-sap-core');

const salesOrder = process.argv[2] || '19';
const soNormalized = salesOrder.replace(/^0+/, '') || '0';
const top = 10;

function timeStamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function log(step, msg) {
    console.error(`[${timeStamp()}] [${step}] ${msg}`);
}

function printSection(title, rows, maxKeys = 20) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${title}  (${rows ? rows.length : 0} records)`);
    console.log(`${'='.repeat(60)}`);
    if (!rows || rows.length === 0) {
        console.log('  (无记录)');
        return;
    }
    rows.forEach((row, i) => {
        console.log(`\n  --- 记录 ${i + 1} ---`);
        const keys = Object.keys(row).filter(k => 
            k !== '@odata.etag' && k !== 'SAP__Messages' && k !== '__metadata' &&
            row[k] !== null && row[k] !== '' && typeof row[k] !== 'object'
        );
        keys.slice(0, maxKeys).forEach(k => {
            const v = typeof row[k] === 'string' && row[k].length > 60 ? row[k].substring(0, 57) + '...' : row[k];
            console.log(`    ${k} = ${v}`);
        });
        if (keys.length > maxKeys) {
            console.log(`    ... 还有 ${keys.length - maxKeys} 个字段`);
        }
    });
}

async function main() {
    console.log(`\n🔍 测试 trace_sales_order("${salesOrder}")`);
    console.log('═'.repeat(60));

    // Step 1: Sales Order Header
    log('SO', '查询销售订单...');
    try {
        const soUrl = `/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrder?$top=1&$filter=SalesOrder%20eq%20%27${soNormalized}%27`;
        const data = await sapFetch(soUrl);
        const rows = extractRows(data);
        log('SO', `完成: ${rows.length} 条`);
        printSection('📋 销售订单抬头', rows);
    } catch (err) {
        log('SO', `❌ 失败: ${err.code} - ${err.message}`);
    }

    // Step 2: Sales Order Items
    log('ITEM', '查询行项目...');
    try {
        const itemUrl = `/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrderItem?$top=${top}&$filter=SalesOrder%20eq%20%27${soNormalized}%27`;
        const data = await sapFetch(itemUrl);
        const rows = extractRows(data);
        log('ITEM', `完成: ${rows.length} 条`);
        printSection('📋 行项目', rows);
    } catch (err) {
        log('ITEM', `❌ 失败: ${err.code} - ${err.message}`);
    }

    // Step 3: Production Orders
    log('PROD', '查询生产工单...');
    try {
        const poUrl = `/sap/opu/odata4/sap/api_productionorder/srvd_a2x/sap/productionorder/0001/ProductionOrder?$top=${top}&$filter=SalesOrder%20eq%20%27${soNormalized}%27`;
        const data = await sapFetch(poUrl);
        const rows = extractRows(data);
        log('PROD', `完成: ${rows.length} 条`);
        printSection('🏭 生产工单', rows, 30);
    } catch (err) {
        log('PROD', `❌ 失败: ${err.code} - ${err.message}`);
    }

    // Step 4: Outbound Deliveries
    log('DLV', '查询出库交货...');
    try {
        const dlvUrl = `/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002/A_OutbDeliveryItem?$format=json&$top=${top}&$filter=ReferenceSDDocument%20eq%20%27${soNormalized}%27%20and%20ReferenceSDDocumentCategory%20eq%20%27C%27`;
        const data = await sapFetch(dlvUrl);
        const rows = extractRows(data);
        log('DLV', `完成: ${rows.length} 条`);
        printSection('🚚 出库交货行项目', rows, 30);
    } catch (err) {
        log('DLV', `❌ 失败: ${err.code} - ${err.message}`);
    }

    // Step 5: Material Documents
    log('MAT', '查询物料凭证...');
    try {
        const matUrl = `/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/A_MaterialDocumentItem?$format=json&$top=${top}&$filter=SalesOrder%20eq%20%27${soNormalized}%27`;
        const data = await sapFetch(matUrl);
        const rows = extractRows(data);
        log('MAT', `完成: ${rows.length} 条`);
        printSection('📦 物料凭证', rows, 30);
    } catch (err) {
        log('MAT', `❌ 失败: ${err.code} - ${err.message}`);
    }

    // Step 6: Billing Documents
    log('BILL', '查询开票单据...');
    try {
        const billUrl = `/sap/opu/odata4/sap/api_billingdocument/srvd_a2x/sap/billingdocument/0001/BillingDocumentItem?$top=${top}&$filter=SalesDocument%20eq%20%27${soNormalized}%27`;
        const data = await sapFetch(billUrl);
        const rows = extractRows(data);
        log('BILL', `完成: ${rows.length} 条`);
        printSection('💰 开票行项目', rows, 30);
    } catch (err) {
        log('BILL', `❌ 失败: ${err.code} - ${err.message}`);
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log('✅ 测试完成');
}

main().catch(err => {
    console.error('测试异常:', err);
    process.exit(1);
});
