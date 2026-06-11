const fs = require('fs');

const text = fs.readFileSync('user.txt', 'utf8');
const userNameMatch = text.match(/User Name:([^\s\r\n]+)/i);
const passwordMatch = text.match(/密码：([^\s\r\n]+)/);
const altPasswordMatch = text.match(/或者这个：([^\s\r\n]+)/);

const users = [userNameMatch[1].trim()];
const passwords = [];
if (altPasswordMatch && altPasswordMatch[1]) passwords.push(altPasswordMatch[1].trim());
if (passwordMatch && passwordMatch[1]) passwords.push(passwordMatch[1].trim());

const SAP_CLIENT = '100';
const SAP_HOST = 'https://my200967-api.s4hana.sapcloud.cn';

async function tryCreds(url, attemptAuth) {
    for (const u of users) {
        for (const p of passwords) {
            const auth = Buffer.from(u + ':' + p).toString('base64');
            try {
                const resp = await fetch(url, {
                    headers: {
                        Authorization: 'Basic ' + auth,
                        Accept: attemptAuth || 'application/json',
                        'sap-client': SAP_CLIENT
                    }
                });
                const status = resp.status;
                if (resp.ok) return { status, data: attemptAuth ? await resp.text() : await resp.json() };
                return { status, error: await resp.text().catch(() => '') };
            } catch(e) { return { status: 0, error: e.message }; }
        }
    }
    return { status: 0, error: 'All credentials exhausted' };
}

async function go() {
    // Outbound Delivery - V2
    console.log('=== Outbound Delivery (V2) ===');
    
    // 1. Try header entity directly
    const headerUrl = SAP_HOST + '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002/A_OutbDeliveryHeader' +
        '?$format=json&$filter=ReferenceSDDocument%20eq%20%2719%27&$top=10';
    let r = await tryCreds(headerUrl);
    console.log('A_OutbDeliveryHeader by RefSDDoc: ' + r.status);
    if (r.status === 200) {
        const rows = r.data.d && r.data.d.results ? r.data.d.results : [];
        console.log('Found: ' + rows.length);
        rows.forEach((row, i) => {
            console.log('\n--- OutbDelivery ' + (i+1) + ' ---');
            Object.keys(row).sort().forEach(k => {
                if (k !== '__metadata' && row[k] !== null && row[k] !== '') {
                    const v = typeof row[k] === 'object' ? '[object]' : row[k];
                    console.log('  ' + k + ' = ' + v);
                }
            });
        });
    } else {
        // Try with SalesOrder filter
        const soUrl = SAP_HOST + '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002/A_OutbDeliveryHeader' +
            '?$format=json&$filter=SalesOrder%20eq%20%2719%27&$top=10';
        r = await tryCreds(soUrl);
        console.log('A_OutbDeliveryHeader by SalesOrder: ' + r.status);
        if (r.status === 200) {
            const rows = r.data.d && r.data.d.results ? r.data.d.results : [];
            console.log('Found: ' + rows.length);
            rows.forEach((row, i) => {
                console.log('\n--- OutbDelivery ' + (i+1) + ' ---');
                Object.keys(row).sort().forEach(k => {
                    if (k !== '__metadata' && row[k] !== null && row[k] !== '') {
                        const v = typeof row[k] === 'object' ? '[object]' : row[k];
                        console.log('  ' + k + ' = ' + v);
                    }
                });
            });
        } else {
            console.log('Error response: ' + (r.error || '').substring(0, 500));
            // Try without filter - just top 1
            const anyUrl = SAP_HOST + '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002/A_OutbDeliveryHeader' +
                '?$format=json&$top=1';
            r = await tryCreds(anyUrl);
            console.log('A_OutbDeliveryHeader (any, top 1): ' + r.status);
            if (r.status === 200) {
                console.log('Sample:');
                const row = r.data.d.results[0];
                Object.keys(row).sort().forEach(k => {
                    if (k !== '__metadata' && row[k] !== null && row[k] !== '')
                        console.log('  ' + k + ' = ' + (typeof row[k] === 'object' ? '[object]' : row[k]));
                });
                // Now look for SalesOrder field name
                const soKey = Object.keys(row).find(k => k.toLowerCase().includes('sales') || k.toLowerCase().includes('reference'));
                if (soKey) console.log('\nPossible SO link field: ' + soKey + ' = ' + row[soKey]);
            } else {
                console.log('Also failed: ' + r.status + ' ' + (r.error || '').substring(0, 300));
            }
        }
    }

    // Billing Document - V4
    console.log('\n=== Billing Document (V4) ===');
    const billUrl = SAP_HOST + '/sap/opu/odata4/sap/api_billingdocument/srvd_a2x/sap/billingdocument/0001/BillingDocument' +
        '?$top=10&$filter=ReferenceSDDocument%20eq%20%2719%27';
    r = await tryCreds(billUrl);
    console.log('BillingDocument: ' + r.status);
    if (r.status === 200) {
        const rows = r.data.value || [];
        console.log('Found: ' + rows.length);
        rows.forEach((row, i) => {
            console.log('\n--- BillingDoc ' + (i+1) + ' ---');
            Object.keys(row).sort().forEach(k => {
                if (k !== '@odata.etag' && k !== 'SAP__Messages' && row[k] !== null && row[k] !== '')
                    console.log('  ' + k + ' = ' + row[k]);
            });
        });
    } else {
        // Try without filter
        const anyBill = SAP_HOST + '/sap/opu/odata4/sap/api_billingdocument/srvd_a2x/sap/billingdocument/0001/BillingDocument?$top=1';
        r = await tryCreds(anyBill);
        console.log('BillingDocument (any): ' + r.status);
        if (r.status === 200) {
            const row = r.data.value[0];
            console.log('Sample:');
            Object.keys(row).sort().forEach(k => {
                if (k !== '@odata.etag' && k !== 'SAP__Messages' && row[k] !== null && row[k] !== '')
                    console.log('  ' + k + ' = ' + row[k]);
            });
        } else {
            console.log('Error: ' + r.status);
            const errText = await tryCreds(billUrl.replace('$top=10', '$top=1'), 'application/xml');
            console.log('XML response: ' + (errText.error || '').substring(0, 500));
        }
    }
}

go();
