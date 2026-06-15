/**
 * services/sales-contract.js
 * SAP Sales Contract 销售合同查询服务 (OData V4)
 *
 * US-API-011 / SAP_COM_0119
 * Service: api_salescontract
 */

const { ErrorCodes, makeError } = require('../lib/errors');

const DEFAULT_TOP = 20;
const MAX_TOP = 100;

// ── 纯函数：输入校验 ─────────────────────────────────

function validateSalesContractInput(args) {
    const { salesContract, customer, salesOrganization, distributionChannel, division } = args || {};

    const hasFilter = Boolean(salesContract) || Boolean(customer)
        || Boolean(salesOrganization) || Boolean(distributionChannel) || Boolean(division);

    if (!hasFilter) {
        return {
            valid: false,
            error: makeError(ErrorCodes.INVALID_INPUT,
                'At least one filter is required: salesContract, customer, salesOrganization, distributionChannel, or division'),
        };
    }

    if (salesContract && typeof salesContract !== 'string') {
        return { valid: false, error: makeError(ErrorCodes.INVALID_INPUT, 'salesContract must be a string') };
    }

    return { valid: true };
}

// ── 纯函数：构建 OData Filter ────────────────────────

function buildSalesContractFilter(args) {
    const { salesContract, customer, salesOrganization, distributionChannel, division } = args || {};
    const conditions = [];

    if (salesContract) {
        const scs = salesContract.split(',').map(s => s.trim()).filter(Boolean);
        if (scs.length === 1) {
            conditions.push(`SalesContract eq '${scs[0]}'`);
        } else {
            conditions.push(`SalesContract in (${scs.map(s => `'${s}'`).join(',')})`);
        }
    }

    if (customer) {
        conditions.push(`SoldToParty eq '${customer}'`);
    }

    if (salesOrganization) {
        conditions.push(`SalesOrganization eq '${salesOrganization}'`);
    }

    if (distributionChannel) {
        conditions.push(`DistributionChannel eq '${distributionChannel}'`);
    }

    if (division) {
        conditions.push(`Division eq '${division}'`);
    }

    return conditions.length > 0 ? conditions.join(' and ') : '';
}

// ── 纯函数：构建 URL ─────────────────────────────────

function buildSalesContractUrl(filter, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const base = '/sap/opu/odata4/sap/api_salescontract/srvd_a2x/sap/salescontract/0001/A_SalesContract';
    let url = `${base}?$top=${t}`;
    if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
    return url;
}

function buildSalesContractItemsUrl(salesContract, top) {
    const t = Math.min(top || DEFAULT_TOP, MAX_TOP);
    const filter = encodeURIComponent(`SalesContract eq '${salesContract}'`);
    return `/sap/opu/odata4/sap/api_salescontract/srvd_a2x/sap/salescontract/0001/A_SalesContractItem?$top=${t}&$filter=${filter}`;
}

// ── 主服务函数 ──────────────────────────────────────

/**
 * 查询销售合同
 * @param {object} args - { salesContract?, customer?, salesOrganization?, distributionChannel?, division?, includeItems?, top? }
 * @param {object} dependencies - { sapFetch, extractRows }
 * @returns {object} { salesContracts, count, filter }
 */
async function getSalesContract(args, dependencies) {
    const { sapFetch, extractRows } = dependencies;

    const validation = validateSalesContractInput(args);
    if (!validation.valid) throw validation.error;

    const { includeItems = true, top = DEFAULT_TOP } = args;
    const filter = buildSalesContractFilter(args);
    const url = buildSalesContractUrl(filter, top);

    const data = await sapFetch(url);
    const contracts = extractRows(data);

    if (includeItems && contracts.length > 0) {
        for (const sc of contracts) {
            try {
                const itemData = await sapFetch(buildSalesContractItemsUrl(sc.SalesContract, top));
                sc.items = extractRows(itemData);
            } catch (_) { sc.items = []; }
        }
    }

    return {
        salesContracts: contracts,
        count: contracts.length,
        filter: filter || '(none)',
    };
}

module.exports = {
    getSalesContract,
    validateSalesContractInput,
    buildSalesContractFilter,
    buildSalesContractUrl,
    buildSalesContractItemsUrl,
};
