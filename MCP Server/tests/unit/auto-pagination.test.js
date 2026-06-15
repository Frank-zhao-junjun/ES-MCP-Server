/**
 * tests/unit/auto-pagination.test.js
 * v0.4: Auto-pagination tests
 */
const assert = require('assert');
const {
    extractTopFromUrl, extractNextLink,
    isAutoPageEnabled, getAutoPageMax, autoPaginate,
} = require('../../lib/auto-pagination');

// ── extractTopFromUrl ──

function testExtractTopFromUrl() {
    assert.equal(extractTopFromUrl('/sap/api/E?$top=50'), 50);
    assert.equal(extractTopFromUrl('/sap/api/E?$top=100&$filter=x'), 100);
    assert.equal(extractTopFromUrl('/sap/api/E'), 0);
    assert.equal(extractTopFromUrl('http://host/sap/api/E?$top=25'), 25);
}

// ── extractNextLink V4 ──

function testExtractNextLinkV4() {
    const data = { '@odata.nextLink': '/sap/api/next?$skip=100' };
    assert.equal(extractNextLink(data), '/sap/api/next?$skip=100');
}

// ── extractNextLink V2 __next ──

function testExtractNextLinkV2() {
    const data = { d: { __next: '/sap/api/next?$skip=50' } };
    assert.equal(extractNextLink(data), '/sap/api/next?$skip=50');
}

// ── extractNextLink null ──

function testExtractNextLinkNull() {
    assert.equal(extractNextLink(null), null);
    assert.equal(extractNextLink({}), null);
    assert.equal(extractNextLink({ value: [] }), null);
}

// ── Auto-pagination: single page (rows < top) ──

async function testAutoPageSinglePage() {
    let callCount = 0;
    const fetchFn = async () => { callCount++; return { value: [{ id: 1 }, { id: 2 }] }; };
    const extractFn = (d) => d.value;
    const result = await autoPaginate(fetchFn, extractFn, '/test?$top=10', { maxTotal: 500, top: 10 });
    assert.equal(callCount, 1, 'should only fetch once');
    assert.equal(result.rows.length, 2);
    assert.equal(result.metadata.autoPaged, false);
}

// ── Auto-pagination: multi-page via $skip ──

async function testAutoPageMultiPage() {
    let page = 0;
    const fetchFn = async () => {
        page++;
        if (page === 1) return { value: [{ id: 1 }, { id: 2 }] };
        if (page === 2) return { value: [{ id: 3 }] };
        return { value: [] };
    };
    const extractFn = (d) => d.value;
    const result = await autoPaginate(fetchFn, extractFn, '/test?$top=2', { maxTotal: 10, top: 2 });
    assert.equal(page, 2, 'should fetch 2 pages');
    assert.equal(result.rows.length, 3);
    assert.equal(result.metadata.autoPaged, true);
    assert.equal(result.metadata.totalFetched, 3);
}

// ── Auto-pagination: stops at maxTotal ──

async function testAutoPageMaxTotal() {
    let callCount = 0;
    const fetchFn = async () => { callCount++; return { value: [{ id: 1 }, { id: 2 }] }; };
    const extractFn = (d) => d.value;
    const result = await autoPaginate(fetchFn, extractFn, '/test?$top=2', { maxTotal: 3, top: 2 });
    // First page returns 2 rows (total=2), second page would exceed 3, so stops
    assert.equal(result.rows.length <= 3, true);
}

// ── Auto-pagination: nextLink ──

async function testAutoPageNextLink() {
    let callCount = 0;
    const fetchFn = async () => {
        callCount++;
        if (callCount === 1) return { '@odata.nextLink': '/next', value: [{ id: 1 }, { id: 2 }] };
        return { value: [{ id: 3 }] };
    };
    const extractFn = (d) => d.value;
    const result = await autoPaginate(fetchFn, extractFn, '/test?$top=2', { maxTotal: 10, top: 2 });
    assert.equal(callCount, 2);
    assert.equal(result.rows.length, 3);
}

// ── Default disabled ──

function testIsAutoPageDisabledByDefault() {
    // MCP_AUTO_PAGE_MAX not set
    const prev = process.env.MCP_AUTO_PAGE_MAX;
    delete process.env.MCP_AUTO_PAGE_MAX;
    try {
        assert.equal(isAutoPageEnabled(), false, 'should be disabled by default');
        assert.equal(getAutoPageMax(), 0);
    } finally {
        if (prev !== undefined) process.env.MCP_AUTO_PAGE_MAX = prev;
    }
}

// ── Runner ──

async function run() {
    testExtractTopFromUrl();
    testExtractNextLinkV4();
    testExtractNextLinkV2();
    testExtractNextLinkNull();
    await testAutoPageSinglePage();
    await testAutoPageMultiPage();
    await testAutoPageMaxTotal();
    await testAutoPageNextLink();
    testIsAutoPageDisabledByDefault();
    console.log('  ✅ auto-pagination.test.js — all passed');
}

module.exports = { run };
