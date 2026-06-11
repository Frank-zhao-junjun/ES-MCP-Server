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
    if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + (await resp.text()).substring(0, 200));
    return await resp.json();
}

async function go() {
    // 1. Query material documents for FG52 around 2026-06-09
    // Movement type 101 = GR for production order
    console.log('=== Material Documents for FG52 (2026-06-09附近) ===');
    try {
        // First discover available entities
        const svc = await fetchJson(SAP_HOST + '/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/?$format=json');
        console.log('EntitySets:', svc.d.EntitySets.join(', '));
        
        // Try header entity
        const headerEntity = svc.d.EntitySets.find(e => e.includes('Header'));
        if (headerEntity) {
            const url = SAP_HOST + '/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/' + headerEntity +
                '?$format=json&$top=20&$orderby=PostingDate desc&$filter=Material%20eq%20%27FG52%27';
            console.log('\nQuerying: ' + headerEntity);
            const data = await fetchJson(url);
            const rows = data.d ? data.d.results : [];
            console.log('Found: ' + rows.length);
            rows.forEach((r, i) => {
                console.log('\n--- Material Doc ' + (i+1) + ' ---');
                Object.keys(r).sort().forEach(k => {
                    const v = r[k];
                    if (k !== '__metadata' && v !== null && v !== '')
                        console.log('  ' + k + ' = ' + (typeof v === 'object' ? '[object]' : v));
                });
            });
        }
    } catch(e) { console.log('Error: ' + e.message); }

    // 2. Also try material doc item
    console.log('\n=== Material Document Items for FG52 ===');
    try {
        // Try item entity
        const svc2 = await fetchJson(SAP_HOST + '/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/?$format=json');
        const itemEntity = svc2.d.EntitySets.find(e => e.includes('Item'));
        
        if (itemEntity) {
            const url = SAP_HOST + '/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/' + itemEntity +
                '?$format=json&$top=20&$filter=Material%20eq%20%27FG52%27%20and%20Plant%20eq%20%271010%27&$orderby=PostingDate desc';
            console.log('Querying: ' + itemEntity);
            const data = await fetchJson(url);
            const rows = data.d ? data.d.results : [];
            console.log('Found: ' + rows.length);
            rows.forEach((r, i) => {
                console.log('\n--- Item ' + (i+1) + ' ---');
                Object.keys(r).sort().forEach(k => {
                    const v = r[k];
                    if (k !== '__metadata' && v !== null && v !== '')
                        console.log('  ' + k + ' = ' + (typeof v === 'object' ? '[object]' : v));
                });
                if (i >= 4) { console.log('...(只显示前5条)'); }
            });
        }
    } catch(e) { console.log('Error: ' + e.message); }

    // 3. Also check Material Stock API
    console.log('\n=== Material Stock for FG52 ===');
    try {
        const stockUrl = SAP_HOST + '/sap/opu/odata4/sap/api_materialstock/srvd_a2x/sap/materialstock/0001/MaterialStock' +
            '?$top=10&$filter=Material%20eq%20%27FG52%27';
        const data = await fetchJson(stockUrl);
        const rows = data.value || [];
        console.log('Found: ' + rows.length);
        rows.forEach((r, i) => {
            console.log('\n--- Stock ' + (i+1) + ' ---');
            Object.keys(r).sort().forEach(k => {
                const v = r[k];
                if (k !== '@odata.etag' && k !== 'SAP__Messages' && v !== null && v !== '')
                    console.log('  ' + k + ' = ' + v);
            });
        });
    } catch(e) { console.log('Error: ' + e.message + ' (可能无权限)'); }
}

go();
