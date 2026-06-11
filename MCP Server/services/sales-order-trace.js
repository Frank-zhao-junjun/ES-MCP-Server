const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 50;
const SAP_CLIENT = '100';

const TRACE_STEPS = [
    {
        id: 'productionOrders',
        includeFlag: 'includeProductionOrders',
        resultKey: 'productionOrders',
        emptyWarning: 'No Production Orders linked to this Sales Order',
        failureWarning: 'Production Orders query failed',
        url: '/sap/opu/odata4/sap/api_productionorder/srvd_a2x/sap/productionorder/0001/ProductionOrder',
        formatJson: false,
        buildFilter: salesOrder => `SalesOrder eq '${salesOrder}'`
    },
    {
        id: 'deliveries',
        includeFlag: 'includeDeliveries',
        resultKey: 'deliveries',
        emptyWarning: 'No Outbound Deliveries linked to this Sales Order',
        failureWarning: 'Outbound Deliveries query failed',
        url: '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002/A_OutbDeliveryItem',
        formatJson: true,
        buildFilter: salesOrder => `ReferenceSDDocument eq '${salesOrder}' and ReferenceSDDocumentCategory eq 'C'`
    },
    {
        id: 'materialDocuments',
        includeFlag: 'includeMaterialDocuments',
        resultKey: 'materialDocuments',
        emptyWarning: 'No Material Documents linked to this Sales Order',
        failureWarning: 'Material Documents query failed',
        url: '/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/A_MaterialDocumentItem',
        formatJson: true,
        buildFilter: salesOrder => `(SalesOrder eq '${salesOrder}' or SpecialStockIdfgSalesOrder eq '${salesOrder}')`
    },
    {
        id: 'billingDocuments',
        includeFlag: 'includeBillingDocuments',
        resultKey: 'billingDocuments',
        emptyWarning: 'No Billing Documents linked to this Sales Order (may not be invoiced yet)',
        failureWarning: 'Billing Documents query failed',
        url: '/sap/opu/odata4/sap/api_billingdocument/srvd_a2x/sap/billingdocument/0001/BillingDocumentItem',
        formatJson: false,
        buildFilter: salesOrder => `SalesDocument eq '${salesOrder}'`
    },
];

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

function buildUrl(step, top, normalizedSalesOrder) {
    const params = [
        step.formatJson ? '$format=json' : null,
        `sap-client=${SAP_CLIENT}`,
        `$top=${top}`,
        `$filter=${encodeUriStrict(step.buildFilter(normalizedSalesOrder))}`,
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

    for (const step of TRACE_STEPS) {
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
    TRACE_STEPS,
    traceSalesOrder,
    validateSalesOrder,
};
