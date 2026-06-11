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

async function go() {
    // 1. Try material document item - check field names from a sample
    console.log('=== 物料凭证行项目（样本，无筛选） ===');
    try {
        const url = SAP_HOST + '/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/A_MaterialDocumentItem?$format=json&$top=3';
        const data = await fetchJson(url);
        const rows = data.d ? data.d.results : [];
        console.log('Found: ' + rows.length);
        rows.forEach((r, i) => {
            console.log('\n--- Item ' + (i+1) + ' ---');
            Object.keys(r).sort().forEach(k => {
                const v = r[k];
                if (k !== '__metadata' && v !== null && v !== '' && typeof v !== 'object')
                    console.log('  ' + k + ' = ' + v);
            });
        });
    } catch(e) { console.log('Error: ' + e.message); }

    // 2. Now try filtering by material
    console.log('\n=== 物料凭证行项目（按物料 FG52） ===');
    try {
        const url = SAP_HOST + '/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/A_MaterialDocumentItem' +
            '?$format=json&$top=20&$filter=Material%20eq%20%27FG52%27';
        const data = await fetchJson(url);
        const rows = data.d ? data.d.results : [];
        console.log('Found: ' + rows.length);
        rows.forEach((r, i) => {
            console.log('\n--- FG52物料凭证 ' + (i+1) + ' ---');
            Object.keys(r).sort().forEach(k => {
                const v = r[k];
                if (k !== '__metadata' && v !== null && v !== '' && typeof v !== 'object')
                    console.log('  ' + k + ' = ' + v);
            });
        });
    } catch(e) { console.log('Error: ' + e.message); }

    // 3. Also check by production order
    console.log('\n=== 物料凭证行项目（按生产订单 1000142） ===');
    try {
        // Check field name for production order reference
        const sampleUrl = SAP_HOST + '/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/A_MaterialDocumentItem?$format=json&$top=1';
        const sample = await fetchJson(sampleUrl);
        const keys = Object.keys(sample.d.results[0]);
        const orderFields = keys.filter(k => k.toLowerCase().includes('order') || k.toLowerCase().includes('prod'));
        console.log('可能的订单关联字段:', orderFields.join(', '));
    } catch(e) { console.log('Error: ' + e.message); }
}

go();
