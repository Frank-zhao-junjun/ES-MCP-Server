/**
 * lib/auto-pagination.js — 自动分页
 *
 * 对 OData 查询透明翻页，优先 @odata.nextLink (V4)，回退 $skip (V2)。
 * 配置: MCP_AUTO_PAGE_MAX (默认 0 = 禁用, 硬上限 5000)
 */

const MAX_HARD_CAP = 5000;

/**
 * 从 URL 解析 $top 值
 */
function extractTopFromUrl(url) {
    try {
        const u = new URL(url.startsWith('http') ? url : `http://x${url}`);
        const t = parseInt(u.searchParams.get('$top'), 10);
        return t > 0 ? t : 0;
    } catch {
        return 0;
    }
}

/**
 * 提取 nextLink: V4 @odata.nextLink, V2 __next, 或 data.d.__next
 */
function extractNextLink(data) {
    if (!data || typeof data !== 'object') return null;
    if (data['@odata.nextLink']) return data['@odata.nextLink'];
    if (data.__next) return data.__next;
    if (data.d && data.d.__next) return data.d.__next;
    return null;
}

function isAutoPageEnabled() {
    return getAutoPageMax() > 0;
}

function getAutoPageMax() {
    const val = Number(process.env.MCP_AUTO_PAGE_MAX || 0);
    if (val <= 0) return 0;
    return Math.min(val, MAX_HARD_CAP);
}

/**
 * 自动分页主函数
 *
 * @param {Function} fetchFn - async (url) => raw SAP response (JSON object)
 * @param {Function} extractRowsFn - (data) => rows[]
 * @param {string} url - 初始 URL
 * @param {object} options - { maxTotal, top }
 * @returns {object} { rows, rawData, metadata: { autoPaged, totalFetched, pageCount } }
 */
async function autoPaginate(fetchFn, extractRowsFn, url, options = {}) {
    const maxTotal = options.maxTotal || getAutoPageMax();
    const top = options.top || extractTopFromUrl(url) || 100;

    if (maxTotal <= 0) {
        // 分页禁用 — 单次查询
        const data = await fetchFn(url);
        const rows = extractRowsFn(data);
        return {
            rows,
            rawData: data,
            metadata: { autoPaged: false, totalFetched: rows.length, pageCount: 1 },
        };
    }

    const allRows = [];
    let pageCount = 0;
    let currentUrl = url;
    let hasMore = true;
    const limit = Math.min(maxTotal, MAX_HARD_CAP);

    while (hasMore && allRows.length < limit) {
        const data = await fetchFn(currentUrl);
        const rows = extractRowsFn(data);
        pageCount++;

        if (!rows || rows.length === 0) {
            hasMore = false;
            break;
        }

        // 取本页有效行数（不超过上限）
        const remaining = limit - allRows.length;
        allRows.push(...rows.slice(0, remaining));

        // V4 nextLink 优先
        const nextLink = extractNextLink(data);
        if (nextLink) {
            currentUrl = nextLink;
            // nextLink 可能已经是绝对 URL，直接使用
            continue;
        }

        // 回退 $skip 启发式
        if (rows.length < top || allRows.length >= limit) {
            hasMore = false;
            break;
        }

        // 为当前 URL 增加 $skip
        const newSkip = pageCount * top;
        try {
            const u = new URL(currentUrl.startsWith('http') ? currentUrl : `http://x${currentUrl}`);
            u.searchParams.set('$skip', String(newSkip));
            currentUrl = currentUrl.startsWith('http')
                ? u.toString()
                : u.pathname + u.search;
        } catch {
            // URL 无法解析，停止分页
            hasMore = false;
        }
    }

    return {
        rows: allRows,
        rawData: null, // 多页时无单一 rawData
        metadata: {
            autoPaged: pageCount > 1,
            totalFetched: allRows.length,
            pageCount,
        },
    };
}

module.exports = {
    autoPaginate,
    extractTopFromUrl,
    extractNextLink,
    isAutoPageEnabled,
    getAutoPageMax,
};
