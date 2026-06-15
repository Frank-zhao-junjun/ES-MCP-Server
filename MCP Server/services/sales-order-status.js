const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;
const SAP_CLIENT = '100';

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

function buildFilter(field, value) {
    return encodeUriStrict(`${field} eq '${value}'`);
}

async function getSalesOrderStatus(args, dependencies) {
    const { salesOrder, includeItems = true, top = DEFAULT_TOP } = args;
    const { sapFetch, extractRows } = dependencies;
    const normalizedSalesOrder = validateSalesOrder(salesOrder);
    const normalizedTop = Math.min(top || DEFAULT_TOP, MAX_TOP);

    const headerUrl = `/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrder?$top=1&sap-client=${SAP_CLIENT}&$filter=${buildFilter('SalesOrder', normalizedSalesOrder)}`;
    const headerRows = extractRows(await sapFetch(headerUrl));
    const header = headerRows.length > 0 ? headerRows[0] : null;

    let items = [];
    if (includeItems) {
        const itemUrl = `/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrderItem?$top=${normalizedTop}&sap-client=${SAP_CLIENT}&$filter=${buildFilter('SalesOrder', normalizedSalesOrder)}`;
        items = extractRows(await sapFetch(itemUrl));
    }

    return {
        inputSalesOrder: salesOrder,
        normalizedSalesOrder,
        found: Boolean(header),
        header,
        items,
        itemCount: items.length,
    };
}

module.exports = {
    getSalesOrderStatus,
    validateSalesOrder,
};
