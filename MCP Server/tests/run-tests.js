/**
 * tests/run-tests.js — MCP Server 测试入口
 * 运行方式: npm test 或 node tests/run-tests.js
 */
const assert = require('assert');
const libErrors = require('./unit/lib-errors.test');
const libResponse = require('./unit/lib-mcp-response.test');
const observability = require('./unit/observability.test');
const mcpAuth = require('./unit/mcp-auth.test');
const mcpAuthV2 = require('./unit/mcp-auth-v2.test');
const mcpSapCore = require('./unit/mcp-sap-core.test');
const sapCache = require('./unit/sap-cache.test');
const autoPagination = require('./unit/auto-pagination.test');
const metricsServer = require('./unit/metrics-server.test');
const rateLimiter = require('./unit/rate-limiter.test');
const roles = require('./unit/roles.test');
const dynamicLoader = require('./unit/dynamic-loader.test');
const pluginLoader = require('./unit/plugin-loader.test');
const services = require('./unit/services.test');
const costCenter = require('./unit/cost-center.test');
const product = require('./unit/product.test');
const businessPartner = require('./unit/business-partner.test');
const purchaseOrder = require('./unit/purchase-order.test');
const materialStock = require('./unit/material-stock.test');
const bom = require('./unit/bom.test');
const supplierInvoice = require('./unit/supplier-invoice.test');
const entitySchema = require('./unit/entity-schema.test');
const purchaseRequisition = require('./unit/purchase-requisition.test');
const scheduleAgreement = require('./unit/schedule-agreement.test');
const salesContract = require('./unit/sales-contract.test');
const materialReservation = require('./unit/material-reservation.test');
const purchaseRfq = require('./unit/purchase-rfq.test');
const supplierEvaluation = require('./unit/supplier-evaluation.test');
const serviceEntrySheet = require('./unit/service-entry-sheet.test');
const salesQuotation = require('./unit/sales-quotation.test');
const salesPricingCondition = require('./unit/sales-pricing-condition.test');
const productionData = require('./unit/production-data.test');
const productionOrderConfirmation = require('./unit/production-order-confirmation.test');
const routing = require('./unit/routing.test');
const inspectionData = require('./unit/inspection-data.test');
const physicalInventory = require('./unit/physical-inventory.test');
const activityType = require('./unit/activity-type.test');
const attachment = require('./unit/attachment.test');
const iamUserRole = require('./unit/iam-user-role.test');
const sapIntegration = require('./integration/sap-integration.test');

async function main() {
    const start = Date.now();
    console.log('═══════════════════════════════════════');
    console.log('  SAP MCP Server — Test Suite');
    console.log('═══════════════════════════════════════');
    console.log('');

    // ── Unit Tests ──
    console.log('── Unit Tests ──');
    libErrors.run();
    libResponse.run();
    observability.run();
    mcpAuth.run();
    mcpAuthV2.run();
    mcpSapCore.run();
    sapCache.run();
    await autoPagination.run();
    await metricsServer.run();
    await rateLimiter.run();
    await roles.run();
    dynamicLoader.run();
    await pluginLoader.run();
    await services.run();
    await costCenter.run();
    await product.run();
    await businessPartner.run();
    await purchaseOrder.run();
    await materialStock.run();
    await bom.run();
    await supplierInvoice.run();
    entitySchema.run();
    await purchaseRequisition.run();
    await scheduleAgreement.run();
    await salesContract.run();
    await materialReservation.run();
    await purchaseRfq.run();
    await supplierEvaluation.run();
    await serviceEntrySheet.run();
    await salesQuotation.run();
    await salesPricingCondition.run();
    await productionData.run();
    await productionOrderConfirmation.run();
    await routing.run();
    await inspectionData.run();
    await physicalInventory.run();
    await activityType.run();
    await attachment.run();
    await iamUserRole.run();
    console.log('');

    // ── Integration Tests ──
    console.log('── Integration Tests ──');
    await sapIntegration.run();
    console.log('');

    const elapsed = Date.now() - start;
    console.log('═══════════════════════════════════════');
    console.log(`  ✅ All tests passed (${elapsed}ms)`);
    console.log('═══════════════════════════════════════');
}

main().catch(err => {
    console.error('\n❌ TEST FAILURE:', err.message);
    console.error(err.stack);
    process.exit(1);
});
