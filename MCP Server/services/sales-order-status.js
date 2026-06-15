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

// 获取所有分页数据的辅助函数
async function fetchAllPages(sapFetch, extractRows, baseUrl, filter, maxRecords = 1000) {
    const allResults = [];
    let skip = 0;
    const batchSize = 100; // 每批获取100条记录
    
    while (allResults.length < maxRecords) {
        const skipParam = skip > 0 ? `$skip=${skip}&` : '';
        const url = `${baseUrl}?$top=${Math.min(batchSize, maxRecords - allResults.length)}&${skipParam}sap-client=${SAP_CLIENT}&$filter=${filter}`;
        
        try {
            const data = await sapFetch(url);
            const rows = extractRows(data);
            
            if (!rows || rows.length === 0) {
                break; // 没有更多数据
            }
            
            allResults.push(...rows);
            
            if (rows.length < batchSize) {
                break; // 返回的记录少于批量大小，说明已到达末尾
            }
            
            skip += batchSize;
        } catch (err) {
            // 如果分页查询失败，至少返回已获取的数据
            console.warn(`Warning: Failed to fetch page starting at ${skip} records:`, err.message);
            break;
        }
    }
    
    return allResults;
}

async function getSalesOrderStatus(args, dependencies) {
    const { salesOrder, includeItems = true, top = DEFAULT_TOP, getAllItems = false } = args;
    const { sapFetch, extractRows } = dependencies;
    const normalizedSalesOrder = validateSalesOrder(salesOrder);
    const normalizedTop = Math.min(top || DEFAULT_TOP, MAX_TOP);

    const headerUrl = `/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrder?$top=1&sap-client=${SAP_CLIENT}&$filter=${buildFilter('SalesOrder', normalizedSalesOrder)}`;
    const headerRows = extractRows(await sapFetch(headerUrl));
    const header = headerRows.length > 0 ? headerRows[0] : null;

    let items = [];
    if (includeItems) {
        if (getAllItems) {
            // 获取所有项目数据
            const baseUrl = '/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrderItem';
            const filter = buildFilter('SalesOrder', normalizedSalesOrder);
            items = await fetchAllPages(sapFetch, extractRows, baseUrl, filter);
        } else {
            // 按原有方式获取限定数量的项目
            const itemUrl = `/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrderItem?$top=${normalizedTop}&sap-client=${SAP_CLIENT}&$filter=${buildFilter('SalesOrder', normalizedSalesOrder)}`;
            items = extractRows(await sapFetch(itemUrl));
        }
    }

    return {
        inputSalesOrder: salesOrder,
        normalizedSalesOrder,
        found: Boolean(header),
        header,
        items,
        itemCount: items.length,
        hasMoreItems: getAllItems ? false : items.length === normalizedTop, // 如果获取了全部，则不会有更多
    };
}

module.exports = {
    getSalesOrderStatus,
    validateSalesOrder,
};