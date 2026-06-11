const fs = require('fs');

const text = fs.readFileSync('user.txt', 'utf8');
const users = [text.match(/User Name:([^\s\r\n]+)/i)[1].trim()];
const pwMatch = text.match(/或者这个：([^\s\r\n]+)/);
const passwords = [pwMatch[1].trim()];

const SAP_CLIENT = '100';
const SAP_HOST = 'https://my200967-api.s4hana.sapcloud.cn';

async function go() {
    const auth = Buffer.from(users[0] + ':' + passwords[0]).toString('base64');
    const headers = { Authorization: 'Basic ' + auth, Accept: 'application/json', 'sap-client': SAP_CLIENT };

    // Try V2 candidates
    const v2Candidates = [
        '/sap/opu/odata/sap/API_SALES_ORDER_SRV/$metadata',
        '/sap/opu/odata/sap/API_SALES_ORDER_SRV/?$format=json',
        '/sap/opu/odata/sap/API_SALES_ORDER_SRV/SalesOrder?$top=1&$format=json',
    ];

    for (const url of v2Candidates) {
        try {
            const resp = await fetch(SAP_HOST + url, { headers });
            console.log('V2 [' + resp.status + ']: ' + url.substring(0, 70));
            if (resp.ok) {
                const text = await resp.text();
                if (text.includes('SalesOrderType')) {
                    const lines = text.split('\n').filter(l => l.includes('SalesOrderType'));
                    lines.forEach(l => console.log('  >> ' + l.trim().substring(0, 150)));
                }
                // Save full response
                const name = url.replace(/[\/?&=]/g, '_').substring(0, 30);
                fs.writeFileSync('_v2_' + name + '.txt', text.substring(0, 30000));
            }
        } catch (e) {
            console.log('V2 ERROR: ' + url.substring(0, 70) + ' - ' + e.message);
        }
    }

    // Try V4 with expand to get SalesOrderType description
    console.log('\n--- Try V4 with $expand for SalesOrderType ---');
    const v4Url = '/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrder?$top=1&$filter=SalesOrder%20eq%20%2719%27&$expand=to_SalesOrderType&$select=SalesOrder,SalesOrderType';
    try {
        const resp = await fetch(SAP_HOST + v4Url, { headers });
        if (resp.ok) {
            const data = await resp.json();
            console.log(JSON.stringify(data, null, 2).substring(0, 2000));
        } else {
            const errText = await resp.text();
            console.log('Expand failed: ' + resp.status + ' ' + errText.substring(0, 500));
        }
    } catch (e) {
        console.log('Expand error: ' + e.message);
    }

    // Try different navigation property names
    const navNames = ['SalesOrderType', '_SalesOrderType', 'SlsDocType', 'DocumentType', 'to_SalesOrderType'];
    for (const nav of navNames) {
        const u = '/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrder?$top=1&$filter=SalesOrder%20eq%20%2719%27&$expand=' + nav + '&$select=SalesOrder,SalesOrderType';
        try {
            const resp = await fetch(SAP_HOST + u, { headers });
            console.log('\nExpand with ' + nav + ': HTTP ' + resp.status);
            if (resp.ok) {
                const data = await resp.json();
                console.log(JSON.stringify(data, null, 2).substring(0, 1000));
            }
        } catch (e) { }
    }
}

go();
