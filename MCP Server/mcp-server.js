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
        res.end(JSON.stringify({ name: NAME, version: VERSION, tools: 8, http: true }));
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
