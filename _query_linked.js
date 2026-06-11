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
    if (!resp.ok) { const t = await resp.text(); throw new Error(resp.status + ': ' + t.substring(0,200)); }
    return await resp.json();
}

async function go() {
    // 1. Outbound Delivery - get V2 metadata to find the right field
    console.log('=== Outbound Delivery: Find linking field ===');
    try {
        // Check AvailableToCustomerParty or related fields in a sample delivery item
        const itemSample = SAP_HOST + '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002/A_OutbDeliveryItem?$format=json&$top=1';
        const data = await fetchJson(itemSample);
        const item = data.d.results[0];
        console.log('Sample delivery item fields:');
        Object.keys(item).sort().forEach(k => {
            if (k !== '__metadata' && item[k] !== null && item[k] !== '')
                console.log('  ' + k + ' = ' + (typeof item[k] === 'object' ? '[object]' : item[k]));
        });
        
        // Also check doc flow for our SO
        const docFlow = SAP_HOST + '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002/A_OutbDeliveryDocFlow?$format=json&$filter=ReferenceSDDocument%20eq%20%2719%27&$top=10';
        try {
            const flowData = await fetchJson(docFlow);
            const flows = flowData.d && flowData.d.results || [];
            console.log('\nDocFlow found: ' + flows.length);
            flows.forEach((f, i) => {
                console.log('\n--- Flow ' + (i+1) + ' ---');
                Object.keys(f).sort().forEach(k => {
                    if (k !== '__metadata' && f[k] !== null && f[k] !== '')
                        console.log('  ' + k + ' = ' + f[k]);
                });
            });
        } catch(e) { console.log('DocFlow query: ' + e.message); }
    } catch(e) { console.log('Error: ' + e.message); }

    // 2. Billing Document - find the linking field
    console.log('\n=== Billing Document: Find linking field ===');
    try {
        // Get metadata
        const metaUrl = SAP_HOST + '/sap/opu/odata4/sap/api_billingdocument/srvd_a2x/sap/billingdocument/0001/$metadata';
        const metaResp = await fetch(metaUrl, { headers: { ...hdrs, Accept: 'application/xml' } });
        if (metaResp.ok) {
            const xml = await metaResp.text();
            // Look for ReferenceSDDocument or SalesOrder
            ['ReferenceSDDocument', 'SalesOrder', 'ReferenceSDDocumentCategory', 'ReferenceSDDocumentItem'].forEach(f => {
                const idx = xml.indexOf(f);
                if (idx >= 0) console.log('Found: ' + f + ' at pos ' + idx + ' context: ' + xml.substring(Math.max(0,idx-30), idx+50));
                else console.log('NOT found: ' + f);
            });
        }
    } catch(e) { console.log('Error: ' + e.message); }

    // 3. Try to find billing docs linked to sales order 19 via billing document item
    console.log('\n=== Billing Document: Query by ReferenceSDDocument ===');
    try {
        const bdUrl = SAP_HOST + '/sap/opu/odata4/sap/api_billingdocument/srvd_a2x/sap/billingdocument/0001/BillingDocument?$top=10&$filter=contains(DocumentReferenceID,%27FG52%27)';
        const bd = await fetchJson(bdUrl);
        const rows = bd.value || [];
        console.log('Found: ' + rows.length);
        rows.forEach((r, i) => {
            console.log('\n--- Billing ' + (i+1) + ' ---');
            Object.keys(r).sort().forEach(k => {
                if (k !== '@odata.etag' && k !== 'SAP__Messages' && r[k] !== null && r[k] !== '')
                    console.log('  ' + k + ' = ' + r[k]);
            });
        });
    } catch(e) { console.log('Failed: ' + e.message); }

    // 4. Try BillingDocumentItem for sales order reference
    console.log('\n=== Billing Document Item ===');
    try {
        const bdi = await fetchJson(SAP_HOST + '/sap/opu/odata4/sap/api_billingdocument/srvd_a2x/sap/billingdocument/0001/BillingDocumentItem?$top=1');
        const sample = bdi.value[0];
        console.log('Sample BillingItem fields:');
        Object.keys(sample).sort().forEach(k => {
            if (k !== '@odata.etag' && k !== 'SAP__Messages' && sample[k] !== null && sample[k] !== '')
                console.log('  ' + k + ' = ' + sample[k]);
        });
    } catch(e) { console.log('Failed: ' + e.message); }
}

go();
