#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const http = require('http');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const crypto = require('crypto');
const { z } = require('zod');

const { config } = require('./mcp-sap-core');
const {
  healthCheck,
  getProduct,
  getBusinessPartner,
  getSalesOrderStatus,
  getPurchaseOrder,
  getMaterialStock,
  getSupplierInvoice,
  getCostCenter,
  getEntitySchema,
  listSapScenarios,
  querySapScenario,
  traceSalesOrder,
  authenticate,
  getPurchaseRequisition,
  getScheduleAgreement,
  getSalesContract,
  getBom,
  getMaterialReservation,
  getSupplierInvoiceV4,
  getMasterData,
} = require('./lib/tools');

const VERSION = '0.1.0';
const NAME = 'sap-s4-mcp';

function log(...args) {
  console.error(`[${NAME}]`, ...args);
}

const server = new McpServer(
  {
    name: NAME,
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ---------- Tool schemas and handlers ----------

server.tool(
  'health_check',
  'Health check for the MCP server and optional SAP connectivity probe.',
  {
    includeSapCheck: z.boolean().optional().describe('Whether to probe SAP connectivity'),
    includeScenarios: z.boolean().optional().describe('Whether to include scenario count'),
  },
  healthCheck
);

server.tool(
  'get_product',
  'Query SAP product master data via OData V2 API_PRODUCT_SRV/A_Product.',
  {
    product: z.string().optional().describe('Single product number to fetch'),
    filter: z.string().optional().describe('OData $filter expression'),
    top: z.number().int().min(1).max(1000).optional().describe('Maximum rows to return'),
  },
  getProduct
);

server.tool(
  'get_business_partner',
  'Query SAP customer or supplier master data.',
  {
    customer: z.string().optional().describe('Customer number to fetch'),
    supplier: z.string().optional().describe('Supplier number to fetch'),
    filter: z.string().optional().describe('OData $filter expression'),
    top: z.number().int().min(1).max(1000).optional().describe('Maximum rows to return'),
  },
  getBusinessPartner
);

server.tool(
  'get_sales_order_status',
  'Query SAP sales order status (V4), optionally with line items.',
  {
    salesOrder: z.string().optional().describe('Sales order number'),
    includeItems: z.boolean().optional().describe('Include sales order line items'),
    top: z.number().int().min(1).max(1000).optional().describe('Maximum rows to return when listing'),
  },
  getSalesOrderStatus
);

server.tool(
  'get_purchase_order',
  'Query SAP purchase order header and optional sub-entities (V4 api_purchaseorder_2).',
  {
    purchaseOrder: z.string().optional().describe('Purchase order number'),
    includeItems: z.boolean().optional().describe('Include purchase order items'),
    includeSchedule: z.boolean().optional().describe('Include schedule lines'),
    includePricing: z.boolean().optional().describe('Include pricing elements'),
    includeNotes: z.boolean().optional().describe('Include header notes'),
    top: z.number().int().min(1).max(1000).optional().describe('Maximum rows to return when listing'),
  },
  getPurchaseOrder
);

server.tool(
  'get_material_stock',
  'Query SAP material stock (V2 API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod).',
  {
    material: z.string().optional().describe('Material number'),
    plant: z.string().optional().describe('Plant code'),
    filter: z.string().optional().describe('OData $filter expression'),
    top: z.number().int().min(1).max(1000).optional().describe('Maximum rows to return'),
  },
  getMaterialStock
);

server.tool(
  'get_supplier_invoice',
  'Query SAP supplier invoice header and optional PO reference lines (V2 legacy).',
  {
    invoice: z.string().optional().describe('Supplier invoice number'),
    fiscalYear: z.string().optional().describe('Fiscal year of the invoice'),
    includeLines: z.boolean().optional().describe('Include PO reference lines'),
  },
  getSupplierInvoice
);

server.tool(
  'get_cost_center',
  'Query SAP cost center master data (V4 api_cost_center/A_CostCenter_2).',
  {
    costCenter: z.string().optional().describe('Cost center number'),
    companyCode: z.string().optional().describe('Company code'),
    filter: z.string().optional().describe('OData $filter expression'),
    top: z.number().int().min(1).max(1000).optional().describe('Maximum rows to return'),
  },
  getCostCenter
);

server.tool(
  'get_entity_schema',
  'Parse SAP $metadata for a service and entity to list available fields.',
  {
    service: z.string().describe('Service name or full service path, e.g. API_PRODUCT_SRV or /sap/opu/odata/sap/API_PRODUCT_SRV'),
    entity: z.string().describe('Entity type name, e.g. A_Product'),
  },
  getEntitySchema
);

server.tool(
  'list_sap_scenarios',
  'List all built-in SAP scenario/endpoint keys from the probe registry.',
  {},
  listSapScenarios
);

server.tool(
  'query_sap_scenario',
  'Execute a dynamic GET for a scenario key from list_sap_scenarios.',
  {
    key: z.string().describe('Scenario key, e.g. sales_order_v4'),
    filter: z.string().optional().describe('OData $filter expression'),
    top: z.number().int().min(1).max(1000).optional().describe('Maximum rows'),
    entity: z.string().optional().describe('Override entity segment in the scenario path'),
  },
  querySapScenario
);

server.tool(
  'trace_sales_order',
  'Best-effort trace a sales order through outbound delivery, billing, and material document.',
  {
    salesOrder: z.string().describe('Sales order number'),
  },
  traceSalesOrder
);

server.tool(
  'authenticate',
  'Validate the configured MCP API key.',
  {
    apiKey: z.string().describe('API key to validate'),
  },
  authenticate
);

// ---------- Phase 3 — Blocked / arrangement-dependent tools ----------

server.tool(
  'get_purchase_requisition',
  'Query SAP purchase requisition (V4, requires SAP_COM_0102). Returns 403 hint if arrangement not opened.',
  {
    purchaseRequisition: z.string().optional().describe('Purchase requisition number'),
    includeItems: z.boolean().optional().describe('Include line items'),
    filter: z.string().optional().describe('OData $filter expression'),
    top: z.number().int().min(1).max(1000).optional().describe('Maximum rows to return'),
  },
  getPurchaseRequisition
);

server.tool(
  'get_schedule_agreement',
  'Query SAP scheduling agreement (V4, requires SAP_COM_0103). Returns 403 hint if arrangement not opened.',
  {
    schedulingAgreement: z.string().optional().describe('Scheduling agreement number'),
    includeItems: z.boolean().optional().describe('Include line items'),
    filter: z.string().optional().describe('OData $filter expression'),
    top: z.number().int().min(1).max(1000).optional().describe('Maximum rows to return'),
  },
  getScheduleAgreement
);

server.tool(
  'get_sales_contract',
  'Query SAP sales contract (V4, requires SAP_COM_0119). Returns 403 hint if arrangement not opened.',
  {
    salesContract: z.string().optional().describe('Sales contract number'),
    includeItems: z.boolean().optional().describe('Include line items'),
    filter: z.string().optional().describe('OData $filter expression'),
    top: z.number().int().min(1).max(1000).optional().describe('Maximum rows to return'),
  },
  getSalesContract
);

server.tool(
  'get_bom',
  'Query SAP bill of material (V2 API_BILL_OF_MATERIAL_SRV). Returns 403 hint if arrangement not opened.',
  {
    billOfMaterial: z.string().optional().describe('BOM number for single header'),
    material: z.string().optional().describe('Material number to filter BOM items'),
    plant: z.string().optional().describe('Plant code to filter BOM items'),
    filter: z.string().optional().describe('OData $filter expression'),
    top: z.number().int().min(1).max(1000).optional().describe('Maximum rows to return'),
  },
  getBom
);

server.tool(
  'get_material_reservation',
  'Query SAP material reservation (V4). Returns 403 hint if arrangement not opened.',
  {
    reservation: z.string().optional().describe('Reservation document number'),
    material: z.string().optional().describe('Material number filter'),
    plant: z.string().optional().describe('Plant code filter'),
    filter: z.string().optional().describe('OData $filter expression'),
    top: z.number().int().min(1).max(1000).optional().describe('Maximum rows to return'),
  },
  getMaterialReservation
);

server.tool(
  'get_supplier_invoice_v4',
  'Query SAP supplier invoice via V4 API (requires SAP_COM_0054). Returns 403 hint if arrangement not opened.',
  {
    invoice: z.string().optional().describe('Supplier invoice number'),
    fiscalYear: z.string().optional().describe('Fiscal year'),
    includeLines: z.boolean().optional().describe('Include PO reference lines'),
    includeTax: z.boolean().optional().describe('Include tax items'),
    filter: z.string().optional().describe('OData $filter expression'),
    top: z.number().int().min(1).max(1000).optional().describe('Maximum rows to return'),
  },
  getSupplierInvoiceV4
);

server.tool(
  'get_master_data',
  'Query SAP master data (V4, requires SAP_COM_0087). Supports: plant, payment_terms, purchasing_organization, purchasing_group, company_code, storage_location.',
  {
    type: z.string().describe('Master data type: plant | payment_terms | purchasing_organization | purchasing_group | company_code | storage_location'),
    key: z.string().optional().describe('Single record key to fetch'),
    filter: z.string().optional().describe('OData $filter expression'),
    top: z.number().int().min(1).max(1000).optional().describe('Maximum rows to return'),
  },
  getMasterData
);

// ---------- Transport selection ----------

async function main() {
  log(`SAP credentials file: ${config.credentialsFile}`);

  const useStdio = process.argv.includes('--stdio');
  if (useStdio) {
    config.enableHttp = false;
  }

  if (config.enableHttp) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
    });

    await server.connect(transport);

    const httpServer = http.createServer(async (req, res) => {
      // API key gate for HTTP mode
      if (config.requireApiKey) {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (token !== config.apiKey) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'UNAUTHORIZED', message: 'Invalid or missing API key' }));
          return;
        }
      }

      if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ name: NAME, version: VERSION, tools: 20, http: true }));
        return;
      }

      if (req.url === '/mcp') {
        await transport.handleRequest(req, res);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'NOT_FOUND' }));
    });

    httpServer.listen(config.mcpPort, config.mcpBindAddress, () => {
      log(`MCP Server started via HTTP on http://${config.mcpBindAddress}:${config.mcpPort}`);
      log(`MCP endpoint: http://${config.mcpBindAddress}:${config.mcpPort}/mcp`);
      log('Ready for Agent connections');
    });

    httpServer.on('error', (err) => {
      log('HTTP server error:', err.message);
      process.exit(1);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log(`MCP Server started via stdio`);
    log('Ready for Agent connections');
  }
}

main().catch((err) => {
  log('Fatal error:', err.message);
  process.exit(1);
});
