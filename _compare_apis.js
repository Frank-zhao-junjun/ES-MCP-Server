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

    // Query V2 for SalesOrder 19
    console.log('=== V2 A_SalesOrder (SalesOrder=19) ===');
    const v2Url = SAP_HOST + '/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder?$format=json&$filter=SalesOrder%20eq%20%2719%27&$sap-client=100';
    const v2Resp = await fetch(v2Url, { headers });
    if (v2Resp.ok) {
        const data = await v2Resp.json();
        const results = data.d && data.d.results ? data.d.results : [];
        console.log('Count: ' + results.length);
        if (results.length > 0) {
            const r = results[0];
            console.log('SalesOrder: ' + r.SalesOrder);
            console.log('SalesOrderType: ' + r.SalesOrderType);
            console.log('All fields with values:');
            Object.keys(r).sort().forEach(k => {
                if (k !== '__metadata' && r[k] !== null && r[k] !== '') {
                    console.log('  ' + k + ' = ' + r[k]);
                }
            });
        }
    } else {
        const err = await v2Resp.text();
        console.log('V2 Error: ' + v2Resp.status + ' ' + err.substring(0, 500));
    }

    // Query V4 for comparison
    console.log('\n=== V4 SalesOrder (SalesOrder=19) ===');
    const v4Url = SAP_HOST + '/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/SalesOrder?$top=1&$filter=SalesOrder%20eq%20%2719%27';
    const v4Resp = await fetch(v4Url, { headers });
    if (v4Resp.ok) {
        const data = await v4Resp.json();
        const rows = data.value || [];
        console.log('Count: ' + rows.length);
        if (rows.length > 0) {
            const r = rows[0];
            console.log('SalesOrder: ' + r.SalesOrder);
            console.log('SalesOrderType: ' + r.SalesOrderType + ' (' + typeof r.SalesOrderType + ')');
        }
    }

    // Also try another SalesOrder to see all types
    console.log('\n=== Query all SalesOrders from V2 (top 20) ===');
    const v2AllUrl = SAP_HOST + '/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder?$format=json&$top=20&$select=SalesOrder,SalesOrderType&$sap-client=100';
    const v2AllResp = await fetch(v2AllUrl, { headers });
    if (v2AllResp.ok) {
        const data = await v2AllResp.json();
        const results = data.d && data.d.results ? data.d.results : [];
        const types = [...new Set(results.map(r => r.SalesOrderType))];
        console.log('Distinct SalesOrderType values: ' + JSON.stringify(types));
        results.forEach(r => console.log('  Order ' + r.SalesOrder + ' -> Type: ' + r.SalesOrderType));
    }
}

go();
