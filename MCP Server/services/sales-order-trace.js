const fs = require('fs');
const path = require('path');
const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 50;
const SAP_CLIENT = '100';

let cachedTraceSteps = null;
let cachedTraceStepsMtime = 0;

function loadTraceSteps() {
    const configPath = path.join(__dirname, '..', 'config', 'trace-config.json');
    try {
        const stat = fs.statSync(configPath);
        if (cachedTraceSteps && stat.mtimeMs === cachedTraceStepsMtime) {
            return cachedTraceSteps;
        }
        const raw = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(raw);
        cachedTraceSteps = config.steps || [];
        cachedTraceStepsMtime = stat.mtimeMs;
        return cachedTraceSteps;
    } catch (err) {
        throw makeError(ErrorCodes.INTERNAL, `Failed to load trace-config.json: ${err.message}`);
    }
}

function validateSalesOrder(salesOrder) {
    if (!salesOrder || typeof salesOrder !== 'string') {
        throw makeError(ErrorCodes.INVALID_INPUT, 'Sales Order is required and must be a string');
    }
    if (!/^\d+$/.test(salesOrder)) {
        throw makeError(ErrorCodes.INVALID_INPUT, `Sales Order must contain only digits, got: "${salesOrder}"`);
    }
    return salesOrder.replace(/^0+/, '') || '0';
}

function encodeUriStrict(str) {
    return encodeURIComponent(str).replace(/'/g, '%27');
}

function buildFilterFromTemplate(template, normalizedSalesOrder) {
    // Only allow the {salesOrder} placeholder to prevent injection via template
    if (!template.includes('{salesOrder}')) {
        throw makeError(ErrorCodes.INTERNAL, `Invalid filterTemplate: missing {salesOrder} placeholder`);
    }
    const filter = template.replace(/\{salesOrder\}/g, normalizedSalesOrder);
    return encodeUriStrict(filter);
}

function buildUrl(step, top, normalizedSalesOrder) {
    const params = [
        step.formatJson ? '$format=json' : null,
        `sap-client=${SAP_CLIENT}`,
        `$top=${top}`,
        `$filter=${buildFilterFromTemplate(step.filterTemplate, normalizedSalesOrder)}`,
    ].filter(Boolean);

    return `${step.url}?${params.join('&')}`;
}

async function traceSalesOrder(args, dependencies) {
    const {
        salesOrder,
        includeDeliveries = true,
        includeProductionOrders = true,
        includeMaterialDocuments = true,
        includeBillingDocuments = true,
        top = DEFAULT_TOP,
    } = args;
    const { sapFetch, extractRows } = dependencies;
    const normalizedTop = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const normalizedSalesOrder = validateSalesOrder(salesOrder);
    const warnings = [];
    const errors = [];
    const data = {
        salesOrder: null,
        items: [],
        deliveries: [],
        productionOrders: [],
        materialDocuments: [],
        billingDocuments: [],
    };
    const includeOptions = {
        includeDeliveries,
        includeProductionOrders,
        includeMaterialDocuments,
        includeBillingDocuments,
    };

    const buildSalesOrderFilter = field => encodeUriStrict(`${field} eq '${normalizedSalesOrder}'`);

    try {
        const url = `/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrder?$top=1&sap-client=${SAP_CLIENT}&$filter=${buildSalesOrderFilter('SalesOrder')}`;
        const rows = extractRows(await sapFetch(url));
        if (rows.length > 0) {
            data.salesOrder = rows[0];
        } else {
            warnings.push(`Sales Order "${salesOrder}" not found`);
        }
    } catch (err) {
        errors.push({ step: 'salesOrder', error: err.code || err.message });
    }

    try {
        const url = `/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrderItem?$top=${normalizedTop}&sap-client=${SAP_CLIENT}&$filter=${buildSalesOrderFilter('SalesOrder')}`;
        data.items = extractRows(await sapFetch(url));
        if (data.items.length === 0) {
            warnings.push('No Sales Order items found');
        }
    } catch (err) {
        errors.push({ step: 'salesOrderItems', error: err.code || err.message });
    }

    const traceSteps = loadTraceSteps();
    for (const step of traceSteps) {
        if (!includeOptions[step.includeFlag]) continue;

        try {
            data[step.resultKey] = extractRows(await sapFetch(buildUrl(step, normalizedTop, normalizedSalesOrder)));
            if (data[step.resultKey].length === 0) {
                warnings.push(step.emptyWarning);
            }
        } catch (err) {
            warnings.push(`${step.failureWarning}: ${err.code || err.message} - may not be authorized or API unavailable`);
        }
    }

    return {
        salesOrder,
        data,
        warnings,
        errors,
    };
}

module.exports = {
    loadTraceSteps,
    traceSalesOrder,
    validateSalesOrder,
};
