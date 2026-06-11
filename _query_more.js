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

function showRow(title, row) {
    console.log('\n========== ' + title + ' ==========');
    Object.keys(row).sort().forEach(k => {
        const v = row[k];
        if (k !== '__metadata' && k !== '@odata.etag' && k !== 'SAP__Messages' && v !== null && v !== '')
            console.log('  ' + k + ' = ' + (typeof v === 'object' ? '[object]' : v));
    });
}

async function go() {
    // 1. Outbound Delivery Header for 80000013
    console.log('=== 出库交货抬头 80000013 ===');
    try {
        const url = SAP_HOST + '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002/A_OutbDeliveryHeader' +
            "?$format=json&\$filter=DeliveryDocument%20eq%20%2780000013%27";
        const data = await fetchJson(url);
        const rows = data.d ? data.d.results : [];
        if (rows.length) showRow('出库交货抬头 80000013', rows[0]);
    } catch(e) { console.log('查询失败: ' + e.message); }

    // 2. Outbound Delivery Header Items 
    console.log('\n=== 出库交货行项目 80000013 ===');
    try {
        const url = SAP_HOST + '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002/A_OutbDeliveryItem' +
            "?$format=json&\$filter=DeliveryDocument%20eq%20%2780000013%27";
        const data = await fetchJson(url);
        const rows = data.d ? data.d.results : [];
        console.log('共 ' + rows.length + ' 条');
        rows.forEach((r, i) => {
            console.log('\n--- 行项目 ' + (i+1) + ' ---');
            Object.keys(r).sort().forEach(k => {
                const v = r[k];
                if (k !== '__metadata' && v !== null && v !== '')
                    console.log('  ' + k + ' = ' + (typeof v === 'object' ? '[object]' : v));
            });
        });
    } catch(e) { console.log('查询失败: ' + e.message); }

    // 3. Billing Document by ReferenceSDDocument (V4 metadata confirmed this field exists)
    console.log('\n=== 开票单据抬头（按ReferenceSDDocument=19） ===');
    try {
        const url = SAP_HOST + '/sap/opu/odata4/sap/api_billingdocument/srvd_a2x/sap/billingdocument/0001/BillingDocument' +
            '?$top=20&$filter=ReferenceSDDocument%20eq%20%2719%27';
        const data = await fetchJson(url);
        const rows = data.value || [];
        console.log('共 ' + rows.length + ' 条');
        rows.forEach((r, i) => {
            showRow('开票抬头 ' + (i+1), r);
        });
    } catch(e) { console.log('查询失败: ' + e.message); }

    // 4. Billing Document Item by ReferenceSDDocument
    console.log('\n=== 开票行项目（按ReferenceSDDocument=19） ===');
    try {
        const url = SAP_HOST + '/sap/opu/odata4/sap/api_billingdocument/srvd_a2x/sap/billingdocument/0001/BillingDocumentItem' +
            '?$top=20&$filter=ReferenceSDDocument%20eq%20%2719%27';
        const data = await fetchJson(url);
        const rows = data.value || [];
        console.log('共 ' + rows.length + ' 条');
        rows.forEach((r, i) => {
            showRow('开票行项目 ' + (i+1), r);
        });
    } catch(e) { console.log('查询失败: ' + e.message); }
}

go();
