const fs = require('fs');
const text = fs.readFileSync('user.txt', 'utf8');
const users = [text.match(/User Name:([^\s\r\n]+)/i)[1].trim()];
const passwords = [text.match(/或者这个：([^\s\r\n]+)/)[1].trim()];
const SAP_CLIENT = '100';
const SAP_HOST = 'https://my200967-api.s4hana.sapcloud.cn';
const auth = Buffer.from(users[0] + ':' + passwords[0]).toString('base64');
const hdrs = { Authorization: 'Basic ' + auth, Accept: 'application/json', 'sap-client': SAP_CLIENT };

async function fetchJson(url) {
    const resp = await fetch(url, { headers: hdrs });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return await resp.json();
}

function showResult(title, rows) {
    console.log('\n========== ' + title + ' ==========');
    console.log('共 ' + rows.length + ' 条');
    rows.forEach((r, i) => {
        console.log('\n--- 记录 ' + (i+1) + ' ---');
        Object.keys(r).sort().forEach(k => {
            if (k !== '__metadata' && k !== '@odata.etag' && k !== 'SAP__Messages' && r[k] !== null && r[k] !== '')
                console.log('  ' + k + ' = ' + (typeof r[k] === 'object' ? '[object]' : r[k]));
        });
    });
}

async function go() {
    // 1. Outbound Delivery Items for Sales Order 19
    console.log('=== 1. 查询出库交货（按ReferenceSDDocument=19） ===');
    try {
        const url = SAP_HOST + '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002/A_OutbDeliveryItem' +
            '?$format=json&$filter=ReferenceSDDocument%20eq%20%2719%27%20and%20ReferenceSDDocumentCategory%20eq%20%27C%27&$top=20';
        const data = await fetchJson(url);
        const items = data.d ? data.d.results : [];
        showResult('出库交货行项目 (关联SO 19)', items);
    } catch(e) { console.log('查询失败: ' + e.message); }

    // 2. Billing Document Items for Sales Order 19
    console.log('\n=== 2. 查询开票单据（按SalesDocument=19） ===');
    try {
        const url = SAP_HOST + '/sap/opu/odata4/sap/api_billingdocument/srvd_a2x/sap/billingdocument/0001/BillingDocumentItem' +
            '?$top=20&$filter=SalesDocument%20eq%20%2719%27';
        const data = await fetchJson(url);
        const items = data.value || [];
        showResult('开票行项目 (关联SO 19)', items);
    } catch(e) { console.log('查询失败: ' + e.message); }

    // 3. Also get billing doc headers for those items
    console.log('\n=== 3. 开票单据抬头（通过行项目查询到的单号） ===');
    try {
        const url = SAP_HOST + '/sap/opu/odata4/sap/api_billingdocument/srvd_a2x/sap/billingdocument/0001/BillingDocumentItem' +
            '?$top=20&$filter=SalesDocument%20eq%20%2719%27&$select=BillingDocument';
        const data = await fetchJson(url);
        const items = data.value || [];
        const billNos = [...new Set(items.map(i => i.BillingDocument).filter(Boolean))];
        console.log('关联的开票单号: ' + JSON.stringify(billNos));
        for (const bn of billNos) {
            const bh = SAP_HOST + '/sap/opu/odata4/sap/api_billingdocument/srvd_a2x/sap/billingdocument/0001/BillingDocument' +
                '?$top=1&$filter=BillingDocument%20eq%20%27' + bn + '%27';
            const hd = await fetchJson(bh);
            const hRows = hd.value || [];
            showResult('开票抬头: ' + bn, hRows);
        }
    } catch(e) { console.log('查询失败: ' + e.message); }
}

go();
