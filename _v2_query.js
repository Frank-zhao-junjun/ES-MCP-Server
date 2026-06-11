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

    // V2 - use sap-client in headers, not query string
    const v2Url = SAP_HOST + '/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder?$format=json&$filter=SalesOrder%20eq%20%2719%27';
    console.log('V2 URL: ' + v2Url);
    const v2Resp = await fetch(v2Url, { headers });
    if (v2Resp.ok) {
        const data = await v2Resp.json();
        const results = data.d && data.d.results ? data.d.results : [];
        console.log('Count: ' + results.length);
        if (results.length > 0) {
            const r = results[0];
            console.log('SalesOrder: ' + r.SalesOrder);
            console.log('SalesOrderType: ' + r.SalesOrderType);
            console.log('\nAll fields (non-empty):');
            Object.keys(r).sort().forEach(k => {
                if (k !== '__metadata' && r[k] !== null && r[k] !== '') {
                    console.log('  ' + k + ' = ' + r[k]);
                }
            });
        }
    } else {
        const err = await v2Resp.text();
        console.log('V2 Error: ' + v2Resp.status);
        console.log(err.substring(0, 800));
    }

    // Also list all SalesOrderTypes in the system
    console.log('\n=== All SalesOrders from V2 (top 20) ===');
    const allUrl = SAP_HOST + '/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder?$format=json&$top=20&$select=SalesOrder,SalesOrderType';
    const allResp = await fetch(allUrl, { headers });
    if (allResp.ok) {
        const data = await allResp.json();
        const results = data.d && data.d.results ? data.d.results : [];
        const types = [...new Set(results.map(r => r.SalesOrderType))];
        console.log('Distinct SalesOrderType values: ' + JSON.stringify(types));
        results.forEach(r => console.log('  Order ' + r.SalesOrder + ' -> Type: ' + r.SalesOrderType));
    }
}

go();
