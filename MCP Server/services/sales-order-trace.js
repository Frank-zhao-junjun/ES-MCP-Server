const fs = require('fs');
const path = require('path');
const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;
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

function buildUrl(step, top, normalizedSalesOrder, skip = 0) {
    const params = [
        step.formatJson ? '$format=json' : null,
        `sap-client=${SAP_CLIENT}`,
        `$top=${top}`,
        skip > 0 ? `$skip=${skip}` : null,
        `$filter=${buildFilterFromTemplate(step.filterTemplate, normalizedSalesOrder)}`,
    ].filter(Boolean);

    return `${step.url}?${params.join('&')}`;
}

// 获取所有分页数据的辅助函数
async function fetchAllPages(step, normalizedSalesOrder, dependencies, maxRecords = 1000) {
    const { sapFetch, extractRows } = dependencies;
    let allRows = [];
    let skip = 0;
    const batchSize = Math.min(100, maxRecords); // 每次获取最多100条记录
    
    try {
        while (allRows.length < maxRecords) {
            const url = buildUrl(step, batchSize, normalizedSalesOrder, skip);
            
            const data = await sapFetch(url);
            const rows = extractRows(data);
            
            if (!rows || rows.length === 0) {
                break; // 没有更多数据了
            }
            
            allRows = allRows.concat(rows);
            
            if (rows.length < batchSize) {
                break; // 最后一批数据不足batchSize，说明已获取完所有数据
            }
            
            skip += batchSize;
            
            // 检查是否达到最大记录数限制
            if (allRows.length >= maxRecords) {
                break;
            }
        }
    } catch (err) {
        // 如果分页查询失败，记录警告但返回已获取的数据
        console.warn(`Warning: Failed to fetch all pages for ${step.id}, returning partial data:`, err.message);
    }
    
    return allRows;
}

async function traceSalesOrder(args, dependencies) {
    const {
        salesOrder,
        includeDeliveries = true,
        includeProductionOrders = true,
        includeMaterialDocuments = true,
        includeBillingDocuments = true,
        top = DEFAULT_TOP,
        getAllData = false, // 新增参数，控制是否获取全部分页数据
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
        // 获取销售订单行项目 - 支持分页
        if (getAllData) {
            // 获取所有项目数据
            const baseUrl = '/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrderItem';
            const filter = buildFilterFromTemplate('{salesOrder}', normalizedSalesOrder);
            // 构建基础URL，然后在fetchAllPages中处理分页
            const stepConfig = {
                url: baseUrl,
                formatJson: false,
                filterTemplate: `SalesOrder eq '{salesOrder}'`
            };
            data.items = await fetchAllPages(stepConfig, normalizedSalesOrder, dependencies);
        } else {
            const url = `/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrderItem?$top=${normalizedTop}&sap-client=${SAP_CLIENT}&$filter=${buildSalesOrderFilter('SalesOrder')}`;
            data.items = extractRows(await sapFetch(url));
        }
        
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
            // 根据getAllData标志决定是否获取全部分页数据
            if (getAllData) {
                data[step.resultKey] = await fetchAllPages(step, normalizedSalesOrder, dependencies);
            } else {
                const url = buildUrl(step, normalizedTop, normalizedSalesOrder);
                data[step.resultKey] = extractRows(await sapFetch(url));
            }
            
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